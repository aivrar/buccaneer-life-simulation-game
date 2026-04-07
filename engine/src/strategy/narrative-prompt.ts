/**
 * Narrative prompt orchestrator.
 * Single entry point: gathers data → computes values → builds sections → trims to budget.
 * Returns the complete user message string ready for the LLM.
 */

import type { AgentState, WorldState } from '../runtime/types.js';
import type { MemoryStore } from '../runtime/memory-store.js';
import { gatherAgentData } from './narrative-data.js';
import { computeValues } from './narrative-compute.js';
import { buildAllSections, type NarrativeSection } from './narrative-sections.js';

const TOKEN_BUDGET = 1400;  // 2048 context - ~120 system - ~16 output - ~500 buffer

// Sections where stop-word compression is allowed (data-heavy, not atmospheric)
const COMPRESSIBLE_SECTIONS = new Set([
  'ship', 'crew', 'economic', 'intel', 'legal', 'relationships', 'planning',
]);

// Common English stop words — stripped to save tokens while preserving meaning
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'that', 'which', 'who',
  'whom', 'this', 'these', 'those', 'it', 'its', 'very', 'just',
  'about', 'also', 'then', 'than', 'into', 'some', 'such', 'only',
  'other', 'both', 'each', 'more', 'most', 'here', 'there',
]);

/** Recent action record passed from harness for history section. */
export interface RecentActionRecord {
  action: string;
  result: string;
  wasStub: boolean;
  failed: boolean;
}

/**
 * Build the complete narrative user message for an agent decision.
 * Handles: data fetching → pre-computation → section building → token trimming.
 *
 * recentActions (optional): passed from harness so history is INSIDE the token budget.
 */
export async function buildNarrativePrompt(
  agent: AgentState,
  worldState: WorldState,
  memoryStore: MemoryStore,
  validActions: string[],
  recentActions?: RecentActionRecord[],
): Promise<string> {
  // 1. Gather all data
  const snapshot = await gatherAgentData(agent, worldState, memoryStore);

  // 2. Pre-compute derived values
  const computed = computeValues(snapshot);

  // 3. Build all applicable sections (including recent history)
  const sections = buildAllSections(snapshot, computed, validActions, recentActions);

  // 4. Trim to budget
  const trimmed = trimToBudget(sections, TOKEN_BUDGET);

  // 5. Join into final prompt — use blank lines, not --- separators
  //    (small models echo --- back in their response)
  return trimmed
    .map(s => s.content)
    .join('\n\n');
}

/**
 * Estimate token count from text.
 * Uses word count × 1.35 which is reasonably accurate for English prose
 * with embedded numbers and proper nouns.
 */
function estimateTokens(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.35);
}

/**
 * Trim sections to fit within token budget.
 *
 * Four-stage compression, applied per section from lowest priority first:
 *   1. Strip stop words from the back of data-heavy sections, sentence by sentence
 *   2. Switch to shortContent if available
 *   3. Remove section entirely
 *   4. Never trim sections with canTrim=false (SCENE, BODY, ACTIONS)
 *
 * Stop-word stripping only applies to data-heavy sections (ship, crew, economic,
 * intel, legal, relationships, planning). Atmospheric sections (scene, body, self,
 * memories) keep their full prose to preserve the narrative voice that primes
 * the LLM's character output.
 */
function trimToBudget(sections: NarrativeSection[], budget: number): NarrativeSection[] {
  let totalTokens = sections.reduce((sum, s) => sum + estimateTokens(s.content), 0);

  if (totalTokens <= budget) {
    return sections;
  }

  // Sort trimmable sections by priority descending (trim highest number first)
  const trimmable = sections
    .filter(s => s.canTrim)
    .sort((a, b) => b.priority - a.priority);

  for (const section of trimmable) {
    if (totalTokens <= budget) break;

    // Stage 1: Strip stop words from the back, sentence by sentence
    if (COMPRESSIBLE_SECTIONS.has(section.id)) {
      const before = estimateTokens(section.content);
      section.content = compressFromBack(section.content, totalTokens - budget);
      const after = estimateTokens(section.content);
      totalTokens -= (before - after);
      if (totalTokens <= budget) break;
    }

    // Stage 2: Switch to shortContent if available
    if (section.shortContent) {
      const currentTokens = estimateTokens(section.content);
      const shortTokens = estimateTokens(section.shortContent);
      const savings = currentTokens - shortTokens;

      if (savings > 0) {
        section.content = section.shortContent;
        totalTokens -= savings;
        if (totalTokens <= budget) break;
      }
    }

    // Stage 3: Remove entirely
    if (totalTokens > budget) {
      const removedTokens = estimateTokens(section.content);
      section.content = '';
      totalTokens -= removedTokens;
    }
  }

  // Filter out empty sections
  return sections.filter(s => s.content.length > 0);
}

/**
 * Strip stop words from the back of a text, sentence by sentence.
 * Preserves the front (which sets tone/context) and only compresses
 * the tail end as needed.
 *
 * @param text - The section text
 * @param tokensToSave - How many tokens we need to save (approximate)
 * @returns Compressed text
 */
function compressFromBack(text: string, tokensToSave: number): string {
  // Split into sentences (keep delimiters)
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g);
  if (!sentences || sentences.length <= 1) return text;

  let saved = 0;

  // Work backwards, compressing one sentence at a time
  for (let i = sentences.length - 1; i >= 1; i--) {
    if (saved >= tokensToSave) break;

    const original = sentences[i]!;
    const compressed = stripStopWords(original);
    const originalTokens = estimateTokens(original);
    const compressedTokens = estimateTokens(compressed);

    sentences[i] = compressed;
    saved += (originalTokens - compressedTokens);
  }

  return sentences.join('');
}

/**
 * Remove stop words from a sentence while preserving meaning.
 * Keeps the first word regardless (sentence opener matters for flow).
 * Preserves numbers, names (capitalized words), and punctuation.
 */
function stripStopWords(sentence: string): string {
  const words = sentence.split(/(\s+)/);
  const result: string[] = [];
  let isFirst = true;

  for (const token of words) {
    // Preserve whitespace tokens as-is
    if (/^\s+$/.test(token)) {
      result.push(token);
      continue;
    }

    // Always keep the first real word
    if (isFirst) {
      result.push(token);
      isFirst = false;
      continue;
    }

    // Strip punctuation for lookup, preserve it in output
    const bare = token.replace(/[^a-zA-Z]/g, '').toLowerCase();

    // Keep if: not a stop word, is a number, is capitalized (likely a name), or is empty
    if (!STOP_WORDS.has(bare) || /\d/.test(token) || /^[A-Z]/.test(token) || bare === '') {
      result.push(token);
    }
  }

  return result.join('');
}

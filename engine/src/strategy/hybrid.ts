import type { AgentState, WorldState, AgentDecision, TickContext, LLMMessage } from '../runtime/types.js';
import { LLMClient } from '../runtime/llm-client.js';
import { MemoryStore } from '../runtime/memory-store.js';
import { filterActionsForAgent } from './action-filter.js';
import { parseAgentResponse } from './response-parser.js';
import { buildNarrativePrompt } from './narrative-prompt.js';
import { AGENT_TYPE_CONFIGS } from '../config/agents.js';
import { getHistoricalSystemPrompt } from '../agents/historical-figures.js';

/**
 * Hybrid strategy: Rule engine filters → narrative prompt → single LLM call
 *
 * 1. Rule engine evaluates world state → produces 4-10 valid actions
 * 2. Narrative prompt builder gathers all data, computes values,
 *    builds rich prose sections (proprioception + nudges + memories + planning),
 *    trims to 3500 token budget
 * 3. Single LLM call with narrative context → picks action + reasoning
 * 4. Parse response, validate, return decision
 */
export async function hybridDecision(
  agent: AgentState,
  worldState: WorldState,
  tick: TickContext,
  llmClient: LLMClient,
  memoryStore: MemoryStore,
): Promise<AgentDecision | null> {
  const typeConfig = AGENT_TYPE_CONFIGS[agent.type];
  if (!typeConfig) return null;

  // 1. Filter available actions via rule engine
  const validActions = filterActionsForAgent(agent, worldState);
  if (validActions.length === 0) return null;

  // 2. Build complete narrative prompt (replaces proprio + nudges + memories)
  const userPrompt = await buildNarrativePrompt(agent, worldState, memoryStore, validActions);

  // 3. Build system prompt — historical figures get character-specific prompts
  const historicalPrompt = getHistoricalSystemPrompt(agent.id);
  const systemPrompt = fillSystemPrompt(
    historicalPrompt ?? typeConfig.systemPromptTemplate, agent, worldState,
  );

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  // 4. Single LLM call
  const response = await llmClient.chatCompletion({
    messages,
    temperature: typeConfig.inferenceTier === 'high' ? 0.7 : 0.5,
    maxTokens: 16,
  });

  // 5. Parse response
  const parsed = parseAgentResponse(response.content, validActions);
  if (!parsed) return null;

  return {
    agentId: agent.id,
    action: parsed.action,
    params: parsed.params,
    reasoning: parsed.reasoning,
    confidence: 1.0,
    tickNumber: tick.tickNumber,
  };
}

/**
 * Fill all known placeholders in a system prompt template.
 * Removes any unfilled {placeholder} tokens so the model doesn't see raw template syntax.
 */
export function fillSystemPrompt(
  template: string,
  agent: AgentState,
  worldState: WorldState,
): string {
  const CAPTAIN_TYPES = new Set(['pirate_captain', 'merchant_captain', 'naval_officer', 'privateer_captain', 'pirate_hunter']);
  const captainName = CAPTAIN_TYPES.has(agent.type) ? agent.name : 'the captain';

  // Build persona text from paragraph + background
  const personaParts = [agent.persona?.paragraph, agent.persona?.background].filter(Boolean);
  const personaText = personaParts.join(' ') || '';

  return template
    .replace(/\{name\}/g, agent.name)
    .replace(/\{year\}/g, String(worldState.gameTime.year))
    .replace(/\{persona\}/g, personaText)
    .replace(/\{shipName\}/g, agent.shipId ? 'your vessel' : '')
    .replace(/\{shipClass\}/g, '')
    .replace(/\{crewCount\}/g, '')
    .replace(/\{cargoSummary\}/g, 'trade goods')
    .replace(/\{rank\}/g, 'officer')
    .replace(/\{attitude\}/g, '')
    .replace(/\{portName\}/g, agent.portId || 'port')
    .replace(/\{nation\}/g, 'England')
    .replace(/\{enemies\}/g, 'enemy')
    .replace(/\{captainName\}/g, captainName)
    .replace(/\{role\}/g, agent.type.replace(/_/g, ' '))
    .replace(/\{tavernName\}/g, 'the tavern')
    .replace(/\{cropType\}/g, 'sugar')
    // Strip any remaining unfilled placeholders
    .replace(/\{[a-zA-Z_]+\}/g, '')
    // Append output format instruction — 4B models need this in system prompt
    // to produce ACTION: format instead of narrative prose or bare numbers.
    + '\n\nWhen asked what you do, reply with ONLY the number of your choice. Nothing else.';
}

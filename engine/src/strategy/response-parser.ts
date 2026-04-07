/**
 * Parse LLM response into a structured action decision.
 *
 * Strategy: extract first number, map to position in action list.
 * maxTokens is 16 — model outputs a digit, parser reads it.
 *
 * Action ordering: do_nothing last. Must match cognitive-prompt.ts.
 */

/**
 * Parse LLM response into a structured action decision.
 *
 * The `shownActions` parameter is the exact ordered list that was presented
 * to the LLM in the prompt (already filtered and reordered by buildCognitivePrompt).
 * The parser just maps the number to that list — no re-ordering needed.
 */
export function parseAgentResponse(
  content: string,
  shownActions: string[],
  lastAction?: string,
): { action: string; params: Record<string, unknown>; reasoning: string } | null {
  if (!content || content.trim().length === 0) return null;

  // Strip <think>...</think> blocks (Qwen reasoning traces)
  content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  content = content.replace(/<think>[\s\S]*/g, '').trim();
  // Strip <reasoning>...</reasoning> blocks
  content = content.replace(/<reasoning>[\s\S]*?<\/reasoning>/g, '').trim();
  // Strip "assistant" role token prefix (vLLM artifact)
  content = content.replace(/^(assistant\s*)+/i, '').trim();

  if (content.length === 0) return null;

  // Extract first number from response
  const match = content.match(/\d+/);
  if (!match) return null;

  const index = parseInt(match[0]!, 10);
  if (isNaN(index) || index < 1 || index > shownActions.length) return null;

  return { action: shownActions[index - 1]!, params: {}, reasoning: '' };
}

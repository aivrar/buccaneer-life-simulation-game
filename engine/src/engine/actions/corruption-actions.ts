import type { AgentState } from '../../runtime/types.js';
import { bribeOfficial } from '../corruption.js';
import type { ActionResult } from './sail-to.js';

export async function executeBribe(
  agent: AgentState,
  params: Record<string, unknown>,
): Promise<ActionResult> {
  const action = (params.bribe_action as string) ?? 'look_away';
  const validActions = ['avoid_arrest', 'reduce_evidence', 'release_prisoner', 'look_away', 'tip_off'];
  if (!validActions.includes(action)) {
    return { success: false, message: `Invalid bribe action: ${action}` };
  }

  const result = await bribeOfficial(
    agent.id,
    agent.portId,
    action as any,
  );

  return { success: result.success, message: result.message, data: { cost: result.cost } };
}

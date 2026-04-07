/**
 * Planning nudge: strategic thinking in the agent's voice.
 * Shows active plan progress or suggests 2-3 strategic paths.
 */

import type { AgentDataSnapshot } from '../strategy/narrative-data.js';
import type { ComputedValues } from '../strategy/narrative-compute.js';
import { buildBranchingPaths } from './branch-builder.js';

export function buildPlanningNudge(snapshot: AgentDataSnapshot, computed: ComputedValues): string {
  const plan = snapshot.activePlan;

  if (plan) {
    const lines: string[] = [];
    lines.push(`You are pursuing a plan: "${plan.goal}." Progress: ${plan.stepsCompleted} of ${plan.totalSteps} steps completed.`);
    if (plan.nextStep) {
      lines.push(`Next step: ${plan.nextStep}.`);
    }
    if (plan.expiresAtTick && plan.expiresAtTick <= (snapshot.agent.lastDecisionTick + 24)) {
      lines.push('This plan is running out of time. Finish it or abandon it.');
    }
    return lines.join(' ');
  }

  // No plan — suggest paths in prose (avoid numbered plan-name format that 4B models echo as actions)
  const paths = buildBranchingPaths(snapshot, computed);
  if (paths.length === 0) return '';

  const lines = ['You have no plan. Consider what matters most right now:'];
  paths.forEach((path) => {
    lines.push(`— You could ${path.description.charAt(0).toLowerCase() + path.description.slice(1)}`);
  });
  return lines.join('\n');
}

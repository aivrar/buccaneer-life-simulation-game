/**
 * Plan CRUD + expiration.
 * Agents can have one active plan at a time.
 */

export interface AgentPlan {
  id: string;
  agentId: string;
  goal: string;
  steps: string[];
  totalSteps: number;
  stepsCompleted: number;
  nextStep: string | null;
  status: 'active' | 'completed' | 'abandoned' | 'expired';
  createdAtTick: number;
  expiresAtTick: number | null;
}

// In-memory plan store (will be persisted to DB later)
const activePlans = new Map<string, AgentPlan>();

export function createPlan(
  agentId: string,
  goal: string,
  steps: string[],
  currentTick: number,
  ttlTicks?: number,
): AgentPlan {
  const plan: AgentPlan = {
    id: `plan_${agentId}_${currentTick}`,
    agentId,
    goal,
    steps,
    totalSteps: steps.length,
    stepsCompleted: 0,
    nextStep: steps[0] ?? null,
    status: 'active',
    createdAtTick: currentTick,
    expiresAtTick: ttlTicks ? currentTick + ttlTicks : null,
  };

  // Replace any existing plan
  activePlans.set(agentId, plan);
  return plan;
}

export function getActivePlan(agentId: string): AgentPlan | null {
  const plan = activePlans.get(agentId);
  if (!plan || plan.status !== 'active') return null;
  return plan;
}

export function advancePlan(agentId: string): AgentPlan | null {
  const plan = activePlans.get(agentId);
  if (!plan || plan.status !== 'active') return null;

  plan.stepsCompleted++;
  if (plan.stepsCompleted >= plan.totalSteps) {
    plan.status = 'completed';
    plan.nextStep = null;
  } else {
    plan.nextStep = plan.steps[plan.stepsCompleted] ?? null;
  }

  return plan;
}

export function abandonPlan(agentId: string): void {
  const plan = activePlans.get(agentId);
  if (plan) {
    plan.status = 'abandoned';
  }
}

export function expirePlans(currentTick: number): number {
  let expired = 0;
  for (const plan of activePlans.values()) {
    if (plan.status === 'active' && plan.expiresAtTick && currentTick >= plan.expiresAtTick) {
      plan.status = 'expired';
      expired++;
    }
  }
  return expired;
}

export function clearCompletedPlans(): void {
  for (const [agentId, plan] of activePlans.entries()) {
    if (plan.status !== 'active') {
      activePlans.delete(agentId);
    }
  }
}

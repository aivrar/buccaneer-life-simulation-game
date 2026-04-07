import type { AgentState } from '../../runtime/types.js';
import { AgentQueries, WoundQueries } from '../../db/queries.js';
import { v4 as uuid } from 'uuid';
import type { ActionResult } from './sail-to.js';

// ============================================================
// Surgeon / Medical Actions
// ============================================================

/** Helper: mark a wound as treated via direct query. */
async function markWoundTreated(woundId: string): Promise<void> {
  const { execute } = await import('../../db/sqlite.js');
  await execute('UPDATE wounds SET treated = 1 WHERE id = ?', [woundId]);
}

/** Helper: boost healing progress on a wound. */
async function boostHealing(woundId: string, amount: number): Promise<void> {
  const { execute } = await import('../../db/sqlite.js');
  await execute('UPDATE wounds SET healing_progress = MIN(100, healing_progress + ?) WHERE id = ?', [amount, woundId]);
}

/** Helper: find agents at the same port with untreated wounds. */
async function findWoundedAtPort(portId: string, excludeAgentId: string) {
  const portAgents = await AgentQueries.getByPort(portId);
  const results: Array<{
    agent: Awaited<ReturnType<typeof AgentQueries.getById>>;
    wound: Awaited<ReturnType<typeof WoundQueries.getByAgent>>[number];
  }> = [];

  for (const a of portAgents) {
    if (a.id === excludeAgentId || a.status === 'dead') continue;
    const wounds = await WoundQueries.getByAgent(a.id);
    const untreated = wounds.find(w => !w.treated);
    if (untreated) {
      results.push({ agent: a, wound: untreated });
    }
  }
  return results;
}

const DISEASE_TYPES = ['scurvy', 'fever', 'disease', 'infection'] as const;

/**
 * Treat an untreated wound on an agent at the same port.
 * Surgeon earns severity x 3 gold; patient pays if able.
 */
export async function executeTreatWound(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) {
    return { success: false, message: 'Must be at port to treat wounds' };
  }

  const wounded = await findWoundedAtPort(agent.portId, agent.id);
  // Filter to non-disease wounds
  const physicalWounded = wounded.filter(
    w => !DISEASE_TYPES.includes(w.wound.type as typeof DISEASE_TYPES[number]),
  );

  if (physicalWounded.length === 0) {
    return { success: true, message: 'No one needs treatment' };
  }

  const target = physicalWounded[0]!;
  const wound = target.wound;
  const targetAgent = target.agent!;

  // Mark wound as treated
  await markWoundTreated(wound.id);

  // Payment: severity x 3
  const fee = wound.severity * 3;
  if (targetAgent.cash >= fee) {
    await AgentQueries.addCash(targetAgent.id, -fee);
    await AgentQueries.addCash(agent.id, fee);
  } else {
    // Free treatment if they can't afford it — surgeon still earns base 10
    await AgentQueries.addCash(agent.id, 10);
  }

  return {
    success: true,
    message: `Treated a ${wound.type} wound on ${targetAgent.name}`,
    data: { wound_id: wound.id, target_id: targetAgent.id, fee },
  };
}

/**
 * Treat a disease (scurvy, fever, dysentery, infection) on an agent at port.
 * Surgeon earns severity x 5 gold.
 */
export async function executeTreatDisease(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) {
    return { success: false, message: 'Must be at port to treat diseases' };
  }

  const wounded = await findWoundedAtPort(agent.portId, agent.id);
  const diseased = wounded.filter(
    w => DISEASE_TYPES.includes(w.wound.type as typeof DISEASE_TYPES[number]),
  );

  if (diseased.length === 0) {
    return { success: true, message: 'No one needs treatment' };
  }

  const target = diseased[0]!;
  const wound = target.wound;
  const targetAgent = target.agent!;

  // Mark as treated
  await markWoundTreated(wound.id);

  // Payment: severity x 5
  const fee = wound.severity * 5;
  if (targetAgent.cash >= fee) {
    await AgentQueries.addCash(targetAgent.id, -fee);
    await AgentQueries.addCash(agent.id, fee);
  } else {
    await AgentQueries.addCash(agent.id, 10);
  }

  return {
    success: true,
    message: `Treated ${wound.type} on ${targetAgent.name}`,
    data: { wound_id: wound.id, target_id: targetAgent.id, fee },
  };
}

/**
 * Amputate a severely wounded limb (severity >= 7).
 * Removes the wound, creates a permanent 'broken_bone' wound.
 * Surgeon earns 25 gold.
 */
export async function executeAmputate(
  agent: AgentState,
  _params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  if (!agent.portId) {
    return { success: false, message: 'Must be at port to perform surgery' };
  }

  // Find agents with severe wounds
  const portAgents = await AgentQueries.getByPort(agent.portId);
  let targetAgent: Awaited<ReturnType<typeof AgentQueries.getById>> | null = null;
  let severeWound: Awaited<ReturnType<typeof WoundQueries.getByAgent>>[number] | null = null;

  for (const a of portAgents) {
    if (a.id === agent.id || a.status === 'dead') continue;
    const wounds = await WoundQueries.getByAgent(a.id);
    const severe = wounds.find(w => w.severity >= 7);
    if (severe) {
      targetAgent = a;
      severeWound = severe;
      break;
    }
  }

  if (!targetAgent || !severeWound) {
    return { success: true, message: 'No amputations needed' };
  }

  // Remove the severe wound
  await WoundQueries.remove(severeWound.id);

  // Create permanent wound — treated, low severity
  await WoundQueries.insert({
    id: uuid(),
    agent_id: targetAgent.id,
    type: 'broken_bone',
    severity: 3,
    location: 'limb',
    treated: true,
    healing_progress: 0,
    created_tick: tick,
  });

  // Surgeon earns 25 gold
  await AgentQueries.addCash(agent.id, 25);
  if (targetAgent.cash >= 25) {
    await AgentQueries.addCash(targetAgent.id, -25);
  }

  return {
    success: true,
    message: `Amputated — saved ${targetAgent.name}'s life`,
    data: { target_id: targetAgent.id, original_wound_id: severeWound.id },
  };
}

/**
 * Prescribe a remedy — general healing boost.
 * Boosts healing_progress by +20 on one wound. Surgeon earns 5 gold.
 */
export async function executePrescribeRemedy(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) {
    return { success: false, message: 'Must be at port to prescribe remedies' };
  }

  const wounded = await findWoundedAtPort(agent.portId, agent.id);
  if (wounded.length === 0) {
    return { success: true, message: 'No one needs treatment' };
  }

  const target = wounded[0]!;
  const wound = target.wound;
  const targetAgent = target.agent!;

  // Boost healing progress
  await boostHealing(wound.id, 20);

  // Surgeon earns 5 gold
  await AgentQueries.addCash(agent.id, 5);
  if (targetAgent.cash >= 5) {
    await AgentQueries.addCash(targetAgent.id, -5);
  }

  return {
    success: true,
    message: `Prescribed a remedy for ${targetAgent.name}`,
    data: { wound_id: wound.id, target_id: targetAgent.id },
  };
}

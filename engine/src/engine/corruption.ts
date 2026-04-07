/**
 * Corruption mechanics — how port corruption affects world systems.
 * Port corruption is 0 (squeaky clean) to 100 (anything goes).
 *
 * Effects:
 * - Arrest chance reduced by corruption
 * - Trial conviction threshold raised by corruption
 * - Cargo inspection chance reduced by corruption
 * - Bribe cost scaled inversely by corruption (corrupt ports = cheap bribes)
 * - Fence availability increased by corruption
 * - Navy patrol effectiveness reduced by corruption
 */

import { AgentQueries, PortQueries } from '../db/queries.js';

export interface CorruptionModifiers {
  arrestChanceMod: number;        // 0-1, multiplied against base arrest chance
  convictionChanceMod: number;    // 0-1, multiplied against case weight
  inspectionChanceMod: number;    // 0-1, multiplied against base inspection chance
  fenceAvailabilityMod: number;   // 1-2, multiplied against fence availability
  patrolEffectivenessMod: number; // 0-1, multiplied against patrol density
}

export function getCorruptionModifiers(corruption: number): CorruptionModifiers {
  const c = corruption / 100; // 0-1 normalized

  return {
    // High corruption = low arrest chance (0.3 at corruption 100, 1.0 at corruption 0)
    arrestChanceMod: Math.max(0.3, 1.0 - c * 0.7),

    // High corruption = harder to convict (0.4 at 100, 1.0 at 0)
    convictionChanceMod: Math.max(0.4, 1.0 - c * 0.6),

    // High corruption = inspections rare (0.1 at 100, 1.0 at 0)
    inspectionChanceMod: Math.max(0.1, 1.0 - c * 0.9),

    // High corruption = fences more available (2.0 at 100, 1.0 at 0)
    fenceAvailabilityMod: 1.0 + c,

    // High corruption = patrols ineffective (0.2 at 100, 1.0 at 0)
    patrolEffectivenessMod: Math.max(0.2, 1.0 - c * 0.8),
  };
}

export function calculateBribeCost(
  corruption: number,
  baseAction: 'avoid_arrest' | 'reduce_evidence' | 'release_prisoner' | 'look_away' | 'tip_off',
): number {
  const baseCosts: Record<string, number> = {
    avoid_arrest: 200,
    reduce_evidence: 150,
    release_prisoner: 500,
    look_away: 50,     // ignore cargo inspection
    tip_off: 100,      // warn about incoming navy
  };

  const base = baseCosts[baseAction] ?? 100;
  // High corruption = cheaper bribes (0.3x at 100, 1.5x at 0)
  const costMod = Math.max(0.3, 1.5 - (corruption / 100) * 1.2);
  return Math.round(base * costMod);
}

export async function bribeOfficial(
  agentId: string,
  portId: string,
  action: 'avoid_arrest' | 'reduce_evidence' | 'release_prisoner' | 'look_away' | 'tip_off',
): Promise<{ success: boolean; message: string; cost?: number }> {
  const agent = await AgentQueries.getById(agentId);
  if (!agent) return { success: false, message: 'Agent not found' };

  const port = await PortQueries.getById(portId);
  if (!port) return { success: false, message: 'Port not found' };

  const cost = calculateBribeCost(port.corruption, action);
  if (agent.cash < cost) return { success: false, message: `Insufficient funds (need ${cost})` };

  // Bribe success chance based on corruption level
  // At corruption 0: 10% chance. At corruption 100: 95% chance.
  const successChance = 0.1 + (port.corruption / 100) * 0.85;
  if (Math.random() > successChance) {
    // Bribe rejected — still lose half the money (they pocket it)
    await AgentQueries.addCash(agentId, -Math.round(cost * 0.5));
    return { success: false, message: 'Bribe rejected', cost: Math.round(cost * 0.5) };
  }

  await AgentQueries.addCash(agentId, -cost);
  return { success: true, message: `Bribed official: ${action}`, cost };
}

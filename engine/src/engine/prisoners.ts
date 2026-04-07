/**
 * Prisoner mechanics — what happens to captured crew and captains.
 *
 * After combat, defeated crew/captain become prisoners.
 * Captor decides: ransom, recruit, release, or imprison.
 * Each choice has different costs and consequences.
 */

import { v4 as uuid } from 'uuid';
import { AgentQueries, CrewQueries, ShipQueries, EventQueries } from '../db/queries.js';
import { recordReputationEvent } from './reputation.js';

export type PrisonerFate = 'ransomed' | 'recruited' | 'released' | 'imprisoned' | 'executed';

export interface PrisonerOutcome {
  prisonerId: string;
  fate: PrisonerFate;
  cashGain?: number;
  crewGain?: number;
  reputationEffect?: string;
}

/**
 * Ransom a captured captain for cash.
 * High-value targets fetch more. Nationality affects price.
 */
export async function ransomPrisoner(
  captorId: string,
  prisonerId: string,
  tick: number,
): Promise<PrisonerOutcome> {
  const prisoner = await AgentQueries.getById(prisonerId);
  if (!prisoner) return { prisonerId, fate: 'ransomed', cashGain: 0 };
  if (prisoner.status === 'dead') return { prisonerId, fate: 'ransomed', cashGain: 0 };

  // Ransom value based on agent type and infamy
  const baseRansom: Record<string, number> = {
    merchant_captain: 200,
    naval_officer: 300,
    port_governor: 1000,
    pirate_captain: 100,   // pirates don't have wealthy backers
    privateer_captain: 250,
  };
  const value = baseRansom[prisoner.type] ?? 50;
  const ransomAmount = value + prisoner.infamy * 2;

  // Pay captor
  const captor = await AgentQueries.getById(captorId);
  if (captor) {
    await AgentQueries.addCash(captorId, ransomAmount);
  }

  // Release prisoner
  await AgentQueries.updateStatus(prisonerId, 'in_port');

  return { prisonerId, fate: 'ransomed', cashGain: ransomAmount };
}

/**
 * Recruit captured crew into your own ship.
 * Recruited crew start with low loyalty.
 */
export async function recruitPrisoner(
  captorId: string,
  prisonerId: string,
  shipId: string,
  tick: number,
): Promise<PrisonerOutcome> {
  const prisoner = await AgentQueries.getById(prisonerId);
  if (!prisoner) return { prisonerId, fate: 'recruited', crewGain: 0 };
  if (prisoner.status === 'dead') return { prisonerId, fate: 'recruited', crewGain: 0 };

  const ship = await ShipQueries.getById(shipId);
  if (!ship || ship.crew_count >= ship.crew_capacity) {
    return { prisonerId, fate: 'recruited', crewGain: 0 };
  }

  // Create crew record with low starting loyalty
  await CrewQueries.insert({
    id: uuid(),
    agent_id: prisonerId,
    ship_id: shipId,
    role: 'common_sailor',
    loyalty: 25, // pressed into service — not happy
    share_agreement: 1.0,
    grievances: '[]',
    skills: '{}',
    joined_tick: tick,
    status: 'active',
  });

  await ShipQueries.updateCrewCount(shipId, ship.crew_count + 1);
  await AgentQueries.updateStatus(prisonerId, 'at_sea');

  return { prisonerId, fate: 'recruited', crewGain: 1 };
}

/**
 * Release a prisoner. Costs nothing, earns reputation/honor.
 */
export async function releasePrisoner(
  captorId: string,
  prisonerId: string,
  zoneId: string,
  tick: number,
): Promise<PrisonerOutcome> {
  const prisoner = await AgentQueries.getById(prisonerId);
  if (!prisoner || prisoner.status === 'dead') return { prisonerId, fate: 'released' };

  await AgentQueries.updateStatus(prisonerId, 'in_port');

  // Releasing prisoners is merciful — reputation boost
  await recordReputationEvent(captorId, zoneId, 'rescue', tick);

  return { prisonerId, fate: 'released', reputationEffect: 'rescue' };
}

/**
 * Process all prisoners after a combat event.
 * Called from encounter-tick after ship capture.
 * Returns outcomes for logging.
 */
export async function processPostCombatPrisoners(
  captorAgentId: string,
  captorShipId: string,
  capturedShipId: string,
  zoneId: string,
  tick: number,
): Promise<PrisonerOutcome[]> {
  const outcomes: PrisonerOutcome[] = [];

  const capturedShip = await ShipQueries.getById(capturedShipId);
  if (!capturedShip) return outcomes;

  // Process captain
  if (capturedShip.captain_id) {
    // Default: ransom captains (AI decision — LLM will override later)
    const outcome = await ransomPrisoner(captorAgentId, capturedShip.captain_id, tick);
    outcomes.push(outcome);
  }

  // Process crew — recruit some, release rest
  const crew = await CrewQueries.getActiveByShip(capturedShipId);
  const captorShip = await ShipQueries.getById(captorShipId);
  const availableSlots = captorShip ? captorShip.crew_capacity - captorShip.crew_count : 0;

  let recruited = 0;
  for (const member of crew) {
    if (recruited < Math.min(availableSlots, Math.ceil(crew.length * 0.3))) {
      // Recruit up to 30% of captured crew (or available slots)
      const outcome = await recruitPrisoner(captorAgentId, member.agent_id, captorShipId, tick);
      outcomes.push(outcome);
      recruited++;
    } else {
      // Release the rest
      const outcome = await releasePrisoner(captorAgentId, member.agent_id, zoneId, tick);
      outcomes.push(outcome);
    }
    // Remove from captured ship's crew
    await CrewQueries.remove(member.id);
  }

  return outcomes;
}

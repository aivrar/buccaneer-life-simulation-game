/**
 * Encounter detection and pre-agent resolution.
 * Checks for ship-to-ship encounters in shared sea zones.
 */

import { ShipQueries, AgentQueries } from '../db/queries.js';
import type { Ship } from '../db/models.js';
import { getLetterOfMarque } from './documents.js';

export type EncounterType = 'sighting' | 'close_pass' | 'chase' | 'engagement';

export interface Encounter {
  id: string;
  type: EncounterType;
  ship1Id: string;
  ship2Id: string;
  zoneId: string;
  tick: number;
}

export interface EncounterDecision {
  encounter: Encounter;
  combatTriggered: boolean;
  attackerId: string | null;
  defenderId: string | null;
  reason: string;
}

const PIRATE_TYPES = new Set(['pirate_captain', 'privateer_captain']);
const NAVY_TYPES = new Set(['naval_officer', 'pirate_hunter']);
const MERCHANT_TYPES = new Set(['merchant_captain']);

// ---------------------------------------------------------------------------
// Persistent combat-pair cooldown — prevents same ships re-engaging instantly
// ---------------------------------------------------------------------------

const COMBAT_PAIR_COOLDOWN_TICKS = 48; // 2 game days before same pair can fight again

// pairKey → tick when cooldown expires
const recentCombatPairs = new Map<string, number>();

export function makePairKey(shipId1: string, shipId2: string): string {
  return [shipId1, shipId2].sort().join(':');
}

/** Mark a pair as having just fought — blocks re-encounter for COMBAT_PAIR_COOLDOWN_TICKS. */
export function registerCombatPair(shipId1: string, shipId2: string, tick: number): void {
  const key = makePairKey(shipId1, shipId2);
  recentCombatPairs.set(key, tick + COMBAT_PAIR_COOLDOWN_TICKS);
}

/** Check if a pair is still on cooldown from a recent fight. */
function pairOnCooldown(shipId1: string, shipId2: string, tick: number): boolean {
  const key = makePairKey(shipId1, shipId2);
  const expiry = recentCombatPairs.get(key);
  if (expiry === undefined) return false;
  if (tick >= expiry) {
    recentCombatPairs.delete(key);
    return false;
  }
  return true;
}

/** Periodic cleanup of expired cooldowns (call from encounter-tick). */
export function pruneExpiredCooldowns(tick: number): void {
  for (const [key, expiry] of recentCombatPairs) {
    if (tick >= expiry) recentCombatPairs.delete(key);
  }
}

export async function detectEncounters(
  zoneId: string,
  encounterChance: number,
  visibility: number,
  tick: number,
): Promise<Encounter[]> {
  const ships = await ShipQueries.getByZone(zoneId);
  const sailingShips = ships.filter(s => s.status === 'sailing');
  if (sailingShips.length < 2) return [];

  const encounters: Encounter[] = [];
  const checked = new Set<string>();

  for (let i = 0; i < sailingShips.length; i++) {
    for (let j = i + 1; j < sailingShips.length; j++) {
      const s1 = sailingShips[i]!;
      const s2 = sailingShips[j]!;
      const pairKey = makePairKey(s1.id, s2.id);
      if (checked.has(pairKey)) continue;
      checked.add(pairKey);

      // Skip pairs that recently fought
      if (pairOnCooldown(s1.id, s2.id, tick)) continue;

      // Roll against encounter chance modified by visibility
      const roll = Math.random() * 100;
      const threshold = encounterChance * visibility;
      if (roll > threshold) continue;

      // Determine encounter type based on roll distance
      let type: EncounterType;
      if (roll < threshold * 0.2) {
        type = 'engagement';
      } else if (roll < threshold * 0.4) {
        type = 'chase';
      } else if (roll < threshold * 0.7) {
        type = 'close_pass';
      } else {
        type = 'sighting';
      }

      encounters.push({
        id: `enc_${tick}_${s1.id}_${s2.id}`,
        type,
        ship1Id: s1.id,
        ship2Id: s2.id,
        zoneId,
        tick,
      });
    }
  }

  return encounters;
}

async function getShipRole(ship: Ship): Promise<'pirate' | 'navy' | 'merchant' | 'unknown'> {
  if (!ship.captain_id) return 'merchant'; // uncaptained ships are merchant vessels
  const agent = await AgentQueries.getById(ship.captain_id);
  if (!agent) return 'unknown';
  if (PIRATE_TYPES.has(agent.type)) return 'pirate';
  if (NAVY_TYPES.has(agent.type)) return 'navy';
  if (MERCHANT_TYPES.has(agent.type)) return 'merchant';
  return 'unknown';
}

export async function resolveEncounterDecision(
  encounter: Encounter,
  ship1: Ship,
  ship2: Ship,
): Promise<EncounterDecision> {
  // Sightings never trigger combat
  if (encounter.type === 'sighting') {
    return { encounter, combatTriggered: false, attackerId: null, defenderId: null, reason: 'ships spotted each other at distance' };
  }

  const [role1, role2] = await Promise.all([getShipRole(ship1), getShipRole(ship2)]);

  // Navy vs pirate → navy engages unless privateer has valid letter of marque
  if (role1 === 'navy' && role2 === 'pirate') {
    const hasLetter = ship2.captain_id ? await getLetterOfMarque(ship2.captain_id, encounter.tick) : null;
    if (!hasLetter || hasLetter.is_forged) {
      return { encounter, combatTriggered: true, attackerId: ship1.id, defenderId: ship2.id, reason: 'navy engages pirate' };
    }
    // Privateer with valid letter — pass without incident
  }
  if (role2 === 'navy' && role1 === 'pirate') {
    const hasLetter = ship1.captain_id ? await getLetterOfMarque(ship1.captain_id, encounter.tick) : null;
    if (!hasLetter || hasLetter.is_forged) {
      return { encounter, combatTriggered: true, attackerId: ship2.id, defenderId: ship1.id, reason: 'navy engages pirate' };
    }
  }

  // Pirate vs merchant → pirate attacks if stronger
  if (role1 === 'pirate' && role2 === 'merchant') {
    const stronger = ship1.guns >= ship2.guns || ship1.crew_count >= ship2.crew_count * 1.2;
    if (stronger) {
      return { encounter, combatTriggered: true, attackerId: ship1.id, defenderId: ship2.id, reason: 'pirate attacks merchant' };
    }
  }
  if (role2 === 'pirate' && role1 === 'merchant') {
    const stronger = ship2.guns >= ship1.guns || ship2.crew_count >= ship1.crew_count * 1.2;
    if (stronger) {
      return { encounter, combatTriggered: true, attackerId: ship2.id, defenderId: ship1.id, reason: 'pirate attacks merchant' };
    }
  }

  // Pirate vs pirate — only engage if 'engagement' type encounter and one is much stronger
  if (role1 === 'pirate' && role2 === 'pirate' && encounter.type === 'engagement') {
    const strength1 = ship1.guns + ship1.crew_count;
    const strength2 = ship2.guns + ship2.crew_count;
    if (strength1 > strength2 * 1.5) {
      return { encounter, combatTriggered: true, attackerId: ship1.id, defenderId: ship2.id, reason: 'pirate attacks weaker pirate' };
    }
    if (strength2 > strength1 * 1.5) {
      return { encounter, combatTriggered: true, attackerId: ship2.id, defenderId: ship1.id, reason: 'pirate attacks weaker pirate' };
    }
  }

  // Default: no combat
  return { encounter, combatTriggered: false, attackerId: null, defenderId: null, reason: 'ships pass without incident' };
}

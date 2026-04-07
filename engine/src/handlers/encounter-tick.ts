import type { TickHandler, TickContext } from '../runtime/types.js';
import { TickPhase } from '../runtime/types.js';
import { SeaZoneQueries, ShipQueries, AgentQueries, CrewQueries, IntelQueries } from '../db/queries.js';
import { getSeaStateMap } from './weather-tick.js';
import { detectEncounters, resolveEncounterDecision, registerCombatPair, pruneExpiredCooldowns } from '../engine/encounters.js';
import { resolveCombat } from '../engine/combat.js';
import { ECONOMY } from '../config/economy.js';
import { NAVY_CONFIG } from '../config/navy.js';
import { recordReputationEvent, type ReputationEvent } from '../engine/reputation.js';
import { NavyCaseQueries } from '../db/queries.js';
import { v4 as uuidv4 } from 'uuid';
import { processPostCombatPrisoners } from '../engine/prisoners.js';

/** Agent types whose captains make their own engage/flee decisions via LLM */
const LLM_CAPTAIN_TYPES = new Set([
  'pirate_captain', 'merchant_captain', 'naval_officer', 'privateer_captain', 'pirate_hunter',
]);

/** Agent types that auto-attack NPC ships on encounter */
const PIRATE_AGENT_TYPES = new Set(['pirate_captain', 'privateer_captain']);
const NAVY_AGENT_TYPES = new Set(['naval_officer', 'pirate_hunter']);

export const encounterTickHandler: TickHandler = {
  name: 'encounter-tick',
  phase: TickPhase.EVENTS,

  async execute(tick: TickContext): Promise<void> {
    // Check encounters every 2 ticks
    if (tick.tickNumber % 2 !== 0) return;

    // Prune expired combat-pair cooldowns periodically
    pruneExpiredCooldowns(tick.tickNumber);

    const seaZones = await SeaZoneQueries.getAll();
    const seaStateMap = getSeaStateMap();

    for (const zone of seaZones) {
      const visibility = seaStateMap.get(zone.id)?.visibility ?? 0.8;
      const encounterChance = zone.encounter_chance;

      const encounters = await detectEncounters(zone.id, encounterChance, visibility, tick.tickNumber);

      for (const encounter of encounters) {
        const [ship1, ship2] = await Promise.all([
          ShipQueries.getById(encounter.ship1Id),
          ShipQueries.getById(encounter.ship2Id),
        ]);
        if (!ship1 || !ship2) continue;

        // Check if either ship has an LLM-driven captain
        const [captain1, captain2] = await Promise.all([
          ship1.captain_id ? AgentQueries.getById(ship1.captain_id) : null,
          ship2.captain_id ? AgentQueries.getById(ship2.captain_id) : null,
        ]);

        // Dead captains can't command — treat their ships as NPC
        const liveCaptain1 = captain1 && captain1.status !== 'dead' ? captain1 : null;
        const liveCaptain2 = captain2 && captain2.status !== 'dead' ? captain2 : null;

        const hasLLMCaptain1 = liveCaptain1 && LLM_CAPTAIN_TYPES.has(liveCaptain1.type);
        const hasLLMCaptain2 = liveCaptain2 && LLM_CAPTAIN_TYPES.has(liveCaptain2.type);

        if (hasLLMCaptain1 || hasLLMCaptain2) {
          // Check for auto-combat: pirate/privateer agent vs NPC ship (no captain)
          // NPC ships can't respond to sightings, so by the time the agent acts the NPC
          // has sailed away. Auto-initiate combat for these encounters.
          const isPirate1 = liveCaptain1 && PIRATE_AGENT_TYPES.has(liveCaptain1.type);
          const isPirate2 = liveCaptain2 && PIRATE_AGENT_TYPES.has(liveCaptain2.type);
          const isNavy1 = liveCaptain1 && NAVY_AGENT_TYPES.has(liveCaptain1.type);
          const isNavy2 = liveCaptain2 && NAVY_AGENT_TYPES.has(liveCaptain2.type);
          const isNPC1 = !liveCaptain1; // no agent captain or dead = NPC
          const isNPC2 = !liveCaptain2;

          // Pirate agent vs NPC merchant — auto-attack
          if (isPirate1 && isNPC2) {
            registerCombatPair(ship1.id, ship2.id, tick.tickNumber);
            const seaCondition = getSeaStateMap().get(zone.id);
            const result = await resolveCombat(ship1.id, ship2.id, seaCondition, tick.tickNumber);
            await applyCombatLoyaltyEffects(ship1.id, ship2.id, result.winner, result.casualties);
            await recordCombatEvidence(ship1.id, ship2.id, 'pirate attacks merchant', result.shipCaptured, zone.id, tick.tickNumber);
            await recordCombatReputation(ship1.id, ship2.id, 'pirate attacks merchant', result.winner, result.shipCaptured, zone.id, tick.tickNumber);
            if (result.shipCaptured && result.winner === ship1.id && liveCaptain1) {
              await processPostCombatPrisoners(liveCaptain1.id, ship1.id, ship2.id, zone.id, tick.tickNumber);
            }
            continue;
          }
          if (isPirate2 && isNPC1) {
            registerCombatPair(ship2.id, ship1.id, tick.tickNumber);
            const seaCondition = getSeaStateMap().get(zone.id);
            const result = await resolveCombat(ship2.id, ship1.id, seaCondition, tick.tickNumber);
            await applyCombatLoyaltyEffects(ship2.id, ship1.id, result.winner, result.casualties);
            await recordCombatEvidence(ship2.id, ship1.id, 'pirate attacks merchant', result.shipCaptured, zone.id, tick.tickNumber);
            await recordCombatReputation(ship2.id, ship1.id, 'pirate attacks merchant', result.winner, result.shipCaptured, zone.id, tick.tickNumber);
            if (result.shipCaptured && result.winner === ship2.id && liveCaptain2) {
              await processPostCombatPrisoners(liveCaptain2.id, ship2.id, ship1.id, zone.id, tick.tickNumber);
            }
            continue;
          }

          // Navy/hunter vs NPC — generate sighting only, no auto-combat.
          // NPC ships are all merchant traffic from the vessel spawner; there's no
          // way to distinguish "NPC pirate" from "NPC merchant". Auto-combat here
          // was causing navy to seize merchant cargo they could never fence (213+
          // units stranded on Alejandro Silva in Run 40). Navy/hunters engage
          // LLM-captained pirates via the sighting system below.
          if ((isNavy1 && isNPC2) || (isNavy2 && isNPC1)) {
            // Just generate a sighting — the officer can decide to attack via LLM
            await generateEncounterSighting(ship1, ship2, liveCaptain1, liveCaptain2, zone.id, tick.tickNumber);
            continue;
          }

          // Both have LLM captains — generate sighting ONLY if they're different factions.
          // Same-faction sightings cause 78% of combat to be pirate-vs-pirate infighting
          // (Run 42: 556 of 709 events). Pirates don't hunt each other — they hunt merchants.
          const PIRATE_FACTION = new Set(['pirate_captain', 'privateer_captain']);
          const NAVY_FACTION = new Set(['naval_officer', 'pirate_hunter']);
          const MERCHANT_FACTION = new Set(['merchant_captain']);
          const type1 = liveCaptain1?.type ?? '';
          const type2 = liveCaptain2?.type ?? '';
          const sameFaction =
            (PIRATE_FACTION.has(type1) && PIRATE_FACTION.has(type2)) ||
            (NAVY_FACTION.has(type1) && NAVY_FACTION.has(type2)) ||
            (MERCHANT_FACTION.has(type1) && MERCHANT_FACTION.has(type2));
          if (!sameFaction) {
            await generateEncounterSighting(ship1, ship2, liveCaptain1, liveCaptain2, zone.id, tick.tickNumber);
          }
          continue;
        }

        // Background NPC ships (no agent captains): auto-resolve as before
        const decision = await resolveEncounterDecision(encounter, ship1, ship2);

        if (decision.combatTriggered && decision.attackerId && decision.defenderId) {
          // Register pair cooldown so they don't re-engage immediately
          registerCombatPair(decision.attackerId, decision.defenderId, tick.tickNumber);

          const seaCondition = seaStateMap.get(zone.id);
          const result = await resolveCombat(
            decision.attackerId,
            decision.defenderId,
            seaCondition,
            tick.tickNumber,
          );

          await applyCombatLoyaltyEffects(
            decision.attackerId,
            decision.defenderId,
            result.winner,
            result.casualties,
          );

          await recordCombatEvidence(
            decision.attackerId,
            decision.defenderId,
            decision.reason,
            result.shipCaptured,
            zone.id,
            tick.tickNumber,
          );

          await recordCombatReputation(
            decision.attackerId,
            decision.defenderId,
            decision.reason,
            result.winner,
            result.shipCaptured,
            zone.id,
            tick.tickNumber,
          );

          if (result.shipCaptured && result.winner === decision.attackerId) {
            const attackerShip = await ShipQueries.getById(decision.attackerId);
            if (attackerShip?.captain_id) {
              await processPostCombatPrisoners(
                attackerShip.captain_id,
                decision.attackerId,
                decision.defenderId,
                zone.id,
                tick.tickNumber,
              );
            }
          } else if (result.type === 'surrender') {
            await handleShipLoss(decision.defenderId);
          }
        }
      }
    }
  },
};

/** Generate mutual sighting intel when LLM-captained ships encounter each other. */
async function generateEncounterSighting(
  ship1: any, ship2: any,
  captain1: any, captain2: any,
  zoneId: string, tick: number,
): Promise<void> {
  // Each captain sees the other as a sighting
  if (captain1) {
    const otherName = ship2.name ?? 'unknown vessel';
    const otherType = captain2?.type?.replace(/_/g, ' ') ?? 'unknown';
    await IntelQueries.insert({
      id: uuidv4(),
      source_agent_id: captain1.id,
      subject_agent_id: captain2?.id ?? null,
      subject_ship_id: ship2.id,
      type: 'sighting',
      content: `Spotted ${otherName} (${ship2.class}) in ${zoneId} — appears to be a ${otherType}`,
      accuracy: 85,
      freshness: 100,
      port_id: '',
      price: null,
      created_tick: tick,
    });
  }
  if (captain2) {
    const otherName = ship1.name ?? 'unknown vessel';
    const otherType = captain1?.type?.replace(/_/g, ' ') ?? 'unknown';
    await IntelQueries.insert({
      id: uuidv4(),
      source_agent_id: captain2.id,
      subject_agent_id: captain1?.id ?? null,
      subject_ship_id: ship1.id,
      type: 'sighting',
      content: `Spotted ${otherName} (${ship1.class}) in ${zoneId} — appears to be a ${otherType}`,
      accuracy: 85,
      freshness: 100,
      port_id: '',
      price: null,
      created_tick: tick,
    });
  }
}

async function applyCombatLoyaltyEffects(
  attackerId: string,
  defenderId: string,
  winnerId: string,
  casualties: { attacker: number; defender: number },
): Promise<void> {
  const { loyaltyBoostFromVictory, loyaltyHitFromDefeat } = ECONOMY.crew;

  const winnerShipId = winnerId === attackerId ? attackerId : defenderId;
  const loserShipId = winnerId === attackerId ? defenderId : attackerId;

  // Victory boost
  const winnerCrew = await CrewQueries.getActiveByShip(winnerShipId);
  for (const c of winnerCrew) {
    await CrewQueries.updateLoyalty(c.id, Math.min(100, c.loyalty + loyaltyBoostFromVictory));
  }

  // Defeat penalty
  const loserCrew = await CrewQueries.getActiveByShip(loserShipId);
  for (const c of loserCrew) {
    await CrewQueries.updateLoyalty(c.id, Math.max(0, c.loyalty - loyaltyHitFromDefeat));
  }
}

async function recordCombatEvidence(
  attackerId: string,
  defenderId: string,
  reason: string,
  shipCaptured: boolean,
  zoneId: string,
  tick: number,
): Promise<void> {
  // Only pirates attacking merchants/navy generates evidence
  if (!reason.includes('pirate')) return;

  const attackerShip = await ShipQueries.getById(attackerId);
  if (!attackerShip?.captain_id) return;

  const pirateAgentId = attackerShip.captain_id;
  const { evidencePerWitness, evidencePerCapture } = NAVY_CONFIG.caseBuilding;

  // Defender is the witness
  const defenderShip = await ShipQueries.getById(defenderId);
  const witnessId = defenderShip?.captain_id ?? null;

  // Check for existing case
  const existingCases = await NavyCaseQueries.getByTarget(pirateAgentId);
  const openCase = existingCases.find(c => c.status === 'open' || c.status === 'warrant_issued');

  const evidenceGain = shipCaptured ? evidencePerCapture : evidencePerWitness;

  if (openCase) {
    const newEvidence = Math.min(100, openCase.evidence_level + evidenceGain);
    await NavyCaseQueries.updateEvidence(openCase.id, newEvidence, tick);

    // Add witness
    if (witnessId) {
      const witnesses: string[] = JSON.parse(openCase.witnesses || '[]');
      if (!witnesses.includes(witnessId)) {
        witnesses.push(witnessId);
        await NavyCaseQueries.addWitness(openCase.id, JSON.stringify(witnesses), tick);
      }
    }
  } else {
    // Find a navy agent anywhere to be the investigator
    const navyAgents = await AgentQueries.getByType('naval_officer');
    const investigator = navyAgents[0];
    if (!investigator) return; // no navy in the world

    await NavyCaseQueries.insert({
      id: uuidv4(),
      target_agent_id: pirateAgentId,
      investigating_agent_id: investigator.id,
      evidence_level: evidenceGain,
      charges: JSON.stringify(['piracy']),
      witnesses: witnessId ? JSON.stringify([witnessId]) : '[]',
      status: 'open',
      opened_tick: tick,
      last_updated_tick: tick,
    });
  }
}

async function recordCombatReputation(
  attackerId: string,
  defenderId: string,
  reason: string,
  winnerId: string,
  shipCaptured: boolean,
  zoneId: string,
  tick: number,
): Promise<void> {
  const attackerShip = await ShipQueries.getById(attackerId);
  const defenderShip = await ShipQueries.getById(defenderId);
  const attackerCaptainId = attackerShip?.captain_id;
  const defenderCaptainId = defenderShip?.captain_id;

  if (reason.includes('pirate attacks merchant')) {
    // Pirate attacking merchant: infamy up, honor down
    if (attackerCaptainId) {
      await recordReputationEvent(attackerCaptainId, zoneId, 'merchant_attack', tick);
    }
  }

  if (reason.includes('navy engages pirate')) {
    // Navy victory over pirate
    if (winnerId === attackerId && attackerCaptainId) {
      await recordReputationEvent(attackerCaptainId, zoneId, 'navy_victory', tick);
    }
  }

  // Ship capture is a big deal
  if (shipCaptured && winnerId === attackerId && attackerCaptainId) {
    // Winner's reputation/infamy increases significantly
    await recordReputationEvent(attackerCaptainId, zoneId, 'merchant_attack', tick);
  }
}

async function handleShipLoss(lostShipId: string): Promise<void> {
  const ship = await ShipQueries.getById(lostShipId);
  if (!ship || !ship.captain_id) return;

  // Captain loses their ship — mark as imprisoned or fled
  await AgentQueries.updateStatus(ship.captain_id, 'imprisoned');
}

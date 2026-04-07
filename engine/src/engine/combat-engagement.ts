// Core state machine for turn-based ship combat engagements

import { ShipQueries, CargoQueries, EventQueries, AgentQueries } from '../db/queries.js';
import { SkillQueries } from '../db/queries.js';
import type { Ship } from '../db/models.js';
import type { SeaCondition } from '../runtime/types.js';
import { v4 as uuid } from 'uuid';
import { registerCombatPair } from './encounters.js';
import { recordReputationEvent, type ReputationEvent } from './reputation.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CombatEngagement {
  id: string;
  attackerShipId: string;
  defenderShipId: string;
  attackerCaptainId: string;
  defenderCaptainId: string;
  zoneId: string;
  phase: 'closing' | 'broadside' | 'boarding' | 'chase' | 'resolved';
  round: number;
  startTick: number;
  attackerAction: string | null;
  defenderAction: string | null;
  attackerHullDmg: number;
  defenderHullDmg: number;
  attackerSailDmg: number;
  defenderSailDmg: number;
  attackerCrewLost: number;
  defenderCrewLost: number;
  chaseGap: number;      // 0=caught, 100=escaped
  chaseTicks: number;
  fleerId: string | null; // who is fleeing in chase phase
  log: string[];          // battle narrative log
}

// ---------------------------------------------------------------------------
// In-memory registry
// ---------------------------------------------------------------------------

const activeEngagements = new Map<string, CombatEngagement>();

export function getActiveEngagements(): CombatEngagement[] {
  return [...activeEngagements.values()].filter(e => e.phase !== 'resolved');
}

export function getEngagementForAgent(captainId: string): CombatEngagement | null {
  for (const e of activeEngagements.values()) {
    if (e.phase === 'resolved') continue;
    if (e.attackerCaptainId === captainId || e.defenderCaptainId === captainId) return e;
  }
  return null;
}

export function clearResolvedEngagements(): void {
  for (const [id, e] of activeEngagements) {
    if (e.phase === 'resolved') activeEngagements.delete(id);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSkillLevel(skills: { domain: string; sub_skill: string; level: number }[], domain: string, subSkill?: string): number {
  const match = skills.find(s =>
    s.domain === domain && (subSkill === undefined || s.sub_skill === subSkill),
  );
  return match?.level ?? 0;
}

function weatherModForGunnery(sea: SeaCondition | undefined): number {
  if (!sea) return 1.0;
  if (sea.waveHeight > 3) return 0.5;   // storm
  if (sea.waveHeight > 1.5) return 0.8; // high seas
  return 1.0;
}

function weatherModForChase(sea: SeaCondition | undefined): { speedMod: number; fogBonus: boolean; calm: boolean } {
  if (!sea) return { speedMod: 1.0, fogBonus: false, calm: false };
  const fog = sea.visibility < 0.3;
  const storm = sea.waveHeight > 3;
  const calm = sea.waveHeight < 0.2 && sea.currentSpeed < 0.3;
  let speedMod = 1.0;
  if (storm) speedMod = 0.6;
  else if (fog) speedMod = 0.8;
  else if (calm) speedMod = 0.7;
  return { speedMod, fogBonus: fog, calm };
}

function rand(): number {
  return Math.random();
}

// ---------------------------------------------------------------------------
// startEngagement
// ---------------------------------------------------------------------------

export async function startEngagement(
  attackerShipId: string,
  defenderShipId: string,
  zoneId: string,
  tick: number,
): Promise<CombatEngagement | null> {
  const attackerShip = await ShipQueries.getById(attackerShipId);
  const defenderShip = await ShipQueries.getById(defenderShipId);

  if (!attackerShip || !defenderShip) return null;
  if (!attackerShip.captain_id || !defenderShip.captain_id) return null;

  // Check neither captain is already engaged
  if (getEngagementForAgent(attackerShip.captain_id)) return null;
  if (getEngagementForAgent(defenderShip.captain_id)) return null;

  const engagement: CombatEngagement = {
    id: uuid(),
    attackerShipId,
    defenderShipId,
    attackerCaptainId: attackerShip.captain_id,
    defenderCaptainId: defenderShip.captain_id,
    zoneId,
    phase: 'closing',
    round: 0,
    startTick: tick,
    attackerAction: null,
    defenderAction: null,
    attackerHullDmg: 0,
    defenderHullDmg: 0,
    attackerSailDmg: 0,
    defenderSailDmg: 0,
    attackerCrewLost: 0,
    defenderCrewLost: 0,
    chaseGap: 0,
    chaseTicks: 0,
    fleerId: null,
    log: [],
  };

  activeEngagements.set(engagement.id, engagement);
  return engagement;
}

// ---------------------------------------------------------------------------
// resolveRound — the core state machine step
// ---------------------------------------------------------------------------

export async function resolveRound(
  engagement: CombatEngagement,
  attackerAction: string,
  defenderAction: string,
  seaCondition: SeaCondition | undefined,
  tick: number,
): Promise<void> {
  engagement.attackerAction = attackerAction;
  engagement.defenderAction = defenderAction;
  engagement.round++;

  // Global round cap — prevent infinite broadside↔chase loops
  const MAX_COMBAT_ROUNDS = 20;
  if (engagement.round >= MAX_COMBAT_ROUNDS) {
    engagement.log.push('After hours of inconclusive battle, both ships disengage.');
    engagement.phase = 'resolved';
    return;
  }

  switch (engagement.phase) {
    case 'closing':
      await resolveClosing(engagement);
      break;
    case 'broadside':
      await resolveBroadside(engagement, attackerAction, defenderAction, seaCondition);
      break;
    case 'boarding':
      await resolveBoarding(engagement, attackerAction, defenderAction);
      break;
    case 'chase':
      await resolveChase(engagement, attackerAction, defenderAction, seaCondition);
      break;
    case 'resolved':
      // Nothing to do
      break;
  }

  // If phase just became resolved, apply to DB
  if (engagement.phase === 'resolved') {
    await resolveEngagement(engagement, tick);
  }
}

// ---------------------------------------------------------------------------
// Phase: closing
// ---------------------------------------------------------------------------

async function resolveClosing(engagement: CombatEngagement): Promise<void> {
  engagement.log.push('The ships close to engagement range.');
  engagement.phase = 'broadside';
}

// ---------------------------------------------------------------------------
// Phase: broadside
// ---------------------------------------------------------------------------

async function resolveBroadside(
  engagement: CombatEngagement,
  attackerAction: string,
  defenderAction: string,
  seaCondition: SeaCondition | undefined,
): Promise<void> {
  const attackerShip = await ShipQueries.getById(engagement.attackerShipId);
  const defenderShip = await ShipQueries.getById(engagement.defenderShipId);
  if (!attackerShip || !defenderShip) {
    engagement.phase = 'resolved';
    engagement.log.push('A ship has been lost — engagement ends.');
    return;
  }

  const attackerSkills = await SkillQueries.getByAgent(engagement.attackerCaptainId);
  const defenderSkills = await SkillQueries.getByAgent(engagement.defenderCaptainId);

  const weatherMod = weatherModForGunnery(seaCondition);

  // ---------- Compute firepower ----------

  const computeFirepower = (ship: Ship, skills: typeof attackerSkills, accHullDmg: number) => {
    const effectiveHull = Math.max(0, ship.hull - accHullDmg);
    const powderFactor = ship.powder_stores > 0 ? 1.0 : 0.2;
    const gunneryLevel = getSkillLevel(skills, 'gunnery');
    const tacticsLevel = getSkillLevel(skills, 'tactics');
    const gunneryMod = 0.5 + gunneryLevel * 0.15;
    const tacticsMod = 0.5 + tacticsLevel * 0.15;
    const basePower = ship.guns * (effectiveHull / 100) * powderFactor;
    return basePower * gunneryMod * tacticsMod * weatherMod;
  };

  const attackerFP = computeFirepower(attackerShip, attackerSkills, engagement.attackerHullDmg);
  const defenderFP = computeFirepower(defenderShip, defenderSkills, engagement.defenderHullDmg);

  // ---------- Handle surrender ----------

  if (attackerAction === 'surrender') {
    engagement.log.push(`Round ${engagement.round}: ${attackerShip.name} strikes her colours and surrenders!`);
    engagement.phase = 'resolved';
    return;
  }
  if (defenderAction === 'surrender') {
    engagement.log.push(`Round ${engagement.round}: ${defenderShip.name} strikes her colours and surrenders!`);
    engagement.phase = 'resolved';
    return;
  }

  // ---------- Handle disengage → chase ----------

  if (attackerAction === 'disengage') {
    engagement.log.push(`Round ${engagement.round}: ${attackerShip.name} attempts to break off!`);
    engagement.phase = 'chase';
    engagement.fleerId = engagement.attackerCaptainId;
    engagement.chaseGap = 30;
    engagement.chaseTicks = 0;
    return;
  }
  if (defenderAction === 'disengage') {
    engagement.log.push(`Round ${engagement.round}: ${defenderShip.name} attempts to break off!`);
    engagement.phase = 'chase';
    engagement.fleerId = engagement.defenderCaptainId;
    engagement.chaseGap = 30;
    engagement.chaseTicks = 0;
    return;
  }

  // ---------- Handle boarding transition ----------

  const attackerWantsBoard = attackerAction === 'close_for_boarding';
  const defenderWantsBoard = defenderAction === 'close_for_boarding';
  const boardingNext =
    (attackerWantsBoard && defenderWantsBoard) ||
    (attackerWantsBoard && defenderAction !== 'disengage') ||
    (defenderWantsBoard && attackerAction !== 'disengage');

  // ---------- Apply damage from each side ----------

  const applyAction = (
    action: string,
    firepower: number,
    firerName: string,
    targetName: string,
    side: 'attacker' | 'defender',
  ) => {
    // side = who is RECEIVING the damage (the target)
    let hullDmg = 0;
    let sailDmg = 0;
    let crewKill = 0;
    let narrative = '';

    switch (action) {
      case 'fire_broadside': {
        hullDmg = firepower * (0.5 + rand() * 0.5);
        crewKill = Math.floor(hullDmg * 0.1 * rand());
        narrative = `${firerName} fires a broadside into ${targetName}.`;
        break;
      }
      case 'fire_chain_shot': {
        hullDmg = firepower * 0.3;
        sailDmg = firepower * 0.6;
        crewKill = Math.floor(hullDmg * 0.05 * rand());
        narrative = `${firerName} fires chain shot at ${targetName}'s rigging.`;
        break;
      }
      case 'fire_grape_shot': {
        hullDmg = firepower * 0.2;
        crewKill = Math.floor(firepower * 0.15);
        narrative = `${firerName} fires grapeshot, sweeping ${targetName}'s decks.`;
        break;
      }
      case 'hold_fire': {
        narrative = `${firerName} holds fire.`;
        break;
      }
      case 'close_for_boarding': {
        narrative = `${firerName} closes for boarding.`;
        break;
      }
      default: {
        narrative = `${firerName} holds position.`;
        break;
      }
    }

    // Apply damage to the TARGET side's accumulators
    if (side === 'attacker') {
      // Target is attacker → attacker takes damage
      engagement.attackerHullDmg += hullDmg;
      engagement.attackerSailDmg += sailDmg;
      engagement.attackerCrewLost += crewKill;
    } else {
      // Target is defender → defender takes damage
      engagement.defenderHullDmg += hullDmg;
      engagement.defenderSailDmg += sailDmg;
      engagement.defenderCrewLost += crewKill;
    }

    return narrative;
  };

  // Attacker fires → defender takes damage
  const atkNarr = applyAction(attackerAction, attackerFP, attackerShip.name, defenderShip.name, 'defender');
  // Defender fires → attacker takes damage
  const defNarr = applyAction(defenderAction, defenderFP, defenderShip.name, attackerShip.name, 'attacker');

  engagement.log.push(`Round ${engagement.round}: ${atkNarr} ${defNarr}`);

  // ---------- Check sinking / auto-surrender ----------

  const attackerEffectiveHull = attackerShip.hull - engagement.attackerHullDmg;
  const defenderEffectiveHull = defenderShip.hull - engagement.defenderHullDmg;

  if (attackerEffectiveHull <= 0) {
    engagement.log.push(`${attackerShip.name} is sunk!`);
    engagement.phase = 'resolved';
    return;
  }
  if (defenderEffectiveHull <= 0) {
    engagement.log.push(`${defenderShip.name} is sunk!`);
    engagement.phase = 'resolved';
    return;
  }
  // Auto-surrender only at hull <= 5 (was 15 — too aggressive, prevented escape)
  if (attackerEffectiveHull <= 5) {
    engagement.log.push(`${attackerShip.name} is critically damaged and surrenders!`);
    engagement.attackerAction = 'surrender';
    engagement.phase = 'resolved';
    return;
  }
  if (defenderEffectiveHull <= 5) {
    engagement.log.push(`${defenderShip.name} is critically damaged and surrenders!`);
    engagement.defenderAction = 'surrender';
    engagement.phase = 'resolved';
    return;
  }
  // Auto-disengage attempt when hull drops below 25 (gives escape mechanic a chance)
  if (defenderEffectiveHull <= 25 && defenderAction !== 'disengage' && defenderAction !== 'surrender') {
    engagement.log.push(`${defenderShip.name} is badly damaged and attempts to break off!`);
    engagement.phase = 'chase';
    engagement.fleerId = engagement.defenderCaptainId;
    engagement.chaseGap = 30;
    engagement.chaseTicks = 0;
    return;
  }
  if (attackerEffectiveHull <= 25 && attackerAction !== 'disengage' && attackerAction !== 'surrender') {
    engagement.log.push(`${attackerShip.name} is badly damaged and attempts to break off!`);
    engagement.phase = 'chase';
    engagement.fleerId = engagement.attackerCaptainId;
    engagement.chaseGap = 30;
    engagement.chaseTicks = 0;
    return;
  }

  // ---------- Phase transitions ----------

  if (boardingNext) {
    engagement.log.push('The ships crash together — boarding action!');
    engagement.phase = 'boarding';
    return;
  }

  // Max 5 broadside rounds then forced boarding
  if (engagement.round >= 5) {
    engagement.log.push('After prolonged gunnery, the ships close to board.');
    engagement.phase = 'boarding';
  }
}

// ---------------------------------------------------------------------------
// Phase: boarding
// ---------------------------------------------------------------------------

async function resolveBoarding(
  engagement: CombatEngagement,
  attackerAction: string,
  defenderAction: string,
): Promise<void> {
  const attackerShip = await ShipQueries.getById(engagement.attackerShipId);
  const defenderShip = await ShipQueries.getById(engagement.defenderShipId);
  if (!attackerShip || !defenderShip) {
    engagement.phase = 'resolved';
    engagement.log.push('A ship has been lost — engagement ends.');
    return;
  }

  // ---------- Handle surrender ----------

  if (attackerAction === 'surrender') {
    engagement.log.push(`${attackerShip.name} surrenders during boarding!`);
    engagement.phase = 'resolved';
    return;
  }
  if (defenderAction === 'surrender') {
    engagement.log.push(`${defenderShip.name} surrenders during boarding!`);
    engagement.phase = 'resolved';
    return;
  }

  // ---------- Handle disengage → chase ----------

  if (attackerAction === 'disengage') {
    engagement.log.push(`${attackerShip.name} cuts grapples and attempts to flee!`);
    engagement.phase = 'chase';
    engagement.fleerId = engagement.attackerCaptainId;
    engagement.chaseGap = 30;
    engagement.chaseTicks = 0;
    return;
  }
  if (defenderAction === 'disengage') {
    engagement.log.push(`${defenderShip.name} cuts grapples and attempts to flee!`);
    engagement.phase = 'chase';
    engagement.fleerId = engagement.defenderCaptainId;
    engagement.chaseGap = 30;
    engagement.chaseTicks = 0;
    return;
  }

  // ---------- Compute boarding strength ----------

  const attackerSkills = await SkillQueries.getByAgent(engagement.attackerCaptainId);
  const defenderSkills = await SkillQueries.getByAgent(engagement.defenderCaptainId);

  const attackerCrewRemaining = Math.max(0, attackerShip.crew_count - engagement.attackerCrewLost);
  const defenderCrewRemaining = Math.max(0, defenderShip.crew_count - engagement.defenderCrewLost);

  const computeBoardingStrength = (
    crewRemaining: number,
    skills: typeof attackerSkills,
    action: string,
  ): number => {
    const swordplayLevel = getSkillLevel(skills, 'swordplay');
    const leadershipLevel = getSkillLevel(skills, 'leadership');
    let strength = crewRemaining * (0.5 + swordplayLevel * 0.15) * (0.5 + leadershipLevel * 0.1);
    if (action === 'repel_boarders') {
      strength *= 1.3; // defensive advantage
    }
    return strength;
  };

  const attackerStrength = computeBoardingStrength(attackerCrewRemaining, attackerSkills, attackerAction);
  const defenderStrength = computeBoardingStrength(defenderCrewRemaining, defenderSkills, defenderAction);

  // ---------- Resolve boarding ----------

  const ratio = defenderStrength > 0 ? attackerStrength / defenderStrength : 999;

  if (attackerAction === 'board' && defenderAction === 'board') {
    // Both board: ratio determines outcome
    if (ratio >= 1.5) {
      // Attacker captures
      const defCas = Math.floor(defenderCrewRemaining * 0.2);
      const atkCas = Math.floor(attackerCrewRemaining * 0.05);
      engagement.defenderCrewLost += defCas;
      engagement.attackerCrewLost += atkCas;
      engagement.defenderAction = 'surrender';
      engagement.log.push(`${attackerShip.name}'s crew overwhelms ${defenderShip.name} — she is captured!`);
      engagement.phase = 'resolved';
    } else if (ratio <= 0.67) {
      // Defender repels / captures
      const atkCas = Math.floor(attackerCrewRemaining * 0.2);
      const defCas = Math.floor(defenderCrewRemaining * 0.05);
      engagement.attackerCrewLost += atkCas;
      engagement.defenderCrewLost += defCas;
      engagement.attackerAction = 'surrender';
      engagement.log.push(`${defenderShip.name}'s crew repels and overwhelms ${attackerShip.name} — she is captured!`);
      engagement.phase = 'resolved';
    } else {
      // Contested — another round
      const atkCas = Math.floor(attackerCrewRemaining * 0.08);
      const defCas = Math.floor(defenderCrewRemaining * 0.08);
      engagement.attackerCrewLost += atkCas;
      engagement.defenderCrewLost += defCas;
      engagement.log.push(`Fierce hand-to-hand fighting on deck — neither side gains the upper hand.`);
    }
  } else if (
    (attackerAction === 'board' && defenderAction === 'repel_boarders') ||
    (attackerAction === 'repel_boarders' && defenderAction === 'board')
  ) {
    // One boards, other repels
    const boarderIsAttacker = attackerAction === 'board';
    const boarderCrewRemaining = boarderIsAttacker ? attackerCrewRemaining : defenderCrewRemaining;
    const repellerCrewRemaining = boarderIsAttacker ? defenderCrewRemaining : attackerCrewRemaining;
    const effectiveRatio = boarderIsAttacker ? ratio : (defenderStrength > 0 ? 1 / ratio : 0);

    if (effectiveRatio >= 2.0) {
      // Boarder overwhelms despite defense
      const repellerCas = Math.floor(repellerCrewRemaining * 0.15);
      const boarderCas = Math.floor(boarderCrewRemaining * 0.1);
      if (boarderIsAttacker) {
        engagement.defenderCrewLost += repellerCas;
        engagement.attackerCrewLost += boarderCas;
        engagement.defenderAction = 'surrender';
        engagement.log.push(`${attackerShip.name} boards and captures ${defenderShip.name} despite fierce resistance!`);
      } else {
        engagement.attackerCrewLost += repellerCas;
        engagement.defenderCrewLost += boarderCas;
        engagement.attackerAction = 'surrender';
        engagement.log.push(`${defenderShip.name} counter-boards and captures ${attackerShip.name}!`);
      }
      engagement.phase = 'resolved';
    } else {
      // Boarding repelled
      const boarderCas = Math.floor(boarderCrewRemaining * 0.15);
      const repellerCas = Math.floor(repellerCrewRemaining * 0.05);
      if (boarderIsAttacker) {
        engagement.attackerCrewLost += boarderCas;
        engagement.defenderCrewLost += repellerCas;
        engagement.log.push(`${defenderShip.name} repels ${attackerShip.name}'s boarders with heavy losses.`);
      } else {
        engagement.defenderCrewLost += boarderCas;
        engagement.attackerCrewLost += repellerCas;
        engagement.log.push(`${attackerShip.name} repels ${defenderShip.name}'s boarders with heavy losses.`);
      }
    }
  } else if (attackerAction === 'repel_boarders' && defenderAction === 'repel_boarders') {
    // Both repel — stalemate, nobody actually boards
    engagement.log.push('Both sides brace for boarding but neither commits — a tense standoff.');
  } else {
    // Fallback: treat unknowns as board
    engagement.log.push('The melee continues on deck.');
  }

  // Max boarding rounds: 3. After 3, whoever has more crew wins.
  const boardingRoundsInPhase = engagement.round - getBroadsideRounds(engagement);
  if (engagement.phase !== 'resolved' && boardingRoundsInPhase >= 3) {
    const atkCrew = Math.max(0, attackerShip.crew_count - engagement.attackerCrewLost);
    const defCrew = Math.max(0, defenderShip.crew_count - engagement.defenderCrewLost);
    if (atkCrew >= defCrew) {
      engagement.defenderAction = 'surrender';
      engagement.log.push(`After prolonged fighting, ${defenderShip.name} is subdued.`);
    } else {
      engagement.attackerAction = 'surrender';
      engagement.log.push(`After prolonged fighting, ${attackerShip.name} is subdued.`);
    }
    engagement.phase = 'resolved';
  }
}

/** Estimate how many rounds were spent in broadside (for boarding round counting). */
function getBroadsideRounds(engagement: CombatEngagement): number {
  // Round 1 = closing, rounds 2..N before boarding = broadside rounds
  // We track total rounds, so boarding started after closing(1) + broadside(up to 5)
  // Simpler: count log entries that mention "Round" before boarding narrative
  let broadsideCount = 0;
  for (const entry of engagement.log) {
    if (entry.includes('boarding action') || entry.includes('close to board')) break;
    if (entry.startsWith('Round ')) broadsideCount++;
  }
  return broadsideCount + 1; // +1 for the closing round
}

// ---------------------------------------------------------------------------
// Phase: chase
// ---------------------------------------------------------------------------

async function resolveChase(
  engagement: CombatEngagement,
  attackerAction: string,
  defenderAction: string,
  seaCondition: SeaCondition | undefined,
): Promise<void> {
  const attackerShip = await ShipQueries.getById(engagement.attackerShipId);
  const defenderShip = await ShipQueries.getById(engagement.defenderShipId);
  if (!attackerShip || !defenderShip) {
    engagement.phase = 'resolved';
    engagement.log.push('A ship has been lost — engagement ends.');
    return;
  }

  const { speedMod: weatherSpeedMod, fogBonus } = weatherModForChase(seaCondition);

  // Determine who is fleeing and who is pursuing
  const fleeingIsAttacker = engagement.fleerId === engagement.attackerCaptainId;
  const fleeShip = fleeingIsAttacker ? attackerShip : defenderShip;
  const pursueShip = fleeingIsAttacker ? defenderShip : attackerShip;
  const fleeAction = fleeingIsAttacker ? attackerAction : defenderAction;
  const pursueAction = fleeingIsAttacker ? defenderAction : attackerAction;
  const fleeSailDmg = fleeingIsAttacker ? engagement.attackerSailDmg : engagement.defenderSailDmg;
  const pursueSailDmg = fleeingIsAttacker ? engagement.defenderSailDmg : engagement.attackerSailDmg;
  const fleeCrewLost = fleeingIsAttacker ? engagement.attackerCrewLost : engagement.defenderCrewLost;
  const pursueCrewLost = fleeingIsAttacker ? engagement.defenderCrewLost : engagement.attackerCrewLost;

  // ---------- Effective speed ----------

  const computeEffectiveSpeed = (
    ship: Ship,
    sailDmg: number,
    crewLost: number,
    maneuverBonus: number,
  ): number => {
    const sailCondition = Math.max(0, ship.sails - sailDmg);
    const crewRemaining = Math.max(1, ship.crew_count - crewLost);
    // crew_capacity serves as a reasonable proxy for crew minimum needed
    const crewMin = Math.max(1, Math.floor(ship.crew_capacity * 0.25));
    const crewFactor = Math.min(1, crewRemaining / crewMin);
    return ship.speed_base * (sailCondition / 100) * crewFactor * weatherSpeedMod + ship.maneuverability * maneuverBonus;
  };

  const fleeSpeed = computeEffectiveSpeed(fleeShip, fleeSailDmg, fleeCrewLost, 0.5);
  const pursueSpeed = computeEffectiveSpeed(pursueShip, pursueSailDmg, pursueCrewLost, 0.3);

  // ---------- Handle pursuer break_off ----------

  if (pursueAction === 'break_off') {
    engagement.log.push(`${pursueShip.name} breaks off the chase — ${fleeShip.name} escapes.`);
    engagement.phase = 'resolved';
    return;
  }

  // ---------- Handle flee actions ----------

  let gapDelta = 0;

  if (fleeAction === 'flee' || fleeAction === 'pursue') {
    // Standard flee
    gapDelta = (fleeSpeed - pursueSpeed) * 5 + rand() * 10;
  } else if (fleeAction === 'dump_cargo') {
    // Dump all cargo for speed bonus
    const cargos = await CargoQueries.getByShip(fleeShip.id);
    for (const c of cargos) {
      await CargoQueries.remove(c.id);
    }
    gapDelta = (fleeSpeed - pursueSpeed) * 5 + rand() * 10 + 15;
    engagement.log.push(`${fleeShip.name} dumps cargo overboard!`);
  } else if (fleeAction === 'break_off') {
    // Fleeing side gives up fleeing? Treat as surrender to pursuit
    engagement.log.push(`${fleeShip.name} heaves to and surrenders.`);
    if (fleeingIsAttacker) {
      engagement.attackerAction = 'surrender';
    } else {
      engagement.defenderAction = 'surrender';
    }
    engagement.phase = 'resolved';
    return;
  }

  // Pursuer always closes some
  if (pursueAction === 'pursue' || pursueAction === 'flee') {
    const pursuerClose = (pursueSpeed - fleeSpeed) * 5 + rand() * 10;
    if (pursuerClose > 0) {
      gapDelta -= pursuerClose * 0.3; // pursuer effort partially counters
    }
  }

  // Fog bonus
  if (fogBonus) {
    gapDelta += 20;
    engagement.log.push('Fog rolls in, aiding the escape.');
  }

  engagement.chaseGap = Math.max(0, Math.min(100, engagement.chaseGap + gapDelta));
  engagement.chaseTicks++;

  engagement.log.push(`Chase: gap is now ${Math.round(engagement.chaseGap)}. ${fleeShip.name} ${engagement.chaseGap > 50 ? 'pulling away' : 'struggling to escape'}.`);

  // ---------- Check chase resolution ----------

  if (engagement.chaseGap >= 100) {
    engagement.log.push(`${fleeShip.name} escapes into the horizon!`);
    engagement.phase = 'resolved';
    return;
  }
  if (engagement.chaseGap <= 0) {
    engagement.log.push(`${pursueShip.name} catches ${fleeShip.name}! Battle resumes.`);
    engagement.phase = 'broadside';
    engagement.fleerId = null;
    engagement.chaseTicks = 0;
    return;
  }
  if (engagement.chaseTicks >= 6) {
    engagement.log.push(`After hours of pursuit, ${fleeShip.name} slips away.`);
    engagement.phase = 'resolved';
  }
}

// ---------------------------------------------------------------------------
// resolveEngagement — apply accumulated damage to DB
// ---------------------------------------------------------------------------

// Track which engagements have already been resolved to prevent double event writes
const resolvedEngagementIds = new Set<string>();

export async function resolveEngagement(
  engagement: CombatEngagement,
  tick: number,
): Promise<void> {
  // Guard: prevent double resolution (can happen if phase resolvers and resolveRound both trigger)
  if (resolvedEngagementIds.has(engagement.id)) return;
  resolvedEngagementIds.add(engagement.id);
  // Keep set from growing unbounded — prune entries older than 100
  if (resolvedEngagementIds.size > 200) {
    const entries = [...resolvedEngagementIds];
    for (let i = 0; i < 100; i++) resolvedEngagementIds.delete(entries[i]!);
  }

  const attackerShip = await ShipQueries.getById(engagement.attackerShipId);
  const defenderShip = await ShipQueries.getById(engagement.defenderShipId);
  if (!attackerShip || !defenderShip) return;

  // ---------- Determine outcome ----------

  const attackerSurrendered = engagement.attackerAction === 'surrender';
  const defenderSurrendered = engagement.defenderAction === 'surrender';
  const attackerSunk = (attackerShip.hull - engagement.attackerHullDmg) <= 0;
  const defenderSunk = (defenderShip.hull - engagement.defenderHullDmg) <= 0;

  // ---------- Apply hull and sail damage ----------

  const applyDamage = async (ship: Ship, hullDmg: number, sailDmg: number) => {
    const newHull = Math.max(0, Math.round(ship.hull - hullDmg));
    const newSails = Math.max(0, Math.round(ship.sails - sailDmg));
    await ShipQueries.updateCondition(ship.id, newHull, newSails, ship.barnacle_level, ship.rot_level);
  };

  await applyDamage(attackerShip, engagement.attackerHullDmg, engagement.attackerSailDmg);
  await applyDamage(defenderShip, engagement.defenderHullDmg, engagement.defenderSailDmg);

  // ---------- Apply crew losses ----------

  const newAttackerCrew = Math.max(0, attackerShip.crew_count - engagement.attackerCrewLost);
  const newDefenderCrew = Math.max(0, defenderShip.crew_count - engagement.defenderCrewLost);
  await ShipQueries.updateCrewCount(engagement.attackerShipId, newAttackerCrew);
  await ShipQueries.updateCrewCount(engagement.defenderShipId, newDefenderCrew);

  // ---------- Apply powder consumption ----------
  // Each broadside round = -10 powder per ship that fired

  const countFiringRounds = (shipRole: 'attacker' | 'defender'): number => {
    // Count rounds where this side actually fired (not hold_fire / close_for_boarding)
    // We approximate: each broadside round the side fired unless they held fire
    // Since we don't store per-round action history, estimate from log
    // Conservative estimate: each broadside round consumed powder
    let rounds = 0;
    for (const entry of engagement.log) {
      if (entry.startsWith('Round ')) {
        // Check if this side's ship name appears with a firing action
        const shipName = shipRole === 'attacker' ? attackerShip.name : defenderShip.name;
        if (entry.includes(shipName) && (entry.includes('fires') || entry.includes('grapeshot'))) {
          rounds++;
        }
      }
    }
    return rounds;
  };

  const attackerPowderUsed = countFiringRounds('attacker') * 10;
  const defenderPowderUsed = countFiringRounds('defender') * 10;

  const newAttackerPowder = Math.max(0, attackerShip.powder_stores - attackerPowderUsed);
  const newDefenderPowder = Math.max(0, defenderShip.powder_stores - defenderPowderUsed);
  await ShipQueries.updateStores(engagement.attackerShipId, attackerShip.food_stores, attackerShip.water_stores, newAttackerPowder);
  await ShipQueries.updateStores(engagement.defenderShipId, defenderShip.food_stores, defenderShip.water_stores, newDefenderPowder);

  // ---------- Combat wounds for captains ----------
  // Boarding combat and broadside splinters wound captains. 30% chance per long engagement.
  // This feeds into the disease/wound death system (severity accumulates → death at 25-30).
  const { execute: woundExec } = await import('../db/sqlite.js');
  const { v4: woundUuid } = await import('uuid');
  const WOUND_TYPES: Array<'cut' | 'gunshot' | 'burn'> = ['cut', 'gunshot', 'burn'];
  for (const captainId of [engagement.attackerCaptainId, engagement.defenderCaptainId]) {
    if (!captainId) continue;
    const woundChance = engagement.round >= 3 ? 0.30 : 0.10;
    if (Math.random() < woundChance) {
      const wType = WOUND_TYPES[Math.floor(Math.random() * WOUND_TYPES.length)]!;
      const severity = 3 + Math.floor(Math.random() * 6); // 3-8
      try {
        await woundExec(
          `INSERT INTO wounds (id, agent_id, type, severity, location, treated, healing_progress, created_tick)
           VALUES (?, ?, ?, ?, ?, 0, 0, ?)`,
          [woundUuid(), captainId, wType, severity, 'torso', tick]
        );
      } catch { /* ok */ }
    }
  }

  // ---------- Register combat pair cooldown ----------
  // Prevents these two ships from re-engaging for 48 ticks
  registerCombatPair(engagement.attackerShipId, engagement.defenderShipId, tick);

  // ---------- Handle sunk ships ----------

  if (attackerSunk) {
    await ShipQueries.updateStatusFull(engagement.attackerShipId, 'sunk', null, null);
    await ShipQueries.updateCrewCount(engagement.attackerShipId, 0);
    // Historical: ~15% of captains went down with the ship or died from wounds in the water.
    const atkAgent = await AgentQueries.getById(engagement.attackerCaptainId);
    if (atkAgent && atkAgent.status !== 'dead') {
      if (Math.random() < 0.15) {
        await AgentQueries.updateStatus(engagement.attackerCaptainId, 'dead');
      } else {
        const nearestPort = atkAgent.port_id || engagement.zoneId || 'port_royal';
        await AgentQueries.updateStatus(engagement.attackerCaptainId, 'imprisoned');
        await AgentQueries.updateLocation(engagement.attackerCaptainId, nearestPort, engagement.zoneId);
      }
    }
  }
  if (defenderSunk) {
    await ShipQueries.updateStatusFull(engagement.defenderShipId, 'sunk', null, null);
    await ShipQueries.updateCrewCount(engagement.defenderShipId, 0);
    const defAgent = await AgentQueries.getById(engagement.defenderCaptainId);
    if (defAgent && defAgent.status !== 'dead') {
      if (Math.random() < 0.15) {
        await AgentQueries.updateStatus(engagement.defenderCaptainId, 'dead');
      } else {
        const nearestPort = defAgent.port_id || engagement.zoneId || 'port_royal';
        await AgentQueries.updateStatus(engagement.defenderCaptainId, 'imprisoned');
        await AgentQueries.updateLocation(engagement.defenderCaptainId, nearestPort, engagement.zoneId);
      }
    }
  }

  // ---------- Handle captured ships ----------

  if (defenderSurrendered && !defenderSunk) {
    await ShipQueries.updateStatusFull(engagement.defenderShipId, 'captured', null, null);
    // Transfer cargo from defender to attacker — only when attacker is a pirate-type
    // Navy/merchants who win combat don't loot — they confiscate or just defend.
    // Cargo stranded on non-pirate winners can never be fenced (Run 41: 47% of seized
    // cargo stuck on merchants who couldn't sell it).
    const LOOT_TYPES = new Set(['pirate_captain', 'privateer_captain', 'pirate_hunter']);
    const attackerForHeat = await AgentQueries.getById(engagement.attackerCaptainId);
    const canLoot = attackerForHeat && LOOT_TYPES.has(attackerForHeat.type);
    if (canLoot) {
      const isPiracy = attackerForHeat && new Set(['pirate_captain', 'privateer_captain']).has(attackerForHeat.type);
      const defenderCargo = await CargoQueries.getByShip(engagement.defenderShipId);
      for (const c of defenderCargo) {
        if (c.quantity <= 0) continue;
        const heat = isPiracy ? Math.min(80, 30 + (c.heat || 0)) : (c.heat || 0);
        await CargoQueries.transferSeized(c.id, engagement.attackerShipId, engagement.attackerCaptainId, heat, engagement.defenderCaptainId);
      }
    }
    // Post-victory emergency repair — crew patches hull using prize timber
    // Historical: pirates always repaired immediately after taking a prize
    const postBattleHull = Math.max(0, attackerShip.hull - engagement.attackerHullDmg);
    const repairBonus = Math.min(15, Math.floor((100 - postBattleHull) * 0.3));
    if (repairBonus > 0) {
      const repairedHull = Math.min(attackerShip.hull, postBattleHull + repairBonus);
      await ShipQueries.updateCondition(engagement.attackerShipId, repairedHull, attackerShip.sails, attackerShip.barnacle_level, attackerShip.rot_level);
    }
    // Imprison defender captain (with port fallback for release later) — skip if already dead
    const defenderAgent = await AgentQueries.getById(engagement.defenderCaptainId);
    if (defenderAgent && defenderAgent.status !== 'dead') {
      const capPort = defenderAgent.port_id || attackerShip.port_id || 'port_royal';
      await AgentQueries.updateStatus(engagement.defenderCaptainId, 'imprisoned');
      await AgentQueries.updateLocation(engagement.defenderCaptainId, capPort, engagement.zoneId);
    }
  }

  if (attackerSurrendered && !attackerSunk) {
    await ShipQueries.updateStatusFull(engagement.attackerShipId, 'captured', null, null);
    // Transfer cargo from attacker to defender — only when defender is a pirate-type
    // Merchants who repel pirates don't loot the pirate's ship — they just escape.
    // Historical: merchant captains wanted to get away, not fight over cargo.
    const LOOT_TYPES2 = new Set(['pirate_captain', 'privateer_captain', 'pirate_hunter']);
    const defenderForHeat = await AgentQueries.getById(engagement.defenderCaptainId);
    const canDefenderLoot = defenderForHeat && LOOT_TYPES2.has(defenderForHeat.type);
    if (canDefenderLoot) {
      const isDefenderPirate = defenderForHeat && new Set(['pirate_captain', 'privateer_captain']).has(defenderForHeat.type);
      const attackerCargo = await CargoQueries.getByShip(engagement.attackerShipId);
      for (const c of attackerCargo) {
        if (c.quantity <= 0) continue;
        const heat = isDefenderPirate ? Math.min(80, 30 + (c.heat || 0)) : (c.heat || 0);
        await CargoQueries.transferSeized(c.id, engagement.defenderShipId, engagement.defenderCaptainId, heat, engagement.attackerCaptainId);
      }
    }
    // Imprison attacker captain — skip if already dead
    const attackerAgent = await AgentQueries.getById(engagement.attackerCaptainId);
    if (attackerAgent && attackerAgent.status !== 'dead') {
      const capPort = attackerAgent.port_id || defenderShip.port_id || 'port_royal';
      await AgentQueries.updateStatus(engagement.attackerCaptainId, 'imprisoned');
      await AgentQueries.updateLocation(engagement.attackerCaptainId, capPort, engagement.zoneId);
    }
  }

  // ---------- Determine winner ----------

  const winnerId = defenderSurrendered || defenderSunk
    ? engagement.attackerCaptainId
    : attackerSurrendered || attackerSunk
      ? engagement.defenderCaptainId
      : null;

  let description: string;
  if (attackerSunk) {
    description = `${attackerShip.name} was sunk in battle with ${defenderShip.name}.`;
  } else if (defenderSunk) {
    description = `${defenderShip.name} was sunk in battle with ${attackerShip.name}.`;
  } else if (defenderSurrendered) {
    description = `${defenderShip.name} was captured by ${attackerShip.name} after a sea battle.`;
  } else if (attackerSurrendered) {
    description = `${attackerShip.name} was captured by ${defenderShip.name} after a sea battle.`;
  } else {
    // Escape / chase ended
    description = `${attackerShip.name} and ${defenderShip.name} fought but disengaged.`;
  }

  await EventQueries.insert({
    id: uuid(),
    type: 'sea_battle',
    description,
    agent_ids: JSON.stringify([engagement.attackerCaptainId, engagement.defenderCaptainId]),
    ship_ids: JSON.stringify([engagement.attackerShipId, engagement.defenderShipId]),
    port_id: null,
    sea_zone_id: engagement.zoneId,
    severity: (attackerSunk || defenderSunk) ? 8 : (attackerSurrendered || defenderSurrendered) ? 6 : 4,
    tick,
    data: JSON.stringify({
      winnerId,
      rounds: engagement.round,
      attackerHullDmg: Math.round(engagement.attackerHullDmg),
      defenderHullDmg: Math.round(engagement.defenderHullDmg),
      attackerCrewLost: engagement.attackerCrewLost,
      defenderCrewLost: engagement.defenderCrewLost,
      log: engagement.log,
    }),
  });

  // ---------- Record reputation ----------

  try {
    if (winnerId) {
      const [attackerAgent, defenderAgent] = await Promise.all([
        AgentQueries.getById(engagement.attackerCaptainId),
        AgentQueries.getById(engagement.defenderCaptainId),
      ]);

      const PIRATE_SET = new Set(['pirate_captain', 'privateer_captain']);
      const NAVY_SET = new Set(['naval_officer', 'pirate_hunter']);
      const MERCHANT_SET = new Set(['merchant_captain']);

      const winnerAgent = winnerId === engagement.attackerCaptainId ? attackerAgent : defenderAgent;
      const loserAgent = winnerId === engagement.attackerCaptainId ? defenderAgent : attackerAgent;

      if (winnerAgent && NAVY_SET.has(winnerAgent.type) && loserAgent && PIRATE_SET.has(loserAgent.type)) {
        await recordReputationEvent(winnerAgent.id, engagement.zoneId, 'navy_victory', tick);
      } else if (winnerAgent && PIRATE_SET.has(winnerAgent.type) && loserAgent && MERCHANT_SET.has(loserAgent.type)) {
        await recordReputationEvent(winnerAgent.id, engagement.zoneId, 'merchant_attack', tick);
      } else if (winnerAgent && PIRATE_SET.has(winnerAgent.type) && loserAgent && NAVY_SET.has(loserAgent.type)) {
        await recordReputationEvent(winnerAgent.id, engagement.zoneId, 'navy_victory', tick);
      }
    }
  } catch { /* don't let reputation errors break combat resolution */ }

  // Mark resolved
  engagement.phase = 'resolved';
}

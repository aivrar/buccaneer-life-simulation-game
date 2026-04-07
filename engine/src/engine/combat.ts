/**
 * Ship-to-ship combat — escape, broadside, boarding, and result application.
 */

import { v4 as uuid } from 'uuid';
import { ShipQueries, CargoQueries, EventQueries, AgentQueries } from '../db/queries.js';
import type { Ship } from '../db/models.js';
import type { SeaCondition } from '../runtime/types.js';

export interface CombatResult {
  winner: string;
  loser: string;
  type: 'broadside' | 'boarding' | 'surrender' | 'escape';
  attackerDamage: number;
  defenderDamage: number;
  casualties: { attacker: number; defender: number };
  cargoSeized: boolean;
  shipCaptured: boolean;
}

export async function resolveCombat(
  attackerShipId: string,
  defenderShipId: string,
  seaCondition?: SeaCondition,
  tick?: number,
): Promise<CombatResult> {
  const [attacker, defender] = await Promise.all([
    ShipQueries.getById(attackerShipId),
    ShipQueries.getById(defenderShipId),
  ]);

  if (!attacker || !defender) {
    return emptyResult(attackerShipId, defenderShipId);
  }

  // Dead captain guard — don't let dead agents' ships fight
  if (attacker.captain_id) {
    const atkCaptain = await AgentQueries.getById(attacker.captain_id);
    if (atkCaptain && atkCaptain.status === 'dead') return emptyResult(attackerShipId, defenderShipId);
  }
  if (defender.captain_id) {
    const defCaptain = await AgentQueries.getById(defender.captain_id);
    if (defCaptain && defCaptain.status === 'dead') return emptyResult(attackerShipId, defenderShipId);
  }

  // 1. Escape check — defender tries to flee
  const escapeChance = calculateEscapeChance(attacker, defender, seaCondition);
  if (Math.random() < escapeChance) {
    // Minimal exchange of fire during escape
    const atkDmg = Math.floor(Math.random() * 5);
    const defDmg = Math.floor(Math.random() * 3);
    await applyShipDamage(attacker, atkDmg, 0);
    await applyShipDamage(defender, defDmg, 0);
    return {
      winner: defenderShipId,
      loser: attackerShipId,
      type: 'escape',
      attackerDamage: atkDmg,
      defenderDamage: defDmg,
      casualties: { attacker: 0, defender: 0 },
      cargoSeized: false,
      shipCaptured: false,
    };
  }

  // 1b. Pre-broadside surrender — intimidation + force calculation
  // Historical: ~90% of pirate-merchant encounters ended without a broadside.
  // The black flag convention: surrender = live, resist = everyone dies.
  // Pirates succeeded through crew superiority, reputation, and terror.
  const gunRatio = attacker.guns > 0 && defender.guns > 0 ? attacker.guns / defender.guns : 1;
  const crewRatio = attacker.crew_count > 0 && defender.crew_count > 0 ? attacker.crew_count / defender.crew_count : 1;

  // Infamy bonus: feared pirates get a virtual force multiplier
  let infamyBonus = 0;
  if (attacker.captain_id) {
    const attackerAgent = await AgentQueries.getById(attacker.captain_id);
    if (attackerAgent) {
      infamyBonus = (attackerAgent.infamy ?? 0) / 100; // 0.0 to 1.0
    }
  }
  const effectiveGunRatio = gunRatio * (1 + infamyBonus * 0.5);
  const effectiveCrewRatio = crewRatio * (1 + infamyBonus * 0.3);

  // Determine defender type — merchants surrender easily, navy fights to the end
  const defenderAgent = defender.captain_id
    ? await AgentQueries.getById(defender.captain_id) : null;
  const isDefenderNavy = defenderAgent &&
    (defenderAgent.type === 'naval_officer' || defenderAgent.type === 'pirate_hunter');
  const isDefenderMerchant = !defenderAgent || defenderAgent.type === 'merchant_captain';

  let surrenders = false;
  if (isDefenderNavy) {
    // Navy rarely surrenders — only overwhelming force
    surrenders = effectiveGunRatio >= 2.5 && effectiveCrewRatio >= 2.0;
  } else if (isDefenderMerchant) {
    // Merchants surrender to any credible threat
    // Historical: merchant crews had zero incentive to fight and die for the owner's cargo
    surrenders = effectiveGunRatio >= 1.2
      || effectiveCrewRatio >= 2.0
      || (infamyBonus >= 0.6 && effectiveGunRatio >= 0.8)
      || (effectiveGunRatio >= 1.0 && effectiveCrewRatio >= 1.5);
  } else {
    // Pirate-on-pirate or other — original thresholds
    surrenders = effectiveGunRatio >= 2.0
      || (effectiveGunRatio >= 1.5 && effectiveCrewRatio >= 1.5);
  }

  if (surrenders) {
    await ShipQueries.updateStatusFull(defenderShipId, 'captured', defender.port_id, null);
    await transferSeizedCargo(attacker, defender);
    return {
      winner: attackerShipId,
      loser: defenderShipId,
      type: 'surrender',
      attackerDamage: 0,
      defenderDamage: 0,
      casualties: { attacker: 0, defender: 0 },
      cargoSeized: true,
      shipCaptured: true,
    };
  }

  // 2. Broadside phase (1-3 rounds)
  const rounds = 1 + Math.floor(Math.random() * 3);
  let atkTotalHullDmg = 0;
  let defTotalHullDmg = 0;
  let atkCasualties = 0;
  let defCasualties = 0;

  for (let r = 0; r < rounds; r++) {
    const atkFirepower = calculateFirepower(attacker);
    const defFirepower = calculateFirepower(defender);

    // Attacker damages defender — minimum 1 damage per round if attacker has guns
    const defHullDmg = atkFirepower > 0 ? Math.max(1, Math.floor(atkFirepower * (0.5 + Math.random() * 0.5))) : 0;
    defTotalHullDmg += defHullDmg;
    const defCrewLoss = Math.floor(defHullDmg * 0.1 * Math.random());
    defCasualties += defCrewLoss;

    // Defender damages attacker (reduced — defenders fight defensively, not aggressively)
    // Historical: merchants rarely fought back effectively; even navy return fire
    // during a pirate attack was suppressed by surprise and boarding threat
    const atkHullDmg = defFirepower > 0 ? Math.max(1, Math.floor(defFirepower * (0.15 + Math.random() * 0.25))) : 0;
    atkTotalHullDmg += atkHullDmg;
    const atkCrewLoss = Math.floor(atkHullDmg * 0.1 * Math.random());
    atkCasualties += atkCrewLoss;

    // Surrender check: if defender hull gets critical (raised from 20 to 40)
    // Historical: captains struck colors when damage was serious, not suicidal
    if (defender.hull - defTotalHullDmg <= 40) {
      await applyResults(attacker, defender, atkTotalHullDmg, defTotalHullDmg, atkCasualties, defCasualties, tick);
      await ShipQueries.updateStatusFull(defenderShipId, 'captured', defender.port_id, null);
      await transferSeizedCargo(attacker, defender);
      return {
        winner: attackerShipId,
        loser: defenderShipId,
        type: 'surrender',
        attackerDamage: atkTotalHullDmg,
        defenderDamage: defTotalHullDmg,
        casualties: { attacker: atkCasualties, defender: defCasualties },
        cargoSeized: true,
        shipCaptured: true,
      };
    }

    // Attacker surrender check too — if attacker is taking heavy damage, they break off
    if (attacker.hull - atkTotalHullDmg <= 40) {
      await applyResults(attacker, defender, atkTotalHullDmg, defTotalHullDmg, atkCasualties, defCasualties, tick);
      return {
        winner: defenderShipId,
        loser: attackerShipId,
        type: 'escape',
        attackerDamage: atkTotalHullDmg,
        defenderDamage: defTotalHullDmg,
        casualties: { attacker: atkCasualties, defender: defCasualties },
        cargoSeized: false,
        shipCaptured: false,
      };
    }
  }

  // 3. Boarding phase
  const atkBoardingStrength = Math.max(1, attacker.crew_count - atkCasualties);
  const defBoardingStrength = Math.max(1, defender.crew_count - defCasualties);
  const ratio = atkBoardingStrength / defBoardingStrength;

  let shipCaptured = false;
  let cargoSeized = false;
  let winner: string;
  let loser: string;

  if (ratio >= 1.5) {
    // Attacker captures
    shipCaptured = true;
    cargoSeized = true;
    winner = attackerShipId;
    loser = defenderShipId;
    defCasualties += Math.floor(defBoardingStrength * 0.2);
    atkCasualties += Math.floor(atkBoardingStrength * 0.05);
  } else if (ratio <= 0.67) {
    // Boarding repelled
    winner = defenderShipId;
    loser = attackerShipId;
    atkCasualties += Math.floor(atkBoardingStrength * 0.2);
    defCasualties += Math.floor(defBoardingStrength * 0.05);
  } else {
    // Contested — attacker wins by attrition but no capture
    cargoSeized = true;
    winner = attackerShipId;
    loser = defenderShipId;
    atkCasualties += Math.floor(atkBoardingStrength * 0.15);
    defCasualties += Math.floor(defBoardingStrength * 0.15);
  }

  await applyResults(attacker, defender, atkTotalHullDmg, defTotalHullDmg, atkCasualties, defCasualties, tick);

  if (shipCaptured || cargoSeized) {
    if (shipCaptured) {
      await ShipQueries.updateStatusFull(defenderShipId, 'captured', defender.port_id, null);
    }
    await transferSeizedCargo(attacker, defender);

    // Post-victory emergency repair — crew patches hull after winning
    // Historical: pirates always repaired immediately after taking a prize,
    // using timber and supplies from the captured vessel
    const postBattleHull = Math.max(0, attacker.hull - atkTotalHullDmg);
    const repairBonus = Math.min(25, Math.floor((100 - postBattleHull) * 0.4));
    const repairedHull = Math.min(100, postBattleHull + repairBonus);
    if (repairBonus > 0) {
      await ShipQueries.updateCondition(attacker.id, repairedHull, attacker.sails, attacker.barnacle_level, attacker.rot_level);
    }
  }

  // Create world event — check actual ship status for accurate description
  if (tick !== undefined) {
    const defenderShip = await ShipQueries.getById(defenderShipId);
    const defenderSunk = defenderShip?.status === 'sunk' || (defenderShip && defenderShip.hull <= 0);
    let outcomeLabel = 'repelled';
    if (shipCaptured) outcomeLabel = 'captured';
    else if (cargoSeized) outcomeLabel = 'cargo seized';
    else if (defenderSunk) outcomeLabel = 'sunk';

    await EventQueries.insert({
      id: uuid(),
      type: 'combat',
      description: `${attacker.name} engaged ${defender.name} — ${outcomeLabel}`,
      agent_ids: JSON.stringify([attacker.captain_id, defender.captain_id].filter(Boolean)),
      ship_ids: JSON.stringify([attackerShipId, defenderShipId]),
      port_id: null,
      sea_zone_id: attacker.sea_zone_id,
      severity: shipCaptured ? 8 : defenderSunk ? 7 : 5,
      tick,
      data: JSON.stringify({ type: shipCaptured ? 'boarding' : 'broadside', atkDmg: atkTotalHullDmg, defDmg: defTotalHullDmg }),
    });
  }

  return {
    winner,
    loser,
    type: shipCaptured ? 'boarding' : 'broadside',
    attackerDamage: atkTotalHullDmg,
    defenderDamage: defTotalHullDmg,
    casualties: { attacker: atkCasualties, defender: defCasualties },
    cargoSeized,
    shipCaptured,
  };
}

/**
 * Transfer cargo from defender to attacker after a capture/seizure.
 * Only pirate-type captains loot — navy/merchants don't (cargo would be stranded).
 */
async function transferSeizedCargo(attacker: Ship, defender: Ship): Promise<void> {
  const LOOT_TYPES = new Set(['pirate_captain', 'privateer_captain', 'pirate_hunter']);
  const attackerAgent = attacker.captain_id ? await AgentQueries.getById(attacker.captain_id) : null;
  const canLoot = attackerAgent && LOOT_TYPES.has(attackerAgent.type);
  if (!canLoot) return;

  const PIRACY_TYPES = new Set(['pirate_captain', 'privateer_captain']);
  const isPiracy = attackerAgent && PIRACY_TYPES.has(attackerAgent.type);
  const defenderCargo = await CargoQueries.getByShip(defender.id);
  for (const cargo of defenderCargo) {
    if (cargo.quantity <= 0) continue;
    const heat = isPiracy ? Math.min(80, 30 + (cargo.heat || 0)) : (cargo.heat || 0);
    await CargoQueries.transferSeized(cargo.id, attacker.id, attacker.captain_id ?? '', heat, defender.captain_id ?? 'npc');
  }
}

function calculateFirepower(ship: Ship): number {
  const hullFactor = Math.max(0.1, ship.hull / 100); // Floor at 10% — even wrecks can fire
  const powderFactor = ship.powder_stores > 0 ? 1.0 : 0.2;
  const raw = ship.guns * hullFactor * powderFactor;
  return ship.guns > 0 ? Math.max(1, raw) : 0; // Armed ships always produce at least 1 firepower
}

function calculateEscapeChance(attacker: Ship, defender: Ship, sea?: SeaCondition): number {
  // Compare total mobility: speed + maneuverability for both ships
  const defenderMobility = defender.speed_base + defender.maneuverability;
  const attackerMobility = attacker.speed_base + attacker.maneuverability;
  const mobilityDiff = defenderMobility - attackerMobility;

  // Base 20% escape + mobility differential (each point = 5% swing)
  let chance = 0.20 + mobilityDiff * 0.05;

  // Low visibility helps escape
  if (sea && sea.visibility < 0.5) chance += 0.15;

  // Floor 5%, cap 60% — historical: once a pirate closed, escape was rare
  return Math.max(0.05, Math.min(0.60, chance));
}

async function applyShipDamage(ship: Ship, hullDmg: number, sailDmg: number): Promise<void> {
  const newHull = Math.max(0, ship.hull - hullDmg);
  const newSails = Math.max(0, ship.sails - sailDmg);
  await ShipQueries.updateCondition(ship.id, newHull, newSails, ship.barnacle_level, ship.rot_level);
}

async function applyResults(
  attacker: Ship, defender: Ship,
  atkDmg: number, defDmg: number,
  atkCasualties: number, defCasualties: number,
  _tick?: number,
): Promise<void> {
  await applyShipDamage(attacker, atkDmg, Math.floor(atkDmg * 0.3));
  await applyShipDamage(defender, defDmg, Math.floor(defDmg * 0.3));

  const newAtkCrew = Math.max(0, attacker.crew_count - atkCasualties);
  const newDefCrew = Math.max(0, defender.crew_count - defCasualties);
  await ShipQueries.updateCrewCount(attacker.id, newAtkCrew);
  await ShipQueries.updateCrewCount(defender.id, newDefCrew);

  // Consume powder
  const atkPowder = Math.max(0, attacker.powder_stores - 10);
  const defPowder = Math.max(0, defender.powder_stores - 10);
  await ShipQueries.updateStores(attacker.id, attacker.food_stores, attacker.water_stores, atkPowder);
  await ShipQueries.updateStores(defender.id, defender.food_stores, defender.water_stores, defPowder);

  // Sink check — only sink if hull truly destroyed (< -20 overshoot)
  // Ships at hull 0-20 are "dead in the water" but afloat — captured, not sunk
  // Historical: sinking a wooden ship with cannons was actually very difficult
  if (defender.hull - defDmg < -20) {
    await ShipQueries.updateStatusFull(defender.id, 'sunk', null, null);
    await ShipQueries.updateCrewCount(defender.id, 0);
  } else if (defender.hull - defDmg <= 0) {
    // Hulled but afloat — mark captured instead of sunk
    await ShipQueries.updateStatusFull(defender.id, 'captured', null, null);
  }
  if (attacker.hull - atkDmg < -20) {
    await ShipQueries.updateStatusFull(attacker.id, 'sunk', null, null);
    await ShipQueries.updateCrewCount(attacker.id, 0);
  } else if (attacker.hull - atkDmg <= 0) {
    await ShipQueries.updateStatusFull(attacker.id, 'captured', null, null);
  }
}

function emptyResult(attackerId: string, defenderId: string): CombatResult {
  return {
    winner: attackerId, loser: defenderId, type: 'broadside',
    attackerDamage: 0, defenderDamage: 0,
    casualties: { attacker: 0, defender: 0 },
    cargoSeized: false, shipCaptured: false,
  };
}

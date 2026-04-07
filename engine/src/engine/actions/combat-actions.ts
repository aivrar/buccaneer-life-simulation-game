import type { AgentState } from '../../runtime/types.js';
import { AgentStatus } from '../../runtime/types.js';
import { ShipQueries, CargoQueries, AgentQueries } from '../../db/queries.js';
import { SHIP_CLASSES } from '../../config/ships.js';
import { execute, query } from '../../db/sqlite.js';
import type { Ship } from '../../db/models.js';
import { resolveCombat } from '../combat.js';
import { startEngagement, getEngagementForAgent } from '../combat-engagement.js';
import { getShipsInZone, redirectVoyage } from '../../handlers/travel-tick.js';
import { findNearestPort } from '../../world/navigation.js';
import { getSeaZone } from '../../world/regions.js';
import type { ActionResult } from './sail-to.js';

export async function executeAttackShip(
  agent: AgentState,
  params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  if (!agent.shipId) return { success: false, message: 'No ship' };
  if (agent.status !== AgentStatus.AT_SEA && agent.status !== AgentStatus.IN_PORT) {
    return { success: false, message: 'Must be at sea or in port to attack' };
  }

  // Check if already in combat
  if (getEngagementForAgent(agent.id)) {
    return { success: false, message: 'Already in combat' };
  }

  const targetShipId = params.target_ship_id as string;

  // If no target specified, find ships in the same zone
  let target = targetShipId;
  if (!target) {
    const ship = await ShipQueries.getById(agent.shipId);
    if (!ship) return { success: false, message: 'Ship not found' };
    const zoneId = ship.current_zone_id ?? ship.sea_zone_id;
    if (!zoneId) return { success: false, message: 'Cannot determine position' };

    // First check in-memory active voyages
    const nearbyShipIds = getShipsInZone(zoneId);
    let candidates = nearbyShipIds.filter(id => id !== agent.shipId);

    // If no in-memory ships found, query DB for NPC ships (spawned vessels) in the zone
    if (candidates.length === 0) {
      const dbShips = await ShipQueries.getByZone(zoneId);
      const dbCandidates = dbShips.filter(s =>
        s.id !== agent.shipId &&
        s.status === 'sailing' &&
        s.captain_id !== agent.id
      );
      candidates = dbCandidates.map(s => s.id);
    }

    // If still none, check adjacent zones (ships visible on the horizon)
    if (candidates.length === 0) {
      const zone = getSeaZone(zoneId);
      if (zone?.adjacentZones) {
        for (const adjZoneId of zone.adjacentZones) {
          // Check in-memory first
          const adjInMemory = getShipsInZone(adjZoneId).filter(id => id !== agent.shipId);
          if (adjInMemory.length > 0) {
            candidates.push(...adjInMemory);
            continue;
          }
          // Then DB
          const adjDbShips = await ShipQueries.getByZone(adjZoneId);
          const adjCandidates = adjDbShips.filter(s =>
            s.id !== agent.shipId &&
            s.status === 'sailing' &&
            s.captain_id !== agent.id
          );
          candidates.push(...adjCandidates.map(s => s.id));
        }
      }
    }

    // Navy/hunter agents should only target pirate-type ships, not merchants
    const NAVY_TYPES = new Set(['naval_officer', 'pirate_hunter']);
    const PIRATE_TYPES = new Set(['pirate_captain', 'privateer_captain']);
    if (NAVY_TYPES.has(agent.type)) {
      const validTargets: string[] = [];
      for (const cid of candidates) {
        const cShip = await ShipQueries.getById(cid);
        if (!cShip) { validTargets.push(cid); continue; } // NPC ships are valid targets for navy
        if (!cShip.captain_id) { validTargets.push(cid); continue; } // NPC = likely pirate/merchant NPC
        const cCaptain = await AgentQueries.getById(cShip.captain_id);
        if (cCaptain && PIRATE_TYPES.has(cCaptain.type)) validTargets.push(cid);
      }
      candidates = validTargets;
    }

    if (candidates.length === 0) return { success: false, message: 'No ships in range to attack' };
    target = candidates[Math.floor(Math.random() * candidates.length)]!;
  }

  // Check if target ship has an agent captain (LLM combat) or is NPC (instant combat)
  const targetShip = await ShipQueries.getById(target);
  if (!targetShip) return { success: false, message: 'Target ship not found' };

  const targetCaptain = targetShip.captain_id ? await AgentQueries.getById(targetShip.captain_id) : null;
  const myShip = await ShipQueries.getById(agent.shipId);
  const zoneId = myShip?.sea_zone_id ?? myShip?.current_zone_id ?? '';

  if (targetCaptain) {
    // LLM-captained target: start a multi-tick engagement
    const engagement = await startEngagement(agent.shipId, target, zoneId, tick);
    if (!engagement) {
      return { success: false, message: 'Could not initiate engagement' };
    }

    return {
      success: true,
      message: `Engaging ${targetShip.name}! Battle stations!`,
      data: {
        engagementId: engagement.id,
        targetShipId: target,
        targetName: targetShip.name,
      },
    };
  }

  // NPC target (no agent captain): instant combat resolution (old behavior)
  const result = await resolveCombat(agent.shipId, target, undefined, tick);

  return {
    success: true,
    message: `Combat: ${result.type}. ${result.winner === agent.shipId ? 'Victory' : 'Defeat'}. Hull damage: ${result.attackerDamage}. ${result.cargoSeized ? 'Cargo seized!' : ''} ${result.shipCaptured ? 'Ship captured!' : ''}`,
    data: {
      winner: result.winner,
      type: result.type,
      cargoSeized: result.cargoSeized,
      shipCaptured: result.shipCaptured,
    },
  };
}

export async function executeFlee(
  agent: AgentState,
  tick: number = 0,
): Promise<ActionResult> {
  // If in active combat, the disengage action in combat-tick handles fleeing
  // This is for fleeing outside of combat (general evasion)

  if (agent.status === AgentStatus.AT_SEA && agent.shipId) {
    // At sea: burn stores for speed burst AND redirect to nearest safe port
    const ship = await ShipQueries.getById(agent.shipId);
    if (!ship) return { success: false, message: 'No ship to flee with' };
    const newFood = Math.max(0, ship.food_stores - 5);
    const newWater = Math.max(0, ship.water_stores - 3);
    await ShipQueries.updateStores(ship.id, newFood, newWater, ship.powder_stores);

    // Redirect to nearest port
    const zoneId = ship.current_zone_id ?? ship.sea_zone_id;
    const nearestPort = zoneId ? findNearestPort(zoneId) : null;
    let fleeMsg = `Fled at full sail, burning stores. Food ${ship.food_stores}→${newFood}, water ${ship.water_stores}→${newWater}.`;
    if (nearestPort && tick > 0) {
      const redirected = redirectVoyage(ship.id, nearestPort, ship.speed_base, tick);
      if (redirected) {
        await ShipQueries.updateStatusFull(ship.id, 'sailing', null, nearestPort);
        fleeMsg += ` Making for ${nearestPort}.`;
      }
    }
    return { success: true, message: fleeMsg };
  }

  if (agent.status === AgentStatus.IN_PORT) {
    return { success: true, message: 'Slipped away into the crowds. Keeping a low profile.' };
  }

  return { success: true, message: 'Fled to safety.' };
}

export async function executeSurrender(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.shipId) return { success: false, message: 'No ship' };

  // Surrender: mark ship as captured, agent as imprisoned
  await ShipQueries.updateStatusFull(agent.shipId, 'captured', null, null);
  await AgentQueries.updateStatus(agent.id, 'imprisoned');

  return { success: true, message: 'Surrendered' };
}

// ============================================================
// Claim Prize — pirate/privateer takes a captured ship as flagship
// Historical: Blackbeard's Queen Anne's Revenge was a captured French
// slave ship. This was THE pirate progression path — sloop → captured
// brigantine → captured merchantman.
// ============================================================

export async function executeClaimPrize(
  agent: AgentState,
  params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  if (agent.status !== AgentStatus.IN_PORT) {
    return { success: false, message: 'Must be in port to claim a prize' };
  }
  if (!agent.shipId) {
    return { success: false, message: 'No current ship to swap from' };
  }

  // Find captured ships at this port
  const capturedRows = await query<Ship[]>(
    'SELECT * FROM ships WHERE status = ? AND port_id = ?',
    ['captured', agent.portId],
  );

  if (capturedRows.length === 0) {
    return { success: false, message: 'No prize ships available at this port' };
  }

  // Pick best prize: highest (guns + cargo_capacity) score, or specific target
  const targetId = params.target_ship_id as string | undefined;
  let prize: Ship;
  if (targetId) {
    const specific = capturedRows.find(s => s.id === targetId);
    if (!specific) return { success: false, message: 'That ship is not available as a prize' };
    prize = specific;
  } else {
    prize = capturedRows.sort((a, b) =>
      (b.guns + b.cargo_capacity) - (a.guns + a.cargo_capacity)
    )[0]!;
  }

  // Check if prize is actually better than current ship (don't downgrade)
  const currentShip = await ShipQueries.getById(agent.shipId);
  if (!currentShip) return { success: false, message: 'Current ship not found' };
  if (prize.guns + prize.cargo_capacity <= currentShip.guns + currentShip.cargo_capacity) {
    return { success: false, message: `Prize ${prize.name} (${prize.class}) is not an upgrade` };
  }

  // Must have enough crew to man the prize
  const prizeClass = SHIP_CLASSES[prize.class];
  const minCrew = prizeClass?.crewMin ?? 15;
  if (currentShip.crew_count < minCrew) {
    return { success: false, message: `Need at least ${minCrew} crew to man a ${prize.class}, have ${currentShip.crew_count}` };
  }

  // Transfer cargo from old ship to prize (up to prize capacity)
  const oldCargo = await CargoQueries.getByShip(agent.shipId);
  let cargoTransferred = 0;
  const prizeCapacity = prize.cargo_capacity ?? 100;
  let spaceLeft = prizeCapacity;
  for (const c of oldCargo) {
    if (c.quantity <= 0 || spaceLeft <= 0) continue;
    const transferQty = Math.min(c.quantity, spaceLeft);
    await execute('UPDATE cargo SET ship_id = ? WHERE id = ?', [prize.id, c.id]);
    spaceLeft -= transferQty;
    cargoTransferred += transferQty;
  }

  // Release old ship (docked, no captain) — available for NPC recycling
  await execute('UPDATE ships SET captain_id = NULL, status = ? WHERE id = ?', ['docked', agent.shipId]);
  await ShipQueries.updateCrewCount(agent.shipId, 0);

  // Claim prize: set captain, dock it, patch hull to at least 40
  const claimHull = Math.max(40, Math.min(prize.hull, 80));
  const claimSails = Math.max(50, prize.sails);
  await execute(
    'UPDATE ships SET captain_id = ?, status = ?, port_id = ?, hull = ?, sails = ? WHERE id = ?',
    [agent.id, 'docked', agent.portId, claimHull, claimSails, prize.id],
  );
  await ShipQueries.updateCrewCount(prize.id, currentShip.crew_count);

  // Update agent's ship_id in DB
  await execute('UPDATE agents SET ship_id = ? WHERE id = ?', [prize.id, agent.id]);

  return {
    success: true,
    message: `Claimed ${prize.name} (${prize.class}, ${prize.guns} guns, ${prizeCapacity} cargo) as new flagship! ${cargoTransferred} cargo transferred.`,
    data: {
      oldShipId: agent.shipId,
      newShipId: prize.id,
      newShipClass: prize.class,
      prizeGuns: prize.guns,
      prizeCargo: prizeCapacity,
    },
  };
}

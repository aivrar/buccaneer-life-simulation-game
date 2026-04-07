import type { AgentState } from '../../runtime/types.js';
import type { ActionResult } from './sail-to.js';
import type { ShipClassName } from '../../db/models.js';
import { v4 as uuid } from 'uuid';
import { AgentQueries, ShipQueries } from '../../db/queries.js';
import { execute, query } from '../../db/sqlite.js';

// ============================================================
// Ship Purchase — captains buy a replacement vessel at port
// ============================================================

const VESSEL_PRICES: Partial<Record<ShipClassName, number>> = {
  periagua: 50,
  shallop: 80,
  sloop: 200,
  schooner: 300,
  brigantine: 500,
  merchantman: 400,
};

const VESSEL_SPECS: Partial<Record<ShipClassName, { guns: number; maxGuns: number; crew: number; cargo: number; speed: number; maneuver: number }>> = {
  periagua: { guns: 0, maxGuns: 2, crew: 15, cargo: 20, speed: 6, maneuver: 9 },
  shallop: { guns: 0, maxGuns: 4, crew: 10, cargo: 15, speed: 7, maneuver: 8 },
  sloop: { guns: 6, maxGuns: 14, crew: 75, cargo: 80, speed: 8, maneuver: 8 },
  schooner: { guns: 8, maxGuns: 16, crew: 75, cargo: 100, speed: 7, maneuver: 7 },
  brigantine: { guns: 12, maxGuns: 22, crew: 120, cargo: 120, speed: 6, maneuver: 6 },
  merchantman: { guns: 8, maxGuns: 20, crew: 80, cargo: 200, speed: 5, maneuver: 4 },
};

/**
 * Buy a vessel at port. Available to captains who lost their ship.
 * Picks the best ship the captain can afford. Merchants prefer merchantman/schooner,
 * pirates prefer sloop/brigantine.
 */
export async function executeBuyVessel(
  agent: AgentState,
  _params: Record<string, unknown>,
  _tick: number,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };
  if (agent.shipId) return { success: false, message: 'Already have a ship' };

  const agentData = await AgentQueries.getById(agent.id);
  if (!agentData) return { success: false, message: 'Agent not found' };

  // Determine preferred ship classes by agent type
  const MERCHANT_TYPES = new Set(['merchant_captain']);
  const isMerchant = MERCHANT_TYPES.has(agent.type);
  const preferredClasses: ShipClassName[] = isMerchant
    ? ['merchantman', 'schooner', 'sloop', 'shallop']
    : ['sloop', 'brigantine', 'schooner', 'shallop'];

  // Find the best ship the agent can afford
  let chosenClass: ShipClassName | null = null;
  let chosenPrice = 0;
  for (const cls of preferredClasses) {
    const price = VESSEL_PRICES[cls];
    if (price && agentData.cash >= price) {
      chosenClass = cls;
      chosenPrice = price;
      break;
    }
  }

  if (!chosenClass) {
    // Try cheapest option
    if (agentData.cash >= (VESSEL_PRICES.periagua ?? 50)) {
      chosenClass = 'periagua';
      chosenPrice = VESSEL_PRICES.periagua!;
    } else {
      return { success: false, message: `Cannot afford a vessel (have ${agentData.cash} gold, cheapest is 50)` };
    }
  }

  const specs = VESSEL_SPECS[chosenClass]!;

  // Deduct cost
  await AgentQueries.addCash(agent.id, -chosenPrice);

  // Create the ship
  const shipId = uuid();
  const shipName = `${agent.name.split(' ')[0]}'s ${chosenClass.charAt(0).toUpperCase() + chosenClass.slice(1)}`;
  await ShipQueries.insert({
    id: shipId,
    name: shipName,
    class: chosenClass,
    captain_id: agent.id,
    hull: 100,
    sails: 100,
    guns: specs.guns,
    max_guns: specs.maxGuns,
    crew_count: 5, // skeleton crew to start
    crew_capacity: specs.crew,
    cargo_used: 0,
    cargo_capacity: specs.cargo,
    speed_base: specs.speed,
    maneuverability: specs.maneuver,
    port_id: agent.portId,
    sea_zone_id: agent.seaZoneId ?? '',
    status: 'docked',
    current_zone_id: null as unknown as string,
    barnacle_level: 0,
    rot_level: 0,
    powder_stores: 50,
    food_stores: 100,
    water_stores: 100,
    destination_port_id: null,
    origin_port_id: null,
    arrival_tick: null,
    departure_tick: null,
  });

  // Update agent's ship reference
  await execute('UPDATE agents SET ship_id = ? WHERE id = ?', [shipId, agent.id]);

  return {
    success: true,
    message: `Purchased a ${chosenClass} for ${chosenPrice} gold — ${shipName}`,
    data: { shipId, shipClass: chosenClass, cost: chosenPrice },
  };
}

// ============================================================
// Shipwright Actions
// ============================================================

/**
 * Upgrade a ship docked at the shipwright's port.
 * Adds armament (2 guns up to max), speed (+1 up to 10), or cargo capacity (+10).
 * Costs the ship's captain 50 gold; shipwright earns 30 gold.
 */
export async function executeUpgradeShip(
  agent: AgentState,
  _params: Record<string, unknown>,
  _tick: number,
): Promise<ActionResult> {
  if (!agent.portId) {
    return { success: false, message: 'Not in port — cannot upgrade ships' };
  }

  const ships = await ShipQueries.getByPort(agent.portId);
  // Find a ship that could use an upgrade (low guns relative to max)
  const target = ships.find(s => s.guns < s.max_guns)
    ?? ships.find(s => s.speed_base < 10)
    ?? ships.find(s => s.cargo_capacity < 200);

  if (!target) {
    return { success: false, message: 'No ships need upgrading' };
  }

  // Check if captain can afford the upgrade before charging
  const upgradeCost = 50;
  if (target.captain_id) {
    const captainData = await AgentQueries.getById(target.captain_id);
    if (!captainData || captainData.cash < upgradeCost) {
      return { success: false, message: `Captain cannot afford upgrade (need ${upgradeCost} gold)` };
    }
  }

  // Determine upgrade type
  if (target.guns < target.max_guns) {
    if (target.captain_id) {
      await AgentQueries.addCash(target.captain_id, -upgradeCost);
    }
    await AgentQueries.addCash(agent.id, 30);
    await execute(
      'UPDATE ships SET guns = MIN(max_guns, guns + 2) WHERE id = ?',
      [target.id],
    );
    return {
      success: true,
      message: `Upgraded ${target.name} — added armament`,
      data: { shipId: target.id, upgrade: 'guns', cost: upgradeCost },
    };
  }

  if (target.speed_base < 10) {
    if (target.captain_id) {
      await AgentQueries.addCash(target.captain_id, -upgradeCost);
    }
    await AgentQueries.addCash(agent.id, 30);
    await execute(
      'UPDATE ships SET speed_base = MIN(10, speed_base + 1) WHERE id = ?',
      [target.id],
    );
    return {
      success: true,
      message: `Upgraded ${target.name} — improved rigging for speed`,
      data: { shipId: target.id, upgrade: 'speed', cost: upgradeCost },
    };
  }

  // Cargo capacity upgrade
  if (target.captain_id) {
    await AgentQueries.addCash(target.captain_id, -upgradeCost);
  }
  await AgentQueries.addCash(agent.id, 30);
  await execute(
    'UPDATE ships SET cargo_capacity = cargo_capacity + 10 WHERE id = ?',
    [target.id],
  );
  return {
    success: true,
    message: `Upgraded ${target.name} — expanded cargo hold`,
    data: { shipId: target.id, upgrade: 'cargo', cost: upgradeCost },
  };
}

/**
 * Assess damage on a docked ship — informational inspection.
 * Shipwright earns 3 gold inspection fee.
 */
export async function executeAssessDamage(
  agent: AgentState,
  _params: Record<string, unknown>,
  _tick: number,
): Promise<ActionResult> {
  if (!agent.portId) {
    return { success: false, message: 'Not in port — cannot inspect ships' };
  }

  const ships = await ShipQueries.getByPort(agent.portId);
  if (ships.length === 0) {
    return { success: false, message: 'No ships in port to inspect' };
  }

  const target = ships[0];
  await AgentQueries.addCash(agent.id, 3);

  return {
    success: true,
    message: `Assessed ${target.name}: hull ${target.hull}%, sails ${target.sails}%, barnacles ${target.barnacle_level}, rot ${target.rot_level}`,
    data: {
      shipId: target.id,
      hull: target.hull,
      sails: target.sails,
      barnacles: target.barnacle_level,
      rot: target.rot_level,
    },
  };
}

/**
 * Build a brand-new sloop. Costs 500 gold minimum.
 * Shipwright earns 200 gold if a buyer (captain) claims the vessel.
 * If no buyer and shipwright lacks funds, action fails.
 */
export async function executeBuildVessel(
  agent: AgentState,
  _params: Record<string, unknown>,
  _tick: number,
): Promise<ActionResult> {
  if (!agent.portId) {
    return { success: false, message: 'Not in port — cannot build a vessel' };
  }

  const buildCost = 500;

  // Check if the shipwright can fund the build
  const agentData = await AgentQueries.getById(agent.id);
  if (!agentData || agentData.cash < buildCost) {
    return {
      success: false,
      message: 'Cannot afford to build — need a patron',
    };
  }

  // Deduct build cost from shipwright
  await AgentQueries.addCash(agent.id, -buildCost);

  const { generateShipNameLLM } = await import('../../agents/name-generator.js');
  const { LLMClient } = await import('../../runtime/llm-client.js');
  const llm = new LLMClient({ maxConcurrent: 1 });
  const name = await generateShipNameLLM(llm, {
    captainName: agent.name,
    captainType: 'shipwright',
    shipClass: 'sloop',
    portId: agent.portId,
    nationality: 'english',
  });

  const shipId = uuid();
  await ShipQueries.insert({
    id: shipId,
    name,
    class: 'sloop',
    captain_id: null,
    hull: 100,
    sails: 100,
    guns: 4,
    max_guns: 14,
    crew_count: 0,
    crew_capacity: 75,
    cargo_used: 0,
    cargo_capacity: 80,
    speed_base: 8,
    maneuverability: 8,
    port_id: agent.portId,
    sea_zone_id: agent.seaZoneId,
    status: 'docked',
    current_zone_id: null,
    barnacle_level: 0,
    rot_level: 0,
    powder_stores: 50,
    food_stores: 50,
    water_stores: 50,
    destination_port_id: null,
    origin_port_id: null,
    arrival_tick: null,
    departure_tick: null,
  });

  // Shipwright earns 200 gold from eventual sale margin
  await AgentQueries.addCash(agent.id, 200);

  return {
    success: true,
    message: `Built a new sloop: ${name}`,
    data: { shipId, shipName: name, cost: buildCost },
  };
}

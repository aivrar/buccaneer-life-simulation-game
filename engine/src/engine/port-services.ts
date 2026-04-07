/**
 * Port services — repair, careen, resupply, recruit crew, heal.
 */

import { v4 as uuid } from 'uuid';
import { AgentQueries, ShipQueries, WoundQueries } from '../db/queries.js';
import { ECONOMY } from '../config/economy.js';
import { ALL_PORTS } from '../config/ports.js';
import { removeSupply, getSupply } from '../world/port-inventory.js';
import { calculatePrice } from './economy.js';

export interface ServiceResult {
  success: boolean;
  message: string;
  cost?: number;
}

export async function repairShip(shipId: string, portId: string, agentId: string): Promise<ServiceResult> {
  const [ship, agent] = await Promise.all([ShipQueries.getById(shipId), AgentQueries.getById(agentId)]);
  if (!ship || !agent) return { success: false, message: 'Ship or agent not found' };
  if (ship.status !== 'docked' || ship.port_id !== portId) return { success: false, message: 'Ship not docked at this port' };

  const port = ALL_PORTS[portId];
  const shipyardQuality = port?.shipyardQuality ?? 50;

  const hullDamage = 100 - ship.hull;
  const sailDamage = 100 - ship.sails;
  if (hullDamage === 0 && sailDamage === 0) return { success: false, message: 'Ship is not damaged' };

  // Cost scales with damage and inversely with shipyard quality
  const qualityMod = Math.max(0.5, 100 / (shipyardQuality + 50));
  const cost = Math.round((hullDamage + sailDamage) * ECONOMY.shipMaintenance.repairCostPerHull * qualityMod);

  if (agent.cash < cost) return { success: false, message: `Insufficient funds (need ${cost})` };

  await AgentQueries.addCash(agentId, -cost);
  await ShipQueries.updateCondition(shipId, 100, 100, ship.barnacle_level, ship.rot_level);

  return { success: true, message: `Ship repaired: hull and sails restored to 100`, cost };
}

export async function careenShip(shipId: string, portId: string, agentId: string): Promise<ServiceResult> {
  const [ship, agent] = await Promise.all([ShipQueries.getById(shipId), AgentQueries.getById(agentId)]);
  if (!ship || !agent) return { success: false, message: 'Ship or agent not found' };
  if (ship.status !== 'docked' || ship.port_id !== portId) return { success: false, message: 'Ship not docked at this port' };

  if (ship.barnacle_level === 0) return { success: false, message: 'Ship has no barnacles' };

  const cost = Math.round(ship.barnacle_level * ECONOMY.shipMaintenance.careeningCostPerHull);
  if (agent.cash < cost) return { success: false, message: `Insufficient funds (need ${cost})` };

  await AgentQueries.addCash(agentId, -cost);
  await ShipQueries.updateCondition(shipId, ship.hull, ship.sails, 0, ship.rot_level);
  // In a full implementation this would set status='careening' for N ticks.
  // For now, instant careening.

  return { success: true, message: `Ship careened: barnacles cleared`, cost };
}

export async function resupplyShip(
  shipId: string,
  portId: string,
  agentId: string,
  stores: { food?: number; water?: number; powder?: number },
): Promise<ServiceResult> {
  const [ship, agent] = await Promise.all([ShipQueries.getById(shipId), AgentQueries.getById(agentId)]);
  if (!ship || !agent) return { success: false, message: 'Ship or agent not found' };
  if (ship.status !== 'docked' || ship.port_id !== portId) return { success: false, message: 'Ship not docked at this port' };

  let totalCost = 0;
  const food = stores.food ?? 0;
  const water = stores.water ?? 0;
  const powder = stores.powder ?? 0;

  // Price provisions from market
  if (food > 0) {
    const quote = calculatePrice(portId, 'provisions');
    totalCost += quote.buyPrice * food * 0.1; // provisions are bulk
  }
  if (water > 0) {
    totalCost += water * 0.5; // water is cheap
  }
  if (powder > 0) {
    const quote = calculatePrice(portId, 'gunpowder');
    totalCost += quote.buyPrice * powder * 0.2;
  }

  totalCost = Math.round(totalCost);
  if (agent.cash < totalCost) return { success: false, message: `Insufficient funds (need ${totalCost})` };

  await AgentQueries.addCash(agentId, -totalCost);
  await ShipQueries.updateStores(
    shipId,
    Math.min(100, ship.food_stores + food),
    Math.min(100, ship.water_stores + water),
    Math.min(100, ship.powder_stores + powder),
  );

  return { success: true, message: `Resupplied: +${food} food, +${water} water, +${powder} powder`, cost: totalCost };
}

export async function recruitCrew(
  shipId: string,
  portId: string,
  agentId: string,
  count: number,
): Promise<ServiceResult> {
  const [ship, agent] = await Promise.all([ShipQueries.getById(shipId), AgentQueries.getById(agentId)]);
  if (!ship || !agent) return { success: false, message: 'Ship or agent not found' };
  if (ship.status !== 'docked' || ship.port_id !== portId) return { success: false, message: 'Ship not docked at this port' };

  const port = ALL_PORTS[portId];
  const tavernQuality = port?.tavernQuality ?? 50;

  // Available recruits scale with tavern quality and port size
  const maxRecruits = Math.floor(tavernQuality / 10) + Math.floor((port?.population ?? 1000) / 500);
  const actualCount = Math.min(count, maxRecruits, ship.crew_capacity - ship.crew_count);
  if (actualCount <= 0) return { success: false, message: 'No recruits available or ship is full' };

  const costPerHead = Math.round(5 + (100 - tavernQuality) * 0.1);
  const totalCost = costPerHead * actualCount;
  if (agent.cash < totalCost) return { success: false, message: `Insufficient funds (need ${totalCost})` };

  await AgentQueries.addCash(agentId, -totalCost);
  await ShipQueries.updateCrewCount(shipId, ship.crew_count + actualCount);

  return { success: true, message: `Recruited ${actualCount} crew`, cost: totalCost };
}

export async function healAgent(agentId: string, portId: string): Promise<ServiceResult> {
  const agent = await AgentQueries.getById(agentId);
  if (!agent) return { success: false, message: 'Agent not found' };
  if (agent.port_id !== portId) return { success: false, message: 'Agent not at this port' };

  const wounds = await WoundQueries.getByAgent(agentId);
  const untreated = wounds.filter(w => !w.treated && w.healing_progress < 100);
  if (untreated.length === 0) return { success: false, message: 'No wounds to treat' };

  // Check for medicine supply at port
  const medicineSupply = getSupply(portId, 'medicine');

  let totalCost = 0;
  let treated = 0;
  for (const wound of untreated) {
    const costPerWound = wound.severity * 5;
    if (agent.cash < totalCost + costPerWound) break;
    if (medicineSupply > 0) {
      removeSupply(portId, 'medicine', 1);
    }
    await WoundQueries.updateTreatment(wound.id, true);
    totalCost += costPerWound;
    treated++;
  }

  if (treated === 0) return { success: false, message: 'Cannot afford treatment' };

  await AgentQueries.addCash(agentId, -totalCost);
  return { success: true, message: `Treated ${treated} wound(s)`, cost: totalCost };
}

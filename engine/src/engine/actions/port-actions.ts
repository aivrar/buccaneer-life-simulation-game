import type { AgentState } from '../../runtime/types.js';
import { repairShip, careenShip, resupplyShip, recruitCrew, healAgent } from '../port-services.js';
import { ShipQueries } from '../../db/queries.js';
import type { ActionResult } from './sail-to.js';

export async function executeRepairShip(
  agent: AgentState,
): Promise<ActionResult> {
  let shipId = agent.shipId;

  // Shipwrights repair other ships at their port — captain pays, shipwright earns
  if (!shipId && agent.type === 'shipwright' && agent.portId) {
    const docked = await ShipQueries.getByPort(agent.portId);
    const needsRepair = docked.find(s => s.hull < 80 || s.sails < 80);
    if (needsRepair) {
      // Charge the ship's captain, not the shipwright
      const captainId = needsRepair.captain_id;
      if (!captainId) return { success: false, message: 'Ship has no captain to pay for repairs' };
      const result = await repairShip(needsRepair.id, agent.portId, captainId);
      if (result.success && (result.cost ?? 0) > 0) {
        // Pay shipwright a portion of the repair fee
        const { AgentQueries } = await import('../../db/queries.js');
        await AgentQueries.addCash(agent.id, Math.floor((result.cost ?? 0) * 0.6));
      }
      return { success: result.success, message: result.success ? `Repaired ${needsRepair.name} (earned ${Math.floor((result.cost ?? 0) * 0.6)} gold)` : result.message, data: { cost: result.cost ?? 0 } };
    } else {
      return { success: false, message: 'No ships at port need repair' };
    }
  }

  if (!shipId) return { success: false, message: 'No ship' };
  const result = await repairShip(shipId, agent.portId, agent.id);
  return { success: result.success, message: result.message, data: { cost: result.cost } };
}

export async function executeCareenShip(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.shipId) return { success: false, message: 'No ship' };
  const result = await careenShip(agent.shipId, agent.portId, agent.id);
  return { success: result.success, message: result.message, data: { cost: result.cost } };
}

export async function executeBuyProvisions(
  agent: AgentState,
  params: Record<string, unknown>,
): Promise<ActionResult> {
  if (!agent.shipId) return { success: false, message: 'No ship' };
  const food = (params.food as number) ?? 30;
  const water = (params.water as number) ?? 30;
  const powder = (params.powder as number) ?? 10;
  const result = await resupplyShip(agent.shipId, agent.portId, agent.id, { food, water, powder });
  return { success: result.success, message: result.message, data: { cost: result.cost } };
}

export async function executeRecruitCrew(
  agent: AgentState,
  params: Record<string, unknown>,
): Promise<ActionResult> {
  if (!agent.shipId) return { success: false, message: 'No ship' };
  const count = (params.count as number) ?? 5;
  const result = await recruitCrew(agent.shipId, agent.portId, agent.id, count);
  return { success: result.success, message: result.message, data: { cost: result.cost } };
}

export async function executeVisitTavern(
  agent: AgentState,
): Promise<ActionResult> {
  // Visiting a tavern: rest, gather rumors, socialize
  // For now this is a placeholder that succeeds — interaction engine will add substance
  return { success: true, message: `${agent.name} visits the tavern` };
}

export async function executeHealAgent(
  agent: AgentState,
): Promise<ActionResult> {
  const result = await healAgent(agent.id, agent.portId);
  return { success: result.success, message: result.message, data: { cost: result.cost } };
}

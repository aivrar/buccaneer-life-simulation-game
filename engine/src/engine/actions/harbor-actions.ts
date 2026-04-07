import { v4 as uuid } from 'uuid';
import type { AgentState } from '../../runtime/types.js';
import type { ActionResult } from './sail-to.js';
import { AgentQueries, ShipQueries, CargoQueries, IntelQueries } from '../../db/queries.js';
import { query, execute } from '../../db/sqlite.js';

export async function executeInspectShip(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  // Find ships at port
  const ships = await ShipQueries.getByPort(agent.portId);
  if (ships.length === 0) return { success: false, message: 'No ships in port to inspect' };

  // Pick first ship
  const ship = ships[0]!;

  // Check cargo for heat > 0
  const cargo = await CargoQueries.getByShip(ship.id);
  const hotCargo = cargo.filter(c => c.heat > 0);

  // Harbor master earns inspection fee
  await AgentQueries.addCash(agent.id, 5);

  if (hotCargo.length > 0) {
    // Create intel about contraband
    await IntelQueries.insert({
      id: uuid(),
      source_agent_id: agent.id,
      subject_agent_id: ship.captain_id,
      subject_ship_id: ship.id,
      type: 'manifest',
      content: `Contraband found aboard ${ship.name}: ${hotCargo.map(c => c.type).join(', ')}`,
      accuracy: 90,
      freshness: 100,
      port_id: agent.portId,
      price: null,
      created_tick: 0,
    });

    return {
      success: true,
      message: `Inspected ${ship.name} — found contraband`,
      data: { shipName: ship.name, contrabandTypes: hotCargo.map(c => c.type), fee: 5 },
    };
  }

  return {
    success: true,
    message: `Inspected ${ship.name} — all clear`,
    data: { shipName: ship.name, fee: 5 },
  };
}

export async function executeCollectFees(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  const ships = await ShipQueries.getByPort(agent.portId);
  if (ships.length === 0) return { success: false, message: 'No ships in port' };

  // Historical: port officials earned fixed Crown salaries (~£100-300/year),
  // not unlimited per-ship fees. Fee scales with ships but capped at 50.
  const feePerShip = 0.5;
  const total = Math.min(50, Math.round(feePerShip * ships.length));

  await AgentQueries.addCash(agent.id, total);

  return {
    success: true,
    message: `Collected docking fees — ${total} gold from ${ships.length} ships`,
    data: { total, count: ships.length },
  };
}

export async function executeDenyEntry(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  // Find a ship with hot cargo or pirate captain
  const ships = await ShipQueries.getByPort(agent.portId);

  for (const ship of ships) {
    // Check if captain is a pirate
    if (ship.captain_id) {
      const captain = await AgentQueries.getById(ship.captain_id);
      if (captain && captain.type === 'pirate_captain') {
        return {
          success: true,
          message: `Denied entry to ${ship.name}`,
          data: { shipName: ship.name, reason: 'pirate captain' },
        };
      }
    }

    // Check for hot cargo
    const cargo = await CargoQueries.getByShip(ship.id);
    if (cargo.some(c => c.heat > 50)) {
      return {
        success: true,
        message: `Denied entry to ${ship.name}`,
        data: { shipName: ship.name, reason: 'contraband' },
      };
    }
  }

  return { success: false, message: 'All ships cleared for entry' };
}

export async function executeIssueClearance(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  const ships = await ShipQueries.getByPort(agent.portId);
  if (ships.length === 0) return { success: false, message: 'No ships in port' };

  const ship = ships[0]!;
  const holderId = ship.captain_id ?? agent.id;

  // Create a document record
  await execute(
    'INSERT INTO documents (id, type, holder_agent_id, data, created_tick) VALUES (?, ?, ?, ?, ?)',
    [uuid(), 'clearance', holderId, JSON.stringify({ ship_id: ship.id, ship_name: ship.name, port_id: agent.portId }), 0],
  );

  // Harbor master earns 3 gold
  await AgentQueries.addCash(agent.id, 3);

  return {
    success: true,
    message: `Issued clearance papers for ${ship.name}`,
    data: { shipName: ship.name, fee: 3 },
  };
}

export async function executeReportSuspicious(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  // Find ships with pirate captains at port
  const ships = await ShipQueries.getByPort(agent.portId);

  for (const ship of ships) {
    if (!ship.captain_id) continue;
    const captain = await AgentQueries.getById(ship.captain_id);
    if (captain && (captain.type === 'pirate_captain' || captain.infamy > 20)) {
      await IntelQueries.insert({
        id: uuid(),
        source_agent_id: agent.id,
        subject_agent_id: captain.id,
        subject_ship_id: ship.id,
        type: 'sighting',
        content: `Suspicious vessel ${ship.name} captained by ${captain.name} spotted in port`,
        accuracy: 95,
        freshness: 100,
        port_id: agent.portId,
        price: null,
        created_tick: 0,
      });

      return {
        success: true,
        message: `Reported suspicious vessel ${ship.name}`,
        data: { shipName: ship.name, captainName: captain.name },
      };
    }
  }

  return { success: false, message: 'No suspicious vessels to report' };
}

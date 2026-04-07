import type { AgentState } from '../../runtime/types.js';
import { AgentStatus } from '../../runtime/types.js';
import { ShipQueries, AgentQueries } from '../../db/queries.js';
import { buildSeaVoyage } from '../navigation.js';
import { departShip, redirectVoyage } from '../../handlers/travel-tick.js';
import { getPortDistance, findNearestPort } from '../../world/navigation.js';

export interface SailToParams {
  destination_port: string;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export async function executeSailTo(
  agent: AgentState,
  params: SailToParams,
  tick: number,
): Promise<ActionResult> {
  const { destination_port } = params;

  // Validate agent has a ship
  if (!agent.shipId) {
    return { success: false, message: 'No ship to sail' };
  }

  // Validate destination
  if (!destination_port) {
    return { success: false, message: 'Invalid destination' };
  }

  // Course change at sea — redirect existing voyage
  if (agent.status === AgentStatus.AT_SEA) {
    const ship = await ShipQueries.getById(agent.shipId);
    if (!ship) return { success: false, message: 'Ship not found' };

    const ok = redirectVoyage(ship.id, destination_port, ship.speed_base, tick);
    if (!ok) return { success: false, message: `Cannot plot course to ${destination_port} from here` };

    await ShipQueries.updateStatusFull(ship.id, 'sailing', null, destination_port);
    await ShipQueries.updateVoyageInfo(ship.id, ship.origin_port_id, tick);
    return {
      success: true,
      message: `Changed course for ${destination_port}`,
      data: { destination: destination_port },
    };
  }

  // Must be in port for normal departure
  if (agent.status !== AgentStatus.IN_PORT) {
    return { success: false, message: 'Must be in port to depart' };
  }

  if (destination_port === agent.portId) {
    return { success: false, message: 'Already here' };
  }

  const distance = getPortDistance(agent.portId, destination_port);
  if (distance === Infinity) {
    return { success: false, message: `No route from ${agent.portId} to ${destination_port}` };
  }

  // Get ship from DB
  const ship = await ShipQueries.getById(agent.shipId);
  if (!ship) {
    return { success: false, message: 'Ship not found' };
  }

  if (ship.status !== 'docked') {
    return { success: false, message: `Ship is ${ship.status}, cannot depart` };
  }

  // Check minimum seaworthiness
  if (ship.hull <= 10) {
    return { success: false, message: 'Ship hull too damaged to sail' };
  }

  // Build voyage
  const voyage = buildSeaVoyage(ship.id, agent.portId, destination_port, ship.speed_base, tick);
  if (!voyage) {
    return { success: false, message: 'Could not plot route' };
  }

  // Update ship: status → sailing, set destination, clear port
  await ShipQueries.updateStatusFull(ship.id, 'sailing', null, destination_port);
  const departureZone = voyage.waypoints[0] ?? ship.sea_zone_id;
  await ShipQueries.updateTravel(ship.id, ship.sea_zone_id, departureZone, voyage.estimatedArrivalTick);
  // Persist origin for voyage reconstruction after restart
  await ShipQueries.updateVoyageInfo(ship.id, agent.portId, tick);

  // Register voyage with travel tick handler
  departShip(ship.id, voyage);

  // Update agent status
  await AgentQueries.updateStatus(agent.id, 'at_sea');

  return {
    success: true,
    message: `Departed ${agent.portId} for ${destination_port} (~${Math.ceil(distance / (ship.speed_base * 24))} days)`,
    data: {
      destination: destination_port,
      distanceNm: distance,
      estimatedTicks: voyage.estimatedArrivalTick - tick,
      route: voyage.waypoints,
    },
  };
}

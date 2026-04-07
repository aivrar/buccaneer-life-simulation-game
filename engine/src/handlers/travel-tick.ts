import type { TickHandler, TickContext } from '../runtime/types.js';
import { TickPhase } from '../runtime/types.js';
import { ShipQueries, AgentQueries, CrewQueries, CargoQueries } from '../db/queries.js';
import { addSupply } from '../world/port-inventory.js';
import { getWeatherState, getSeaStateMap } from './weather-tick.js';
import { getSpeedModifier as getSeaSpeedMod, getDamageRisk } from '../world/sea-state.js';
import { getSpeedModifier as getConditionSpeedMod } from '../engine/ship-condition.js';
import { ECONOMY } from '../config/economy.js';
import { rollNavigationChecks, getZoneHazardLevel } from '../engine/navigation-skills.js';
import { SeaZoneQueries } from '../db/queries.js';
import {
  type TravelState,
  buildSeaVoyage,
  advanceTravelTick,
  calculateEffectiveSpeed,
  getCurrentZone,
} from '../engine/navigation.js';
import { findNearestPort, findZonePath, calculatePathDistance } from '../world/navigation.js';
import { SEA_ZONE_DEFINITIONS } from '../config/regions.js';
import { markNPCShipArrived } from '../world/vessel-spawner.js';

// In-memory travel states for all sailing ships
const activeVoyages = new Map<string, TravelState>();

export const travelTickHandler: TickHandler = {
  name: 'travel-tick',
  phase: TickPhase.WORLD,

  async execute(tick: TickContext): Promise<void> {
    const sailingShips = await ShipQueries.getSailing();
    // Debug removed — travel system verified working
    if (sailingShips.length === 0) return;

    const weatherMap = getWeatherState();
    const seaStateMap = getSeaStateMap();

    for (const ship of sailingShips) {
      let voyage = activeVoyages.get(ship.id);

      // Reconstruct travel state from DB if missing (e.g. after restart)
      if (!voyage && ship.destination_port_id) {
        const origin = ship.origin_port_id ?? ship.port_id;
        if (origin) {
          voyage = buildSeaVoyage(ship.id, origin, ship.destination_port_id, ship.speed_base, ship.departure_tick ?? tick.tickNumber) ?? undefined;
          if (voyage && ship.departure_tick) {
            // Estimate progress based on elapsed ticks
            const elapsed = tick.tickNumber - ship.departure_tick;
            const estimatedNm = elapsed * ship.speed_base; // rough: 1 nm/tick at base speed
            voyage.distanceCoveredNm = Math.min(estimatedNm, voyage.totalDistanceNm * 0.95); // cap at 95% to let normal advancement finish
            // Update waypoint index
            if (voyage.waypoints.length > 1) {
              const distPerSegment = voyage.totalDistanceNm / Math.max(1, voyage.waypoints.length - 1);
              voyage.currentWaypointIndex = Math.min(voyage.waypoints.length - 1, Math.floor(voyage.distanceCoveredNm / distPerSegment));
            }
          }
          if (voyage) {
            activeVoyages.set(ship.id, voyage);
          }
        }
      }

      if (!voyage) continue;

      const currentZone = getCurrentZone(voyage);
      if (!currentZone) continue;

      // Get environment modifiers
      const seaState = seaStateMap.get(currentZone);
      const weather = weatherMap.get(currentZone);

      const conditionMod = getConditionSpeedMod({
        shipId: ship.id,
        hullIntegrity: ship.hull,
        sailCondition: ship.sails,
        powderDry: 100,
        rotLevel: ship.rot_level,
        barnacleLevel: ship.barnacle_level,
      });
      const environmentMod = seaState ? getSeaSpeedMod(seaState) : 1.0;
      const windMod = weather ? Math.max(0.6, weather.windSpeed / 15) : 1.0;
      // Crew mod: minimum crew (crewMin) gives full speed. Below that, penalty.
      // Using crew_capacity * 0.2 as proxy for crewMin since we don't have ship class data here.
      const minCrew = Math.max(5, ship.crew_capacity * 0.2);
      const crewMod = ship.crew_count > 0 ? Math.min(1.0, ship.crew_count / minCrew) : 0.3;

      const speed = calculateEffectiveSpeed(
        ship.speed_base,
        conditionMod,
        environmentMod,
        windMod,
        crewMod,
      );

      // Navigation skill checks (every 6 ticks to reduce DB load)
      if (tick.tickNumber % 6 === 0 && ship.captain_id) {
        const zone = await SeaZoneQueries.getById(currentZone);
        const hazardLevel = zone ? getZoneHazardLevel(zone.hazards) : 0;
        const navCheck = await rollNavigationChecks(ship.captain_id, seaState, hazardLevel);

        // Getting lost adds delay
        if (navCheck.lostTicks > 0) {
          voyage.totalDistanceNm += navCheck.lostTicks * 4; // ~4nm per lost tick
        }

        // Hazard damage (reef/shoal hit)
        if (navCheck.hazardDamage > 0) {
          const newHull = Math.max(0, ship.hull - navCheck.hazardDamage);
          await ShipQueries.updateCondition(ship.id, newHull, ship.sails, ship.barnacle_level, ship.rot_level);
        }
      }

      // Advance position — travel-tick fires every 6 ticks, so advance 6 ticks worth
      const SLOW_TICK_INTERVAL = 6;
      let result = { state: voyage, arrivedAtDestination: false };
      for (let step = 0; step < SLOW_TICK_INTERVAL; step++) {
        result = advanceTravelTick(result.state, speed.effectiveSpeed);
        if (result.arrivedAtDestination) break;
      }
      activeVoyages.set(ship.id, result.state);

      // Update DB with current zone — sea_zone_id tracks current position for encounter detection
      const newZone = getCurrentZone(result.state);
      if (newZone) {
        await ShipQueries.updateTravel(ship.id, newZone, newZone, ship.arrival_tick);
      }

      // Storm damage check
      if (seaState) {
        const damageRisk = getDamageRisk(seaState);
        if (damageRisk > 0 && Math.random() < damageRisk) {
          const hullDmg = Math.floor(Math.random() * 10 * seaState.waveHeight / 3);
          const sailDmg = Math.floor(Math.random() * 15 * seaState.waveHeight / 3);
          const newHull = Math.max(0, ship.hull - hullDmg);
          const newSails = Math.max(0, ship.sails - sailDmg);
          await ShipQueries.updateCondition(ship.id, newHull, newSails, ship.barnacle_level, ship.rot_level);
        }
      }

      // Consume stores
      const { foodConsumptionPerCrewPerTick, waterConsumptionPerCrewPerTick } = ECONOMY.shipMaintenance;
      const foodUsed = ship.crew_count * foodConsumptionPerCrewPerTick;
      const waterUsed = ship.crew_count * waterConsumptionPerCrewPerTick;
      const newFood = Math.max(0, ship.food_stores - foodUsed);
      const newWater = Math.max(0, ship.water_stores - waterUsed);
      if (newFood !== ship.food_stores || newWater !== ship.water_stores) {
        await ShipQueries.updateStores(ship.id, newFood, newWater, ship.powder_stores);
      }

      // Check arrival
      if (result.arrivedAtDestination) {
        // Ship arrived at destination
        const destPort = voyage.destinationId;
        const destZone = voyage.waypoints[voyage.waypoints.length - 1] ?? ship.sea_zone_id;

        // Dock the ship
        await ShipQueries.updateStatusFull(ship.id, 'docked', destPort, null);
        await ShipQueries.updateTravel(ship.id, destZone, destZone, null);
        await ShipQueries.updateVoyageInfo(ship.id, null, null);
        activeVoyages.delete(ship.id);

        // Log navigation event
        tick.logger?.logNavigation?.({
          type: 'arrival',
          agentId: ship.captain_id,
          agentName: ship.captain_id,
          shipId: ship.id,
          shipName: ship.name,
          captainId: ship.captain_id,
          port: destPort,
          zone: destZone,
          tick: tick.tickNumber,
        });

        // Transition captain to IN_PORT at destination (skip dead agents)
        if (ship.captain_id) {
          const captainAgent = await AgentQueries.getById(ship.captain_id);
          if (captainAgent && captainAgent.status !== 'dead') {
            await AgentQueries.updateStatus(ship.captain_id, 'in_port');
            await AgentQueries.updateLocation(ship.captain_id, destPort, destZone);
          }
        } else {
          // NPC ship arrived — unload cargo into port inventory, then notify spawner
          const npcCargo = await CargoQueries.getByShip(ship.id);
          for (const c of npcCargo) {
            if (c.quantity > 0 && !c.seized_from && c.type !== 'coins') {
              addSupply(destPort, c.type, c.quantity);
              await CargoQueries.updateQuantity(c.id, 0);
            }
          }
          markNPCShipArrived(ship.id);
        }

        // Transition all active crew to IN_PORT at destination (skip dead agents)
        const crew = await CrewQueries.getActiveByShip(ship.id);
        for (const member of crew) {
          const crewAgent = await AgentQueries.getById(member.agent_id);
          if (crewAgent && crewAgent.status !== 'dead') {
            await AgentQueries.updateStatus(member.agent_id, 'in_port');
            await AgentQueries.updateLocation(member.agent_id, destPort, destZone);
          }
        }
      }
    }
  },
};

// Public API for other systems to use

export function departShip(shipId: string, travelState: TravelState): void {
  activeVoyages.set(shipId, travelState);
}

export function getTravelState(shipId: string): TravelState | undefined {
  return activeVoyages.get(shipId);
}

export function getShipsInZone(zoneId: string): string[] {
  const ships: string[] = [];
  for (const [shipId, voyage] of activeVoyages) {
    if (getCurrentZone(voyage) === zoneId) {
      ships.push(shipId);
    }
  }
  return ships;
}

/** Redirect a sailing ship to a new destination mid-voyage. */
export function redirectVoyage(shipId: string, newDest: string, baseSpeed: number, tick: number): boolean {
  const current = activeVoyages.get(shipId);
  const currentZone = current ? getCurrentZone(current) : null;
  if (!currentZone) return false;

  // Try pre-computed route first (uses proxy origin port)
  const proxyOrigin = findNearestPort(currentZone);
  if (proxyOrigin && proxyOrigin !== newDest) {
    const newVoyage = buildSeaVoyage(shipId, proxyOrigin, newDest, baseSpeed, tick);
    if (newVoyage) {
      activeVoyages.set(shipId, newVoyage);
      return true;
    }
  }

  // Fallback: zone-path BFS (covers all connections the sparse route table misses)
  const destZone = Object.entries(SEA_ZONE_DEFINITIONS)
    .find(([_, z]) => (z as any).accessiblePorts?.includes(newDest))?.[0];
  if (!destZone) return false;

  const zonePath = findZonePath(currentZone, destZone);
  if (!zonePath || zonePath.length === 0) return false;

  const distance = calculatePathDistance(zonePath);
  const nmPerDay = baseSpeed * 24;
  const days = distance / nmPerDay;
  const estimatedTicks = Math.max(18, Math.ceil(days * 24));

  activeVoyages.set(shipId, {
    entityId: shipId,
    routeType: 'sea',
    waypoints: zonePath,
    currentWaypointIndex: 0,
    totalDistanceNm: distance,
    distanceCoveredNm: 0,
    originId: proxyOrigin ?? currentZone,
    destinationId: newDest,
    departureTick: tick,
    estimatedArrivalTick: tick + estimatedTicks,
  });
  return true;
}

export function clearTravelState(): void {
  activeVoyages.clear();
}

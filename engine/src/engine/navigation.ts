/**
 * Generic travel core — reusable for sea voyages and (later) overland routes.
 * Pure computation: no DB side effects. Callers handle persistence.
 */

import { getSeaRoute, getPortDistance, getVoyageZones } from '../world/navigation.js';
import { calculatePathDistance } from '../world/navigation.js';

// ============================================================
// Core abstractions
// ============================================================

export interface TravelState {
  entityId: string;          // ship ID or caravan ID
  routeType: 'sea' | 'overland';
  waypoints: string[];       // zone IDs or waypoint IDs
  currentWaypointIndex: number;
  totalDistanceNm: number;
  distanceCoveredNm: number;
  originId: string;          // origin port ID
  destinationId: string;     // destination port ID
  departureTick: number;
  estimatedArrivalTick: number;
}

export interface SpeedFactors {
  baseSpeed: number;
  conditionMod: number;      // ship hull/sail condition
  environmentMod: number;    // sea state
  windMod: number;           // wind conditions
  crewMod: number;           // crew effectiveness
  effectiveSpeed: number;    // final speed in knots
}

export interface AdvanceResult {
  state: TravelState;
  arrivedAtWaypoint: boolean;
  arrivedAtDestination: boolean;
  newWaypointId: string | null;
}

// ============================================================
// Speed calculation
// ============================================================

const TICKS_PER_DAY = 24; // 1-hour ticks (aligned with harness)

export function calculateEffectiveSpeed(
  baseSpeed: number,
  conditionMod: number,
  environmentMod: number,
  windMod: number,
  crewMod: number,
): SpeedFactors {
  // Floor at 40% of base speed — multiplicative penalties shouldn't make ships crawl
  const raw = baseSpeed * conditionMod * environmentMod * windMod * crewMod;
  const effectiveSpeed = Math.max(baseSpeed * 0.4, raw);
  return { baseSpeed, conditionMod, environmentMod, windMod, crewMod, effectiveSpeed };
}

export function distancePerTick(speedKnots: number, ticksPerDay: number = TICKS_PER_DAY): number {
  // knots = nautical miles per hour. Each tick = 24/ticksPerDay hours
  const hoursPerTick = 24 / ticksPerDay;
  return speedKnots * hoursPerTick;
}

// ============================================================
// Travel advancement (pure, transport-agnostic)
// ============================================================

export function advanceTravelTick(state: TravelState, effectiveSpeed: number, ticksPerDay: number = TICKS_PER_DAY): AdvanceResult {
  const nmThisTick = distancePerTick(effectiveSpeed, ticksPerDay);
  const newDistance = state.distanceCoveredNm + nmThisTick;

  // Calculate distance to next waypoint
  const waypointCount = state.waypoints.length;
  if (waypointCount === 0) {
    return {
      state: { ...state, distanceCoveredNm: newDistance },
      arrivedAtWaypoint: false,
      arrivedAtDestination: newDistance >= state.totalDistanceNm,
      newWaypointId: null,
    };
  }

  // Distance per waypoint segment (evenly divided)
  const distPerSegment = state.totalDistanceNm / Math.max(1, waypointCount - 1);
  const newWaypointIndex = Math.min(
    waypointCount - 1,
    Math.floor(newDistance / distPerSegment)
  );

  const arrivedAtWaypoint = newWaypointIndex > state.currentWaypointIndex;
  const arrivedAtDestination = newDistance >= state.totalDistanceNm;

  const updatedState: TravelState = {
    ...state,
    distanceCoveredNm: Math.min(newDistance, state.totalDistanceNm),
    currentWaypointIndex: arrivedAtDestination ? waypointCount - 1 : newWaypointIndex,
  };

  return {
    state: updatedState,
    arrivedAtWaypoint,
    arrivedAtDestination,
    newWaypointId: arrivedAtWaypoint ? state.waypoints[newWaypointIndex] ?? null : null,
  };
}

// ============================================================
// Sea voyage builder
// ============================================================

export function buildSeaVoyage(
  shipId: string,
  fromPort: string,
  toPort: string,
  baseSpeed: number,
  currentTick: number,
): TravelState | null {
  const zones = getVoyageZones(fromPort, toPort);
  if (zones.length === 0) return null;

  const distance = getPortDistance(fromPort, toPort);
  if (distance === Infinity) return null;

  // Estimate arrival using base speed
  const nmPerDay = baseSpeed * 24;
  const days = distance / nmPerDay;
  // Minimum 18 ticks (18 hours) — ensures ships spend enough time at sea for encounters
  const estimatedTicks = Math.max(18, Math.ceil(days * TICKS_PER_DAY));

  return {
    entityId: shipId,
    routeType: 'sea',
    waypoints: zones,
    currentWaypointIndex: 0,
    totalDistanceNm: distance,
    distanceCoveredNm: 0,
    originId: fromPort,
    destinationId: toPort,
    departureTick: currentTick,
    estimatedArrivalTick: currentTick + estimatedTicks,
  };
}

export function getCurrentZone(state: TravelState): string | null {
  return state.waypoints[state.currentWaypointIndex] ?? null;
}

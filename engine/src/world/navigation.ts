import { SEA_ZONE_DEFINITIONS, SEA_ZONE_TRANSIT_DISTANCES } from '../config/regions.js';
import { getRoute, SEA_ROUTES, type SeaRoute } from '../config/sea-routes.js';
import { PORT_DISTANCES } from '../config/distances.js';

// Get the pre-computed route between two ports
export function getSeaRoute(fromPort: string, toPort: string): SeaRoute | null {
  return getRoute(fromPort, toPort);
}

// Get the zone sequence for a voyage
export function getVoyageZones(fromPort: string, toPort: string): string[] {
  const route = getRoute(fromPort, toPort);
  return route?.zones ?? [];
}

// Get distance between two ports in nautical miles
export function getPortDistance(fromPort: string, toPort: string): number {
  if (fromPort === toPort) return 0;
  return PORT_DISTANCES[fromPort]?.[toPort]
    ?? PORT_DISTANCES[toPort]?.[fromPort]
    ?? Infinity;
}

// Estimate voyage duration in ticks (each tick = 30min game time by default)
// Assumes ~100nm per day at average speed
export function estimateVoyageTicks(fromPort: string, toPort: string, shipSpeed: number): number {
  const distance = getPortDistance(fromPort, toPort);
  if (distance === Infinity) return Infinity;

  // knots * 24 hours = nm/day. Speed is in knots (0-10 scale)
  const nmPerDay = shipSpeed * 24;
  const days = distance / nmPerDay;
  const ticksPerDay = 24; // 1-hour ticks (aligned with harness TICKS_PER_DAY)
  return Math.ceil(days * ticksPerDay);
}

// Find shortest path between two sea zones using BFS
export function findZonePath(fromZone: string, toZone: string): string[] | null {
  if (fromZone === toZone) return [fromZone];

  const visited = new Set<string>();
  const queue: [string, string[]][] = [[fromZone, [fromZone]]];
  visited.add(fromZone);

  while (queue.length > 0) {
    const [current, path] = queue.shift()!;
    const zone = SEA_ZONE_DEFINITIONS[current];
    if (!zone) continue;

    for (const neighbor of zone.adjacentZones) {
      if (neighbor === toZone) return [...path, neighbor];
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, [...path, neighbor]]);
      }
    }
  }

  return null;
}

// Calculate total transit distance for a zone path
export function calculatePathDistance(zones: string[]): number {
  let total = 0;
  for (let i = 0; i < zones.length - 1; i++) {
    const dist = SEA_ZONE_TRANSIT_DISTANCES[zones[i]!]?.[zones[i + 1]!]
      ?? SEA_ZONE_TRANSIT_DISTANCES[zones[i + 1]!]?.[zones[i]!]
      ?? 200; // default fallback
    total += dist;
  }
  return total;
}

// Find the nearest port reachable from a sea zone (BFS through zone adjacency)
export function findNearestPort(zoneId: string): string | null {
  // Check current zone first
  const zone = SEA_ZONE_DEFINITIONS[zoneId];
  if (zone?.accessiblePorts?.length) return zone.accessiblePorts[0]!;

  // BFS to adjacent zones
  const visited = new Set<string>([zoneId]);
  const queue = [...(zone?.adjacentZones ?? [])];
  for (const z of queue) visited.add(z);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const def = SEA_ZONE_DEFINITIONS[current];
    if (def?.accessiblePorts?.length) return def.accessiblePorts[0]!;
    for (const neighbor of def?.adjacentZones ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return null;
}

// Get all routes originating from a port
export function getRoutesFromPort(portId: string): SeaRoute[] {
  return SEA_ROUTES.filter(r => r.from === portId || r.to === portId).map(r => {
    if (r.from === portId) return r;
    return {
      from: portId,
      to: r.from,
      zones: [...r.zones].reverse(),
      distanceNm: r.distanceNm,
      typicalDays: r.typicalDays,
      notes: r.notes,
    };
  });
}

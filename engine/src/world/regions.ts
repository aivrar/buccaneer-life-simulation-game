import { SEA_ZONE_DEFINITIONS, SEA_ZONE_TRANSIT_DISTANCES, type SeaZoneDefinition } from '../config/regions.js';

export function getSeaZone(zoneId: string): SeaZoneDefinition | null {
  return SEA_ZONE_DEFINITIONS[zoneId] ?? null;
}

export function getAdjacentZones(zoneId: string): string[] {
  const zone = SEA_ZONE_DEFINITIONS[zoneId];
  return zone?.adjacentZones ?? [];
}

export function getTransitDistance(fromZone: string, toZone: string): number {
  if (fromZone === toZone) return 0;
  return SEA_ZONE_TRANSIT_DISTANCES[fromZone]?.[toZone]
    ?? SEA_ZONE_TRANSIT_DISTANCES[toZone]?.[fromZone]
    ?? Infinity;
}

export function getZonePorts(zoneId: string): string[] {
  const zone = SEA_ZONE_DEFINITIONS[zoneId];
  return zone?.accessiblePorts ?? [];
}

export function getAllSeaZoneIds(): string[] {
  return Object.keys(SEA_ZONE_DEFINITIONS);
}

export function getPatrolLevel(zoneId: string): string {
  return SEA_ZONE_DEFINITIONS[zoneId]?.patrolLevel ?? 'none';
}

export function getEncounterChance(zoneId: string): number {
  return SEA_ZONE_DEFINITIONS[zoneId]?.encounterChance ?? 0;
}

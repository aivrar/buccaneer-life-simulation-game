import { AgentQueries, PlaceQueries } from '../db/queries.js';
import type { Agent, Place } from '../db/models.js';
import { getAgentPlacePreference } from './daily-routine.js';

export interface CoLocatedGroup {
  placeId: string;
  placeType: string;
  portId: string;
  agentIds: string[];
}

/**
 * Find all groups of 2+ agents sharing the same place at a port.
 * Place assignment is derived from agent type and time of day.
 */
export async function findCoLocatedGroups(
  portId: string,
  hour: number,
): Promise<CoLocatedGroup[]> {
  const agents = await AgentQueries.getByPort(portId);
  if (agents.length < 2) return [];

  const places = await PlaceQueries.getByPort(portId);
  if (places.length === 0) return [];

  // Build a map of place type → place records
  const placesByType = new Map<string, Place[]>();
  for (const place of places) {
    const list = placesByType.get(place.type) ?? [];
    list.push(place);
    placesByType.set(place.type, list);
  }

  // Assign each agent to a place based on their type and the hour
  const placeAssignments = new Map<string, string[]>(); // placeId → agentIds

  for (const agent of agents) {
    const preferredType = getAgentPlacePreference(agent.type, hour);
    const candidates = placesByType.get(preferredType);
    if (!candidates || candidates.length === 0) continue;

    // Pick the first available place of the preferred type
    const place = candidates[0]!;
    const existing = placeAssignments.get(place.id) ?? [];
    existing.push(agent.id);
    placeAssignments.set(place.id, existing);
  }

  // Filter to groups of 2+
  const groups: CoLocatedGroup[] = [];
  for (const [placeId, agentIds] of placeAssignments) {
    if (agentIds.length < 2) continue;
    const place = places.find(p => p.id === placeId);
    if (!place) continue;
    groups.push({
      placeId,
      placeType: place.type,
      portId,
      agentIds,
    });
  }

  return groups;
}

/**
 * Get all agents at a specific place right now.
 */
export async function getAgentsAtPlace(
  portId: string,
  placeType: string,
  hour: number,
): Promise<Agent[]> {
  const agents = await AgentQueries.getByPort(portId);
  return agents.filter(a => getAgentPlacePreference(a.type, hour) === placeType);
}

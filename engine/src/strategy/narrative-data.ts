/**
 * Data fetching layer for narrative proprioception.
 * Single async call gathers all DB data an agent needs for prompt building.
 * Fires applicable queries in parallel via Promise.all().
 */

import type { AgentState, WorldState, AgentMemoryRecord, WeatherState } from '../runtime/types.js';
import type { Ship, Crew, Cargo, Wound, Skill, Reputation, AgentRelationship, Bounty, NavyCase, Intel, Fence, HavenInvestment, MarketPrice, Agent, ShipCode, Port } from '../db/models.js';
import type { MemoryStore } from '../runtime/memory-store.js';
import type { SeaCondition } from '../runtime/types.js';
import type { SeaZoneDefinition } from '../config/regions.js';

import {
  AgentQueries, ShipQueries, CrewQueries, CargoQueries,
  WoundQueries, SkillQueries, ReputationQueries, RelationshipQueries,
  BountyQueries, NavyCaseQueries, IntelQueries, FenceQueries,
  HavenInvestmentQueries, MarketQueries, PortQueries, ShipCodeQueries,
  EventQueries,
} from '../db/queries.js';

import { getWeatherAmbientText, getSeasonalAmbientText } from '../world/weather-ambient.js';
import { getPlaceAmbientFromWeatherMap } from '../world/place-ambient.js';
import { calculateTemperature } from '../world/temperature.js';
import { deriveSeaState } from '../world/sea-state.js';
import { getSeaZone } from '../world/regions.js';
import { getActivePlan } from '../nudge/plan-manager.js';
import { getProprioceptionLimits } from '../config/providers.js';
import { ALL_PLACES } from '../config/places.js';

// Agent type groupings
const SHIP_OWNER_TYPES = new Set([
  'pirate_captain', 'merchant_captain', 'naval_officer', 'privateer_captain', 'pirate_hunter',
]);
const ABOARD_SHIP_TYPES = new Set(['crew_member', 'quartermaster']);

export interface AgentDataSnapshot {
  // Identity
  agent: AgentState;
  agentDb: Agent | null;

  // Location
  port: Port | null;
  zone: SeaZoneDefinition | null;

  // Ship (null if port-based agent with no ship)
  ship: Ship | null;
  cargo: Cargo[];
  crew: Crew[];
  shipCode: ShipCode | null;

  // Personal state
  wounds: Wound[];
  skills: Skill[];
  reputations: Reputation[];

  // Social
  allies: AgentRelationship[];
  rivals: AgentRelationship[];
  strongestRelationships: AgentRelationship[];
  relationshipAgents: Agent[];  // resolved name+type for relationship targets

  // Legal
  bounties: Bounty[];
  navyCases: NavyCase[];

  // Economic
  fences: Fence[];
  havenInvestments: HavenInvestment[];
  marketPrices: MarketPrice[];

  // Environment
  nearbyAgents: Agent[];
  nearbyShips: Ship[];
  intel: Intel[];

  // Weather & ambient
  weather: WeatherState | null;
  seaState: SeaCondition | null;
  temperatureF: number;
  weatherAmbient: string;
  placeAmbient: string;
  seasonalAmbient: string;

  // Memories
  workingMemory: AgentMemoryRecord[];
  episodicMemory: AgentMemoryRecord[];

  // Plan state
  activePlan: ReturnType<typeof getActivePlan>;

  // World events (recent happenings at this port/zone)
  worldEvents: Array<{ type: string; description: string; severity: number; tick: number }>;

  // Target intel (at-sea captains see nearby ship captains' bounties/warrants/infamy)
  nearbyTargetIntel: Array<{
    agentId: string;
    name: string;
    type: string;
    shipName: string;
    shipClass: string;
    guns: number;
    crewCount: number;
    hull: number;
    sails: number;
    infamy: number;
    bountyTotal: number;
    warrantIssued: boolean;
    caseEvidence: number;
  }>;

  // World time
  gameTime: import('../runtime/types.js').GameTime;
}

/**
 * Gather all data an agent needs for narrative prompt building.
 * Fires all applicable queries in parallel.
 */
export async function gatherAgentData(
  agent: AgentState,
  worldState: WorldState,
  memoryStore: MemoryStore,
): Promise<AgentDataSnapshot> {
  const limits = getProprioceptionLimits();
  const isShipOwner = SHIP_OWNER_TYPES.has(agent.type);
  const isAboardShip = ABOARD_SHIP_TYPES.has(agent.type);
  const isInPort = agent.status === 'in_port' || agent.status === 'active';
  const hasShip = !!(agent.shipId);

  // --- Fire all DB queries in parallel ---
  const [
    agentDb,
    port,
    ship,
    wounds,
    skills,
    reputations,
    allies,
    rivals,
    strongestRelationships,
    bounties,
    navyCases,
    fences,
    havenInvestments,
    intel,
    nearbyAgents,
    worldEvents,
  ] = await Promise.all([
    // Agent DB record (for cash, attributes, etc.)
    AgentQueries.getById(agent.id),
    // Port
    agent.portId ? PortQueries.getById(agent.portId) : Promise.resolve(null),
    // Ship
    hasShip ? ShipQueries.getByCaptain(agent.id) : Promise.resolve(null),
    // Personal
    WoundQueries.getByAgent(agent.id),
    SkillQueries.getByAgent(agent.id),
    ReputationQueries.getByAgent(agent.id),
    // Social
    RelationshipQueries.getAllies(agent.id),
    RelationshipQueries.getRivals(agent.id),
    RelationshipQueries.getStrongest(agent.id, limits.maxCrewMembers),
    // Legal
    BountyQueries.getByTarget(agent.id),
    NavyCaseQueries.getByTarget(agent.id),
    // Economic
    (isShipOwner || !isAboardShip) ? FenceQueries.getByAgent(agent.id) : Promise.resolve([]),
    (isShipOwner || !isAboardShip) ? HavenInvestmentQueries.getByAgent(agent.id) : Promise.resolve([]),
    // Intel
    (isInPort && agent.portId) ? IntelQueries.getByPort(agent.portId) : Promise.resolve([]),
    // Nearby agents (at port OR at sea via ship zone join)
    (isInPort && agent.portId)
      ? AgentQueries.getByPort(agent.portId)
      : (agent.seaZoneId ? AgentQueries.getByZoneWithShips(agent.seaZoneId) : Promise.resolve([])),
    // World events (recent happenings at this port)
    (isInPort && agent.portId) ? EventQueries.getByPort(agent.portId, 5) : Promise.resolve([]),
  ]);

  // Collect relationship target IDs for name resolution
  const relationshipTargetIds = [
    ...(allies ?? []).map(r => r.target_agent_id),
    ...(rivals ?? []).map(r => r.target_agent_id),
  ];

  // Secondary queries that depend on first results
  const [crew, cargo, shipCode, nearbyShips, marketPrices, relationshipAgents] = await Promise.all([
    // Crew: ship owners get their own crew; aboard-ship types get crew of the ship they're on
    (ship && (isShipOwner || isAboardShip))
      ? CrewQueries.getActiveByShip(ship.id)
      : Promise.resolve([]),
    // Cargo
    (ship && isShipOwner) ? CargoQueries.getByShip(ship.id) : Promise.resolve([]),
    // Ship code
    (ship) ? ShipCodeQueries.getByShip(ship.id) : Promise.resolve(null),
    // Nearby ships
    (isInPort && agent.portId)
      ? ShipQueries.getByPort(agent.portId)
      : (agent.seaZoneId ? ShipQueries.getByZone(agent.seaZoneId) : Promise.resolve([])),
    // Market
    (isInPort && agent.portId) ? MarketQueries.getByPort(agent.portId) : Promise.resolve([]),
    // Relationship target agents — skip for now, use nearbyAgents fallback
    Promise.resolve([]),
  ]);

  // --- Build ambient text ---
  const weather = worldState.weather.get(agent.seaZoneId) ?? null;
  const seaState = weather ? deriveSeaState(weather) : null;
  const temperatureF = calculateTemperature(
    agent.seaZoneId,
    worldState.gameTime,
    weather?.condition ?? 'clear' as any,
  );

  // Weather ambient: at sea uses sea text, in port uses place text
  let weatherAmbient = '';
  let placeAmbient = '';
  const seasonalAmbient = getSeasonalAmbientText(agent.seaZoneId, worldState.gameTime);

  if (weather) {
    if (agent.status === 'at_sea') {
      weatherAmbient = getWeatherAmbientText(weather, worldState.gameTime);
    } else if (isInPort && agent.portId) {
      // Find a relevant place for this agent type
      const agentPlace = findAgentPlace(agent);
      if (agentPlace) {
        placeAmbient = getPlaceAmbientFromWeatherMap(
          agentPlace,
          worldState.weather,
          worldState.gameTime,
        );
      } else {
        weatherAmbient = getWeatherAmbientText(weather, worldState.gameTime);
      }
    }
  }

  // --- Memories (SQLite, sync) ---
  const workingMemory = memoryStore.getWorkingMemory(agent.id, limits.maxMemories);
  const episodicMemory = memoryStore.getEpisodicMemory(agent.id, limits.maxMemories);

  // --- Plan state ---
  const activePlan = getActivePlan(agent.id);

  // --- Zone data (from in-memory config, not DB) ---
  const zone = agent.seaZoneId ? getSeaZone(agent.seaZoneId) ?? null : null;

  // --- Target intel for at-sea captains ---
  // Fetch bounty/warrant/infamy for nearby captains so military agents can make informed decisions
  let nearbyTargetIntel: AgentDataSnapshot['nearbyTargetIntel'] = [];
  const filteredNearby = (nearbyAgents ?? []).filter(a => a.id !== agent.id);
  if (agent.status === 'at_sea' && filteredNearby.length > 0 && SHIP_OWNER_TYPES.has(agent.type)) {
    const nearbyIds = filteredNearby.map(a => a.id);
    const [bountyTotals, caseStatuses] = await Promise.all([
      BountyQueries.getTotalsForAgents(nearbyIds),
      NavyCaseQueries.getCaseStatusForAgents(nearbyIds),
    ]);

    nearbyTargetIntel = filteredNearby.slice(0, limits.maxNearbyShips).map(a => {
      const caseStatus = caseStatuses.get(a.id);
      // Ship data comes from the joined query (getByZoneWithShips adds ship_ prefixed columns)
      const shipData = a as any;
      return {
        agentId: a.id,
        name: a.name,
        type: a.type,
        shipName: shipData.ship_name ?? 'unknown vessel',
        shipClass: shipData.ship_class ?? 'unknown',
        guns: shipData.ship_guns ?? 0,
        crewCount: shipData.ship_crew_count ?? 0,
        hull: shipData.ship_hull ?? 100,
        sails: shipData.ship_sails ?? 100,
        infamy: a.infamy ?? 0,
        bountyTotal: bountyTotals.get(a.id) ?? 0,
        warrantIssued: caseStatus?.warranted ?? false,
        caseEvidence: caseStatus?.evidence ?? 0,
      };
    });
  }

  return {
    agent,
    agentDb,
    port: port ?? null,
    zone,
    ship: ship ?? null,
    cargo,
    crew,
    shipCode: shipCode ?? null,
    wounds,
    skills,
    reputations,
    allies,
    rivals,
    strongestRelationships,
    relationshipAgents: relationshipAgents ?? [],
    bounties,
    navyCases,
    fences,
    havenInvestments,
    marketPrices,
    nearbyAgents: (nearbyAgents ?? []).filter(a => a.id !== agent.id).slice(0, limits.maxNearbyShips),
    nearbyShips: (nearbyShips ?? []).filter(s => s.captain_id !== agent.id).slice(0, limits.maxNearbyShips),
    intel: deduplicateIntel((intel ?? [])).slice(0, limits.maxIntel),
    worldEvents: (worldEvents ?? []).slice(0, 3),
    nearbyTargetIntel,
    weather,
    seaState,
    temperatureF,
    weatherAmbient,
    placeAmbient,
    seasonalAmbient,
    workingMemory,
    episodicMemory,
    activePlan,
    gameTime: worldState.gameTime,
  };
}

/**
 * Find a likely place ID for an agent based on their type.
 * Used for place-ambient text generation.
 */
function findAgentPlace(agent: AgentState): string | null {
  if (!agent.portId) return null;

  const portPlaces = ALL_PLACES.filter(p => p.portId === agent.portId);
  if (portPlaces.length === 0) return null;

  // Match agent type to likely place type
  const placeTypeMap: Record<string, string> = {
    tavern_keeper: 'tavern',
    shipwright: 'shipyard',
    surgeon: 'hospital',
    harbor_master: 'dock',
    port_governor: 'government',
    fence: 'warehouse',
    informant: 'tavern',
    plantation_owner: 'market',
    pirate_captain: 'tavern',
    merchant_captain: 'dock',
    naval_officer: 'fort',
    privateer_captain: 'tavern',
    pirate_hunter: 'dock',
    crew_member: 'tavern',
    quartermaster: 'dock',
  };

  const preferredType = placeTypeMap[agent.type] ?? 'tavern';
  const match = portPlaces.find(p => p.type === preferredType);
  return match?.id ?? portPlaces[0]?.id ?? null;
}

/** Deduplicate intel by content string, keeping the freshest entry. */
function deduplicateIntel<T extends { content: string; freshness: number }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    const existing = seen.get(item.content);
    if (!existing || item.freshness > existing.freshness) {
      seen.set(item.content, item);
    }
  }
  return Array.from(seen.values());
}

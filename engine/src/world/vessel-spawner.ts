/**
 * Vessel Spawner — maintains fleet numbers by spawning, degrading,
 * and replacing ships across the simulation.
 *
 * Same pattern as isthmus-transport: economy-regulated, disposable,
 * condition-based lifecycle. But vessels are full Ship DB entities.
 */

import { v4 as uuid } from 'uuid';
import { SHIP_CLASSES } from '../config/ships.js';
import { ALL_PORTS } from '../config/ports.js';
import { VESSEL_SPAWN_PROFILES, type VesselSpawnProfile } from '../config/vessel-spawning.js';
import { ShipQueries, CargoQueries } from '../db/queries.js';
import type { Ship, ShipClassName } from '../db/models.js';
import { getPortSupplies, removeSupply } from './port-inventory.js';
import { buildSeaVoyage } from '../engine/navigation.js';
import { getRoutesFromPort } from './navigation.js';

// ============================================================
// In-memory tracking
// ============================================================

// profileId → set of ship IDs managed by this spawner
const managedShips = new Map<string, Set<string>>();

// Pending replacements
const pendingReplacements: { profileId: string; spawnAtTick: number; portId: string }[] = [];

// Track all active ship names to prevent duplicates
const activeShipNames = new Set<string>();

// ============================================================
// Nationality-appropriate ship name pools
// ============================================================

const SHIP_NAME_POOLS: Record<string, { trade: string[]; military: string[] }> = {
  english: {
    trade: [
      'Providence', 'Endeavour', 'Adventure', 'Fortune', 'Blessing', 'Dolphin',
      'Prosperous', 'Diligence', 'Industry', 'Hope', 'Patience', 'Unity',
      'Success', 'Friendship', 'Liberty', 'Mercury', 'Neptune', 'Swallow',
      'Pelican', 'Seahorse', 'Good Intent', 'Rose', 'Dove', 'Swift',
      'Speedwell', 'Greyhound', 'Anne', 'Mary', 'Elizabeth', 'Katherine',
      'Martha', 'Sarah', 'Abigail', 'Margaret', 'Hector', 'Phoenix',
      'Eagle', 'Lion', 'Tiger', 'Concord', 'Blessing', 'Planter',
      'Hopewell', 'Dispatch', 'Amity', 'Betty', 'Prudence', 'Content',
    ],
    military: [
      'HMS Diamond', 'HMS Scarborough', 'HMS Shoreham', 'HMS Pearl',
      'HMS Greyhound', 'HMS Flamborough', 'HMS Rose', 'HMS Seaford',
      'HMS Adventure', 'HMS Phoenix', 'HMS Milford', 'HMS Shark',
      'HMS Swallow', 'HMS Weymouth', 'HMS Lyme', 'HMS Happy Return',
      'HMS Experiment', 'HMS Guarland', 'HMS Ludlow Castle', 'HMS Success',
      'HMS Squirrel', 'HMS Drake', 'HMS Falcon', 'HMS Kinsale',
    ],
  },
  spanish: {
    trade: [
      'Santa Maria', 'San José', 'San Felipe', 'Nuestra Señora de la Merced',
      'El Salvador', 'Santiago', 'San Antonio', 'La Perla', 'Santa Rosa',
      'San Juan Bautista', 'La Concepción', 'San Francisco', 'Santa Ana',
      'La Trinidad', 'San Pedro', 'Santa Cruz', 'San Diego', 'La Esperanza',
      'San Cristóbal', 'Nuestra Señora del Rosario', 'El Buen Jesús',
      'San Martín', 'La Guadalupe', 'San Nicolás', 'Santa Isabel',
    ],
    military: [
      'San Martín', 'San Fernando', 'Nuestra Señora de la Concepción',
      'Princesa', 'Galicia', 'San Luis', 'El Fuerte', 'San Felipe',
      'Santa Catalina', 'San Andrés', 'El Glorioso', 'La Victoria',
      'San Isidro', 'El Conquistador', 'San Lorenzo', 'La Reina',
    ],
  },
  french: {
    trade: [
      'Le Soleil', 'La Fleur', "L'Espérance", 'La Victoire', 'Le Dauphin',
      'La Fortune', 'Le Comte', 'La Belle', 'Le Marchand', 'La Paix',
      "L'Aventure", 'Le Bon Voyage', 'La Liberté', "L'Aimable",
      'Le Prudent', 'La Concorde', 'Saint-Louis', 'La Reine', 'Le Juste',
      'La Marie', 'Le Chasseur', 'La Perle', 'Le Commerce',
    ],
    military: [
      'Le Héros', 'Le Tigre', 'Le Mars', "L'Aigle", 'Le Téméraire',
      'La Gloire', 'Le Foudroyant', "L'Intrépide", 'Le Tonnant',
      'Le Superbe', 'Le Brave', 'Le Redoutable', 'La Sirène',
    ],
  },
  dutch: {
    trade: [
      'De Liefde', 'Eendracht', 'Gouda', 'Zeeuwse Leeuw', 'Vliegende Draak',
      'Haarlem', 'Amsterdam', 'Batavia', 'Zeeland', 'Gelderland',
      'De Vergulde Draak', 'Wapen van Hoorn', 'De Hoop', 'Rijswijk',
      'Nijmegen', 'Utrecht', 'Delft', 'Dordrecht', 'De Eenhoorn',
      'De Vrede', 'Rotterdam', 'Leiden', 'Middelburg', 'De Ster',
    ],
    military: [
      'De Ruyter', 'Prins Willem', 'Zeven Provinciën', 'Witte Olifant',
      'Gelderland', 'Hollandia', 'Brederode', 'Eendracht',
    ],
  },
  pirate: {
    trade: [
      'Fortune', 'Rover', 'Ranger', 'Revenge', 'Adventure',
      'Happy Delivery', 'Liberty', 'Night Rambler', 'Bachelor\'s Delight',
      'Fancy', 'Speedy Return', 'Soldado', 'Speaker', 'Rising Sun',
    ],
    military: [
      'Queen Anne\'s Revenge', 'Whydah', 'Royal Fortune', 'Fancy',
      'Happy Return', 'Black Prince', 'Ranger', 'Good Fortune',
      'Flying Dragon', 'Night Rambler', 'Sudden Death', 'Delight',
    ],
  },
  portuguese: {
    trade: [
      'São João', 'Santa Maria', 'São Pedro', 'São Francisco',
      'Nossa Senhora da Graça', 'São Roque', 'São Sebastião',
      'Flor do Mar', 'São Gabriel', 'Esperança',
    ],
    military: [
      'São Martinho', 'São Filipe', 'São João Baptista',
      'Nossa Senhora dos Mártires', 'São Bento',
    ],
  },
};

// ============================================================
// Ship naming — nationality-aware, duplicate-proof
// ============================================================

function toRoman(n: number): string {
  const numerals: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let result = '';
  for (const [val, sym] of numerals) {
    while (n >= val) { result += sym; n -= val; }
  }
  return result;
}

/**
 * Pick a unique ship name appropriate to the nationality and role.
 * If the base name is already in use, appends II, III, etc.
 */
function pickUniqueName(nationality: string, role: string): string {
  const poolKey = role === 'military' ? 'military' : 'trade';
  const natPool = SHIP_NAME_POOLS[nationality] ?? SHIP_NAME_POOLS['english']!;
  const names = natPool[poolKey];

  // Try each name in the pool in random order
  const shuffled = [...names].sort(() => Math.random() - 0.5);

  for (const baseName of shuffled) {
    if (!activeShipNames.has(baseName)) {
      activeShipNames.add(baseName);
      return baseName;
    }
  }

  // All base names taken — find the lowest available numeral for a random name
  const baseName = shuffled[0]!;
  for (let n = 2; n <= 20; n++) {
    const numbered = `${baseName} ${toRoman(n)}`;
    if (!activeShipNames.has(numbered)) {
      activeShipNames.add(numbered);
      return numbered;
    }
  }

  // Fallback — uuid suffix (should never happen with 480 ships and hundreds of names)
  const fallback = `${baseName} ${uuid().slice(0, 4).toUpperCase()}`;
  activeShipNames.add(fallback);
  return fallback;
}

/**
 * Release a name back to the pool when a ship is sunk/retired.
 */
function releaseName(name: string): void {
  activeShipNames.delete(name);
}

/**
 * Pick the primary nationality for a spawn profile.
 * Weighted toward the first listed nationality.
 */
function pickNationality(profile: VesselSpawnProfile): string {
  const nats = profile.nationalities;
  if (nats.length === 0) return 'english';
  // 60% chance of first nationality, rest evenly split
  if (Math.random() < 0.6 || nats.length === 1) return nats[0]!;
  return nats[1 + Math.floor(Math.random() * (nats.length - 1))]!;
}

// ============================================================
// Condition calculation
// ============================================================

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(randRange(min, max + 1));
}

/**
 * Calculate spawn condition with shipyard quality bonus.
 * Better shipyards push condition toward the high end of the range.
 */
function calculateSpawnCondition(
  profile: VesselSpawnProfile,
  portId: string,
  isNewBuild: boolean,
): { hull: number; sails: number; barnacles: number; rot: number } {
  const port = ALL_PORTS[portId];
  const shipyardQuality = port?.shipyardQuality ?? 30;
  const cond = isNewBuild ? profile.newBuild : profile.used;

  // Shipyard quality (0-100) biases the roll toward the high end
  // quality 90 → bias 0.9 → picks from upper 90% of range
  // quality 20 → bias 0.2 → picks from full range (more low rolls)
  const qualityBias = shipyardQuality / 100;

  // Biased random: lerp between uniform and max, weighted by quality
  const hullRaw = randRange(cond.hullMin, cond.hullMax);
  const hull = Math.round(hullRaw + (cond.hullMax - hullRaw) * qualityBias * 0.4);

  const sailsRaw = randRange(cond.sailsMin, cond.sailsMax);
  const sails = Math.round(sailsRaw + (cond.sailsMax - sailsRaw) * qualityBias * 0.4);

  // Barnacles and rot — new builds are clean, used scale with how worn
  let barnacles: number;
  let rot: number;
  if (isNewBuild) {
    barnacles = 0;
    rot = 0;
  } else {
    // Worse condition → more barnacles/rot
    // Better shipyard → less (they cleaned it before selling)
    const wearFactor = (100 - hull) / 100;
    const cleanFactor = 1 - qualityBias * 0.5; // good yards clean 50% of potential grime
    barnacles = randInt(3, Math.round(40 * wearFactor * cleanFactor));
    rot = randInt(0, Math.round(25 * wearFactor * cleanFactor));
  }

  return {
    hull: Math.min(100, hull),
    sails: Math.min(100, sails),
    barnacles: Math.min(100, barnacles),
    rot: Math.min(100, rot),
  };
}

// ============================================================
// Spawn a single vessel
// ============================================================

function createShipFromProfile(
  profile: VesselSpawnProfile,
  portId: string,
  isNewBuild: boolean,
): Omit<Ship, 'created_at'> {
  const cls = SHIP_CLASSES[profile.shipClass];
  if (!cls) throw new Error(`Unknown ship class: ${profile.shipClass}`);

  const port = ALL_PORTS[portId];
  const seaZoneId = port?.seaZoneId ?? 'caribbean_deep_basin';

  const cond = calculateSpawnCondition(profile, portId, isNewBuild);
  const guns = Math.round(cls.maxGuns * profile.gunsFraction);
  const crewCount = Math.round(cls.crewMin + (cls.crewMax - cls.crewMin) * profile.crewFraction);
  const stores = profile.storesFraction;

  const nationality = pickNationality(profile);
  const name = pickUniqueName(nationality, profile.role);

  return {
    id: uuid(),
    name,
    class: profile.shipClass,
    captain_id: null,
    hull: cond.hull,
    sails: cond.sails,
    guns,
    max_guns: cls.maxGuns,
    crew_count: crewCount,
    crew_capacity: cls.crewMax,
    cargo_used: 0,
    cargo_capacity: cls.cargoCapacity,
    speed_base: cls.speed,
    maneuverability: cls.maneuverability,
    port_id: portId,
    sea_zone_id: seaZoneId,
    status: 'docked',
    current_zone_id: null,
    barnacle_level: cond.barnacles,
    rot_level: cond.rot,
    powder_stores: Math.round(100 * stores),
    food_stores: Math.round(100 * stores),
    water_stores: Math.round(100 * stores),
    destination_port_id: null,
    origin_port_id: null,
    arrival_tick: null,
    departure_tick: null,
  };
}

function pickSpawnPort(profile: VesselSpawnProfile, isNewBuild: boolean): string | null {
  if (isNewBuild) {
    // Pick from preferred ports that have sufficient shipyard quality
    const candidates = profile.preferredPorts.filter(pid => {
      const port = ALL_PORTS[pid];
      return port && port.shipyardQuality >= profile.minShipyardQuality;
    });
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)]!;
  } else {
    // Used: any preferred port
    if (profile.preferredPorts.length === 0) return null;
    return profile.preferredPorts[Math.floor(Math.random() * profile.preferredPorts.length)]!;
  }
}

// ============================================================
// Main tick function — called from economy-tick
// ============================================================

export interface VesselSpawnerResult {
  spawned: number;
  retired: number;
  replacementsQueued: number;
  totalManaged: number;
}

export async function tickVesselSpawner(tick: number): Promise<VesselSpawnerResult> {
  const result: VesselSpawnerResult = { spawned: 0, retired: 0, replacementsQueued: 0, totalManaged: 0 };

  // 1. Process pending replacements
  for (let i = pendingReplacements.length - 1; i >= 0; i--) {
    const pending = pendingReplacements[i]!;
    if (tick >= pending.spawnAtTick) {
      const profile = VESSEL_SPAWN_PROFILES[pending.profileId];
      if (profile) {
        const ship = createShipFromProfile(profile, pending.portId, false);
        await ShipQueries.insert(ship);
        trackShip(pending.profileId, ship.id);
        result.spawned++;
      }
      pendingReplacements.splice(i, 1);
    }
  }

  // 2. Prune managed ships — check for sunk/captured/retired via DB
  for (const [profileId, shipIds] of managedShips) {
    for (const shipId of shipIds) {
      const ship = await ShipQueries.getById(shipId);
      if (!ship || ship.status === 'sunk' || ship.status === 'captured') {
        shipIds.delete(shipId);
        if (ship) releaseName(ship.name);
        // Queue replacement
        const profile = VESSEL_SPAWN_PROFILES[profileId];
        if (profile) {
          const portId = ship?.port_id ?? pickSpawnPort(profile, true) ?? profile.preferredPorts[0] ?? 'port_royal';
          pendingReplacements.push({
            profileId,
            spawnAtTick: tick + profile.buildTimeTicks,
            portId,
          });
          result.replacementsQueued++;
        }
      } else if (ship.hull <= (VESSEL_SPAWN_PROFILES[profileId]?.retireHull ?? 15) ||
                 ship.barnacle_level >= (VESSEL_SPAWN_PROFILES[profileId]?.retireBarnacle ?? 80)) {
        // Retire — too degraded
        shipIds.delete(shipId);
        releaseName(ship.name);
        await ShipQueries.updateCondition(shipId, 0, 0, ship.barnacle_level, ship.rot_level);
        result.retired++;
        const profile = VESSEL_SPAWN_PROFILES[profileId];
        if (profile) {
          const portId = pickSpawnPort(profile, true) ?? profile.preferredPorts[0] ?? 'port_royal';
          pendingReplacements.push({
            profileId,
            spawnAtTick: tick + profile.usedAvailabilityTicks,
            portId,
          });
          result.replacementsQueued++;
        }
      }
    }
  }

  // 3. Spawn to meet caps
  for (const [profileId, profile] of Object.entries(VESSEL_SPAWN_PROFILES)) {
    const managed = managedShips.get(profileId)?.size ?? 0;
    const pending = pendingReplacements.filter(p => p.profileId === profileId).length;
    const deficit = profile.normalCap - managed - pending;

    for (let i = 0; i < deficit; i++) {
      const isNewBuild = Math.random() < 0.6;
      const portId = pickSpawnPort(profile, isNewBuild);
      if (!portId) continue;

      const ship = createShipFromProfile(profile, portId, isNewBuild);
      await ShipQueries.insert(ship);
      trackShip(profileId, ship.id);
      result.spawned++;
    }
  }

  // Count total
  for (const shipIds of managedShips.values()) {
    result.totalManaged += shipIds.size;
  }

  return result;
}

function trackShip(profileId: string, shipId: string): void {
  let set = managedShips.get(profileId);
  if (!set) {
    set = new Set();
    managedShips.set(profileId, set);
  }
  set.add(shipId);
}

// ============================================================
// Query API
// ============================================================

export function getManagedShipIds(profileId: string): string[] {
  return [...(managedShips.get(profileId) ?? [])];
}

export function getManagedCount(profileId: string): number {
  return managedShips.get(profileId)?.size ?? 0;
}

export function getTotalManagedCount(): number {
  let total = 0;
  for (const set of managedShips.values()) total += set.size;
  return total;
}

export function getActiveShipNames(): string[] {
  return [...activeShipNames];
}

// ============================================================
// NPC ship dispatch — sends docked NPC ships on trade voyages
// ============================================================

// Track NPC ships currently sailing (shipId → arrival tick estimate)
const npcSailing = new Set<string>();

/**
 * Dispatch a fraction of docked NPC ships to random destinations each tick.
 * Called from economy-tick alongside tickVesselSpawner.
 *
 * Returns the TravelState objects that must be registered with travel-tick's departShip().
 */
export async function dispatchNPCShips(
  tick: number,
  departShipFn: (shipId: string, travelState: any) => void,
): Promise<number> {
  // Only dispatch every 6 ticks (6 game hours) to avoid flooding
  if (tick % 6 !== 0) return 0;

  // Get all docked NPC ships (captain_id IS NULL)
  const allShips = await ShipQueries.getAllActive();
  const dockedNPC = allShips.filter(
    s => s.status === 'docked' && !s.captain_id && s.port_id && !npcSailing.has(s.id) && s.hull > 20,
  );

  if (dockedNPC.length === 0) return 0;

  // Dispatch ~15% of docked NPC ships per cycle (creates busy sea lanes)
  const dispatchCount = Math.max(2, Math.floor(dockedNPC.length * 0.15));
  const shuffled = dockedNPC.sort(() => Math.random() - 0.5).slice(0, dispatchCount);

  let dispatched = 0;

  for (const ship of shuffled) {
    if (!ship.port_id) continue;

    // Pick a random destination from available routes
    const routes = getRoutesFromPort(ship.port_id);
    if (routes.length === 0) continue;

    const route = routes[Math.floor(Math.random() * routes.length)]!;
    const dest = route.to;
    if (dest === ship.port_id) continue;

    // Build voyage
    const voyage = buildSeaVoyage(ship.id, ship.port_id, dest, ship.speed_base, tick);
    if (!voyage) continue;

    // Load cargo from port before departure (NPC trade goods)
    // Historical: merchant ships NEVER sailed empty — cargo was the whole point
    const supplies = getPortSupplies(ship.port_id);
    const cargoTypes = Object.entries(supplies).filter(([type, qty]) => qty >= 3 && type !== 'coins');
    let cargoLoaded = false;
    if (cargoTypes.length > 0) {
      // Pick 1-3 cargo types, load up to 60% of capacity
      const picks = cargoTypes.sort(() => Math.random() - 0.5).slice(0, Math.min(3, cargoTypes.length));
      let spaceLeft = Math.floor(ship.cargo_capacity * 0.6);
      for (const [cargoType, available] of picks) {
        if (spaceLeft <= 0) break;
        // Take at most 15% of supply, and never drop port below 20 units
        const takeableSupply = Math.max(0, available - 20);
        const loadQty = Math.min(Math.floor(takeableSupply * 0.15), spaceLeft, 50);
        if (loadQty < 2) continue;
        removeSupply(ship.port_id, cargoType, loadQty);
        await CargoQueries.insert({
          id: uuid(),
          type: cargoType,
          quantity: loadQty,
          ship_id: ship.id,
          port_id: null,
          owner_agent_id: null,
          heat: 0,
          seized_from: null,
          origin_port_id: ship.port_id,
          heat_decay_rate: 0.5,
        });
        spaceLeft -= loadQty;
        cargoLoaded = true;
      }
    }
    // Don't dispatch empty ships — no merchant sails without cargo
    if (!cargoLoaded) continue;

    // Set ship to sailing — updateStatusFull(id, status, portId, destinationPortId)
    await ShipQueries.updateStatusFull(ship.id, 'sailing', null, dest);
    // updateVoyageInfo(id, originPortId, departureTick)
    await ShipQueries.updateVoyageInfo(ship.id, ship.port_id, tick);
    // Set sea_zone_id to departure port's zone so ship is findable in encounter/combat queries
    const departureZone = voyage.waypoints[0] ?? ship.sea_zone_id;
    if (departureZone) {
      await ShipQueries.updateTravel(ship.id, departureZone, departureZone, voyage.estimatedArrivalTick);
    }

    // Register with travel-tick
    departShipFn(ship.id, voyage);
    npcSailing.add(ship.id);
    dispatched++;
  }

  return dispatched;
}

/** Called when an NPC ship arrives (by travel-tick) to remove from sailing set. */
export function markNPCShipArrived(shipId: string): void {
  npcSailing.delete(shipId);
}

export function resetVesselSpawner(): void {
  managedShips.clear();
  pendingReplacements.length = 0;
  activeShipNames.clear();
  npcSailing.clear();
}

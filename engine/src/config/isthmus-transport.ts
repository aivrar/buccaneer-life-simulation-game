/**
 * Isthmus Transport Config — mule trains and river canoes
 * crossing the Panama isthmus between Portobelo and Panama City.
 *
 * These are economy-regulated disposable transports: they degrade,
 * deliver cargo, and get replaced by the spawner when spent or lost.
 */

import { isFairActive } from './treasure-fleets.js';

// ============================================================
// Transport type definitions
// ============================================================

export type TransportType = 'mule_train' | 'river_canoe';

export type TransportStatus = 'loading' | 'in_transit' | 'arrived' | 'unloading' | 'returning' | 'destroyed' | 'captured';

export interface TransportTypeConfig {
  type: TransportType;
  name: string;
  routeId: string;
  travelTicks: number;            // base travel time in ticks
  cargoCapacityBase: number;      // at condition 100
  conditionDegradePerTick: number;// base degradation while in transit
  stormDegradeMultiplier: number; // extra degradation in bad weather
  loadingTicks: number;           // ticks spent loading before departure
  unloadingTicks: number;         // ticks spent unloading at destination
  replacementDelayTicks: number;  // ticks before a lost transport is replaced
  retireThreshold: number;        // condition at or below which transport is retired
  crewSlots: number;              // agent slots available
  description: string;
}

export const TRANSPORT_TYPES: Record<TransportType, TransportTypeConfig> = {
  mule_train: {
    type: 'mule_train',
    name: 'Mule Train',
    routeId: 'camino_real',
    travelTicks: 16,              // 4 days × 4 ticks/day
    cargoCapacityBase: 40,        // ~40 mules, 1 unit per mule
    conditionDegradePerTick: 1.0,
    stormDegradeMultiplier: 2.0,
    loadingTicks: 2,
    unloadingTicks: 2,
    replacementDelayTicks: 6,     // ~1.5 days to organize a new train
    retireThreshold: 20,
    crewSlots: 4,                 // arriero, 2 guards, 1 passenger
    description: 'A recua of mules loaded with silver bars, each mule carrying ~300 lbs. Led by an arriero with armed guards. The Camino Real is stone-paved but only 4 feet wide — single file through jungle passes.',
  },
  river_canoe: {
    type: 'river_canoe',
    name: 'River Canoe (Bongo)',
    routeId: 'chagres_river_route',
    travelTicks: 12,              // 3 days × 4 ticks/day
    cargoCapacityBase: 20,        // dugout canoe, smaller loads
    conditionDegradePerTick: 0.5,
    stormDegradeMultiplier: 4.0,  // river flooding is brutal
    loadingTicks: 1,
    unloadingTicks: 1,
    replacementDelayTicks: 4,     // easier to replace than a mule train
    retireThreshold: 15,
    crewSlots: 3,                 // bongero, 1 guard, 1 passenger
    description: 'A bongo — large dugout canoe paddled by indigenous boatmen up the Chagres River to Cruces, then cargo transfers to mules for the short overland leg to Panama City. Faster than the Camino Real but carries less.',
  },
};

// ============================================================
// Capacity caps — how many active per route, driven by economy
// ============================================================

export interface TransportCapConfig {
  normalCap: number;
  fairCap: number;
  // Passable months — null means year-round
  passableMonths: number[] | null;
}

export const TRANSPORT_CAPS: Record<TransportType, TransportCapConfig> = {
  mule_train: {
    normalCap: 3,
    fairCap: 12,
    passableMonths: [12, 1, 2, 3, 4],  // impassable rainy season May-Nov
  },
  river_canoe: {
    normalCap: 2,
    fairCap: 8,
    passableMonths: null,               // year-round, but degrades faster in rain
  },
};

export function getTransportCap(type: TransportType, month: number): number {
  const cap = TRANSPORT_CAPS[type];

  // Check passability — no spawns during impassable months
  if (cap.passableMonths && !cap.passableMonths.includes(month)) {
    return 0;
  }

  return isFairActive(month) ? cap.fairCap : cap.normalCap;
}

// ============================================================
// Spawn condition ranges — what condition new transports get
// ============================================================

export interface SpawnConditionRange {
  min: number;
  max: number;
}

export function getSpawnCondition(type: TransportType, month: number, isReplacement: boolean): number {
  let range: SpawnConditionRange;

  if (isFairActive(month)) {
    // Fair season: best equipment
    range = { min: 85, max: 100 };
  } else if (type === 'river_canoe' && (month >= 5 && month <= 11)) {
    // Rainy season canoes: rougher shape
    range = { min: 40, max: 60 };
  } else {
    // Normal season
    range = { min: 50, max: 75 };
  }

  // Replacements come in worse — the good stock was already committed
  if (isReplacement) {
    range = { min: Math.max(25, range.min - 15), max: range.max - 10 };
  }

  return range.min + Math.random() * (range.max - range.min);
}

// ============================================================
// Cargo templates — what gets loaded based on direction + season
// ============================================================

export type TransportDirection = 'eastbound' | 'westbound';

export interface CargoTemplate {
  cargo: Record<string, number>;  // cargoType → quantity (scaled by capacity)
}

// Eastbound = Panama City → Portobelo (treasure)
// Westbound = Portobelo → Panama City (European goods)
export function getCargoTemplate(direction: TransportDirection, month: number): Record<string, number> {
  if (direction === 'eastbound') {
    if (isFairActive(month)) {
      // Fair: heavy silver loads
      return { silver: 0.6, gold: 0.15, emeralds: 0.05, cacao: 0.1, cochineal: 0.1 };
    }
    // Normal: routine commerce
    return { silver: 0.3, cacao: 0.3, cochineal: 0.2, spices: 0.2 };
  } else {
    if (isFairActive(month)) {
      // Fair: European manufactured goods heading to Peru
      return { textiles: 0.3, iron_bars: 0.2, wine: 0.15, provisions: 0.15, gunpowder: 0.1, muskets: 0.1 };
    }
    return { textiles: 0.3, provisions: 0.3, wine: 0.2, iron_bars: 0.2 };
  }
}

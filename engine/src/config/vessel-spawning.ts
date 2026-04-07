/**
 * Vessel Spawning Config — defines fleet caps, spawn sources, condition
 * ranges, and roles for all ship types in the simulation.
 *
 * The spawner uses this to maintain historically accurate fleet numbers.
 * Vessels are full Ship DB entities — they can be attacked, captured, traded.
 */

import type { ShipClassName } from '../db/models.js';

// ============================================================
// Vessel role — determines spawn loadout (guns vs cargo)
// ============================================================

export type VesselRole = 'trade' | 'military' | 'utility' | 'slave_trade';

// ============================================================
// Spawn profile — one per ship class
// ============================================================

export interface VesselSpawnProfile {
  shipClass: ShipClassName;
  role: VesselRole;
  nationalities: string[];          // which nations operate this type

  // Fleet caps — how many should exist in the simulation
  normalCap: number;
  wartimeCap: number;               // future: increased military in wartime

  // Where new vessels come from
  minShipyardQuality: number;       // minimum port shipyardQuality to build new
  buildTimeTicks: number;           // ticks to produce a new-build replacement
  usedAvailabilityTicks: number;    // ticks until a used replacement appears

  // Condition at spawn — new builds vs used
  newBuild: { hullMin: number; hullMax: number; sailsMin: number; sailsMax: number };
  used: { hullMin: number; hullMax: number; sailsMin: number; sailsMax: number };

  // Spawn loadout: fraction of max capacity
  gunsFraction: number;             // what fraction of maxGuns to mount
  crewFraction: number;             // what fraction of crewMax to staff
  storesFraction: number;           // food/water/powder fill level (0-1)

  // Retirement
  retireHull: number;               // despawn when hull drops below this
  retireBarnacle: number;           // despawn when barnacles exceed this

  // Where this type typically spawns (weighted toward these ports)
  preferredPorts: string[];
}

// ============================================================
// All spawn profiles
// ============================================================

export const VESSEL_SPAWN_PROFILES: Record<string, VesselSpawnProfile> = {

  // ─── COASTAL / UTILITY ───────────────────────────────────

  periagua: {
    shipClass: 'periagua',
    role: 'utility',
    nationalities: ['english', 'spanish', 'french', 'dutch', 'pirate'],
    normalCap: 60,
    wartimeCap: 60,
    minShipyardQuality: 10,
    buildTimeTicks: 4,
    usedAvailabilityTicks: 2,
    newBuild: { hullMin: 80, hullMax: 100, sailsMin: 85, sailsMax: 100 },
    used: { hullMin: 40, hullMax: 70, sailsMin: 45, sailsMax: 75 },
    gunsFraction: 0.5,
    crewFraction: 0.6,
    storesFraction: 0.5,
    retireHull: 10,
    retireBarnacle: 80,
    preferredPorts: ['port_royal', 'havana', 'bridgetown', 'nassau', 'tortuga', 'petit_goave', 'basseterre', 'santo_domingo', 'willemstad'],
  },

  shallop: {
    shipClass: 'shallop',
    role: 'utility',
    nationalities: ['english', 'spanish', 'french', 'dutch'],
    normalCap: 50,
    wartimeCap: 50,
    minShipyardQuality: 10,
    buildTimeTicks: 2,
    usedAvailabilityTicks: 1,
    newBuild: { hullMin: 80, hullMax: 100, sailsMin: 85, sailsMax: 100 },
    used: { hullMin: 35, hullMax: 65, sailsMin: 40, sailsMax: 70 },
    gunsFraction: 0,
    crewFraction: 0.5,
    storesFraction: 0.3,
    retireHull: 10,
    retireBarnacle: 70,
    preferredPorts: ['port_royal', 'havana', 'bridgetown', 'boston', 'charles_town', 'basseterre', 'willemstad', 'cartagena'],
  },

  droger: {
    shipClass: 'droger',
    role: 'trade',
    nationalities: ['english', 'spanish', 'french', 'dutch'],
    normalCap: 40,
    wartimeCap: 35,
    minShipyardQuality: 20,
    buildTimeTicks: 8,
    usedAvailabilityTicks: 4,
    newBuild: { hullMin: 80, hullMax: 100, sailsMin: 85, sailsMax: 100 },
    used: { hullMin: 40, hullMax: 70, sailsMin: 45, sailsMax: 75 },
    gunsFraction: 0.5,
    crewFraction: 0.5,
    storesFraction: 0.5,
    retireHull: 15,
    retireBarnacle: 75,
    preferredPorts: ['bridgetown', 'basseterre', 'port_royal', 'havana', 'santo_domingo', 'petit_goave', 'willemstad'],
  },

  // ─── REGIONAL TRADERS ────────────────────────────────────

  trading_sloop: {
    shipClass: 'sloop',
    role: 'trade',
    nationalities: ['english', 'spanish', 'french', 'dutch'],
    normalCap: 100,
    wartimeCap: 80,
    minShipyardQuality: 35,
    buildTimeTicks: 16,
    usedAvailabilityTicks: 6,
    newBuild: { hullMin: 85, hullMax: 100, sailsMin: 85, sailsMax: 100 },
    used: { hullMin: 45, hullMax: 75, sailsMin: 50, sailsMax: 80 },
    gunsFraction: 0.25,          // Historical: pair of swivel guns, not full broadside
    crewFraction: 0.15,          // Historical: 20-25 working sailors, not fighting crew
    storesFraction: 0.7,
    retireHull: 20,
    retireBarnacle: 70,
    preferredPorts: ['port_royal', 'bridgetown', 'boston', 'charles_town', 'havana', 'willemstad', 'basseterre', 'petit_goave'],
  },

  trading_schooner: {
    shipClass: 'schooner',
    role: 'trade',
    nationalities: ['english', 'dutch', 'french'],
    normalCap: 30,
    wartimeCap: 25,
    minShipyardQuality: 40,
    buildTimeTicks: 20,
    usedAvailabilityTicks: 8,
    newBuild: { hullMin: 85, hullMax: 100, sailsMin: 85, sailsMax: 100 },
    used: { hullMin: 45, hullMax: 75, sailsMin: 50, sailsMax: 80 },
    gunsFraction: 0.3,           // Historical: light defense, 3-4 guns
    crewFraction: 0.2,           // Historical: ~32 crew for a fast trader
    storesFraction: 0.7,
    retireHull: 20,
    retireBarnacle: 70,
    preferredPorts: ['boston', 'charles_town', 'port_royal', 'bridgetown', 'willemstad'],
  },

  bark: {
    shipClass: 'bark',
    role: 'trade',
    nationalities: ['english', 'french', 'spanish', 'dutch'],
    normalCap: 40,
    wartimeCap: 35,
    minShipyardQuality: 45,
    buildTimeTicks: 24,
    usedAvailabilityTicks: 10,
    newBuild: { hullMin: 85, hullMax: 100, sailsMin: 85, sailsMax: 100 },
    used: { hullMin: 45, hullMax: 75, sailsMin: 50, sailsMax: 80 },
    gunsFraction: 0.35,          // Historical: some armament for longer inter-island routes
    crewFraction: 0.25,          // Historical: ~39 crew
    storesFraction: 0.8,
    retireHull: 20,
    retireBarnacle: 65,
    preferredPorts: ['boston', 'charles_town', 'port_royal', 'bridgetown', 'havana', 'cartagena'],
  },

  // ─── TRANSATLANTIC / HEAVY TRADE ─────────────────────────

  fluyt: {
    shipClass: 'fluyt',
    role: 'trade',
    nationalities: ['dutch'],
    normalCap: 12,
    wartimeCap: 8,
    minShipyardQuality: 70,
    buildTimeTicks: 40,
    usedAvailabilityTicks: 16,
    newBuild: { hullMin: 90, hullMax: 100, sailsMin: 90, sailsMax: 100 },
    used: { hullMin: 50, hullMax: 75, sailsMin: 55, sailsMax: 80 },
    gunsFraction: 0.2,           // Historical: Dutch design prioritized cargo over guns — nearly defenseless
    crewFraction: 0.3,           // Historical: ~23 crew — Dutch efficiency, minimal manning
    storesFraction: 0.9,
    retireHull: 25,
    retireBarnacle: 60,
    preferredPorts: ['amsterdam', 'willemstad'],
  },

  merchantman: {
    shipClass: 'merchantman',
    role: 'trade',
    nationalities: ['english', 'french'],
    normalCap: 40,
    wartimeCap: 30,
    minShipyardQuality: 55,
    buildTimeTicks: 32,
    usedAvailabilityTicks: 12,
    newBuild: { hullMin: 85, hullMax: 100, sailsMin: 85, sailsMax: 100 },
    used: { hullMin: 45, hullMax: 75, sailsMin: 50, sailsMax: 80 },
    gunsFraction: 0.4,           // Historical: mounted fewer guns than max to save weight for cargo
    crewFraction: 0.3,           // Historical: ~55 crew — enough to sail but not fight effectively
    storesFraction: 0.8,
    retireHull: 25,
    retireBarnacle: 60,
    preferredPorts: ['london', 'boston', 'port_royal', 'bridgetown', 'charles_town'],
  },

  galleon: {
    shipClass: 'galleon',
    role: 'trade',
    nationalities: ['spanish'],
    normalCap: 8,
    wartimeCap: 5,
    minShipyardQuality: 65,
    buildTimeTicks: 60,
    usedAvailabilityTicks: 24,
    newBuild: { hullMin: 90, hullMax: 100, sailsMin: 90, sailsMax: 100 },
    used: { hullMin: 50, hullMax: 75, sailsMin: 55, sailsMax: 80 },
    gunsFraction: 0.7,
    crewFraction: 0.6,
    storesFraction: 0.9,
    retireHull: 30,
    retireBarnacle: 55,
    preferredPorts: ['havana', 'seville_cadiz', 'cartagena', 'veracruz'],
  },

  guineaman: {
    shipClass: 'guineaman',
    role: 'slave_trade',
    nationalities: ['english', 'dutch', 'french', 'portuguese'],
    normalCap: 12,
    wartimeCap: 8,
    minShipyardQuality: 50,
    buildTimeTicks: 28,
    usedAvailabilityTicks: 12,
    newBuild: { hullMin: 80, hullMax: 100, sailsMin: 80, sailsMax: 100 },
    used: { hullMin: 40, hullMax: 70, sailsMin: 45, sailsMax: 75 },
    gunsFraction: 0.5,
    crewFraction: 0.6,
    storesFraction: 0.8,
    retireHull: 20,
    retireBarnacle: 65,
    preferredPorts: ['london', 'amsterdam', 'cape_coast_castle', 'elmina', 'whydah'],
  },

  east_indiaman: {
    shipClass: 'east_indiaman',
    role: 'trade',
    nationalities: ['english', 'dutch'],
    normalCap: 3,
    wartimeCap: 2,
    minShipyardQuality: 80,
    buildTimeTicks: 80,
    usedAvailabilityTicks: 40,
    newBuild: { hullMin: 90, hullMax: 100, sailsMin: 90, sailsMax: 100 },
    used: { hullMin: 55, hullMax: 80, sailsMin: 60, sailsMax: 85 },
    gunsFraction: 0.7,
    crewFraction: 0.6,
    storesFraction: 0.9,
    retireHull: 30,
    retireBarnacle: 50,
    preferredPorts: ['london', 'amsterdam'],
  },

  // ─── MILITARY ─────────────────────────────────────────────

  guardacosta_galley: {
    shipClass: 'galley',
    role: 'military',
    nationalities: ['spanish'],
    normalCap: 10,
    wartimeCap: 16,
    minShipyardQuality: 40,
    buildTimeTicks: 20,
    usedAvailabilityTicks: 8,
    newBuild: { hullMin: 85, hullMax: 100, sailsMin: 80, sailsMax: 95 },
    used: { hullMin: 45, hullMax: 70, sailsMin: 40, sailsMax: 70 },
    gunsFraction: 0.8,
    crewFraction: 0.8,   // galleys need full oar benches to function
    storesFraction: 0.7, // short range — don't carry much
    retireHull: 20,
    retireBarnacle: 70,
    preferredPorts: ['havana', 'cartagena', 'santo_domingo', 'veracruz', 'portobelo', 'seville_cadiz'],
  },

  pirate_galley: {
    shipClass: 'galley',
    role: 'military',
    nationalities: ['pirate'],
    normalCap: 4,
    wartimeCap: 4,
    minShipyardQuality: 20,
    buildTimeTicks: 16,
    usedAvailabilityTicks: 6,
    newBuild: { hullMin: 70, hullMax: 90, sailsMin: 65, sailsMax: 85 },
    used: { hullMin: 35, hullMax: 60, sailsMin: 35, sailsMax: 60 },
    gunsFraction: 0.7,
    crewFraction: 0.9,   // pirates pack crews in for boarding
    storesFraction: 0.5,
    retireHull: 15,
    retireBarnacle: 75,
    preferredPorts: ['nassau', 'tortuga', 'petit_goave'],
  },

  packet_boat_english: {
    shipClass: 'packet_boat',
    role: 'military',
    nationalities: ['english'],
    normalCap: 6,
    wartimeCap: 10,
    minShipyardQuality: 40,
    buildTimeTicks: 12,
    usedAvailabilityTicks: 5,
    newBuild: { hullMin: 85, hullMax: 100, sailsMin: 90, sailsMax: 100 },
    used: { hullMin: 50, hullMax: 75, sailsMin: 55, sailsMax: 80 },
    gunsFraction: 0.5,
    crewFraction: 0.6,
    storesFraction: 0.8,
    retireHull: 20,
    retireBarnacle: 65,
    preferredPorts: ['port_royal', 'boston', 'bridgetown', 'charles_town', 'london'],
  },

  packet_boat_spanish: {
    shipClass: 'packet_boat',
    role: 'military',
    nationalities: ['spanish'],
    normalCap: 4,
    wartimeCap: 8,
    minShipyardQuality: 40,
    buildTimeTicks: 12,
    usedAvailabilityTicks: 5,
    newBuild: { hullMin: 85, hullMax: 100, sailsMin: 90, sailsMax: 100 },
    used: { hullMin: 50, hullMax: 75, sailsMin: 55, sailsMax: 80 },
    gunsFraction: 0.5,
    crewFraction: 0.6,
    storesFraction: 0.8,
    retireHull: 20,
    retireBarnacle: 65,
    preferredPorts: ['havana', 'cartagena', 'veracruz', 'seville_cadiz'],
  },

  packet_boat_french: {
    shipClass: 'packet_boat',
    role: 'military',
    nationalities: ['french'],
    normalCap: 3,
    wartimeCap: 6,
    minShipyardQuality: 40,
    buildTimeTicks: 12,
    usedAvailabilityTicks: 5,
    newBuild: { hullMin: 85, hullMax: 100, sailsMin: 90, sailsMax: 100 },
    used: { hullMin: 50, hullMax: 75, sailsMin: 55, sailsMax: 80 },
    gunsFraction: 0.5,
    crewFraction: 0.6,
    storesFraction: 0.8,
    retireHull: 20,
    retireBarnacle: 65,
    preferredPorts: ['petit_goave', 'tortuga'],
  },

  naval_sloop: {
    shipClass: 'sloop',
    role: 'military',
    nationalities: ['english', 'spanish', 'french', 'dutch'],
    normalCap: 20,
    wartimeCap: 30,
    minShipyardQuality: 40,
    buildTimeTicks: 16,
    usedAvailabilityTicks: 6,
    newBuild: { hullMin: 90, hullMax: 100, sailsMin: 90, sailsMax: 100 },
    used: { hullMin: 55, hullMax: 80, sailsMin: 60, sailsMax: 85 },
    gunsFraction: 0.9,
    crewFraction: 0.7,
    storesFraction: 0.9,
    retireHull: 25,
    retireBarnacle: 60,
    preferredPorts: ['port_royal', 'havana', 'boston', 'bridgetown', 'cartagena'],
  },

  naval_brigantine: {
    shipClass: 'brigantine',
    role: 'military',
    nationalities: ['english', 'spanish', 'french'],
    normalCap: 15,
    wartimeCap: 25,
    minShipyardQuality: 50,
    buildTimeTicks: 24,
    usedAvailabilityTicks: 10,
    newBuild: { hullMin: 90, hullMax: 100, sailsMin: 90, sailsMax: 100 },
    used: { hullMin: 55, hullMax: 80, sailsMin: 60, sailsMax: 85 },
    gunsFraction: 0.8,
    crewFraction: 0.7,
    storesFraction: 0.9,
    retireHull: 25,
    retireBarnacle: 60,
    preferredPorts: ['port_royal', 'havana', 'cartagena', 'boston'],
  },

  naval_brig: {
    shipClass: 'brig',
    role: 'military',
    nationalities: ['english', 'spanish', 'french'],
    normalCap: 12,
    wartimeCap: 20,
    minShipyardQuality: 55,
    buildTimeTicks: 28,
    usedAvailabilityTicks: 12,
    newBuild: { hullMin: 90, hullMax: 100, sailsMin: 90, sailsMax: 100 },
    used: { hullMin: 55, hullMax: 80, sailsMin: 60, sailsMax: 85 },
    gunsFraction: 0.85,
    crewFraction: 0.7,
    storesFraction: 0.9,
    retireHull: 25,
    retireBarnacle: 60,
    preferredPorts: ['port_royal', 'havana', 'cartagena', 'london', 'seville_cadiz'],
  },

  frigate_patrol: {
    shipClass: 'frigate',
    role: 'military',
    nationalities: ['english', 'spanish', 'french'],
    normalCap: 8,
    wartimeCap: 14,
    minShipyardQuality: 70,
    buildTimeTicks: 48,
    usedAvailabilityTicks: 20,
    newBuild: { hullMin: 90, hullMax: 100, sailsMin: 90, sailsMax: 100 },
    used: { hullMin: 60, hullMax: 85, sailsMin: 65, sailsMax: 90 },
    gunsFraction: 0.9,
    crewFraction: 0.75,
    storesFraction: 0.95,
    retireHull: 30,
    retireBarnacle: 55,
    preferredPorts: ['port_royal', 'havana', 'cartagena', 'london', 'seville_cadiz'],
  },

  man_of_war_station: {
    shipClass: 'man_of_war',
    role: 'military',
    nationalities: ['english', 'spanish', 'french'],
    normalCap: 3,
    wartimeCap: 8,
    minShipyardQuality: 80,
    buildTimeTicks: 80,
    usedAvailabilityTicks: 40,
    newBuild: { hullMin: 95, hullMax: 100, sailsMin: 95, sailsMax: 100 },
    used: { hullMin: 65, hullMax: 85, sailsMin: 70, sailsMax: 90 },
    gunsFraction: 0.95,
    crewFraction: 0.8,
    storesFraction: 0.95,
    retireHull: 35,
    retireBarnacle: 50,
    preferredPorts: ['port_royal', 'havana', 'london', 'seville_cadiz'],
  },
};

// Total normal fleet:
//   Trade:    60+50+40+100+30+40+12+40+8+12+3 = 395
//   Military: 10+4+6+4+3+20+15+12+8+3 = 85
//   Grand total: ~480 vessels
// Historically reasonable for the Caribbean basin circa 1715.

// ============================================================
// Shipyard capability — which classes a port can build
// ============================================================

export function canPortBuild(portId: string, shipyardQuality: number, profile: VesselSpawnProfile): boolean {
  return shipyardQuality >= profile.minShipyardQuality;
}

/**
 * Get all profiles that a port with given shipyard quality can build.
 */
export function getBuildableProfiles(shipyardQuality: number): VesselSpawnProfile[] {
  return Object.values(VESSEL_SPAWN_PROFILES).filter(p => shipyardQuality >= p.minShipyardQuality);
}

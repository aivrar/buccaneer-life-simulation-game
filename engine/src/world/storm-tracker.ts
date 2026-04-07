// Storm tracker engine — manages hurricane and weather event lifecycles
// Historically accurate Caribbean hurricane simulation for 1715-1725

import type { GameTime, ActiveStorm, WeatherEventInstance } from '../runtime/types.js';
import { WeatherEventType } from '../runtime/types.js';
import { hurricaneSeasonCurve } from './time.js';
import { STORM_NAMES, HURRICANE_TRACKS, ZONE_CATEGORY_MODIFIERS } from '../config/hurricane-tracks.js';
import { WEATHER_EVENT_CONFIGS } from '../config/weather-events.js';
import { SEA_ZONE_DEFINITIONS } from '../config/regions.js';

// In-memory state
const activeStorms = new Map<string, ActiveStorm>();
const activeWeatherEvents = new Map<string, WeatherEventInstance>();
let stormCounter = 0;
let eventCounter = 0;
let usedNamesThisYear: Set<string> = new Set();
let currentYear = 0;

export interface StormUpdate {
  type: 'storm_spawned' | 'storm_entered_zone' | 'storm_intensified' | 'storm_weakened' | 'storm_dissipated';
  storm: ActiveStorm;
  zoneId: string;
  category: number;
}

export interface EventUpdate {
  type: 'event_started' | 'event_ended';
  event: WeatherEventInstance;
}

function pickWeightedTrack(): typeof HURRICANE_TRACKS[number] {
  const totalWeight = HURRICANE_TRACKS.reduce((sum, t) => sum + t.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const track of HURRICANE_TRACKS) {
    roll -= track.weight;
    if (roll <= 0) return track;
  }
  return HURRICANE_TRACKS[0]!;
}

function pickCategory(minCat: number, maxCat: number): number {
  // 70% Cat 1-2, 25% Cat 3, 5% Cat 4-5
  const roll = Math.random();
  if (roll < 0.70) {
    return Math.min(minCat + Math.floor(Math.random() * 2), maxCat);
  } else if (roll < 0.95) {
    return Math.min(3, maxCat);
  } else {
    return Math.min(4 + Math.floor(Math.random() * 2), maxCat);
  }
}

function pickStormName(year: number): string {
  if (year !== currentYear) {
    currentYear = year;
    usedNamesThisYear = new Set();
  }
  const available = STORM_NAMES.filter(n => !usedNamesThisYear.has(n));
  if (available.length === 0) {
    return `Storm of ${year}`;
  }
  const name = available[Math.floor(Math.random() * available.length)]!;
  usedNamesThisYear.add(name);
  return name;
}

export function maybeSpawnHurricane(gameTime: GameTime): StormUpdate | null {
  const curve = hurricaneSeasonCurve(gameTime.month, gameTime.day);
  if (curve <= 0) return null;

  // Target ~2 hurricanes/year. With 4 checks/day over ~180-day season (720 checks),
  // base rate tuned so: baseRate * sum(curve over season) ≈ 2
  // Average curve value during season ≈ 0.12, so 720 * 0.12 * baseRate ≈ 2
  // baseRate ≈ 2 / 86.4 ≈ 0.023
  const baseRate = 0.023;
  const spawnChance = curve * baseRate;

  if (Math.random() > spawnChance) return null;

  const track = pickWeightedTrack();
  const category = pickCategory(track.minCategory, track.maxCategory);
  const name = pickStormName(gameTime.year);

  stormCounter++;
  const id = `storm_${gameTime.year}_${stormCounter}`;

  const storm: ActiveStorm = {
    id,
    name,
    type: category >= 1 ? WeatherEventType.HURRICANE : WeatherEventType.TROPICAL_STORM,
    category,
    currentZoneId: track.zoneIds[0]!,
    trackZoneIds: track.zoneIds,
    trackIndex: 0,
    spawnTick: gameTime.ticksElapsed,
    ticksInCurrentZone: 0,
    ticksPerZone: 3 + Math.floor(Math.random() * 3), // 3-5 ticks per zone
    peakCategory: category,
    dissipating: false,
  };

  activeStorms.set(id, storm);

  return {
    type: 'storm_spawned',
    storm: { ...storm },
    zoneId: storm.currentZoneId,
    category: storm.category,
  };
}

export function maybeSpawnWeatherEvent(gameTime: GameTime): EventUpdate[] {
  const updates: EventUpdate[] = [];

  for (const config of WEATHER_EVENT_CONFIGS) {
    if (!config.months.includes(gameTime.month)) continue;

    // Check hour range for time-specific events
    if (config.hourRange) {
      if (gameTime.hour < config.hourRange[0] || gameTime.hour > config.hourRange[1]) continue;
    }

    // 4 checks per day — divide daily chance by 4
    const checkChance = config.chancePerDay / 4;
    if (Math.random() > checkChance) continue;

    // Only one event of each type per zone at a time
    for (const zoneId of config.zones) {
      const alreadyActive = Array.from(activeWeatherEvents.values()).some(
        e => e.type === config.type && e.affectedZoneIds.includes(zoneId)
      );
      if (alreadyActive) continue;

      eventCounter++;
      const id = `event_${eventCounter}`;
      const duration = config.durationMin + Math.floor(Math.random() * (config.durationMax - config.durationMin + 1));

      const event: WeatherEventInstance = {
        id,
        type: config.type,
        affectedZoneIds: [zoneId],
        startTick: gameTime.ticksElapsed,
        remainingTicks: duration,
        windSpeed: config.windSpeedMin + Math.random() * (config.windSpeedMax - config.windSpeedMin),
        windDirection: config.windDirection ?? Math.floor(Math.random() * 360),
        visibility: config.visibility,
        tempModF: config.tempModF,
      };

      activeWeatherEvents.set(id, event);
      updates.push({ type: 'event_started', event: { ...event } });
      break; // one spawn per config per tick
    }
  }

  return updates;
}

export function advanceStorms(gameTime: GameTime): StormUpdate[] {
  const updates: StormUpdate[] = [];

  for (const [id, storm] of activeStorms) {
    storm.ticksInCurrentZone++;

    if (storm.ticksInCurrentZone >= storm.ticksPerZone) {
      // Advance to next zone in track
      storm.trackIndex++;

      if (storm.trackIndex >= storm.trackZoneIds.length || storm.category <= 0) {
        // End of track or fully dissipated
        storm.dissipating = true;
        activeStorms.delete(id);
        updates.push({
          type: 'storm_dissipated',
          storm: { ...storm },
          zoneId: storm.currentZoneId,
          category: storm.category,
        });
        continue;
      }

      const nextZoneId = storm.trackZoneIds[storm.trackIndex]!;
      const nextZone = SEA_ZONE_DEFINITIONS[nextZoneId];

      // Check if next zone can't have hurricanes — begin dissipation
      if (nextZone && !nextZone.hurricaneSeason) {
        storm.dissipating = true;
        storm.category = Math.max(0, storm.category - 1);
      }

      // Apply zone category modifiers
      if (!storm.dissipating) {
        const modifier = ZONE_CATEGORY_MODIFIERS[nextZoneId] ?? 0;
        if (modifier > 0 && Math.random() < 0.4) {
          // Chance to intensify over deep warm water
          const oldCat = storm.category;
          storm.category = Math.min(5, storm.category + 1);
          storm.peakCategory = Math.max(storm.peakCategory, storm.category);
          if (storm.category > oldCat) {
            updates.push({
              type: 'storm_intensified',
              storm: { ...storm },
              zoneId: nextZoneId,
              category: storm.category,
            });
          }
        } else if (modifier < 0) {
          // Weaken near coastal/shallow zones
          const oldCat = storm.category;
          storm.category = Math.max(0, storm.category - 1);
          if (storm.category < oldCat) {
            updates.push({
              type: 'storm_weakened',
              storm: { ...storm },
              zoneId: nextZoneId,
              category: storm.category,
            });
          }
        }
      } else {
        // Dissipating storms weaken each zone transition
        storm.category = Math.max(0, storm.category - 1);
      }

      storm.currentZoneId = nextZoneId;
      storm.ticksInCurrentZone = 0;
      storm.type = storm.category >= 1 ? WeatherEventType.HURRICANE : WeatherEventType.TROPICAL_STORM;

      if (storm.category <= 0 && storm.dissipating) {
        activeStorms.delete(id);
        updates.push({
          type: 'storm_dissipated',
          storm: { ...storm },
          zoneId: nextZoneId,
          category: 0,
        });
      } else {
        updates.push({
          type: 'storm_entered_zone',
          storm: { ...storm },
          zoneId: nextZoneId,
          category: storm.category,
        });
      }
    }
  }

  return updates;
}

export function advanceWeatherEvents(_gameTime: GameTime): EventUpdate[] {
  const updates: EventUpdate[] = [];

  for (const [id, event] of activeWeatherEvents) {
    event.remainingTicks--;
    if (event.remainingTicks <= 0) {
      activeWeatherEvents.delete(id);
      updates.push({ type: 'event_ended', event: { ...event } });
    }
  }

  return updates;
}

export function getStormInZone(zoneId: string): ActiveStorm | undefined {
  for (const storm of activeStorms.values()) {
    if (storm.currentZoneId === zoneId) return storm;
  }
  return undefined;
}

export function getWeatherEventInZone(zoneId: string): WeatherEventInstance | undefined {
  for (const event of activeWeatherEvents.values()) {
    if (event.affectedZoneIds.includes(zoneId)) return event;
  }
  return undefined;
}

export function getActiveStorms(): ActiveStorm[] {
  return Array.from(activeStorms.values());
}

export function getActiveWeatherEvents(): WeatherEventInstance[] {
  return Array.from(activeWeatherEvents.values());
}

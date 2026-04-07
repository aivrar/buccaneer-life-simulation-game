// Crop production calculator — seasonal output modulated by weather
// Takes plantation base output × season × weather × temperature × events → actual yield per tick
//
// This is the bridge between vegetation (what grows) and economy (what it produces).
// Each plantation's annualOutput is its ideal-year total. This module distributes
// that output across ticks, weighted by growing/harvest seasons and reduced by
// adverse weather.

import type { GameTime, WeatherState, WeatherEventInstance } from '../runtime/types.js';
import { WeatherCondition, WeatherEventType } from '../runtime/types.js';
import { CROP_DEFINITIONS, type CropDefinition } from '../config/crops.js';
import { PLANTATIONS, type Plantation } from '../config/plantations.js';
import { WEATHER_PROFILES } from '../config/weather-profiles.js';
import { SEA_ZONE_DEFINITIONS } from '../config/regions.js';
import { PORT_PROFILES } from '../config/ports.js';

// ============================================================
// Constants
// ============================================================

// 24 ticks/day but economy-tick fires every 6 ticks (slow tick), so 4 economy ticks/day
// 4 economy ticks × 365 days = 1460 effective economy ticks per year
const TICKS_PER_YEAR = 1460;

// ============================================================
// Seasonal modifier — when in the year does this crop produce?
// ============================================================

function getSeasonalModifier(crop: CropDefinition, gameTime: GameTime): number {
  const month = gameTime.month;

  if (crop.harvestMonths.includes(month)) {
    // Harvest months — peak output. Concentrate ~60% of annual yield here.
    // Modifier scaled so: harvestMonths get 60%, growingMonths get 35%, off-season 5%
    const harvestShare = 0.60 / crop.harvestMonths.length;
    const growingShare = crop.growingMonths.length > crop.harvestMonths.length
      ? 0.35 / (crop.growingMonths.length - crop.harvestMonths.length)
      : 0;
    // Return relative weight (will be normalized per year)
    return harvestShare * 12; // scale so average month = 1.0
  }

  if (crop.growingMonths.includes(month)) {
    // Growing but not harvest — maintenance output (stored/accumulating)
    const nonHarvestGrowing = crop.growingMonths.filter(m => !crop.harvestMonths.includes(m));
    if (nonHarvestGrowing.length === 0) return 1.0;
    const growingShare = 0.35 / nonHarvestGrowing.length;
    return growingShare * 12;
  }

  // Off-season — minimal output (perennials still produce a trickle)
  if (crop.perennial) {
    return 0.2; // perennials produce some year-round
  }
  return 0.0; // annuals produce nothing off-season
}

// ============================================================
// Weather condition modifier — how does current weather affect yield?
// ============================================================

function getWeatherModifier(crop: CropDefinition, condition: WeatherCondition): number {
  switch (condition) {
    case WeatherCondition.CLEAR:
      // Good for most crops, but arid-needing crops love it
      return crop.rainfallNeed === 'arid' ? 1.1 : 1.0;

    case WeatherCondition.CLOUDY:
      return 1.0; // neutral

    case WeatherCondition.RAIN:
      // Rain is good for heavy-rainfall crops, bad for arid ones
      if (crop.rainfallNeed === 'heavy' || crop.rainfallNeed === 'very_heavy') return 1.15;
      if (crop.rainfallNeed === 'arid') return 0.6;
      if (crop.rainfallNeed === 'low') return 0.8;
      return 1.0;

    case WeatherCondition.STORM:
      // Storms damage crops proportional to vulnerability
      return Math.max(0.1, 1.0 - crop.hurricaneVulnerability * 0.5);

    case WeatherCondition.HURRICANE:
      // Devastating — use full hurricane vulnerability
      return Math.max(0, 1.0 - crop.hurricaneVulnerability);

    case WeatherCondition.FOG:
      // Mostly neutral, slightly bad for sun-loving crops
      return 0.9;

    case WeatherCondition.BECALMED:
      // No wind = extreme heat = drought conditions
      return Math.max(0.2, 1.0 - crop.droughtVulnerability * 0.6);
  }
}

// ============================================================
// Temperature modifier — is it too hot, too cold, or just right?
// ============================================================

function getTemperatureModifier(crop: CropDefinition, tempF: number): number {
  const [idealMin, idealMax] = crop.idealTempF;
  const [survMin, survMax] = crop.tempRangeF;

  // Within ideal range — full production
  if (tempF >= idealMin && tempF <= idealMax) return 1.0;

  // Below ideal but survivable
  if (tempF < idealMin && tempF >= survMin) {
    const range = idealMin - survMin;
    if (range <= 0) return 0.5;
    const deficit = idealMin - tempF;
    return Math.max(0.2, 1.0 - (deficit / range) * (0.5 + crop.frostVulnerability * 0.5));
  }

  // Above ideal but survivable
  if (tempF > idealMax && tempF <= survMax) {
    const range = survMax - idealMax;
    if (range <= 0) return 0.5;
    const excess = tempF - idealMax;
    return Math.max(0.3, 1.0 - (excess / range) * 0.5);
  }

  // Outside survivable range
  if (tempF < survMin) {
    // Frost/cold kill — proportional to frost vulnerability
    return Math.max(0, 0.2 - crop.frostVulnerability * 0.2);
  }

  // Extreme heat
  return 0.2;
}

// ============================================================
// Weather event modifier — special events override normal weather
// ============================================================

function getEventModifier(crop: CropDefinition, event: WeatherEventInstance): number {
  switch (event.type) {
    case WeatherEventType.HURRICANE:
      return Math.max(0, 1.0 - crop.hurricaneVulnerability);

    case WeatherEventType.TROPICAL_STORM:
      return Math.max(0.2, 1.0 - crop.hurricaneVulnerability * 0.6);

    case WeatherEventType.NORTHER:
      // Cold blast — frost-sensitive crops suffer
      return Math.max(0.2, 1.0 - crop.frostVulnerability * 0.5);

    case WeatherEventType.NOREASTER:
      // Cold + wet — bad for most
      return Math.max(0.2, 1.0 - crop.frostVulnerability * 0.4 - crop.floodVulnerability * 0.2);

    case WeatherEventType.HARMATTAN:
      // Dry + dusty — bad for moisture-loving crops, good for arid ones
      if (crop.rainfallNeed === 'arid' || crop.rainfallNeed === 'low') return 1.0;
      return Math.max(0.3, 1.0 - crop.droughtVulnerability * 0.4);

    case WeatherEventType.TROPICAL_WAVE:
      // Heavy rain squalls
      if (crop.rainfallNeed === 'heavy' || crop.rainfallNeed === 'very_heavy') return 1.0;
      return Math.max(0.5, 1.0 - crop.floodVulnerability * 0.3);

    case WeatherEventType.AFTERNOON_THUNDERSTORM:
      // Brief but intense — some flood/wind damage
      return Math.max(0.6, 1.0 - crop.floodVulnerability * 0.2);

    case WeatherEventType.WATERSPOUT:
      // Very localized damage
      return 0.8;
  }
}

// ============================================================
// Rainfall alignment — does the current month match the crop's water needs?
// ============================================================

function getRainfallAlignmentModifier(crop: CropDefinition, portId: string, month: number): number {
  // Get the port's weather profile to check rainy/dry months
  const profile = WEATHER_PROFILES[portId];
  if (!profile) return 1.0;

  const isRainy = profile.rainyMonths.includes(month);
  const isDry = profile.dryMonths.includes(month);

  switch (crop.rainfallNeed) {
    case 'very_heavy':
    case 'heavy':
      if (isRainy) return 1.1;  // good — crop gets the water it needs
      if (isDry) return 0.6;     // bad — not enough water
      return 0.85;

    case 'moderate':
      return 1.0; // moderate crops handle both

    case 'low':
      if (isDry) return 1.1;    // good — dry conditions suit the crop
      if (isRainy) return 0.85;  // too wet but manageable
      return 1.0;

    case 'arid':
      if (isDry) return 1.2;    // excellent — exactly what's needed
      if (isRainy) return 0.5;   // bad — too much water
      return 0.8;
  }
}

// ============================================================
// Main: calculate per-tick output for a plantation
// ============================================================

export interface CropYield {
  plantationId: string;
  cargoId: string;
  baseOutputPerTick: number;
  seasonalMod: number;
  weatherMod: number;
  tempMod: number;
  rainfallMod: number;
  eventMod: number;
  finalOutputPerTick: number;
}

export function calculateCropYield(
  plantation: Plantation,
  weather: WeatherState,
  gameTime: GameTime,
  activeEvent?: WeatherEventInstance,
): CropYield {
  const crop = CROP_DEFINITIONS[plantation.primaryCargo] ?? CROP_DEFINITIONS[plantation.type];
  if (!crop) {
    // No crop definition — return base output evenly distributed
    return {
      plantationId: plantation.id,
      cargoId: plantation.primaryCargo,
      baseOutputPerTick: plantation.annualOutput / TICKS_PER_YEAR,
      seasonalMod: 1.0,
      weatherMod: 1.0,
      tempMod: 1.0,
      rainfallMod: 1.0,
      eventMod: 1.0,
      finalOutputPerTick: plantation.annualOutput / TICKS_PER_YEAR,
    };
  }

  const basePerTick = plantation.annualOutput / TICKS_PER_YEAR;
  const seasonalMod = getSeasonalModifier(crop, gameTime);
  const weatherMod = getWeatherModifier(crop, weather.condition);
  const tempMod = getTemperatureModifier(crop, weather.temperature);
  const rainfallMod = getRainfallAlignmentModifier(crop, plantation.portId, gameTime.month);
  const eventMod = activeEvent ? getEventModifier(crop, activeEvent) : 1.0;

  const finalOutput = basePerTick * seasonalMod * weatherMod * tempMod * rainfallMod * eventMod;

  return {
    plantationId: plantation.id,
    cargoId: plantation.primaryCargo,
    baseOutputPerTick: basePerTick,
    seasonalMod,
    weatherMod,
    tempMod,
    rainfallMod,
    eventMod,
    finalOutputPerTick: Math.max(0, finalOutput),
  };
}

// ============================================================
// Convenience: calculate all plantation yields for a port
// ============================================================

export function calculatePortProduction(
  portId: string,
  weatherMap: Map<string, WeatherState>,
  gameTime: GameTime,
  activeEvent?: WeatherEventInstance,
): CropYield[] {
  const portPlantations = PLANTATIONS.filter(p => p.portId === portId);
  if (portPlantations.length === 0) return [];

  // Get weather for this port's sea zone
  const portProfile = PORT_PROFILES[portId];
  let weather: WeatherState | undefined;
  if (portProfile) {
    weather = weatherMap.get(portProfile.seaZoneId);
  }
  if (!weather) {
    // Fallback — use first available
    for (const [, w] of weatherMap) { weather = w; break; }
  }
  if (!weather) return [];

  return portPlantations.map(plantation =>
    calculateCropYield(plantation, weather, gameTime, activeEvent)
  );
}

// ============================================================
// Aggregate: total output per cargo type for a port
// ============================================================

export function getPortTickProduction(
  portId: string,
  weatherMap: Map<string, WeatherState>,
  gameTime: GameTime,
  activeEvent?: WeatherEventInstance,
): Record<string, number> {
  const yields = calculatePortProduction(portId, weatherMap, gameTime, activeEvent);
  const output: Record<string, number> = {};
  for (const y of yields) {
    output[y.cargoId] = (output[y.cargoId] ?? 0) + y.finalOutputPerTick;
  }
  return output;
}

// Temperature calculator — seasonal, diurnal, and condition-based
// Historically accurate for Caribbean, Atlantic, European, and African zones (1715-1725)

import type { GameTime, WeatherEventInstance } from '../runtime/types.js';
import { WeatherCondition } from '../runtime/types.js';
import { SEA_ZONE_DEFINITIONS } from '../config/regions.js';
import { WEATHER_PROFILES } from '../config/weather-profiles.js';
import { getDayOfYear } from './time.js';

const CONDITION_TEMP_MOD: Record<string, number> = {
  [WeatherCondition.CLEAR]: 2,
  [WeatherCondition.CLOUDY]: 0,
  [WeatherCondition.RAIN]: -3,
  [WeatherCondition.STORM]: -5,
  [WeatherCondition.HURRICANE]: -8,
  [WeatherCondition.FOG]: -2,
  [WeatherCondition.BECALMED]: 2,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateTemperature(
  zoneId: string,
  gameTime: GameTime,
  condition: WeatherCondition,
  activeEvent?: WeatherEventInstance,
): number {
  // Get temp range from port weather profiles in the zone
  let tempMinF = 75;
  let tempMaxF = 85;
  let foundProfile = false;

  const zone = SEA_ZONE_DEFINITIONS[zoneId];
  if (zone) {
    for (const portId of zone.accessiblePorts) {
      const profile = WEATHER_PROFILES[portId];
      if (profile) {
        tempMinF = profile.tempMinF;
        tempMaxF = profile.tempMaxF;
        foundProfile = true;
        break;
      }
    }
  }

  // Default 80F for open ocean zones with no port profiles
  if (!foundProfile) {
    tempMinF = 75;
    tempMaxF = 85;
  }

  // Seasonal curve: cosine interpolation — min in January (day ~15), max in July (day ~196)
  const dayOfYear = getDayOfYear(gameTime);
  // Cosine curve: coldest at day 15 (mid-Jan), warmest at day 196 (mid-Jul)
  const seasonalPhase = ((dayOfYear - 15) / 365) * 2 * Math.PI;
  const seasonalFactor = (1 - Math.cos(seasonalPhase)) / 2; // 0 at Jan, 1 at Jul
  const seasonalTemp = tempMinF + (tempMaxF - tempMinF) * seasonalFactor;

  // Diurnal cycle: ±5F — coolest at 5am, warmest at 2pm
  const hourAngle = ((gameTime.hour - 5) / 24) * 2 * Math.PI;
  const diurnalMod = -5 * Math.cos(hourAngle); // -5 at hour 5, +5 at hour 17

  // Condition modifier
  const condMod = CONDITION_TEMP_MOD[condition] ?? 0;

  // Event modifier
  const eventMod = activeEvent ? activeEvent.tempModF : 0;

  const temp = seasonalTemp + diurnalMod + condMod + eventMod;
  return Math.round(clamp(temp, 15, 105));
}

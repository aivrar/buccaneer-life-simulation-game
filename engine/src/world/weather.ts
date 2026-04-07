import type { WeatherState, GameTime } from '../runtime/types.js';
import { WeatherCondition } from '../runtime/types.js';
import { SEA_ZONE_DEFINITIONS } from '../config/regions.js';
import { WEATHER_PROFILES } from '../config/weather-profiles.js';
import { HURRICANE_RISK_MULTIPLIER } from '../config/hurricane-tracks.js';
import { isHurricaneSeason, hurricaneSeasonCurve } from './time.js';
import { getStormInZone, getWeatherEventInZone } from './storm-tracker.js';
import { calculateTemperature } from './temperature.js';

const WIND_DIRECTIONS = [0, 45, 90, 135, 180, 225, 270, 315];

// Map wind direction strings to degrees
const WIND_DIR_MAP: Record<string, number> = {
  N: 0, NNE: 22, NE: 45, ENE: 67, E: 90, ESE: 112, SE: 135, SSE: 157,
  S: 180, SSW: 202, SW: 225, WSW: 247, W: 270, WNW: 292, NW: 315, NNW: 337,
  variable: -1,
};

function getBaseWindDirection(zoneId: string, gameTime: GameTime): number {
  const zone = SEA_ZONE_DEFINITIONS[zoneId];
  if (!zone) return 67; // default ENE trade winds

  for (const portId of zone.accessiblePorts) {
    const profile = WEATHER_PROFILES[portId];
    if (profile) {
      const isWinter = gameTime.month >= 11 || gameTime.month <= 3;
      const dirStr = isWinter ? profile.janWindDir : profile.julWindDir;
      const deg = WIND_DIR_MAP[dirStr];
      if (deg !== undefined && deg >= 0) return deg;
    }
  }

  // Default trade winds for Caribbean
  return 67; // ENE
}

function getBaseWindSpeed(zoneId: string, gameTime: GameTime): number {
  const zone = SEA_ZONE_DEFINITIONS[zoneId];
  if (!zone) return 10;

  for (const portId of zone.accessiblePorts) {
    const profile = WEATHER_PROFILES[portId];
    if (profile) {
      const isWinter = gameTime.month >= 11 || gameTime.month <= 3;
      return isWinter ? profile.janWindSpeed : profile.julWindSpeed;
    }
  }

  return 10;
}

function getBaseFogChance(zoneId: string, gameTime: GameTime): number {
  const zone = SEA_ZONE_DEFINITIONS[zoneId];
  if (!zone) return 0.02;

  for (const portId of zone.accessiblePorts) {
    const profile = WEATHER_PROFILES[portId];
    if (profile) {
      const fogLevels: Record<string, number> = { none: 0, low: 0.02, moderate: 0.08, high: 0.15 };
      let baseFog = fogLevels[profile.fogRisk] ?? 0.02;
      // Higher fog chance at dawn (hours 4-8), lower at midday
      if (gameTime.hour >= 4 && gameTime.hour <= 8) {
        baseFog *= 2.0;
      } else if (gameTime.hour >= 11 && gameTime.hour <= 15) {
        baseFog *= 0.3;
      }
      return baseFog;
    }
  }

  return 0.02;
}

function getRainChance(zoneId: string, gameTime: GameTime): number {
  const zone = SEA_ZONE_DEFINITIONS[zoneId];
  if (!zone) return 0.15;

  for (const portId of zone.accessiblePorts) {
    const profile = WEATHER_PROFILES[portId];
    if (profile) {
      if (profile.rainyMonths.includes(gameTime.month)) return 0.30;
      if (profile.dryMonths.includes(gameTime.month)) return 0.08;
      return 0.15;
    }
  }

  return 0.15;
}

function getStormChance(zoneId: string, gameTime: GameTime): number {
  const zone = SEA_ZONE_DEFINITIONS[zoneId];
  if (!zone) return 0.05;

  if (!isHurricaneSeason(gameTime) || !zone.hurricaneSeason) return 0.05;

  // Use hurricaneRisk from port weather profiles
  let riskLevel = 'moderate'; // default
  for (const portId of zone.accessiblePorts) {
    const profile = WEATHER_PROFILES[portId];
    if (profile) {
      riskLevel = profile.hurricaneRisk;
      break;
    }
  }

  const riskMultiplier = HURRICANE_RISK_MULTIPLIER[riskLevel] ?? 0.6;
  const curve = hurricaneSeasonCurve(gameTime.month, gameTime.day);
  // Storm (non-hurricane) chance modulated by season curve and risk
  return 0.05 + curve * riskMultiplier * 0.15;
}

export function generateWeather(seaZoneId: string, gameTime: GameTime, previous?: WeatherState): WeatherState {
  const zone = SEA_ZONE_DEFINITIONS[seaZoneId];
  if (!zone) {
    return defaultWeather(seaZoneId, gameTime);
  }

  // Check storm tracker for active hurricane in this zone
  const stormInZone = getStormInZone(seaZoneId);
  const weatherEvent = getWeatherEventInZone(seaZoneId);

  if (stormInZone) {
    // Hurricane/tropical storm overrides normal weather generation
    const condition = stormInZone.category >= 1 ? WeatherCondition.HURRICANE : WeatherCondition.STORM;
    const state = buildWeatherState(seaZoneId, condition, gameTime);
    state.activeStormId = stormInZone.id;
    // Scale wind speed by category
    if (stormInZone.category >= 1) {
      const catWindSpeeds: Record<number, [number, number]> = {
        1: [64, 82], 2: [83, 95], 3: [96, 112], 4: [113, 136], 5: [137, 165],
      };
      const [min, max] = catWindSpeeds[stormInZone.category] ?? [64, 82];
      state.windSpeed = min + Math.floor(Math.random() * (max - min));
    }
    state.temperature = calculateTemperature(seaZoneId, gameTime, condition, weatherEvent);
    return state;
  }

  const stormChance = getStormChance(seaZoneId, gameTime);

  let weather: WeatherState;
  if (previous) {
    weather = evolveWeather(previous, stormChance, seaZoneId, gameTime);
  } else {
    weather = freshWeather(seaZoneId, stormChance, gameTime);
  }

  // Apply weather event overrides
  if (weatherEvent) {
    weather.windSpeed = Math.max(weather.windSpeed, weatherEvent.windSpeed);
    weather.windDirection = weatherEvent.windDirection;
    weather.visibility = Math.min(weather.visibility, weatherEvent.visibility);
  }

  weather.temperature = calculateTemperature(seaZoneId, gameTime, weather.condition, weatherEvent);
  return weather;
}

function freshWeather(seaZoneId: string, stormChance: number, gameTime: GameTime): WeatherState {
  const fogChance = getBaseFogChance(seaZoneId, gameTime);
  const rainChance = getRainChance(seaZoneId, gameTime);
  const becalmedChance = seaZoneId === 'atlantic_approach' ? 0.10 : 0.05;
  const roll = Math.random();
  let condition: WeatherCondition;

  // No hurricane from random generation — only via storm tracker
  if (roll < stormChance) {
    condition = WeatherCondition.STORM;
  } else if (roll < stormChance + rainChance) {
    condition = WeatherCondition.RAIN;
  } else if (roll < stormChance + rainChance + 0.10) {
    condition = WeatherCondition.CLOUDY;
  } else if (roll < stormChance + rainChance + 0.10 + fogChance) {
    condition = WeatherCondition.FOG;
  } else if (roll < stormChance + rainChance + 0.10 + fogChance + becalmedChance) {
    condition = WeatherCondition.BECALMED;
  } else {
    condition = WeatherCondition.CLEAR;
  }

  return buildWeatherState(seaZoneId, condition, gameTime);
}

function evolveWeather(prev: WeatherState, stormChance: number, seaZoneId: string, gameTime: GameTime): WeatherState {
  const changeChance = 0.2;
  if (Math.random() > changeChance) {
    // Persist current weather with small wind variation
    const baseDir = getBaseWindDirection(seaZoneId, gameTime);
    const dirVariation = (Math.random() - 0.5) * 45;
    return {
      ...prev,
      windSpeed: clamp(prev.windSpeed + (Math.random() - 0.5) * 5, 0, 80),
      windDirection: Math.round((baseDir + dirVariation + 360) % 360),
      temperature: 0, // will be overwritten by caller
    };
  }

  // Markov transitions — HURRICANE removed from random transitions
  const transitions: Record<string, WeatherCondition[]> = {
    [WeatherCondition.CLEAR]: [WeatherCondition.CLOUDY, WeatherCondition.CLEAR, WeatherCondition.FOG, WeatherCondition.BECALMED],
    [WeatherCondition.CLOUDY]: [WeatherCondition.RAIN, WeatherCondition.CLEAR, WeatherCondition.CLOUDY],
    [WeatherCondition.RAIN]: [WeatherCondition.STORM, WeatherCondition.CLOUDY, WeatherCondition.RAIN],
    [WeatherCondition.STORM]: [WeatherCondition.RAIN, WeatherCondition.STORM],
    [WeatherCondition.HURRICANE]: [WeatherCondition.STORM], // only if previous was storm-tracker driven and storm left
    [WeatherCondition.FOG]: [WeatherCondition.CLEAR, WeatherCondition.CLOUDY],
    [WeatherCondition.BECALMED]: [
      // Becalmed persists 80% of the time (doldrums realism)
      WeatherCondition.BECALMED, WeatherCondition.BECALMED, WeatherCondition.BECALMED, WeatherCondition.BECALMED,
      WeatherCondition.CLEAR,
    ],
  };

  const options = transitions[prev.condition] ?? [WeatherCondition.CLEAR];
  const next = options[Math.floor(Math.random() * options.length)]!;

  return buildWeatherState(prev.seaZoneId, next, gameTime);
}

function buildWeatherState(seaZoneId: string, condition: WeatherCondition, gameTime?: GameTime): WeatherState {
  const windSpeeds: Record<string, [number, number]> = {
    [WeatherCondition.CLEAR]: [5, 15],
    [WeatherCondition.CLOUDY]: [8, 20],
    [WeatherCondition.RAIN]: [15, 30],
    [WeatherCondition.STORM]: [30, 55],
    [WeatherCondition.HURRICANE]: [55, 80],
    [WeatherCondition.FOG]: [0, 5],
    [WeatherCondition.BECALMED]: [0, 2],
  };

  const visibilities: Record<string, number> = {
    [WeatherCondition.CLEAR]: 1.0,
    [WeatherCondition.CLOUDY]: 0.8,
    [WeatherCondition.RAIN]: 0.5,
    [WeatherCondition.STORM]: 0.2,
    [WeatherCondition.HURRICANE]: 0.05,
    [WeatherCondition.FOG]: 0.15,
    [WeatherCondition.BECALMED]: 0.9,
  };

  const [minWind, maxWind] = windSpeeds[condition] ?? [5, 15];
  let windSpeed = minWind + Math.random() * (maxWind - minWind);

  // Modulate by port-specific base wind speed if available
  if (gameTime && condition === WeatherCondition.CLEAR) {
    const baseSpeed = getBaseWindSpeed(seaZoneId, gameTime);
    windSpeed = baseSpeed + (Math.random() - 0.5) * 6;
  }

  const windDir = gameTime
    ? getBaseWindDirection(seaZoneId, gameTime) + Math.round((Math.random() - 0.5) * 30)
    : WIND_DIRECTIONS[Math.floor(Math.random() * WIND_DIRECTIONS.length)]!;

  return {
    seaZoneId,
    condition,
    windSpeed: Math.round(clamp(windSpeed, 0, 165)),
    windDirection: (windDir + 360) % 360,
    visibility: visibilities[condition] ?? 0.8,
    stormIntensity: condition === WeatherCondition.HURRICANE ? 0.8 + Math.random() * 0.2
      : condition === WeatherCondition.STORM ? 0.3 + Math.random() * 0.4
      : 0,
    temperature: 80, // placeholder — overwritten by caller
  };
}

function defaultWeather(seaZoneId: string, gameTime: GameTime): WeatherState {
  const state = buildWeatherState(seaZoneId, WeatherCondition.CLEAR, gameTime);
  state.temperature = calculateTemperature(seaZoneId, gameTime, WeatherCondition.CLEAR);
  return state;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

import type { WeatherState, SeaCondition } from '../runtime/types.js';
import { WeatherCondition } from '../runtime/types.js';

export function deriveSeaState(weather: WeatherState): SeaCondition {
  const waveMultipliers: Record<string, number> = {
    [WeatherCondition.CLEAR]: 0.5,
    [WeatherCondition.CLOUDY]: 0.8,
    [WeatherCondition.RAIN]: 1.5,
    [WeatherCondition.STORM]: 3.0,
    [WeatherCondition.HURRICANE]: 6.0,
    [WeatherCondition.FOG]: 0.3,
    [WeatherCondition.BECALMED]: 0.1,
  };

  const waveHeight = (weather.windSpeed / 10) * (waveMultipliers[weather.condition] ?? 1);

  // Currents are somewhat independent of weather
  const currentSpeed = 0.5 + Math.random() * 2;
  const currentDirection = Math.floor(Math.random() * 360);

  return {
    seaZoneId: weather.seaZoneId,
    waveHeight: Math.round(waveHeight * 10) / 10,
    currentSpeed: Math.round(currentSpeed * 10) / 10,
    currentDirection,
    visibility: weather.visibility,
  };
}

export function getSeaStateDescription(sea: SeaCondition): string {
  if (sea.waveHeight < 0.5) return 'calm seas';
  if (sea.waveHeight < 1.5) return 'moderate seas';
  if (sea.waveHeight < 3) return 'rough seas';
  if (sea.waveHeight < 5) return 'very rough seas';
  return 'extreme seas';
}

export function getSpeedModifier(sea: SeaCondition): number {
  if (sea.waveHeight < 1) return 1.0;
  if (sea.waveHeight < 2) return 0.85;
  if (sea.waveHeight < 4) return 0.6;
  if (sea.waveHeight < 6) return 0.3;
  return 0.1; // hurricane conditions
}

export function getDamageRisk(sea: SeaCondition): number {
  if (sea.waveHeight < 2) return 0;
  if (sea.waveHeight < 4) return 0.05;
  if (sea.waveHeight < 6) return 0.2;
  return 0.5;
}

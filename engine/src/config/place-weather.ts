// Place weather configuration — how weather affects land-based places
// Exposure levels, activity hours, weather impact modifiers, regional mapping

import type { PlaceType } from './places.js';
import { WeatherCondition, WeatherEventType } from '../runtime/types.js';

// ============================================================
// Exposure — how much weather a place type experiences
// ============================================================

export type PlaceExposure = 'exposed' | 'semi_sheltered' | 'sheltered';

export const PLACE_EXPOSURE: Record<PlaceType, PlaceExposure> = {
  dock:          'exposed',
  camp:          'exposed',
  landmark:      'exposed',
  market:        'exposed',
  slave_market:  'semi_sheltered',
  shipyard:      'semi_sheltered',
  trading_post:  'semi_sheltered',
  tavern:        'sheltered',
  church:        'sheltered',
  fort:          'sheltered',
  government:    'sheltered',
  jail:          'sheltered',
  warehouse:     'sheltered',
  brothel:       'sheltered',
  hospital:      'sheltered',
  residential:   'sheltered',
};

// ============================================================
// Activity hours — when each place type is active
// ============================================================

export interface PlaceActivitySchedule {
  activeHours: [number, number];   // [open, close] in 24h
  peakHours: [number, number];     // [start, end] of busiest period
  alwaysActive: boolean;           // forts, jails, hospitals — 24/7
  sundaySpecial: boolean;          // churches have Sunday peak
}

export const PLACE_ACTIVITY_SCHEDULE: Record<PlaceType, PlaceActivitySchedule> = {
  dock:          { activeHours: [5, 20],  peakHours: [6, 10],   alwaysActive: false, sundaySpecial: false },
  market:        { activeHours: [6, 14],  peakHours: [7, 11],   alwaysActive: false, sundaySpecial: false },
  tavern:        { activeHours: [10, 3],  peakHours: [19, 1],   alwaysActive: false, sundaySpecial: false },
  church:        { activeHours: [6, 20],  peakHours: [8, 10],   alwaysActive: false, sundaySpecial: true },
  fort:          { activeHours: [0, 24],  peakHours: [6, 8],    alwaysActive: true,  sundaySpecial: false },
  government:    { activeHours: [8, 16],  peakHours: [9, 12],   alwaysActive: false, sundaySpecial: false },
  shipyard:      { activeHours: [6, 18],  peakHours: [7, 12],   alwaysActive: false, sundaySpecial: false },
  warehouse:     { activeHours: [6, 20],  peakHours: [7, 11],   alwaysActive: false, sundaySpecial: false },
  brothel:       { activeHours: [18, 4],  peakHours: [21, 2],   alwaysActive: false, sundaySpecial: false },
  jail:          { activeHours: [0, 24],  peakHours: [0, 24],   alwaysActive: true,  sundaySpecial: false },
  camp:          { activeHours: [5, 22],  peakHours: [7, 10],   alwaysActive: false, sundaySpecial: false },
  landmark:      { activeHours: [6, 20],  peakHours: [8, 16],   alwaysActive: false, sundaySpecial: false },
  residential:   { activeHours: [6, 22],  peakHours: [7, 9],    alwaysActive: false, sundaySpecial: false },
  trading_post:  { activeHours: [7, 17],  peakHours: [8, 12],   alwaysActive: false, sundaySpecial: false },
  slave_market:  { activeHours: [7, 15],  peakHours: [8, 12],   alwaysActive: false, sundaySpecial: false },
  hospital:      { activeHours: [0, 24],  peakHours: [8, 12],   alwaysActive: true,  sundaySpecial: false },
};

// ============================================================
// Weather impact — how conditions affect place function
// ============================================================

export interface PlaceWeatherImpact {
  activityModifier: number;      // 0-1 multiplier on normal activity level
  damageRisk: number;            // 0-1 per-tick chance of structural/property damage
  accessModifier: number;        // 0-1 how reachable the place is
  goodsSpoilageRisk: number;     // 0-1 per-tick risk to stored/displayed goods
}

const FULL_ACTIVITY: PlaceWeatherImpact = { activityModifier: 1.0, damageRisk: 0, accessModifier: 1.0, goodsSpoilageRisk: 0.01 };

// Default impacts by exposure level — specific place types can override
const EXPOSURE_WEATHER_DEFAULTS: Record<PlaceExposure, Record<WeatherCondition, PlaceWeatherImpact>> = {
  exposed: {
    [WeatherCondition.CLEAR]:     { activityModifier: 1.0, damageRisk: 0,    accessModifier: 1.0, goodsSpoilageRisk: 0.02 },
    [WeatherCondition.CLOUDY]:    { activityModifier: 1.0, damageRisk: 0,    accessModifier: 1.0, goodsSpoilageRisk: 0.02 },
    [WeatherCondition.RAIN]:      { activityModifier: 0.5, damageRisk: 0,    accessModifier: 0.7, goodsSpoilageRisk: 0.06 },
    [WeatherCondition.STORM]:     { activityModifier: 0.05, damageRisk: 0.12, accessModifier: 0.15, goodsSpoilageRisk: 0.15 },
    [WeatherCondition.HURRICANE]: { activityModifier: 0,   damageRisk: 0.50, accessModifier: 0,   goodsSpoilageRisk: 0.40 },
    [WeatherCondition.FOG]:       { activityModifier: 0.4, damageRisk: 0,    accessModifier: 0.4, goodsSpoilageRisk: 0.02 },
    [WeatherCondition.BECALMED]:  { activityModifier: 0.7, damageRisk: 0,    accessModifier: 1.0, goodsSpoilageRisk: 0.05 },
  },
  semi_sheltered: {
    [WeatherCondition.CLEAR]:     { activityModifier: 1.0, damageRisk: 0,    accessModifier: 1.0, goodsSpoilageRisk: 0.01 },
    [WeatherCondition.CLOUDY]:    { activityModifier: 1.0, damageRisk: 0,    accessModifier: 1.0, goodsSpoilageRisk: 0.01 },
    [WeatherCondition.RAIN]:      { activityModifier: 0.7, damageRisk: 0,    accessModifier: 0.8, goodsSpoilageRisk: 0.03 },
    [WeatherCondition.STORM]:     { activityModifier: 0.2, damageRisk: 0.08, accessModifier: 0.3, goodsSpoilageRisk: 0.08 },
    [WeatherCondition.HURRICANE]: { activityModifier: 0,   damageRisk: 0.35, accessModifier: 0,   goodsSpoilageRisk: 0.25 },
    [WeatherCondition.FOG]:       { activityModifier: 0.6, damageRisk: 0,    accessModifier: 0.5, goodsSpoilageRisk: 0.01 },
    [WeatherCondition.BECALMED]:  { activityModifier: 0.8, damageRisk: 0,    accessModifier: 1.0, goodsSpoilageRisk: 0.03 },
  },
  sheltered: {
    [WeatherCondition.CLEAR]:     { activityModifier: 1.0, damageRisk: 0,    accessModifier: 1.0, goodsSpoilageRisk: 0.005 },
    [WeatherCondition.CLOUDY]:    { activityModifier: 1.0, damageRisk: 0,    accessModifier: 1.0, goodsSpoilageRisk: 0.005 },
    [WeatherCondition.RAIN]:      { activityModifier: 0.9, damageRisk: 0,    accessModifier: 0.9, goodsSpoilageRisk: 0.01 },
    [WeatherCondition.STORM]:     { activityModifier: 0.6, damageRisk: 0.03, accessModifier: 0.4, goodsSpoilageRisk: 0.03 },
    [WeatherCondition.HURRICANE]: { activityModifier: 0.3, damageRisk: 0.15, accessModifier: 0.1, goodsSpoilageRisk: 0.10 },
    [WeatherCondition.FOG]:       { activityModifier: 0.9, damageRisk: 0,    accessModifier: 0.7, goodsSpoilageRisk: 0.005 },
    [WeatherCondition.BECALMED]:  { activityModifier: 0.9, damageRisk: 0,    accessModifier: 1.0, goodsSpoilageRisk: 0.01 },
  },
};

// Place-type overrides where behavior differs from exposure defaults
const PLACE_WEATHER_OVERRIDES: Partial<Record<PlaceType, Partial<Record<WeatherCondition, Partial<PlaceWeatherImpact>>>>> = {
  fort: {
    // Forts are built to withstand storms
    [WeatherCondition.STORM]:     { damageRisk: 0.01, activityModifier: 0.5 },
    [WeatherCondition.HURRICANE]: { damageRisk: 0.05, activityModifier: 0.3 },
  },
  warehouse: {
    // Warehouses have higher spoilage risk from moisture
    [WeatherCondition.RAIN]:      { goodsSpoilageRisk: 0.03 },
    [WeatherCondition.STORM]:     { goodsSpoilageRisk: 0.08 },
    [WeatherCondition.HURRICANE]: { goodsSpoilageRisk: 0.20 },
  },
  tavern: {
    // Taverns get MORE activity during storms (people shelter inside)
    [WeatherCondition.RAIN]:      { activityModifier: 1.1 },
    [WeatherCondition.STORM]:     { activityModifier: 0.8 },
    [WeatherCondition.HURRICANE]: { activityModifier: 0.6 },
  },
  church: {
    // Churches also become shelters
    [WeatherCondition.STORM]:     { activityModifier: 0.7 },
    [WeatherCondition.HURRICANE]: { activityModifier: 0.5 },
  },
  hospital: {
    // Hospitals get busier after storms
    [WeatherCondition.STORM]:     { activityModifier: 0.8 },
    [WeatherCondition.HURRICANE]: { activityModifier: 0.7 },
  },
  dock: {
    // Docks are most vulnerable
    [WeatherCondition.STORM]:     { damageRisk: 0.18, activityModifier: 0.05 },
    [WeatherCondition.HURRICANE]: { damageRisk: 0.60, activityModifier: 0 },
    [WeatherCondition.FOG]:       { activityModifier: 0.3, accessModifier: 0.3 },
  },
  shipyard: {
    // Shipyards have heavy equipment at risk
    [WeatherCondition.STORM]:     { damageRisk: 0.10, activityModifier: 0.1 },
    [WeatherCondition.HURRICANE]: { damageRisk: 0.40 },
  },
  camp: {
    // Camps are extremely vulnerable — just tents/lean-tos
    [WeatherCondition.RAIN]:      { activityModifier: 0.3, damageRisk: 0.02, goodsSpoilageRisk: 0.10 },
    [WeatherCondition.STORM]:     { activityModifier: 0, damageRisk: 0.25, goodsSpoilageRisk: 0.30 },
    [WeatherCondition.HURRICANE]: { activityModifier: 0, damageRisk: 0.70, goodsSpoilageRisk: 0.60 },
  },
  market: {
    // Open-air markets shut down in bad weather, perishables spoil fast
    [WeatherCondition.RAIN]:      { activityModifier: 0.3, goodsSpoilageRisk: 0.08 },
    [WeatherCondition.BECALMED]:  { activityModifier: 0.6, goodsSpoilageRisk: 0.08 },
  },
  slave_market: {
    // Semi-sheltered but operations continue in worse weather
    [WeatherCondition.RAIN]:      { activityModifier: 0.6 },
    [WeatherCondition.STORM]:     { activityModifier: 0.1 },
  },
  jail: {
    // Jails always operate, but conditions worsen
    [WeatherCondition.HURRICANE]: { activityModifier: 0.5, damageRisk: 0.08 },
  },
};

// ============================================================
// Weather event impacts by exposure level
// ============================================================

export interface WeatherEventPlaceImpact {
  activityModifier: number;
  damageRisk: number;
  accessModifier: number;
  goodsSpoilageRisk: number;
  tempModF: number;
}

export const WEATHER_EVENT_PLACE_IMPACTS: Record<WeatherEventType, Record<PlaceExposure, WeatherEventPlaceImpact>> = {
  [WeatherEventType.NORTHER]: {
    exposed:        { activityModifier: 0.2, damageRisk: 0.05, accessModifier: 0.3, goodsSpoilageRisk: 0.05, tempModF: -15 },
    semi_sheltered: { activityModifier: 0.4, damageRisk: 0.02, accessModifier: 0.5, goodsSpoilageRisk: 0.02, tempModF: -12 },
    sheltered:      { activityModifier: 0.7, damageRisk: 0,    accessModifier: 0.6, goodsSpoilageRisk: 0.01, tempModF: -8 },
  },
  [WeatherEventType.NOREASTER]: {
    exposed:        { activityModifier: 0.1, damageRisk: 0.08, accessModifier: 0.2, goodsSpoilageRisk: 0.08, tempModF: -10 },
    semi_sheltered: { activityModifier: 0.3, damageRisk: 0.04, accessModifier: 0.3, goodsSpoilageRisk: 0.04, tempModF: -8 },
    sheltered:      { activityModifier: 0.6, damageRisk: 0.01, accessModifier: 0.5, goodsSpoilageRisk: 0.02, tempModF: -5 },
  },
  [WeatherEventType.HARMATTAN]: {
    exposed:        { activityModifier: 0.5, damageRisk: 0,    accessModifier: 0.5, goodsSpoilageRisk: 0.04, tempModF: 5 },
    semi_sheltered: { activityModifier: 0.6, damageRisk: 0,    accessModifier: 0.6, goodsSpoilageRisk: 0.02, tempModF: 4 },
    sheltered:      { activityModifier: 0.8, damageRisk: 0,    accessModifier: 0.7, goodsSpoilageRisk: 0.01, tempModF: 2 },
  },
  [WeatherEventType.TROPICAL_WAVE]: {
    exposed:        { activityModifier: 0.4, damageRisk: 0.02, accessModifier: 0.5, goodsSpoilageRisk: 0.05, tempModF: -3 },
    semi_sheltered: { activityModifier: 0.6, damageRisk: 0.01, accessModifier: 0.6, goodsSpoilageRisk: 0.02, tempModF: -2 },
    sheltered:      { activityModifier: 0.8, damageRisk: 0,    accessModifier: 0.8, goodsSpoilageRisk: 0.01, tempModF: -1 },
  },
  [WeatherEventType.AFTERNOON_THUNDERSTORM]: {
    exposed:        { activityModifier: 0.1, damageRisk: 0.02, accessModifier: 0.3, goodsSpoilageRisk: 0.05, tempModF: -5 },
    semi_sheltered: { activityModifier: 0.3, damageRisk: 0.01, accessModifier: 0.4, goodsSpoilageRisk: 0.02, tempModF: -3 },
    sheltered:      { activityModifier: 0.7, damageRisk: 0,    accessModifier: 0.6, goodsSpoilageRisk: 0.01, tempModF: -2 },
  },
  [WeatherEventType.WATERSPOUT]: {
    exposed:        { activityModifier: 0.2, damageRisk: 0.10, accessModifier: 0.3, goodsSpoilageRisk: 0.08, tempModF: 0 },
    semi_sheltered: { activityModifier: 0.4, damageRisk: 0.05, accessModifier: 0.4, goodsSpoilageRisk: 0.03, tempModF: 0 },
    sheltered:      { activityModifier: 0.8, damageRisk: 0.01, accessModifier: 0.7, goodsSpoilageRisk: 0.01, tempModF: 0 },
  },
  [WeatherEventType.HURRICANE]: {
    exposed:        { activityModifier: 0, damageRisk: 0.60, accessModifier: 0, goodsSpoilageRisk: 0.50, tempModF: -8 },
    semi_sheltered: { activityModifier: 0, damageRisk: 0.40, accessModifier: 0, goodsSpoilageRisk: 0.30, tempModF: -6 },
    sheltered:      { activityModifier: 0.2, damageRisk: 0.15, accessModifier: 0.1, goodsSpoilageRisk: 0.12, tempModF: -4 },
  },
  [WeatherEventType.TROPICAL_STORM]: {
    exposed:        { activityModifier: 0.05, damageRisk: 0.15, accessModifier: 0.1, goodsSpoilageRisk: 0.15, tempModF: -5 },
    semi_sheltered: { activityModifier: 0.15, damageRisk: 0.08, accessModifier: 0.2, goodsSpoilageRisk: 0.08, tempModF: -4 },
    sheltered:      { activityModifier: 0.5, damageRisk: 0.03, accessModifier: 0.3, goodsSpoilageRisk: 0.04, tempModF: -3 },
  },
};

// ============================================================
// Port regions — for ambient flavor
// ============================================================

export type PortRegion =
  | 'caribbean_english'
  | 'caribbean_spanish'
  | 'caribbean_french'
  | 'caribbean_dutch'
  | 'north_american'
  | 'european_english'
  | 'european_spanish'
  | 'european_dutch'
  | 'west_african';

export const PORT_REGION_MAP: Record<string, PortRegion> = {
  nassau:             'caribbean_english',
  port_royal:         'caribbean_english',
  bridgetown:         'caribbean_english',
  basseterre:         'caribbean_english',
  havana:             'caribbean_spanish',
  santo_domingo:      'caribbean_spanish',
  cartagena:          'caribbean_spanish',
  portobelo:          'caribbean_spanish',
  veracruz:           'caribbean_spanish',
  tortuga:            'caribbean_french',
  petit_goave:        'caribbean_french',
  willemstad:          'caribbean_dutch',
  boston:              'north_american',
  charles_town:       'north_american',
  london:             'european_english',
  seville_cadiz:      'european_spanish',
  amsterdam:          'european_dutch',
  cape_coast_castle:  'west_african',
  elmina:             'west_african',
  whydah:             'west_african',
};

// ============================================================
// Utility functions
// ============================================================

export function getPlaceExposure(placeType: PlaceType): PlaceExposure {
  return PLACE_EXPOSURE[placeType];
}

export function getPortRegion(portId: string): PortRegion {
  return PORT_REGION_MAP[portId] ?? 'caribbean_english';
}

export function getPlaceWeatherImpact(placeType: PlaceType, condition: WeatherCondition): PlaceWeatherImpact {
  const exposure = PLACE_EXPOSURE[placeType];
  const base = EXPOSURE_WEATHER_DEFAULTS[exposure][condition] ?? FULL_ACTIVITY;
  const overrides = PLACE_WEATHER_OVERRIDES[placeType]?.[condition];
  if (!overrides) return base;
  return { ...base, ...overrides };
}

export function isPlaceActive(placeType: PlaceType, hour: number, condition: WeatherCondition): boolean {
  const schedule = PLACE_ACTIVITY_SCHEDULE[placeType];
  if (schedule.alwaysActive) return true;

  const impact = getPlaceWeatherImpact(placeType, condition);
  if (impact.activityModifier <= 0) return false;

  const [open, close] = schedule.activeHours;
  if (open < close) {
    return hour >= open && hour < close;
  }
  // Wraps midnight (e.g. tavern 10-3, brothel 18-4)
  return hour >= open || hour < close;
}

export function isPlacePeakHours(placeType: PlaceType, hour: number): boolean {
  const schedule = PLACE_ACTIVITY_SCHEDULE[placeType];
  const [start, end] = schedule.peakHours;
  if (start < end) {
    return hour >= start && hour < end;
  }
  return hour >= start || hour < end;
}

export type PlaceActivityLevel = 'peak' | 'active' | 'quiet' | 'closed';

export function getPlaceActivityLevel(placeType: PlaceType, hour: number, condition: WeatherCondition): PlaceActivityLevel {
  if (!isPlaceActive(placeType, hour, condition)) return 'closed';
  const impact = getPlaceWeatherImpact(placeType, condition);
  if (impact.activityModifier < 0.2) return 'quiet';
  if (isPlacePeakHours(placeType, hour) && impact.activityModifier >= 0.6) return 'peak';
  if (impact.activityModifier >= 0.5) return 'active';
  return 'quiet';
}

// Regional weather event configurations for historically accurate Caribbean weather

import { WeatherEventType } from '../runtime/types.js';

export interface WeatherEventConfig {
  type: WeatherEventType;
  name: string;
  zones: string[];              // zone IDs where this event can spawn
  months: number[];             // eligible months (1-12)
  chancePerDay: number;         // probability per game day
  durationMin: number;          // minimum ticks
  durationMax: number;          // maximum ticks
  windSpeedMin: number;         // knots
  windSpeedMax: number;
  windDirection: number | null; // null = variable
  visibility: number;           // override visibility (0-1)
  tempModF: number;             // temperature modifier in Fahrenheit
  hourRange?: [number, number]; // only spawn during these hours (inclusive)
}

export const WEATHER_EVENT_CONFIGS: WeatherEventConfig[] = [
  {
    type: WeatherEventType.NORTHER,
    name: 'Norther',
    zones: ['gulf_of_mexico', 'yucatan_channel', 'havana_roads'],
    months: [11, 12, 1, 2, 3],
    chancePerDay: 0.08,
    durationMin: 8,
    durationMax: 24,
    windSpeedMin: 35,
    windSpeedMax: 50,
    windDirection: 0,   // North
    visibility: 0.5,
    tempModF: -15,
  },
  {
    type: WeatherEventType.NOREASTER,
    name: "Nor'easter",
    zones: ['boston_waters', 'carolina_shelf'],
    months: [10, 11, 12, 1, 2, 3, 4],
    chancePerDay: 0.06,
    durationMin: 12,
    durationMax: 36,
    windSpeedMin: 30,
    windSpeedMax: 60,
    windDirection: 45,  // NE
    visibility: 0.3,
    tempModF: -10,
  },
  {
    type: WeatherEventType.HARMATTAN,
    name: 'Harmattan',
    zones: ['west_african_coast'],
    months: [12, 1, 2],
    chancePerDay: 0.15,
    durationMin: 24,
    durationMax: 96,
    windSpeedMin: 10,
    windSpeedMax: 25,
    windDirection: 45,  // NE (Saharan wind)
    visibility: 0.3,    // dust haze
    tempModF: 5,
  },
  {
    type: WeatherEventType.TROPICAL_WAVE,
    name: 'Tropical Wave',
    zones: [
      'caribbean_deep_basin', 'jamaica_channel', 'windward_passage', 'cayman_trench',
      'windward_islands_waters', 'leeward_islands_waters', 'mona_passage', 'anegada_passage',
      'tobago_channel', 'florida_straits', 'bahama_channel', 'gulf_of_mexico',
      'great_bahama_bank', 'providence_channel', 'old_bahama_channel', 'havana_roads',
      'yucatan_channel', 'turks_passage', 'tortuga_waters', 'silver_bank',
      'kingston_approaches', 'darien_coast', 'atlantic_approach',
    ],
    months: [6, 7, 8, 9, 10, 11],
    chancePerDay: 0.12,
    durationMin: 4,
    durationMax: 12,
    windSpeedMin: 20,
    windSpeedMax: 35,
    windDirection: null, // variable
    visibility: 0.5,
    tempModF: -3,
  },
  {
    type: WeatherEventType.AFTERNOON_THUNDERSTORM,
    name: 'Afternoon Thunderstorm',
    zones: ['spanish_main_coast', 'darien_coast'],
    months: [5, 6, 7, 8, 9, 10],
    chancePerDay: 0.40,
    durationMin: 2,
    durationMax: 4,
    windSpeedMin: 25,
    windSpeedMax: 40,
    windDirection: null,
    visibility: 0.3,
    tempModF: -5,
    hourRange: [14, 17],
  },
  {
    type: WeatherEventType.WATERSPOUT,
    name: 'Waterspout',
    zones: [
      'caribbean_deep_basin', 'jamaica_channel', 'windward_passage', 'cayman_trench',
      'windward_islands_waters', 'leeward_islands_waters', 'mona_passage',
      'tobago_channel', 'florida_straits', 'spanish_main_coast', 'darien_coast',
      'great_bahama_bank', 'havana_roads', 'tortuga_waters', 'kingston_approaches',
    ],
    months: [6, 7, 8, 9, 10],
    chancePerDay: 0.02,
    durationMin: 1,
    durationMax: 2,
    windSpeedMin: 30,
    windSpeedMax: 45,
    windDirection: null,
    visibility: 0.6,
    tempModF: 0,
  },
];

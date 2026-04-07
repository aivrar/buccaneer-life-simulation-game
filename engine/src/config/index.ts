import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const EnvSchema = z.object({
  // LLM
  LLM_PROVIDER: z.enum(['local', 'openrouter']).default('local'),
  VLLM_URL: z.string().default('http://localhost:8000'),
  VLLM_MODEL: z.string().default('qwen2.5-14b-abliterated-fp8'),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_LLM_MODEL: z.string().default('google/gemini-2.5-flash'),

  // MySQL
  MYSQL_HOST: z.string().default('localhost'),
  MYSQL_PORT: z.string().default('3306'),
  MYSQL_USER: z.string().default('buccaneer'),
  MYSQL_PASSWORD: z.string().default(''),
  MYSQL_DATABASE: z.string().default('buccaneer_life'),

  // SQLite
  SQLITE_PATH: z.string().default('./data/agent_memory.db'),

  // Simulation
  SIM_TICK_INTERVAL_MS: z.string().default('30000'),
  SIM_MAX_CONCURRENT_LLM: z.string().default('8'),
  SIM_LOG_LEVEL: z.enum(['silent', 'errors', 'events', 'verbose', 'debug']).default('events'),

  // Server
  PORT: z.string().default('3000'),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

let _config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!_config) {
    _config = EnvSchema.parse(process.env);
  }
  return _config;
}

export function getTickIntervalMs(): number {
  return parseInt(getConfig().SIM_TICK_INTERVAL_MS);
}

export function getMaxConcurrentLLM(): number {
  return parseInt(getConfig().SIM_MAX_CONCURRENT_LLM);
}

// Re-export domain configs
export { SHIP_CLASSES } from './ships.js';
export { CARGO_TYPES } from './cargo.js';
export { PORT_PROFILES, ALL_PORTS, EUROPEAN_CITIES, AFRICAN_POSTS } from './ports.js';
export { SEA_ZONE_DEFINITIONS, SEA_ZONE_TRANSIT_DISTANCES } from './regions.js';
export { SKILL_DOMAINS } from './skills.js';
export { AGENT_TYPE_CONFIGS } from './agents.js';
export { ECONOMY } from './economy.js';
export { NAVY_CONFIG } from './navy.js';
export { getLLMProviderConfig, getProprioceptionLimits } from './providers.js';

// New physical world configs
export { ALL_PLACES, PORT_PLACES, PLACE_TEMPLATES, EUROPEAN_CITY_PLACES, AFRICAN_POST_PLACES, SPANISH_TOWN_PLACES } from './places.js';
export { PORT_DISTANCES } from './distances.js';
export { SEA_ROUTES, getRoute } from './sea-routes.js';
export { OVERLAND_ROUTES } from './overland-routes.js';
export { PLANTATIONS, getPortProduction } from './plantations.js';
export { WEATHER_PROFILES } from './weather-profiles.js';
export { HURRICANE_TRACKS, STORM_NAMES, HURRICANE_RISK_MULTIPLIER } from './hurricane-tracks.js';
export { WEATHER_EVENT_CONFIGS } from './weather-events.js';
export { PLACE_EXPOSURE, PLACE_ACTIVITY_SCHEDULE, PORT_REGION_MAP, getPlaceExposure, getPortRegion, getPlaceWeatherImpact, isPlaceActive, getPlaceActivityLevel } from './place-weather.js';
export { CROP_DEFINITIONS, PORT_AGRICULTURE, canCropGrow, getCropsForPort } from './crops.js';
export { EXTRACTION_SITES, getExtractionSitesForPort, getFleetDependentSites } from './mines.js';
export { PROCESSING_CHAINS, PORT_PROCESSING } from './processing.js';
export { PLACE_ECONOMIC_ROLES } from './place-economics.js';
export { TRANSPORT_TYPES, TRANSPORT_CAPS, getTransportCap, getSpawnCondition, getCargoTemplate } from './isthmus-transport.js';
export { VESSEL_SPAWN_PROFILES, canPortBuild, getBuildableProfiles } from './vessel-spawning.js';
export { PRIZE_CARGO_PROFILES, getPrizeProfilesForZone, getPrizeProfilesByShipClass } from './prize-cargo.js';
export { TREASURE_FLEETS, TREASURE_FAIRS, isFleetVulnerable, isFairActive } from './treasure-fleets.js';

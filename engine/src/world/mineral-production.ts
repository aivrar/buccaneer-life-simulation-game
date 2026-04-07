// Mineral and extraction production calculator
// Computes per-tick output for mines, fisheries, and animal product sources
//
// Key difference from crop production:
// - Mines are inland — weather affects the trans-shipment PORT, not the mine
// - Fleet-dependent sites only produce output when the treasure fleet is present
// - Fisheries and whaling are directly affected by sea weather
// - Ambergris is random chance, not steady production

import type { GameTime, WeatherState } from '../runtime/types.js';
import { WeatherCondition } from '../runtime/types.js';
import { EXTRACTION_SITES, type ExtractionSite } from '../config/mines.js';
import { TREASURE_FLEETS } from '../config/treasure-fleets.js';
import { PORT_PROFILES } from '../config/ports.js';

const TICKS_PER_YEAR = 1460; // 4 ticks/day × 365 days

// ============================================================
// Seasonal modifier — peak vs low months
// ============================================================

function getSeasonalModifier(site: ExtractionSite, month: number): number {
  if (site.peakMonths.includes(month)) return 1.4;
  if (site.lowMonths.includes(month)) return 0.3;
  return 1.0;
}

// ============================================================
// Weather modifier — how port weather affects output flow
// Mines themselves are unaffected, but storms block shipping
// Fisheries/whaling are directly weather-dependent
// ============================================================

function getWeatherModifier(site: ExtractionSite, condition: WeatherCondition): number {
  const vuln = site.weatherVulnerability;

  switch (condition) {
    case WeatherCondition.CLEAR:
      return 1.0;
    case WeatherCondition.CLOUDY:
      return 1.0;
    case WeatherCondition.RAIN:
      // Rain slows transport and fishing
      return 1.0 - vuln * 0.2;
    case WeatherCondition.FOG:
      // Fog delays shipping, prevents fishing
      return 1.0 - vuln * 0.3;
    case WeatherCondition.STORM:
      // Storms shut down ports and fisheries
      return Math.max(0.1, 1.0 - vuln * 0.7);
    case WeatherCondition.HURRICANE:
      // Hurricanes halt everything
      return Math.max(0, 1.0 - vuln);
    case WeatherCondition.BECALMED:
      // Becalmed = ships can't move cargo, but mines keep producing
      if (site.type === 'silver_mine' || site.type === 'gold_mine' || site.type === 'emerald_mine') {
        return 0.8; // slight delay in mule trains due to heat
      }
      return 1.0 - vuln * 0.2; // fisheries unaffected by calm
  }
}

// ============================================================
// Fleet modifier — treasure fleet gating
// Silver and gold from Spain's colonial mines only flow when
// the fleet system is operating. Between fleets, output accumulates
// but doesn't enter the trade network.
// ============================================================

function getFleetModifier(site: ExtractionSite, gameTime: GameTime): number {
  if (!site.fleetDependent) return 1.0;

  // Check if any treasure fleet is currently at or near this port
  for (const fleet of TREASURE_FLEETS) {
    // Check if fleet is in assembly/loading phase at the relevant port
    const portOnRoute = fleet.outboundRoute.includes(site.transShipmentPort) ||
                        fleet.assemblyPort === site.transShipmentPort;
    if (!portOnRoute) continue;

    // Fleet must be in its vulnerable/active months to be moving cargo
    if (fleet.vulnerableMonths.includes(gameTime.month)) {
      return 1.0; // fleet is active — cargo flows
    }

    // During assembly months at Havana, Portobelo/Cartagena cargo is being loaded
    if (fleet.assemblyMonths.includes(gameTime.month)) {
      if (site.transShipmentPort === 'portobelo' || site.transShipmentPort === 'cartagena' ||
          site.transShipmentPort === 'veracruz') {
        return 1.2; // loading frenzy — extra activity
      }
    }
  }

  // No fleet active — cargo accumulates at the port but doesn't flow into trade
  // Return a reduced rate representing warehousing/accumulation
  return 0.15;
}

// ============================================================
// Main: calculate per-tick output for an extraction site
// ============================================================

export interface ExtractionYield {
  siteId: string;
  cargoId: string;
  baseOutputPerTick: number;
  seasonalMod: number;
  weatherMod: number;
  fleetMod: number;
  finalOutputPerTick: number;
}

export function calculateExtractionYield(
  site: ExtractionSite,
  weather: WeatherState,
  gameTime: GameTime,
): ExtractionYield {
  const basePerTick = site.annualOutput / TICKS_PER_YEAR;

  // Ambergris is random — not steady production
  if (site.type === 'ambergris') {
    const seasonalMod = getSeasonalModifier(site, gameTime.month);
    const weatherMod = getWeatherModifier(site, weather.condition);
    // Random chance per tick — roughly matches annual output over a year
    const roll = Math.random();
    const threshold = basePerTick * seasonalMod * weatherMod;
    const found = roll < threshold ? 1.0 : 0;
    return {
      siteId: site.id,
      cargoId: site.cargoId,
      baseOutputPerTick: basePerTick,
      seasonalMod,
      weatherMod,
      fleetMod: 1.0,
      finalOutputPerTick: found,
    };
  }

  const seasonalMod = getSeasonalModifier(site, gameTime.month);
  const weatherMod = getWeatherModifier(site, weather.condition);
  const fleetMod = getFleetModifier(site, gameTime);

  const finalOutput = basePerTick * seasonalMod * weatherMod * fleetMod;

  return {
    siteId: site.id,
    cargoId: site.cargoId,
    baseOutputPerTick: basePerTick,
    seasonalMod,
    weatherMod,
    fleetMod,
    finalOutputPerTick: Math.max(0, finalOutput),
  };
}

// ============================================================
// Convenience: all extraction yields for a port
// ============================================================

export function calculatePortExtraction(
  portId: string,
  weatherMap: Map<string, WeatherState>,
  gameTime: GameTime,
): ExtractionYield[] {
  const sites = EXTRACTION_SITES.filter(s => s.transShipmentPort === portId);
  if (sites.length === 0) return [];

  const portProfile = PORT_PROFILES[portId];
  let weather: WeatherState | undefined;
  if (portProfile) {
    weather = weatherMap.get(portProfile.seaZoneId);
  }
  if (!weather) {
    for (const [, w] of weatherMap) { weather = w; break; }
  }
  if (!weather) return [];

  return sites.map(site => calculateExtractionYield(site, weather, gameTime));
}

// ============================================================
// Aggregate: total extraction output per cargo type for a port
// ============================================================

export function getPortTickExtraction(
  portId: string,
  weatherMap: Map<string, WeatherState>,
  gameTime: GameTime,
): Record<string, number> {
  const yields = calculatePortExtraction(portId, weatherMap, gameTime);
  const output: Record<string, number> = {};
  for (const y of yields) {
    output[y.cargoId] = (output[y.cargoId] ?? 0) + y.finalOutputPerTick;
  }
  return output;
}

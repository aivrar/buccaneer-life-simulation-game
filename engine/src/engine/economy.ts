/**
 * Price Engine — calculates dynamic prices for all cargo types.
 * Uses supply/demand from port inventory, with modifiers for
 * disruption, season, and port economic role.
 */

import { CARGO_TYPES } from '../config/cargo.js';
import { ALL_PORTS } from '../config/ports.js';
import { ECONOMY } from '../config/economy.js';
import { getSupply } from '../world/port-inventory.js';

export interface PriceQuote {
  cargoType: string;
  buyPrice: number;    // what you pay the port
  sellPrice: number;   // what the port pays you
  supply: number;
  demand: number;
}

export interface MarketSnapshot {
  portId: string;
  quotes: Record<string, PriceQuote>;
}

// In-memory demand state: portId → cargoType → current demand
const demandState = new Map<string, Map<string, number>>();

// In-memory disruption per port: 0-1
const portDisruption = new Map<string, number>();

export function getPortDemand(portId: string, cargoType: string): number {
  return demandState.get(portId)?.get(cargoType) ?? getBaseDemand(portId, cargoType);
}

function getBaseDemand(portId: string, cargoType: string): number {
  const cargo = CARGO_TYPES[cargoType];
  if (!cargo) return 30;

  if (cargo.destinations.includes(portId)) return 100;
  if (cargo.origins.includes(portId)) return 10;
  return 30; // transit port
}

export function setDemand(portId: string, cargoType: string, value: number): void {
  let portMap = demandState.get(portId);
  if (!portMap) {
    portMap = new Map();
    demandState.set(portId, portMap);
  }
  portMap.set(cargoType, value);
}

export function setDisruption(portId: string, value: number): void {
  portDisruption.set(portId, Math.min(1.0, Math.max(0, value)));
}

export function getDisruption(portId: string): number {
  return portDisruption.get(portId) ?? 0;
}

/**
 * Calculate price for a specific cargo at a specific port.
 */
export function calculatePrice(portId: string, cargoType: string, month?: number): PriceQuote {
  const cargo = CARGO_TYPES[cargoType];
  if (!cargo) {
    return { cargoType, buyPrice: 0, sellPrice: 0, supply: 0, demand: 0 };
  }

  const port = ALL_PORTS[portId];
  const basePrice = cargo.basePrice;
  const supply = getSupply(portId, cargoType);
  const demand = getPortDemand(portId, cargoType);

  // Supply/demand ratio → price multiplier
  const { glutThreshold, shortageThreshold, priceMultiplierGlut, priceMultiplierShortage } = ECONOMY.market;

  let supplyDemandMod: number;
  if (demand <= 0) {
    supplyDemandMod = priceMultiplierGlut;
  } else {
    const ratio = supply / demand;
    if (ratio >= glutThreshold) {
      supplyDemandMod = priceMultiplierGlut;
    } else if (ratio <= shortageThreshold) {
      supplyDemandMod = priceMultiplierShortage;
    } else {
      // Linear interpolation: shortage→glut maps to high→low multiplier
      const t = (ratio - shortageThreshold) / (glutThreshold - shortageThreshold);
      supplyDemandMod = priceMultiplierShortage + t * (priceMultiplierGlut - priceMultiplierShortage);
    }
  }

  // Disruption modifier (piracy/war)
  const disruption = getDisruption(portId);
  const disruptionMod = 1.0 + disruption * 0.5; // 1.0 to 1.5

  // Seasonal modifier
  let seasonalMod = 1.0;
  if (month !== undefined) {
    const isOrigin = cargo.origins.includes(portId);
    if (isOrigin) {
      // Rough harvest season check: tropical crops peak Jun-Nov
      const inHarvest = month >= 6 && month <= 11;
      seasonalMod = inHarvest ? 0.9 : 1.15;
    }
  }

  const effectivePrice = basePrice * supplyDemandMod * disruptionMod * seasonalMod;

  // Buy/sell spread based on port character
  let spreadFactor = 0.80; // default: port pays you 80% of price
  if (port?.pirateFriendly) {
    spreadFactor = 0.85; // pirate-friendly: tighter spread
  } else if (port && port.corruption >= 70) {
    spreadFactor = 0.75; // corrupt: wider spread, but accepts hot goods
  }

  const buyPrice = Math.round(effectivePrice * 100) / 100;
  const sellPrice = Math.round(effectivePrice * spreadFactor * 100) / 100;

  return { cargoType, buyPrice, sellPrice, supply, demand };
}

/**
 * Update demand: decay toward base, modified by population.
 */
export function tickDemand(portId: string, cargoType: string): void {
  const current = getPortDemand(portId, cargoType);
  const base = getBaseDemand(portId, cargoType);
  const port = ALL_PORTS[portId];

  // Population modifier: larger ports have stronger demand pull
  const popMod = port ? Math.max(0.5, Math.min(2.0, port.population / 5000)) : 1.0;
  const adjustedBase = base * popMod;

  // Decay 0.5% per tick toward adjusted base
  const decayRate = ECONOMY.market.demandDecayRate;
  const newDemand = current + (adjustedBase - current) * decayRate;

  setDemand(portId, cargoType, Math.max(1, newDemand));
}

/**
 * Adjust supply/demand when a transaction happens and recalculate.
 */
export function updateMarket(portId: string, cargoType: string, supplyDelta: number): void {
  // Demand spikes when goods are purchased (negative supplyDelta)
  if (supplyDelta < 0) {
    const currentDemand = getPortDemand(portId, cargoType);
    setDemand(portId, cargoType, currentDemand + Math.abs(supplyDelta) * 0.1);
  }
}

/**
 * Get all prices for a port.
 */
export function getMarketSnapshot(portId: string, month?: number): MarketSnapshot {
  const quotes: Record<string, PriceQuote> = {};
  for (const cargoType of Object.keys(CARGO_TYPES)) {
    quotes[cargoType] = calculatePrice(portId, cargoType, month);
  }
  return { portId, quotes };
}

export function resetEconomyState(): void {
  demandState.clear();
  portDisruption.clear();
}

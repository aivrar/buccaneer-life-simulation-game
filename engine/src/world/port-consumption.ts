/**
 * Port Consumption — drains supplies from port inventory each tick.
 * Population eats, ships burn supplies, garrisons consume military goods,
 * and perishables decay.
 */

import { ALL_PORTS } from '../config/ports.js';
import { CARGO_TYPES } from '../config/cargo.js';
import { getPlaceWeatherImpact } from '../config/place-weather.js';
import { removeSupply, getSupply } from './port-inventory.js';
import type { WeatherCondition } from '../runtime/types.js';

export interface ConsumptionResult {
  portId: string;
  consumed: Record<string, number>;    // cargoType → amount consumed
  shortages: string[];                 // cargo types that ran out
  spoiled: Record<string, number>;     // cargoType → amount spoiled
}

// Per 1000 population per tick (reduced ~60% from original to balance against production)
const POP_CONSUMPTION: Record<string, number> = {
  provisions: 0.02,
  flour: 0.008,
  salt_meat: 0.004,
  rum: 0.004,
  citrus: 0.004,
  salt: 0.002,
};

// Essential goods that should never fully drain — represents local subsistence outside sim scope
const ESSENTIAL_GOODS = new Set(['provisions', 'flour', 'salt_meat', 'rum']);
const ESSENTIAL_SUPPLY_FLOOR = 20;

// Per docked ship per tick
const SHIP_CONSUMPTION: Record<string, number> = {
  cordage: 0.01,
  sailcloth: 0.005,
  naval_stores: 0.005,
  ship_hardware: 0.01,
};

// Per 100 fort_strength per tick
const GARRISON_CONSUMPTION: Record<string, number> = {
  gunpowder: 0.02,
  provisions: 0.01,
  muskets: 0.005,
};

const PERISHABLE_DECAY_RATE = 0.02; // 2% per tick base

export function applyConsumption(
  portId: string,
  weatherCondition: WeatherCondition,
  dockedShipCount?: number,
): ConsumptionResult {
  const port = ALL_PORTS[portId];
  if (!port) return { portId, consumed: {}, shortages: [], spoiled: {} };

  const consumed: Record<string, number> = {};
  const shortages: string[] = [];
  const spoiled: Record<string, number> = {};

  // A. Population consumption
  const popScale = port.population / 1000;
  for (const [cargo, rate] of Object.entries(POP_CONSUMPTION)) {
    const amount = rate * popScale;
    if (amount <= 0) continue;
    const available = getSupply(portId, cargo);
    // Enforce supply floor for essential goods
    const floor = ESSENTIAL_GOODS.has(cargo) ? ESSENTIAL_SUPPLY_FLOOR : 0;
    const consumable = Math.max(0, available - floor);
    if (consumable <= 0) {
      shortages.push(cargo);
    } else if (consumable < amount) {
      removeSupply(portId, cargo, consumable);
      consumed[cargo] = (consumed[cargo] ?? 0) + consumable;
      shortages.push(cargo);
    } else {
      removeSupply(portId, cargo, amount);
      consumed[cargo] = (consumed[cargo] ?? 0) + amount;
    }
  }

  // B. Ship maintenance consumption
  const shipCount = dockedShipCount ?? Math.floor((port.harbor.anchorageCapacity ?? 10) * 0.3);
  for (const [cargo, rate] of Object.entries(SHIP_CONSUMPTION)) {
    const amount = rate * shipCount;
    if (amount <= 0) continue;
    const available = getSupply(portId, cargo);
    if (available < amount) {
      if (available > 0) {
        removeSupply(portId, cargo, available);
        consumed[cargo] = (consumed[cargo] ?? 0) + available;
      }
      shortages.push(cargo);
    } else {
      removeSupply(portId, cargo, amount);
      consumed[cargo] = (consumed[cargo] ?? 0) + amount;
    }
  }

  // C. Garrison consumption
  const fortScale = port.fortStrength / 100;
  if (fortScale > 0) {
    for (const [cargo, rate] of Object.entries(GARRISON_CONSUMPTION)) {
      const amount = rate * fortScale;
      if (amount <= 0) continue;
      const available = getSupply(portId, cargo);
      if (available < amount) {
        if (available > 0) {
          removeSupply(portId, cargo, available);
          consumed[cargo] = (consumed[cargo] ?? 0) + available;
        }
        shortages.push(cargo);
      } else {
        removeSupply(portId, cargo, amount);
        consumed[cargo] = (consumed[cargo] ?? 0) + amount;
      }
    }
  }

  // D. Trade good consumption at destination ports — the colonial economy uses goods.
  // Without this, supply regenerates to 50 and stays there, killing trade margins.
  // Consumption is proportional to population: bigger ports consume more.
  const TRADE_CONSUMPTION_RATE = 0.003; // per 1000 pop per tick for destination goods
  for (const [cargoId, cargoConfig] of Object.entries(CARGO_TYPES)) {
    if (!cargoConfig.destinations.includes(portId)) continue;
    if (cargoConfig.category === 'provision') continue; // already handled above
    const amount = TRADE_CONSUMPTION_RATE * popScale;
    if (amount <= 0.001) continue;
    const available = getSupply(portId, cargoId);
    if (available > 5) { // don't drain below 5 — leaves small supply for traders
      const drain = Math.min(amount, available - 5);
      removeSupply(portId, cargoId, drain);
      consumed[cargoId] = (consumed[cargoId] ?? 0) + drain;
    }
  }

  // E. Perishable decay
  const warehouseImpact = getPlaceWeatherImpact('warehouse', weatherCondition);
  const spoilageRisk = warehouseImpact.goodsSpoilageRisk;

  for (const [cargoId, cargoType] of Object.entries(CARGO_TYPES)) {
    if (!cargoType.perishable) continue;
    const supply = getSupply(portId, cargoId);
    if (supply <= 0) continue;

    const decayRate = PERISHABLE_DECAY_RATE + spoilageRisk;
    const loss = supply * decayRate;
    if (loss > 0.001) {
      removeSupply(portId, cargoId, Math.min(loss, supply));
      spoiled[cargoId] = loss;
    }
  }

  return { portId, consumed, shortages: [...new Set(shortages)], spoiled };
}

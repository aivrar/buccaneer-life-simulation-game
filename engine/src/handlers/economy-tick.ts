/**
 * Economy Tick Handler — orchestrates the full port economy loop.
 * Each tick: production → processing → consumption → price update.
 */

import type { TickHandler, TickContext } from '../runtime/types.js';
import { TickPhase, WeatherCondition } from '../runtime/types.js';
import { ALL_PORTS } from '../config/ports.js';
import { CARGO_TYPES } from '../config/cargo.js';
import { getWeatherState } from './weather-tick.js';
import { getPortTickProduction } from '../world/crop-production.js';
import { getPortTickExtraction } from '../world/mineral-production.js';
import { runProcessing } from '../world/processing-engine.js';
import { applyConsumption } from '../world/port-consumption.js';
import { addSupply, getSupply, getAllInventory, initializeInventory } from '../world/port-inventory.js';
import { calculatePrice, tickDemand } from '../engine/economy.js';
import { ECONOMY } from '../config/economy.js';
import { tickIsthmusTransports } from '../world/isthmus-transport.js';
import { tickVesselSpawner, dispatchNPCShips } from '../world/vessel-spawner.js';
import { MarketQueries, AgentQueries } from '../db/queries.js';
import { departShip } from '../handlers/travel-tick.js';

let initialized = false;

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // Load starting inventory from market_prices.supply
  for (const portId of Object.keys(ALL_PORTS)) {
    const rows = await MarketQueries.getByPort(portId);
    for (const row of rows) {
      initializeInventory(portId, row.cargo_type, row.supply);
    }
  }
}

export const economyTickHandler: TickHandler = {
  name: 'economy-tick',
  phase: TickPhase.ECONOMY,

  async execute(tick: TickContext): Promise<void> {
    await ensureInitialized();

    const weatherMap = getWeatherState();
    const portIds = Object.keys(ALL_PORTS);

    // Track which port/cargo combos changed for price update
    const changedCargos = new Map<string, Set<string>>();

    function markChanged(portId: string, cargoType: string) {
      let set = changedCargos.get(portId);
      if (!set) {
        set = new Set();
        changedCargos.set(portId, set);
      }
      set.add(cargoType);
    }

    for (const portId of portIds) {
      const port = ALL_PORTS[portId];
      const seaZoneWeather = weatherMap.get(port.seaZoneId);
      const condition: WeatherCondition = seaZoneWeather?.condition ?? WeatherCondition.CLEAR;

      // 1. Production inflow — crops (capped at 500 to prevent infinite accumulation)
      const cropOutput = getPortTickProduction(portId, weatherMap, tick.gameTime);
      for (const [cargoType, amount] of Object.entries(cropOutput)) {
        if (amount > 0 && getSupply(portId, cargoType) < 500) {
          addSupply(portId, cargoType, amount);
          markChanged(portId, cargoType);
        }
      }

      // 1b. Production inflow — extraction (mines, fisheries) — same 500 cap
      const extractionOutput = getPortTickExtraction(portId, weatherMap, tick.gameTime);
      for (const [cargoType, amount] of Object.entries(extractionOutput)) {
        if (amount > 0 && getSupply(portId, cargoType) < 500) {
          addSupply(portId, cargoType, amount);
          markChanged(portId, cargoType);
        }
      }

      // 2. Processing — transform raw → finished
      const processingResults = runProcessing(portId, tick.tickNumber);
      for (const result of processingResults) {
        markChanged(portId, result.inputCargo);
        markChanged(portId, result.outputCargo);
        if (result.byproductCargo) {
          markChanged(portId, result.byproductCargo);
        }
      }

      // 3. Consumption drain
      const consumptionResult = applyConsumption(portId, condition);
      for (const cargoType of Object.keys(consumptionResult.consumed)) {
        markChanged(portId, cargoType);
      }
      for (const cargoType of Object.keys(consumptionResult.spoiled)) {
        markChanged(portId, cargoType);
      }
    }

    // 3b. Baseline supply regeneration — uses supplyRegenerationRate from config.
    // Cargo types without plantations/mines (manufactured goods, imports, military
    // supplies) would otherwise stay at zero forever. This represents off-screen
    // trade ships bringing goods into port. Regenerates 1% per tick toward a
    // baseline of 50 units, capped at 500 to prevent infinite accumulation.
    const regenRate = ECONOMY.market.supplyRegenerationRate;
    const REGEN_BASELINE = 50;
    const REGEN_CAP = 500;
    for (const portId of portIds) {
      for (const cargoType of Object.keys(CARGO_TYPES)) {
        const current = getSupply(portId, cargoType);
        if (current >= REGEN_CAP) continue;
        // Regenerate toward baseline: add regenRate * (baseline - current) when below baseline
        if (current < REGEN_BASELINE) {
          const regenAmount = regenRate * (REGEN_BASELINE - current);
          if (regenAmount > 0.001) {
            addSupply(portId, cargoType, regenAmount);
            markChanged(portId, cargoType);
          }
        }
      }
    }

    // 3c. Merchant docked income — represents warehouse commissions, port-agent fees,
    // and small-scale local trade that happens off-screen. Without this, crew wages
    // during transit and pirate raids drain merchants to negative cash permanently.
    // Historical: Caribbean merchants maintained port warehouses and earned from storage.
    // Merchant docked income — scales with situation:
    //   Broke merchants (< 200g) get 8g/tick to recover from piracy losses
    //   Normal merchants (< 2000g) get 5g/tick for warehouse/commission income
    //   Wealthy merchants (>= 2000g) get nothing — they should be trading
    const merchantAgents = await AgentQueries.getByType('merchant_captain');
    for (const m of merchantAgents) {
      if (m.status !== 'in_port') continue;
      const income = m.cash < 200 ? 8 : m.cash < 2000 ? 5 : 0;
      if (income > 0) await AgentQueries.addCash(m.id, income);
    }

    // 4. Isthmus transports — spawn, advance, deliver, degrade
    const portoberoWeather = weatherMap.get(ALL_PORTS['portobelo']?.seaZoneId ?? '');
    const isthmusCondition: WeatherCondition = portoberoWeather?.condition ?? WeatherCondition.CLEAR;
    const transportResult = tickIsthmusTransports(tick.tickNumber, tick.gameTime.month, isthmusCondition);

    // Transport deliveries affect Portobelo inventory
    if (transportResult.arrived.length > 0 || transportResult.destroyed.length > 0) {
      for (const cargoType of Object.keys(CARGO_TYPES)) {
        markChanged('portobelo', cargoType);
      }
    }

    // 5. Vessel spawner — maintain fleet numbers (every 4th tick to reduce DB load)
    if (tick.tickNumber % 4 === 0) {
      await tickVesselSpawner(tick.tickNumber);
    }

    // 5b. NPC ship dispatch — send docked NPC ships on trade voyages
    await dispatchNPCShips(tick.tickNumber, departShip);

    // 6. Price update and demand decay — only for changed cargos
    const upsertPromises: Promise<unknown>[] = [];

    for (const portId of portIds) {
      const changed = changedCargos.get(portId);
      const cargosToUpdate = changed ?? new Set<string>();

      // Tick demand for all cargo types (cheap operation)
      for (const cargoType of Object.keys(CARGO_TYPES)) {
        tickDemand(portId, cargoType);
        cargosToUpdate.add(cargoType);
      }

      // Persist updated prices and supply to DB
      for (const cargoType of cargosToUpdate) {
        const quote = calculatePrice(portId, cargoType, tick.gameTime.month);
        upsertPromises.push(
          MarketQueries.upsert(
            portId,
            cargoType,
            quote.buyPrice,
            quote.sellPrice,
            Math.round(quote.supply),
            Math.round(quote.demand),
            tick.tickNumber,
          )
        );
      }
    }

    // Batch all DB writes
    await Promise.all(upsertPromises);
  },
};

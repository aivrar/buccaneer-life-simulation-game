import type { AgentState } from '../../runtime/types.js';
import { buyGoods, sellGoods, getTradeOptions } from '../trade.js';
import { sellStolenGoods } from '../fence-network.js';
import type { ActionResult } from './sail-to.js';
import { AgentQueries, CargoQueries, ShipQueries } from '../../db/queries.js';
import { CARGO_TYPES } from '../../config/cargo.js';
import { calculatePrice } from '../economy.js';

export async function executeBuyCargo(
  agent: AgentState,
  params: Record<string, unknown>,
): Promise<ActionResult> {
  if (!agent.shipId) return { success: false, message: 'No ship' };

  // Look up agent cash and ship capacity from DB
  const dbAgent = await AgentQueries.getById(agent.id);
  const ship = await ShipQueries.getById(agent.shipId);
  if (!dbAgent || !ship) return { success: false, message: 'Agent or ship not found' };

  const cash = dbAgent.cash;
  if (cash <= 0) return { success: false, message: 'No funds to buy cargo' };
  const availableSpace = ship.cargo_capacity - ship.cargo_used;
  if (availableSpace <= 0) return { success: false, message: 'No cargo space available' };

  let cargoType = params.cargo_type as string;
  let quantity = params.quantity as number | undefined;

  // If no cargo type specified, pick highest-margin cargo
  if (!cargoType) {
    const options = getTradeOptions(agent.portId);
    const affordable = options.filter(o => o.available && o.buyPrice > 0 && o.buyPrice <= cash);
    if (affordable.length === 0) return { success: false, message: 'Nothing available to buy' };

    // Score by route profit: buy here, sell at best destination port
    const scored = affordable.map(o => {
      const config = CARGO_TYPES[o.cargoType];
      if (!config) return { ...o, score: 0 };

      // Find best sell price at any destination port
      let bestDestSellPrice = 0;
      for (const destPort of config.destinations) {
        const destQuote = calculatePrice(destPort, o.cargoType);
        if (destQuote.sellPrice > bestDestSellPrice) {
          bestDestSellPrice = destQuote.sellPrice;
        }
      }

      // Route profit per unit (buy here, sell at best destination)
      const profitPerUnit = bestDestSellPrice - o.buyPrice;
      if (profitPerUnit <= 0) return { ...o, score: 0 };

      // How many can we afford/carry?
      const maxByCash = Math.floor((cash * 0.7) / Math.max(o.buyPrice, 1));
      const maxBySpace = Math.floor(availableSpace * 0.8);
      const maxBySupply = Math.floor(o.supply ?? 0);
      const buyableQty = Math.max(1, Math.min(maxByCash, maxBySpace, maxBySupply));

      // Total expected profit — naturally favors bulk commodities
      const totalProfit = profitPerUnit * buyableQty;

      // Origin bonus: goods sourced at this port are cheapest
      const isOrigin = config.origins.includes(agent.portId);
      const originBonus = isOrigin ? 1.5 : 1.0;

      return { ...o, score: totalProfit * originBonus };
    });

    // Filter out unprofitable routes
    const profitable = scored.filter(s => s.score > 0);
    if (profitable.length === 0) return { success: false, message: 'No profitable trade routes from this port' };

    profitable.sort((a, b) => b.score - a.score);
    cargoType = profitable[0]!.cargoType;
  }

  // Calculate smart quantity if not specified
  if (!quantity || quantity <= 0) {
    const options = getTradeOptions(agent.portId);
    const option = options.find(o => o.cargoType === cargoType);
    const buyPrice = option?.buyPrice ?? 1;
    const supply = option?.supply ?? 0;

    // Buy as much as we can: limited by cash, cargo space, and available supply
    // Use up to 70% of cash (keep some reserve) and up to 80% of free space
    const maxByCash = Math.floor((cash * 0.7) / Math.max(buyPrice, 1));
    const maxBySpace = Math.floor(availableSpace * 0.8);
    const maxBySupply = Math.floor(supply);

    quantity = Math.max(1, Math.min(maxByCash, maxBySpace, maxBySupply));
  }

  const result = await buyGoods(agent.id, agent.portId, agent.shipId, cargoType, quantity);
  return { success: result.success, message: result.message, data: { cargoType, quantity: result.quantity, totalPrice: result.totalPrice, unitPrice: result.unitPrice, cargoId: result.cargoId } };
}

export async function executeSellCargo(
  agent: AgentState,
  params: Record<string, unknown>,
): Promise<ActionResult> {
  const cargoId = params.cargo_id as string;
  const quantity = (params.quantity as number) ?? undefined;

  if (!cargoId) {
    // Auto-sell: find most valuable cargo we own (by total sell value at this port)
    const cargo = await CargoQueries.getByOwner(agent.id);
    const sellable = cargo.filter(c => c.heat === 0 && !c.seized_from && c.ship_id === agent.shipId);
    if (sellable.length === 0) return { success: false, message: 'No sellable cargo' };

    // Pick cargo with highest total sell value at current port
    const options = getTradeOptions(agent.portId);
    const ranked = sellable.map(c => {
      const opt = options.find(o => o.cargoType === c.type);
      const sellPrice = opt?.sellPrice ?? 0;
      return { cargo: c, totalValue: sellPrice * c.quantity };
    }).sort((a, b) => b.totalValue - a.totalValue);

    const best = ranked[0]!.cargo;
    const result = await sellGoods(agent.id, agent.portId, best.id, quantity ?? best.quantity);
    return { success: result.success, message: result.message, data: { cargoType: best.type, quantity: result.quantity, totalPrice: result.totalPrice, unitPrice: result.unitPrice, cargoId: result.cargoId } };
  }

  const cargo = await CargoQueries.getByOwner(agent.id);
  const item = cargo.find(c => c.id === cargoId);
  if (!item) return { success: false, message: 'Cargo not found' };

  const result = await sellGoods(agent.id, agent.portId, cargoId, quantity ?? item.quantity);
  return { success: result.success, message: result.message, data: { cargoType: item.type, quantity: result.quantity, totalPrice: result.totalPrice, unitPrice: result.unitPrice, cargoId: result.cargoId } };
}

export async function executeTradeCargo(
  agent: AgentState,
  params: Record<string, unknown>,
): Promise<ActionResult> {
  // Trade = sell what we have, then buy something new
  // First try to sell
  const cargo = await CargoQueries.getByOwner(agent.id);
  const sellable = cargo.filter(c => c.heat === 0 && !c.seized_from && c.ship_id === agent.shipId);

  let soldMessage = '';
  let totalSold = 0;
  let totalBought = 0;
  for (const item of sellable) {
    const result = await sellGoods(agent.id, agent.portId, item.id, item.quantity);
    if (result.success) {
      soldMessage += `Sold ${item.quantity} ${item.type}. `;
      totalSold += result.totalPrice ?? 0;
    }
  }

  // Then try to buy
  if (!agent.shipId) return { success: true, message: soldMessage || 'No ship for buying cargo', data: { totalSold, totalBought: 0 } };

  // Delegate to executeBuyCargo which handles smart cargo/quantity selection
  const buyResult = await executeBuyCargo(agent, { port: agent.portId });
  if (buyResult.success) {
    soldMessage += buyResult.message;
    totalBought += buyResult.data?.totalPrice as number ?? 0;
  }

  return { success: true, message: soldMessage || 'No profitable trades available', data: { totalSold, totalBought, buyData: buyResult.data } };
}

export async function executeSellPlunder(
  agent: AgentState,
  params: Record<string, unknown>,
  tick: number = 0,
): Promise<ActionResult> {
  // Sell hot cargo through fence network
  // Use DB port_id, NOT in-memory portId — these desync when agents are
  // imprisoned/released (Run 43: Thomas Vane in-memory="port_royal", DB="bridgetown")
  const dbAgent = await AgentQueries.getById(agent.id);
  const portId = dbAgent?.port_id || agent.portId;
  if (!portId) return { success: false, message: 'Not in port' };

  const cargo = await CargoQueries.getByOwner(agent.id);
  const hotCargo = cargo.filter(c => (c.heat > 0 || c.seized_from) && c.quantity > 0);

  if (hotCargo.length === 0) return { success: false, message: 'No plunder to sell' };

  let totalPayout = 0;
  let soldCount = 0;

  for (const item of hotCargo) {
    const result = await sellStolenGoods(agent.id, portId, item.id, item.quantity, tick);
    if (result.success && result.transaction) {
      totalPayout += result.transaction.netPayout;
      soldCount++;
    }
  }

  if (soldCount === 0) return { success: false, message: 'Could not sell plunder (no fence available?)' };

  return {
    success: true,
    message: `Fenced ${soldCount} cargo lot(s) for ${totalPayout} total`,
    data: { totalPayout, soldCount },
  };
}

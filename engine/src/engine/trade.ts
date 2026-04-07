/**
 * Trade transactions — buy/sell goods at port markets.
 */

import { v4 as uuid } from 'uuid';
import { AgentQueries, CargoQueries, ShipQueries } from '../db/queries.js';
import { calculatePrice, updateMarket, type PriceQuote } from './economy.js';
import { addSupply, removeSupply, getSupply } from '../world/port-inventory.js';
import { CARGO_TYPES } from '../config/cargo.js';

export interface TradeResult {
  success: boolean;
  message: string;
  cargoId?: string;
  quantity?: number;
  totalPrice?: number;
  unitPrice?: number;
  data?: Record<string, unknown>;
}

export interface TradeOption {
  cargoType: string;
  name: string;
  buyPrice: number;
  sellPrice: number;
  supply: number;
  demand: number;
  available: boolean;
}

export async function buyGoods(
  agentId: string,
  portId: string,
  shipId: string,
  cargoType: string,
  quantity: number,
): Promise<TradeResult> {
  const agent = await AgentQueries.getById(agentId);
  if (!agent) return { success: false, message: 'Agent not found' };
  if (agent.port_id !== portId) return { success: false, message: 'Agent not at this port' };

  const ship = await ShipQueries.getById(shipId);
  if (!ship) return { success: false, message: 'Ship not found' };
  if (ship.status !== 'docked' || ship.port_id !== portId) return { success: false, message: 'Ship not docked at this port' };

  const cargoConfig = CARGO_TYPES[cargoType];
  if (!cargoConfig) return { success: false, message: 'Unknown cargo type' };

  // Check supply
  const supply = getSupply(portId, cargoType);
  if (supply < quantity) return { success: false, message: `Insufficient supply (${Math.floor(supply)} available)` };

  // Check price
  const quote = calculatePrice(portId, cargoType);
  const totalPrice = quote.buyPrice * quantity;
  if (agent.cash < totalPrice) return { success: false, message: `Insufficient funds (need ${totalPrice}, have ${agent.cash})` };

  // Check cargo space
  const availableSpace = ship.cargo_capacity - ship.cargo_used;
  if (quantity > availableSpace) return { success: false, message: `Insufficient cargo space (${availableSpace} available)` };

  // Execute trade
  await AgentQueries.addCash(agentId, -totalPrice);
  removeSupply(portId, cargoType, quantity);
  updateMarket(portId, cargoType, -quantity);

  const cargoId = uuid();
  await CargoQueries.insert({
    id: cargoId,
    type: cargoType,
    quantity,
    ship_id: shipId,
    port_id: null,
    owner_agent_id: agentId,
    heat: 0,
    seized_from: null,
    origin_port_id: portId,
    heat_decay_rate: 0,
  });

  return {
    success: true,
    message: `Bought ${quantity} ${cargoType} for ${totalPrice}`,
    cargoId,
    quantity,
    totalPrice,
    unitPrice: quote.buyPrice,
  };
}

export async function sellGoods(
  agentId: string,
  portId: string,
  cargoId: string,
  quantity: number,
): Promise<TradeResult> {
  const agent = await AgentQueries.getById(agentId);
  if (!agent) return { success: false, message: 'Agent not found' };
  if (agent.port_id !== portId) return { success: false, message: 'Agent not at this port' };

  const cargo = await CargoQueries.getByOwner(agentId);
  const cargoItem = cargo.find(c => c.id === cargoId);
  if (!cargoItem) return { success: false, message: 'Cargo not found or not owned by agent' };
  if (cargoItem.quantity < quantity) return { success: false, message: `Only have ${cargoItem.quantity} units` };

  // Hot cargo penalty at non-pirate-friendly ports is handled by the fence system.
  // Regular trade rejects very hot goods.
  if (cargoItem.heat > 50) return { success: false, message: 'Cargo too hot to sell on open market — use a fence' };

  const quote = calculatePrice(portId, cargoItem.type);
  const totalPrice = quote.sellPrice * quantity;

  // Execute trade
  await AgentQueries.addCash(agentId, totalPrice);
  addSupply(portId, cargoItem.type, quantity);
  updateMarket(portId, cargoItem.type, quantity);

  if (quantity >= cargoItem.quantity) {
    await CargoQueries.remove(cargoId);
  } else {
    await CargoQueries.updateQuantity(cargoId, cargoItem.quantity - quantity);
  }

  return {
    success: true,
    message: `Sold ${quantity} ${cargoItem.type} for ${totalPrice}`,
    cargoId,
    quantity,
    totalPrice,
    unitPrice: quote.sellPrice,
  };
}

export function getTradeOptions(portId: string, month?: number): TradeOption[] {
  const options: TradeOption[] = [];
  for (const [cargoType, config] of Object.entries(CARGO_TYPES)) {
    const quote = calculatePrice(portId, cargoType, month);
    const supply = getSupply(portId, cargoType);
    options.push({
      cargoType,
      name: config.name,
      buyPrice: quote.buyPrice,
      sellPrice: quote.sellPrice,
      supply,
      demand: quote.demand,
      available: supply > 0 && quote.buyPrice > 0,
    });
  }
  return options;
}

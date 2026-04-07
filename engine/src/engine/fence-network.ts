/**
 * Fence network — selling stolen goods through illicit buyers.
 */

import { AgentQueries, CargoQueries, FenceQueries } from '../db/queries.js';
import { ECONOMY } from '../config/economy.js';
import { calculatePrice } from './economy.js';

export interface FenceTransaction {
  fenceId: string;
  cargoId: string;
  baseValue: number;
  heatModifier: number;
  trustModifier: number;
  fenceCut: number;
  netPayout: number;
}

export interface SellResult {
  success: boolean;
  message: string;
  transaction?: FenceTransaction;
}

export async function sellStolenGoods(
  agentId: string,
  portId: string,
  cargoId: string,
  quantity: number,
  currentTick: number = 0,
): Promise<SellResult> {
  const agent = await AgentQueries.getById(agentId);
  if (!agent) return { success: false, message: 'Agent not found' };
  if (agent.port_id !== portId) return { success: false, message: 'Agent not at this port' };

  // Find a fence at this port
  const fences = await FenceQueries.getByPort(portId);
  if (fences.length === 0) return { success: false, message: 'No fence available at this port' };

  // Pick the best available fence (highest tier)
  // Tier 1+ fences are always available — only tier 0 uses the availability roll
  const availableFences = fences.filter(f => f.tier >= 1 || Math.random() * 100 < f.availability);
  if (availableFences.length === 0) return { success: false, message: 'No fence currently available' };
  const fence = availableFences.sort((a, b) => b.tier - a.tier)[0]!;

  // Get cargo
  const allCargo = await CargoQueries.getByOwner(agentId);
  const cargo = allCargo.find(c => c.id === cargoId);
  if (!cargo) return { success: false, message: 'Cargo not found' };
  if (cargo.quantity < quantity) return { success: false, message: 'Insufficient quantity' };

  // Calculate payout
  const quote = calculatePrice(portId, cargo.type);
  const baseValue = quote.sellPrice * quantity;

  // Heat modifier: higher heat = slightly lower price (reduced penalty)
  // Old: 0.5x at heat 100. New: 0.8x at heat 100 — fences expect hot goods
  const heatModifier = Math.max(0.5, 1.0 - (cargo.heat / 100) * 0.2);

  // Trust modifier: higher trust = better price
  const trustModifier = 0.8 + (fence.trust / 100) * 0.2;

  // Plunder discount: fences pay BELOW market — the seller has no leverage and
  // the fence takes on risk of discovery. Historical: fences paid 20-40% of value.
  // 0.8x balances against the 30% cut to give pirates ~50% of market value net.
  const plunderMultiplier = 0.8;

  // Fence cut from tier
  const tierConfig = ECONOMY.fenceTiers[fence.tier];
  const cutPercentage = tierConfig?.cutPercentage ?? fence.cut_percentage;
  const boostedValue = baseValue * plunderMultiplier;
  const fenceCut = boostedValue * (cutPercentage / 100);

  const netPayout = Math.max(quantity, Math.round(boostedValue * heatModifier * trustModifier - fenceCut));

  // Execute transaction
  await AgentQueries.addCash(agentId, netPayout);

  if (quantity >= cargo.quantity) {
    await CargoQueries.remove(cargoId);
  } else {
    await CargoQueries.updateQuantity(cargoId, cargo.quantity - quantity);
  }

  // Reduce heat on remaining cargo
  const { fenceSaleReduction } = ECONOMY.heatDecay;
  if (quantity < cargo.quantity) {
    const newHeat = Math.max(0, cargo.heat - fenceSaleReduction);
    await CargoQueries.updateHeat(cargoId, newHeat);
  }

  // Update fence trust
  const newTrust = Math.min(100, fence.trust + 2);
  await FenceQueries.updateTrust(fence.id, newTrust, currentTick);

  // Check for tier advancement (trust thresholds from config)
  if (fence.tier < 5) {
    const nextTier = fence.tier + 1;
    const nextConfig = ECONOMY.fenceTiers[nextTier];
    if (nextConfig && newTrust >= nextConfig.minTrust) {
      await FenceQueries.updateTier(fence.id, nextTier);
    }
  }

  const transaction: FenceTransaction = {
    fenceId: fence.id,
    cargoId,
    baseValue,
    heatModifier,
    trustModifier,
    fenceCut,
    netPayout,
  };

  return {
    success: true,
    message: `Sold ${quantity} ${cargo.type} through fence for ${netPayout}`,
    transaction,
  };
}

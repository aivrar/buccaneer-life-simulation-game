/**
 * Processing Engine — executes processing chains per tick.
 * If a port has the facility and raw materials, it automatically
 * converts inputs to outputs (+ byproducts).
 */

import { PROCESSING_CHAINS, PORT_PROCESSING } from '../config/processing.js';
import { addSupply, removeSupply, getSupply } from './port-inventory.js';

export interface ProcessingResult {
  chainId: string;
  portId: string;
  inputCargo: string;
  inputConsumed: number;
  outputCargo: string;
  outputProduced: number;
  byproductCargo?: string;
  byproductProduced?: number;
}

// Track last-processed tick per chain per port: "${portId}:${chainId}" → tick
const lastProcessedTick = new Map<string, number>();

export function runProcessing(portId: string, tick: number): ProcessingResult[] {
  const profile = PORT_PROCESSING[portId];
  if (!profile) return [];

  const results: ProcessingResult[] = [];

  for (const chain of PROCESSING_CHAINS) {
    // Port must have the required facility
    if (!profile.facilities.includes(chain.facilityType)) continue;

    // Port must be in the chain's processing ports list
    if (!chain.processingPorts.includes(portId)) continue;

    // Rate limit: respect cycleTimeTicks
    const key = `${portId}:${chain.id}`;
    const lastTick = lastProcessedTick.get(key) ?? -Infinity;
    if (tick - lastTick < chain.cycleTimeTicks) continue;

    // Check if port has enough input
    const available = getSupply(portId, chain.inputCargo);
    if (available < chain.inputPerUnit) continue;

    // Consume input, produce output
    if (!removeSupply(portId, chain.inputCargo, chain.inputPerUnit)) continue;

    // Coins are currency, not tradeable cargo — skip adding to port supply
    if (chain.outputCargo !== 'coins') {
      addSupply(portId, chain.outputCargo, chain.outputPerCycle);
    }

    const result: ProcessingResult = {
      chainId: chain.id,
      portId,
      inputCargo: chain.inputCargo,
      inputConsumed: chain.inputPerUnit,
      outputCargo: chain.outputCargo,
      outputProduced: chain.outputPerCycle,
    };

    // Byproduct
    if (chain.byproductCargo && chain.byproductPerCycle) {
      addSupply(portId, chain.byproductCargo, chain.byproductPerCycle);
      result.byproductCargo = chain.byproductCargo;
      result.byproductProduced = chain.byproductPerCycle;
    }

    lastProcessedTick.set(key, tick);
    results.push(result);
  }

  return results;
}

export function resetProcessingState(): void {
  lastProcessedTick.clear();
}

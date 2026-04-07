/**
 * Port Inventory — In-memory supply ledger.
 * Central state: portId → cargoType → quantity.
 * Initialized from market_prices.supply at startup, synced back each tick.
 */

// portId → cargoType → quantity
const inventory = new Map<string, Map<string, number>>();

export function initializeInventory(portId: string, cargoType: string, quantity: number): void {
  let portMap = inventory.get(portId);
  if (!portMap) {
    portMap = new Map();
    inventory.set(portId, portMap);
  }
  portMap.set(cargoType, quantity);
}

export function addSupply(portId: string, cargoType: string, amount: number): void {
  let portMap = inventory.get(portId);
  if (!portMap) {
    portMap = new Map();
    inventory.set(portId, portMap);
  }
  const current = portMap.get(cargoType) ?? 0;
  portMap.set(cargoType, current + amount);
}

export function removeSupply(portId: string, cargoType: string, amount: number): boolean {
  const portMap = inventory.get(portId);
  if (!portMap) return false;
  const current = portMap.get(cargoType) ?? 0;
  if (current < amount) return false;
  const newAmount = current - amount;
  if (newAmount <= 0.001) {
    portMap.delete(cargoType);
  } else {
    portMap.set(cargoType, newAmount);
  }
  return true;
}

export function getSupply(portId: string, cargoType: string): number {
  return inventory.get(portId)?.get(cargoType) ?? 0;
}

export function getPortSupplies(portId: string): Record<string, number> {
  const portMap = inventory.get(portId);
  if (!portMap) return {};
  const result: Record<string, number> = {};
  for (const [cargo, qty] of portMap) {
    result[cargo] = qty;
  }
  return result;
}

export function getAllInventory(): Map<string, Map<string, number>> {
  return inventory;
}

export function clearInventory(): void {
  inventory.clear();
}

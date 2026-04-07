/**
 * Plunder heat timers and decay.
 * Tracks how "hot" stolen cargo is, applying decay over time
 * and modifying sale prices and detection risk accordingly.
 */

export interface CargoHeatEntry {
  cargoId: string;
  initialHeat: number;
  currentHeat: number;
  acquiredTick: number;
  originPortId: string;
}

export function applyHeatDecay(entry: CargoHeatEntry, currentTick: number, decayRate: number): CargoHeatEntry {
  // TODO: Implement heat decay over time
  // - Linear or exponential decay based on elapsed ticks
  // - Floor at zero
  const elapsed = currentTick - entry.acquiredTick;
  const decayed = Math.max(0, entry.initialHeat - elapsed * decayRate);
  return { ...entry, currentHeat: decayed };
}

export function getPriceModifier(heat: number): number {
  // TODO: Higher heat = lower fence price
  // Returns multiplier 0.0 - 1.0
  return heat <= 0 ? 1.0 : Math.max(0.1, 1.0 - heat * 0.1);
}

export function getDetectionRisk(heat: number): number {
  // Higher heat = greater chance authorities notice
  // Returns probability 0.0 - 1.0
  // At heat 30: 15%, heat 50: 25%, heat 80: 40%
  if (heat <= 0) return 0;
  return Math.min(0.6, 0.05 + heat * 0.005);
}

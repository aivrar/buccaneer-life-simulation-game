/**
 * Intelligence generation, propagation, and decay.
 * Models how information about ship movements, cargo manifests,
 * and fleet positions spreads through the world and becomes stale.
 */

export type IntelType = 'ship_sighting' | 'cargo_manifest' | 'fleet_movement' | 'port_defenses' | 'trade_route' | 'treasure_rumor';

export interface IntelReport {
  id: string;
  type: IntelType;
  sourcePortId: string;
  subjectId: string;      // ship/fleet/port this intel is about
  accuracy: number;       // 0.0 - 1.0 (degrades over time)
  createdTick: number;
  data: Record<string, unknown>;
}

export function generateIntel(type: IntelType, sourcePortId: string, subjectId: string, tick: number): IntelReport {
  // TODO: Create intel report from observations
  // - Accuracy depends on source quality and proximity
  return {
    id: `intel_${tick}_${subjectId}`,
    type,
    sourcePortId,
    subjectId,
    accuracy: 1.0,
    createdTick: tick,
    data: {},
  };
}

export function decayIntel(report: IntelReport, currentTick: number, halfLifeTicks: number): IntelReport {
  // TODO: Reduce accuracy over time
  const age = currentTick - report.createdTick;
  const decayedAccuracy = report.accuracy * Math.pow(0.5, age / halfLifeTicks);
  return { ...report, accuracy: Math.max(0, decayedAccuracy) };
}

export function propagateIntel(report: IntelReport, targetPortId: string, delayTicks: number): IntelReport {
  // TODO: Spread intel to another port with delay and accuracy loss
  return {
    ...report,
    sourcePortId: targetPortId,
    accuracy: report.accuracy * 0.8,
    createdTick: report.createdTick + delayTicks,
  };
}

/**
 * Sea lane control and patrol density.
 * Tracks which factions control which sea lanes, patrol
 * intensity, and the effects on travel safety and commerce.
 */

export interface SeaLane {
  id: string;
  fromPortId: string;
  toPortId: string;
  controllingFaction: string | null;
  patrolDensity: number;   // 0-100
  pirateActivity: number;  // 0-100
  commerceVolume: number;  // relative trade traffic
}

export interface TerritoryControl {
  factionId: string;
  laneIds: string[];
  totalPatrolStrength: number;
}

export function updatePatrolDensity(lane: SeaLane, factionStrength: number): SeaLane {
  // TODO: Adjust patrol density based on faction resources
  // - Navy factions increase patrols where piracy is high
  // - Pirate presence decays patrol effectiveness
  return {
    ...lane,
    patrolDensity: Math.min(100, factionStrength * 0.5),
  };
}

export function getInterceptionChance(lane: SeaLane, infamy: number): number {
  // TODO: Probability of being intercepted on this lane
  // - Higher patrol density + higher infamy = more risk
  return Math.min(1.0, (lane.patrolDensity * infamy) / 10000);
}

export function contestLane(lane: SeaLane, attackerStrength: number): SeaLane {
  // TODO: Attempt to wrest control of a sea lane
  return { ...lane };
}

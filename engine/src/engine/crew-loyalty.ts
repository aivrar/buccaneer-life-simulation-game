/**
 * Crew loyalty scores, grievances, and mutiny mechanics.
 */

import { ECONOMY } from '../config/economy.js';

export interface CrewMember {
  id: string;
  name: string;
  loyalty: number;        // 0-100
  share: number;          // promised share of plunder
  grievances: Grievance[];
}

export interface Grievance {
  type: 'unpaid' | 'harsh_discipline' | 'broken_code' | 'poor_rations' | 'cowardice' | 'bad_luck';
  severity: number;       // 1-10
  tickRecorded: number;
}

export interface MutinyResult {
  occurred: boolean;
  ringleaders: string[];  // crew member IDs
  loyalists: string[];
  outcome: 'captain_deposed' | 'mutiny_crushed' | 'negotiated' | 'none';
}

export function updateLoyalty(crew: CrewMember, delta: number): CrewMember {
  return { ...crew, loyalty: Math.max(0, Math.min(100, crew.loyalty + delta)) };
}

export function addGrievance(crew: CrewMember, grievance: Grievance): CrewMember {
  const loyaltyHit = grievance.severity * 2;
  return {
    ...crew,
    grievances: [...crew.grievances, grievance],
    loyalty: Math.max(0, crew.loyalty - loyaltyHit),
  };
}

export function checkMutiny(crewList: CrewMember[]): MutinyResult {
  if (crewList.length === 0) {
    return { occurred: false, ringleaders: [], loyalists: [], outcome: 'none' };
  }

  const avgLoyalty = crewList.reduce((sum, c) => sum + c.loyalty, 0) / crewList.length;
  const threshold = ECONOMY.crew.mutinyThreshold;

  if (avgLoyalty >= threshold) {
    return { occurred: false, ringleaders: [], loyalists: [], outcome: 'none' };
  }

  // Mutiny probability increases as loyalty drops below threshold
  const mutinyChance = (threshold - avgLoyalty) / threshold;
  if (Math.random() > mutinyChance) {
    return { occurred: false, ringleaders: [], loyalists: [], outcome: 'none' };
  }

  // Split crew into disloyal (ringleaders) and loyal
  const ringleaders = crewList.filter(c => c.loyalty < threshold).map(c => c.id);
  const loyalists = crewList.filter(c => c.loyalty >= threshold).map(c => c.id);

  // Determine outcome by ratio
  let outcome: MutinyResult['outcome'];
  const ratio = ringleaders.length / Math.max(1, loyalists.length);

  if (ratio >= 2) {
    outcome = 'captain_deposed';
  } else if (ratio <= 0.5) {
    outcome = 'mutiny_crushed';
  } else {
    outcome = 'negotiated';
  }

  return { occurred: true, ringleaders, loyalists, outcome };
}

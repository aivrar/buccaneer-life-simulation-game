import type { GameTime } from '../runtime/types.js';
import { PORT_PROFILES } from '../config/ports.js';

export interface DiseaseRisk {
  disease: string;
  chance: number; // per tick probability 0-1
  severity: number; // 1-10
}

export function getPortDiseaseRisks(portId: string, gameTime: GameTime): DiseaseRisk[] {
  const port = PORT_PROFILES[portId];
  if (!port) return [];

  const profile = port.diseaseProfile;
  const tropicalMultiplier = (gameTime.month >= 5 && gameTime.month <= 10) ? 1.5 : 1.0;

  const risks: DiseaseRisk[] = [];

  if (profile.malaria > 0) {
    risks.push({
      disease: 'malaria',
      chance: (profile.malaria / 100) * 0.01 * tropicalMultiplier,
      severity: 6,
    });
  }

  if (profile.yellowFever > 0) {
    risks.push({
      disease: 'yellow_fever',
      chance: (profile.yellowFever / 100) * 0.008 * tropicalMultiplier,
      severity: 8,
    });
  }

  if (profile.dysentery > 0) {
    risks.push({
      disease: 'dysentery',
      chance: (profile.dysentery / 100) * 0.015,
      severity: 4,
    });
  }

  return risks;
}

export function getVoyageDiseaseRisks(daysAtSea: number, foodStores: number, waterStores: number, crewCount: number): DiseaseRisk[] {
  const risks: DiseaseRisk[] = [];

  // Scurvy risk increases with time at sea
  if (daysAtSea > 14) {
    risks.push({
      disease: 'scurvy',
      chance: Math.min(0.05 * (daysAtSea - 14) / 30, 0.3),
      severity: 5,
    });
  }

  // Dysentery risk from bad water
  const waterPerCrew = crewCount > 0 ? waterStores / crewCount : 0;
  if (waterPerCrew < 0.5) {
    risks.push({
      disease: 'dysentery',
      chance: 0.02,
      severity: 4,
    });
  }

  // General sickness from overcrowding
  if (daysAtSea > 7) {
    risks.push({
      disease: 'fever',
      chance: 0.005 * (daysAtSea / 30),
      severity: 3,
    });
  }

  return risks;
}

/**
 * Wound, disease, and hunger state transitions.
 */

export type WoundSeverity = 'minor' | 'moderate' | 'severe' | 'critical';
export type DiseaseType = 'scurvy' | 'fever' | 'dysentery' | 'infection' | 'malaria';
export type HungerState = 'fed' | 'hungry' | 'starving' | 'famished';

export interface HealthState {
  agentId: string;
  wounds: Wound[];
  diseases: Disease[];
  hunger: HungerState;
  overallFitness: number; // 0-100
}

export interface Wound {
  location: string;
  severity: WoundSeverity;
  tickInflicted: number;
  healing: boolean;
}

export interface Disease {
  type: DiseaseType;
  severity: number;      // 1-10
  tickContracted: number;
  treated: boolean;
}

const SEVERITY_FITNESS_PENALTY: Record<WoundSeverity, number> = {
  minor: 5,
  moderate: 15,
  severe: 30,
  critical: 50,
};

export function applyWound(state: HealthState, wound: Wound): HealthState {
  return {
    ...state,
    wounds: [...state.wounds, wound],
    overallFitness: Math.max(0, state.overallFitness - SEVERITY_FITNESS_PENALTY[wound.severity]),
  };
}

export function tickHealth(state: HealthState, _currentTick: number): HealthState {
  let fitness = state.overallFitness;

  // Process wounds
  const updatedWounds = state.wounds.map(wound => {
    if (wound.healing) {
      // Treated wounds: heal, fitness recovers slightly
      fitness = Math.min(100, fitness + 0.5);
      return wound;
    }
    // Untreated wounds degrade fitness
    const degradation: Record<WoundSeverity, number> = {
      critical: 2,
      severe: 1,
      moderate: 0.5,
      minor: 0.25,
    };
    fitness = Math.max(0, fitness - degradation[wound.severity]);
    return wound;
  });

  // Process diseases
  const updatedDiseases = state.diseases.map(disease => {
    if (disease.treated) {
      // Severity decreases when treated
      const newSev = Math.max(0, disease.severity - 0.5);
      fitness = Math.min(100, fitness + 0.2);
      return { ...disease, severity: newSev };
    }
    // Untreated diseases worsen
    const newSev = Math.min(10, disease.severity + 0.3);
    fitness = Math.max(0, fitness - newSev * 0.2);
    return { ...disease, severity: newSev };
  });

  // Remove healed diseases
  const activeDiseases = updatedDiseases.filter(d => d.severity > 0);

  // Hunger effects
  const hungerPenalty: Record<HungerState, number> = {
    fed: 0,
    hungry: 0.5,
    starving: 2,
    famished: 5,
  };
  fitness = Math.max(0, fitness - hungerPenalty[state.hunger]);

  return {
    ...state,
    wounds: updatedWounds,
    diseases: activeDiseases,
    overallFitness: Math.round(fitness * 10) / 10,
  };
}

export function isDead(state: HealthState): boolean {
  return state.overallFitness <= 0;
}

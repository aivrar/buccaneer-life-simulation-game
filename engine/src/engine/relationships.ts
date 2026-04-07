import { v4 as uuid } from 'uuid';
import type { AgentRelationship } from '../db/models.js';

export type InteractionEvent =
  | 'shared_victory'
  | 'betrayal'
  | 'saved_life'
  | 'shared_hardship'
  | 'intimidation'
  | 'generous_act'
  | 'insult'
  | 'trade_deal'
  | 'combat_together'
  | 'served_under';

interface RelationshipDelta {
  fondness: number;
  trust: number;
  respect: number;
  fear: number;
  rivalry: number;
}

const INTERACTION_EFFECTS: Record<InteractionEvent, RelationshipDelta> = {
  shared_victory:   { fondness: +10, trust: +5,  respect: +5,  fear: 0,   rivalry: -5  },
  betrayal:         { fondness: -20, trust: -30, respect: -10, fear: 0,   rivalry: +15 },
  saved_life:       { fondness: +15, trust: +15, respect: +10, fear: 0,   rivalry: -10 },
  shared_hardship:  { fondness: +5,  trust: +5,  respect: +3,  fear: 0,   rivalry: -3  },
  intimidation:     { fondness: -5,  trust: -5,  respect: 0,   fear: +15, rivalry: +5  },
  generous_act:     { fondness: +10, trust: +5,  respect: +5,  fear: -5,  rivalry: -5  },
  insult:           { fondness: -10, trust: -5,  respect: -10, fear: 0,   rivalry: +10 },
  trade_deal:       { fondness: +3,  trust: +3,  respect: +2,  fear: 0,   rivalry: 0   },
  combat_together:  { fondness: +5,  trust: +8,  respect: +5,  fear: 0,   rivalry: -5  },
  served_under:     { fondness: +2,  trust: +2,  respect: +5,  fear: +3,  rivalry: 0   },
};

const FAMILIARITY_DECAY_PER_100_TICKS = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function applyInteraction(
  relationship: AgentRelationship,
  event: InteractionEvent,
  tick: number,
): AgentRelationship {
  const delta = INTERACTION_EFFECTS[event];

  const updated: AgentRelationship = {
    ...relationship,
    fondness: clamp(relationship.fondness + delta.fondness, 0, 100),
    trust: clamp(relationship.trust + delta.trust, 0, 100),
    respect: clamp(relationship.respect + delta.respect, 0, 100),
    fear: clamp(relationship.fear + delta.fear, 0, 100),
    rivalry: clamp(relationship.rivalry + delta.rivalry, 0, 100),
    familiarity: clamp(relationship.familiarity + 1, 0, 100),
    last_interaction_tick: tick,
  };

  // Append event to notes
  const existingNotes: Array<{ event: string; tick: number }> = relationship.notes
    ? JSON.parse(relationship.notes)
    : [];
  existingNotes.push({ event, tick });
  // Keep only the last 20 entries
  if (existingNotes.length > 20) existingNotes.splice(0, existingNotes.length - 20);
  updated.notes = JSON.stringify(existingNotes);

  return updated;
}

export function decayRelationship(
  relationship: AgentRelationship,
  currentTick: number,
): AgentRelationship {
  if (!relationship.last_interaction_tick) return relationship;

  const ticksSinceContact = currentTick - relationship.last_interaction_tick;
  if (ticksSinceContact <= 0) return relationship;

  const decayAmount = Math.floor(ticksSinceContact / 100) * FAMILIARITY_DECAY_PER_100_TICKS;
  if (decayAmount <= 0) return relationship;

  return {
    ...relationship,
    familiarity: clamp(relationship.familiarity - decayAmount, 0, 100),
  };
}

export function getDisposition(relationship: AgentRelationship): string {
  const { fondness, trust, respect, fear, rivalry } = relationship;

  if (rivalry > 70) return 'bitter_enemy';
  if (fear > 70 && fondness < 30) return 'terrorized';
  if (fondness > 80 && trust > 70) return 'devoted_ally';
  if (fondness > 60 && trust > 50) return 'trusted_friend';
  if (trust > 70 && respect > 60) return 'respected_colleague';
  if (fondness < 20 && rivalry > 40) return 'rival';
  if (fear > 50) return 'intimidated';
  if (fondness > 50) return 'friendly';
  if (fondness < 30) return 'hostile';
  return 'neutral';
}

export function createDefaultRelationship(agentId: string, targetAgentId: string): AgentRelationship {
  return {
    id: uuid(),
    agent_id: agentId,
    target_agent_id: targetAgentId,
    fondness: 50,
    trust: 50,
    respect: 50,
    fear: 0,
    rivalry: 0,
    familiarity: 0,
    last_interaction_tick: null,
    notes: null,
  };
}

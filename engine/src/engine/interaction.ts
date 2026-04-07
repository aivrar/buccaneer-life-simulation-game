/**
 * Agent interaction engine — generates events when agents share a place.
 * Feeds results into the relationships system.
 */

import { v4 as uuid } from 'uuid';
import { RelationshipQueries } from '../db/queries.js';
import { applyInteraction, createDefaultRelationship, type InteractionEvent } from './relationships.js';

export interface InteractionResult {
  agentId: string;
  targetId: string;
  event: InteractionEvent;
  placeType: string;
}

// Interaction probability by place type (0-1)
const PLACE_INTERACTION_CHANCE: Record<string, number> = {
  tavern: 0.4,
  dock: 0.15,
  market: 0.2,
  shipyard: 0.1,
  fort: 0.05,
  government: 0.05,
  church: 0.1,
  brothel: 0.3,
  warehouse: 0.1,
  jail: 0.05,
  residential: 0.02,
  hospital: 0.1,
  camp: 0.15,
  trading_post: 0.2,
};

// What kind of interactions happen at each place type
const PLACE_EVENT_POOLS: Record<string, InteractionEvent[]> = {
  tavern: ['trade_deal', 'shared_hardship', 'generous_act', 'insult', 'intimidation'],
  dock: ['trade_deal', 'served_under', 'shared_hardship'],
  market: ['trade_deal', 'generous_act', 'insult'],
  shipyard: ['trade_deal', 'shared_hardship'],
  fort: ['intimidation', 'served_under'],
  government: ['trade_deal', 'intimidation'],
  church: ['shared_hardship', 'generous_act'],
  brothel: ['shared_hardship', 'insult', 'generous_act'],
  warehouse: ['trade_deal', 'intimidation'],
  hospital: ['shared_hardship', 'generous_act'],
};

/**
 * Process interactions for a group of co-located agents.
 * Returns interaction events that occurred.
 */
export async function processInteractions(
  agentIds: string[],
  placeType: string,
  portId: string,
  tick: number,
): Promise<InteractionResult[]> {
  if (agentIds.length < 2) return [];

  const baseChance = PLACE_INTERACTION_CHANCE[placeType] ?? 0.1;
  const eventPool = PLACE_EVENT_POOLS[placeType] ?? ['shared_hardship', 'trade_deal'];
  const results: InteractionResult[] = [];

  // For each unique pair, roll for interaction
  for (let i = 0; i < agentIds.length; i++) {
    for (let j = i + 1; j < agentIds.length; j++) {
      // Scale chance down with group size to avoid explosion
      const groupPenalty = Math.max(0.3, 1.0 - (agentIds.length - 2) * 0.1);
      if (Math.random() > baseChance * groupPenalty) continue;

      const agentId = agentIds[i]!;
      const targetId = agentIds[j]!;

      // Pick a random event from the pool
      const event = eventPool[Math.floor(Math.random() * eventPool.length)]!;

      // Update relationship for both directions
      await updateRelationship(agentId, targetId, event, tick);
      await updateRelationship(targetId, agentId, event, tick);

      results.push({ agentId, targetId, event, placeType });
    }
  }

  return results;
}

async function updateRelationship(
  agentId: string,
  targetId: string,
  event: InteractionEvent,
  tick: number,
): Promise<void> {
  const existing = await RelationshipQueries.getByPair(agentId, targetId);
  const rel = existing ?? createDefaultRelationship(agentId, targetId);

  const updated = applyInteraction(
    {
      id: rel.id,
      agent_id: rel.agent_id,
      target_agent_id: rel.target_agent_id,
      fondness: rel.fondness,
      trust: rel.trust,
      respect: rel.respect,
      fear: rel.fear,
      rivalry: rel.rivalry,
      familiarity: rel.familiarity,
      last_interaction_tick: rel.last_interaction_tick,
      notes: rel.notes,
    },
    event,
    tick,
  );
  await RelationshipQueries.upsert(updated);
}

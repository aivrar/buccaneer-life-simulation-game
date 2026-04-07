/**
 * Reputation and infamy tracking per sea zone.
 * Propagates reputation changes to adjacent zones.
 */

import { ReputationQueries } from '../db/queries.js';
import { SeaZoneQueries } from '../db/queries.js';

export type ReputationEvent = 'generous_shares' | 'merchant_attack' | 'navy_victory' | 'betrayal' | 'rescue' | 'massacre';

const EVENT_DELTAS: Record<ReputationEvent, { rep: number; inf: number; hon: number }> = {
  generous_shares:  { rep: 5,   inf: 0,   hon: 5 },
  merchant_attack:  { rep: -2,  inf: 5,   hon: -5 },
  navy_victory:     { rep: 10,  inf: 10,  hon: 0 },
  betrayal:         { rep: -15, inf: 3,   hon: -15 },
  rescue:           { rep: 10,  inf: -2,  hon: 10 },
  massacre:         { rep: -20, inf: 15,  hon: -20 },
};

export async function recordReputationEvent(
  agentId: string,
  seaZoneId: string,
  event: ReputationEvent,
  tick: number,
): Promise<void> {
  const deltas = EVENT_DELTAS[event];

  const existing = await ReputationQueries.getByAgentAndZone(agentId, seaZoneId);
  const currentRep = existing?.reputation ?? 0;
  const currentInf = existing?.infamy ?? 0;
  const currentHon = existing?.honor ?? 50;

  const newRep = Math.max(-100, Math.min(100, currentRep + deltas.rep));
  const newInf = Math.max(0, Math.min(100, currentInf + deltas.inf));
  const newHon = Math.max(0, Math.min(100, currentHon + deltas.hon));

  await ReputationQueries.upsert(agentId, seaZoneId, newRep, newInf, newHon, tick);
}

export async function propagateReputation(
  agentId: string,
  seaZoneId: string,
  tick: number,
): Promise<void> {
  const source = await ReputationQueries.getByAgentAndZone(agentId, seaZoneId);
  if (!source) return;

  const adjacentZones = await SeaZoneQueries.getAdjacent(seaZoneId);

  for (const zone of adjacentZones) {
    const existing = await ReputationQueries.getByAgentAndZone(agentId, zone.id);
    const currentRep = existing?.reputation ?? 0;
    const currentInf = existing?.infamy ?? 0;
    const currentHon = existing?.honor ?? 50;

    // Propagate 50% of source values blended with existing
    const newRep = Math.round(currentRep + (source.reputation - currentRep) * 0.5);
    const newInf = Math.round(currentInf + (source.infamy - currentInf) * 0.5);
    const newHon = Math.round(currentHon + (source.honor - currentHon) * 0.5);

    await ReputationQueries.upsert(agentId, zone.id, newRep, newInf, newHon, tick);
  }
}

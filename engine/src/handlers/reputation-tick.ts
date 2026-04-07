import type { TickHandler, TickContext } from '../runtime/types.js';
import { TickPhase } from '../runtime/types.js';
import { ReputationQueries } from '../db/queries.js';
import { propagateReputation } from '../engine/reputation.js';

export const reputationTickHandler: TickHandler = {
  name: 'reputation-tick',
  phase: TickPhase.DECAY,

  async execute(tick: TickContext): Promise<void> {
    // Only propagate every 24 ticks (~1 game day) to reduce load
    if (tick.tickNumber % 24 !== 0) return;

    const allReps = await ReputationQueries.getAll();

    // Propagate reputation for agents with significant rep/infamy
    const processed = new Set<string>();
    for (const rep of allReps) {
      if (Math.abs(rep.reputation) < 5 && rep.infamy < 5) continue;

      const key = `${rep.agent_id}:${rep.sea_zone_id}`;
      if (processed.has(key)) continue;
      processed.add(key);

      await propagateReputation(rep.agent_id, rep.sea_zone_id, tick.tickNumber);
    }
  },
};

import type { TickHandler, TickContext } from '../runtime/types.js';
import { TickPhase } from '../runtime/types.js';
import { PortQueries } from '../db/queries.js';
import { findCoLocatedGroups } from '../engine/co-location.js';
import { processInteractions } from '../engine/interaction.js';

export const interactionTickHandler: TickHandler = {
  name: 'interaction-tick',
  phase: TickPhase.AGENTS,

  async execute(tick: TickContext): Promise<void> {
    // Only run every 6 ticks (every ~3 hours game time) to reduce load
    if (tick.tickNumber % 6 !== 0) return;

    const ports = await PortQueries.getAll();

    for (const port of ports) {
      const groups = await findCoLocatedGroups(port.id, tick.gameTime.hour);

      for (const group of groups) {
        await processInteractions(
          group.agentIds,
          group.placeType,
          group.portId,
          tick.tickNumber,
        );
      }
    }
  },
};

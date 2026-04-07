import type { TickHandler, TickContext } from '../runtime/types.js';
import { TickPhase } from '../runtime/types.js';

export const agentTickHandler: TickHandler = {
  name: 'agent-tick',
  phase: TickPhase.AGENTS,

  async execute(_tick: TickContext): Promise<void> {
    // TODO: Implement agent decision scheduling
    // - Select batch of agents ready for decisions (cooldown expired)
    // - Priority queue to ensure fair distribution
    // - Call AgentRunner.runBatch() with selected agents
    // - Apply cooldowns after decisions
    // - Log decisions for sim metrics
  },
};

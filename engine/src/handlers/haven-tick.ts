import type { TickHandler, TickContext } from '../runtime/types.js';
import { TickPhase } from '../runtime/types.js';
import { HavenInvestmentQueries, AgentQueries } from '../db/queries.js';
import { ECONOMY } from '../config/economy.js';

export const havenTickHandler: TickHandler = {
  name: 'haven-tick',
  phase: TickPhase.ECONOMY,

  async execute(_tick: TickContext): Promise<void> {
    const investments = await HavenInvestmentQueries.getAll();

    // Group by agent for batch cash updates
    const agentIncome = new Map<string, number>();

    for (const inv of investments) {
      const havenConfig = ECONOMY.havenTypes[inv.type];
      if (!havenConfig) continue;

      const income = havenConfig.incomePerTick * inv.level;
      if (income <= 0) continue;

      const current = agentIncome.get(inv.agent_id) ?? 0;
      agentIncome.set(inv.agent_id, current + income);
    }

    // Credit each agent
    for (const [agentId, income] of agentIncome) {
      const agent = await AgentQueries.getById(agentId);
      if (!agent || agent.status === 'dead') continue;
      await AgentQueries.addCash(agentId, income);
    }
  },
};

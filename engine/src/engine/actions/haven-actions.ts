import { v4 as uuid } from 'uuid';
import type { AgentState } from '../../runtime/types.js';
import { AgentQueries, HavenInvestmentQueries } from '../../db/queries.js';
import { ECONOMY } from '../../config/economy.js';
import type { ActionResult } from './sail-to.js';

type HavenType = 'hideout' | 'warehouse' | 'tavern' | 'shipyard' | 'fort';

export async function executeInvestHaven(
  agent: AgentState,
  params: Record<string, unknown>,
): Promise<ActionResult> {
  const havenType = (params.haven_type as HavenType) ?? 'tavern';
  const portId = agent.portId;

  const config = ECONOMY.havenTypes[havenType];
  if (!config) return { success: false, message: `Unknown haven type: ${havenType}` };

  const dbAgent = await AgentQueries.getById(agent.id);
  if (!dbAgent) return { success: false, message: 'Agent not found' };

  // Check for existing investment at this port of this type
  const existing = await HavenInvestmentQueries.getByAgent(agent.id);
  const existingAtPort = existing.find(inv => inv.port_id === portId && inv.type === havenType);

  if (existingAtPort) {
    // Upgrade existing
    if (existingAtPort.level >= config.maxLevel) {
      return { success: false, message: `${havenType} already at max level (${config.maxLevel})` };
    }
    const upgradeCost = config.baseCost * (existingAtPort.level + 1);
    if (dbAgent.cash < upgradeCost) {
      return { success: false, message: `Insufficient funds (need ${upgradeCost})` };
    }

    await AgentQueries.addCash(agent.id, -upgradeCost);
    const newLevel = existingAtPort.level + 1;
    const newIncome = config.incomePerTick * newLevel;
    await HavenInvestmentQueries.updateLevel(
      existingAtPort.id,
      newLevel,
      existingAtPort.investment_total + upgradeCost,
      newIncome,
    );

    return {
      success: true,
      message: `Upgraded ${havenType} to level ${newLevel} at ${portId} for ${upgradeCost}`,
      data: { level: newLevel, cost: upgradeCost },
    };
  }

  // New investment
  if (dbAgent.cash < config.baseCost) {
    return { success: false, message: `Insufficient funds (need ${config.baseCost})` };
  }

  await AgentQueries.addCash(agent.id, -config.baseCost);
  await HavenInvestmentQueries.insert({
    id: uuid(),
    agent_id: agent.id,
    port_id: portId,
    type: havenType,
    level: 1,
    investment_total: config.baseCost,
    income_per_tick: config.incomePerTick,
    created_at: new Date(),
  });

  return {
    success: true,
    message: `Invested in ${havenType} at ${portId} for ${config.baseCost}`,
    data: { level: 1, cost: config.baseCost },
  };
}

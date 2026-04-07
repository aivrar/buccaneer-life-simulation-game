import type { AgentState, WorldState } from '../runtime/types.js';
import { AgentStatus } from '../runtime/types.js';
import { getRoutesFromPort } from '../world/navigation.js';
import { getTimeBasedActionWeights } from '../engine/daily-routine.js';

export interface PlayerDecision {
  action: string;
  params: Record<string, unknown>;
}

/**
 * Synthetic player decision logic for sim.
 * Rule-based (no LLM) — used for fast iteration.
 */
export function makePlayerDecision(agent: AgentState, worldState: WorldState, validActions: string[]): PlayerDecision {
  const hour = worldState.gameTime.hour;

  // Urgent needs override strategy
  const urgent = checkUrgentNeeds(agent, validActions);
  if (urgent) return urgent;

  // Strategy-based action selection with time weighting
  const timeWeights = getTimeBasedActionWeights(agent.type, hour);
  const action = selectWeightedAction(agent, validActions, timeWeights);
  const params = buildActionParams(action, agent);

  return { action, params };
}

function checkUrgentNeeds(agent: AgentState, validActions: string[]): PlayerDecision | null {
  // These checks only apply to agents with ships
  if (!agent.shipId) return null;
  if (agent.status !== AgentStatus.IN_PORT) return null;

  // TODO: Check ship condition from DB. For now, use probability-based triggers
  // that get smarter as we add more state to AgentState.

  // 20% chance to repair (simulates "ship needs repair")
  if (validActions.includes('repair_ship') && Math.random() < 0.2) {
    return { action: 'repair_ship', params: {} };
  }

  // 25% chance to resupply (simulates "stores running low")
  if (validActions.includes('buy_provisions') && Math.random() < 0.25) {
    return { action: 'buy_provisions', params: { food: 30, water: 30, powder: 10 } };
  }

  // 15% chance to recruit (simulates "crew undermanned")
  if (validActions.includes('recruit_crew') && Math.random() < 0.15) {
    return { action: 'recruit_crew', params: { count: 5 } };
  }

  return null;
}

function selectWeightedAction(
  agent: AgentState,
  validActions: string[],
  timeWeights: Record<string, number>,
): string {
  // Get base priorities from strategy
  const basePriorities = getStrategyPriorities(agent.persona.strategyHint);

  // Score each valid action
  const scored: Array<{ action: string; score: number }> = [];
  for (const action of validActions) {
    const baseIdx = basePriorities.indexOf(action);
    const baseScore = baseIdx >= 0 ? (basePriorities.length - baseIdx) / basePriorities.length : 0.1;
    const timeWeight = timeWeights[action] ?? 1.0;
    scored.push({ action, score: baseScore * timeWeight });
  }

  // Weighted random selection from top 3
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);
  const totalScore = top.reduce((sum, s) => sum + s.score, 0);

  let roll = Math.random() * totalScore;
  for (const s of top) {
    roll -= s.score;
    if (roll <= 0) return s.action;
  }

  return top[0]?.action ?? 'do_nothing';
}

function getStrategyPriorities(strategyHint: string): string[] {
  switch (strategyHint) {
    case 'aggressive':
      return ['attack_ship', 'board_ship', 'pursue_target', 'engage_ship', 'sail_to', 'recruit_crew', 'sell_plunder', 'visit_tavern', 'do_nothing'];
    case 'cautious':
      return ['gather_intel', 'lay_low', 'trade_cargo', 'buy_provisions', 'repair_ship', 'sail_to', 'flee', 'do_nothing'];
    case 'mercantile':
      return ['trade_cargo', 'buy_cargo', 'sell_cargo', 'sell_plunder', 'sail_to', 'negotiate', 'buy_provisions', 'invest_haven', 'do_nothing'];
    case 'diplomatic':
      return ['negotiate', 'visit_tavern', 'gather_intel', 'accept_pardon', 'sail_to', 'trade_cargo', 'do_nothing'];
    case 'opportunistic':
      return ['sell_plunder', 'trade_cargo', 'gather_intel', 'sail_to', 'attack_ship', 'recruit_crew', 'do_nothing'];
    case 'loyal':
      return ['visit_tavern', 'recruit_crew', 'buy_provisions', 'repair_ship', 'sail_to', 'trade_cargo', 'do_nothing'];
    default:
      return ['sail_to', 'trade_cargo', 'visit_tavern', 'buy_provisions', 'gather_intel', 'recruit_crew', 'do_nothing'];
  }
}

function buildActionParams(action: string, agent: AgentState): Record<string, unknown> {
  switch (action) {
    case 'sail_to':
      return { destination_port: pickDestinationPort(agent) };
    case 'buy_provisions':
      return { food: 30, water: 30, powder: 10 };
    case 'recruit_crew':
      return { count: 5 };
    case 'buy_cargo':
      return { quantity: 10 };
    default:
      return {};
  }
}

function pickDestinationPort(agent: AgentState): string {
  if (!agent.portId) return 'nassau';

  const routes = getRoutesFromPort(agent.portId);
  if (routes.length === 0) return 'nassau';

  // Prefer shorter routes (Caribbean inter-port) over transatlantic
  const shortRoutes = routes.filter(r => r.distanceNm < 1500);
  const pool = shortRoutes.length > 0 ? shortRoutes : routes;
  const route = pool[Math.floor(Math.random() * pool.length)]!;
  return route.to;
}

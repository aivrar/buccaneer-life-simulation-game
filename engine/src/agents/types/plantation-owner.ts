import { registerAgentType } from '../registry.js';
import type { AgentState } from '../../runtime/types.js';

registerAgentType({
  id: 'plantation_owner',
  name: 'Plantation Owner',
  tools: [], // Tools defined in config/agents.ts, registered at boot
  buildProprioception: (agent: AgentState) => {
    return [
      `You are ${agent.name}, a plantation owner with wealth tied to land and trade.`,
      `Status: ${agent.status}`,
      `Location: ${agent.portId || 'at sea'}`,
      `Strategy: ${agent.persona.strategyHint}`,
    ].join('\n');
  },
  overlay: {
    id: 'plantation_owner',
    name: 'Plantation Owner',
    decisionHints: [
      'Sugar, tobacco, and cotton are your empire. Shipping lanes must stay open for your exports.',
      'You wield influence in the colony. Governors listen when plantation gold speaks.',
    ],
  },
  spawnConfig: {
    minPerRegion: 1,
    maxPerRegion: 3,
  },
});

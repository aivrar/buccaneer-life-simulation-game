import { registerAgentType } from '../registry.js';
import type { AgentState } from '../../runtime/types.js';

registerAgentType({
  id: 'merchant_captain',
  name: 'Merchant Captain',
  tools: [], // Tools defined in config/agents.ts, registered at boot
  buildProprioception: (agent: AgentState) => {
    return [
      `You are ${agent.name}, a merchant captain sailing for profit.`,
      `Status: ${agent.status}`,
      `Location: ${agent.portId || 'at sea'}`,
      `Strategy: ${agent.persona.strategyHint}`,
    ].join('\n');
  },
  overlay: {
    id: 'merchant_captain',
    name: 'Merchant Captain',
    decisionHints: [
      'Profit is king. Buy low, sell high, and keep your cargo safe from pirates.',
      'A good trade route is worth more than gold. Reputation opens ports and purses.',
    ],
  },
  spawnConfig: {
    minPerRegion: 3,
    maxPerRegion: 8,
  },
});

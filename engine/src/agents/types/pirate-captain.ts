import { registerAgentType } from '../registry.js';
import type { AgentState } from '../../runtime/types.js';

registerAgentType({
  id: 'pirate_captain',
  name: 'Pirate Captain',
  tools: [], // Tools defined in config/agents.ts, registered at boot
  buildProprioception: (agent: AgentState) => {
    return [
      `You are ${agent.name}, a pirate captain.`,
      `Status: ${agent.status}`,
      `Location: ${agent.portId || 'at sea'}`,
      `Strategy: ${agent.persona.strategyHint}`,
    ].join('\n');
  },
  overlay: {
    id: 'pirate_captain',
    name: 'Pirate Captain',
    decisionHints: [
      'You live by the code: equal shares, elected captains, no prey too bold.',
      'Freedom and fortune drive you. The Crown means nothing on the account.',
    ],
  },
  spawnConfig: {
    minPerRegion: 2,
    maxPerRegion: 5,
  },
});

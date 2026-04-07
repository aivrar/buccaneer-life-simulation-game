import { registerAgentType } from '../registry.js';
import type { AgentState } from '../../runtime/types.js';

registerAgentType({
  id: 'informant',
  name: 'Informant',
  tools: [], // Tools defined in config/agents.ts, registered at boot
  buildProprioception: (agent: AgentState) => {
    return [
      `You are ${agent.name}, an informant who trades in secrets and intelligence.`,
      `Status: ${agent.status}`,
      `Location: ${agent.portId || 'at sea'}`,
      `Strategy: ${agent.persona.strategyHint}`,
    ].join('\n');
  },
  overlay: {
    id: 'informant',
    name: 'Informant',
    decisionHints: [
      'Information is the most valuable cargo. Sell to the highest bidder, but never reveal all you know.',
      'Every tavern whisper, every dockside rumor has a price. You collect them all.',
    ],
  },
  spawnConfig: {
    minPerRegion: 1,
    maxPerRegion: 3,
  },
});

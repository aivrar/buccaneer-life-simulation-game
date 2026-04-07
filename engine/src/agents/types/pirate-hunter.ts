import { registerAgentType } from '../registry.js';
import type { AgentState } from '../../runtime/types.js';

registerAgentType({
  id: 'pirate_hunter',
  name: 'Pirate Hunter',
  tools: [], // Tools defined in config/agents.ts, registered at boot
  buildProprioception: (agent: AgentState) => {
    return [
      `You are ${agent.name}, a pirate hunter who tracks down outlaws of the sea.`,
      `Status: ${agent.status}`,
      `Location: ${agent.portId || 'at sea'}`,
      `Strategy: ${agent.persona.strategyHint}`,
    ].join('\n');
  },
  overlay: {
    id: 'pirate_hunter',
    name: 'Pirate Hunter',
    decisionHints: [
      'Bounties and justice drive you. Every pirate has a price on their head, and you intend to collect.',
      'You know pirate ways because you\'ve studied them. Think like a wolf to catch a wolf.',
    ],
  },
  spawnConfig: {
    minPerRegion: 1,
    maxPerRegion: 2,
  },
});

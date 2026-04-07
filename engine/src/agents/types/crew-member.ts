import { registerAgentType } from '../registry.js';
import type { AgentState } from '../../runtime/types.js';

registerAgentType({
  id: 'crew_member',
  name: 'Crew Member',
  tools: [], // Tools defined in config/agents.ts, registered at boot
  buildProprioception: (agent: AgentState) => {
    return [
      `You are ${agent.name}, a common sailor seeking fortune on the seas.`,
      `Status: ${agent.status}`,
      `Location: ${agent.portId || 'at sea'}`,
      `Strategy: ${agent.persona.strategyHint}`,
    ].join('\n');
  },
  overlay: {
    id: 'crew_member',
    name: 'Crew Member',
    decisionHints: [
      'Loyalty to your captain keeps you alive, but a better offer might turn your head.',
      'Rum, shares, and survival—that\'s what matters below decks.',
    ],
  },
  spawnConfig: {
    minPerRegion: 5,
    maxPerRegion: 15,
  },
});

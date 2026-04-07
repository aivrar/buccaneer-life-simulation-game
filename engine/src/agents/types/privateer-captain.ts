import { registerAgentType } from '../registry.js';
import type { AgentState } from '../../runtime/types.js';

registerAgentType({
  id: 'privateer_captain',
  name: 'Privateer Captain',
  tools: [], // Tools defined in config/agents.ts, registered at boot
  buildProprioception: (agent: AgentState) => {
    return [
      `You are ${agent.name}, a privateer captain sailing under a letter of marque.`,
      `Status: ${agent.status}`,
      `Location: ${agent.portId || 'at sea'}`,
      `Strategy: ${agent.persona.strategyHint}`,
    ].join('\n');
  },
  overlay: {
    id: 'privateer_captain',
    name: 'Privateer Captain',
    decisionHints: [
      'You walk the line between pirate and patriot. The letter of marque makes it legal—mostly.',
      'Strike enemy shipping for Crown and coin. Stay in the governor\'s good graces or risk the noose.',
    ],
  },
  spawnConfig: {
    minPerRegion: 1,
    maxPerRegion: 4,
  },
});

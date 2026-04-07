import { registerAgentType } from '../registry.js';
import type { AgentState } from '../../runtime/types.js';

registerAgentType({
  id: 'tavern_keeper',
  name: 'Tavern Keeper',
  tools: [], // Tools defined in config/agents.ts, registered at boot
  buildProprioception: (agent: AgentState) => {
    return [
      `You are ${agent.name}, a tavern keeper who hears all and serves all.`,
      `Status: ${agent.status}`,
      `Location: ${agent.portId || 'at sea'}`,
      `Strategy: ${agent.persona.strategyHint}`,
    ].join('\n');
  },
  overlay: {
    id: 'tavern_keeper',
    name: 'Tavern Keeper',
    decisionHints: [
      'Your tavern is neutral ground. Pirates, merchants, and officers all drink under your roof.',
      'Rum loosens tongues and fills your coffers. What you overhear is worth more than what you pour.',
    ],
  },
  spawnConfig: {
    minPerRegion: 1,
    maxPerRegion: 3,
  },
});

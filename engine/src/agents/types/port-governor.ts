import { registerAgentType } from '../registry.js';
import type { AgentState } from '../../runtime/types.js';

registerAgentType({
  id: 'port_governor',
  name: 'Port Governor',
  tools: [], // Tools defined in config/agents.ts, registered at boot
  buildProprioception: (agent: AgentState) => {
    return [
      `You are ${agent.name}, the governor of a colonial port.`,
      `Status: ${agent.status}`,
      `Location: ${agent.portId || 'at sea'}`,
      `Strategy: ${agent.persona.strategyHint}`,
    ].join('\n');
  },
  overlay: {
    id: 'port_governor',
    name: 'Port Governor',
    decisionHints: [
      'Your colony must thrive. Balance trade, defense, and the Crown\'s demands.',
      'Issue letters of marque when it suits the colony. Deny pirates safe harbor—unless the price is right.',
    ],
  },
  spawnConfig: {
    minPerRegion: 1,
    maxPerRegion: 2,
  },
});

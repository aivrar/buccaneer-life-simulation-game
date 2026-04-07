import { registerAgentType } from '../registry.js';
import type { AgentState } from '../../runtime/types.js';

registerAgentType({
  id: 'fence',
  name: 'Fence',
  tools: [], // Tools defined in config/agents.ts, registered at boot
  buildProprioception: (agent: AgentState) => {
    return [
      `You are ${agent.name}, a fence who deals in stolen and illicit goods.`,
      `Status: ${agent.status}`,
      `Location: ${agent.portId || 'at sea'}`,
      `Strategy: ${agent.persona.strategyHint}`,
    ].join('\n');
  },
  overlay: {
    id: 'fence',
    name: 'Fence',
    decisionHints: [
      'No questions asked, no names remembered. You move plunder that honest merchants won\'t touch.',
      'Discretion is your trade. A loose tongue sinks more than ships—it sinks profits.',
    ],
  },
  spawnConfig: {
    minPerRegion: 1,
    maxPerRegion: 3,
  },
});

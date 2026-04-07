import { registerAgentType } from '../registry.js';
import type { AgentState } from '../../runtime/types.js';

registerAgentType({
  id: 'quartermaster',
  name: 'Quartermaster',
  tools: [], // Tools defined in config/agents.ts, registered at boot
  buildProprioception: (agent: AgentState) => {
    return [
      `You are ${agent.name}, a quartermaster responsible for ship supplies and crew discipline.`,
      `Status: ${agent.status}`,
      `Location: ${agent.portId || 'at sea'}`,
      `Strategy: ${agent.persona.strategyHint}`,
    ].join('\n');
  },
  overlay: {
    id: 'quartermaster',
    name: 'Quartermaster',
    decisionHints: [
      'You divide the plunder fairly and keep the crew in line. The articles are law.',
      'A ship without order is a ship that sinks. You are the balance between captain and crew.',
    ],
  },
  spawnConfig: {
    minPerRegion: 2,
    maxPerRegion: 5,
  },
});

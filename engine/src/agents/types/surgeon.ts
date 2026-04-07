import { registerAgentType } from '../registry.js';
import type { AgentState } from '../../runtime/types.js';

registerAgentType({
  id: 'surgeon',
  name: 'Surgeon',
  tools: [], // Tools defined in config/agents.ts, registered at boot
  buildProprioception: (agent: AgentState) => {
    return [
      `You are ${agent.name}, a ship's surgeon who mends the wounded and tends the sick.`,
      `Status: ${agent.status}`,
      `Location: ${agent.portId || 'at sea'}`,
      `Strategy: ${agent.persona.strategyHint}`,
    ].join('\n');
  },
  overlay: {
    id: 'surgeon',
    name: 'Surgeon',
    decisionHints: [
      'A steady hand and strong rum are your tools. Life and death balance on your saw.',
      'Skilled surgeons are worth their weight in gold. Every crew needs one, and you know your value.',
    ],
  },
  spawnConfig: {
    minPerRegion: 1,
    maxPerRegion: 3,
  },
});

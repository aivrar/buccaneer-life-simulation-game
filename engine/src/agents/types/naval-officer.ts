import { registerAgentType } from '../registry.js';
import type { AgentState } from '../../runtime/types.js';

registerAgentType({
  id: 'naval_officer',
  name: 'Naval Officer',
  tools: [], // Tools defined in config/agents.ts, registered at boot
  buildProprioception: (agent: AgentState) => {
    return [
      `You are ${agent.name}, a naval officer in His Majesty's service.`,
      `Status: ${agent.status}`,
      `Location: ${agent.portId || 'at sea'}`,
      `Strategy: ${agent.persona.strategyHint}`,
    ].join('\n');
  },
  overlay: {
    id: 'naval_officer',
    name: 'Naval Officer',
    decisionHints: [
      'You serve the Crown with unwavering duty. Piracy is a scourge to be eradicated.',
      'Order and law rule the seas. Protect trade routes and enforce maritime authority.',
    ],
  },
  spawnConfig: {
    minPerRegion: 1,
    maxPerRegion: 3,
  },
});

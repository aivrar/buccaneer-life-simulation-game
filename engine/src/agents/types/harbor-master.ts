import { registerAgentType } from '../registry.js';
import type { AgentState } from '../../runtime/types.js';

registerAgentType({
  id: 'harbor_master',
  name: 'Harbor Master',
  tools: [], // Tools defined in config/agents.ts, registered at boot
  buildProprioception: (agent: AgentState) => {
    return [
      `You are ${agent.name}, the harbor master who controls port access and docking.`,
      `Status: ${agent.status}`,
      `Location: ${agent.portId || 'at sea'}`,
      `Strategy: ${agent.persona.strategyHint}`,
    ].join('\n');
  },
  overlay: {
    id: 'harbor_master',
    name: 'Harbor Master',
    decisionHints: [
      'Every ship that enters your harbor pays its dues. You decide who docks and who is turned away.',
      'You keep the port running smoothly. Tariffs, manifests, and berthing fees are your domain.',
    ],
  },
  spawnConfig: {
    minPerRegion: 1,
    maxPerRegion: 2,
  },
});

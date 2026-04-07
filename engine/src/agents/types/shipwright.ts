import { registerAgentType } from '../registry.js';
import type { AgentState } from '../../runtime/types.js';

registerAgentType({
  id: 'shipwright',
  name: 'Shipwright',
  tools: [], // Tools defined in config/agents.ts, registered at boot
  buildProprioception: (agent: AgentState) => {
    return [
      `You are ${agent.name}, a shipwright who builds and repairs vessels.`,
      `Status: ${agent.status}`,
      `Location: ${agent.portId || 'at sea'}`,
      `Strategy: ${agent.persona.strategyHint}`,
    ].join('\n');
  },
  overlay: {
    id: 'shipwright',
    name: 'Shipwright',
    decisionHints: [
      'Every captain needs you. A well-careened hull means speed; a patched hull means survival.',
      'You serve whoever pays. Pirate gold spends the same as merchant silver in the shipyard.',
    ],
  },
  spawnConfig: {
    minPerRegion: 1,
    maxPerRegion: 2,
  },
});

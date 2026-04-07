import type { AgentState, PersonaProfile, BehaviorOverlay } from '../runtime/types.js';
import { AgentStatus } from '../runtime/types.js';

export function createAgentState(
  id: string,
  type: string,
  name: string,
  portId: string,
  seaZoneId: string,
  persona: PersonaProfile,
): AgentState {
  return {
    id,
    type,
    name,
    status: AgentStatus.IN_PORT,
    portId,
    seaZoneId,
    persona,
    lastDecisionTick: 0,
    cooldownUntilTick: 0,
  };
}

export function applyOverlay(agent: AgentState, overlay: BehaviorOverlay): AgentState {
  if (!overlay.traitModifiers) return agent;

  const modifiedTraits = { ...agent.persona.traits };
  for (const [key, mod] of Object.entries(overlay.traitModifiers)) {
    const traitKey = key as keyof typeof modifiedTraits;
    if (traitKey in modifiedTraits && mod !== undefined) {
      modifiedTraits[traitKey] = clamp(modifiedTraits[traitKey] + mod, 0, 100);
    }
  }

  return {
    ...agent,
    persona: {
      ...agent.persona,
      traits: modifiedTraits,
    },
  };
}

export function isActive(agent: AgentState): boolean {
  return agent.status === AgentStatus.ACTIVE ||
    agent.status === AgentStatus.IN_PORT ||
    agent.status === AgentStatus.AT_SEA;
}

export function isDead(agent: AgentState): boolean {
  return agent.status === AgentStatus.DEAD;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

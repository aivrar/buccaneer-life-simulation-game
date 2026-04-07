import type { AgentState, BehaviorOverlay, SpawnConfig, ToolDefinition } from '../runtime/types.js';
import { AGENT_TYPE_CONFIGS } from '../config/agents.js';

export interface AgentType {
  id: string;
  name: string;
  tools: ToolDefinition[];
  buildProprioception: (agent: AgentState, worldState: any) => string;
  overlay: BehaviorOverlay;
  spawnConfig: SpawnConfig;
}

const registeredTypes = new Map<string, AgentType>();

export function registerAgentType(type: AgentType): void {
  registeredTypes.set(type.id, type);
}

export function getAgentType(typeId: string): AgentType | undefined {
  return registeredTypes.get(typeId);
}

export function getAllAgentTypes(): AgentType[] {
  return Array.from(registeredTypes.values());
}

export function getAgentTypeIds(): string[] {
  return Array.from(registeredTypes.keys());
}

export function isValidAgentType(typeId: string): boolean {
  return registeredTypes.has(typeId) || typeId in AGENT_TYPE_CONFIGS;
}

// Auto-register from config (types can override with richer implementations)
export function bootstrapRegistry(): void {
  for (const [id, config] of Object.entries(AGENT_TYPE_CONFIGS)) {
    if (!registeredTypes.has(id)) {
      registerAgentType({
        id,
        name: config.name,
        tools: [], // Tools registered per type file
        buildProprioception: defaultProprioception,
        overlay: { id, name: config.name },
        spawnConfig: {
          minPerRegion: config.spawnConfig.minPerRegion,
          maxPerRegion: config.spawnConfig.maxPerRegion,
          preferredPorts: config.spawnConfig.preferredPorts,
        },
      });
    }
  }
}

function defaultProprioception(agent: AgentState): string {
  return `You are ${agent.name}, a ${agent.type}. Status: ${agent.status}.`;
}

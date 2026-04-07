import type { TickHandler, TickContext, HumanAttributes } from '../runtime/types.js';
import { TickPhase } from '../runtime/types.js';
import { ShipQueries, CrewQueries, AgentQueries, SkillQueries, RelationshipQueries } from '../db/queries.js';
import { findTransferOpportunities, type SkillTransferPair } from '../engine/skill-transfer.js';

const PORT_TRANSFER_RATE_MULTIPLIER = 0.5;

const DEFAULT_ATTRIBUTES: HumanAttributes = {
  strength: 50, endurance: 50, agility: 50, constitution: 50, appearance: 50,
  intellect: 50, perception: 50, willpower: 50, creativity: 50, memory: 50,
  eloquence: 50, empathy: 50, presence: 50,
};

interface HydratedAgent {
  id: string;
  skills: Array<{ domain: string; sub_skill: string; level: number }>;
  attributes: HumanAttributes;
  familiarity: Map<string, number>;
}

export const skillTransferTickHandler: TickHandler = {
  name: 'skill-transfer-tick',
  phase: TickPhase.DECAY,

  async execute(tick: TickContext): Promise<void> {
    // Only run every 10 ticks to reduce DB load
    if (tick.tickNumber % 10 !== 0) return;

    await processShipTransfers(tick.tickNumber);
    await processPortTransfers(tick.tickNumber);
  },
};

async function hydrateAgent(agentId: string): Promise<HydratedAgent | null> {
  const agent = await AgentQueries.getById(agentId);
  if (!agent) return null;

  const skills = await SkillQueries.getByAgent(agent.id);
  const relationships = await RelationshipQueries.getByAgent(agent.id);

  const familiarityMap = new Map<string, number>();
  for (const rel of relationships) {
    familiarityMap.set(rel.target_agent_id, rel.familiarity);
  }

  const attrs: HumanAttributes = agent.attributes
    ? JSON.parse(agent.attributes)
    : DEFAULT_ATTRIBUTES;

  return {
    id: agent.id,
    skills: skills.map(s => ({ domain: s.domain, sub_skill: s.sub_skill, level: s.level })),
    attributes: attrs,
    familiarity: familiarityMap,
  };
}

async function hydrateAgents(agentIds: string[]): Promise<HydratedAgent[]> {
  const results = await Promise.all(agentIds.map(hydrateAgent));
  return results.filter((a): a is HydratedAgent => a !== null);
}

async function applyTransfers(
  transfers: SkillTransferPair[],
  tickNumber: number,
  rateMultiplier = 1,
): Promise<void> {
  for (const transfer of transfers) {
    const adjustedGain = transfer.gain * rateMultiplier;
    const newLevel = Math.min(100, transfer.studentLevel + adjustedGain);
    if (newLevel > transfer.studentLevel) {
      await SkillQueries.upsert(
        transfer.studentAgentId,
        transfer.domain,
        transfer.subSkill,
        Math.round(newLevel),
        0,
        tickNumber,
      );
    }
  }
}

async function processShipTransfers(tickNumber: number): Promise<void> {
  const ships = await ShipQueries.getAllActive();

  for (const ship of ships) {
    const crewMembers = await CrewQueries.getActiveByShip(ship.id);
    if (crewMembers.length < 2) continue;

    const agents = await hydrateAgents(crewMembers.map(c => c.agent_id));
    if (agents.length < 2) continue;

    const transfers = findTransferOpportunities(agents);
    await applyTransfers(transfers, tickNumber);
  }
}

async function processPortTransfers(tickNumber: number): Promise<void> {
  const activeAgents = await AgentQueries.getActive();
  const inPortAgents = activeAgents.filter(a => a.status === 'in_port' && a.port_id);

  const byPort = new Map<string, string[]>();
  for (const agent of inPortAgents) {
    const existing = byPort.get(agent.port_id) ?? [];
    existing.push(agent.id);
    byPort.set(agent.port_id, existing);
  }

  for (const [, agentIds] of byPort) {
    if (agentIds.length < 2) continue;

    // Limit to avoid excessive computation
    const limitedIds = agentIds.slice(0, 20);
    const agents = await hydrateAgents(limitedIds);
    if (agents.length < 2) continue;

    const transfers = findTransferOpportunities(agents);
    await applyTransfers(transfers, tickNumber, PORT_TRANSFER_RATE_MULTIPLIER);
  }
}

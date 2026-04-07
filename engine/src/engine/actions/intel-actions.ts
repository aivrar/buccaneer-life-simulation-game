import { v4 as uuid } from 'uuid';
import type { AgentState } from '../../runtime/types.js';
import { AgentQueries, IntelQueries, EventQueries } from '../../db/queries.js';
import type { ActionResult } from './sail-to.js';

export async function executeGatherIntel(
  agent: AgentState,
): Promise<ActionResult> {
  // Gather intel at the current port — find available intel
  const intel = await IntelQueries.getByPort(agent.portId);
  if (intel.length === 0) return { success: true, message: 'No fresh intel available at this port' };

  // Pick best intel by freshness
  const best = intel.sort((a, b) => b.freshness - a.freshness).slice(0, 3);
  const summaries = best.map(i => `[${i.type}] ${i.content} (accuracy: ${i.accuracy}%, freshness: ${i.freshness}%)`);

  return {
    success: true,
    message: `Gathered ${best.length} intel: ${summaries.join('; ')}`,
  };
}

export async function executeSellIntel(
  agent: AgentState,
  params: Record<string, unknown>,
  tick?: number,
): Promise<ActionResult> {
  // Agent creates intel from what they know and sells it
  const content = (params.content as string) ?? `Information from ${agent.name}`;
  const subjectAgentId = (params.subject_agent_id as string) ?? null;

  const dbAgent = await AgentQueries.getById(agent.id);
  if (!dbAgent) return { success: false, message: 'Agent not found' };

  // Need a buyer at the same port — any non-informant agent present
  const { query: rawQuery } = await import('../../db/sqlite.js');
  type Row = { id: string; cash: number };
  const buyers = await rawQuery<Row[]>(
    'SELECT id, cash FROM agents WHERE port_id = ? AND id != ? AND type != ? AND status NOT IN (\'dead\',\'fled\') ORDER BY cash DESC LIMIT 1',
    [agent.portId, agent.id, 'informant'],
  );
  if (buyers.length === 0) {
    return { success: false, message: 'No one at this port to buy intel' };
  }

  // Intel quality determines price (10-30g scaled by accuracy + freshness)
  const accuracy = 60 + Math.floor(Math.random() * 30);
  const freshness = 100;
  const baseIntelPrice = 10 + Math.floor(accuracy / 10) + Math.floor(freshness / 20);
  // Cap by buyer's ability to pay (at most 50% of their cash)
  const buyerCash = buyers[0]!.cash;
  const price = Math.max(5, Math.min(baseIntelPrice, Math.floor(buyerCash * 0.5)));

  await IntelQueries.insert({
    id: uuid(),
    source_agent_id: agent.id,
    subject_agent_id: subjectAgentId,
    subject_ship_id: null,
    type: 'rumor',
    content,
    accuracy,
    freshness,
    port_id: agent.portId,
    price,
    created_tick: tick ?? 0,
  });

  // Buyer pays, seller gets paid
  await AgentQueries.addCash(buyers[0]!.id, -price);
  await AgentQueries.addCash(agent.id, price);

  return { success: true, message: `Sold intel for ${price}g` };
}

/**
 * Generate tavern rumors from recent world events.
 * Called from intel-tick, not from action executor.
 */
export async function generateTavernRumors(
  portId: string,
  tick: number,
): Promise<void> {
  // Get recent events near this port
  const recentEvents = await EventQueries.getByPort(portId, 5);

  for (const event of recentEvents) {
    // Only generate rumors from events within last 100 ticks
    if (tick - event.tick > 100) continue;

    // 15% chance per event to become a tavern rumor
    if (Math.random() > 0.15) continue;

    // Check if this event already spawned a rumor
    const existingIntel = await IntelQueries.getByPort(portId);
    const alreadyExists = existingIntel.some(i =>
      i.type === 'rumor' && i.content.includes(event.type),
    );
    if (alreadyExists) continue;

    // Distort the content slightly for flavor
    const accuracy = 50 + Math.floor(Math.random() * 40); // 50-90%

    await IntelQueries.insert({
      id: uuid(),
      source_agent_id: 'tavern_gossip',
      subject_agent_id: null,
      subject_ship_id: null,
      type: 'rumor',
      content: `Rumor: ${event.description}`,
      accuracy,
      freshness: 90,
      port_id: portId,
      price: null,
      created_tick: tick,
    });
  }
}

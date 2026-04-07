import { v4 as uuid } from 'uuid';
import type { AgentState } from '../../runtime/types.js';
import type { ActionResult } from './sail-to.js';
import { AgentQueries, FenceQueries, RelationshipQueries } from '../../db/queries.js';
import { query, execute } from '../../db/sqlite.js';
import type { Cargo } from '../../db/models.js';

export async function executeBuyStolenGoods(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  // Find cargo with heat > 0 at this port (owned by someone else)
  const rows = await query<Cargo[]>(
    'SELECT c.* FROM cargo c JOIN agents a ON c.owner_agent_id = a.id WHERE a.port_id = ? AND c.heat > 0 AND c.owner_agent_id != ? LIMIT 1',
    [agent.portId, agent.id],
  );

  if (rows.length === 0) return { success: false, message: 'No stolen goods available' };

  const cargo = rows[0]!;
  const baseValue = cargo.quantity * 10; // rough base value per unit
  const buyPrice = Math.floor(baseValue * 0.4);

  // Fence pays the pirate
  await AgentQueries.addCash(cargo.owner_agent_id!, buyPrice);

  // Fence spends from own cash
  await AgentQueries.addCash(agent.id, -buyPrice);

  // Fence gains the cargo
  await execute('UPDATE cargo SET owner_agent_id = ? WHERE id = ?', [agent.id, cargo.id]);

  // Reduce heat by 30
  const newHeat = Math.max(0, cargo.heat - 30);
  await execute('UPDATE cargo SET heat = ? WHERE id = ?', [newHeat, cargo.id]);

  return {
    success: true,
    message: `Bought stolen ${cargo.type} for ${buyPrice} gold`,
    data: { cargoId: cargo.id, cargoType: cargo.type, price: buyPrice },
  };
}

export async function executeSellGoods(
  agent: AgentState,
): Promise<ActionResult> {
  // Find cargo owned by fence with low heat
  const cargo = await query<Cargo[]>(
    'SELECT * FROM cargo WHERE owner_agent_id = ? AND heat < 20 LIMIT 1',
    [agent.id],
  );

  if (cargo.length === 0) return { success: false, message: 'Nothing to sell' };

  const item = cargo[0]!;
  const marketValue = item.quantity * 10;
  const sellPrice = Math.floor(marketValue * 0.8);

  // Fence gains gold
  await AgentQueries.addCash(agent.id, sellPrice);

  // Delete cargo record
  await execute('DELETE FROM cargo WHERE id = ?', [item.id]);

  return {
    success: true,
    message: `Sold ${item.type} for ${sellPrice} gold`,
    data: { cargoType: item.type, price: sellPrice },
  };
}

export async function executeEstablishContact(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  // Find captains at the same port — randomize pick, prefer ones we don't know well
  const candidates = await query<{ id: string; name: string; type: string }[]>(
    'SELECT a.id, a.name, a.type FROM agents a LEFT JOIN agent_relationships r ON (r.agent_id = ? AND r.target_agent_id = a.id) WHERE a.port_id = ? AND a.type IN (\'pirate_captain\', \'privateer_captain\', \'merchant_captain\') AND a.id != ? AND a.status != \'dead\' ORDER BY COALESCE(r.familiarity, 0) ASC, RANDOM() LIMIT 5',
    [agent.id, agent.portId, agent.id],
  );

  if (candidates.length === 0) return { success: false, message: 'No new contacts available' };

  const target = candidates[0]!;

  // Check if relationship exists
  const existing = await RelationshipQueries.getByPair(agent.id, target.id);

  if (existing) {
    // Boost trust +5, familiarity +5
    await execute(
      'UPDATE agent_relationships SET trust = MIN(trust + 5, 100), familiarity = MIN(familiarity + 5, 100) WHERE id = ?',
      [existing.id],
    );
  } else {
    // Create new relationship
    await execute(
      'INSERT INTO agent_relationships (id, agent_id, target_agent_id, fondness, trust, respect, fear, rivalry, familiarity, last_interaction_tick) VALUES (?, ?, ?, 30, 20, 20, 0, 0, 10, 0)',
      [uuid(), agent.id, target.id],
    );
  }

  // Boost fence's own trust rating
  const fenceRecords = await FenceQueries.getByAgent(agent.id);
  if (fenceRecords.length > 0) {
    const fence = fenceRecords[0]!;
    await FenceQueries.updateTrust(fence.id, Math.min(fence.trust + 2, 100), 0);
  }

  return {
    success: true,
    message: `Established contact with ${target.name}`,
    data: { targetId: target.id, targetName: target.name },
  };
}

export async function executeSetPrices(
  agent: AgentState,
): Promise<ActionResult> {
  const fenceRecords = await FenceQueries.getByAgent(agent.id);

  if (fenceRecords.length === 0) {
    // Create a default fence record
    const newFence = {
      id: uuid(),
      agent_id: agent.id,
      port_id: agent.portId,
      tier: 1,
      trust: 30,
      specialty: null,
      availability: 80,
      cut_percentage: 30,
      last_transaction_tick: null,
    };
    await FenceQueries.insert(newFence);
    return {
      success: true,
      message: `Adjusted prices — cut now at 30%`,
      data: { cut: 30 },
    };
  }

  const fence = fenceRecords[0]!;
  let newCut = fence.cut_percentage;

  if (newCut > 30) {
    newCut -= 5;
  } else if (newCut < 30) {
    newCut += 5;
  }

  await execute('UPDATE fences SET cut_percentage = ? WHERE id = ?', [newCut, fence.id]);

  return {
    success: true,
    message: `Adjusted prices — cut now at ${newCut}%`,
    data: { cut: newCut },
  };
}

export async function executeRefuseDeal(
  agent: AgentState,
): Promise<ActionResult> {
  // Boost trust +3 (reputation for discretion)
  const fenceRecords = await FenceQueries.getByAgent(agent.id);
  if (fenceRecords.length > 0) {
    const fence = fenceRecords[0]!;
    await FenceQueries.updateTrust(fence.id, Math.min(fence.trust + 3, 100), 0);
  }

  return {
    success: true,
    message: 'Refused a risky deal — reputation preserved',
  };
}

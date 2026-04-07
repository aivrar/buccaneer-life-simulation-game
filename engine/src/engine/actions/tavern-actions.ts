import { v4 as uuid } from 'uuid';
import type { AgentState } from '../../runtime/types.js';
import type { ActionResult } from './sail-to.js';
import { AgentQueries, IntelQueries, ShipQueries, NavyCaseQueries, RelationshipQueries, PortQueries } from '../../db/queries.js';
import { query, execute } from '../../db/sqlite.js';

export async function executeServeDrinks(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  // Get port prosperity
  const port = await PortQueries.getById(agent.portId);
  const prosperity = port?.prosperity ?? 50;
  const income = 3 + Math.floor(prosperity / 20);

  await AgentQueries.addCash(agent.id, income);

  // 10% chance: generate a rumor
  if (Math.random() < 0.1) {
    await IntelQueries.insert({
      id: uuid(),
      source_agent_id: agent.id,
      subject_agent_id: null,
      subject_ship_id: null,
      type: 'rumor',
      content: `Tavern gossip overheard at ${port?.name ?? 'port'}`,
      accuracy: 40 + Math.floor(Math.random() * 30),
      freshness: 80,
      port_id: agent.portId,
      price: null,
      created_tick: 0,
    });
  }

  return {
    success: true,
    message: `Served drinks — earned ${income} gold`,
    data: { income },
  };
}

export async function executeBrokerDeal(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  // Find 2 agents at same port (not self), prefer those with cash
  const agents = await query<{ id: string; name: string; type: string; cash: number }[]>(
    'SELECT id, name, type, cash FROM agents WHERE port_id = ? AND id != ? AND status != \'dead\' ORDER BY cash DESC LIMIT 2',
    [agent.portId, agent.id],
  );

  if (agents.length < 2) return { success: false, message: 'Too few people for dealings' };

  const agent1 = agents[0]!;
  const agent2 = agents[1]!;

  // Both agents gain +3 fondness / +2 trust toward each other
  const rel1 = await RelationshipQueries.getByPair(agent1.id, agent2.id);
  if (rel1) {
    await execute(
      'UPDATE agent_relationships SET fondness = MIN(fondness + 3, 100), trust = MIN(trust + 2, 100) WHERE id = ?',
      [rel1.id],
    );
  } else {
    await RelationshipQueries.upsert({
      id: uuid(), agent_id: agent1.id, target_agent_id: agent2.id,
      fondness: 53, trust: 52, respect: 50, fear: 0, rivalry: 0, familiarity: 10,
      last_interaction_tick: 0, notes: null,
    });
  }

  const rel2 = await RelationshipQueries.getByPair(agent2.id, agent1.id);
  if (rel2) {
    await execute(
      'UPDATE agent_relationships SET fondness = MIN(fondness + 3, 100), trust = MIN(trust + 2, 100) WHERE id = ?',
      [rel2.id],
    );
  } else {
    await RelationshipQueries.upsert({
      id: uuid(), agent_id: agent2.id, target_agent_id: agent1.id,
      fondness: 53, trust: 52, respect: 50, fear: 0, rivalry: 0, familiarity: 10,
      last_interaction_tick: 0, notes: null,
    });
  }

  // Try to broker actual cargo exchange between agents
  const { CargoQueries: BrokerCargo } = await import('../../db/queries.js');
  const cargo1 = await BrokerCargo.getByOwner(agent1.id);
  const cargo2 = await BrokerCargo.getByOwner(agent2.id);
  const sellable1 = cargo1.filter(c => c.heat === 0 && c.quantity > 0);
  const sellable2 = cargo2.filter(c => c.heat === 0 && c.quantity > 0);

  let dealMessage = '';
  let dealValue = 0;

  if (sellable1.length > 0 && agent2.cash > 20) {
    // Agent1 sells cargo to agent2 through broker
    const item = sellable1[0]!;
    const { calculatePrice } = await import('../economy.js');
    const quote = calculatePrice(agent.portId, item.type);
    const salePrice = Math.round(quote.sellPrice * Math.min(item.quantity, 5));
    if (salePrice > 0 && agent2.cash >= salePrice) {
      const qty = Math.min(item.quantity, 5);
      await AgentQueries.addCash(agent2.id, -salePrice);
      await AgentQueries.addCash(agent1.id, salePrice);
      if (qty >= item.quantity) {
        await BrokerCargo.remove(item.id);
      } else {
        await BrokerCargo.updateQuantity(item.id, item.quantity - qty);
      }
      dealValue = salePrice;
      dealMessage = `${agent1.name} sold ${qty} ${item.type} to ${agent2.name} for ${salePrice}g. `;
    }
  } else if (sellable2.length > 0 && agent1.cash > 20) {
    // Agent2 sells cargo to agent1 through broker
    const item = sellable2[0]!;
    const { calculatePrice } = await import('../economy.js');
    const quote = calculatePrice(agent.portId, item.type);
    const salePrice = Math.round(quote.sellPrice * Math.min(item.quantity, 5));
    if (salePrice > 0 && agent1.cash >= salePrice) {
      const qty = Math.min(item.quantity, 5);
      await AgentQueries.addCash(agent1.id, -salePrice);
      await AgentQueries.addCash(agent2.id, salePrice);
      if (qty >= item.quantity) {
        await BrokerCargo.remove(item.id);
      } else {
        await BrokerCargo.updateQuantity(item.id, item.quantity - qty);
      }
      dealValue = salePrice;
      dealMessage = `${agent2.name} sold ${qty} ${item.type} to ${agent1.name} for ${salePrice}g. `;
    }
  }

  // Broker fee: 10% of deal value or flat fee scaled by port prosperity
  const port = await PortQueries.getById(agent.portId);
  const prosperity = port?.prosperity ?? 50;
  const brokerFee = dealValue > 0
    ? Math.max(5, Math.floor(dealValue * 0.10))
    : 10 + Math.floor(prosperity / 10); // 10-20g flat fee when no cargo deal
  await AgentQueries.addCash(agent.id, brokerFee);

  // Both deal parties also earn a small finder bonus (3-8g)
  const finderBonus = 3 + Math.floor(Math.random() * 6);
  await AgentQueries.addCash(agent1.id, finderBonus);
  await AgentQueries.addCash(agent2.id, finderBonus);

  return {
    success: true,
    message: `${dealMessage}Brokered a deal between ${agent1.name} and ${agent2.name} — earned ${brokerFee}g commission`,
    data: { agent1: agent1.name, agent2: agent2.name, fee: brokerFee, dealValue },
  };
}

export async function executeRecruitFor(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  // Find a captain at port with crew_count < crew_capacity
  const ships = await query<{ id: string; name: string; captain_id: string; crew_count: number; crew_capacity: number }[]>(
    'SELECT s.id, s.name, s.captain_id, s.crew_count, s.crew_capacity FROM ships s WHERE s.port_id = ? AND s.status = \'docked\' AND s.crew_count < s.crew_capacity AND s.captain_id IS NOT NULL LIMIT 1',
    [agent.portId],
  );

  if (ships.length === 0) return { success: false, message: 'No captains seeking crew' };

  const ship = ships[0]!;
  const captain = await AgentQueries.getById(ship.captain_id);
  if (!captain) return { success: false, message: 'No captains seeking crew' };

  const costPerRecruit = 5;
  const commissionPerRecruit = 2;
  const maxRecruit = Math.min(3, ship.crew_capacity - ship.crew_count);

  // Captain must be able to afford recruitment
  const maxAffordable = Math.floor(captain.cash / costPerRecruit);
  if (maxAffordable <= 0) return { success: false, message: 'Captain cannot afford to recruit crew' };
  const count = 1 + Math.floor(Math.random() * Math.min(maxRecruit, maxAffordable));

  // Captain pays
  await AgentQueries.addCash(captain.id, -(costPerRecruit * count));

  // Tavern keeper earns commission
  await AgentQueries.addCash(agent.id, commissionPerRecruit * count);

  // Add crew to ship
  await ShipQueries.updateCrewCount(ship.id, ship.crew_count + count);

  return {
    success: true,
    message: `Recruited ${count} sailors for ${captain.name}`,
    data: { count, captainName: captain.name, commission: commissionPerRecruit * count },
  };
}

export async function executeShelterFugitive(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  // Find agent at port with active navy case
  const agentsAtPort = await AgentQueries.getByPort(agent.portId);
  let fugitive = null;

  for (const a of agentsAtPort) {
    if (a.id === agent.id) continue;
    const cases = await NavyCaseQueries.getByTarget(a.id);
    const activeCase = cases.find(c => c.status === 'open' || c.status === 'warrant_issued');
    if (activeCase) {
      fugitive = { agent: a, navyCase: activeCase };
      break;
    }
  }

  if (!fugitive) return { success: false, message: 'No fugitives to shelter' };

  // Reduce evidence by 5
  const newEvidence = Math.max(0, fugitive.navyCase.evidence_level - 5);
  await NavyCaseQueries.updateEvidence(fugitive.navyCase.id, newEvidence, 0);

  // Tavern keeper earns 15 gold
  await AgentQueries.addCash(agent.id, 15);

  // 10% chance: port corruption decreases
  if (Math.random() < 0.1) {
    await execute(
      'UPDATE ports SET corruption = MAX(corruption - 2, 0) WHERE id = ?',
      [agent.portId],
    );
  }

  return {
    success: true,
    message: `Sheltered ${fugitive.agent.name} from the authorities`,
    data: { fugitiveName: fugitive.agent.name, fee: 15 },
  };
}

export async function executeReportToAuthorities(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  // Find pirate_captain or agent with infamy > 10 at port
  const suspects = await query<{ id: string; name: string; type: string; infamy: number }[]>(
    'SELECT id, name, type, infamy FROM agents WHERE port_id = ? AND id != ? AND (type = \'pirate_captain\' OR infamy > 10) AND status != \'dead\' LIMIT 1',
    [agent.portId, agent.id],
  );

  if (suspects.length === 0) return { success: false, message: 'No suspicious individuals to report' };

  const suspect = suspects[0]!;

  // Create intel about their presence
  await IntelQueries.insert({
    id: uuid(),
    source_agent_id: agent.id,
    subject_agent_id: suspect.id,
    subject_ship_id: null,
    type: 'rumor',
    content: `${suspect.name} (${suspect.type}) spotted at port — reported to authorities`,
    accuracy: 80 + Math.floor(Math.random() * 20),
    freshness: 100,
    port_id: agent.portId,
    price: null,
    created_tick: 0,
  });

  // Tavern keeper earns informant fee
  await AgentQueries.addCash(agent.id, 5);

  // Boost reputation +2 (via direct update on agents table infamy as proxy)
  await execute(
    'UPDATE agents SET infamy = MAX(infamy - 2, 0) WHERE id = ?',
    [agent.id],
  );

  return {
    success: true,
    message: `Reported ${suspect.name} to the authorities`,
    data: { suspectName: suspect.name, fee: 5 },
  };
}

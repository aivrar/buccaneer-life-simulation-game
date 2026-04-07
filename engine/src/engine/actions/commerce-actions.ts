import { v4 as uuid } from 'uuid';
import type { AgentState } from '../../runtime/types.js';
import type { ActionResult } from './sail-to.js';
import { AgentQueries, ShipQueries, CargoQueries, IntelQueries, NavyCaseQueries, RelationshipQueries, PlantationQueries, PortQueries, CrewQueries } from '../../db/queries.js';
import { query, execute } from '../../db/sqlite.js';
import { sellGoods } from '../trade.js';

export async function executeHireShipping(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  // Find merchant_captain ship at port with cargo space
  const ships = await query<{ id: string; name: string; captain_id: string; cargo_used: number; cargo_capacity: number }[]>(
    'SELECT s.id, s.name, s.captain_id, s.cargo_used, s.cargo_capacity FROM ships s JOIN agents a ON s.captain_id = a.id WHERE s.port_id = ? AND s.status = \'docked\' AND a.type = \'merchant_captain\' AND s.cargo_used < s.cargo_capacity LIMIT 1',
    [agent.portId],
  );

  if (ships.length === 0) return { success: false, message: 'No merchant ships available' };

  const ship = ships[0]!;

  // Find cargo owned by plantation owner
  const ownedCargo = await CargoQueries.getByOwner(agent.id);

  if (ownedCargo.length === 0) {
    // Auto-generate crop cargo from port's plantation type
    const plantations = await PlantationQueries.getByPort(agent.portId);
    const cropType = plantations.length > 0 && plantations[0]!.primary_cargo
      ? plantations[0]!.primary_cargo
      : 'sugar';

    await CargoQueries.insert({
      id: uuid(),
      type: cropType,
      quantity: 10,
      ship_id: null,
      port_id: agent.portId,
      owner_agent_id: agent.id,
      heat: 0,
      seized_from: null,
      origin_port_id: agent.portId,
      heat_decay_rate: 0,
    });
  }

  // Transfer cargo to ship
  const cargo = await CargoQueries.getByOwner(agent.id);
  if (cargo.length > 0) {
    const item = cargo[0]!;
    await execute('UPDATE cargo SET ship_id = ?, owner_agent_id = ? WHERE id = ?', [ship.id, ship.captain_id, item.id]);

    // Pay merchant 20 gold
    await AgentQueries.addCash(agent.id, -20);
    await AgentQueries.addCash(ship.captain_id, 20);

    return {
      success: true,
      message: `Hired ${ship.name} to ship ${item.type}`,
      data: { shipName: ship.name, cargoType: item.type, cost: 20 },
    };
  }

  return { success: false, message: 'No cargo to ship' };
}

export async function executeSellCrop(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  // Find cargo owned by plantation owner
  let cargo = await CargoQueries.getByOwner(agent.id);

  if (cargo.length === 0) {
    // Auto-generate crop based on port's plantation type
    const plantations = await PlantationQueries.getByPort(agent.portId);
    const cropType = plantations.length > 0 && plantations[0]!.primary_cargo
      ? plantations[0]!.primary_cargo
      : 'sugar';

    await CargoQueries.insert({
      id: uuid(),
      type: cropType,
      quantity: 10,
      ship_id: null,
      port_id: agent.portId,
      owner_agent_id: agent.id,
      heat: 0,
      seized_from: null,
      origin_port_id: agent.portId,
      heat_decay_rate: 0,
    });

    cargo = await CargoQueries.getByOwner(agent.id);
  }

  if (cargo.length === 0) return { success: false, message: 'No crops to sell' };

  const item = cargo[0]!;
  const result = await sellGoods(agent.id, agent.portId, item.id, item.quantity);

  return {
    success: result.success,
    message: result.success
      ? `Sold ${item.quantity} ${item.type}`
      : result.message,
    data: { quantity: item.quantity, cargoType: item.type },
  };
}

export async function executeHireGuards(
  agent: AgentState,
): Promise<ActionResult> {
  const cost = 20;

  // Deduct cost
  await AgentQueries.addCash(agent.id, -cost);

  return {
    success: true,
    message: `Hired guards for protection — cost ${cost} gold`,
    data: { cost },
  };
}

export async function executeHireEscort(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  // Find naval_officer or pirate_hunter at port
  const escorts = await query<{ id: string; name: string; type: string }[]>(
    'SELECT id, name, type FROM agents WHERE port_id = ? AND type IN (\'naval_officer\', \'pirate_hunter\') AND id != ? AND status != \'dead\' LIMIT 1',
    [agent.portId, agent.id],
  );

  if (escorts.length === 0) return { success: false, message: 'No escort available' };

  const escort = escorts[0]!;
  const cost = 25;

  // Pay escort
  await AgentQueries.addCash(agent.id, -cost);
  await AgentQueries.addCash(escort.id, cost);

  // Both agents gain +5 trust
  const existingRel = await RelationshipQueries.getByPair(agent.id, escort.id);
  if (existingRel) {
    await execute(
      'UPDATE agent_relationships SET trust = MIN(trust + 5, 100) WHERE id = ?',
      [existingRel.id],
    );
  } else {
    await RelationshipQueries.upsert({
      id: uuid(), agent_id: agent.id, target_agent_id: escort.id,
      fondness: 50, trust: 55, respect: 50, fear: 0, rivalry: 0, familiarity: 10,
      last_interaction_tick: 0, notes: null,
    });
  }

  const reverseRel = await RelationshipQueries.getByPair(escort.id, agent.id);
  if (reverseRel) {
    await execute(
      'UPDATE agent_relationships SET trust = MIN(trust + 5, 100) WHERE id = ?',
      [reverseRel.id],
    );
  } else {
    await RelationshipQueries.upsert({
      id: uuid(), agent_id: escort.id, target_agent_id: agent.id,
      fondness: 50, trust: 55, respect: 50, fear: 0, rivalry: 0, familiarity: 10,
      last_interaction_tick: 0, notes: null,
    });
  }

  return {
    success: true,
    message: `Hired ${escort.name} as escort`,
    data: { escortName: escort.name, cost },
  };
}

export async function executeInvest(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  const cost = 50;

  // Spend gold
  await AgentQueries.addCash(agent.id, -cost);

  // Increase port prosperity +2
  await execute(
    'UPDATE ports SET prosperity = MIN(prosperity + 2, 100) WHERE id = ?',
    [agent.portId],
  );

  return {
    success: true,
    message: 'Invested in local commerce — prosperity grows',
    data: { cost, prosperityBoost: 2 },
  };
}

export async function executeNegotiate(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  // Find another agent at same port
  const others = await query<{ id: string; name: string; type: string; cash: number }[]>(
    'SELECT id, name, type, cash FROM agents WHERE port_id = ? AND id != ? AND status != \'dead\' LIMIT 1',
    [agent.portId, agent.id],
  );

  if (others.length === 0) return { success: false, message: 'No one to negotiate with' };

  const target = others[0]!;

  // Improve relationship: +5 fondness, +3 trust
  const rel = await RelationshipQueries.getByPair(agent.id, target.id);
  if (rel) {
    await execute(
      'UPDATE agent_relationships SET fondness = MIN(fondness + 5, 100), trust = MIN(trust + 3, 100) WHERE id = ?',
      [rel.id],
    );
  } else {
    await RelationshipQueries.upsert({
      id: uuid(), agent_id: agent.id, target_agent_id: target.id,
      fondness: 55, trust: 53, respect: 50, fear: 0, rivalry: 0, familiarity: 10,
      last_interaction_tick: 0, notes: null,
    });
  }

  // Gold from negotiation scales with port prosperity (5-15g each)
  const port = await PortQueries.getById(agent.portId);
  const prosperity = port?.prosperity ?? 50;
  const dealGold = 5 + Math.floor(prosperity / 10);
  await AgentQueries.addCash(agent.id, dealGold);
  await AgentQueries.addCash(target.id, dealGold);

  // 50% chance: create actionable trade route intel
  if (Math.random() < 0.5) {
    await IntelQueries.insert({
      id: uuid(),
      source_agent_id: agent.id,
      subject_agent_id: target.id,
      subject_ship_id: null,
      type: 'route',
      content: `Trade opportunity negotiated between ${agent.name} and ${target.name} at ${port?.name ?? agent.portId}`,
      accuracy: 70 + Math.floor(Math.random() * 20),
      freshness: 90,
      port_id: agent.portId,
      price: null,
      created_tick: 0,
    });
  }

  return {
    success: true,
    message: `Negotiated with ${target.name} — deal struck for ${dealGold} gold each`,
    data: { targetName: target.name, gold: dealGold },
  };
}

export async function executeSpreadRumor(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  const topics = ['shipping routes', 'hidden treasure', 'naval patrols', 'pirate activity', 'port politics'];
  const topic = topics[Math.floor(Math.random() * topics.length)]!;

  await IntelQueries.insert({
    id: uuid(),
    source_agent_id: agent.id,
    subject_agent_id: null,
    subject_ship_id: null,
    type: 'rumor',
    content: `Rumor about ${topic} spread by ${agent.name}`,
    accuracy: 40 + Math.floor(Math.random() * 30),
    freshness: 80,
    port_id: agent.portId,
    price: null,
    created_tick: 0,
  });

  return {
    success: true,
    message: `Spread a rumor about ${topic}`,
    data: { topic },
  };
}

export async function executePlantRumor(
  agent: AgentState,
): Promise<ActionResult> {
  // Alias for spread rumor with same implementation
  return executeSpreadRumor(agent);
}

export async function executeEavesdrop(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  // Gather intel covertly — produce actionable market or agent intel
  const others = await query<{ id: string; name: string; type: string; cash: number }[]>(
    'SELECT id, name, type, cash FROM agents WHERE port_id = ? AND id != ? AND status != \'dead\' LIMIT 3',
    [agent.portId, agent.id],
  );

  if (others.length === 0) return { success: true, message: 'Nothing of interest overheard' };

  const target = others[Math.floor(Math.random() * others.length)]!;
  const intelRoll = Math.random();
  let intelContent: string;
  let intelType: 'sighting' | 'rumor' | 'manifest' | 'route' | 'weakness' | 'alliance' | 'betrayal';
  let goldEarned = 0;

  if (intelRoll < 0.4) {
    // Market intel — which goods are in shortage or surplus at nearby ports
    const { getTradeOptions } = await import('../trade.js');
    const options = getTradeOptions(agent.portId);
    const shortages = options.filter(o => o.demand > 80 && o.supply < 20);
    const gluts = options.filter(o => o.supply > 100 && o.demand < 30);
    if (shortages.length > 0) {
      const shortage = shortages[Math.floor(Math.random() * shortages.length)]!;
      intelContent = `Port shortage: ${shortage.name} in high demand at ${agent.portId} — selling for ${Math.round(shortage.sellPrice)}g`;
      intelType = 'route';
    } else if (gluts.length > 0) {
      const glut = gluts[Math.floor(Math.random() * gluts.length)]!;
      intelContent = `Market glut: ${glut.name} oversupplied at ${agent.portId} — buying for only ${Math.round(glut.buyPrice)}g`;
      intelType = 'route';
    } else {
      intelContent = `Market conditions stable at ${agent.portId} — no major opportunities overheard`;
      intelType = 'rumor';
    }
  } else if (intelRoll < 0.7) {
    // Agent intel — ship movements, wealth, plans
    const shipInfo = await query<{ name: string; class: string; guns: number }[]>(
      'SELECT s.name, s.class, s.guns FROM ships s JOIN agents a ON s.captain_id = a.id WHERE a.id = ? LIMIT 1',
      [target.id],
    );
    if (shipInfo.length > 0) {
      const ship = shipInfo[0]!;
      intelContent = `Overheard: ${target.name} (${target.type}) captains ${ship.name} (${ship.class}, ${ship.guns} guns) with ~${Math.round(target.cash / 10) * 10}g`;
    } else {
      intelContent = `Overheard: ${target.name} (${target.type}) at port with roughly ${Math.round(target.cash / 10) * 10} gold`;
    }
    intelType = 'sighting';
  } else {
    // Piracy/military intel — ship sightings, patrol routes
    const pirates = await query<{ name: string; infamy: number }[]>(
      'SELECT name, infamy FROM agents WHERE type IN (\'pirate_captain\',\'privateer_captain\') AND status != \'dead\' AND infamy > 20 LIMIT 1',
      [],
    );
    if (pirates.length > 0) {
      intelContent = `Overheard talk of pirate ${pirates[0]!.name} (infamy ${pirates[0]!.infamy}) prowling nearby waters`;
    } else {
      intelContent = `Overheard: ${target.name} (${target.type}) discussing business at ${agent.portId}`;
    }
    intelType = 'rumor';
  }

  // Eavesdropping can yield a small tip (2-5g) from selling overheard info on the spot
  goldEarned = 2 + Math.floor(Math.random() * 4);
  await AgentQueries.addCash(agent.id, goldEarned);

  await IntelQueries.insert({
    id: uuid(),
    source_agent_id: agent.id,
    subject_agent_id: target.id,
    subject_ship_id: null,
    type: intelType,
    content: intelContent,
    accuracy: 70 + Math.floor(Math.random() * 25),
    freshness: 95,
    port_id: agent.portId,
    price: null,
    created_tick: 0,
  });

  return {
    success: true,
    message: `${intelContent} (+${goldEarned}g)`,
    data: { targetName: target.name, gold: goldEarned },
  };
}

export async function executeReportPiracy(
  agent: AgentState,
): Promise<ActionResult> {
  if (!agent.portId) return { success: false, message: 'Not in port' };

  // Find pirate agents at port or nearby
  const pirates = await query<{ id: string; name: string }[]>(
    'SELECT id, name FROM agents WHERE port_id = ? AND type = \'pirate_captain\' AND status != \'dead\' LIMIT 1',
    [agent.portId],
  );

  if (pirates.length === 0) return { success: false, message: 'No pirate activity to report' };

  const pirate = pirates[0]!;

  await IntelQueries.insert({
    id: uuid(),
    source_agent_id: agent.id,
    subject_agent_id: pirate.id,
    subject_ship_id: null,
    type: 'sighting',
    content: `Formal report: pirate ${pirate.name} sighted at port`,
    accuracy: 90,
    freshness: 100,
    port_id: agent.portId,
    price: null,
    created_tick: 0,
  });

  // Agent earns 5 gold reward
  await AgentQueries.addCash(agent.id, 5);

  return {
    success: true,
    message: 'Reported pirate activity to the governor',
    data: { pirateName: pirate.name, reward: 5 },
  };
}

export async function executeReportToGovernor(
  agent: AgentState,
): Promise<ActionResult> {
  // Alias for report piracy
  return executeReportPiracy(agent);
}

export async function executeAcceptPardon(
  agent: AgentState,
): Promise<ActionResult> {
  // Reset infamy to 10
  await execute('UPDATE agents SET infamy = 10 WHERE id = ?', [agent.id]);

  // Dismiss all navy cases
  const cases = await NavyCaseQueries.getByTarget(agent.id);
  for (const nc of cases) {
    if (nc.status === 'open' || nc.status === 'warrant_issued') {
      await NavyCaseQueries.updateStatus(nc.id, 'dismissed', 0);
    }
  }

  // Loyalty hit -15 to crew
  if (agent.shipId) {
    const crew = await CrewQueries.getByShip(agent.shipId);
    for (const member of crew) {
      const newLoyalty = Math.max(0, member.loyalty - 15);
      await CrewQueries.updateLoyalty(member.id, newLoyalty);
    }
  }

  // Set a pardon document
  await execute(
    'INSERT INTO documents (id, type, holder_agent_id, data, created_tick) VALUES (?, ?, ?, ?, ?)',
    [uuid(), 'pardon', agent.id, JSON.stringify({ pardoned: true }), 0],
  );

  return {
    success: true,
    message: "Accepted the King's Pardon — a new life begins",
  };
}

export async function executeNegotiatePardon(
  agent: AgentState,
): Promise<ActionResult> {
  // Reduce evidence in active cases by 5
  const cases = await NavyCaseQueries.getByTarget(agent.id);
  let reducedCount = 0;

  for (const nc of cases) {
    if (nc.status === 'open' || nc.status === 'warrant_issued') {
      const newEvidence = Math.max(0, nc.evidence_level - 5);
      await NavyCaseQueries.updateEvidence(nc.id, newEvidence, 0);
      reducedCount++;
    }
  }

  return {
    success: true,
    message: 'Negotiating terms for a pardon',
    data: { casesAffected: reducedCount },
  };
}

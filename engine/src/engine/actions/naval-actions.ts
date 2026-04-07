import type { AgentState } from '../../runtime/types.js';
import type { ActionResult } from './sail-to.js';
import { v4 as uuid } from 'uuid';
import { AgentQueries, IntelQueries, NavyCaseQueries, BountyQueries, ShipQueries } from '../../db/queries.js';
import { execute, query } from '../../db/sqlite.js';

// ============================================================
// Naval Officer / Pirate Hunter Actions
// ============================================================

export async function executePatrolRegion(
  agent: AgentState,
  _params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  const zone = agent.seaZoneId;

  // Must have a ship for full patrol duty — shipless officers get reduced desk stipend
  if (!agent.shipId) {
    const DESK_STIPEND = 5;
    await AgentQueries.addCash(agent.id, DESK_STIPEND);
    return {
      success: true,
      message: `Administrative duties at port — ${DESK_STIPEND} gold stipend (no ship for sea patrol)`,
      data: { zone, desk: true },
    };
  }

  // Crown/Admiralty stipend for active patrol duty — covers crew wages and basic upkeep
  // Naval officers and pirate hunters receive pay for keeping the seas safe
  const PATROL_STIPEND = 50;
  await AgentQueries.addCash(agent.id, PATROL_STIPEND);

  // Increase patrol presence in zone
  await execute(
    'UPDATE sea_zones SET encounter_chance = MIN(30, encounter_chance + 3) WHERE id = ?',
    [zone],
  );

  // 15% chance to spot a pirate ship in zone
  const spotted: { id: string; name: string }[] = [];
  if (Math.random() < 0.15) {
    const shipsInZone = await ShipQueries.getByZone(zone);
    // Find ships belonging to pirates
    for (const ship of shipsInZone) {
      if (!ship.captain_id) continue;
      const captain = await AgentQueries.getById(ship.captain_id);
      if (captain && (captain.type === 'pirate_captain' || captain.infamy > 10)) {
        spotted.push({ id: ship.id, name: ship.name });
        // Create intel sighting
        await IntelQueries.insert({
          id: uuid(),
          source_agent_id: agent.id,
          subject_agent_id: captain.id,
          subject_ship_id: ship.id,
          type: 'sighting',
          content: `Naval patrol spotted ${ship.name} in ${zone}`,
          accuracy: 90,
          freshness: 100,
          port_id: agent.portId || '',
          price: null,
          created_tick: tick,
        });
        break; // One sighting per patrol
      }
    }
  }

  if (spotted.length > 0) {
    return {
      success: true,
      message: `Patrolled ${zone} — spotted ${spotted.length} vessel${spotted.length > 1 ? 's' : ''}: ${spotted.map(s => s.name).join(', ')}`,
      data: { zone, spotted },
    };
  }

  return {
    success: true,
    message: `Patrolled ${zone} — sea lanes clear`,
    data: { zone },
  };
}

export async function executePursueTarget(
  agent: AgentState,
  _params: Record<string, unknown>,
  _tick: number,
): Promise<ActionResult> {
  // Must be at sea with a ship
  if (!agent.shipId) {
    return { success: false, message: 'No ship — cannot pursue' };
  }

  if (agent.status !== 'at_sea' && agent.status !== 'in_port') {
    return { success: false, message: 'Must be at sea or in port to pursue' };
  }

  // Find ships in same zone
  const shipsInZone = await ShipQueries.getByZone(agent.seaZoneId);
  const targets = shipsInZone.filter(s => s.id !== agent.shipId);

  if (targets.length === 0) {
    return { success: false, message: 'No targets in range' };
  }

  // Pick the first target (could be refined to pick pirates)
  const target = targets[0];

  return {
    success: true,
    message: `In pursuit of target vessel ${target.name}`,
    data: { targetShipId: target.id, targetShipName: target.name, zone: agent.seaZoneId },
  };
}

export async function executeBuildCase(
  agent: AgentState,
  _params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  const openCases = await NavyCaseQueries.getOpen();
  if (openCases.length === 0) {
    return { success: false, message: 'No active investigations' };
  }

  const navyCase = openCases[0];
  const target = await AgentQueries.getById(navyCase.target_agent_id);
  const targetName = target?.name ?? navyCase.target_agent_id;

  // Add evidence: increase evidence_level by 3
  const newLevel = navyCase.evidence_level + 3;
  await NavyCaseQueries.updateEvidence(navyCase.id, newLevel, tick);

  return {
    success: true,
    message: `Built case — evidence strengthened against ${targetName}`,
    data: { caseId: navyCase.id, targetName, evidenceLevel: newLevel },
  };
}

export async function executeArrest(
  agent: AgentState,
  _params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  // Find agents with warrants
  const warranted = await NavyCaseQueries.getWarranted();
  if (warranted.length === 0) {
    return { success: false, message: 'No outstanding warrants' };
  }

  // Find a warranted agent at the same port
  let targetCase = null;
  let targetAgent = null;
  for (const nc of warranted) {
    const candidate = await AgentQueries.getById(nc.target_agent_id);
    if (candidate && candidate.port_id === agent.portId && candidate.status !== 'dead' && candidate.status !== 'imprisoned') {
      targetCase = nc;
      targetAgent = candidate;
      break;
    }
  }

  if (!targetCase || !targetAgent) {
    return { success: false, message: 'No wanted agents at this port' };
  }

  // 50% base chance + 20% if agent has high combat (check persona seamanship as proxy)
  const combatBonus = agent.persona.traits.bravery > 60 ? 0.2 : 0;
  const successChance = 0.5 + combatBonus;

  if (Math.random() < successChance) {
    // Success: imprison target
    await AgentQueries.updateStatus(targetAgent.id, 'imprisoned');
    await NavyCaseQueries.updateStatus(targetCase.id, 'arrested', tick);
    await AgentQueries.addCash(agent.id, 20);

    return {
      success: true,
      message: `Arrested ${targetAgent.name}`,
      data: { targetId: targetAgent.id, targetName: targetAgent.name, reward: 20 },
    };
  } else {
    // Failure: target flees if they have a ship
    if (targetAgent.ship_id) {
      await AgentQueries.updateStatus(targetAgent.id, 'at_sea');
    }

    return {
      success: false,
      message: `Arrest attempt failed — ${targetAgent.name} evaded`,
      data: { targetId: targetAgent.id, targetName: targetAgent.name },
    };
  }
}

export async function executeEscortConvoy(
  agent: AgentState,
  _params: Record<string, unknown>,
  _tick: number,
): Promise<ActionResult> {
  // Find merchant ships at port or in zone
  const shipsAtPort = await ShipQueries.getByPort(agent.portId);
  const merchantShips = shipsAtPort.filter(s => s.id !== agent.shipId);

  if (merchantShips.length === 0) {
    // Try zone
    const shipsInZone = await ShipQueries.getByZone(agent.seaZoneId);
    const zoneTargets = shipsInZone.filter(s => s.id !== agent.shipId);
    if (zoneTargets.length === 0) {
      return { success: false, message: 'No merchant ships to escort' };
    }
  }

  // Officer earns escort fee
  await AgentQueries.addCash(agent.id, 15);

  return {
    success: true,
    message: 'Escorting merchant convoy',
    data: { fee: 15 },
  };
}

export async function executeReportToAdmiralty(
  agent: AgentState,
  _params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  // Create intel about pirate activity the officer has observed
  await IntelQueries.insert({
    id: uuid(),
    source_agent_id: agent.id,
    subject_agent_id: null,
    subject_ship_id: null,
    type: 'sighting',
    content: `Naval officer ${agent.name} submitted admiralty report for ${agent.seaZoneId}`,
    accuracy: 85,
    freshness: 100,
    port_id: agent.portId || '',
    price: null,
    created_tick: tick,
  });

  // Boost officer's reputation +3
  await execute(
    'UPDATE reputation SET reputation = MIN(100, reputation + 3) WHERE agent_id = ? AND sea_zone_id = ?',
    [agent.id, agent.seaZoneId],
  );

  // Admiralty pay for filing reports — covers operational expenses
  const REPORT_PAY = 30;
  await AgentQueries.addCash(agent.id, REPORT_PAY);

  return {
    success: true,
    message: `Reported to the Admiralty. Received ${REPORT_PAY} in operational funds.`,
    data: { zone: agent.seaZoneId, pay: REPORT_PAY },
  };
}

export async function executeTrackTarget(
  agent: AgentState,
  _params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  // Find agents with active bounties
  const rows = await query<{ target_agent_id: string; name: string; port_id: string; sea_zone_id: string }[]>(
    'SELECT b.target_agent_id, a.name, a.port_id, a.sea_zone_id FROM bounties b JOIN agents a ON b.target_agent_id = a.id WHERE b.status = \'active\' LIMIT 1',
  );

  if (rows.length === 0) {
    return { success: false, message: 'No active bounties to track' };
  }

  const target = rows[0];
  const location = target.port_id || target.sea_zone_id || 'unknown waters';

  // Create intel about target's location
  await IntelQueries.insert({
    id: uuid(),
    source_agent_id: agent.id,
    subject_agent_id: target.target_agent_id,
    subject_ship_id: null,
    type: 'sighting',
    content: `${agent.name} tracked ${target.name} — last seen near ${location}`,
    accuracy: 70,
    freshness: 100,
    port_id: agent.portId || '',
    price: null,
    created_tick: tick,
  });

  return {
    success: true,
    message: `Tracking ${target.name} — last seen near ${location}`,
    data: { targetId: target.target_agent_id, targetName: target.name, location },
  };
}

export async function executeClaimBounty(
  agent: AgentState,
  _params: Record<string, unknown>,
  _tick: number,
): Promise<ActionResult> {
  // Find fulfilled bounties (target is dead or imprisoned)
  const rows = await query<{ id: string; target_agent_id: string; amount: number }[]>(
    'SELECT b.* FROM bounties b WHERE b.status = \'active\' AND EXISTS (SELECT 1 FROM agents a WHERE a.id = b.target_agent_id AND a.status IN (\'dead\',\'imprisoned\'))',
  );

  if (rows.length === 0) {
    return { success: false, message: 'No bounties to claim' };
  }

  const bounty = rows[0];
  const target = await AgentQueries.getById(bounty.target_agent_id);
  const targetName = target?.name ?? bounty.target_agent_id;

  // Collect bounty
  await AgentQueries.addCash(agent.id, bounty.amount);
  await BountyQueries.updateStatus(bounty.id, 'claimed');

  return {
    success: true,
    message: `Claimed bounty of ${bounty.amount} on ${targetName}`,
    data: { bountyId: bounty.id, targetName, amount: bounty.amount },
  };
}

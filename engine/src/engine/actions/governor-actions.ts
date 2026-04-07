import type { AgentState } from '../../runtime/types.js';
import type { ActionResult } from './sail-to.js';
import { v4 as uuid } from 'uuid';
import { AgentQueries, NavyCaseQueries, BountyQueries, EventQueries } from '../../db/queries.js';
import { execute, query } from '../../db/sqlite.js';
import { resolveTrial } from '../../engine/trial.js';
import { postBounty } from '../../engine/trial.js';
import { issueLetterOfMarque } from '../../engine/documents.js';

// ============================================================
// Governor Actions — port-level administrative actions
// ============================================================

/** Log a governor action as a world event in the DB */
async function logGovernorEvent(
  type: string, description: string, agentId: string,
  portId: string, severity: number, tick: number, data?: Record<string, unknown>,
): Promise<void> {
  try {
    await EventQueries.insert({
      id: uuid(),
      type,
      description,
      agent_ids: JSON.stringify([agentId]),
      ship_ids: '[]',
      port_id: portId,
      sea_zone_id: null,
      severity,
      tick,
      data: JSON.stringify(data ?? {}),
    });
  } catch { /* non-fatal */ }
}

export async function executeHostTrial(
  agent: AgentState,
  _params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  const arrested = await NavyCaseQueries.getArrested();
  if (arrested.length === 0) {
    return { success: false, message: 'No prisoners awaiting trial' };
  }

  const navyCase = arrested[0];
  const result = await resolveTrial(navyCase.id, agent.portId, tick);
  if (!result) {
    return { success: false, message: 'Trial could not be resolved' };
  }

  return {
    success: true,
    message: `Held trial — verdict: ${result.verdict}, sentence: ${result.sentence}`,
    data: {
      caseId: result.caseId,
      defendantId: result.defendantId,
      verdict: result.verdict,
      sentence: result.sentence,
    },
  };
}

export async function executeGrantPardon(
  agent: AgentState,
  _params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  const rows = await query<{ id: string; target_agent_id: string; status: string }[]>(
    'SELECT nc.* FROM navy_cases nc JOIN agents a ON nc.target_agent_id = a.id WHERE a.port_id = ? AND nc.status IN (\'open\',\'warrant_issued\') LIMIT 1',
    [agent.portId],
  );

  if (rows.length === 0) {
    return { success: false, message: 'No cases to pardon at this port' };
  }

  const navyCase = rows[0];
  const target = await AgentQueries.getById(navyCase.target_agent_id);
  if (!target) {
    return { success: false, message: 'Target agent not found' };
  }

  // Dismiss the case
  await NavyCaseQueries.updateStatus(navyCase.id, 'dismissed', tick);

  // Reduce target's infamy by 10
  const newInfamy = Math.max(0, target.infamy - 10);
  await execute('UPDATE agents SET infamy = ? WHERE id = ?', [newInfamy, target.id]);

  // Governor earns 50 gold fee, target pays
  await AgentQueries.addCash(agent.id, 50);
  await AgentQueries.addCash(target.id, -50);

  return {
    success: true,
    message: `Granted pardon to ${target.name}`,
    data: { targetId: target.id, targetName: target.name },
  };
}

export async function executeIssueLetterOfMarque(
  agent: AgentState,
  _params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  // Find a privateer or pirate captain at this port
  const candidates = await query<{ id: string; name: string; nationality: string }[]>(
    'SELECT * FROM agents WHERE port_id = ? AND type IN (\'privateer_captain\',\'pirate_captain\') AND status != \'dead\' LIMIT 1',
    [agent.portId],
  );

  if (candidates.length === 0) {
    return { success: false, message: 'No captains seeking letters of marque' };
  }

  const captain = candidates[0];

  // Determine issuing nation from the governor's own agent record
  const govAgent = await AgentQueries.getById(agent.id);
  const issuingNation = govAgent?.nationality ?? 'england';

  await issueLetterOfMarque(
    captain.id,
    issuingNation,
    ['spain'],
    agent.portId,
    tick,
  );

  // Governor earns 100 gold commission
  await AgentQueries.addCash(agent.id, 100);

  return {
    success: true,
    message: `Issued letter of marque to ${captain.name}`,
    data: { captainId: captain.id, captainName: captain.name, targetNation: 'spain' },
  };
}

export async function executeIncreasePatrols(
  agent: AgentState,
  _params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  // Check governor can afford it
  const govAgent = await AgentQueries.getById(agent.id);
  if (!govAgent || govAgent.cash < 50) {
    return { success: false, message: 'Insufficient funds for patrols (need 50 gold)' };
  }

  // Increase fort_strength at port
  await execute(
    'UPDATE ports SET fort_strength = MIN(100, fort_strength + 5) WHERE id = ?',
    [agent.portId],
  );

  // Increase encounter_chance in the port's sea zone
  await execute(
    'UPDATE sea_zones SET encounter_chance = MIN(30, encounter_chance + 2) WHERE id = ?',
    [agent.seaZoneId],
  );

  // Deduct cost
  await AgentQueries.addCash(agent.id, -50);

  await logGovernorEvent('governor_patrols', `Governor increased naval patrols around ${agent.portId}`, agent.id, agent.portId, 3, tick, { portId: agent.portId, cost: 50 });

  return {
    success: true,
    message: `Increased naval patrols around ${agent.portId}`,
    data: { portId: agent.portId, cost: 50 },
  };
}

export async function executeLowerTariffs(
  agent: AgentState,
  _params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  // Increase prosperity and market_size
  await execute(
    'UPDATE ports SET prosperity = MIN(100, prosperity + 3) WHERE id = ?',
    [agent.portId],
  );
  await execute(
    'UPDATE ports SET market_size = MIN(100, market_size + 2) WHERE id = ?',
    [agent.portId],
  );

  await logGovernorEvent('governor_tariffs', `Governor lowered tariffs at ${agent.portId} — prosperity rises`, agent.id, agent.portId, 3, tick, { portId: agent.portId, direction: 'lower' });

  return {
    success: true,
    message: 'Lowered tariffs — merchants welcome',
    data: { portId: agent.portId },
  };
}

export async function executeRaiseTariffs(
  agent: AgentState,
  _params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  // Governor earns 30 gold tax revenue
  await AgentQueries.addCash(agent.id, 30);

  // Decrease prosperity, increase corruption
  await execute(
    'UPDATE ports SET prosperity = MAX(0, prosperity - 2) WHERE id = ?',
    [agent.portId],
  );
  await execute(
    'UPDATE ports SET corruption = MIN(100, corruption + 1) WHERE id = ?',
    [agent.portId],
  );

  await logGovernorEvent('governor_tariffs', `Governor raised tariffs at ${agent.portId} — corruption increases`, agent.id, agent.portId, 3, tick, { portId: agent.portId, direction: 'raise', revenue: 30 });

  return {
    success: true,
    message: 'Raised tariffs — revenue increased',
    data: { portId: agent.portId, revenue: 30 },
  };
}

export async function executePostBounty(
  agent: AgentState,
  _params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  // Find pirate/privateer agents with high infamy — only valid bounty targets
  const infamous = await query<{ id: string; name: string; infamy: number }[]>(
    'SELECT * FROM agents WHERE infamy > 20 AND status != \'dead\' AND type IN (\'pirate_captain\', \'privateer_captain\') AND id != ? ORDER BY infamy DESC LIMIT 1',
    [agent.id],
  );

  if (infamous.length === 0) {
    return { success: false, message: 'No pirates warrant a bounty' };
  }

  const target = infamous[0];

  // Guard: cannot post bounty on yourself
  if (target.id === agent.id) {
    return { success: false, message: 'Cannot post bounty on yourself' };
  }
  const bountyAmount = target.infamy * 5;

  // Governor pays the bounty
  const govAgent = await AgentQueries.getById(agent.id);
  if (!govAgent || govAgent.cash < bountyAmount) {
    return { success: false, message: `Insufficient funds for bounty (need ${bountyAmount} gold)` };
  }

  await AgentQueries.addCash(agent.id, -bountyAmount);

  await postBounty(
    target.id,
    agent.id,
    null,
    bountyAmount,
    `Wanted for piracy — infamy ${target.infamy}`,
    tick,
  );

  return {
    success: true,
    message: `Posted bounty of ${bountyAmount} on ${target.name}`,
    data: { targetId: target.id, targetName: target.name, amount: bountyAmount },
  };
}

export async function executeFortifyPort(
  agent: AgentState,
  _params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  // Check governor can afford it
  const govAgent = await AgentQueries.getById(agent.id);
  if (!govAgent || govAgent.cash < 100) {
    return { success: false, message: 'Insufficient funds for fortification (need 100 gold)' };
  }

  await execute(
    'UPDATE ports SET fort_strength = MIN(100, fort_strength + 5) WHERE id = ?',
    [agent.portId],
  );

  await AgentQueries.addCash(agent.id, -100);

  await logGovernorEvent('governor_fortify', `Governor fortified defenses at ${agent.portId}`, agent.id, agent.portId, 4, tick, { portId: agent.portId, cost: 100 });

  return {
    success: true,
    message: `Fortified ${agent.portId} defenses`,
    data: { portId: agent.portId, cost: 100 },
  };
}

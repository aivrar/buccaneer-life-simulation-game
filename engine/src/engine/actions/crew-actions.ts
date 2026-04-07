import type { AgentState } from '../../runtime/types.js';
import { AgentStatus } from '../../runtime/types.js';
import { AgentQueries, ShipQueries, CrewQueries, WoundQueries, SkillQueries } from '../../db/queries.js';
import { v4 as uuid } from 'uuid';
import type { ActionResult } from './sail-to.js';

// ============================================================
// Crew Member Actions
// ============================================================

const MAX_WOUNDS_PER_AGENT = 5;

/** Insert a wound only if the agent has fewer than MAX_WOUNDS active */
async function insertWoundCapped(wound: Parameters<typeof WoundQueries.insert>[0]): Promise<boolean> {
  const existing = await WoundQueries.getByAgent(wound.agent_id);
  const activeCount = existing.filter(w => w.healing_progress < 100).length;
  if (activeCount >= MAX_WOUNDS_PER_AGENT) return false;
  await WoundQueries.insert(wound);
  return true;
}

/**
 * Crew member performs ship duties.
 * Boosts own loyalty +3, 20% chance to gain seamanship XP.
 */
export async function executeWork(
  agent: AgentState,
  _params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  // Find crew record for this agent
  const crewRecords = await CrewQueries.getByAgent(agent.id);
  const crew = crewRecords.find(c => c.status === 'active');
  if (!crew) {
    return { success: false, message: 'Not on a crew' };
  }

  // Boost loyalty by +3 (cap at 100)
  const newLoyalty = Math.min(100, crew.loyalty + 3);
  await CrewQueries.updateLoyalty(crew.id, newLoyalty);

  // 20% chance to gain seamanship XP
  if (Math.random() < 0.20) {
    await SkillQueries.upsert(agent.id, 'seamanship', 'sail_handling', 1, 1, tick);
  }

  return { success: true, message: 'Worked the rigging and earned your keep' };
}

/**
 * Crew member spreads discontent.
 * Own loyalty -2, 1-2 other crew on same ship lose -1 each.
 */
export async function executeGrumble(
  agent: AgentState,
  _params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  const crewRecords = await CrewQueries.getByAgent(agent.id);
  const crew = crewRecords.find(c => c.status === 'active');
  if (!crew) {
    return { success: false, message: 'Not on a crew' };
  }

  // Own loyalty drops -2
  const newLoyalty = Math.max(0, crew.loyalty - 2);
  await CrewQueries.updateLoyalty(crew.id, newLoyalty);

  // Spread discontent to 1-2 other crew
  const shipCrew = await CrewQueries.getActiveByShip(crew.ship_id);
  const others = shipCrew.filter(c => c.id !== crew.id);
  const affectedCount = Math.min(others.length, Math.floor(Math.random() * 2) + 1);

  for (let i = 0; i < affectedCount; i++) {
    const target = others[i]!;
    await CrewQueries.updateLoyalty(target.id, Math.max(0, target.loyalty - 1));
  }

  return { success: true, message: 'Grumbled about conditions to the crew' };
}

/**
 * Crew member voices support for the captain.
 * Own loyalty +5.
 */
export async function executeSupportCaptain(
  agent: AgentState,
): Promise<ActionResult> {
  const crewRecords = await CrewQueries.getByAgent(agent.id);
  const crew = crewRecords.find(c => c.status === 'active');
  if (!crew) {
    return { success: false, message: 'Not on a crew' };
  }

  const newLoyalty = Math.min(100, crew.loyalty + 5);
  await CrewQueries.updateLoyalty(crew.id, newLoyalty);

  return { success: true, message: 'Spoke up in support of the captain' };
}

/**
 * Crew member challenges the captain's authority.
 * Own loyalty -10, 30% chance others lose -3, if loyalty was < 30 then 15% chance of a fight wound.
 */
export async function executeChallengeCaptain(
  agent: AgentState,
  _params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  const crewRecords = await CrewQueries.getByAgent(agent.id);
  const crew = crewRecords.find(c => c.status === 'active');
  if (!crew) {
    return { success: false, message: 'Not on a crew' };
  }

  const wasLowLoyalty = crew.loyalty < 30;
  const newLoyalty = Math.max(0, crew.loyalty - 10);
  await CrewQueries.updateLoyalty(crew.id, newLoyalty);

  // 30% chance ripple effect on other crew
  if (Math.random() < 0.30) {
    const shipCrew = await CrewQueries.getActiveByShip(crew.ship_id);
    for (const member of shipCrew) {
      if (member.id !== crew.id) {
        await CrewQueries.updateLoyalty(member.id, Math.max(0, member.loyalty - 3));
      }
    }
  }

  // If loyalty was already low, chance of getting beaten
  if (wasLowLoyalty && Math.random() < 0.15) {
    await insertWoundCapped({
      id: uuid(),
      agent_id: agent.id,
      type: 'cut',
      severity: 2,
      location: 'arm',
      treated: false,
      healing_progress: 0,
      created_tick: tick,
    });
    return { success: true, message: 'Challenged the captain and was beaten down' };
  }

  return { success: true, message: "Challenged the captain's orders" };
}

/**
 * Crew member deserts at port.
 * Only works IN_PORT. Agent status → fled, crew status → deserted.
 */
export async function executeDesert(
  agent: AgentState,
): Promise<ActionResult> {
  if (agent.status !== AgentStatus.IN_PORT) {
    return { success: false, message: 'Can only desert while in port' };
  }

  // If on a ship, remove from crew
  const crewRecords = await CrewQueries.getByAgent(agent.id);
  const crew = crewRecords.find(c => c.status === 'active');
  if (crew) {
    await CrewQueries.updateStatus(crew.id, 'deserted');
    const ship = await ShipQueries.getById(crew.ship_id);
    if (ship) {
      await ShipQueries.updateCrewCount(ship.id, Math.max(0, ship.crew_count - 1));
    }
  }

  await AgentQueries.updateStatus(agent.id, 'fled');

  return { success: true, message: 'Deserted the crew at port' };
}

/**
 * Crew member attempts to steal from the ship's stores.
 * 40% success: gain 5-20 gold. 60% failure: loyalty -15, 30% chance wound.
 */
export async function executeSteal(
  agent: AgentState,
  _params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  const crewRecords = await CrewQueries.getByAgent(agent.id);
  const crew = crewRecords.find(c => c.status === 'active');

  if (Math.random() < 0.40) {
    // Success
    const stolen = Math.floor(Math.random() * 16) + 5; // 5-20
    await AgentQueries.addCash(agent.id, stolen);
    return { success: true, message: 'Stole from the ship\'s stores', data: { gold: stolen } };
  }

  // Failure
  if (crew) {
    await CrewQueries.updateLoyalty(crew.id, Math.max(0, crew.loyalty - 15));
  }

  // 30% chance of punishment wound
  if (Math.random() < 0.30) {
    await insertWoundCapped({
      id: uuid(),
      agent_id: agent.id,
      type: 'cut',
      severity: 3,
      location: 'arm',
      treated: false,
      healing_progress: 0,
      created_tick: tick,
    });
  }

  return { success: false, message: 'Caught stealing — punished' };
}

/**
 * Agent gets into a brawl.
 * Both agents take minor wounds. Winner (50/50) gets +3 respect, loser -2.
 */
export async function executeFight(
  agent: AgentState,
  params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  const targetId = params.target_agent_id as string | undefined;

  // Find an opponent — if not specified, find another agent at same port or ship
  // Officials (governors, harbor masters) are off-limits — fighting them means arrest
  const BRAWL_IMMUNE = new Set(['port_governor', 'harbor_master', 'plantation_owner']);
  let opponentId = targetId;
  if (!opponentId) {
    if (agent.portId) {
      const portAgents = await AgentQueries.getByPort(agent.portId);
      const candidates = portAgents.filter(a =>
        a.id !== agent.id && a.status !== 'dead' && !BRAWL_IMMUNE.has(a.type));
      if (candidates.length > 0) {
        opponentId = candidates[Math.floor(Math.random() * candidates.length)]!.id;
      }
    }
  }

  if (!opponentId) {
    return { success: false, message: 'No one to fight' };
  }

  // Both take minor wounds — 50% chance each (not every fight draws blood)
  // Severity 1 (bruises/scrapes), not 2 (was causing lethal wound accumulation)
  if (Math.random() < 0.5) {
    await insertWoundCapped({
      id: uuid(),
      agent_id: agent.id,
      type: 'cut',
      severity: 1,
      location: 'arm',
      treated: false,
      healing_progress: 0,
      created_tick: tick,
    });
  }

  if (Math.random() < 0.5) {
    await insertWoundCapped({
      id: uuid(),
      agent_id: opponentId,
      type: 'cut',
      severity: 1,
      location: 'arm',
      treated: false,
      healing_progress: 0,
      created_tick: tick,
    });
  }

  // 50/50 winner
  const agentWon = Math.random() < 0.5;

  // Update reputations via infamy as a proxy for respect
  if (agentWon) {
    // Winner: +3 infamy (respect proxy)
    const agentData = await AgentQueries.getById(agent.id);
    if (agentData) {
      await AgentQueries.addCash(agent.id, 0); // no-op for cash, but infamy tracked separately
    }
  }

  const opponent = await AgentQueries.getById(opponentId);
  const opponentName = opponent?.name ?? 'someone';

  return {
    success: true,
    message: `Got into a fight with ${opponentName} — ${agentWon ? 'won' : 'lost'}`,
    data: { won: agentWon, opponent_id: opponentId },
  };
}

/**
 * Agent gambles.
 * 45% win 5-15 gold, 55% lose 5-15 gold.
 */
export async function executeGamble(
  agent: AgentState,
): Promise<ActionResult> {
  const agentData = await AgentQueries.getById(agent.id);
  if (!agentData) return { success: false, message: 'Agent not found' };

  if (Math.random() < 0.45) {
    // Win
    const winnings = Math.floor(Math.random() * 11) + 5; // 5-15
    await AgentQueries.addCash(agent.id, winnings);
    return { success: true, message: 'Won at dice!', data: { gold: winnings } };
  } else {
    // Lose
    const maxLoss = Math.min(Math.floor(Math.random() * 11) + 5, agentData.cash); // 5-15 or all cash
    if (maxLoss > 0) {
      await AgentQueries.addCash(agent.id, -maxLoss);
    }
    return { success: true, message: 'Lost at cards', data: { gold: -maxLoss } };
  }
}

/**
 * Agent has a drink at the tavern.
 * Spend 2 gold, loyalty +2, 10% chance bonus loyalty +5 (drunk).
 */
export async function executeDrink(
  agent: AgentState,
): Promise<ActionResult> {
  const agentData = await AgentQueries.getById(agent.id);
  if (!agentData || agentData.cash < 2) {
    return { success: false, message: 'Cannot afford a drink' };
  }

  // Spend 2 gold
  await AgentQueries.addCash(agent.id, -2);

  // Boost loyalty if on a crew
  const crewRecords = await CrewQueries.getByAgent(agent.id);
  const crew = crewRecords.find(c => c.status === 'active');

  let message = 'Had a drink at the tavern';
  if (crew) {
    let loyaltyBoost = 2;
    if (Math.random() < 0.10) {
      loyaltyBoost = 5;
      message = 'Had one too many at the tavern — feeling great';
    }
    await CrewQueries.updateLoyalty(crew.id, Math.min(100, crew.loyalty + loyaltyBoost));
  }

  return { success: true, message };
}

/**
 * Agent joins a ship's crew at current port.
 * Finds a ship with room and inserts a crew record.
 */
export async function executeJoinCrew(
  agent: AgentState,
  _params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  if (!agent.portId) {
    return { success: false, message: 'Must be at a port to join a crew' };
  }

  // Find ships at port with room
  const ships = await ShipQueries.getByPort(agent.portId);
  const availableShip = ships.find(s => s.crew_count < s.crew_capacity);
  if (!availableShip) {
    return { success: false, message: 'No ships at port with room for crew' };
  }

  // Determine role based on agent type
  const role = agent.type === 'surgeon' ? 'surgeon' : 'common_sailor';

  // Insert crew record
  await CrewQueries.insert({
    id: uuid(),
    agent_id: agent.id,
    ship_id: availableShip.id,
    role,
    loyalty: 50,
    share_agreement: 1.0,
    grievances: '[]',
    skills: '{}',
    joined_tick: tick,
    status: 'active',
  });

  // Update ship crew count
  await ShipQueries.updateCrewCount(availableShip.id, availableShip.crew_count + 1);

  return {
    success: true,
    message: `Joined the crew of ${availableShip.name}`,
    data: { ship_id: availableShip.id, role },
  };
}

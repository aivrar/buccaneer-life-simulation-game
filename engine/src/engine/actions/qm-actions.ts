import type { AgentState } from '../../runtime/types.js';
import { AgentQueries, ShipQueries, CrewQueries } from '../../db/queries.js';
import type { ActionResult } from './sail-to.js';

// ============================================================
// Quartermaster Actions
// ============================================================

/**
 * Helper: find the QM's ship. QMs are crew members, so look up their crew record.
 */
async function getQmShip(agent: AgentState) {
  // Check if agent has a direct ship reference
  if (agent.shipId) {
    return ShipQueries.getById(agent.shipId);
  }
  // Otherwise find via crew record
  const crewRecords = await CrewQueries.getByAgent(agent.id);
  const activeCrew = crewRecords.find(c => c.status === 'active');
  if (!activeCrew) return null;
  return ShipQueries.getById(activeCrew.ship_id);
}

/**
 * Distribute shares of the captain's gold to crew.
 * 20% of captain's cash (min 10 gold) split equally. All crew loyalty +8.
 */
export async function executeDistributeShares(
  agent: AgentState,
): Promise<ActionResult> {
  const ship = await getQmShip(agent);
  if (!ship) return { success: false, message: 'Not assigned to a ship' };
  if (!ship.captain_id) return { success: false, message: 'Ship has no captain' };

  const captain = await AgentQueries.getById(ship.captain_id);
  if (!captain) return { success: false, message: 'Captain not found' };

  if (captain.cash < 10) {
    return { success: false, message: 'Captain has no gold to distribute' };
  }

  // Calculate share pool: 20% of captain's cash, minimum 10
  const sharePool = Math.max(10, Math.floor(captain.cash * 0.20));

  // Get active crew
  const crew = await CrewQueries.getActiveByShip(ship.id);
  if (crew.length === 0) {
    return { success: false, message: 'No crew to pay' };
  }

  // Each crew gets equal share
  const perCrewShare = Math.floor(sharePool / crew.length);
  const totalDistributed = perCrewShare * crew.length;

  // Captain loses the distributed amount
  await AgentQueries.addCash(captain.id, -totalDistributed);

  // Each crew member gains their share and loyalty boost
  for (const member of crew) {
    // Pay the crew member agent
    await AgentQueries.addCash(member.agent_id, perCrewShare);
    // Loyalty boost +8
    await CrewQueries.updateLoyalty(member.id, Math.min(100, member.loyalty + 8));
  }

  return {
    success: true,
    message: `Distributed ${totalDistributed} gold among ${crew.length} crew`,
    data: { totalDistributed, crewCount: crew.length, perCrewShare },
  };
}

/**
 * Settle a dispute among the crew.
 * Clears one grievance from a crew member, boosts their loyalty +5.
 */
export async function executeSettleDispute(
  agent: AgentState,
): Promise<ActionResult> {
  const ship = await getQmShip(agent);
  if (!ship) return { success: false, message: 'Not assigned to a ship' };

  const crew = await CrewQueries.getActiveByShip(ship.id);

  // Find crew with grievances
  const crewWithGrievances = crew.filter(c => {
    try {
      const grievances = JSON.parse(c.grievances);
      return Array.isArray(grievances) && grievances.length > 0;
    } catch {
      return false;
    }
  });

  if (crewWithGrievances.length === 0) {
    return { success: true, message: 'No disputes to settle — crew is content' };
  }

  // Pick a random crew member with grievances
  const target = crewWithGrievances[Math.floor(Math.random() * crewWithGrievances.length)]!;
  const grievances: string[] = JSON.parse(target.grievances);

  // Remove one grievance
  grievances.shift();
  await CrewQueries.updateGrievances(target.id, JSON.stringify(grievances));

  // Boost loyalty +5
  await CrewQueries.updateLoyalty(target.id, Math.min(100, target.loyalty + 5));

  const targetAgent = await AgentQueries.getById(target.agent_id);
  const targetName = targetAgent?.name ?? 'a crew member';

  return {
    success: true,
    message: `Settled a dispute with ${targetName}`,
    data: { crew_id: target.id, remaining_grievances: grievances.length },
  };
}

/**
 * QM advises the captain on crew matters.
 * Captain gains +3 loyalty toward the QM (relationship boost).
 */
export async function executeAdviseCaptain(
  agent: AgentState,
): Promise<ActionResult> {
  const ship = await getQmShip(agent);
  if (!ship) return { success: false, message: 'Not assigned to a ship' };
  if (!ship.captain_id) return { success: false, message: 'Ship has no captain' };

  // Try to boost the relationship
  const { RelationshipQueries } = await import('../../db/queries.js');
  const rel = await RelationshipQueries.getByPair(ship.captain_id, agent.id);

  if (rel) {
    await RelationshipQueries.upsert({
      ...rel,
      respect: Math.min(100, rel.respect + 3),
      trust: Math.min(100, rel.trust + 2),
    });
  }

  return { success: true, message: 'Advised the captain on crew matters' };
}

/**
 * Call a crew vote — democratic process.
 * All crew loyalty +3.
 */
export async function executeCallVote(
  agent: AgentState,
): Promise<ActionResult> {
  const ship = await getQmShip(agent);
  if (!ship) return { success: false, message: 'Not assigned to a ship' };

  const crew = await CrewQueries.getActiveByShip(ship.id);
  for (const member of crew) {
    await CrewQueries.updateLoyalty(member.id, Math.min(100, member.loyalty + 3));
  }

  return {
    success: true,
    message: 'Called a vote — the crew has spoken',
    data: { crewCount: crew.length },
  };
}

/**
 * Manage provisions — optimize food/water usage.
 * Adds +5 food_stores to the ship.
 */
export async function executeManageProvisions(
  agent: AgentState,
): Promise<ActionResult> {
  const ship = await getQmShip(agent);
  if (!ship) return { success: false, message: 'Not assigned to a ship' };

  if (ship.food_stores <= 0) {
    return { success: false, message: 'No provisions to manage' };
  }

  // Stretch supplies: effectively +5 food stores
  await ShipQueries.updateStores(
    ship.id,
    ship.food_stores + 5,
    ship.water_stores,
    ship.powder_stores,
  );

  return {
    success: true,
    message: 'Managed provisions efficiently — stretched supplies',
    data: { food_stores: ship.food_stores + 5 },
  };
}

/**
 * Discipline a low-loyalty crew member.
 * Lowest loyalty crew gets +5 (fear), all others get -2 (resentment).
 */
export async function executeDisciplineCrew(
  agent: AgentState,
): Promise<ActionResult> {
  const ship = await getQmShip(agent);
  if (!ship) return { success: false, message: 'Not assigned to a ship' };

  const crew = await CrewQueries.getActiveByShip(ship.id);
  if (crew.length === 0) {
    return { success: false, message: 'No crew to discipline' };
  }

  // Find lowest loyalty crew member (exclude QM themselves)
  const others = crew.filter(c => c.agent_id !== agent.id);
  if (others.length === 0) {
    return { success: false, message: 'No crew to discipline' };
  }
  const sorted = [...others].sort((a, b) => a.loyalty - b.loyalty);
  const target = sorted[0]!;

  if (target.loyalty > 60) {
    return { success: true, message: 'No discipline needed — crew is well-behaved' };
  }

  // Target loyalty +5 (fear-based compliance)
  await CrewQueries.updateLoyalty(target.id, Math.min(100, target.loyalty + 5));

  // All others -2 (resentment)
  for (const member of crew) {
    if (member.id !== target.id) {
      await CrewQueries.updateLoyalty(member.id, Math.max(0, member.loyalty - 2));
    }
  }

  const targetAgent = await AgentQueries.getById(target.agent_id);
  const targetName = targetAgent?.name ?? 'a crew member';

  return {
    success: true,
    message: `Disciplined ${targetName} — order restored`,
    data: { disciplined_crew_id: target.id },
  };
}

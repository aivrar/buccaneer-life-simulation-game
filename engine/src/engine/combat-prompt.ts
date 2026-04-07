/**
 * Builds combat-specific LLM prompts for captains engaged in battle.
 * Keeps prompts dense and tactical — optimized for small models.
 */

import type { CombatEngagement } from './combat-engagement.js';
import { ShipQueries, AgentQueries, SkillQueries } from '../db/queries.js';
import type { SeaCondition } from '../runtime/types.js';

// ---------------------------------------------------------------------------
// Hull descriptor
// ---------------------------------------------------------------------------
function hullDescriptor(pct: number): string {
  if (pct >= 70) return 'sound';
  if (pct >= 50) return 'damaged';
  if (pct >= 30) return 'badly damaged';
  if (pct >= 15) return 'CRITICAL — taking water';
  return 'SINKING';
}

// ---------------------------------------------------------------------------
// Sail descriptor
// ---------------------------------------------------------------------------
function sailDescriptor(sailPct: number): string {
  if (sailPct >= 70) return 'good';
  if (sailPct >= 40) return 'damaged';
  return 'shredded';
}

// ---------------------------------------------------------------------------
// Armament comparison
// ---------------------------------------------------------------------------
function armamentComparison(myGuns: number, enemyGuns: number): string {
  const ratio = enemyGuns / Math.max(myGuns, 1);
  if (ratio >= 1.8) return `She outguns you ${Math.round(ratio)} to 1.`;
  if (ratio >= 1.2) return 'She outguns you.';
  if (ratio <= 0.55) return `You outgun her ${Math.round(myGuns / Math.max(enemyGuns, 1))} to 1.`;
  if (ratio <= 0.8) return 'You outgun her.';
  return 'Evenly matched.';
}

// ---------------------------------------------------------------------------
// Valid actions per phase
// ---------------------------------------------------------------------------
const ACTIONS_BY_PHASE: Record<string, string[]> = {
  closing: ['fire_broadside', 'fire_chain_shot', 'disengage'],
  broadside: [
    'fire_broadside', 'fire_chain_shot', 'fire_grape_shot',
    'close_for_boarding', 'hold_fire', 'disengage', 'surrender',
  ],
  boarding: ['board', 'repel_boarders', 'disengage', 'surrender'],
};

function getValidActions(
  phase: string,
  isAttacker: boolean,
  isFleeing: boolean,
  round: number,
): string[] {
  if (phase === 'chase') {
    return isFleeing
      ? ['flee', 'dump_cargo', 'surrender']
      : ['pursue', 'break_off'];
  }
  let actions = ACTIONS_BY_PHASE[phase] ?? ACTIONS_BY_PHASE.broadside;
  // Attacker shouldn't surrender on rounds 0-2 — you started this fight
  if (isAttacker && round <= 2) {
    actions = actions.filter(a => a !== 'surrender');
  }
  return actions;
}

// ---------------------------------------------------------------------------
// Main prompt builder
// ---------------------------------------------------------------------------
export async function buildCombatPrompt(
  engagement: CombatEngagement,
  captainId: string,
  seaCondition: SeaCondition | undefined,
): Promise<{ systemPrompt: string; userPrompt: string; validActions: string[] }> {

  // ---- Determine sides ----
  const isAttacker = captainId === engagement.attackerCaptainId;
  const myShipId = isAttacker ? engagement.attackerShipId : engagement.defenderShipId;
  const enemyShipId = isAttacker ? engagement.defenderShipId : engagement.attackerShipId;
  const myHullDmg = isAttacker ? engagement.attackerHullDmg : engagement.defenderHullDmg;
  const enemyHullDmg = isAttacker ? engagement.defenderHullDmg : engagement.attackerHullDmg;
  const mySailDmg = isAttacker ? engagement.attackerSailDmg : engagement.defenderSailDmg;
  const enemySailDmg = isAttacker ? engagement.defenderSailDmg : engagement.attackerSailDmg;
  const myCrewLost = isAttacker ? engagement.attackerCrewLost : engagement.defenderCrewLost;
  const enemyCrewLost = isAttacker ? engagement.defenderCrewLost : engagement.attackerCrewLost;
  const enemyCaptainId = isAttacker ? engagement.defenderCaptainId : engagement.attackerCaptainId;

  // ---- Fetch data ----
  const [myShip, enemyShip, myAgent, enemyAgent] = await Promise.all([
    ShipQueries.getById(myShipId),
    ShipQueries.getById(enemyShipId),
    AgentQueries.getById(captainId),
    AgentQueries.getById(enemyCaptainId),
  ]);

  const captainName = myAgent?.name ?? 'Captain';
  const shipName = myShip?.name ?? 'Unknown';

  // ---- Hull / crew / powder calculations ----
  const myHull = Math.max((myShip?.hull ?? 100) - myHullDmg, 0);
  const enemyHull = Math.max((enemyShip?.hull ?? 100) - enemyHullDmg, 0);
  const mySails = Math.max((myShip?.sails ?? 100) - mySailDmg, 0);
  const myCrew = Math.max((myShip?.crew_count ?? 0) - myCrewLost, 0);
  const enemyCrew = Math.max((enemyShip?.crew_count ?? 0) - enemyCrewLost, 0);
  const myGuns = myShip?.guns ?? 0;
  const enemyGuns = enemyShip?.guns ?? 0;
  const broadsides = Math.floor((myShip?.powder_stores ?? 0) / 10);

  // Enemy approximations (fog of war): round to nearest 10
  const enemyHullApprox = Math.round(enemyHull / 10) * 10;
  const enemyCrewApprox = Math.round(enemyCrew / 10) * 10;

  // ---- Phase & actions ----
  const phase = engagement.phase;
  const round = engagement.round;
  const isFleeing = phase === 'chase' && engagement.fleerId === captainId;
  const validActions = getValidActions(phase, isAttacker, isFleeing, round);

  // ---- System prompt ----
  const systemPrompt =
    `You are ${captainName}, captain of the ${shipName}. You are in battle. Choose your next move wisely — lives depend on it.`;

  // ---- User prompt ----
  const lines: string[] = [];

  // Header with initiative context
  lines.push(`BATTLE — Round ${round} (${phase} Phase)`);
  if (round <= 1) {
    if (isAttacker) {
      lines.push('You initiated this engagement. Press the attack.');
    } else {
      lines.push('You are under attack! Defend yourself or flee.');
    }
  }
  lines.push('');

  // Your ship
  lines.push('YOUR SHIP:');
  lines.push(`  ${myShip?.name ?? '?'} (${myShip?.class ?? '?'}), ${myGuns} guns`);
  lines.push(`  Hull: ${myHull}% — ${hullDescriptor(myHull)}`);
  lines.push(`  Crew: ${myCrew}${myCrewLost > 0 ? ` (lost ${myCrewLost})` : ''}`);
  lines.push(`  Powder: ${broadsides} broadsides remaining`);
  lines.push(`  Sails: ${sailDescriptor(mySails)}`);
  lines.push('');

  // Enemy ship
  lines.push('ENEMY SHIP:');
  lines.push(`  ${enemyShip?.name ?? '?'} (${enemyShip?.class ?? '?'}), ${enemyGuns} guns`);
  lines.push(`  Hull: ~${enemyHullApprox}% — ${hullDescriptor(enemyHullApprox)}`);
  lines.push(`  Crew: ~${enemyCrewApprox}`);
  lines.push(`  ${armamentComparison(myGuns, enemyGuns)}`);
  lines.push('');

  // Situation line
  const situations: string[] = [];
  if (enemyHull < 15) {
    situations.push("She's listing badly — one more broadside could finish her.");
  } else if (myHull < 15) {
    situations.push('Your ship is falling apart. Fight on and you may sink.');
  }
  if (myCrew > enemyCrew * 1.3) {
    situations.push('Your numbers give you the edge in a boarding action.');
  }
  if (enemyGuns > myGuns * 1.4) {
    situations.push('Her guns are heavier. A prolonged broadside exchange favors her.');
  }
  if (phase === 'chase' && engagement.chaseGap != null) {
    const gap = engagement.chaseGap;
    const desc = gap > 50 ? 'pulling away' : gap > 20 ? 'still in range' : 'closing fast';
    situations.push(`She's ${desc}.`);
  }
  if (seaCondition && seaCondition.visibility < 0.3) {
    situations.push('Fog offers cover — you could slip away.');
  }
  if (situations.length > 0) {
    lines.push(situations.join(' '));
    lines.push('');
  }

  // Weather
  if (seaCondition) {
    if (seaCondition.waveHeight >= 3) {
      lines.push('Heavy seas — cannons fire wide.');
    } else if (seaCondition.visibility < 0.3) {
      lines.push('Fog shrouds the battle.');
    } else if (seaCondition.currentSpeed < 0.5 && seaCondition.waveHeight < 0.5) {
      lines.push('Dead calm — no wind to aid escape.');
    }
    lines.push('');
  }

  // Recent battle log
  const log = engagement.log ?? [];
  if (log.length > 0) {
    if (log.length >= 2) {
      lines.push(`Last round: ${log[log.length - 2]}`);
    }
    lines.push(`This round: ${log[log.length - 1]}`);
    lines.push('');
  }

  // Available actions
  lines.push(`COMBAT ACTIONS: ${validActions.join(', ')}`);
  lines.push('');
  lines.push('Pick ONE action. State the action name, then explain why in one sentence.');

  const userPrompt = lines.join('\n');

  return { systemPrompt, userPrompt, validActions };
}

/**
 * Future Planner — deterministic "what opens up next" hints.
 *
 * Looks 1-2 steps ahead and tells the agent what becomes possible
 * if they take certain actions now. All math done by code, presented
 * as narrative to the LLM.
 */

import type { AgentState, WorldState } from '../runtime/types.js';
import type { AgentDataSnapshot } from './narrative-data.js';
import type { ComputedValues } from './narrative-compute.js';

export function buildFuturePlanner(
  agent: AgentState,
  computed: ComputedValues,
  snapshot: AgentDataSnapshot,
  _worldState: WorldState,
): string[] {
  const hints: string[] = [];
  const cash = snapshot.agentDb?.cash ?? 0;
  const ship = snapshot.ship;
  const type = agent.type;

  // ── Pirate / Privateer planning ──────────────────

  if (type === 'pirate_captain' || type === 'privateer_captain') {
    // Hot cargo urgency
    if (computed.hotCargoCount > 0) {
      const estimatedValue = Math.round(computed.cargoValueTotal * 0.7); // after fence cut
      const afterSale = Math.round(cash + estimatedValue);
      if (afterSale >= 150 && !snapshot.havenInvestments?.some(h => h.agent_id === agent.id)) {
        hints.push(`Fence your cargo (~${estimatedValue}g) and you'll have enough to invest in a hideout — safe house and steady income.`);
      } else {
        hints.push(`Hot cargo in the hold draws attention every hour you wait. Sell it or risk the navy finding it.`);
      }
    }

    // Haven investment threshold
    if (cash >= 120 && cash < 150 && !snapshot.havenInvestments?.some(h => h.agent_id === agent.id)) {
      const needed = 150 - Math.round(cash);
      hints.push(`${needed} more gold and you can afford a hideout — one good raid or fence deal away.`);
    }

    // Ship repair before sailing
    if (ship && ship.hull < 50 && agent.status !== 'at_sea') {
      hints.push(`Your ship won't survive another fight in this state. Repair before you sail.`);
    }

    // Crew too thin for combat
    if (ship && ship.crew_count < ship.crew_capacity * 0.3 && ship.crew_count > 0) {
      hints.push(`You're sailing with a skeleton crew. Recruit before your next engagement or you'll be overwhelmed in a boarding.`);
    }

    // Bounty warning
    if (computed.totalBounty > 200) {
      hints.push(`The bounty on your head is drawing hunters. Consider a pardon, or stay away from navy-patrolled waters.`);
    }
  }

  // ── Merchant planning ────────────────────────────

  if (type === 'merchant_captain') {
    // No cargo → buy some
    const ownedCargo = snapshot.cargo?.filter(c => c.quantity > 0 && c.heat <= 10) ?? [];
    if (ownedCargo.length === 0 && agent.status !== 'at_sea') {
      if (cash > 50) {
        hints.push(`Your hold is empty. Buy cargo here and sell it at a port where it's scarce — that's how you make money.`);
      } else {
        hints.push(`Broke and empty-handed. You need gold before you can trade.`);
      }
    }

    // Has cargo → sell at better port
    if (ownedCargo.length > 0 && agent.status !== 'at_sea') {
      hints.push(`Goods in the hold earn nothing sitting in port. Sail somewhere they're worth more.`);
    }

    // Ship damage
    if (ship && ship.hull < 60) {
      hints.push(`A damaged ship is a slow ship, and a slow ship is prey. Repair before your next voyage.`);
    }
  }

  // ── Naval officer planning ───────────────────────

  if (type === 'naval_officer' || type === 'pirate_hunter') {
    const openCases = snapshot.navyCases?.filter(c => c.status === 'warrant_issued') ?? [];
    if (openCases.length > 0) {
      hints.push(`${openCases.length} active warrant${openCases.length > 1 ? 's' : ''} — serve them and the Crown rewards you.`);
    }

    if (!ship) {
      hints.push(`Without a ship you're stuck on shore. Request a new commission or buy a vessel.`);
    }
  }

  // ── Port authority planning ──────────────────────

  if (type === 'port_governor') {
    const activePirates = snapshot.nearbyShips?.filter(s => (s as any).captainType === 'pirate_captain') ?? [];
    if (activePirates.length > 0) {
      hints.push(`Pirates spotted near your port. Post bounties or increase patrols before they raid.`);
    }
  }

  // ── Fence planning ───────────────────────────────

  if (type === 'fence') {
    if (cash < 20) {
      hints.push(`Running low on capital. Set better prices or broker bigger deals.`);
    }
  }

  // ── Crew planning ────────────────────────────────

  if (type === 'crew_member' || type === 'quartermaster') {
    if (computed.avgLoyalty < 40) {
      hints.push(`Morale is dangerously low. The crew is one bad day from mutiny.`);
    }
  }

  // ── Universal: provisions warning ────────────────

  if (ship && agent.status !== 'at_sea') {
    if (computed.daysOfFood < 3 && computed.daysOfFood > 0) {
      hints.push(`Restock provisions before sailing — your crew will starve within days.`);
    }
  }

  // Cap at 3 hints to stay within token budget
  return hints.slice(0, 3);
}

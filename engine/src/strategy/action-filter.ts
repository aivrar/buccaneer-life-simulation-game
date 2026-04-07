import type { AgentState, WorldState } from '../runtime/types.js';
import { AGENT_TYPE_CONFIGS } from '../config/agents.js';
import { AgentStatus } from '../runtime/types.js';
import { getShipsInZone } from '../handlers/travel-tick.js';

/**
 * Rule engine: filters the full tool list to only actions valid given current state.
 * Returns 4-10 action names the agent can take right now.
 */
export function filterActionsForAgent(agent: AgentState, worldState: WorldState): string[] {
  const typeConfig = AGENT_TYPE_CONFIGS[agent.type];
  if (!typeConfig) return ['do_nothing'];

  const allTools = typeConfig.tools;
  const valid: string[] = [];

  for (const tool of allTools) {
    if (isActionAvailable(tool, agent, worldState)) {
      valid.push(tool);
    }
  }

  // Always allow do_nothing as a fallback
  if (!valid.includes('do_nothing')) {
    valid.push('do_nothing');
  }

  return valid;
}

function isActionAvailable(action: string, agent: AgentState, worldState: WorldState): boolean {
  // Universal blocks
  if (agent.status === AgentStatus.DEAD) return false;
  if (agent.status === AgentStatus.IMPRISONED && !['do_nothing', 'negotiate', 'escape'].includes(action)) return false;

  switch (action) {
    // Movement
    case 'sail_to':
      return (agent.status === AgentStatus.IN_PORT || agent.status === AgentStatus.AT_SEA) && !!agent.shipId;
    case 'flee':
      // Flee only makes sense at sea, or in port for pirate types (slipping away)
      if (agent.status === AgentStatus.AT_SEA) return true;
      if (agent.status === AgentStatus.IN_PORT) {
        return agent.type === 'pirate_captain' || agent.type === 'privateer_captain';
      }
      return false;

    // Combat — pirate/privateer captains at sea with a ship can always choose attack
    // (the execution handler will find NPC targets from DB or report "no ships in range")
    // Navy/hunter can engage but ONLY pirate targets (validated in execution handler)
    // Merchants cannot initiate combat
    case 'attack_ship':
    case 'board_ship':
    case 'engage_ship': {
      if (agent.status !== AgentStatus.AT_SEA || !agent.shipId) return false;
      if (agent.type === 'pirate_captain' || agent.type === 'privateer_captain') return true;
      if (agent.type === 'naval_officer' || agent.type === 'pirate_hunter') {
        const zoneShips = agent.seaZoneId ? getShipsInZone(agent.seaZoneId) : [];
        return zoneShips.some(id => id !== agent.shipId);
      }
      return false; // merchants and other types cannot initiate combat
    }

    // Port actions
    case 'trade_cargo':
    case 'buy_cargo':
    case 'sell_cargo':
      // Merchants, pirates, and captains can trade in port
      return agent.status === AgentStatus.IN_PORT &&
        (agent.type === 'merchant_captain' || agent.type === 'pirate_captain' ||
         agent.type === 'privateer_captain' || agent.type === 'pirate_hunter');
    case 'sell_plunder':
      // Only pirate-type captains fence stolen goods
      return agent.status === AgentStatus.IN_PORT &&
        (agent.type === 'pirate_captain' || agent.type === 'privateer_captain' ||
         agent.type === 'pirate_hunter');
    case 'repair_ship':
    case 'careen_ship':
    case 'buy_provisions':
    case 'recruit_crew':
      return agent.status === AgentStatus.IN_PORT && !!agent.shipId;
    case 'visit_tavern':
    case 'invest_haven':
    case 'accept_pardon':
      return agent.status === AgentStatus.IN_PORT;

    // Naval
    case 'patrol_region':
      return agent.status === AgentStatus.AT_SEA || agent.status === AgentStatus.IN_PORT;
    case 'pursue_target':
    case 'escort_convoy':
      return agent.status === AgentStatus.AT_SEA;
    case 'arrest':
    case 'build_case':
      return true; // Can do at port or at sea
    case 'report_to_admiralty':
    case 'report_to_governor':
      return agent.status === AgentStatus.IN_PORT;

    // Social/intel
    case 'negotiate':
    case 'gather_intel':
    case 'sell_intel':
    case 'bribe':
    case 'bribe_official':
    case 'accept_bribe':
    case 'spread_rumor':
    case 'plant_rumor':
    case 'eavesdrop':
      return agent.status === AgentStatus.IN_PORT;

    // Governor/port authority
    case 'issue_letter_of_marque':
    case 'increase_patrols':
    case 'lower_tariffs':
    case 'raise_tariffs':
    case 'post_bounty':
    case 'fortify_port':
    case 'host_trial':
    case 'grant_pardon':
      return agent.status === AgentStatus.IN_PORT;

    // Crew actions — must be assigned to a ship
    case 'work':
    case 'grumble':
    case 'support_captain':
    case 'challenge_captain':
    case 'desert':
    case 'steal':
      return !!agent.shipId;
    // Entertainment actions — require ship assignment for crew_members
    // (unassigned crew should focus on join_crew, not loiter)
    case 'fight':
    case 'gamble':
    case 'drink':
      if (agent.type === 'crew_member' && !agent.shipId) return false;
      return !!agent.shipId;

    // Fence
    case 'buy_stolen_goods':
    case 'sell_goods':
    case 'establish_contact':
    case 'set_prices':
    case 'refuse_deal':
      return agent.status === AgentStatus.IN_PORT;

    // Ship services
    case 'inspect_ship':
    case 'collect_fees':
    case 'deny_entry':
    case 'issue_clearance':
    case 'report_suspicious':
    case 'upgrade_ship':
    case 'assess_damage':
    case 'build_vessel':
      return agent.status === AgentStatus.IN_PORT;

    // Medical
    case 'treat_wound':
    case 'treat_disease':
    case 'amputate':
    case 'prescribe_remedy':
      return true;
    case 'join_crew':
      // Only available if not already assigned to a ship
      return !agent.shipId;

    // Buy vessel — only when in port without a usable ship
    case 'buy_vessel':
      if (agent.status !== AgentStatus.IN_PORT) return false;
      // Only offer if agent has no ship or ship is sunk/captured
      return !agent.shipId;

    // Claim prize — pirate/privateer in port can swap to a captured ship as flagship
    case 'claim_prize':
      if (agent.status !== AgentStatus.IN_PORT || !agent.shipId) return false;
      return agent.type === 'pirate_captain' || agent.type === 'privateer_captain';

    // Commerce
    case 'hire_shipping':
    case 'sell_crop':
    case 'hire_guards':
    case 'invest':
    case 'hire_escort':
      return agent.status === AgentStatus.IN_PORT;

    // QM actions — must be assigned to a ship
    case 'distribute_shares':
    case 'settle_dispute':
    case 'advise_captain':
    case 'call_vote':
    case 'manage_provisions':
    case 'discipline_crew':
      return !!agent.shipId;

    // Tavern
    case 'serve_drinks':
    case 'broker_deal':
    case 'recruit_for':
    case 'shelter_fugitive':
    case 'report_to_authorities':
      return agent.status === AgentStatus.IN_PORT;

    // Bounty hunting — need a ship to hunt
    case 'track_target':
      return !!agent.shipId;
    case 'claim_bounty':
      return agent.status === AgentStatus.IN_PORT;

    // Surrender (at sea only)
    case 'surrender':
      return agent.status === AgentStatus.AT_SEA;
    // Report piracy (at port only — you report when you reach safety)
    case 'report_piracy':
      return agent.status === AgentStatus.IN_PORT;

    // General
    case 'negotiate_pardon':
      return agent.status === AgentStatus.IN_PORT;
    case 'lay_low':
      return agent.status === AgentStatus.IN_PORT || agent.status === AgentStatus.AT_SEA;
    case 'do_nothing':
      return true;

    default:
      return true;
  }
}

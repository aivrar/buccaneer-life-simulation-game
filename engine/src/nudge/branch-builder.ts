/**
 * Build 2-3 data-aware strategic paths based on agent type and current state.
 * Paths reference actual ship condition, crew state, economic situation.
 */

import type { AgentDataSnapshot } from '../strategy/narrative-data.js';
import type { ComputedValues } from '../strategy/narrative-compute.js';

export interface StrategicPath {
  name: string;
  description: string;
  requiredActions: string[];
  estimatedTicks: number;
  risk: 'low' | 'medium' | 'high';
}

export function buildBranchingPaths(snapshot: AgentDataSnapshot, computed: ComputedValues): StrategicPath[] {
  const paths: StrategicPath[] = [];
  const { agent, ship, intel } = snapshot;

  switch (agent.type) {
    case 'pirate_captain':
    case 'privateer_captain': {
      // Hunt path — adjusted for ship condition
      const hullWarning = ship && ship.hull < 50
        ? ` Your hull at ${ship.hull}% cannot survive heavy combat — choose your target carefully.`
        : '';
      const intelTip = intel.length > 0
        ? ` Word of merchant movements has reached you.`
        : '';
      paths.push({
        name: 'Hunt & Plunder',
        description: `Sail to a busy trade route, intercept merchants, sell plunder through fences.${hullWarning}${intelTip} High risk, high reward.`,
        requiredActions: ['sail_to', 'attack_ship', 'board_ship', 'sell_plunder'],
        estimatedTicks: 48,
        risk: 'high',
      });

      // Maintenance path
      const minSailCrew = Math.max(5, Math.floor((ship?.crew_capacity ?? 20) * 0.2));
      const needsCrew = computed.crewCount < minSailCrew;
      if (ship && (ship.hull < 70 || ship.barnacle_level > 40 || needsCrew)) {
        const needs: string[] = [];
        if (ship.hull < 70) needs.push('repairs');
        if (ship.barnacle_level > 40) needs.push('careening');
        if (needsCrew) needs.push(`${minSailCrew - computed.crewCount} new hands`);
        if (computed.hotCargoCount > 0) needs.push('fence the hot cargo');
        paths.push({
          name: 'Refit & Recruit',
          description: `The ship needs ${needs.join(', ')}. Get healthy before you get ambitious. Low risk, but the crew wants action, not maintenance.`,
          requiredActions: ['sell_plunder', 'repair_ship', 'careen_ship', 'recruit_crew'],
          estimatedTicks: 48,
          risk: 'low',
        });
      } else {
        paths.push({
          name: 'Build Haven',
          description: 'Invest in a pirate-friendly port. Tavern, warehouse, fortifications — passive income and a safe harbor when the world turns hostile.',
          requiredActions: ['sail_to', 'invest_haven'],
          estimatedTicks: 72,
          risk: 'low',
        });
      }

      // Crew path if actually short-handed (below minimum sailing crew)
      if (needsCrew) {
        paths.push({
          name: 'Crew Expansion',
          description: `You are ${minSailCrew - computed.crewCount} hands short of a sailing crew. Visit taverns, spend coin, find men willing to go on the account.`,
          requiredActions: ['visit_tavern', 'recruit_crew'],
          estimatedTicks: 36,
          risk: 'medium',
        });
      }
      break;
    }

    case 'merchant_captain': {
      const cargoNote = computed.holdFreeUnits > 0
        ? ` You have room for ${computed.holdFreeUnits} more tons.`
        : ' Your hold is full — sell before you buy.';
      paths.push({
        name: 'Trade Run',
        description: `Load cargo at a good price, sail to where demand is high, sell for profit.${cargoNote}`,
        requiredActions: ['buy_cargo', 'sail_to', 'sell_cargo'],
        estimatedTicks: 48,
        risk: 'medium',
      });
      paths.push({
        name: 'Convoy Travel',
        description: 'Hire escorts or join a convoy through dangerous waters. Slower, but you arrive alive.',
        requiredActions: ['hire_escort', 'sail_to', 'trade_cargo'],
        estimatedTicks: 60,
        risk: 'low',
      });
      break;
    }

    case 'naval_officer': {
      paths.push({
        name: 'Patrol & Deter',
        description: 'Patrol your assigned region, build cases through surveillance, make arrests when the evidence is strong enough.',
        requiredActions: ['patrol_region', 'build_case', 'arrest'],
        estimatedTicks: 72,
        risk: 'medium',
      });
      if (computed.totalBounty > 0 || snapshot.nearbyAgents.some(a => a.type === 'pirate_captain')) {
        paths.push({
          name: 'Hunt a Specific Target',
          description: 'Pick a pirate with a bounty, track them, engage, and bring them in for justice.',
          requiredActions: ['pursue_target', 'engage_ship', 'board_ship', 'arrest'],
          estimatedTicks: 48,
          risk: 'high',
        });
      }
      break;
    }

    case 'fence': {
      paths.push({
        name: 'Expand Network',
        description: 'Build contacts with new captains. The more pirates trust you, the better the goods that flow through your hands.',
        requiredActions: ['establish_contact', 'buy_stolen_goods', 'sell_goods'],
        estimatedTicks: 96,
        risk: 'medium',
      });
      paths.push({
        name: 'Bribe & Control',
        description: 'Grease the right palms. A corrupt inspector looks the other way; a corrupt governor makes you untouchable.',
        requiredActions: ['bribe_official', 'set_prices'],
        estimatedTicks: 72,
        risk: 'medium',
      });
      break;
    }

    case 'tavern_keeper': {
      paths.push({
        name: 'Work the Room',
        description: 'Serve drinks, listen to talk, broker deals. Your tavern is the crossroads — use it.',
        requiredActions: ['serve_drinks', 'gather_intel', 'broker_deal'],
        estimatedTicks: 24,
        risk: 'low',
      });
      paths.push({
        name: 'Pick a Side',
        description: 'Shelter a fugitive and earn pirate loyalty, or report to the authorities and earn official favour. You cannot do both.',
        requiredActions: ['shelter_fugitive', 'report_to_authorities'],
        estimatedTicks: 12,
        risk: 'medium',
      });
      break;
    }

    case 'port_governor': {
      paths.push({
        name: 'Strengthen Defenses',
        description: 'Increase patrols, fortify the port, post bounties. Make piracy too costly to attempt here.',
        requiredActions: ['increase_patrols', 'fortify_port', 'post_bounty'],
        estimatedTicks: 72,
        risk: 'low',
      });
      paths.push({
        name: 'Personal Enrichment',
        description: 'Accept bribes, lower tariffs for favoured merchants, look the other way when it profits you.',
        requiredActions: ['accept_bribe', 'lower_tariffs'],
        estimatedTicks: 48,
        risk: 'medium',
      });
      break;
    }

    default: {
      paths.push({
        name: 'Gather Information',
        description: 'Listen, observe, learn what is happening around you. Knowledge is safety.',
        requiredActions: ['gather_intel', 'do_nothing'],
        estimatedTicks: 24,
        risk: 'low',
      });
      paths.push({
        name: 'Build Connections',
        description: 'Meet people, earn trust, find opportunities. No one survives alone in these waters.',
        requiredActions: ['negotiate', 'visit_tavern'],
        estimatedTicks: 48,
        risk: 'low',
      });
    }
  }

  return paths.slice(0, 3);
}

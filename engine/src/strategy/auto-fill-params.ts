/**
 * Auto-fill action parameters from game state.
 * The LLM picks WHAT to do. This code figures out HOW.
 *
 * Ported from RAVE LIFE's autoFillParams pattern.
 * Deterministic, correct every time, costs zero tokens.
 */

import type { AgentState, WorldState } from '../runtime/types.js';
import { getSeaZone } from '../world/regions.js';
import { SEA_ZONE_DEFINITIONS } from '../config/regions.js';
import { PORT_PROFILES } from '../config/ports.js';
import { getRoute } from '../config/sea-routes.js';
import { getTradeOptions } from '../engine/trade.js';
import { CARGO_TYPES } from '../config/cargo.js';

export interface FilledAction {
  action: string;
  params: Record<string, unknown>;
}

/**
 * Fill action parameters from game state.
 * Returns the action with resolved params, or null if the action can't be auto-filled
 * (which means it should just execute with empty params).
 */
export async function autoFillParams(
  action: string,
  agent: AgentState,
  worldState: WorldState,
): Promise<FilledAction> {
  switch (action) {
    // ── Navigation ──
    case 'sail_to': {
      const destination = pickDestination(agent);
      return { action, params: { destination } };
    }

    // ── Combat ──
    case 'attack_ship':
    case 'board_ship':
    case 'engage_ship':
      return { action, params: {} };

    case 'flee':
    case 'surrender':
      return { action, params: {} };

    // ── Trade & Economy ──
    case 'trade_cargo':
      return { action, params: { port: agent.portId } };

    case 'buy_cargo': {
      const buyParams = await pickSmartCargo(agent);
      return { action, params: buyParams };
    }

    case 'sell_cargo':
      return { action, params: { port: agent.portId } };

    case 'sell_plunder':
      return { action, params: { port: agent.portId } };

    case 'buy_provisions': {
      return { action, params: { port: agent.portId } };
    }

    // ── Ship Acquisition ──
    case 'buy_vessel':
      return { action, params: { port: agent.portId } };

    case 'claim_prize':
      return { action, params: { port: agent.portId } };

    // ── Ship Maintenance ──
    case 'repair_ship':
      return { action, params: { port: agent.portId } };

    case 'careen_ship':
      return { action, params: { port: agent.portId } };

    // ── Crew ──
    case 'recruit_crew':
      return { action, params: { port: agent.portId } };

    case 'distribute_shares':
    case 'settle_dispute':
    case 'advise_captain':
    case 'call_vote':
    case 'manage_provisions':
    case 'discipline_crew':
      return { action, params: {} };

    // ── Crew member actions ──
    case 'work':
    case 'grumble':
    case 'support_captain':
    case 'challenge_captain':
    case 'desert':
    case 'steal':
    case 'fight':
    case 'gamble':
    case 'drink':
      return { action, params: {} };

    // ── Social / Intel ──
    case 'visit_tavern':
      return { action, params: { port: agent.portId } };

    case 'gather_intel':
    case 'sell_intel':
    case 'eavesdrop':
    case 'plant_rumor':
    case 'betray_source':
      return { action, params: { port: agent.portId } };

    case 'negotiate':
    case 'bribe':
      return { action, params: {} };

    // ── Naval ──
    case 'patrol_region':
      return { action, params: { zone: agent.seaZoneId } };

    case 'pursue_target':
    case 'escort_convoy':
      return { action, params: {} };

    case 'arrest':
    case 'build_case':
    case 'report_to_admiralty':
      return { action, params: {} };

    // ── Governor ──
    case 'issue_letter_of_marque':
      return { action, params: { nation: 'english', targets: ['spanish', 'french'] } };

    case 'increase_patrols':
    case 'fortify_port':
      return { action, params: { port: agent.portId } };

    case 'lower_tariffs':
    case 'raise_tariffs':
      return { action, params: { port: agent.portId } };

    case 'post_bounty':
      return { action, params: { port: agent.portId } };

    case 'accept_bribe':
    case 'host_trial':
    case 'grant_pardon':
      return { action, params: {} };

    // ── Fence ──
    case 'buy_stolen_goods':
    case 'sell_goods':
    case 'establish_contact':
    case 'set_prices':
    case 'refuse_deal':
      return { action, params: { port: agent.portId } };

    case 'bribe_official':
      return { action, params: { port: agent.portId } };

    // ── Tavern Keeper ──
    case 'serve_drinks':
    case 'broker_deal':
    case 'spread_rumor':
    case 'recruit_for':
    case 'shelter_fugitive':
    case 'report_to_authorities':
      return { action, params: { port: agent.portId } };

    // ── Ship Services ──
    case 'inspect_ship':
    case 'collect_fees':
    case 'deny_entry':
    case 'issue_clearance':
    case 'report_suspicious':
    case 'upgrade_ship':
    case 'assess_damage':
    case 'build_vessel':
      return { action, params: { port: agent.portId } };

    // ── Medical ──
    case 'treat_wound':
    case 'treat_disease':
    case 'amputate':
    case 'prescribe_remedy':
    case 'join_crew':
      return { action, params: {} };

    // ── Commerce ──
    case 'hire_shipping':
    case 'sell_crop':
    case 'hire_guards':
    case 'hire_escort':
    case 'invest':
      return { action, params: { port: agent.portId } };

    // ── Haven ──
    case 'invest_haven': {
      // Always pick hideout (cheapest at 150g) — the action validates funds
      return { action, params: { port: agent.portId, haven_type: 'hideout' } };
    }

    case 'accept_pardon':
      return { action, params: {} };

    // ── Bounty Hunting ──
    case 'track_target':
    case 'claim_bounty':
      return { action, params: {} };

    // ── Idle ──
    case 'lay_low':
    case 'do_nothing':
      return { action, params: {} };

    default:
      return { action, params: {} };
  }
}

/**
 * Pick a sensible destination for sail_to based on agent type and location.
 */
function pickDestination(agent: AgentState): string {
  const zone = getSeaZone(agent.seaZoneId);
  if (!zone) return 'nassau';

  // Get ports accessible from current zone (primary source when at sea)
  const accessiblePorts = zone.accessiblePorts ?? [];

  // If at sea with no portId, use accessible ports directly instead of route lookups
  // (getRoute requires a valid portId origin, which is empty at sea)
  if (!agent.portId && accessiblePorts.length > 0) {
    const candidates = accessiblePorts.filter(p => p !== agent.portId);
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)]!;
    }
  }

  // Get adjacent zones' ports
  const adjacentPorts: string[] = [];
  for (const adjZoneId of zone.adjacentZones ?? []) {
    const adjZone = SEA_ZONE_DEFINITIONS[adjZoneId];
    if (adjZone?.accessiblePorts) {
      adjacentPorts.push(...adjZone.accessiblePorts);
    }
  }

  // If still nothing, look two hops out
  if (accessiblePorts.length + adjacentPorts.length <= 1) {
    for (const adjZoneId of zone.adjacentZones ?? []) {
      const adjZone = SEA_ZONE_DEFINITIONS[adjZoneId];
      for (const adj2Id of adjZone?.adjacentZones ?? []) {
        const adj2Zone = SEA_ZONE_DEFINITIONS[adj2Id];
        if (adj2Zone?.accessiblePorts) {
          adjacentPorts.push(...adj2Zone.accessiblePorts);
        }
      }
    }
  }

  // All reachable ports (exclude current, must have valid sea route)
  const allPorts = [...new Set([...accessiblePorts, ...adjacentPorts])]
    .filter(p => p !== agent.portId && getRoute(agent.portId, p) !== null);

  if (allPorts.length === 0) {
    // Last resort: pick any port with a valid route
    const anyPort = Object.keys(PORT_PROFILES).filter(p => p !== agent.portId && getRoute(agent.portId, p) !== null);
    if (anyPort.length > 0) return anyPort[Math.floor(Math.random() * anyPort.length)]!;
    // Truly no route from this port — shouldn't happen
    return 'port_royal';
  }

  // Type-based preferences
  const portProfiles = Object.values(PORT_PROFILES);

  switch (agent.type) {
    case 'pirate_captain':
    case 'privateer_captain': {
      // Pirates prefer DISTANT ports — more time at sea = more encounters.
      // Sort by route distance descending and pick from the top half.
      const withDistance = allPorts.map(p => {
        const route = agent.portId ? getRoute(agent.portId, p) : null;
        return { port: p, distance: route?.distanceNm ?? 0 };
      }).filter(d => d.distance > 0);
      withDistance.sort((a, b) => b.distance - a.distance);
      // Pick from the farther half (minimum 2+ zone transitions worth of travel)
      const farPorts = withDistance.length > 2
        ? withDistance.slice(0, Math.ceil(withDistance.length / 2))
        : withDistance;
      if (farPorts.length > 0) return farPorts[Math.floor(Math.random() * farPorts.length)]!.port;
      break;
    }
    case 'merchant_captain': {
      // Prefer high-prosperity ports where cargo sells well
      const prosperous = allPorts.filter(p => {
        const profile = portProfiles.find(pp => pp.id === p);
        return profile && profile.prosperity >= 50;
      });
      if (prosperous.length > 0) return prosperous[Math.floor(Math.random() * prosperous.length)]!;
      break;
    }
    case 'naval_officer':
    case 'pirate_hunter': {
      // Prefer pirate-friendly zones (where pirates congregate)
      const hotspotPorts = allPorts.filter(p => {
        const profile = portProfiles.find(pp => pp.id === p);
        return profile?.pirateFriendly;
      });
      if (hotspotPorts.length > 0) return hotspotPorts[Math.floor(Math.random() * hotspotPorts.length)]!;
      // Fallback: non-pirate-friendly ports (patrol shipping lanes)
      const patrolPorts = allPorts.filter(p => {
        const profile = portProfiles.find(pp => pp.id === p);
        return profile && !profile.pirateFriendly;
      });
      if (patrolPorts.length > 0) return patrolPorts[Math.floor(Math.random() * patrolPorts.length)]!;
      break;
    }
  }

  // Default: random reachable port
  return allPorts[Math.floor(Math.random() * allPorts.length)]!;
}

/**
 * Pick the best cargo to buy at current port.
 * Prefers high-margin goods: luxury > commodity.
 * Uses basePrice as a proxy for value (higher base = higher margin potential).
 */
async function pickSmartCargo(agent: AgentState): Promise<Record<string, unknown>> {
  const portId = agent.portId;
  if (!portId) return { port: portId };

  // Get agent's actual cash from DB to filter affordable options
  const { AgentQueries } = await import('../db/queries.js');
  const dbAgent = await AgentQueries.getById(agent.id);
  const cash = dbAgent?.cash ?? 100;

  const options = getTradeOptions(portId);
  const available = options.filter(o => o.available && o.buyPrice > 0 && o.supply >= 1 && o.buyPrice <= cash);
  if (available.length === 0) return { port: portId };

  // Score each cargo by margin potential and category preference
  // Merchants should prefer high-value goods, not cheapest
  const scored = available.map(o => {
    const config = CARGO_TYPES[o.cargoType];
    // Category bonus: luxury goods are preferred for margin
    let categoryBonus = 0;
    if (config?.category === 'luxury') categoryBonus = 50;
    else if (config?.category === 'military') categoryBonus = 10;
    else if (config?.category === 'contraband') categoryBonus = -20;
    else if (config?.category === 'provision') categoryBonus = -10;

    // Score = sellPrice relative to buyPrice (margin ratio) + category bonus + base value bonus
    const marginRatio = o.sellPrice / Math.max(o.buyPrice, 1);
    const score = marginRatio * 100 + categoryBonus + (config?.basePrice ?? 0) * 0.1;
    return { ...o, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!;

  return {
    port: portId,
    cargo_type: best.cargoType,
  };
}

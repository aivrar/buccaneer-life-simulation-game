/**
 * Consequence Previewer — computes a one-line narrative preview for each
 * available action, based on current game state.
 *
 * The LLM never does math. We do the math and tell it the story.
 * "3 merchants nearby, you outgun them" not "guns: 12, target_guns: 8"
 */

import type { AgentState, WorldState } from '../runtime/types.js';
import type { AgentDataSnapshot } from './narrative-data.js';
import type { ComputedValues } from './narrative-compute.js';

/**
 * Returns a Map of action → preview string.
 * A preview of `null` means "this action is impossible — hide it from the prompt entirely."
 * An empty string means "show the action but with no description."
 */
export function buildConsequencePreviews(
  agent: AgentState,
  validActions: string[],
  snapshot: AgentDataSnapshot,
  computed: ComputedValues,
  _worldState: WorldState,
): Map<string, string | null> {
  const previews = new Map<string, string | null>();

  for (const action of validActions) {
    const preview = getPreview(action, agent, snapshot, computed);
    previews.set(action, preview);
  }

  return previews;
}

function getPreview(
  action: string,
  agent: AgentState,
  snapshot: AgentDataSnapshot,
  computed: ComputedValues,
): string | null {
  const ship = snapshot.ship;
  const cash = snapshot.agentDb?.cash ?? 0;

  // Survival urgency: hide combat and passive actions when ship is near sinking or starving
  // hull < 10 (not 20) — damaged ships can still fight, only truly crippled ones retreat
  const criticalHull = ship && ship.hull < 10;
  const starving = computed.daysOfFood < 1 && ship;
  const survivalCrisis = criticalHull || starving;

  switch (action) {
    // ── Combat ──────────────────────────────────────

    case 'attack_ship': {
      if (survivalCrisis) return null; // don't fight when dying
      const nearbyCount = snapshot.nearbyShips?.length ?? 0;
      if (nearbyCount === 0) return 'ships may cross your path at sea';
      const myGuns = ship?.guns ?? 0;
      const strongest = snapshot.nearbyShips?.reduce((max, s) => s.guns > max ? s.guns : max, 0) ?? 0;
      if (myGuns > strongest * 1.5) return `${nearbyCount} vessel${nearbyCount > 1 ? 's' : ''} in range — you outgun them`;
      if (myGuns > strongest) return `${nearbyCount} vessel${nearbyCount > 1 ? 's' : ''} in range — fair fight`;
      return `${nearbyCount} vessel${nearbyCount > 1 ? 's' : ''} nearby but they\'re well armed — risky`;
    }

    case 'board_ship': {
      if (survivalCrisis) return null; // don't board when dying
      return ship && ship.crew_count > 20
        ? 'send your crew over the rails — boarding strength looks good'
        : 'risky with a thin crew';
    }

    case 'engage_ship':
      if (survivalCrisis) return null;
      return 'bring guns to bear on a target';

    case 'flee':
      if (agent.status === 'at_sea') {
        return ship && ship.speed_base >= 7 ? 'your ship is fast — good chance of escape' : 'run for it, but you\'re not the fastest';
      }
      return 'slip away before trouble finds you';

    case 'surrender':
      return 'give up the fight — keep your life, lose your freedom';

    // ── Trade ───────────────────────────────────────

    case 'sell_plunder': {
      if (computed.hotCargoCount === 0) return null; // no stolen goods — hide entirely
      const fenceCut = snapshot.fences?.[0]?.tier === 2 ? '25%' : snapshot.fences?.[0]?.tier === 3 ? '20%' : '30%';
      return `fence takes ${fenceCut} cut — but it clears the evidence before the navy finds it`;
    }

    case 'buy_cargo': {
      const available = snapshot.marketPrices?.filter(m => m.supply > 10) ?? [];
      if (available.length === 0) return 'slim pickings at this port';
      const best = available.sort((a, b) => b.sell_price - a.sell_price)[0];
      return best ? `${best.cargo_type} available — could turn a profit elsewhere` : 'goods available for trade';
    }

    case 'sell_cargo': {
      const ownedCargo = snapshot.cargo?.filter(c => c.quantity > 0 && c.heat <= 10) ?? [];
      if (ownedCargo.length === 0) return null; // nothing to sell — hide
      return `unload your goods at market prices`;
    }

    case 'trade_cargo': {
      if (cash < 10) return null; // can't afford to buy anything
      const market = snapshot.marketPrices?.filter(m => m.port_id === snapshot.agent.portId && m.supply > 5) ?? [];
      if (market.length === 0) return null; // no goods to trade at this port
      return 'buy low here, sell high somewhere else — the merchant\'s bread and butter';
    }

    // ── Navigation ──────────────────────────────────

    case 'sail_to': {
      if (!ship) return 'you\'ll need a ship first';
      if (ship.hull < 30) return 'your ship might not survive the voyage — consider repairs first';
      if (computed.daysOfFood < 1) return 'you\'ll starve at sea without provisions';
      if (agent.status === 'at_sea') return 'change course to a new destination';
      const hotCargo = computed.hotCargoCount > 0;
      if (hotCargo) return 'get moving — find a fence before the navy finds you';
      return 'set course for another port — opportunities await';
    }

    // ── Ship Management ─────────────────────────────

    case 'repair_ship': {
      if (!ship) return null;
      if (ship.hull >= 95) return null; // nothing to repair
      // Repair cost scales with damage and ship class — rough: (100-hull) * 5
      const estRepairCost = Math.max(50, (100 - ship.hull) * 5);
      if (cash < estRepairCost) return null; // can't afford — hide from prompt
      const repairTarget = Math.min(100, ship.hull + 25);
      return `patch her up to about ${repairTarget}% — costs gold but keeps you afloat`;
    }

    case 'buy_provisions': {
      if (!ship) return null;
      if (computed.daysOfFood > 7) return null; // already stocked
      // Provision cost scales with crew size — rough estimate: 3g per crew member
      const estCost = Math.max(20, (ship.crew_count ?? 10) * 3);
      if (cash < estCost) return null; // can't afford — hide from prompt
      return 'restock food and water — your crew needs to eat';
    }

    case 'recruit_crew': {
      if (!ship) return null;
      const shortfall = computed.crewShortfall;
      if (shortfall <= 0) return null; // full crew
      if (cash < 5) return null; // can't afford
      return `short ${shortfall} hands — ${shortfall > ship.crew_capacity * 0.5 ? 'badly undermanned' : 'could use more men'}`;
    }

    case 'careen_ship': {
      if (!ship) return null;
      if (ship.barnacle_level < 20) return null; // clean hull — hide
      return `scrape the barnacles — she\'ll sail ${Math.round(ship.barnacle_level / 4)}% faster after`;
    }

    case 'buy_vessel': {
      if (cash >= 500) return 'enough gold for a fine brigantine';
      if (cash >= 300) return 'can afford a schooner or merchantman';
      if (cash >= 200) return 'enough for a sloop — a proper fighting ship';
      if (cash >= 80) return 'can afford a shallop — small but seaworthy';
      if (cash >= 50) return 'only enough for a periagua — barely a boat';
      return null; // can't afford anything — hide
    }

    // ── Haven & Investment ──────────────────────────

    case 'claim_prize':
      // Prize ships only exist after combat captures — almost never valid early game
      return null;

    case 'invest_haven': {
      if (cash < 150) return `need 150 gold for a hideout — you have ${Math.round(cash)}`;
      return 'buy a hideout — a safe place to stash goods and hide from the law';
    }

    // ── Legal ───────────────────────────────────────

    case 'accept_pardon':
      return 'wipe the slate clean with the Crown — but your pirate brothers won\'t forget';

    case 'report_piracy':
      return 'tell the authorities what you\'ve seen — they might reward you';

    case 'hire_escort':
      return 'pay for naval protection on your next voyage';

    // ── Naval/Law ───────────────────────────────────

    case 'patrol_region': {
      if (survivalCrisis) return null; // get to port first
      if (!ship) return 'administrative duties at port — modest pay';
      return 'sweep the sea lanes for pirates — Crown pays for your service';
    }

    case 'report_to_admiralty':
      return 'file your report and collect your stipend';

    case 'build_case':
      return 'gather evidence against a suspect — building toward an arrest';

    case 'arrest': {
      const suspects = snapshot.navyCases?.filter(c => c.status === 'warrant_issued') ?? [];
      if (suspects.length === 0) return null; // no warrants — hide
      return `${suspects.length} warrant${suspects.length > 1 ? 's' : ''} to serve — bring them to justice`;
    }

    case 'pursue_target':
      if (survivalCrisis) return null;
      return 'chase down a suspect at sea';

    case 'escort_convoy':
      return 'guard merchant ships on their route';

    case 'negotiate_pardon':
      return 'broker a pardon for a prisoner — political capital';

    // ── Governor ────────────────────────────────────

    case 'fortify_port':
      return 'strengthen defences against raids';

    case 'post_bounty':
      return 'put a price on a pirate\'s head';

    case 'host_trial':
      return 'bring a prisoner before the court';

    case 'grant_pardon':
      return 'offer clemency — useful for turning pirates into allies';

    case 'issue_letter_of_marque':
      return 'license a privateer to raid enemy shipping';

    case 'raise_tariffs':
      return 'increase port revenue from trade';

    case 'lower_tariffs':
      return 'attract more merchants to port';

    case 'increase_patrols':
      return 'more navy presence in local waters';

    case 'accept_bribe':
      return 'pocket a few coins — but every bribe makes the port more lawless and your reputation worse';

    // ── Social ──────────────────────────────────────

    case 'visit_tavern':
      return 'hear the latest gossip and make contacts';

    case 'negotiate':
      return 'talk your way to a better deal';

    case 'gather_intel':
      return 'listen for useful information around port';

    case 'sell_intel':
      return 'sell what you know to someone who\'ll pay';

    case 'eavesdrop':
      return 'listen in on conversations — knowledge is currency';

    case 'betray_source':
      return 'sell out a contact for quick coin — burns bridges';

    case 'plant_rumor':
      return 'spread misinformation to confuse your enemies';

    case 'bribe':
      return 'grease a palm to smooth your way';

    case 'spread_rumor':
      return 'pass along what you\'ve heard — true or not';

    // ── Crew Actions ────────────────────────────────

    case 'work':
      return 'honest labor on the ship';

    case 'drink':
      return 'drown your sorrows or celebrate — either way, rum';

    case 'gamble':
      return 'test your luck against the crew';

    case 'fight':
      return 'settle things with your fists';

    case 'grumble':
      return 'voice your complaints to anyone who\'ll listen';

    case 'steal':
      return 'help yourself to what isn\'t yours';

    case 'support_captain':
      return 'stand with the captain — loyalty noted';

    case 'challenge_captain':
      return 'speak up against the captain — risky but respected';

    // ── QM Actions ──────────────────────────────────

    case 'distribute_shares':
      return 'divide the plunder fairly — keeps the crew happy';

    case 'manage_provisions':
      return 'ration the stores wisely';

    case 'call_vote':
      return 'put a matter to the crew — democracy, pirate style';

    case 'advise_captain':
      return 'offer counsel to the captain';

    case 'settle_dispute':
      return 'mediate between quarrelling crew';

    case 'discipline_crew':
      return 'enforce the articles — someone needs to';

    // ── Fence Actions ───────────────────────────────

    case 'set_prices':
      return 'adjust what you\'ll pay for stolen goods';

    case 'establish_contact':
      return 'make a new connection in the underworld';

    case 'bribe_official':
      return 'pay off the harbour master — keeps inspections away';

    case 'buy_stolen_goods':
      return 'purchase hot cargo at a discount';

    case 'sell_goods': {
      // Fence sells goods they've bought — check if they have inventory
      const fenceGoods = snapshot.cargo?.filter(c => c.quantity > 0 && c.heat <= 10) ?? [];
      if (fenceGoods.length === 0) return null; // nothing to sell
      return 'move laundered goods to legitimate buyers';
    }

    case 'refuse_deal':
      return 'turn down a bad offer — protect your margins';

    // ── Tavern Keeper ───────────────────────────────

    case 'serve_drinks':
      return 'keep the rum flowing — loose lips follow';

    case 'shelter_fugitive':
      return 'hide someone from the law — they\'ll owe you';

    case 'broker_deal':
      return 'connect a buyer and seller for a cut';

    case 'recruit_for':
      return 'help a captain find crew';

    case 'report_to_authorities':
      return 'tip off the navy — reward money, but enemies made';

    // ── Passive ─────────────────────────────────────

    case 'lay_low':
      if (survivalCrisis) return null; // no time to hide when dying
      return 'waste time hiding — nothing gained, provisions draining';

    case 'do_nothing':
      return 'stand idle while the world moves on';

    // ── Missing action previews ─────────────────────────
    // These 22 actions had no case and fell through to default.
    // Each needs at least a brief description so the prompt isn't bare-label.

    case 'treat_wound': return 'tend to an injured man';
    case 'treat_disease': return 'care for the sick';
    case 'amputate': return 'cut to save a life — brutal but effective';
    case 'prescribe_remedy': return 'prepare medicines from what you have';
    case 'assess_damage': return 'survey the ship for needed repairs';
    case 'upgrade_ship': return 'improve the vessel\'s capabilities';
    case 'build_vessel': return cash >= 200 ? 'commission a new ship' : null;
    case 'inspect_ship': return 'check a vessel\'s papers and cargo';
    case 'collect_fees': return 'collect docking and anchorage fees';
    case 'deny_entry': return 'turn away a suspicious ship';
    case 'issue_clearance': return 'grant a ship permission to sail';
    case 'report_suspicious': return 'flag a vessel for investigation';
    case 'track_target': return 'follow a bounty target\'s trail';
    case 'claim_bounty': return 'collect the reward on a captured target';
    case 'report_to_governor': return 'deliver your report to the governor';
    case 'sell_crop': return 'sell your harvest at market';
    case 'hire_guards': return 'hire men to protect your property';
    case 'hire_shipping': return 'arrange transport for your goods';
    case 'invest': return cash >= 100 ? 'put gold to work' : null;
    case 'bribe_governor': return cash >= 50 ? 'buy the governor\'s favor' : null;
    case 'desert': return 'abandon ship and strike out alone';
    case 'join_crew': return 'sign articles on a ship';

    default:
      return ''; // show action with no description rather than hiding it
  }
}

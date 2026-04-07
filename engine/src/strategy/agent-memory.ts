/**
 * Agent Memory — rolling buffer of action→outcome→reasoning per agent.
 *
 * Each entry is a narrative sentence that captures what the agent did,
 * what happened, and what they thought about it. The reasoning comes
 * from the LLM's own output, creating a continuous chain of thought.
 *
 * Memory lives in-memory on the SimAgent object. On checkpoint save,
 * it serializes with the agent. On resume, it rebuilds from checkpoint.
 */

export const MAX_MEMORIES = 5;

export interface AgentMemoryEntry {
  tick: number;
  action: string;
  narrative: string;  // "Attacked the merchant Hope — seized sugar, took hull damage. Worth the risk."
}

/**
 * Build a narrative memory from an action result.
 * All the math/logic is done here — the memory string is pure prose.
 */
export function buildMemoryNarrative(
  action: string,
  result: string,
  reasoning: string,
  success: boolean,
): string {
  // Start with what happened (from action result)
  let narrative = '';

  // Humanize the action verb
  const verb = humanizeAction(action, success);

  // Combine verb + outcome
  if (result && result.length > 0 && result.length < 120) {
    narrative = `${verb} — ${result.toLowerCase()}`;
  } else if (result && result.length >= 120) {
    // Truncate long results
    narrative = `${verb} — ${result.substring(0, 100).toLowerCase()}...`;
  } else {
    narrative = verb;
  }

  // Append agent's own reasoning if available (creates continuity)
  if (reasoning && reasoning.length > 3 && reasoning.length < 80) {
    // Clean up common LLM artifacts
    const clean = reasoning.replace(/^(i |I )(choose|pick|select|go with)\s+\d+[\s.,:]+/i, '').trim();
    if (clean.length > 3) {
      narrative += `. ${clean.charAt(0).toUpperCase()}${clean.slice(1)}`;
    }
  }

  // Ensure it ends with a period
  if (!narrative.endsWith('.') && !narrative.endsWith('!') && !narrative.endsWith('?')) {
    narrative += '.';
  }

  return narrative;
}

function humanizeAction(action: string, success: boolean): string {
  if (!success) {
    const failVerbs: Record<string, string> = {
      attack_ship: 'Tried to attack a ship but failed',
      sell_plunder: 'Tried to fence stolen goods but found no buyer',
      buy_cargo: 'Tried to buy cargo but couldn\'t',
      sell_cargo: 'Tried to sell cargo but no takers',
      buy_vessel: 'Tried to buy a ship but couldn\'t afford one',
      recruit_crew: 'Tried to recruit but no one signed on',
      repair_ship: 'Tried to repair but couldn\'t',
      invest_haven: 'Tried to invest in a safe house but lacked funds',
      arrest: 'Attempted an arrest but it fell through',
      sell_intel: 'Tried to sell information but no buyers',
    };
    return failVerbs[action] ?? `Tried to ${action.replace(/_/g, ' ')} but failed`;
  }

  const verbs: Record<string, string> = {
    sail_to: 'Set sail',
    attack_ship: 'Attacked a ship',
    board_ship: 'Boarded an enemy vessel',
    sell_plunder: 'Sold stolen goods through a fence',
    buy_cargo: 'Bought cargo',
    sell_cargo: 'Sold cargo',
    trade_cargo: 'Traded goods',
    recruit_crew: 'Recruited new crew',
    repair_ship: 'Had the ship repaired',
    buy_provisions: 'Stocked up on provisions',
    invest_haven: 'Invested in a safe house',
    buy_vessel: 'Bought a new ship',
    flee: 'Fled the area',
    lay_low: 'Laid low and kept quiet',
    do_nothing: 'Waited and watched',
    patrol_region: 'Patrolled the sea lanes',
    report_to_admiralty: 'Reported to the Admiralty',
    build_case: 'Gathered evidence for a case',
    arrest: 'Made an arrest',
    negotiate: 'Negotiated with someone',
    accept_pardon: 'Accepted a royal pardon',
    gather_intel: 'Gathered intelligence',
    sell_intel: 'Sold information',
    visit_tavern: 'Visited the tavern',
    drink: 'Had a drink',
    gamble: 'Gambled',
    fight: 'Got in a fight',
    work: 'Worked on the ship',
    grumble: 'Grumbled about conditions',
    serve_drinks: 'Served drinks at the tavern',
    spread_rumor: 'Spread a rumor',
    bribe_official: 'Bribed an official',
    set_prices: 'Set prices for goods',
    establish_contact: 'Made a new underworld contact',
    fortify_port: 'Ordered port fortifications',
    post_bounty: 'Posted a bounty',
    host_trial: 'Presided over a trial',
    grant_pardon: 'Granted a pardon',
    issue_letter_of_marque: 'Issued a letter of marque',
    careen_ship: 'Careened the ship',
    engage_ship: 'Engaged an enemy ship',
    hire_escort: 'Hired a naval escort',
    surrender: 'Surrendered',
    report_piracy: 'Reported piracy to authorities',
    manage_provisions: 'Managed the ship\'s provisions',
    distribute_shares: 'Distributed shares to the crew',
    call_vote: 'Called a crew vote',
    advise_captain: 'Advised the captain',
    settle_dispute: 'Settled a dispute',
    negotiate_pardon: 'Negotiated a pardon',
    pursue_target: 'Pursued a target',
    shelter_fugitive: 'Sheltered a fugitive',
    broker_deal: 'Brokered a deal',
    eavesdrop: 'Eavesdropped on conversations',
    betray_source: 'Betrayed a source',
    plant_rumor: 'Planted a rumor',
    bribe: 'Paid a bribe',
  };

  return verbs[action] ?? action.replace(/_/g, ' ');
}

/**
 * Push a new memory, evicting the oldest if over MAX_MEMORIES.
 */
export function pushMemory(memories: AgentMemoryEntry[], entry: AgentMemoryEntry): AgentMemoryEntry[] {
  // Skip duplicates — if last memory has the same action, don't waste a slot
  if (memories.length > 0 && memories[memories.length - 1]!.action === entry.action) {
    return memories;
  }
  const updated = [...memories, entry];
  if (updated.length > MAX_MEMORIES) {
    return updated.slice(updated.length - MAX_MEMORIES);
  }
  return updated;
}

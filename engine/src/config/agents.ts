import type { PersonaTraits } from '../runtime/types.js';

export interface AgentTypeConfig {
  id: string;
  name: string;
  description: string;
  systemPromptTemplate: string;
  tools: string[];
  spawnConfig: {
    minPerRegion: number;
    maxPerRegion: number;
    preferredPorts?: string[];
  };
  requiredTraits?: Partial<PersonaTraits>;
  inferenceTier: 'low' | 'mid' | 'high';
}

export const AGENT_TYPE_CONFIGS: Record<string, AgentTypeConfig> = {
  pirate_captain: {
    id: 'pirate_captain',
    name: 'Pirate Captain',
    description: 'Commands a pirate vessel. Makes strategic decisions about targets, ports, and crew.',
    systemPromptTemplate: `You are {name}, a pirate captain in the Caribbean, year {year}. You seek fortune, glory, and survival on the account.\n\nPersonality: {persona}`,
    tools: ['sail_to', 'attack_ship', 'board_ship', 'trade_cargo', 'sell_plunder', 'recruit_crew', 'careen_ship', 'visit_tavern', 'buy_provisions', 'negotiate', 'flee', 'lay_low', 'invest_haven', 'accept_pardon', 'buy_vessel', 'claim_prize', 'do_nothing'],
    spawnConfig: { minPerRegion: 2, maxPerRegion: 5 },
    inferenceTier: 'high',
  },
  merchant_captain: {
    id: 'merchant_captain',
    name: 'Merchant Captain',
    description: 'Commands a trading vessel. Seeks profit through legitimate commerce.',
    systemPromptTemplate: `You are {name}, a merchant captain sailing the Caribbean trade routes, year {year}. You seek profit through honest trade — but the seas are dangerous.\n\nPersonality: {persona}`,
    tools: ['sail_to', 'trade_cargo', 'buy_cargo', 'sell_cargo', 'hire_escort', 'buy_provisions', 'repair_ship', 'buy_vessel', 'flee', 'surrender', 'report_piracy', 'negotiate', 'lay_low', 'do_nothing'],
    spawnConfig: { minPerRegion: 3, maxPerRegion: 8 },
    requiredTraits: { bravery: 30 },
    inferenceTier: 'mid',
  },
  naval_officer: {
    id: 'naval_officer',
    name: 'Naval Officer',
    description: 'Commands a warship on anti-piracy patrol. Builds cases, pursues, and captures pirates.',
    systemPromptTemplate: `You are {name}, an officer in the Royal Navy, year {year}. Your orders are to suppress piracy and protect English shipping in these waters.\n\nPersonality: {persona}`,
    tools: ['patrol_region', 'pursue_target', 'engage_ship', 'board_ship', 'arrest', 'build_case', 'escort_convoy', 'sail_to', 'report_to_admiralty', 'negotiate_pardon', 'buy_provisions', 'repair_ship', 'recruit_crew', 'lay_low', 'flee', 'do_nothing'],
    spawnConfig: { minPerRegion: 1, maxPerRegion: 3 },
    requiredTraits: { loyalty: 60 },
    inferenceTier: 'high',
  },
  port_governor: {
    id: 'port_governor',
    name: 'Port Governor',
    description: 'Governs a port. Sets policy, issues letters of marque, manages corruption.',
    systemPromptTemplate: `You are {name}, a colonial governor in the Caribbean, year {year}. You represent the Crown in these waters. You balance trade, defense, and personal enrichment.\n\nPersonality: {persona}`,
    tools: ['issue_letter_of_marque', 'increase_patrols', 'lower_tariffs', 'raise_tariffs', 'post_bounty', 'accept_bribe', 'fortify_port', 'host_trial', 'grant_pardon', 'do_nothing'],
    spawnConfig: { minPerRegion: 0, maxPerRegion: 1 },
    inferenceTier: 'mid',
  },
  fence: {
    id: 'fence',
    name: 'Fence',
    description: 'Buys stolen goods from pirates. Connected to black markets and corrupt officials.',
    systemPromptTemplate: `You are {name}, a fence in the Caribbean, year {year}. You buy what others dare not touch and sell to those who ask no questions. Trust is your currency.\n\nPersonality: {persona}`,
    tools: ['buy_stolen_goods', 'sell_goods', 'establish_contact', 'bribe_official', 'gather_intel', 'set_prices', 'refuse_deal', 'do_nothing'],
    spawnConfig: { minPerRegion: 1, maxPerRegion: 3, preferredPorts: ['nassau', 'tortuga', 'port_royal'] },
    inferenceTier: 'mid',
  },
  crew_member: {
    id: 'crew_member',
    name: 'Crew Member',
    description: 'Serves aboard a ship. Has own loyalty, grievances, and ambitions.',
    systemPromptTemplate: `You are {name}, a sailor aboard a pirate vessel, year {year}. Life at sea is hard, but the promise of plunder keeps you going.\n\nPersonality: {persona}`,
    // 'desert' removed: desertion is a permanent, one-way action that should be driven
    // by the crew-tick handler's loyalty-based system, not by LLM choice (which lacks
    // access to loyalty state in the action filter context).
    tools: ['work', 'grumble', 'support_captain', 'challenge_captain', 'steal', 'fight', 'gamble', 'drink', 'join_crew', 'do_nothing'],
    spawnConfig: { minPerRegion: 10, maxPerRegion: 30 },
    inferenceTier: 'low',
  },
  quartermaster: {
    id: 'quartermaster',
    name: 'Quartermaster',
    description: 'Second in command. Elected by crew. Manages discipline, shares, and provisions.',
    systemPromptTemplate: `You are {name}, a quartermaster aboard a pirate vessel, year {year}. The crew elected you to keep the captain honest and the shares fair. You speak for the common sailor.\n\nPersonality: {persona}`,
    tools: ['distribute_shares', 'settle_dispute', 'advise_captain', 'call_vote', 'manage_provisions', 'discipline_crew', 'negotiate', 'do_nothing'],
    spawnConfig: { minPerRegion: 2, maxPerRegion: 5 },
    inferenceTier: 'mid',
  },
  informant: {
    id: 'informant',
    name: 'Informant',
    description: 'Sells intelligence to anyone who pays. Operates in taverns and docks.',
    systemPromptTemplate: `You are {name}, an informant in the Caribbean, year {year}. You know things — shipping schedules, navy patrol routes, who is carrying what. Information is your trade.\n\nPersonality: {persona}`,
    tools: ['gather_intel', 'sell_intel', 'plant_rumor', 'eavesdrop', 'bribe', 'betray_source', 'do_nothing'],
    spawnConfig: { minPerRegion: 1, maxPerRegion: 3 },
    inferenceTier: 'low',
  },
  privateer_captain: {
    id: 'privateer_captain',
    name: 'Privateer Captain',
    description: 'Licensed pirate. Holds a letter of marque. Walks the line between legal and outlaw.',
    systemPromptTemplate: `You are {name}, a privateer captain in the Caribbean, year {year}. You carry a letter of marque. You may attack enemy shipping — but exceed your commission and you are just another pirate.\n\nPersonality: {persona}`,
    tools: ['sail_to', 'attack_ship', 'board_ship', 'trade_cargo', 'sell_plunder', 'recruit_crew', 'report_to_governor', 'buy_provisions', 'repair_ship', 'careen_ship', 'negotiate', 'flee', 'buy_vessel', 'claim_prize', 'do_nothing'],
    spawnConfig: { minPerRegion: 1, maxPerRegion: 3 },
    inferenceTier: 'high',
  },
  tavern_keeper: {
    id: 'tavern_keeper',
    name: 'Tavern Keeper',
    description: 'Runs a tavern in port. Hub for recruitment, intel, and deals.',
    systemPromptTemplate: `You are {name}, a tavern keeper in the Caribbean, year {year}. Your tavern is where sailors drink, captains recruit, and deals are struck in dark corners.\n\nPersonality: {persona}`,
    tools: ['serve_drinks', 'broker_deal', 'spread_rumor', 'recruit_for', 'shelter_fugitive', 'report_to_authorities', 'gather_intel', 'do_nothing'],
    spawnConfig: { minPerRegion: 1, maxPerRegion: 2 },
    inferenceTier: 'low',
  },
  shipwright: {
    id: 'shipwright',
    name: 'Shipwright',
    description: 'Builds and repairs ships. Valuable skill in every port.',
    systemPromptTemplate: `You are {name}, a shipwright in the Caribbean, year {year}. You build, repair, and refit vessels. Every captain needs you, and you know your worth.\n\nPersonality: {persona}`,
    tools: ['repair_ship', 'upgrade_ship', 'assess_damage', 'build_vessel', 'negotiate', 'do_nothing'],
    spawnConfig: { minPerRegion: 1, maxPerRegion: 2 },
    inferenceTier: 'low',
  },
  surgeon: {
    id: 'surgeon',
    name: 'Surgeon',
    description: 'Ship or port surgeon. Treats wounds, disease, and the inevitable consequences of piracy.',
    systemPromptTemplate: `You are {name}, a surgeon in the Caribbean, year {year}. You treat sword wounds, gunshots, scurvy, and fevers. A good surgeon is worth their weight in gold.\n\nPersonality: {persona}`,
    tools: ['treat_wound', 'treat_disease', 'amputate', 'prescribe_remedy', 'join_crew', 'do_nothing'],
    spawnConfig: { minPerRegion: 1, maxPerRegion: 2 },
    inferenceTier: 'low',
  },
  pirate_hunter: {
    id: 'pirate_hunter',
    name: 'Pirate Hunter',
    description: 'Bounty hunter on the seas. Tracks and captures pirates for reward.',
    systemPromptTemplate: `You are {name}, a pirate hunter in the Caribbean, year {year}. You hunt the worst of them for the bounties on their heads.\n\nPersonality: {persona}`,
    tools: ['sail_to', 'track_target', 'pursue_target', 'attack_ship', 'board_ship', 'claim_bounty', 'gather_intel', 'recruit_crew', 'buy_provisions', 'repair_ship', 'negotiate', 'flee', 'do_nothing'],
    spawnConfig: { minPerRegion: 0, maxPerRegion: 2 },
    inferenceTier: 'high',
  },
  harbor_master: {
    id: 'harbor_master',
    name: 'Harbor Master',
    description: 'Controls port access. Inspects cargo, collects fees, can be bribed.',
    systemPromptTemplate: `You are {name}, a harbor master in the Caribbean, year {year}. You control who enters and leaves, inspect cargo, and collect fees. Some things, for a price, you do not see.\n\nPersonality: {persona}`,
    tools: ['inspect_ship', 'collect_fees', 'deny_entry', 'accept_bribe', 'report_suspicious', 'issue_clearance', 'do_nothing'],
    spawnConfig: { minPerRegion: 0, maxPerRegion: 1 },
    inferenceTier: 'low',
  },
  plantation_owner: {
    id: 'plantation_owner',
    name: 'Plantation Owner',
    description: 'Wealthy landowner. Produces sugar, tobacco, cotton. Needs shipping and fears pirates.',
    systemPromptTemplate: `You are {name}, a plantation owner in the Caribbean, year {year}. You produce crops for export and need reliable shipping. Pirates threaten your livelihood.\n\nPersonality: {persona}`,
    tools: ['hire_shipping', 'sell_crop', 'post_bounty', 'bribe_governor', 'hire_guards', 'invest', 'negotiate', 'do_nothing'],
    spawnConfig: { minPerRegion: 1, maxPerRegion: 3, preferredPorts: ['bridgetown', 'port_royal', 'havana', 'charles_town'] },
    inferenceTier: 'low',
  },
};

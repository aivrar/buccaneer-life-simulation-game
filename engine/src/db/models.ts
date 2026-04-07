// TypeScript interfaces for all database entities

export interface Agent {
  id: string;
  type: AgentTypeName;
  name: string;
  port_id: string;
  sea_zone_id: string;
  ship_id: string | null;
  status: 'active' | 'at_sea' | 'in_port' | 'imprisoned' | 'dead' | 'fled';
  nationality: string;
  gender: 'male' | 'female';
  heritage: string;
  nickname: string | null;
  attributes: string;        // JSON: HumanAttributes
  persona: string;           // JSON: PersonaProfile
  cash: number;
  infamy: number;
  last_decision_tick: number;
  cooldown_until_tick: number;
  created_at: Date;
  updated_at: Date;
}

export type AgentTypeName =
  | 'pirate_captain'
  | 'merchant_captain'
  | 'naval_officer'
  | 'port_governor'
  | 'fence'
  | 'crew_member'
  | 'quartermaster'
  | 'informant'
  | 'privateer_captain'
  | 'tavern_keeper'
  | 'shipwright'
  | 'surgeon'
  | 'pirate_hunter'
  | 'harbor_master'
  | 'plantation_owner';

export interface Ship {
  id: string;
  name: string;
  class: ShipClassName;
  captain_id: string | null;
  hull: number;            // 0-100
  sails: number;           // 0-100
  guns: number;
  max_guns: number;
  crew_count: number;
  crew_capacity: number;
  cargo_used: number;
  cargo_capacity: number;
  speed_base: number;
  maneuverability: number;
  port_id: string | null;
  sea_zone_id: string;
  status: 'docked' | 'sailing' | 'combat' | 'careening' | 'sunk' | 'captured';
  current_zone_id: string | null;  // current sea zone when sailing
  barnacle_level: number;  // 0-100, reduces speed
  rot_level: number;       // 0-100, reduces hull
  powder_stores: number;
  food_stores: number;
  water_stores: number;
  destination_port_id: string | null;
  origin_port_id: string | null;
  arrival_tick: number | null;
  departure_tick: number | null;
  created_at: Date;
}

export type ShipClassName =
  | 'periagua'
  | 'shallop'
  | 'droger'
  | 'sloop'
  | 'schooner'
  | 'bark'
  | 'galley'
  | 'packet_boat'
  | 'brigantine'
  | 'brig'
  | 'frigate'
  | 'man_of_war'
  | 'fluyt'
  | 'merchantman'
  | 'galleon'
  | 'guineaman'
  | 'east_indiaman';

export interface Crew {
  id: string;
  agent_id: string;
  ship_id: string;
  role: CrewRole;
  loyalty: number;          // 0-100
  share_agreement: number;  // percentage of plunder
  grievances: string;       // JSON array
  skills: string;           // JSON: skill levels
  joined_tick: number;
  status: 'active' | 'injured' | 'sick' | 'dead' | 'deserted' | 'marooned';
}

export type CrewRole =
  | 'captain'
  | 'quartermaster'
  | 'first_mate'
  | 'boatswain'
  | 'gunner'
  | 'navigator'
  | 'surgeon'
  | 'cook'
  | 'carpenter'
  | 'common_sailor';

export interface Port {
  id: string;
  name: string;
  sea_zone_id: string;
  controller: string;
  port_type: 'major_port' | 'minor_port' | 'trading_post' | 'european_city' | 'pirate_hideout';
  corruption: number;
  prosperity: number;
  population: number;
  fort_strength: number;
  disease_profile: string;  // JSON
  tavern_quality: number;
  shipyard_quality: number;
  market_size: number;
  pirate_friendly: boolean;
  latitude: number;
  longitude: number;
  entrance_width: number | null;
  entrance_depth: number | null;
  max_draft: number | null;
  tidal_range: number | null;
  anchorage_capacity: number | null;
  approach_directions: string;  // JSON array
  defenses: string;
  terrain: string;
  description: string;
}

export interface Place {
  id: string;
  name: string;
  port_id: string;
  type: 'tavern' | 'fort' | 'church' | 'dock' | 'market' | 'shipyard' | 'brothel' | 'warehouse' | 'government' | 'jail' | 'camp' | 'landmark' | 'residential' | 'trading_post' | 'slave_market' | 'hospital';
  capacity: number;
  quality: number;
  safety: number;
  corruption: number;
  visibility: number;
  description: string;
}

export interface SeaZone {
  id: string;
  name: string;
  description: string;
  zone_type: string;
  traffic_density: string;
  patrol_level: string;
  hazards: string;            // JSON array
  current_direction: string;
  current_speed: number;
  wind_pattern: string;
  encounter_chance: number;
  adjacent_zones: string;     // JSON array
  accessible_ports: string;   // JSON array
  pirate_value: string;
  named_features: string;     // JSON array
  hurricane_season: boolean;
}

export interface OverlandRoute {
  id: string;
  name: string;
  from_port_id: string;
  to_location: string;
  distance_km: number;
  travel_time_days: number;
  terrain: string;
  hazards: string;            // JSON array
  passable_months: string | null; // JSON array or null
  description: string;
}

export interface River {
  id: string;
  name: string;
  port_id: string;
  navigable_km: number;
  description: string;
  strategic_value: string;
}

export interface Hideout {
  id: string;
  name: string;
  sea_zone_id: string;
  latitude: number;
  longitude: number;
  hideout_type: string;
  max_draft: number | null;
  fresh_water: boolean;
  careening: boolean;
  description: string;
  historical_notes: string;
}

export interface Plantation {
  id: string;
  name: string;
  port_id: string;
  type: string;
  established: number | null;
  acres: number | null;
  enslaved_workers: number | null;
  annual_output: number | null;
  primary_cargo: string | null;
  description: string;
}

export interface Cargo {
  id: string;
  type: string;
  quantity: number;
  ship_id: string | null;
  port_id: string | null;
  owner_agent_id: string | null;
  heat: number;             // 0-100, how stolen it looks
  seized_from: string | null;
  origin_port_id: string;
  heat_decay_rate: number;
  created_at: Date;
}

export interface Fence {
  id: string;
  agent_id: string;
  port_id: string;
  tier: number;             // 1-5
  trust: number;            // 0-100
  specialty: string | null; // cargo type specialty
  availability: number;     // 0-100, chance of being available
  cut_percentage: number;   // fence's take
  last_transaction_tick: number | null;
}

export interface HavenInvestment {
  id: string;
  agent_id: string;
  port_id: string;
  type: 'hideout' | 'warehouse' | 'tavern' | 'shipyard' | 'fort';
  level: number;
  investment_total: number;
  income_per_tick: number;
  created_at: Date;
}

export interface NavyCase {
  id: string;
  target_agent_id: string;
  investigating_agent_id: string;
  evidence_level: number;   // 0-100
  charges: string;          // JSON array
  witnesses: string;        // JSON array of agent IDs
  status: 'open' | 'warrant_issued' | 'arrested' | 'trial' | 'convicted' | 'acquitted' | 'dismissed';
  opened_tick: number;
  last_updated_tick: number;
}

export interface Bounty {
  id: string;
  target_agent_id: string;
  posted_by_agent_id: string | null;
  posted_by_nation: string | null;
  amount: number;
  reason: string;
  status: 'active' | 'claimed' | 'expired' | 'withdrawn';
  created_tick: number;
  expires_tick: number | null;
}

export interface Intel {
  id: string;
  source_agent_id: string;
  subject_agent_id: string | null;
  subject_ship_id: string | null;
  type: 'sighting' | 'rumor' | 'manifest' | 'route' | 'weakness' | 'alliance' | 'betrayal';
  content: string;
  accuracy: number;         // 0-100
  freshness: number;        // 0-100, decays per tick
  port_id: string;          // where intel is available
  price: number | null;
  created_tick: number;
}

export interface ShipCode {
  id: string;
  ship_id: string;
  articles: string;         // JSON array of articles
  plunder_split: string;    // JSON: role → share ratio
  captain_share: number;
  quartermaster_share: number;
  common_share: number;
  injury_compensation: string; // JSON: injury → payout
  rules: string;            // JSON array of behavioral rules
  created_tick: number;
  amended_tick: number | null;
}

export interface Weather {
  id: string;
  sea_zone_id: string;
  condition: string;
  wind_speed: number;
  wind_direction: number;
  visibility: number;
  storm_intensity: number;
  temperature: number;
  tick: number;
}

export interface MarketPrice {
  id: string;
  port_id: string;
  cargo_type: string;
  buy_price: number;
  sell_price: number;
  supply: number;
  demand: number;
  last_updated_tick: number;
}

export interface Skill {
  id: string;
  agent_id: string;
  domain: string;
  sub_skill: string;
  level: number;            // 0-100
  experience: number;
  last_used_tick: number;
}

export interface Reputation {
  id: string;
  agent_id: string;
  sea_zone_id: string;
  reputation: number;       // -100 to 100 (fear/respect)
  infamy: number;           // 0-100 (notoriety)
  honor: number;            // 0-100 (trustworthiness)
  last_updated_tick: number;
}

export interface WorldEvent {
  id: string;
  type: string;
  description: string;
  agent_ids: string;        // JSON array
  ship_ids: string;         // JSON array
  port_id: string | null;
  sea_zone_id: string | null;
  severity: number;         // 1-10
  tick: number;
  data: string;             // JSON: event-specific data
}

export interface AgentMemory {
  id: string;
  agent_id: string;
  content: string;
  type: 'working' | 'episodic' | 'semantic';
  importance: number;
  is_traumatic: boolean;
  embedding: Buffer | null;
  created_at: Date;
  last_accessed_at: Date;
  access_count: number;
}

export interface AgentRelationship {
  id: string;
  agent_id: string;
  target_agent_id: string;
  fondness: number;           // 0 (hatred) to 100 (love)
  trust: number;              // 0 (total distrust) to 100 (absolute faith)
  respect: number;            // 0 (contempt) to 100 (reverence)
  fear: number;               // 0 (none) to 100 (terror)
  rivalry: number;            // 0 (none) to 100 (blood feud)
  familiarity: number;        // 0 (stranger) to 100 (inseparable)
  last_interaction_tick: number | null;
  notes: string | null;       // JSON: significant events
}

export interface Wound {
  id: string;
  agent_id: string;
  type: 'cut' | 'gunshot' | 'burn' | 'broken_bone' | 'disease' | 'scurvy' | 'fever' | 'infection';
  severity: number;         // 1-10
  location: string;         // body part
  treated: boolean;
  healing_progress: number; // 0-100
  created_tick: number;
}

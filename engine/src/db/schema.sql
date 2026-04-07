-- BUCCANEER LIFE Database Schema
-- SQLite

-- ============================================================
-- CORE ENTITIES
-- ============================================================

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  port_id TEXT,
  sea_zone_id TEXT,
  ship_id TEXT,
  status TEXT NOT NULL DEFAULT 'in_port' CHECK(status IN ('active', 'at_sea', 'in_port', 'imprisoned', 'dead', 'fled')),
  nationality TEXT NOT NULL DEFAULT 'english',
  persona TEXT NOT NULL,
  cash REAL NOT NULL DEFAULT 0,
  infamy INTEGER NOT NULL DEFAULT 0,
  gender TEXT DEFAULT 'male' CHECK(gender IN ('male', 'female')),
  heritage TEXT DEFAULT 'english',
  nickname TEXT DEFAULT NULL,
  attributes TEXT DEFAULT '{}',
  last_decision_tick INTEGER NOT NULL DEFAULT 0,
  cooldown_until_tick INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
CREATE INDEX IF NOT EXISTS idx_agents_port ON agents(port_id);
CREATE INDEX IF NOT EXISTS idx_agents_zone ON agents(sea_zone_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

CREATE TABLE IF NOT EXISTS ships (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  class TEXT NOT NULL CHECK(class IN ('periagua', 'shallop', 'droger', 'sloop', 'schooner', 'bark', 'galley', 'packet_boat', 'brigantine', 'brig', 'frigate', 'man_of_war', 'fluyt', 'merchantman', 'galleon', 'guineaman', 'east_indiaman')),
  captain_id TEXT,
  hull INTEGER NOT NULL DEFAULT 100,
  sails INTEGER NOT NULL DEFAULT 100,
  guns INTEGER NOT NULL DEFAULT 0,
  max_guns INTEGER NOT NULL DEFAULT 0,
  crew_count INTEGER NOT NULL DEFAULT 0,
  crew_capacity INTEGER NOT NULL DEFAULT 0,
  cargo_used INTEGER NOT NULL DEFAULT 0,
  cargo_capacity INTEGER NOT NULL DEFAULT 0,
  speed_base REAL NOT NULL DEFAULT 5,
  maneuverability INTEGER NOT NULL DEFAULT 5,
  port_id TEXT,
  sea_zone_id TEXT,
  status TEXT NOT NULL DEFAULT 'docked' CHECK(status IN ('docked', 'sailing', 'combat', 'careening', 'sunk', 'captured')),
  barnacle_level INTEGER NOT NULL DEFAULT 0,
  rot_level INTEGER NOT NULL DEFAULT 0,
  powder_stores INTEGER NOT NULL DEFAULT 50,
  food_stores INTEGER NOT NULL DEFAULT 100,
  water_stores INTEGER NOT NULL DEFAULT 100,
  destination_port_id TEXT,
  origin_port_id TEXT,
  current_zone_id TEXT,
  arrival_tick INTEGER,
  departure_tick INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ships_captain ON ships(captain_id);
CREATE INDEX IF NOT EXISTS idx_ships_port ON ships(port_id);
CREATE INDEX IF NOT EXISTS idx_ships_zone ON ships(sea_zone_id);
CREATE INDEX IF NOT EXISTS idx_ships_status ON ships(status);

CREATE TABLE IF NOT EXISTS crew (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  ship_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'common_sailor' CHECK(role IN ('captain', 'quartermaster', 'first_mate', 'boatswain', 'gunner', 'navigator', 'surgeon', 'cook', 'carpenter', 'common_sailor')),
  loyalty INTEGER NOT NULL DEFAULT 60,
  share_agreement REAL NOT NULL DEFAULT 1.0,
  grievances TEXT DEFAULT '[]',
  skills TEXT DEFAULT '{}',
  joined_tick INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'injured', 'sick', 'dead', 'deserted', 'marooned'))
);

CREATE INDEX IF NOT EXISTS idx_crew_ship ON crew(ship_id);
CREATE INDEX IF NOT EXISTS idx_crew_agent ON crew(agent_id);

-- ============================================================
-- WORLD -- Physical Geography
-- ============================================================

CREATE TABLE IF NOT EXISTS ports (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sea_zone_id TEXT NOT NULL,
  controller TEXT NOT NULL,
  port_type TEXT NOT NULL DEFAULT 'major_port' CHECK(port_type IN ('major_port', 'minor_port', 'trading_post', 'european_city', 'pirate_hideout')),
  corruption INTEGER NOT NULL DEFAULT 30,
  prosperity INTEGER NOT NULL DEFAULT 50,
  population INTEGER NOT NULL DEFAULT 1000,
  fort_strength INTEGER NOT NULL DEFAULT 30,
  disease_profile TEXT NOT NULL DEFAULT '{}',
  tavern_quality INTEGER NOT NULL DEFAULT 50,
  shipyard_quality INTEGER NOT NULL DEFAULT 50,
  market_size INTEGER NOT NULL DEFAULT 50,
  pirate_friendly INTEGER NOT NULL DEFAULT 0,
  latitude REAL,
  longitude REAL,
  -- Harbor approach details
  entrance_width INTEGER,
  entrance_depth REAL,
  max_draft REAL,
  tidal_range REAL,
  anchorage_capacity INTEGER,
  approach_directions TEXT,
  defenses TEXT,
  terrain TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  port_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('tavern', 'fort', 'church', 'dock', 'market', 'shipyard', 'brothel', 'warehouse', 'government', 'jail', 'camp', 'landmark', 'residential', 'trading_post', 'slave_market', 'hospital')),
  capacity INTEGER NOT NULL DEFAULT 50,
  quality INTEGER NOT NULL DEFAULT 50,
  safety INTEGER NOT NULL DEFAULT 50,
  corruption INTEGER NOT NULL DEFAULT 30,
  visibility INTEGER NOT NULL DEFAULT 70,
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_places_port ON places(port_id);
CREATE INDEX IF NOT EXISTS idx_places_type ON places(type);

CREATE TABLE IF NOT EXISTS sea_zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  zone_type TEXT NOT NULL,
  traffic_density TEXT NOT NULL DEFAULT 'moderate',
  patrol_level TEXT NOT NULL DEFAULT 'moderate',
  hazards TEXT DEFAULT '[]',
  current_direction TEXT,
  current_speed REAL NOT NULL DEFAULT 0.5,
  wind_pattern TEXT,
  encounter_chance INTEGER NOT NULL DEFAULT 5,
  adjacent_zones TEXT DEFAULT '[]',
  accessible_ports TEXT DEFAULT '[]',
  pirate_value TEXT,
  named_features TEXT DEFAULT '[]',
  hurricane_season INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS overland_routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  from_port_id TEXT NOT NULL,
  to_location TEXT NOT NULL,
  distance_km INTEGER NOT NULL,
  travel_time_days REAL NOT NULL,
  terrain TEXT,
  hazards TEXT DEFAULT '[]',
  passable_months TEXT,
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_overland_from ON overland_routes(from_port_id);

CREATE TABLE IF NOT EXISTS rivers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  port_id TEXT NOT NULL,
  navigable_km INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  strategic_value TEXT
);

CREATE INDEX IF NOT EXISTS idx_rivers_port ON rivers(port_id);

CREATE TABLE IF NOT EXISTS hideouts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sea_zone_id TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  hideout_type TEXT NOT NULL,
  max_draft REAL,
  fresh_water INTEGER NOT NULL DEFAULT 0,
  careening INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  historical_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_hideouts_zone ON hideouts(sea_zone_id);

CREATE TABLE IF NOT EXISTS plantations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  port_id TEXT NOT NULL,
  type TEXT NOT NULL,
  established INTEGER,
  acres INTEGER,
  enslaved_workers INTEGER,
  annual_output INTEGER,
  primary_cargo TEXT,
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_plantations_port ON plantations(port_id);

-- ============================================================
-- WEATHER
-- ============================================================

CREATE TABLE IF NOT EXISTS weather (
  id TEXT PRIMARY KEY,
  sea_zone_id TEXT NOT NULL,
  condition TEXT NOT NULL,
  wind_speed INTEGER NOT NULL DEFAULT 10,
  wind_direction INTEGER NOT NULL DEFAULT 0,
  visibility REAL NOT NULL DEFAULT 0.8,
  storm_intensity REAL NOT NULL DEFAULT 0,
  temperature INTEGER NOT NULL DEFAULT 28,
  tick INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_weather_zone ON weather(sea_zone_id);
CREATE INDEX IF NOT EXISTS idx_weather_tick ON weather(tick);

-- ============================================================
-- ECONOMY
-- ============================================================

CREATE TABLE IF NOT EXISTS cargo (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  ship_id TEXT,
  port_id TEXT,
  owner_agent_id TEXT,
  heat INTEGER NOT NULL DEFAULT 0,
  seized_from TEXT,
  origin_port_id TEXT,
  heat_decay_rate REAL NOT NULL DEFAULT 0.5,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cargo_ship ON cargo(ship_id);
CREATE INDEX IF NOT EXISTS idx_cargo_port ON cargo(port_id);
CREATE INDEX IF NOT EXISTS idx_cargo_owner ON cargo(owner_agent_id);

CREATE TABLE IF NOT EXISTS market_prices (
  id TEXT PRIMARY KEY,
  port_id TEXT NOT NULL,
  cargo_type TEXT NOT NULL,
  buy_price REAL NOT NULL,
  sell_price REAL NOT NULL,
  supply INTEGER NOT NULL DEFAULT 100,
  demand INTEGER NOT NULL DEFAULT 100,
  last_updated_tick INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_market ON market_prices(port_id, cargo_type);
CREATE INDEX IF NOT EXISTS idx_market_port ON market_prices(port_id);

CREATE TABLE IF NOT EXISTS fences (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  port_id TEXT NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1,
  trust INTEGER NOT NULL DEFAULT 0,
  specialty TEXT,
  availability INTEGER NOT NULL DEFAULT 80,
  cut_percentage REAL NOT NULL DEFAULT 50,
  last_transaction_tick INTEGER
);

CREATE INDEX IF NOT EXISTS idx_fences_port ON fences(port_id);
CREATE INDEX IF NOT EXISTS idx_fences_agent ON fences(agent_id);

CREATE TABLE IF NOT EXISTS haven_investments (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  port_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('hideout', 'warehouse', 'tavern', 'shipyard', 'fort')),
  level INTEGER NOT NULL DEFAULT 1,
  investment_total REAL NOT NULL DEFAULT 0,
  income_per_tick REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_haven_agent ON haven_investments(agent_id);
CREATE INDEX IF NOT EXISTS idx_haven_port ON haven_investments(port_id);

-- ============================================================
-- LAW & ORDER
-- ============================================================

CREATE TABLE IF NOT EXISTS navy_cases (
  id TEXT PRIMARY KEY,
  target_agent_id TEXT NOT NULL,
  investigating_agent_id TEXT NOT NULL,
  evidence_level INTEGER NOT NULL DEFAULT 0,
  charges TEXT DEFAULT '[]',
  witnesses TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'warrant_issued', 'arrested', 'trial', 'convicted', 'acquitted', 'dismissed')),
  opened_tick INTEGER NOT NULL,
  last_updated_tick INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cases_target ON navy_cases(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON navy_cases(status);

CREATE TABLE IF NOT EXISTS bounties (
  id TEXT PRIMARY KEY,
  target_agent_id TEXT NOT NULL,
  posted_by_agent_id TEXT,
  posted_by_nation TEXT,
  amount REAL NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'claimed', 'expired', 'withdrawn')),
  created_tick INTEGER NOT NULL,
  expires_tick INTEGER
);

CREATE INDEX IF NOT EXISTS idx_bounties_target ON bounties(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);

-- ============================================================
-- INTELLIGENCE
-- ============================================================

CREATE TABLE IF NOT EXISTS intel (
  id TEXT PRIMARY KEY,
  source_agent_id TEXT NOT NULL,
  subject_agent_id TEXT,
  subject_ship_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('sighting', 'rumor', 'manifest', 'route', 'weakness', 'alliance', 'betrayal')),
  content TEXT NOT NULL,
  accuracy INTEGER NOT NULL DEFAULT 70,
  freshness INTEGER NOT NULL DEFAULT 100,
  port_id TEXT NOT NULL,
  price REAL,
  created_tick INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_intel_port ON intel(port_id);
CREATE INDEX IF NOT EXISTS idx_intel_subject ON intel(subject_agent_id);
CREATE INDEX IF NOT EXISTS idx_intel_freshness ON intel(freshness);

-- ============================================================
-- SHIP GOVERNANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS ship_code (
  id TEXT PRIMARY KEY,
  ship_id TEXT NOT NULL UNIQUE,
  articles TEXT NOT NULL DEFAULT '[]',
  plunder_split TEXT NOT NULL DEFAULT '{}',
  captain_share REAL NOT NULL DEFAULT 2.0,
  quartermaster_share REAL NOT NULL DEFAULT 1.5,
  common_share REAL NOT NULL DEFAULT 1.0,
  injury_compensation TEXT DEFAULT '{}',
  rules TEXT DEFAULT '[]',
  created_tick INTEGER NOT NULL,
  amended_tick INTEGER
);

CREATE INDEX IF NOT EXISTS idx_code_ship ON ship_code(ship_id);

-- ============================================================
-- CHARACTER DEVELOPMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  sub_skill TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  experience INTEGER NOT NULL DEFAULT 0,
  last_used_tick INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_skill ON skills(agent_id, domain, sub_skill);
CREATE INDEX IF NOT EXISTS idx_skills_agent ON skills(agent_id);

CREATE TABLE IF NOT EXISTS reputation (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  sea_zone_id TEXT NOT NULL,
  reputation INTEGER NOT NULL DEFAULT 0,
  infamy INTEGER NOT NULL DEFAULT 0,
  honor INTEGER NOT NULL DEFAULT 50,
  last_updated_tick INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_rep ON reputation(agent_id, sea_zone_id);
CREATE INDEX IF NOT EXISTS idx_rep_agent ON reputation(agent_id);

CREATE TABLE IF NOT EXISTS wounds (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('cut', 'gunshot', 'burn', 'broken_bone', 'disease', 'scurvy', 'fever', 'infection')),
  severity INTEGER NOT NULL DEFAULT 3,
  location TEXT,
  treated INTEGER NOT NULL DEFAULT 0,
  healing_progress INTEGER NOT NULL DEFAULT 0,
  created_tick INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wounds_agent ON wounds(agent_id);

-- ============================================================
-- RELATIONSHIPS
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_relationships (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  target_agent_id TEXT NOT NULL,
  fondness INTEGER NOT NULL DEFAULT 50,
  trust INTEGER NOT NULL DEFAULT 50,
  respect INTEGER NOT NULL DEFAULT 50,
  fear INTEGER NOT NULL DEFAULT 0,
  rivalry INTEGER NOT NULL DEFAULT 0,
  familiarity INTEGER NOT NULL DEFAULT 0,
  last_interaction_tick INTEGER,
  notes TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_relationship ON agent_relationships(agent_id, target_agent_id);
CREATE INDEX IF NOT EXISTS idx_rel_agent ON agent_relationships(agent_id);
CREATE INDEX IF NOT EXISTS idx_rel_target ON agent_relationships(target_agent_id);

-- ============================================================
-- DOCUMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  holder_agent_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_tick INTEGER NOT NULL,
  expires_tick INTEGER
);

CREATE INDEX IF NOT EXISTS idx_docs_holder ON documents(holder_agent_id);
CREATE INDEX IF NOT EXISTS idx_docs_type ON documents(type);

-- ============================================================
-- EVENTS & HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS world_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  agent_ids TEXT DEFAULT '[]',
  ship_ids TEXT DEFAULT '[]',
  port_id TEXT,
  sea_zone_id TEXT,
  severity INTEGER NOT NULL DEFAULT 5,
  tick INTEGER NOT NULL,
  data TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_events_tick ON world_events(tick);
CREATE INDEX IF NOT EXISTS idx_events_type ON world_events(type);
CREATE INDEX IF NOT EXISTS idx_events_port ON world_events(port_id);

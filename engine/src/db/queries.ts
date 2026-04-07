import { query, execute } from './sqlite.js';
import type { Agent, Ship, Crew, Port, Place, SeaZone, Cargo, Intel, NavyCase, MarketPrice, Reputation, WorldEvent, OverlandRoute, River, Hideout, Plantation, Fence, HavenInvestment, Bounty, Wound, Skill, ShipCode, AgentRelationship } from './models.js';

// ============================================================
// Agents
// ============================================================

export namespace AgentQueries {
  export async function getById(id: string) {
    const rows = await query<(Agent)[]>('SELECT * FROM agents WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  export async function getByType(type: string) {
    return query<(Agent)[]>('SELECT * FROM agents WHERE type = ? AND status != \'dead\'', [type]);
  }

  export async function getByPort(portId: string) {
    return query<(Agent)[]>('SELECT * FROM agents WHERE port_id = ? AND status != \'dead\'', [portId]);
  }

  export async function getByZone(seaZoneId: string) {
    return query<(Agent)[]>('SELECT * FROM agents WHERE sea_zone_id = ? AND status != \'dead\'', [seaZoneId]);
  }

  export async function getActive() {
    return query<(Agent)[]>(
      'SELECT * FROM agents WHERE status IN (\'active\', \'at_sea\', \'in_port\')'
    );
  }

  export async function getReadyForDecision(currentTick: number, limit: number) {
    return query<(Agent)[]>(
      'SELECT * FROM agents WHERE status IN (\'active\', \'at_sea\', \'in_port\') AND cooldown_until_tick <= ? ORDER BY last_decision_tick ASC LIMIT ?',
      [currentTick, limit]
    );
  }

  export async function insert(agent: Omit<Agent, 'created_at' | 'updated_at'>) {
    return execute(
      'INSERT INTO agents (id, type, name, port_id, sea_zone_id, ship_id, status, nationality, gender, heritage, nickname, attributes, persona, cash, infamy, last_decision_tick, cooldown_until_tick) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [agent.id, agent.type, agent.name, agent.port_id, agent.sea_zone_id, agent.ship_id, agent.status, agent.nationality, agent.gender, agent.heritage, agent.nickname, agent.attributes, agent.persona, agent.cash, agent.infamy, agent.last_decision_tick, agent.cooldown_until_tick]
    );
  }

  export async function updateStatus(id: string, status: Agent['status']) {
    return execute('UPDATE agents SET status = ? WHERE id = ?', [status, id]);
  }

  export async function updateDecisionTick(id: string, tick: number, cooldownUntil: number) {
    return execute('UPDATE agents SET last_decision_tick = ?, cooldown_until_tick = ? WHERE id = ?', [tick, cooldownUntil, id]);
  }

  export async function updateLocation(id: string, portId: string, seaZoneId: string) {
    return execute('UPDATE agents SET port_id = ?, sea_zone_id = ? WHERE id = ?', [portId, seaZoneId, id]);
  }

  export async function updateCash(id: string, cash: number) {
    return execute('UPDATE agents SET cash = ? WHERE id = ?', [cash, id]);
  }

  export async function addCash(id: string, amount: number) {
    return execute('UPDATE agents SET cash = cash + ? WHERE id = ?', [amount, id]);
  }

  export async function count() {
    const rows = await query<({ count: number })[]>('SELECT COUNT(*) as count FROM agents');
    return rows[0]?.count ?? 0;
  }

  /** Get agents by a list of IDs (for relationship name resolution). */
  export async function getByIds(ids: string[]) {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    return query<(Agent)[]>(`SELECT * FROM agents WHERE id IN (${placeholders})`, ids);
  }

  /** Get agents whose ships are sailing in a given sea zone (for at-sea encounters). */
  export async function getByZoneWithShips(seaZoneId: string) {
    return query<(Agent & { ship_name: string; ship_class: string; ship_guns: number; ship_crew_count: number; ship_hull: number; ship_sails: number; ship_id_ref: string })[]>(
      `SELECT a.*, s.name as ship_name, s.class as ship_class, s.guns as ship_guns,
              s.crew_count as ship_crew_count, s.hull as ship_hull, s.sails as ship_sails,
              s.id as ship_id_ref
       FROM agents a
       JOIN ships s ON s.captain_id = a.id
       WHERE s.sea_zone_id = ? AND s.status = 'sailing'`,
      [seaZoneId],
    );
  }
}

// ============================================================
// Ships
// ============================================================

export namespace ShipQueries {
  export async function getById(id: string) {
    const rows = await query<(Ship)[]>('SELECT * FROM ships WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  export async function getByCaptain(captainId: string) {
    const rows = await query<(Ship)[]>('SELECT * FROM ships WHERE captain_id = ?', [captainId]);
    return rows[0] ?? null;
  }

  export async function getByPort(portId: string) {
    return query<(Ship)[]>('SELECT * FROM ships WHERE port_id = ? AND status = \'docked\'', [portId]);
  }

  export async function getByZone(seaZoneId: string) {
    return query<(Ship)[]>('SELECT * FROM ships WHERE sea_zone_id = ? AND status NOT IN (\'sunk\', \'captured\')', [seaZoneId]);
  }

  export async function insert(ship: Omit<Ship, 'created_at'>) {
    return execute(
      'INSERT INTO ships (id, name, class, captain_id, hull, sails, guns, max_guns, crew_count, crew_capacity, cargo_used, cargo_capacity, speed_base, maneuverability, port_id, sea_zone_id, status, barnacle_level, rot_level, powder_stores, food_stores, water_stores) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [ship.id, ship.name, ship.class, ship.captain_id, ship.hull, ship.sails, ship.guns, ship.max_guns, ship.crew_count, ship.crew_capacity, ship.cargo_used, ship.cargo_capacity, ship.speed_base, ship.maneuverability, ship.port_id, ship.sea_zone_id, ship.status, ship.barnacle_level, ship.rot_level, ship.powder_stores, ship.food_stores, ship.water_stores]
    );
  }

  export async function updateCondition(id: string, hull: number, sails: number, barnacles: number, rot: number) {
    return execute('UPDATE ships SET hull = ?, sails = ?, barnacle_level = ?, rot_level = ? WHERE id = ?', [hull, sails, barnacles, rot, id]);
  }

  export async function updateStores(id: string, food: number, water: number, powder: number) {
    return execute('UPDATE ships SET food_stores = ?, water_stores = ?, powder_stores = ? WHERE id = ?', [food, water, powder, id]);
  }

  export async function getSailing() {
    return query<(Ship)[]>('SELECT * FROM ships WHERE status = \'sailing\'');
  }

  export async function updateTravel(id: string, seaZoneId: string, currentZoneId: string, arrivalTick: number | null) {
    return execute('UPDATE ships SET sea_zone_id = ?, current_zone_id = ?, arrival_tick = ? WHERE id = ?', [seaZoneId, currentZoneId, arrivalTick, id]);
  }

  export async function updateStatusFull(id: string, status: Ship['status'], portId?: string | null, destinationPortId?: string | null) {
    // Clear sea_zone_id for sunk/captured ships so they don't appear in zone queries
    if (status === 'sunk' || status === 'captured') {
      return execute('UPDATE ships SET status = ?, port_id = ?, destination_port_id = ?, sea_zone_id = NULL, current_zone_id = NULL WHERE id = ?', [status, portId ?? null, destinationPortId ?? null, id]);
    }
    return execute('UPDATE ships SET status = ?, port_id = ?, destination_port_id = ? WHERE id = ?', [status, portId ?? null, destinationPortId ?? null, id]);
  }

  export async function updateVoyageInfo(id: string, originPortId: string | null, departureTick: number | null) {
    return execute('UPDATE ships SET origin_port_id = ?, departure_tick = ? WHERE id = ?', [originPortId, departureTick, id]);
  }

  export async function updateCrewCount(id: string, crewCount: number) {
    return execute('UPDATE ships SET crew_count = ? WHERE id = ?', [crewCount, id]);
  }

  export async function getAll() {
    return query<(Ship)[]>('SELECT * FROM ships');
  }

  export async function getAllActive() {
    return query<(Ship)[]>('SELECT * FROM ships WHERE status != \'sunk\'');
  }
}

// ============================================================
// Places
// ============================================================

export namespace PlaceQueries {
  export async function getByPort(portId: string) {
    return query<(Place)[]>('SELECT * FROM places WHERE port_id = ?', [portId]);
  }

  export async function getById(id: string) {
    const rows = await query<(Place)[]>('SELECT * FROM places WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  export async function getByType(portId: string, type: string) {
    return query<(Place)[]>('SELECT * FROM places WHERE port_id = ? AND type = ?', [portId, type]);
  }

  export async function count() {
    const rows = await query<({ count: number })[]>('SELECT COUNT(*) as count FROM places');
    return rows[0]?.count ?? 0;
  }
}

// ============================================================
// Sea Zones
// ============================================================

export namespace SeaZoneQueries {
  export async function getById(id: string) {
    const rows = await query<(SeaZone)[]>('SELECT * FROM sea_zones WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  export async function getAll() {
    return query<(SeaZone)[]>('SELECT * FROM sea_zones');
  }

  export async function getAdjacent(zoneId: string) {
    const zone = await getById(zoneId);
    if (!zone) return [];
    const adjacentIds: string[] = JSON.parse(zone.adjacent_zones);
    if (adjacentIds.length === 0) return [];
    const placeholders = adjacentIds.map(() => '?').join(',');
    return query<(SeaZone)[]>(`SELECT * FROM sea_zones WHERE id IN (${placeholders})`, adjacentIds);
  }

  export async function count() {
    const rows = await query<({ count: number })[]>('SELECT COUNT(*) as count FROM sea_zones');
    return rows[0]?.count ?? 0;
  }
}

// ============================================================
// Routes (Overland)
// ============================================================

export namespace RouteQueries {
  export async function getByPort(portId: string) {
    return query<(OverlandRoute)[]>('SELECT * FROM overland_routes WHERE from_port_id = ?', [portId]);
  }

  export async function getAll() {
    return query<(OverlandRoute)[]>('SELECT * FROM overland_routes');
  }
}

// ============================================================
// Market Prices
// ============================================================

export namespace MarketQueries {
  export async function getByPort(portId: string) {
    return query<(MarketPrice)[]>('SELECT * FROM market_prices WHERE port_id = ?', [portId]);
  }

  export async function getPrice(portId: string, cargoType: string) {
    const rows = await query<(MarketPrice)[]>(
      'SELECT * FROM market_prices WHERE port_id = ? AND cargo_type = ?', [portId, cargoType]
    );
    return rows[0] ?? null;
  }

  export async function upsert(portId: string, cargoType: string, buyPrice: number, sellPrice: number, supply: number, demand: number, tick: number) {
    return execute(
      'INSERT INTO market_prices (id, port_id, cargo_type, buy_price, sell_price, supply, demand, last_updated_tick) VALUES (lower(hex(randomblob(4)) || \'-\' || hex(randomblob(2)) || \'-4\' || substr(hex(randomblob(2)),2) || \'-\' || substr(\'89ab\',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || \'-\' || hex(randomblob(6))), ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(port_id, cargo_type) DO UPDATE SET buy_price = ?, sell_price = ?, supply = ?, demand = ?, last_updated_tick = ?',
      [portId, cargoType, buyPrice, sellPrice, supply, demand, tick, buyPrice, sellPrice, supply, demand, tick]
    );
  }
}

// ============================================================
// World Events
// ============================================================

export namespace EventQueries {
  export async function insert(event: Omit<WorldEvent, 'id'> & { id: string }) {
    return execute(
      'INSERT INTO world_events (id, type, description, agent_ids, ship_ids, port_id, sea_zone_id, severity, tick, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [event.id, event.type, event.description, event.agent_ids, event.ship_ids, event.port_id, event.sea_zone_id, event.severity, event.tick, event.data]
    );
  }

  export async function getRecent(limit: number) {
    return query<(WorldEvent)[]>('SELECT * FROM world_events ORDER BY tick DESC LIMIT ?', [limit]);
  }

  export async function getByPort(portId: string, limit: number) {
    return query<(WorldEvent)[]>(
      'SELECT * FROM world_events WHERE port_id = ? ORDER BY tick DESC LIMIT ?', [portId, limit]
    );
  }
}

// ============================================================
// Cargo
// ============================================================

export namespace CargoQueries {
  export async function getByShip(shipId: string) {
    return query<(Cargo)[]>('SELECT * FROM cargo WHERE ship_id = ?', [shipId]);
  }

  export async function getByPort(portId: string) {
    return query<(Cargo)[]>('SELECT * FROM cargo WHERE port_id = ?', [portId]);
  }

  export async function getByOwner(agentId: string) {
    return query<(Cargo)[]>('SELECT * FROM cargo WHERE owner_agent_id = ?', [agentId]);
  }

  export async function insert(cargo: Omit<Cargo, 'created_at'>) {
    return execute(
      'INSERT INTO cargo (id, type, quantity, ship_id, port_id, owner_agent_id, heat, seized_from, origin_port_id, heat_decay_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [cargo.id, cargo.type, cargo.quantity, cargo.ship_id, cargo.port_id, cargo.owner_agent_id, cargo.heat, cargo.seized_from, cargo.origin_port_id, cargo.heat_decay_rate]
    );
  }

  export async function updateLocation(cargoId: string, shipId: string | null, portId: string | null) {
    return execute('UPDATE cargo SET ship_id = ?, port_id = ? WHERE id = ?', [shipId, portId, cargoId]);
  }

  export async function transferSeized(cargoId: string, newShipId: string, newOwnerId: string, heat: number, seizedFrom: string) {
    return execute(
      'UPDATE cargo SET ship_id = ?, port_id = NULL, owner_agent_id = ?, heat = ?, seized_from = ?, heat_decay_rate = 0.10 WHERE id = ?',
      [newShipId, newOwnerId, heat, seizedFrom, cargoId]
    );
  }

  export async function updateQuantity(cargoId: string, quantity: number) {
    return execute('UPDATE cargo SET quantity = ? WHERE id = ?', [quantity, cargoId]);
  }

  export async function remove(cargoId: string) {
    return execute('DELETE FROM cargo WHERE id = ?', [cargoId]);
  }

  export async function updateHeat(id: string, heat: number) {
    return execute('UPDATE cargo SET heat = ? WHERE id = ?', [heat, id]);
  }

  export async function getWithHeat() {
    return query<(Cargo)[]>('SELECT * FROM cargo WHERE heat > 0');
  }

  export async function getAll() {
    return query<(Cargo)[]>('SELECT * FROM cargo');
  }
}

// ============================================================
// Plantations
// ============================================================

export namespace PlantationQueries {
  export async function getById(id: string) {
    const rows = await query<(Plantation)[]>('SELECT * FROM plantations WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  export async function getByPort(portId: string) {
    return query<(Plantation)[]>('SELECT * FROM plantations WHERE port_id = ?', [portId]);
  }

  export async function getAll() {
    return query<(Plantation)[]>('SELECT * FROM plantations');
  }
}

// ============================================================
// Rivers
// ============================================================

export namespace RiverQueries {
  export async function getById(id: string) {
    const rows = await query<(River)[]>('SELECT * FROM rivers WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  export async function getByPort(portId: string) {
    return query<(River)[]>('SELECT * FROM rivers WHERE port_id = ?', [portId]);
  }

  export async function getAll() {
    return query<(River)[]>('SELECT * FROM rivers');
  }
}

// ============================================================
// Hideouts
// ============================================================

export namespace HideoutQueries {
  export async function getById(id: string) {
    const rows = await query<(Hideout)[]>('SELECT * FROM hideouts WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  export async function getByZone(seaZoneId: string) {
    return query<(Hideout)[]>('SELECT * FROM hideouts WHERE sea_zone_id = ?', [seaZoneId]);
  }

  export async function getByType(type: string) {
    return query<(Hideout)[]>('SELECT * FROM hideouts WHERE hideout_type = ?', [type]);
  }

  export async function getAll() {
    return query<(Hideout)[]>('SELECT * FROM hideouts');
  }
}

// ============================================================
// Crew
// ============================================================

export namespace CrewQueries {
  export async function getById(id: string) {
    const rows = await query<(Crew)[]>('SELECT * FROM crew WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  export async function getByShip(shipId: string) {
    return query<(Crew)[]>('SELECT * FROM crew WHERE ship_id = ?', [shipId]);
  }

  export async function getByAgent(agentId: string) {
    return query<(Crew)[]>('SELECT * FROM crew WHERE agent_id = ?', [agentId]);
  }

  export async function getActiveByShip(shipId: string) {
    return query<(Crew)[]>('SELECT * FROM crew WHERE ship_id = ? AND status = \'active\'', [shipId]);
  }

  export async function insert(crew: Crew) {
    return execute(
      'INSERT INTO crew (id, agent_id, ship_id, role, loyalty, share_agreement, grievances, skills, joined_tick, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [crew.id, crew.agent_id, crew.ship_id, crew.role, crew.loyalty, crew.share_agreement, crew.grievances, crew.skills, crew.joined_tick, crew.status]
    );
  }

  export async function updateLoyalty(id: string, loyalty: number) {
    return execute('UPDATE crew SET loyalty = ? WHERE id = ?', [loyalty, id]);
  }

  export async function updateStatus(id: string, status: Crew['status']) {
    return execute('UPDATE crew SET status = ? WHERE id = ?', [status, id]);
  }

  export async function updateGrievances(id: string, grievances: string) {
    return execute('UPDATE crew SET grievances = ? WHERE id = ?', [grievances, id]);
  }

  export async function remove(id: string) {
    return execute('DELETE FROM crew WHERE id = ?', [id]);
  }
}

// ============================================================
// Wounds
// ============================================================

export namespace WoundQueries {
  export async function getById(id: string) {
    const rows = await query<(Wound)[]>('SELECT * FROM wounds WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  export async function getByAgent(agentId: string) {
    return query<(Wound)[]>('SELECT * FROM wounds WHERE agent_id = ?', [agentId]);
  }

  export async function getActive() {
    return query<(Wound)[]>('SELECT * FROM wounds WHERE healing_progress < 100');
  }

  export async function insert(wound: Wound) {
    return execute(
      'INSERT INTO wounds (id, agent_id, type, severity, location, treated, healing_progress, created_tick) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [wound.id, wound.agent_id, wound.type, wound.severity, wound.location, wound.treated, wound.healing_progress, wound.created_tick]
    );
  }

  export async function updateTreatment(id: string, treated: boolean) {
    return execute('UPDATE wounds SET treated = ? WHERE id = ?', [treated, id]);
  }

  export async function updateHealing(id: string, healingProgress: number, severity: number) {
    return execute('UPDATE wounds SET healing_progress = ?, severity = ? WHERE id = ?', [healingProgress, severity, id]);
  }

  export async function remove(id: string) {
    return execute('DELETE FROM wounds WHERE id = ?', [id]);
  }
}

// ============================================================
// Reputation
// ============================================================

export namespace ReputationQueries {
  export async function getByAgent(agentId: string) {
    return query<(Reputation)[]>('SELECT * FROM reputation WHERE agent_id = ?', [agentId]);
  }

  export async function getByAgentAndZone(agentId: string, seaZoneId: string) {
    const rows = await query<(Reputation)[]>(
      'SELECT * FROM reputation WHERE agent_id = ? AND sea_zone_id = ?', [agentId, seaZoneId]
    );
    return rows[0] ?? null;
  }

  export async function upsert(agentId: string, seaZoneId: string, reputation: number, infamy: number, honor: number, tick: number) {
    return execute(
      'INSERT INTO reputation (id, agent_id, sea_zone_id, reputation, infamy, honor, last_updated_tick) VALUES (lower(hex(randomblob(4)) || \'-\' || hex(randomblob(2)) || \'-4\' || substr(hex(randomblob(2)),2) || \'-\' || substr(\'89ab\',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || \'-\' || hex(randomblob(6))), ?, ?, ?, ?, ?, ?) ON CONFLICT(agent_id, sea_zone_id) DO UPDATE SET reputation = ?, infamy = ?, honor = ?, last_updated_tick = ?',
      [agentId, seaZoneId, reputation, infamy, honor, tick, reputation, infamy, honor, tick]
    );
  }

  export async function getAll() {
    return query<(Reputation)[]>('SELECT * FROM reputation');
  }
}

// ============================================================
// Intel
// ============================================================

export namespace IntelQueries {
  export async function getById(id: string) {
    const rows = await query<(Intel)[]>('SELECT * FROM intel WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  export async function getByPort(portId: string) {
    return query<(Intel)[]>('SELECT * FROM intel WHERE port_id = ? AND freshness > 0 ORDER BY freshness DESC', [portId]);
  }

  export async function getBySubjectAgent(agentId: string) {
    return query<(Intel)[]>('SELECT * FROM intel WHERE subject_agent_id = ?', [agentId]);
  }

  export async function getBySubjectShip(shipId: string) {
    return query<(Intel)[]>('SELECT * FROM intel WHERE subject_ship_id = ?', [shipId]);
  }

  export async function getActive() {
    return query<(Intel)[]>('SELECT * FROM intel WHERE freshness > 0');
  }

  export async function insert(intel: Intel) {
    return execute(
      'INSERT INTO intel (id, source_agent_id, subject_agent_id, subject_ship_id, type, content, accuracy, freshness, port_id, price, created_tick) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [intel.id, intel.source_agent_id, intel.subject_agent_id, intel.subject_ship_id, intel.type, intel.content, intel.accuracy, intel.freshness, intel.port_id, intel.price, intel.created_tick]
    );
  }

  export async function updateFreshness(id: string, freshness: number) {
    return execute('UPDATE intel SET freshness = ? WHERE id = ?', [freshness, id]);
  }

  export async function remove(id: string) {
    return execute('DELETE FROM intel WHERE id = ?', [id]);
  }

  export async function removeStale() {
    return execute('DELETE FROM intel WHERE freshness <= 0');
  }
}

// ============================================================
// Bounties
// ============================================================

export namespace BountyQueries {
  export async function getById(id: string) {
    const rows = await query<(Bounty)[]>('SELECT * FROM bounties WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  export async function getByTarget(agentId: string) {
    return query<(Bounty)[]>('SELECT * FROM bounties WHERE target_agent_id = ? AND status = \'active\'', [agentId]);
  }

  export async function getActive() {
    return query<(Bounty)[]>('SELECT * FROM bounties WHERE status = \'active\'');
  }

  export async function insert(bounty: Bounty) {
    return execute(
      'INSERT INTO bounties (id, target_agent_id, posted_by_agent_id, posted_by_nation, amount, reason, status, created_tick, expires_tick) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [bounty.id, bounty.target_agent_id, bounty.posted_by_agent_id, bounty.posted_by_nation, bounty.amount, bounty.reason, bounty.status, bounty.created_tick, bounty.expires_tick]
    );
  }

  export async function updateStatus(id: string, status: Bounty['status']) {
    return execute('UPDATE bounties SET status = ? WHERE id = ?', [status, id]);
  }

  /** Batch fetch total active bounties for multiple agents. */
  export async function getTotalsForAgents(agentIds: string[]): Promise<Map<string, number>> {
    if (agentIds.length === 0) return new Map();
    const placeholders = agentIds.map(() => '?').join(',');
    const rows = await query<({ target_agent_id: string; total: number })[]>(
      `SELECT target_agent_id, SUM(amount) as total FROM bounties WHERE target_agent_id IN (${placeholders}) AND status = 'active' GROUP BY target_agent_id`,
      agentIds,
    );
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.target_agent_id, r.total);
    return map;
  }
}

// ============================================================
// Navy Cases
// ============================================================

export namespace NavyCaseQueries {
  export async function getById(id: string) {
    const rows = await query<(NavyCase)[]>('SELECT * FROM navy_cases WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  export async function getByTarget(agentId: string) {
    return query<(NavyCase)[]>('SELECT * FROM navy_cases WHERE target_agent_id = ?', [agentId]);
  }

  export async function getOpen() {
    return query<(NavyCase)[]>('SELECT * FROM navy_cases WHERE status IN (\'open\', \'warrant_issued\')');
  }

  export async function getWarranted() {
    return query<(NavyCase)[]>('SELECT * FROM navy_cases WHERE status = \'warrant_issued\'');
  }

  /** Batch check warrant/case status for multiple agents. Returns map of agentId → {warranted, evidence}. */
  export async function getCaseStatusForAgents(agentIds: string[]): Promise<Map<string, { warranted: boolean; evidence: number }>> {
    if (agentIds.length === 0) return new Map();
    const placeholders = agentIds.map(() => '?').join(',');
    const rows = await query<({ target_agent_id: string; status: string; evidence_level: number })[]>(
      `SELECT target_agent_id, status, evidence_level FROM navy_cases WHERE target_agent_id IN (${placeholders}) AND status IN ('open','warrant_issued') ORDER BY evidence_level DESC`,
      agentIds,
    );
    const map = new Map<string, { warranted: boolean; evidence: number }>();
    for (const r of rows) {
      if (!map.has(r.target_agent_id)) {
        map.set(r.target_agent_id, { warranted: r.status === 'warrant_issued', evidence: r.evidence_level });
      }
    }
    return map;
  }

  export async function getArrested() {
    return query<(NavyCase)[]>('SELECT * FROM navy_cases WHERE status = \'arrested\'');
  }

  export async function insert(navyCase: NavyCase) {
    return execute(
      'INSERT INTO navy_cases (id, target_agent_id, investigating_agent_id, evidence_level, charges, witnesses, status, opened_tick, last_updated_tick) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [navyCase.id, navyCase.target_agent_id, navyCase.investigating_agent_id, navyCase.evidence_level, navyCase.charges, navyCase.witnesses, navyCase.status, navyCase.opened_tick, navyCase.last_updated_tick]
    );
  }

  export async function updateEvidence(id: string, evidenceLevel: number, tick: number) {
    return execute('UPDATE navy_cases SET evidence_level = ?, last_updated_tick = ? WHERE id = ?', [evidenceLevel, tick, id]);
  }

  export async function updateStatus(id: string, status: NavyCase['status'], tick: number) {
    return execute('UPDATE navy_cases SET status = ?, last_updated_tick = ? WHERE id = ?', [status, tick, id]);
  }

  export async function addWitness(id: string, witnesses: string, tick: number) {
    return execute('UPDATE navy_cases SET witnesses = ?, last_updated_tick = ? WHERE id = ?', [witnesses, tick, id]);
  }
}

// ============================================================
// Fences
// ============================================================

export namespace FenceQueries {
  export async function getById(id: string) {
    const rows = await query<(Fence)[]>('SELECT * FROM fences WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  export async function getByPort(portId: string) {
    return query<(Fence)[]>('SELECT * FROM fences WHERE port_id = ?', [portId]);
  }

  export async function getByAgent(agentId: string) {
    return query<(Fence)[]>('SELECT * FROM fences WHERE agent_id = ?', [agentId]);
  }

  export async function insert(fence: Fence) {
    return execute(
      'INSERT INTO fences (id, agent_id, port_id, tier, trust, specialty, availability, cut_percentage, last_transaction_tick) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [fence.id, fence.agent_id, fence.port_id, fence.tier, fence.trust, fence.specialty, fence.availability, fence.cut_percentage, fence.last_transaction_tick]
    );
  }

  export async function updateTrust(id: string, trust: number, tick: number) {
    return execute('UPDATE fences SET trust = ?, last_transaction_tick = ? WHERE id = ?', [trust, tick, id]);
  }

  export async function updateTier(id: string, tier: number) {
    return execute('UPDATE fences SET tier = ? WHERE id = ?', [tier, id]);
  }
}

// ============================================================
// Skills
// ============================================================

export namespace SkillQueries {
  export async function getByAgent(agentId: string) {
    return query<(Skill)[]>('SELECT * FROM skills WHERE agent_id = ?', [agentId]);
  }

  export async function getByAgentAndDomain(agentId: string, domain: string) {
    return query<(Skill)[]>('SELECT * FROM skills WHERE agent_id = ? AND domain = ?', [agentId, domain]);
  }

  export async function upsert(agentId: string, domain: string, subSkill: string, level: number, experience: number, tick: number) {
    return execute(
      'INSERT INTO skills (id, agent_id, domain, sub_skill, level, experience, last_used_tick) VALUES (lower(hex(randomblob(4)) || \'-\' || hex(randomblob(2)) || \'-4\' || substr(hex(randomblob(2)),2) || \'-\' || substr(\'89ab\',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || \'-\' || hex(randomblob(6))), ?, ?, ?, ?, ?, ?) ON CONFLICT(agent_id, domain, sub_skill) DO UPDATE SET level = ?, experience = ?, last_used_tick = ?',
      [agentId, domain, subSkill, level, experience, tick, level, experience, tick]
    );
  }
}

// ============================================================
// Ship Code
// ============================================================

export namespace ShipCodeQueries {
  export async function getByShip(shipId: string) {
    const rows = await query<(ShipCode)[]>('SELECT * FROM ship_code WHERE ship_id = ?', [shipId]);
    return rows[0] ?? null;
  }

  export async function insert(code: ShipCode) {
    return execute(
      'INSERT INTO ship_code (id, ship_id, articles, plunder_split, captain_share, quartermaster_share, common_share, injury_compensation, rules, created_tick, amended_tick) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [code.id, code.ship_id, code.articles, code.plunder_split, code.captain_share, code.quartermaster_share, code.common_share, code.injury_compensation, code.rules, code.created_tick, code.amended_tick]
    );
  }

  export async function updateAmended(shipId: string, articles: string, rules: string, tick: number) {
    return execute('UPDATE ship_code SET articles = ?, rules = ?, amended_tick = ? WHERE ship_id = ?', [articles, rules, tick, shipId]);
  }
}

// ============================================================
// Haven Investments
// ============================================================

export namespace HavenInvestmentQueries {
  export async function getById(id: string) {
    const rows = await query<(HavenInvestment)[]>('SELECT * FROM haven_investments WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  export async function getByAgent(agentId: string) {
    return query<(HavenInvestment)[]>('SELECT * FROM haven_investments WHERE agent_id = ?', [agentId]);
  }

  export async function getByPort(portId: string) {
    return query<(HavenInvestment)[]>('SELECT * FROM haven_investments WHERE port_id = ?', [portId]);
  }

  export async function getAll() {
    return query<(HavenInvestment)[]>('SELECT * FROM haven_investments');
  }

  export async function insert(investment: HavenInvestment) {
    return execute(
      'INSERT INTO haven_investments (id, agent_id, port_id, type, level, investment_total, income_per_tick) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [investment.id, investment.agent_id, investment.port_id, investment.type, investment.level, investment.investment_total, investment.income_per_tick]
    );
  }

  export async function updateLevel(id: string, level: number, investmentTotal: number, incomePerTick: number) {
    return execute('UPDATE haven_investments SET level = ?, investment_total = ?, income_per_tick = ? WHERE id = ?', [level, investmentTotal, incomePerTick, id]);
  }
}

// ============================================================
// Relationships
// ============================================================

export namespace RelationshipQueries {
  export async function getByAgent(agentId: string) {
    return query<(AgentRelationship)[]>(
      'SELECT * FROM agent_relationships WHERE agent_id = ?', [agentId]
    );
  }

  export async function getByPair(agentId: string, targetAgentId: string) {
    const rows = await query<(AgentRelationship)[]>(
      'SELECT * FROM agent_relationships WHERE agent_id = ? AND target_agent_id = ?', [agentId, targetAgentId]
    );
    return rows[0] ?? null;
  }

  export async function upsert(rel: AgentRelationship) {
    return execute(
      'INSERT INTO agent_relationships (id, agent_id, target_agent_id, fondness, trust, respect, fear, rivalry, familiarity, last_interaction_tick, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(agent_id, target_agent_id) DO UPDATE SET fondness = ?, trust = ?, respect = ?, fear = ?, rivalry = ?, familiarity = ?, last_interaction_tick = ?, notes = ?',
      [rel.id, rel.agent_id, rel.target_agent_id, rel.fondness, rel.trust, rel.respect, rel.fear, rel.rivalry, rel.familiarity, rel.last_interaction_tick, rel.notes, rel.fondness, rel.trust, rel.respect, rel.fear, rel.rivalry, rel.familiarity, rel.last_interaction_tick, rel.notes]
    );
  }

  export async function getStrongest(agentId: string, limit: number) {
    return query<(AgentRelationship)[]>(
      'SELECT * FROM agent_relationships WHERE agent_id = ? ORDER BY familiarity DESC LIMIT ?', [agentId, limit]
    );
  }

  export async function getRivals(agentId: string) {
    return query<(AgentRelationship)[]>(
      'SELECT * FROM agent_relationships WHERE agent_id = ? AND rivalry > 50 ORDER BY rivalry DESC', [agentId]
    );
  }

  export async function getAllies(agentId: string) {
    return query<(AgentRelationship)[]>(
      'SELECT * FROM agent_relationships WHERE agent_id = ? AND fondness > 60 AND trust > 50 ORDER BY fondness DESC', [agentId]
    );
  }
}

// ============================================================
// Ports
// ============================================================

export namespace PortQueries {
  export async function getById(id: string) {
    const rows = await query<(Port)[]>('SELECT * FROM ports WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  export async function getAll() {
    return query<(Port)[]>('SELECT * FROM ports');
  }

  export async function getByZone(seaZoneId: string) {
    return query<(Port)[]>('SELECT * FROM ports WHERE sea_zone_id = ?', [seaZoneId]);
  }
}

// ============================================================
// Weather
// ============================================================

export const WeatherQueries = {
  async upsert(seaZoneId: string, condition: string, windSpeed: number, windDirection: number, visibility: number, stormIntensity: number, temperature: number, tick: number): Promise<void> {
    await execute(
      `UPDATE weather SET "condition" = ?, wind_speed = ?, wind_direction = ?, visibility = ?, storm_intensity = ?, temperature = ?, tick = ? WHERE sea_zone_id = ?`,
      [condition, windSpeed, windDirection, visibility, stormIntensity, temperature, tick, seaZoneId]
    );
  }
};

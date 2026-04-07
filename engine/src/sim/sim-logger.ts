/**
 * Simulation Logger — comprehensive JSONL file-based logging.
 *
 * Every event, every decision, every state change is logged to separate
 * JSONL files per category. This gives full replay/audit capability.
 *
 * Ported from RAVE LIFE sim-logger.ts pattern:
 *   - One JSONL file per log category
 *   - Per-tick counter accumulation
 *   - World snapshot capture (all DB tables)
 *   - Console output controlled by log level
 *
 * Categories (one file each):
 *   tick-summary, agent-states, economy, agent-decisions, weather,
 *   combat, navigation, crew-events, cargo-trade, intel, law,
 *   reputation, world-snapshot, havens, fences, wounds-disease,
 *   ship-events, port-events, bounties, pardons, plans, memories,
 *   world-events, deaths, errors
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Types ──────────────────────────────────────────────────

type LogLevel = 'silent' | 'errors' | 'events' | 'verbose' | 'debug';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  silent: 0,
  errors: 1,
  events: 2,
  verbose: 3,
  debug: 4,
};

export const LOG_CATEGORIES = [
  'tick-summary',
  'agent-states',
  'economy',
  'agent-decisions',
  'weather',
  'combat',
  'navigation',
  'crew-events',
  'cargo-trade',
  'intel',
  'law',
  'reputation',
  'world-snapshot',
  'havens',
  'fences',
  'wounds-disease',
  'ship-events',
  'port-events',
  'bounties',
  'pardons',
  'plans',
  'memories',
  'world-events',
  'deaths',
  'errors',
] as const;

export type LogCategory = typeof LOG_CATEGORIES[number];

export interface SimLogEntry {
  tick: number;
  gameTime: string;
  ts: string;
  category: LogCategory;
  data: Record<string, unknown>;
}

/** Per-tick counters — accumulated during tick, logged at tick end, then reset. */
export interface TickSummary {
  tick: number;
  gameTime: string;

  // Agent decisions
  totalDecisions: number;
  llmDecisions: number;
  shortCircuitDecisions: number;
  ruleBasedDecisions: number;
  failedDecisions: number;

  // Decision breakdown by action
  decisionsByAction: Record<string, number>;
  decisionsByAgentType: Record<string, number>;

  // Combat
  combatsInitiated: number;
  broadsidesFired: number;
  boardingActions: number;
  shipsCaptured: number;
  shipsSunk: number;
  surrenders: number;
  escapes: number;

  // Navigation
  voyagesStarted: number;
  voyagesCompleted: number;
  shipsLost: number;
  hazardsEncountered: number;

  // Crew
  crewRecruited: number;
  crewDeserted: number;
  crewDied: number;
  mutiniesAttempted: number;
  mutiniesSucceeded: number;
  grievancesLogged: number;
  sharesDistributed: number;

  // Economy
  cargoTraded: number;
  cargoBought: number;
  cargoSold: number;
  plunderSold: number;
  totalTradeValue: number;
  fenceTransactions: number;
  fenceTotalValue: number;
  marketPriceChanges: number;

  // Havens
  havenInvestments: number;
  havenIncome: number;

  // Law
  casesOpened: number;
  warrantsIssued: number;
  arrests: number;
  trials: number;
  convictions: number;
  acquittals: number;
  pardonsGranted: number;
  pardonsAccepted: number;
  bountiesPosted: number;
  bountiesClaimed: number;

  // Intel
  intelGenerated: number;
  intelSold: number;
  intelExpired: number;
  rumorsPlanted: number;

  // Health
  woundsInflicted: number;
  woundsTreated: number;
  diseasesContracted: number;
  deathsFromDisease: number;
  deathsFromCombat: number;
  deathsFromExecution: number;

  // Ships
  shipsRepaired: number;
  shipsCareened: number;
  shipsUpgraded: number;
  shipsBuilt: number;

  // Reputation
  reputationChanges: number;
  infamyChanges: number;

  // Memories
  memoriesCreated: number;
  memoriesPruned: number;

  // Plans
  plansCreated: number;
  plansCompleted: number;
  plansAbandoned: number;

  // Weather
  stormsActive: number;
  hurricanesActive: number;
  regionsCalm: number;
  regionsBecalmed: number;

  // World events
  worldEventsGenerated: number;

  // Deaths
  agentsDied: number;
  agentsFled: number;

  // Performance
  tickDurationMs: number;
  llmCallCount: number;
  llmTotalLatencyMs: number;
  llmAvgLatencyMs: number;
  ticksSkippedTotal: number;
}

// ── Logger ─────────────────────────────────────────────────

const OUTPUT_DIR = './sim-output';

export class SimLogger {
  private fds = new Map<string, number>();
  private level: LogLevel;
  private _tick = 0;
  private _gameTime = '';
  private _initialized = false;

  /** Per-tick counters — call increment methods during tick, flush at end. */
  public counters: TickSummary = this.freshCounters();

  constructor(level: LogLevel = 'events') {
    this.level = level;
  }

  // ── Lifecycle ──────────────────────────────────────────

  init(resume = false): void {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const mode = resume ? 'a' : 'w';
    for (const cat of LOG_CATEGORIES) {
      const filepath = path.join(OUTPUT_DIR, `${cat}.jsonl`);
      const fd = fs.openSync(filepath, mode);
      this.fds.set(cat, fd);
    }

    this._initialized = true;
    this.info('SimLogger initialized', { categories: LOG_CATEGORIES.length, mode });
  }

  close(): void {
    for (const fd of this.fds.values()) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
    this.fds.clear();
    this._initialized = false;
  }

  setTick(tick: number, gameTime: string): void {
    this._tick = tick;
    this._gameTime = gameTime;
  }

  // ── Core log ───────────────────────────────────────────

  log(category: LogCategory, data: Record<string, unknown>): void {
    const entry: SimLogEntry = {
      tick: this._tick,
      gameTime: this._gameTime,
      ts: new Date().toISOString(),
      category,
      data,
    };

    // Write to JSONL file
    const fd = this.fds.get(category);
    if (fd !== undefined) {
      try {
        fs.writeSync(fd, JSON.stringify(entry) + '\n');
      } catch (err) {
        // Don't crash sim on write error
        console.error(`[LOG ERROR] ${category}: ${(err as Error).message}`);
      }
    }
  }

  // ── Console output (level-gated) ───────────────────────

  error(message: string, data?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[this.level] >= LEVEL_PRIORITY.errors) {
      console.error(`[ERROR] ${message}`);
    }
    this.log('errors', { message, ...data });
  }

  info(message: string, data?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[this.level] >= LEVEL_PRIORITY.events) {
      console.log(`[INFO] ${message}`);
    }
  }

  event(type: string, message: string, data?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[this.level] >= LEVEL_PRIORITY.events) {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  verbose(message: string, data?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[this.level] >= LEVEL_PRIORITY.verbose) {
      console.log(`[VERBOSE] ${message}`);
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[this.level] >= LEVEL_PRIORITY.debug) {
      console.log(`[DEBUG] ${message}`);
    }
  }

  // ── Tick counter management ────────────────────────────

  resetCounters(): void {
    this.counters = this.freshCounters();
  }

  flushTickSummary(): void {
    this.counters.tick = this._tick;
    this.counters.gameTime = this._gameTime;
    if (this.counters.llmCallCount > 0) {
      this.counters.llmAvgLatencyMs = this.counters.llmTotalLatencyMs / this.counters.llmCallCount;
    }
    this.log('tick-summary', this.counters as unknown as Record<string, unknown>);
    this.resetCounters();
  }

  private freshCounters(): TickSummary {
    return {
      tick: 0, gameTime: '',
      totalDecisions: 0, llmDecisions: 0, shortCircuitDecisions: 0,
      ruleBasedDecisions: 0, failedDecisions: 0,
      decisionsByAction: {}, decisionsByAgentType: {},
      combatsInitiated: 0, broadsidesFired: 0, boardingActions: 0,
      shipsCaptured: 0, shipsSunk: 0, surrenders: 0, escapes: 0,
      voyagesStarted: 0, voyagesCompleted: 0, shipsLost: 0, hazardsEncountered: 0,
      crewRecruited: 0, crewDeserted: 0, crewDied: 0,
      mutiniesAttempted: 0, mutiniesSucceeded: 0,
      grievancesLogged: 0, sharesDistributed: 0,
      cargoTraded: 0, cargoBought: 0, cargoSold: 0, plunderSold: 0,
      totalTradeValue: 0, fenceTransactions: 0, fenceTotalValue: 0,
      marketPriceChanges: 0,
      havenInvestments: 0, havenIncome: 0,
      casesOpened: 0, warrantsIssued: 0, arrests: 0, trials: 0,
      convictions: 0, acquittals: 0, pardonsGranted: 0, pardonsAccepted: 0,
      bountiesPosted: 0, bountiesClaimed: 0,
      intelGenerated: 0, intelSold: 0, intelExpired: 0, rumorsPlanted: 0,
      woundsInflicted: 0, woundsTreated: 0, diseasesContracted: 0,
      deathsFromDisease: 0, deathsFromCombat: 0, deathsFromExecution: 0,
      shipsRepaired: 0, shipsCareened: 0, shipsUpgraded: 0, shipsBuilt: 0,
      reputationChanges: 0, infamyChanges: 0,
      memoriesCreated: 0, memoriesPruned: 0,
      plansCreated: 0, plansCompleted: 0, plansAbandoned: 0,
      stormsActive: 0, hurricanesActive: 0, regionsCalm: 0, regionsBecalmed: 0,
      worldEventsGenerated: 0,
      agentsDied: 0, agentsFled: 0,
      tickDurationMs: 0, llmCallCount: 0, llmTotalLatencyMs: 0, llmAvgLatencyMs: 0,
      ticksSkippedTotal: 0,
    };
  }

  // ════════════════════════════════════════════════════════
  // DOMAIN-SPECIFIC LOGGING METHODS
  // Each logs the full event data to its category JSONL file
  // AND increments the relevant tick counters.
  // ════════════════════════════════════════════════════════

  // ── Agent decisions ────────────────────────────────────

  logDecision(data: {
    agentId: string;
    agentName: string;
    agentType: string;
    action: string;
    params: Record<string, unknown>;
    reasoning: string;
    source: 'llm' | 'short_circuit' | 'rule_based';
    promptTokens?: number;
    completionTokens?: number;
    latencyMs?: number;
    validActions: string[];
    proprioception?: string;
    nudges?: string;
    rawResponse?: string;
    memoryContext?: string[];
    cooldownTicks: number;
    nextActionTick: number;
    portId: string;
    seaZoneId: string;
    shipId?: string;
    status: string;
  }): void {
    this.counters.totalDecisions++;
    this.counters.decisionsByAction[data.action] = (this.counters.decisionsByAction[data.action] ?? 0) + 1;
    this.counters.decisionsByAgentType[data.agentType] = (this.counters.decisionsByAgentType[data.agentType] ?? 0) + 1;

    if (data.source === 'llm') {
      this.counters.llmDecisions++;
      this.counters.llmCallCount++;
      if (data.latencyMs) this.counters.llmTotalLatencyMs += data.latencyMs;
    } else if (data.source === 'short_circuit') {
      this.counters.shortCircuitDecisions++;
    } else {
      this.counters.ruleBasedDecisions++;
    }

    this.log('agent-decisions', data);
  }

  // ── Agent state snapshots ──────────────────────────────

  logAgentStates(agents: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    portId: string;
    seaZoneId: string;
    shipId?: string;
    cash?: number;
    infamy?: number;
    crewCount?: number;
    crewLoyaltyAvg?: number;
    shipHull?: number;
    shipClass?: string;
    cargoValue?: number;
    cargoHeatAvg?: number;
    bountyTotal?: number;
    evidenceAgainst?: number;
    woundCount?: number;
    reputationByRegion?: Record<string, number>;
    memories?: number;
    lastAction?: string;
    nextActionTick?: number;
    cooldownReason?: string;
    totalDecisions?: number;
    persona?: {
      strategyHint: string;
      ambitions: string[];
      traits: Record<string, number>;
    };
  }>): void {
    this.log('agent-states', { agents });
  }

  // ── Combat ─────────────────────────────────────────────

  logCombat(data: {
    type: 'broadside' | 'boarding' | 'pursuit' | 'ambush';
    attackerId: string;
    attackerName: string;
    attackerShip: string;
    defenderId: string;
    defenderName: string;
    defenderShip: string;
    seaZoneId: string;
    weather: string;
    seaState: string;
    attackerGuns: number;
    defenderGuns: number;
    attackerCrew: number;
    defenderCrew: number;
    outcome: 'attacker_wins' | 'defender_wins' | 'draw' | 'escape' | 'surrender';
    attackerDamage: { hull: number; sails: number; crew: number };
    defenderDamage: { hull: number; sails: number; crew: number };
    cargoSeized: boolean;
    shipCaptured: boolean;
    cargoManifest?: Array<{ type: string; quantity: number; heat: number }>;
    durationTicks: number;
  }): void {
    this.counters.combatsInitiated++;
    if (data.type === 'broadside') this.counters.broadsidesFired++;
    if (data.type === 'boarding') this.counters.boardingActions++;
    if (data.shipCaptured) this.counters.shipsCaptured++;
    if (data.outcome === 'escape') this.counters.escapes++;
    if (data.outcome === 'surrender') this.counters.surrenders++;
    this.log('combat', data);
  }

  // ── Navigation ─────────────────────────────────────────

  logNavigation(data: {
    type: 'departure' | 'arrival' | 'hazard' | 'encounter' | 'lost';
    agentId: string;
    agentName: string;
    shipId: string;
    shipName: string;
    fromPort?: string;
    toPort?: string;
    fromRegion: string;
    toRegion?: string;
    distanceNm?: number;
    estimatedTicks?: number;
    weather: string;
    seaState: string;
    hazardType?: string;
    hazardDamage?: { hull: number; sails: number; crewLost: number };
    encounterType?: string;
    encounterShipId?: string;
  }): void {
    if (data.type === 'departure') this.counters.voyagesStarted++;
    if (data.type === 'arrival') this.counters.voyagesCompleted++;
    if (data.type === 'lost') this.counters.shipsLost++;
    if (data.type === 'hazard') this.counters.hazardsEncountered++;
    this.log('navigation', data);
  }

  // ── Crew events ────────────────────────────────────────

  logCrewEvent(data: {
    type: 'recruited' | 'deserted' | 'died' | 'mutiny_attempt' | 'mutiny_success'
      | 'grievance' | 'shares_distributed' | 'promoted' | 'demoted' | 'marooned'
      | 'loyalty_change' | 'fight' | 'gambling';
    agentId?: string;
    agentName?: string;
    shipId: string;
    shipName: string;
    captainId: string;
    captainName: string;
    crewMemberId?: string;
    crewMemberName?: string;
    role?: string;
    loyalty?: number;
    loyaltyChange?: number;
    grievance?: string;
    details?: Record<string, unknown>;
  }): void {
    if (data.type === 'recruited') this.counters.crewRecruited++;
    if (data.type === 'deserted') this.counters.crewDeserted++;
    if (data.type === 'died') this.counters.crewDied++;
    if (data.type === 'mutiny_attempt') this.counters.mutiniesAttempted++;
    if (data.type === 'mutiny_success') this.counters.mutiniesSucceeded++;
    if (data.type === 'grievance') this.counters.grievancesLogged++;
    if (data.type === 'shares_distributed') this.counters.sharesDistributed++;
    this.log('crew-events', data);
  }

  // ── Cargo & trade ──────────────────────────────────────

  logCargoTrade(data: {
    type: 'buy' | 'sell' | 'plunder_sold' | 'seized' | 'lost' | 'transferred';
    agentId: string;
    agentName: string;
    portId?: string;
    portName?: string;
    cargoType: string;
    quantity: number;
    pricePerUnit: number;
    totalValue: number;
    heat?: number;
    fenceId?: string;
    fenceTier?: number;
    fenceCut?: number;
    buyerAgentId?: string;
    buyerAgentName?: string;
    marketSupplyBefore?: number;
    marketSupplyAfter?: number;
    marketDemandBefore?: number;
    marketDemandAfter?: number;
  }): void {
    if (data.type === 'buy') { this.counters.cargoBought++; this.counters.cargoTraded++; }
    if (data.type === 'sell') { this.counters.cargoSold++; this.counters.cargoTraded++; }
    if (data.type === 'plunder_sold') { this.counters.plunderSold++; this.counters.fenceTransactions++; this.counters.fenceTotalValue += data.totalValue; }
    this.counters.totalTradeValue += data.totalValue;
    this.log('cargo-trade', data);
  }

  // ── Intel ──────────────────────────────────────────────

  logIntel(data: {
    type: 'generated' | 'sold' | 'expired' | 'propagated' | 'rumor_planted';
    intelId?: string;
    sourceAgentId: string;
    sourceAgentName: string;
    subjectAgentId?: string;
    subjectShipId?: string;
    intelType: string;
    content: string;
    accuracy: number;
    freshness: number;
    portId: string;
    price?: number;
    buyerAgentId?: string;
  }): void {
    if (data.type === 'generated') this.counters.intelGenerated++;
    if (data.type === 'sold') this.counters.intelSold++;
    if (data.type === 'expired') this.counters.intelExpired++;
    if (data.type === 'rumor_planted') this.counters.rumorsPlanted++;
    this.log('intel', data);
  }

  // ── Law ────────────────────────────────────────────────

  logLawEvent(data: {
    type: 'case_opened' | 'warrant_issued' | 'arrest' | 'trial_start'
      | 'conviction' | 'acquittal' | 'case_dismissed' | 'evidence_added'
      | 'evidence_decayed' | 'pursuit_started' | 'pursuit_lost';
    targetAgentId: string;
    targetAgentName: string;
    investigatorId?: string;
    investigatorName?: string;
    caseId?: string;
    evidenceLevel?: number;
    evidenceAdded?: number;
    charges?: string[];
    witnesses?: string[];
    sentence?: string;
    details?: Record<string, unknown>;
  }): void {
    if (data.type === 'case_opened') this.counters.casesOpened++;
    if (data.type === 'warrant_issued') this.counters.warrantsIssued++;
    if (data.type === 'arrest') this.counters.arrests++;
    if (data.type === 'trial_start') this.counters.trials++;
    if (data.type === 'conviction') this.counters.convictions++;
    if (data.type === 'acquittal') this.counters.acquittals++;
    this.log('law', data);
  }

  // ── Bounties ───────────────────────────────────────────

  logBounty(data: {
    type: 'posted' | 'claimed' | 'expired' | 'withdrawn';
    bountyId: string;
    targetAgentId: string;
    targetAgentName: string;
    postedByAgentId?: string;
    postedByNation?: string;
    amount: number;
    reason?: string;
    claimedByAgentId?: string;
  }): void {
    if (data.type === 'posted') this.counters.bountiesPosted++;
    if (data.type === 'claimed') this.counters.bountiesClaimed++;
    this.log('bounties', data);
  }

  // ── Pardons ────────────────────────────────────────────

  logPardon(data: {
    type: 'offered' | 'accepted' | 'rejected' | 'violated';
    agentId: string;
    agentName: string;
    portId: string;
    nation: string;
    infamyBefore: number;
    infamyAfter?: number;
    evidenceCleared?: number;
    conditions?: string[];
  }): void {
    if (data.type === 'offered') this.counters.pardonsGranted++;
    if (data.type === 'accepted') this.counters.pardonsAccepted++;
    this.log('pardons', data);
  }

  // ── Reputation ─────────────────────────────────────────

  logReputation(data: {
    agentId: string;
    agentName: string;
    seaZoneId: string;
    reputationBefore: number;
    reputationAfter: number;
    infamyBefore: number;
    infamyAfter: number;
    honorBefore: number;
    honorAfter: number;
    cause: string;
  }): void {
    this.counters.reputationChanges++;
    if (data.infamyBefore !== data.infamyAfter) this.counters.infamyChanges++;
    this.log('reputation', data);
  }

  // ── Wounds & disease ───────────────────────────────────

  logWoundDisease(data: {
    type: 'wound_inflicted' | 'wound_treated' | 'disease_contracted'
      | 'disease_progressed' | 'healed' | 'death';
    agentId: string;
    agentName: string;
    woundType?: string;
    diseaseType?: string;
    severity?: number;
    location?: string;
    treated?: boolean;
    cause?: string;
  }): void {
    if (data.type === 'wound_inflicted') this.counters.woundsInflicted++;
    if (data.type === 'wound_treated') this.counters.woundsTreated++;
    if (data.type === 'disease_contracted') this.counters.diseasesContracted++;
    if (data.type === 'death' && data.diseaseType) this.counters.deathsFromDisease++;
    if (data.type === 'death' && data.woundType) this.counters.deathsFromCombat++;
    this.log('wounds-disease', data);
  }

  // ── Ship events ────────────────────────────────────────

  logShipEvent(data: {
    type: 'repaired' | 'careened' | 'upgraded' | 'built' | 'sunk' | 'captured'
      | 'abandoned' | 'renamed' | 'condition_change';
    shipId: string;
    shipName: string;
    shipClass: string;
    captainId?: string;
    captainName?: string;
    portId?: string;
    hullBefore?: number;
    hullAfter?: number;
    sailsBefore?: number;
    sailsAfter?: number;
    barnaclesBefore?: number;
    barnaclesAfter?: number;
    cost?: number;
    details?: Record<string, unknown>;
  }): void {
    if (data.type === 'repaired') this.counters.shipsRepaired++;
    if (data.type === 'careened') this.counters.shipsCareened++;
    if (data.type === 'upgraded') this.counters.shipsUpgraded++;
    if (data.type === 'built') this.counters.shipsBuilt++;
    if (data.type === 'sunk') this.counters.shipsSunk++;
    this.log('ship-events', data);
  }

  // ── Port events ────────────────────────────────────────

  logPortEvent(data: {
    type: 'arrival' | 'departure' | 'inspection' | 'bribe' | 'denied_entry'
      | 'tariff_change' | 'fortification' | 'governor_action';
    portId: string;
    portName: string;
    agentId?: string;
    agentName?: string;
    details?: Record<string, unknown>;
  }): void {
    this.log('port-events', data);
  }

  // ── Haven investments ──────────────────────────────────

  logHaven(data: {
    type: 'invested' | 'income' | 'upgraded' | 'raided' | 'destroyed';
    agentId: string;
    agentName: string;
    portId: string;
    havenType: string;
    level?: number;
    amount: number;
    details?: Record<string, unknown>;
  }): void {
    if (data.type === 'invested') this.counters.havenInvestments++;
    if (data.type === 'income') this.counters.havenIncome += data.amount;
    this.log('havens', data);
  }

  // ── Fence network ──────────────────────────────────────

  logFence(data: {
    type: 'transaction' | 'trust_change' | 'tier_up' | 'tier_down' | 'new_contact';
    fenceId: string;
    fenceAgentId: string;
    fenceAgentName: string;
    portId: string;
    tier: number;
    trust: number;
    trustChange?: number;
    cargoType?: string;
    quantity?: number;
    value?: number;
    cut?: number;
    details?: Record<string, unknown>;
  }): void {
    if (data.type === 'transaction') { this.counters.fenceTransactions++; this.counters.fenceTotalValue += (data.value ?? 0); }
    this.log('fences', data);
  }

  // ── Plans ──────────────────────────────────────────────

  logPlan(data: {
    type: 'created' | 'step_completed' | 'completed' | 'abandoned' | 'expired';
    agentId: string;
    agentName: string;
    planGoal: string;
    stepsTotal: number;
    stepsCompleted: number;
    nextStep?: string;
    reason?: string;
  }): void {
    if (data.type === 'created') this.counters.plansCreated++;
    if (data.type === 'completed') this.counters.plansCompleted++;
    if (data.type === 'abandoned') this.counters.plansAbandoned++;
    this.log('plans', data);
  }

  // ── Memories ───────────────────────────────────────────

  logMemory(data: {
    type: 'created' | 'pruned' | 'accessed';
    agentId: string;
    agentName: string;
    memoryType: string;
    content?: string;
    importance?: number;
    isTraumatic?: boolean;
    totalMemories?: number;
  }): void {
    if (data.type === 'created') this.counters.memoriesCreated++;
    if (data.type === 'pruned') this.counters.memoriesPruned++;
    this.log('memories', data);
  }

  // ── Weather ────────────────────────────────────────────

  logWeather(data: {
    regions: Array<{
      seaZoneId: string;
      condition: string;
      windSpeed: number;
      windDirection: number;
      visibility: number;
      stormIntensity: number;
      seaState: string;
      waveHeight: number;
    }>;
  }): void {
    let storms = 0, hurricanes = 0, calm = 0, becalmed = 0;
    for (const r of data.regions) {
      if (r.condition === 'storm') storms++;
      if (r.condition === 'hurricane') hurricanes++;
      if (r.condition === 'clear') calm++;
      if (r.condition === 'becalmed') becalmed++;
    }
    this.counters.stormsActive = storms;
    this.counters.hurricanesActive = hurricanes;
    this.counters.regionsCalm = calm;
    this.counters.regionsBecalmed = becalmed;
    this.log('weather', data);
  }

  // ── Economy snapshot ───────────────────────────────────

  logEconomy(data: {
    ports: Array<{
      portId: string;
      portName: string;
      prices: Array<{
        cargoType: string;
        buyPrice: number;
        sellPrice: number;
        supply: number;
        demand: number;
      }>;
      shipsInPort: number;
      agentsInPort: number;
      prosperity: number;
      corruption: number;
    }>;
    totalTradeVolumeThisTick: number;
  }): void {
    this.log('economy', data);
  }

  // ── Deaths ─────────────────────────────────────────────

  logDeath(data: {
    agentId: string;
    agentName: string;
    agentType: string;
    cause: 'combat' | 'disease' | 'execution' | 'mutiny' | 'storm' | 'starvation' | 'old_age';
    location: string;
    seaZoneId: string;
    details?: Record<string, unknown>;
    totalDecisionsMade?: number;
    cashAtDeath?: number;
    infamyAtDeath?: number;
  }): void {
    this.counters.agentsDied++;
    if (data.cause === 'combat') this.counters.deathsFromCombat++;
    if (data.cause === 'disease') this.counters.deathsFromDisease++;
    if (data.cause === 'execution') this.counters.deathsFromExecution++;
    this.log('deaths', data);
  }

  // ── World events ───────────────────────────────────────

  logWorldEvent(data: {
    eventId: string;
    type: string;
    description: string;
    agentIds: string[];
    shipIds: string[];
    portId?: string;
    seaZoneId?: string;
    severity: number;
    cascadeEffects?: string[];
  }): void {
    this.counters.worldEventsGenerated++;
    this.log('world-events', data);
  }

  // ── World snapshot (all tables) ────────────────────────

  logWorldSnapshot(data: {
    agents: Record<string, unknown>[];
    ships: Record<string, unknown>[];
    crew: Record<string, unknown>[];
    cargo: Record<string, unknown>[];
    ports: Record<string, unknown>[];
    marketPrices: Record<string, unknown>[];
    fences: Record<string, unknown>[];
    havens: Record<string, unknown>[];
    navyCases: Record<string, unknown>[];
    bounties: Record<string, unknown>[];
    intel: Record<string, unknown>[];
    shipCodes: Record<string, unknown>[];
    skills: Record<string, unknown>[];
    reputation: Record<string, unknown>[];
    wounds: Record<string, unknown>[];
    weather: Record<string, unknown>[];
    worldEvents: Record<string, unknown>[];
    memories: { totalCount: number; byAgent: Record<string, number> };
    tickCounterTotals: TickSummary;
  }): void {
    this.log('world-snapshot', data);
  }
}

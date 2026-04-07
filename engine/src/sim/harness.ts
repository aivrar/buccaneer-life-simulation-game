/**
 * Simulation Harness — hybrid tick/event model with fast-forward.
 *
 * Architecture (ported from RAVE LIFE harness-realistic.ts):
 *   - World simulation stays tick-based (handlers fire every SLOW_TICK_INTERVAL)
 *   - Agent actions are event-scheduled with cooldowns
 *   - LLM calls batched via Promise.all for max GPU utilization
 *   - Fast-forward when all agents are cooling down (skip empty ticks)
 *   - Short-circuit bypasses LLM for deterministic situations
 *
 * One tick = 1 game hour. Slow ticks fire every 6 ticks (6 game hours).
 */

import { TickScheduler } from '../runtime/tick-scheduler.js';
import { LLMClient } from '../runtime/llm-client.js';
import { MemoryStore } from '../runtime/memory-store.js';
import { getAllHandlers } from '../handlers/index.js';
import { bootstrapRegistry } from '../agents/registry.js';
import { createInitialGameTime } from '../world/time.js';
import { SimLogger } from './sim-logger.js';
import { SimMetrics } from './metrics.js';
import { getWeatherState, getSeaStateMap } from '../handlers/weather-tick.js';
import { makePlayerDecision, type PlayerDecision } from './player-ai.js';
import { filterActionsForAgent } from '../strategy/action-filter.js';
import { parseAgentResponse } from '../strategy/response-parser.js';
import { autoFillParams } from '../strategy/auto-fill-params.js';
import { buildNarrativePrompt } from '../strategy/narrative-prompt.js';
import { buildCognitivePrompt, buildCognitiveSystemPrompt } from '../strategy/cognitive-prompt.js';
import { buildMemoryNarrative, pushMemory } from '../strategy/agent-memory.js';
import { getHistoricalSystemPrompt } from '../agents/historical-figures.js';
import { fillSystemPrompt } from '../strategy/hybrid.js';
import { AGENT_TYPE_CONFIGS } from '../config/agents.js';
import { executeAction } from '../engine/action-executor.js';
import { getEngagementForAgent, getActiveEngagements, type CombatEngagement } from '../engine/combat-engagement.js';
import { combatTickHandler } from '../handlers/combat-tick.js';
import { getShipsInZone } from '../handlers/travel-tick.js';
import { ShipQueries, AgentQueries, CrewQueries } from '../db/queries.js';
import { saveCheckpoint, getLatestCheckpoint } from './checkpoint.js';
import * as fs from 'fs';
import type { ShipClassName } from '../db/models.js';
import type { AgentState, WorldState, TickContext, GameTime } from '../runtime/types.js';
import { AgentStatus, Season } from '../runtime/types.js';

// ── Constants ──────────────────────────────────────────────

const TICKS_PER_HOUR = 1;
const TICKS_PER_DAY = 24;
const SLOW_TICK_INTERVAL = 6;  // World sim fires every 6 ticks (6 hours)

/** Cooldown ranges per action type [minTicks, maxTicks] (in game-hours) */
const COOLDOWNS: Record<string, [number, number]> = {
  sail_to:          [6, 24],    // Travel takes hours to days
  attack_ship:      [2, 6],
  board_ship:       [1, 3],
  trade_cargo:      [2, 4],
  sell_plunder:     [2, 6],
  recruit_crew:     [3, 8],
  careen_ship:      [12, 48],   // Careening takes days
  visit_tavern:     [2, 6],
  buy_provisions:   [1, 3],
  negotiate:        [1, 4],
  flee:             [1, 2],
  lay_low:          [6, 24],
  invest_haven:     [4, 12],
  accept_pardon:    [6, 12],
  patrol_region:    [4, 12],
  pursue_target:    [2, 8],
  engage_ship:      [1, 3],
  arrest:           [2, 6],
  build_case:       [4, 12],
  gather_intel:     [2, 6],
  sell_intel:       [1, 4],
  repair_ship:      [6, 24],
  do_nothing:       [2, 8],
  // Crew actions
  work:             [3, 8],
  grumble:          [2, 6],
  support_captain:  [2, 6],
  challenge_captain:[4, 12],
  desert:           [1, 1],     // One-time action
  steal:            [4, 12],
  fight:            [2, 6],
  gamble:           [2, 6],
  drink:            [2, 6],
  join_crew:        [6, 12],
  // Quartermaster
  distribute_shares:[6, 24],
  settle_dispute:   [3, 8],
  advise_captain:   [3, 8],
  call_vote:        [12, 48],
  manage_provisions:[4, 12],
  discipline_crew:  [4, 12],
  // Medical
  treat_wound:      [3, 8],
  treat_disease:    [3, 8],
  amputate:         [6, 12],
  prescribe_remedy: [2, 6],
  // Governor
  host_trial:       [12, 48],
  grant_pardon:     [12, 48],
  issue_letter_of_marque: [12, 48],
  increase_patrols: [6, 24],
  lower_tariffs:    [12, 48],
  raise_tariffs:    [12, 48],
  post_bounty:      [6, 24],
  fortify_port:     [12, 48],
  // Fence
  buy_stolen_goods: [2, 6],
  sell_goods:       [2, 6],
  establish_contact:[4, 12],
  set_prices:       [6, 24],
  refuse_deal:      [2, 6],
  // Tavern
  serve_drinks:     [2, 6],
  broker_deal:      [3, 8],
  recruit_for:      [3, 8],
  shelter_fugitive: [6, 24],
  report_to_authorities: [4, 12],
  // Harbor
  inspect_ship:     [3, 8],
  collect_fees:     [4, 12],
  deny_entry:       [3, 8],
  issue_clearance:  [2, 6],
  report_suspicious:[4, 12],
  // Shipwright
  upgrade_ship:     [12, 48],
  assess_damage:    [2, 6],
  build_vessel:     [48, 96],   // Takes days
  // Commerce
  hire_shipping:    [6, 24],
  sell_crop:        [4, 12],
  hire_guards:      [6, 24],
  hire_escort:      [6, 24],
  invest:           [6, 24],
  // Social
  spread_rumor:     [3, 8],
  plant_rumor:      [3, 8],
  eavesdrop:        [2, 6],
  report_piracy:    [4, 12],
  report_to_governor:[4, 12],
  report_to_admiralty:[4, 12],
  // Naval
  escort_convoy:    [6, 24],
  track_target:     [4, 12],
  claim_bounty:     [4, 12],
  // Pardon
  negotiate_pardon: [6, 24],
  // Additional cooldowns
  buy_cargo:        [2, 4],
  sell_cargo:       [2, 4],
  buy_vessel:       [24, 48],  // Takes a day+ to arrange purchase
  claim_prize:      [12, 24],  // Refit and crew the prize ship
  surrender:        [1, 1],
  accept_bribe:     [12, 24],
  bribe_official:   [3, 8],
  bribe_governor:   [4, 12],
  betray_source:    [2, 6],
};

/** Batch alignment window — snap cooldowns so LLM calls cluster together */
const BATCH_WINDOW_TICKS = 3;  // 3 game-hours

// ── Types ──────────────────────────────────────────────────

interface ActionRecord {
  action: string;
  result: string;
  wasStub: boolean;
  failed: boolean;
}

interface SimAgent {
  state: AgentState;
  nextActionTick: number;      // game tick when agent acts next
  cooldownReason: string;
  totalDecisions: number;
  lastAction: string | null;
  lastActionResult: string | null;
  lastActionWasStub: boolean;
  recentActions: ActionRecord[];  // last 2 actions with results
  activeEngagementId: string | null;  // if set, combat-tick handles LLM for this agent
  lastLatencyMs: number;
  memories: import('../strategy/agent-memory.js').AgentMemoryEntry[];  // cognitive memory buffer (max 5)
  lastReasoning: string;  // LLM's reasoning from last decision (feeds into memory)
  confirmedDead: boolean;  // once true, NEVER unset — prevents zombie resurrection
}

export interface SimOptions {
  agentCount: number;
  days: number;
  speed: number;  // 0 = max speed (ignored — always max in sim mode)
  logLevel: 'silent' | 'errors' | 'events' | 'verbose' | 'debug';
  resume?: boolean;  // resume from latest checkpoint instead of fresh seed
}

export interface SimReport {
  totalTicks: number;
  ticksProcessed: number;
  ticksSkipped: number;
  totalDecisions: number;
  durationMs: number;
  avgTickMs: number;
  agentCount: number;
  days: number;
}

// ── Harness ────────────────────────────────────────────────

export class SimHarness {
  private options: SimOptions;
  private scheduler: TickScheduler;
  private llmClient: LLMClient;
  private memoryStore: MemoryStore;
  private logger: SimLogger;
  private metrics: SimMetrics;
  private simAgents: SimAgent[] = [];
  private handlers: ReturnType<typeof getAllHandlers> = [];
  private startTime = 0;
  private ticksSkipped = 0;
  private tickTimes: number[] = [];

  constructor(options: SimOptions) {
    this.options = options;

    this.scheduler = new TickScheduler({
      mode: 'sim',
      intervalMs: 0,
      onTick: (ctx) => this.onTick(ctx),
      onError: (err, handler) => this.logger.error(`Handler ${handler} failed: ${err.message}`),
    });

    this.llmClient = new LLMClient({ maxConcurrent: 30, timeoutMs: 60000 });
    this.memoryStore = new MemoryStore('./data/agent_memory.db');
    this.logger = new SimLogger(options.logLevel);
    this.metrics = new SimMetrics();
  }

  async run(): Promise<SimReport> {
    this.startTime = Date.now();

    // Wait for SQLite memory store to initialize
    await this.memoryStore.ensureReady();

    // Bootstrap
    this.logger.info('Bootstrapping agent registry...');
    bootstrapRegistry();

    this.handlers = getAllHandlers();

    // ── Resume from checkpoint ────────────────────────────
    if (this.options.resume) {
      const checkpoint = getLatestCheckpoint();
      if (!checkpoint) {
        throw new Error('--resume specified but no checkpoint found in sim-output/checkpoints/');
      }

      // Initialize logger in append mode (don't truncate existing JSONL)
      this.logger.init(true);

      this.scheduler.setGameTime(checkpoint.gameTime);
      this.scheduler.registerHandlers(this.handlers);
      this.logger.info(`Resuming from checkpoint at tick ${checkpoint.tickNumber} (${checkpoint.agents.length} agents)`);

      // Rebuild SimAgent array from checkpoint agent states
      // DB already has the game state — we just need the in-memory wrappers
      this.simAgents = checkpoint.agents.map(state => ({
        state,
        nextActionTick: 0,
        recentActions: [],
        memories: [],
        lastAction: null,
        lastActionResult: '',
        lastReasoning: '',
        lastLatencyMs: 0,
        lastActionWasStub: false,
        cooldownReason: '',
        confirmedDead: state.status === AgentStatus.DEAD,
        totalDecisions: 0,
        activeEngagementId: null,
      } as SimAgent));

      // Run from checkpoint tick to end
      const startTick = checkpoint.tickNumber + 1;
      const totalTicks = this.options.days * TICKS_PER_DAY;
      this.logger.info(`Running ticks ${startTick} to ${totalTicks} (${totalTicks - startTick} remaining)...`);

      return this.runTickLoop(startTick, totalTicks);
    }

    // ── Fresh run ─────────────────────────────────────────
    this.logger.init();

    const gameTime = createInitialGameTime(1715, 1, 1);
    this.scheduler.setGameTime(gameTime);
    this.scheduler.registerHandlers(this.handlers);
    this.logger.info(`Registered ${this.handlers.length} tick handlers`);

    // Clear sim-generated agents/ships/crew from previous runs
    const { execute: execSql } = await import('../db/sqlite.js');
    await execSql('PRAGMA foreign_keys = OFF');
    for (const t of ['crew', 'cargo', 'agent_relationships', 'wounds', 'intel', 'bounties', 'navy_cases', 'ships', 'agents', 'world_events', 'reputation', 'skills', 'fences', 'documents', 'market_prices', 'haven_investments']) {
      try { await execSql(`DELETE FROM ${t} WHERE 1=1`); } catch { /* ok */ }
    }
    await execSql('PRAGMA foreign_keys = ON');

    // Re-seed market_prices — the DELETE above wiped them, and economy-tick
    // initializes in-memory inventory from this table. Without this, all
    // supply starts at 0 and most cargo types never get replenished.
    {
      const { PORT_PROFILES: seedPorts } = await import('../config/ports.js');
      const { CARGO_TYPES: seedCargo } = await import('../config/cargo.js');
      for (const port of Object.values(seedPorts)) {
        for (const cargo of Object.values(seedCargo)) {
          const isOrigin = cargo.origins.includes(port.id);
          const isDest = cargo.destinations.includes(port.id);
          const priceMultiplier = isOrigin ? 0.7 : isDest ? 1.3 : 1.0;
          const supplyMultiplier = isOrigin ? 1.5 : isDest ? 0.5 : 1.0;
          const buyPrice = Math.round(cargo.basePrice * priceMultiplier * 100) / 100;
          const sellPrice = Math.round(buyPrice * 0.85 * 100) / 100;
          await execSql(
            `INSERT OR IGNORE INTO market_prices (id, port_id, cargo_type, buy_price, sell_price, supply, demand, last_updated_tick)
             VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))), ?, ?, ?, ?, ?, ?, 0)`,
            [port.id, cargo.id, buyPrice, sellPrice, Math.round(100 * supplyMultiplier), Math.round(100 / supplyMultiplier)]
          );
        }
      }
      this.logger.info('Re-seeded market_prices after table clear');
    }

    // Seed fence infrastructure at all major ports
    const fencePorts = [
      'port_royal', 'havana', 'bridgetown', 'petit_goave', 'tortuga',
      'charles_town', 'basseterre', 'santo_domingo', 'willemstad',
      'veracruz', 'cartagena', 'nassau', 'boston', 'portobelo',
    ];
    for (const portId of fencePorts) {
      const numFences = Math.random() < 0.5 ? 1 : 2;
      for (let i = 0; i < numFences; i++) {
        await execSql(
          `INSERT INTO fences (id, agent_id, port_id, tier, trust, availability, cut_percentage)
           VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))), '', ?, 1, 30, 95, 30)`,
          [portId]
        );
      }
    }

    // Seed agents
    this.logger.info(`Seeding ${this.options.agentCount} agents...`);
    this.simAgents = await this.seedAgents(this.options.agentCount);
    this.logger.info(`Seeded ${this.simAgents.length} agents across all regions`);

    const totalTicks = this.options.days * TICKS_PER_DAY;
    this.logger.info(`Running ${totalTicks} ticks (${this.options.days} days)...`);

    return this.runTickLoop(0, totalTicks);
  }

  private async runTickLoop(startTick: number, totalTicks: number): Promise<SimReport> {
    // ── Main tick loop with fast-forward ──
    let tick = startTick;
    while (tick < totalTicks) {
      const tickStart = Date.now();

      // Compute game time from tick (always accurate)
      const gt = tickToGameTime(tick);
      this.scheduler.setGameTime(gt);
      this.logger.setTick(tick, `${gt.year}-${gt.month}-${gt.day} ${gt.hour}:00`);

      // 1. Run world simulation on slow-tick boundaries
      const isSlowTick = tick % SLOW_TICK_INTERVAL === 0;
      if (isSlowTick) {
        for (const handler of this.handlers) {
          // combat-tick runs every tick (above), skip here to avoid double-execution
          if (handler.name === 'combat-tick') continue;
          try {
            await handler.execute({
              tickNumber: tick,
              timestamp: new Date(),
              gameTime: this.scheduler.getGameTime(),
              deltaMs: SLOW_TICK_INTERVAL * 3600_000,
              logger: this.logger,
            });
          } catch (err) {
            this.logger.error(`Handler ${handler.name} failed: ${(err as Error).message}`);
          }
        }
      }

      // 1a-ii. Run combat-tick EVERY tick (combat is urgent — not just slow ticks)
      try {
        await combatTickHandler.execute({ tickNumber: tick, timestamp: new Date(), gameTime: gt, deltaMs: 3600_000, logger: this.logger });
      } catch (err) {
        this.logger.error(`combat-tick failed: ${(err as Error).message}`);
      }

      // 1b. Sync agents whose ships arrived (travel-tick updated DB, sync in-memory)
      // Must run every tick, not just slow ticks — otherwise agents stay stuck at sea
      await this.syncArrivedAgents();

      // 1c. Unlock agents whose combat engagements have resolved
      await this.syncCombatEngagements();

      // 1b. Release imprisoned agents after ~3 days (72 ticks)
      // Track imprisonment start using lastDecisionTick (set when agent becomes imprisoned)
      for (const sa of this.simAgents) {
        if (sa.state.status === AgentStatus.IMPRISONED) {
          // Double-check agent isn't dead in DB (could have been killed while imprisoned)
          try {
            const dbCheck = await AgentQueries.getById(sa.state.id);
            if (dbCheck && dbCheck.status === 'dead') {
              sa.state = { ...sa.state, status: AgentStatus.DEAD };
              continue;
            }
          } catch { /* ignore */ }
          // If lastDecisionTick was never set for this imprisonment (e.g. from combat),
          // initialize it now so the 72-tick timer starts counting
          if (sa.state.lastDecisionTick === 0) {
            sa.state = { ...sa.state, lastDecisionTick: tick };
          }
          if (tick - sa.state.lastDecisionTick >= 72) {
            const releasePort = sa.state.portId || 'port_royal';
            sa.state = { ...sa.state, status: AgentStatus.IN_PORT, portId: releasePort };
            sa.nextActionTick = tick + 6;
            AgentQueries.updateStatus(sa.state.id, 'in_port').catch(() => {});
            AgentQueries.updateLocation(sa.state.id, releasePort, '').catch(() => {});

            // Reclaim captured ship if still exists — pirates historically stole back their ships
            if (!sa.state.shipId) {
              ShipQueries.getByCaptain(sa.state.id).then(async (ship) => {
                if (ship && (ship.status === 'captured' || ship.status === 'docked')) {
                  await ShipQueries.updateStatusFull(ship.id, 'docked', releasePort, null);
                  await ShipQueries.updateCondition(ship.id, Math.max(ship.hull, 40), Math.max(ship.sails, 50), ship.barnacle_level, ship.rot_level);
                  sa.state = { ...sa.state, shipId: ship.id };
                  await (await import('../db/sqlite.js')).execute('UPDATE agents SET ship_id = ? WHERE id = ?', [ship.id, sa.state.id]);
                  this.logger.info(`  [reclaim] ${sa.state.name} reclaimed ${ship.name} at ${releasePort}`);
                }
              }).catch(() => {});
            }

            if (this.options.logLevel === 'verbose' || this.options.logLevel === 'debug') {
              this.logger.verbose(`  [release] ${sa.state.name} released from prison at ${releasePort}`);
            }
          }
        }
      }

      // 1d. Reclaim/restore ships for captains with unusable ships (every slow tick)
      // When a ship is captured/sunk, the agent's ship_id still points to it.
      // Check if current ship is unusable and restore it, or clear the link.
      if (isSlowTick) {
        const CAPTAIN_TYPES = new Set(['pirate_captain', 'merchant_captain', 'privateer_captain', 'pirate_hunter', 'naval_officer']);
        for (const sa of this.simAgents) {
          if (!isAgentAlive(sa.state) || !CAPTAIN_TYPES.has(sa.state.type)) continue;
          if (!sa.state.shipId) continue; // truly no ship — handled by buy_vessel action

          try {
            const ship = await ShipQueries.getById(sa.state.shipId);
            if (!ship) continue;

            // Ship is fine — skip
            if (ship.status === 'docked' || ship.status === 'sailing') continue;

            // Ship is captured or sunk — reclaim it (patch it up at current port)
            // Historical: pirates recovered ships from prizes, beached wrecks, and port seizures
            if (ship.status === 'captured' || ship.status === 'sunk') {
              const reclaimPort = sa.state.portId || ship.port_id || 'port_royal';
              const reclaimHull = Math.max(40, Math.min(ship.hull, 70)); // patch to at least 40, cap at 70
              const reclaimSails = Math.max(50, ship.sails);
              await ShipQueries.updateStatusFull(ship.id, 'docked', reclaimPort, null);
              await ShipQueries.updateCondition(ship.id, reclaimHull, reclaimSails, ship.barnacle_level, ship.rot_level);
              // Ensure agent↔ship link is solid in both DB and memory
              const { execute: execSql2 } = await import('../db/sqlite.js');
              await execSql2('UPDATE agents SET ship_id = ? WHERE id = ?', [ship.id, sa.state.id]);
              await execSql2('UPDATE ships SET captain_id = ? WHERE id = ?', [sa.state.id, ship.id]);
              sa.state = { ...sa.state, shipId: ship.id };
              this.logger.info(`  [reclaim] ${sa.state.name} reclaimed ${ship.name} (hull ${reclaimHull})`);
            }
          } catch (err) { this.logger.error(`[reclaim-err] ${sa.state.name}: ${(err as Error).message}`); }
        }
      }

      // 2. Find agents ready to act this tick
      const readyAgents = this.simAgents.filter(sa =>
        sa.nextActionTick <= tick && isAgentAlive(sa.state) && !sa.activeEngagementId
      );

      // 3. Process ready agents (batched)
      if (readyAgents.length > 0) {
        await this.processAgentBatch(readyAgents, tick);
      }

      // 4. Fast-forward if nobody acts for a while
      if (readyAgents.length === 0) {
        const aliveAgents = this.simAgents.filter(sa => isAgentAlive(sa.state));
        if (aliveAgents.length > 0) {
          const earliestAction = Math.min(...aliveAgents.map(sa => sa.nextActionTick));
          const ticksToSkip = earliestAction - tick;

          if (ticksToSkip > 2) {
            // Skip to next slow-tick boundary so world sim still fires
            const ticksUntilNextSlow = SLOW_TICK_INTERVAL - (tick % SLOW_TICK_INTERVAL);
            const maxSkip = Math.min(ticksToSkip - 1, ticksUntilNextSlow - 1, totalTicks - tick - 1);

            if (maxSkip > 0) {
              tick += maxSkip;
              this.ticksSkipped += maxSkip;

              if (this.options.logLevel === 'debug') {
                this.logger.debug(`Fast-forwarded ${maxSkip} ticks (next action at tick ${earliestAction})`);
              }
              continue; // skip the tick increment at bottom
            }
          }
        }
      }

      tick++;
      const tickMs = Date.now() - tickStart;
      this.tickTimes.push(tickMs);
      this.metrics.recordTick({ tickNumber: tick, timestamp: new Date(), gameTime: this.scheduler.getGameTime(), deltaMs: tickMs });

      // Flush tick summary to JSONL
      this.logger.counters.tickDurationMs = tickMs;
      this.logger.counters.ticksSkippedTotal = this.ticksSkipped;
      this.logger.flushTickSummary();

      // Logging
      if (this.options.logLevel === 'verbose' || this.options.logLevel === 'debug') {
        if (readyAgents.length > 0) {
          this.logger.verbose(`Tick ${tick}/${totalTicks} | ${readyAgents.length} agents acted | ${tickMs}ms`);
        }
      }

      if (tick % TICKS_PER_DAY === 0) {
        const day = tick / TICKS_PER_DAY;
        const decisions = this.metrics.getTotalDecisions();
        this.logger.info(`Day ${day}/${this.options.days} | ${decisions} decisions | ${this.ticksSkipped} ticks skipped`);

        // Save checkpoint every game day
        this.saveCheckpoint(tick);

        // Memory cleanup: reset LLM stats (unbounded latencies array)
        this.llmClient.resetStats();

        // Prune dead SimAgent objects — they accumulate since we replenish population
        const before = this.simAgents.length;
        this.simAgents = this.simAgents.filter(sa => !sa.confirmedDead);
        if (this.simAgents.length < before) {
          this.logger.verbose(`  Pruned ${before - this.simAgents.length} dead agents from memory`);
        }

        // Daily agent-states snapshot
        this.logger.log('agent-states', {
          day,
          agentCount: this.simAgents.length,
          agents: this.simAgents.map(sa => ({
            id: sa.state.id,
            name: sa.state.name,
            type: sa.state.type,
            status: sa.state.status,
            portId: sa.state.portId,
            seaZoneId: sa.state.seaZoneId,
            shipId: sa.state.shipId,
            gold: (sa.state as any).gold,
            infamy: (sa.state as any).infamy,
            lastAction: sa.lastAction,
            totalDecisions: sa.totalDecisions,
            nextActionTick: sa.nextActionTick,
          })),
        });

        // Daily economy snapshot from DB
        try {
          const { query: econQ } = await import('../db/sqlite.js');
          const portStats = await econQ<{ port_id: string; cargo_type: string; buy_price: number; sell_price: number; supply: number }[]>(
            `SELECT port_id, cargo_type, buy_price, sell_price, supply FROM market_prices`
          );
          const agentGold = await econQ<{ agent_type: string; total_gold: number; cnt: number }[]>(
            `SELECT agent_type, SUM(gold) as total_gold, COUNT(*) as cnt FROM agents GROUP BY agent_type`
          );
          this.logger.log('economy', { day, marketPrices: portStats, agentWealth: agentGold });
        } catch { /* ok */ }
      }

      // Passive hull repair for docked ships — crew patches hull slowly while in port
      // Historical: captains always repaired using local materials, scavenged timber, etc.
      if (tick % SLOW_TICK_INTERVAL === 0) {
        try {
          const { query: qry, execute: exec } = await import('../db/sqlite.js');
          const damaged = await qry<{ id: string; hull: number }[]>(
            `SELECT id, hull FROM ships WHERE status = 'docked' AND hull < 70 AND hull > 0 LIMIT 50`
          );
          for (const s of damaged) {
            const newHull = Math.min(70, s.hull + 3);
            await exec('UPDATE ships SET hull = ? WHERE id = ?', [newHull, s.id]);
          }
        } catch { /* ok */ }
      }

      // Salvage dead agents' cargo every 3 days — if owner is dead, cargo is orphaned regardless of ship status
      if (tick % (TICKS_PER_DAY * 3) === 0) {
        try {
          const { query: salvageQuery, execute: salvageExec } = await import('../db/sqlite.js');
          const orphaned = await salvageQuery<{ id: string; type: string; quantity: number }[]>(
            `SELECT c.id, c.type, c.quantity
             FROM cargo c
             JOIN agents a ON c.owner_agent_id = a.id
             WHERE a.status = 'dead' AND c.quantity > 0 AND c.seized_from IS NULL
             LIMIT 50`
          );
          for (const c of orphaned) {
            await salvageExec('UPDATE cargo SET quantity = 0, heat = 0 WHERE id = ?', [c.id]);
          }
          if (orphaned.length > 0) {
            this.logger.info(`  [salvage] ${orphaned.length} cargo records salvaged from dead agents`);
          }

          // Recycle captured NPC ships — ships with no living captain stuck in "captured" limbo
          // Reset them to docked at nearest port so vessel spawner can reuse them
          const stuckShips = await salvageQuery<{ id: string; port_id: string }[]>(
            `SELECT s.id, s.port_id FROM ships s
             WHERE s.status = 'captured'
               AND (s.captain_id IS NULL OR s.captain_id IN (SELECT id FROM agents WHERE status = 'dead'))
             LIMIT 50`
          );
          for (const s of stuckShips) {
            const port = s.port_id || 'port_royal';
            await salvageExec(`UPDATE ships SET status = 'docked', port_id = ?, captain_id = NULL, hull = 50, crew_count = 0 WHERE id = ?`, [port, s.id]);
          }
          if (stuckShips.length > 0) {
            this.logger.info(`  [recycle] ${stuckShips.length} captured NPC ships recycled to docked`);
          }
          // Clean orphaned haven investments (agent_id not in agents table or dead)
          await salvageExec(
            `DELETE FROM haven_investments WHERE agent_id NOT IN (SELECT id FROM agents WHERE status != 'dead')`
          );

          // Release ships from dead captains
          await salvageExec(
            `UPDATE ships SET captain_id = NULL WHERE captain_id IN (SELECT id FROM agents WHERE status = 'dead') AND status != 'sunk'`
          );
        } catch { /* ok */ }
      }

      // Population replenishment — every 3 game days, replace dead agents
      if (tick > 0 && tick % (TICKS_PER_DAY * 3) === 0) {
        await this.replenishPopulation(tick);
      }
    }

    // Final checkpoint
    this.saveCheckpoint(tick);

    // Report
    const durationMs = Date.now() - this.startTime;
    const processedTicks = tick - this.ticksSkipped;
    const avgTickMs = this.tickTimes.length > 0
      ? this.tickTimes.reduce((a, b) => a + b, 0) / this.tickTimes.length
      : 0;

    this.memoryStore.close();
    this.logger.close();

    // Close SQLite database — prevents zombie process
    const { closeDb } = await import('../db/sqlite.js');
    await closeDb();

    return {
      totalTicks: tick,
      ticksProcessed: processedTicks,
      ticksSkipped: this.ticksSkipped,
      totalDecisions: this.metrics.getTotalDecisions(),
      durationMs,
      avgTickMs,
      agentCount: this.simAgents.length,
      days: this.options.days,
    };
  }

  // ── Agent batch processing ─────────────────────────────

  private async processAgentBatch(readyAgents: SimAgent[], tick: number): Promise<void> {
    const worldState = this.getWorldState(tick);

    // Sync dead status from DB — disease-tick and trial.ts set status='dead' in DB
    // but in-memory state may still say 'in_port' or 'at_sea'. Check every batch.
    for (const sa of readyAgents) {
      if (sa.confirmedDead) continue;
      const dbAgent = await AgentQueries.getById(sa.state.id);
      if (dbAgent && dbAgent.status === 'dead') {
        // Sync in-memory state only — do NOT log here.
        // Deaths are logged at the source: disease-tick, syncCombatEngagements, trial.ts.
        // Logging here caused zombie duplicates (disease-tick logs first, then this sync logs again).
        sa.state = { ...sa.state, status: AgentStatus.DEAD };
        sa.confirmedDead = true;
      }
    }

    // Short-circuit deterministic situations first (no LLM needed)
    const needsLLM: SimAgent[] = [];

    for (const sa of readyAgents) {
      // Loop breaker: if 3+ recent actions are all do_nothing AND agent is NOT imprisoned,
      // skip short-circuit and send to LLM for a real decision.
      // Imprisoned agents legitimately do_nothing — don't override.
      const stuckInLoop = sa.recentActions.length >= 3 &&
        sa.recentActions.slice(-3).every(r => r.action === 'do_nothing') &&
        sa.state.status !== AgentStatus.IMPRISONED;

      if (!stuckInLoop) {
        const scAction = shortCircuit(sa.state, sa);
        if (scAction) {
          await this.applyDecision(sa, scAction, 'short_circuit', tick);
          continue;
        }
      }
      needsLLM.push(sa);
    }

    if (needsLLM.length === 0) return;

    // Force-fence: pirate-type captains in port with seized cargo sell immediately
    // The LLM consistently fails to choose sell_plunder even with urgent prompting.
    // Pirates who dock with hot cargo MUST fence it — historically, this was always
    // the first priority after a successful raid.
    const FENCE_TYPES = new Set(['pirate_captain', 'privateer_captain', 'pirate_hunter']);
    const { CargoQueries: FenceCargo } = await import('../db/queries.js');
    const afterFence: SimAgent[] = [];
    for (const sa of needsLLM) {
      if (
        FENCE_TYPES.has(sa.state.type) &&
        sa.state.status === AgentStatus.IN_PORT &&
        sa.state.portId
      ) {
        const ownedCargo = await FenceCargo.getByOwner(sa.state.id);
        const hasSeized = ownedCargo.some(c => (c.heat > 0 || c.seized_from) && c.quantity > 0);
        if (hasSeized) {
          await this.applyDecision(sa, { action: 'sell_plunder', params: {} } as PlayerDecision, 'force_fence', tick);
          this.logger.info(`  [force-fence] ${sa.state.name} fencing seized cargo at ${sa.state.portId}`);
          continue;
        }
      }
      afterFence.push(sa);
    }

    // Force-join: unassigned crew_members MUST join a ship
    // The LLM prefers social/criminal actions over join_crew — crew never joins organically.
    // Historical: sailors ashore were always looking for their next berth.
    const afterJoin: SimAgent[] = [];
    for (const sa of afterFence) {
      if (
        sa.state.type === 'crew_member' &&
        !sa.state.shipId &&
        sa.state.status === AgentStatus.IN_PORT &&
        sa.state.portId
      ) {
        await this.applyDecision(sa, { action: 'join_crew', params: {} } as PlayerDecision, 'force_join', tick);
        this.logger.info(`  [force-join] ${sa.state.name} forced to join crew at ${sa.state.portId}`);
        continue;
      }
      afterJoin.push(sa);
    }

    // Force-sail: captain types stuck in port too long
    // Any non-sail action counts toward port-camping. After 3 consecutive non-sail
    // actions in port, force them to sea. This is more aggressive than the old
    // "2 passive actions" check which only caught do_nothing/lay_low/etc — agents
    // cycled through trade_cargo/set_prices/serve_drinks and never triggered it.
    const FORCE_SAIL_TYPES = new Set(['pirate_captain', 'privateer_captain', 'merchant_captain', 'naval_officer', 'pirate_hunter']);
    const reallyNeedsLLM: SimAgent[] = [];
    for (const sa of afterJoin) {
      const recentNonSail = sa.recentActions.length >= 3 &&
        sa.recentActions.slice(-3).every(r => r.action !== 'sail_to');
      if (
        FORCE_SAIL_TYPES.has(sa.state.type) &&
        sa.state.status === AgentStatus.IN_PORT &&
        sa.state.shipId &&
        recentNonSail
      ) {
        const filled = await autoFillParams('sail_to', sa.state, this.getWorldState(tick));
        await this.applyDecision(sa, filled, 'force_sail', tick);
      } else if (
        // Force-dock: critically damaged ships (hull < 15) — they'll sink in the next fight.
        // Run 42: George Fletcher (hull 1) and Louis Duval (hull 13) sailed indefinitely
        // at sea with no mechanism to force them home for repair.
        FORCE_SAIL_TYPES.has(sa.state.type) &&
        sa.state.status === AgentStatus.AT_SEA &&
        sa.state.shipId &&
        await ShipQueries.getById(sa.state.shipId).then(s => s && s.hull < 15).catch(() => false)
      ) {
        const ports = Object.keys((await import('../config/ports.js')).PORT_PROFILES);
        const randomPort = ports[Math.floor(Math.random() * ports.length)]!;
        sa.state = { ...sa.state, status: AgentStatus.IN_PORT, portId: randomPort };
        await AgentQueries.updateStatus(sa.state.id, 'in_port');
        await AgentQueries.updateLocation(sa.state.id, randomPort, '');
        await ShipQueries.updateStatusFull(sa.state.shipId!, 'docked', randomPort, null);
        sa.nextActionTick = tick + 6;
        this.logger.info(`  [force-dock] ${sa.state.name} forced to port ${randomPort} (hull critical)`);
      } else if (
        // Force-dock: captain types stuck at sea with 4+ consecutive at-sea actions
        // (failed sail_to, repeated flee/attack cycles — can't get home)
        FORCE_SAIL_TYPES.has(sa.state.type) &&
        sa.state.status === AgentStatus.AT_SEA &&
        sa.recentActions.length >= 4 &&
        sa.recentActions.slice(-4).every(r => r.failed || ['flee', 'attack_ship', 'board_ship', 'do_nothing'].includes(r.action))
      ) {
        // Teleport to nearest port — they're stuck
        const ports = Object.keys((await import('../config/ports.js')).PORT_PROFILES);
        const randomPort = ports[Math.floor(Math.random() * ports.length)]!;
        sa.state = { ...sa.state, status: AgentStatus.IN_PORT, portId: randomPort };
        await AgentQueries.updateStatus(sa.state.id, 'in_port');
        await AgentQueries.updateLocation(sa.state.id, randomPort, '');
        if (sa.state.shipId) {
          await ShipQueries.updateStatusFull(sa.state.shipId, 'docked', randomPort, null);
        }
        sa.nextActionTick = tick + 6;
        this.logger.info(`  [force-dock] ${sa.state.name} forced to port ${randomPort} (stuck at sea)`);
      } else {
        reallyNeedsLLM.push(sa);
      }
    }

    if (reallyNeedsLLM.length === 0) return;

    // Batch LLM decisions with narrative prompts
    const batchSize = 60;
    for (let i = 0; i < reallyNeedsLLM.length; i += batchSize) {
      const batch = reallyNeedsLLM.slice(i, i + batchSize);

      const decisions = await Promise.allSettled(
        batch.map(async sa => {
          const validActions = filterActionsForAgent(sa.state, worldState);
          if (validActions.length === 0) return { sa, decision: { action: 'do_nothing', params: {} } as PlayerDecision };

          // Filter out actions that failed recently (preconditions not met)
          const FAIL_SIGNALS = ['No ', 'Insufficient', 'Cannot afford', 'Not on', 'Not assigned', 'No one', 'nothing to'];
          const failedRecently = new Set(
            sa.recentActions
              .filter(r => r.failed || r.wasStub || FAIL_SIGNALS.some(sig => r.result.includes(sig)))
              .map(r => r.action)
          );
          let effectiveActions = validActions.filter(a => !failedRecently.has(a));
          if (effectiveActions.length < 2) effectiveActions = validActions; // fallback if too aggressive

          // Anti-repeat: remove action done 2+ times in a row from the available list
          if (sa.recentActions.length >= 2) {
            const last = sa.recentActions[sa.recentActions.length - 1]!.action;
            const prev = sa.recentActions[sa.recentActions.length - 2]!.action;
            if (last === prev) {
              const noRepeat = effectiveActions.filter(a => a !== last);
              if (noRepeat.length >= 2) effectiveActions = noRepeat;
            }
          }

          // Loop breaker: if ALL recent actions are identical (3+), force a random different action
          if (sa.recentActions.length >= 3 &&
              sa.recentActions.every(r => r.action === sa.recentActions[0]!.action)) {
            const stuckAction = sa.recentActions[0]!.action;
            const alternatives = effectiveActions.filter(a => a !== stuckAction);
            if (alternatives.length >= 1) {
              effectiveActions = alternatives;
              this.logger.info(`  [loop-break] ${sa.state.name} stuck on ${stuckAction}, forcing alternatives`);
            }
          }

          // Pirates/privateers/merchants have lay_low — strip do_nothing entirely
          const SKIP_DO_NOTHING = new Set(['pirate_captain', 'privateer_captain', 'merchant_captain', 'crew_member', 'surgeon']);
          if (SKIP_DO_NOTHING.has(sa.state.type)) {
            effectiveActions = effectiveActions.filter(a => a !== 'do_nothing');
          }

          // Safety net: if all filtering left us with nothing, fall back to full action list
          if (effectiveActions.length === 0) effectiveActions = validActions;

          // Check if agent has stolen cargo
          const agentCargo = await import('../db/queries.js').then(q => q.CargoQueries.getByOwner(sa.state.id));
          const hasStolen = agentCargo.some(c => (c.heat > 0 || c.seized_from) && c.quantity > 0);

          // Strip sell_plunder when no stolen cargo
          if (!hasStolen) {
            effectiveActions = effectiveActions.filter(a => a !== 'sell_plunder');
          }

          // Strip trade_cargo when agent HAS stolen cargo — force through fence, not market
          if (hasStolen && effectiveActions.includes('sell_plunder')) {
            effectiveActions = effectiveActions.filter(a => a !== 'trade_cargo' && a !== 'sell_cargo');
          }

          // Shuffle actions so the model doesn't always pick #1
          // Both prompt builder and parser apply the same do_nothing-last reorder
          for (let i = effectiveActions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [effectiveActions[i], effectiveActions[j]] = [effectiveActions[j]!, effectiveActions[i]!];
          }

          try {
            // Build cognitive prompt — memory-aware, consequence-previewing, future-planning
            const typeConfig = AGENT_TYPE_CONFIGS[sa.state.type];
            const cogResult = await buildCognitivePrompt(sa.state, worldState, this.memoryStore, effectiveActions, sa.memories);
            let userPrompt = cogResult.prompt;

            // Extract the action list from the prompt text itself — guarantees the parser
            // uses exactly what the LLM sees, preventing the OOB mismatch bug where
            // shownActions could diverge from the numbered choices in the prompt.
            const shownActions = extractActionsFromPrompt(userPrompt);

            // Build system prompt — identity + persona
            const historicalPrompt = getHistoricalSystemPrompt(sa.state.id);
            const systemPrompt = historicalPrompt
              ? fillSystemPrompt(historicalPrompt, sa.state, worldState)
              : buildCognitiveSystemPrompt(sa.state, worldState);

            // Log prompt stats
            const promptWords = userPrompt.split(/\s+/).filter(Boolean).length;
            const promptTokensEst = Math.ceil(promptWords * 1.35);
            const systemWords = systemPrompt.split(/\s+/).filter(Boolean).length;
            const systemTokensEst = Math.ceil(systemWords * 1.35);

            this.logPromptDebug(sa, systemPrompt, userPrompt, promptTokensEst, systemTokensEst, tick);

            // LLM call — 100 tokens for number + reasoning sentence
            const response = await this.llmClient.chatCompletion({
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              temperature: typeConfig?.inferenceTier === 'high' ? 0.7 : 0.5,
              maxTokens: 16,
            });

            // Track latency
            sa.lastLatencyMs = response.latencyMs ?? 0;

            // Parse response — retry once on failure
            let parsed = parseAgentResponse(response.content, shownActions, sa.lastAction ?? undefined);
            this.logResponseDebug(sa, response.content, parsed, response.usage, tick);

            if (!parsed) {
              // Retry with fresh nonce (different KV cache path)
              const retry = await this.llmClient.chatCompletion({
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt },
                ],
                temperature: (typeConfig?.inferenceTier === 'high' ? 0.7 : 0.5) + 0.1,
                maxTokens: 16,
              });
              parsed = parseAgentResponse(retry.content, shownActions, sa.lastAction ?? undefined);
              this.logResponseDebug(sa, retry.content, parsed, retry.usage, tick);
            }

            if (parsed) {
              // Store reasoning for memory (feeds back next tick)
              sa.lastReasoning = parsed.reasoning;
              // Auto-fill params from game state (LLM picks action, code fills params)
              const filled = await autoFillParams(parsed.action, sa.state, worldState);
              return { sa, decision: { action: filled.action, params: { ...filled.params, ...parsed.params } } as PlayerDecision };
            }

            // Both attempts failed — fallback to rule-based (use filtered actions to respect loop-breaker)
            this.logger.error(`Parse failed for ${sa.state.name}, using rule-based fallback`);
            return { sa, decision: makePlayerDecision(sa.state, worldState, effectiveActions.length > 0 ? effectiveActions : validActions) };
          } catch (err: any) {
            this.logger.error(`LLM call failed for ${sa.state.name}: ${err.message}`);
            // Fallback to rule-based
            const validActions = filterActionsForAgent(sa.state, worldState);
            return { sa, decision: makePlayerDecision(sa.state, worldState, validActions) };
          }
        })
      );

      for (const result of decisions) {
        if (result.status === 'fulfilled') {
          await this.applyDecision(result.value.sa, result.value.decision, 'llm', tick);
        }
      }
    }
  }

  // ── Checkpoints ──────────────────────────────────────

  private saveCheckpoint(tick: number): void {
    try {
      const filepath = saveCheckpoint({
        gameTime: this.scheduler.getGameTime(),
        tickNumber: tick,
        agents: this.simAgents.map(sa => sa.state),
        timestamp: new Date().toISOString(),
        metadata: {
          decisions: this.metrics.getTotalDecisions(),
          ticksSkipped: this.ticksSkipped,
          durationMs: Date.now() - this.startTime,
        },
      });
      this.logger.info(`Checkpoint saved: ${filepath}`);
    } catch (err: any) {
      this.logger.error(`Checkpoint failed: ${err.message}`);
    }
  }

  // ── Debug Logging ─────────────────────────────────────

  private promptDebugFile = 'sim-output/prompt-debug.jsonl';

  private logPromptDebug(sa: SimAgent, systemPrompt: string, userPrompt: string, userTokens: number, systemTokens: number, tick: number): void {
    const entry = {
      type: 'prompt',
      tick,
      agent: sa.state.name,
      agentType: sa.state.type,
      systemTokensEst: systemTokens,
      userTokensEst: userTokens,
      totalTokensEst: systemTokens + userTokens,
      userPromptWords: userPrompt.split(/\s+/).filter(Boolean).length,
      systemPrompt: systemPrompt.slice(0, 300) + (systemPrompt.length > 300 ? '...' : ''),
      userPromptPreview: userPrompt.slice(0, 500) + (userPrompt.length > 500 ? '...' : ''),
      fullUserPrompt: userPrompt,
    };
    try {
      fs.mkdirSync('sim-output', { recursive: true });
      fs.appendFileSync(this.promptDebugFile, JSON.stringify(entry) + '\n');
    } catch { /* ignore write errors */ }
  }

  private logResponseDebug(sa: SimAgent, rawResponse: string, parsed: any, usage: any, tick: number): void {
    const entry = {
      type: 'response',
      tick,
      agent: sa.state.name,
      agentType: sa.state.type,
      rawResponse,
      parsedAction: parsed?.action ?? null,
      parsedParams: parsed?.params ?? null,
      parsedReasoning: parsed?.reasoning ?? null,
      promptTokens: usage?.promptTokens ?? 0,
      completionTokens: usage?.completionTokens ?? 0,
      totalTokens: usage?.totalTokens ?? 0,
    };
    try {
      fs.appendFileSync(this.promptDebugFile, JSON.stringify(entry) + '\n');
    } catch { /* ignore */ }
  }

  // ── Action Counter Logging ───────────────────────────

  private logActionCounters(sa: SimAgent, action: string, result: { success: boolean; message: string; data?: Record<string, unknown> }): void {
    const c = this.logger.counters;
    const agentId = sa.state.id;
    const agentName = sa.state.name;
    const portId = sa.state.portId;

    switch (action) {
      // Navigation
      case 'sail_to':
        c.voyagesStarted++;
        this.logger.log('navigation', { type: 'departure', agentId, agentName, portId, seaZoneId: sa.state.seaZoneId, ...result.data });
        break;

      // Combat
      case 'attack_ship':
      case 'board_ship':
      case 'engage_ship':
        c.combatsInitiated++;
        if (result.data?.type === 'boarding') c.boardingActions++;
        if (result.data?.shipCaptured) c.shipsCaptured++;
        this.logger.log('combat', { type: action, agentId, agentName, portId, seaZoneId: sa.state.seaZoneId, ...result.data });
        break;
      case 'surrender':
        c.surrenders++;
        this.logger.log('combat', { type: 'surrender', agentId, agentName, seaZoneId: sa.state.seaZoneId, ...result.data });
        break;
      case 'flee':
        c.escapes++;
        this.logger.log('combat', { type: 'flee', agentId, agentName, seaZoneId: sa.state.seaZoneId, ...result.data });
        break;

      // Trade
      case 'buy_cargo':
        c.cargoBought++;
        c.cargoTraded++;
        if (result.data?.totalPrice) c.totalTradeValue += result.data.totalPrice as number;
        this.logger.log('cargo-trade', { type: 'buy', agentId, agentName, portId, ...result.data });
        break;
      case 'sell_cargo':
        c.cargoSold++;
        c.cargoTraded++;
        if (result.data?.totalPrice) c.totalTradeValue += result.data.totalPrice as number;
        this.logger.log('cargo-trade', { type: 'sell', agentId, agentName, portId, ...result.data });
        break;
      case 'trade_cargo':
        c.cargoTraded++;
        if (result.data?.totalPrice) c.totalTradeValue += result.data.totalPrice as number;
        this.logger.log('cargo-trade', { type: 'trade', agentId, agentName, portId, ...result.data });
        break;
      case 'sell_plunder':
        c.plunderSold++;
        c.fenceTransactions++;
        if (result.data?.totalPrice) c.fenceTotalValue += result.data.totalPrice as number;
        this.logger.log('fences', { type: 'sell_plunder', agentId, agentName, portId, ...result.data });
        break;
      case 'buy_stolen_goods':
        c.fenceTransactions++;
        if (result.data?.totalPrice) c.fenceTotalValue += result.data.totalPrice as number;
        this.logger.log('fences', { type: 'buy_stolen', agentId, agentName, portId, ...result.data });
        break;
      case 'sell_goods':
        c.fenceTransactions++;
        if (result.data?.totalPrice) c.fenceTotalValue += result.data.totalPrice as number;
        this.logger.log('fences', { type: 'sell_goods', agentId, agentName, portId, ...result.data });
        break;

      // Crew
      case 'recruit_crew':
        c.crewRecruited++;
        this.logger.log('crew-events', { type: 'recruited', agentId, agentName, portId, ...result.data });
        break;
      case 'distribute_shares':
        c.sharesDistributed++;
        this.logger.log('crew-events', { type: 'shares_distributed', agentId, agentName, ...result.data });
        break;
      case 'desert':
        c.crewDeserted++;
        this.logger.log('crew-events', { type: 'deserted', agentId, agentName, portId, ...result.data });
        break;
      case 'grumble':
        c.grievancesLogged++;
        this.logger.log('crew-events', { type: 'grievance', agentId, agentName, ...result.data });
        break;

      // Ship services
      case 'repair_ship':
        c.shipsRepaired++;
        this.logger.log('ship-events', { type: 'repaired', agentId, agentName, portId, ...result.data });
        break;
      case 'careen_ship':
        c.shipsCareened++;
        this.logger.log('ship-events', { type: 'careened', agentId, agentName, portId, ...result.data });
        break;
      case 'upgrade_ship':
        c.shipsUpgraded++;
        this.logger.log('ship-events', { type: 'upgraded', agentId, agentName, portId, ...result.data });
        break;
      case 'build_vessel':
        c.shipsBuilt++;
        this.logger.log('ship-events', { type: 'built', agentId, agentName, portId, ...result.data });
        break;

      // Intel
      case 'gather_intel':
        c.intelGenerated++;
        this.logger.log('intel', { type: 'generated', agentId, agentName, portId, ...result.data });
        break;
      case 'sell_intel':
        c.intelSold++;
        this.logger.log('intel', { type: 'sold', agentId, agentName, portId, ...result.data });
        break;
      case 'spread_rumor':
      case 'plant_rumor':
        c.rumorsPlanted++;
        this.logger.log('intel', { type: 'rumor_planted', agentId, agentName, portId, ...result.data });
        break;
      case 'eavesdrop':
        c.rumorsPlanted++;
        this.logger.log('intel', { type: 'eavesdrop', agentId, agentName, portId, ...result.data });
        break;

      // Law
      case 'build_case':
        c.casesOpened++;
        this.logger.log('law', { type: 'case_opened', agentId, agentName, ...result.data });
        break;
      case 'arrest':
        c.arrests++;
        this.logger.log('law', { type: 'arrest', agentId, agentName, portId, ...result.data });
        break;
      case 'host_trial':
        c.trials++;
        this.logger.log('law', { type: 'trial', agentId, agentName, portId, ...result.data });
        break;
      case 'post_bounty':
        c.bountiesPosted++;
        this.logger.log('bounties', { type: 'posted', agentId, agentName, ...result.data });
        break;
      case 'claim_bounty':
        c.bountiesClaimed++;
        this.logger.log('bounties', { type: 'claimed', agentId, agentName, ...result.data });
        break;

      // Pardons
      case 'grant_pardon':
        c.pardonsGranted++;
        this.logger.log('pardons', { type: 'offered', agentId, agentName, portId, ...result.data });
        break;
      case 'accept_pardon':
        c.pardonsAccepted++;
        this.logger.log('pardons', { type: 'accepted', agentId, agentName, portId, ...result.data });
        break;

      // Health
      case 'treat_wound':
        c.woundsTreated++;
        this.logger.log('wounds-disease', { type: 'wound_treated', agentId, agentName, portId, ...result.data });
        break;
      case 'treat_disease':
        c.woundsTreated++;
        this.logger.log('wounds-disease', { type: 'disease_treated', agentId, agentName, portId, ...result.data });
        break;
      case 'amputate':
        c.woundsTreated++;
        this.logger.log('wounds-disease', { type: 'amputation', agentId, agentName, portId, ...result.data });
        break;
      case 'fight':
        c.woundsInflicted++;
        this.logger.log('wounds-disease', { type: 'wound_inflicted', agentId, agentName, portId, ...result.data });
        break;

      // Haven
      case 'invest_haven':
      case 'invest':
        c.havenInvestments++;
        this.logger.log('havens', { type: 'invest', agentId, agentName, portId, ...result.data });
        break;

      // Port / governor actions
      case 'inspect_ship':
      case 'collect_fees':
      case 'deny_entry':
      case 'issue_clearance':
      case 'report_suspicious':
      case 'fortify_port':
      case 'lower_tariffs':
      case 'raise_tariffs':
      case 'increase_patrols':
        this.logger.log('port-events', { type: action, agentId, agentName, portId, ...result.data });
        break;

      // Reputation-affecting social actions
      case 'negotiate':
      case 'broker_deal':
      case 'bribe_official':
      case 'bribe_governor':
      case 'accept_bribe':
      case 'report_piracy':
      case 'report_to_authorities':
      case 'report_to_governor':
      case 'report_to_admiralty':
      case 'betray_source':
        this.logger.log('reputation', { type: action, agentId, agentName, portId, ...result.data });
        break;

      // Navy / patrol actions
      case 'patrol_region':
      case 'pursue_target':
      case 'escort_convoy':
      case 'track_target':
      case 'issue_letter_of_marque':
        this.logger.log('law', { type: action, agentId, agentName, portId, seaZoneId: sa.state.seaZoneId, ...result.data });
        break;

      // Fence-specific non-trade actions
      case 'establish_contact':
      case 'set_prices':
      case 'refuse_deal':
        this.logger.log('fences', { type: action, agentId, agentName, portId, ...result.data });
        break;

      // Tavern / social actions
      case 'visit_tavern':
      case 'serve_drinks':
      case 'shelter_fugitive':
      case 'recruit_for':
      case 'drink':
      case 'gamble':
        this.logger.log('port-events', { type: action, agentId, agentName, portId, ...result.data });
        break;

      // Crew social actions
      case 'work':
      case 'support_captain':
      case 'challenge_captain':
      case 'steal':
      case 'settle_dispute':
      case 'advise_captain':
      case 'call_vote':
      case 'manage_provisions':
      case 'discipline_crew':
      case 'join_crew':
        this.logger.log('crew-events', { type: action, agentId, agentName, ...result.data });
        break;

      // Surgeon actions
      case 'prescribe_remedy':
        c.woundsTreated++;
        this.logger.log('wounds-disease', { type: 'remedy', agentId, agentName, portId, ...result.data });
        break;

      // Ship purchase / prize
      case 'buy_vessel':
      case 'claim_prize':
      case 'assess_damage':
        this.logger.log('ship-events', { type: action, agentId, agentName, portId, ...result.data });
        break;

      // Plantation / economy
      case 'sell_crop':
      case 'hire_shipping':
      case 'hire_guards':
      case 'hire_escort':
      case 'buy_provisions':
        this.logger.log('economy', { type: action, agentId, agentName, portId, ...result.data });
        break;

      // Pardon negotiation
      case 'negotiate_pardon':
        this.logger.log('pardons', { type: 'negotiated', agentId, agentName, portId, ...result.data });
        break;

      // Catch-all: log any unhandled action so nothing is silent
      default:
        if (action !== 'do_nothing' && action !== 'lay_low') {
          this.logger.log('agent-decisions', { type: 'unhandled_action_log', action, agentId, agentName, portId, ...result.data });
        }
        break;
    }
  }

  // ── Decision Application ─────────────────────────────

  private async applyDecision(sa: SimAgent, decision: PlayerDecision | string, source: string, tick: number): Promise<void> {
    const action = typeof decision === 'string' ? decision : decision.action;
    const params = typeof decision === 'string' ? {} : decision.params;
    const cooldown = getCooldownTicks(action);
    sa.lastAction = action;
    sa.totalDecisions++;
    sa.cooldownReason = action;
    sa.nextActionTick = tick + cooldown;

    // Sync decision tick to DB so cooldown_until_tick and last_decision_tick stay current
    AgentQueries.updateDecisionTick(sa.state.id, tick, tick + cooldown).catch(() => {});

    // Execute the action against world state
    const result = await executeAction(sa.state, action, params, tick);
    sa.lastActionResult = result.message;
    sa.lastActionWasStub = result.message.includes('not yet implemented');
    sa.recentActions.push({ action, result: result.message, wasStub: sa.lastActionWasStub, failed: !result.success });
    if (sa.recentActions.length > 5) sa.recentActions.shift();

    // Build cognitive memory entry — only store SUCCESSFUL actions (failed ones pollute the 5-slot window)
    if (result.success && action !== 'do_nothing') {
      const memNarrative = buildMemoryNarrative(action, result.message, sa.lastReasoning, result.success);
      sa.memories = pushMemory(sa.memories, { tick, action, narrative: memNarrative });
      this.logger.log('memories', { type: 'created', agentId: sa.state.id, agentName: sa.state.name, action, narrative: memNarrative, totalMemories: sa.memories.length });
      this.logger.counters.memoriesCreated++;
    }
    sa.lastReasoning = '';

    // Update in-memory agent state based on action effects
    if (action === 'sail_to' && result.success) {
      sa.state = { ...sa.state, status: AgentStatus.AT_SEA, portId: '' };
    }
    if (action === 'desert' && result.success) {
      sa.state = { ...sa.state, status: AgentStatus.FLED };
    }
    if (action === 'surrender' && result.success) {
      sa.state = { ...sa.state, status: AgentStatus.IMPRISONED };
    }
    if (action === 'arrest' && result.success && result.data?.targetAgentId) {
      const target = this.simAgents.find(other => other.state.id === result.data!.targetAgentId);
      if (target) target.state = { ...target.state, status: AgentStatus.IMPRISONED };
    }
    if (action === 'join_crew' && result.success && result.data?.ship_id) {
      sa.state = { ...sa.state, shipId: result.data.ship_id as string };
    }
    if (action === 'buy_vessel' && result.success && result.data?.shipId) {
      sa.state = { ...sa.state, shipId: result.data.shipId as string };
    }
    if (action === 'claim_prize' && result.success && result.data?.newShipId) {
      sa.state = { ...sa.state, shipId: result.data.newShipId as string };
    }
    if (action === 'recruit_crew' && result.success && result.data?.recruited_count) {
      // Sync ship crew count in-memory (ship state refreshed from DB each tick anyway)
    }
    // Lock agent into combat engagement if attack initiated one
    if ((action === 'attack_ship' || action === 'engage_ship' || action === 'board_ship') && result.data?.engagementId) {
      sa.activeEngagementId = result.data.engagementId as string;
      // Also lock the defender
      const targetShipId = result.data.targetShipId as string;
      if (targetShipId) {
        const defenderAgent = this.simAgents.find(other =>
          other.state.shipId === targetShipId && other !== sa
        );
        if (defenderAgent) {
          defenderAgent.activeEngagementId = result.data.engagementId as string;
        }
      }
    }

    // Increment sim-logger counters based on action
    if (result.success) {
      this.logActionCounters(sa, action, result);
    }

    this.metrics.recordDecision(sa.state.id, sa.state.type, action);

    // Full decision logging to JSONL
    this.logger.logDecision({
      agentId: sa.state.id,
      agentName: sa.state.name,
      agentType: sa.state.type,
      action,
      params,
      reasoning: result.message,
      source: source as 'llm' | 'short_circuit' | 'rule_based',
      latencyMs: sa.lastLatencyMs ?? 0,
      validActions: [],
      cooldownTicks: cooldown,
      nextActionTick: sa.nextActionTick,
      portId: sa.state.portId,
      seaZoneId: sa.state.seaZoneId,
      shipId: sa.state.shipId,
      status: sa.state.status,
    });

    if (this.options.logLevel === 'verbose' || this.options.logLevel === 'debug') {
      const resultTag = result.success ? '' : ' [FAILED]';
      this.logger.verbose(`  [${source}] ${sa.state.name} (${sa.state.type}): ${action}${resultTag} → next at tick ${sa.nextActionTick}`);
    }
  }

  // ── Seeding ────────────────────────────────────────────

  private async seedAgents(count: number): Promise<SimAgent[]> {
    const { rollTraits, buildPersonaProfile } = await import('../agents/persona-engine.js');
    const { generateName, generateShipName, generateShipNameLLM, resetShipNames } = await import('../agents/name-generator.js');
    resetShipNames(); // Clear dedup set for fresh run
    const { GENDER_ROLE_ACCESS } = await import('../config/heritage.js');
    const { createAgentState } = await import('../agents/base-agent.js');
    const { AGENT_TYPE_CONFIGS } = await import('../config/agents.js');
    const { PORT_PROFILES } = await import('../config/ports.js');
    const { SHIP_CLASSES } = await import('../config/ships.js');
    const { v4: uuid } = await import('uuid');

    const STARTING_CASH: Record<string, number> = {
      pirate_captain: 500,
      merchant_captain: 1000,
      naval_officer: 300,
      port_governor: 2000,
      fence: 800,
      crew_member: 10,
      quartermaster: 100,
      informant: 50,
      privateer_captain: 600,
      tavern_keeper: 400,
      shipwright: 300,
      surgeon: 200,
      pirate_hunter: 400,
      harbor_master: 200,
      plantation_owner: 1500,
    };

    const CAPTAIN_TYPES = new Set(['pirate_captain', 'merchant_captain', 'naval_officer', 'privateer_captain', 'pirate_hunter']);
    const CAPTAIN_SHIP_CLASS: Record<string, ShipClassName> = {
      pirate_captain: 'sloop',
      merchant_captain: 'sloop',        // Historical: Caribbean merchants sailed small trading sloops, not armed merchantmen
      naval_officer: 'frigate',
      privateer_captain: 'brigantine',
      pirate_hunter: 'brig',
    };

    // Historical gun loadouts — pirates armed up, merchants skimped to save cargo weight
    const CAPTAIN_GUNS_FRACTION: Record<string, number> = {
      pirate_captain: 0.75,       // 8 * 0.75 = 6 guns — armed for raids
      merchant_captain: 0.375,    // 8 * 0.375 = 3 guns — pair of swivels + stern chaser
      naval_officer: 0.6,         // 36 * 0.6 = 21 guns — navy standard
      privateer_captain: 0.6,     // 16 * 0.6 = 9 guns — standard
      pirate_hunter: 0.6,         // 20 * 0.6 = 12 guns — standard
    };

    // Historical crew counts — pirates overmanned for boarding superiority
    const CAPTAIN_CREW_COUNT: Record<string, number> = {
      pirate_captain: 50,         // Overmanned for boarding (sloop max 75)
      merchant_captain: 12,       // Skeleton trading crew — no incentive to fight
      naval_officer: 150,         // Navy manned for combat
      privateer_captain: 45,      // Moderate crew for sailing + fighting
      pirate_hunter: 60,          // Well-crewed bounty hunter
    };

    const simAgents: SimAgent[] = [];
    const types = Object.keys(AGENT_TYPE_CONFIGS);
    const ports = Object.keys(PORT_PROFILES);
    const usedNames = new Set<string>();

    for (let i = 0; i < count; i++) {
      const type = types[i % types.length]!;
      const config = AGENT_TYPE_CONFIGS[type];
      const portId = config.spawnConfig.preferredPorts?.[0] ?? ports[i % ports.length]!;
      const port = PORT_PROFILES[portId];
      const seaZoneId = port?.seaZoneId ?? 'great_bahama_bank';

      // Roll gender using GENDER_ROLE_ACCESS weights
      const genderAccess = GENDER_ROLE_ACCESS[type as keyof typeof GENDER_ROLE_ACCESS];
      let gender: 'male' | 'female' = 'male';
      if (genderAccess?.female.allowed) {
        const femaleWeight = genderAccess.female.weight ?? 0.5;
        gender = Math.random() < femaleWeight ? 'female' : 'male';
      }

      // Generate unique name with nationality from region
      let nameResult = generateName(seaZoneId, gender);
      let name = nameResult.lastName ? `${nameResult.firstName} ${nameResult.lastName}` : nameResult.firstName;
      let attempts = 0;
      while (usedNames.has(name) && attempts < 20) {
        nameResult = generateName(seaZoneId, gender);
        name = nameResult.lastName ? `${nameResult.firstName} ${nameResult.lastName}` : nameResult.firstName;
        attempts++;
      }
      if (usedNames.has(name)) name = `${name} ${i}`; // fallback
      usedNames.add(name);
      const nationality = nameResult.nationality;
      const heritage = nationality; // heritage maps directly to nationality
      const traits = rollTraits(
        config.requiredTraits ? { min: config.requiredTraits } : undefined
      );
      const persona = buildPersonaProfile(traits, name, type);
      const state = createAgentState(uuid(), type, name, portId, seaZoneId, persona);

      // Starting cash by role
      const startingCash = STARTING_CASH[type] ?? 50;

      // Insert agent into DB so trade/service queries can find them
      await AgentQueries.insert({
        id: state.id,
        type: type as any,
        name,
        port_id: portId,
        sea_zone_id: seaZoneId,
        ship_id: null,
        status: 'in_port',
        nationality,
        gender,
        heritage,
        nickname: null,
        attributes: '{}',
        persona: JSON.stringify(persona),
        cash: startingCash,
        infamy: 0,
        last_decision_tick: 0,
        cooldown_until_tick: 0,
      });

      // Assign ships to captain-type agents
      if (CAPTAIN_TYPES.has(type)) {
        const shipClass = CAPTAIN_SHIP_CLASS[type] ?? 'sloop';
        const classData = SHIP_CLASSES[shipClass];
        const shipId = uuid();
        const shipName = await generateShipNameLLM(this.llmClient, {
          captainName: name,
          captainType: type,
          shipClass: shipClass,
          portId,
          nationality,
          persona: persona.paragraph,
        });

        const gunsFraction = CAPTAIN_GUNS_FRACTION[type] ?? 0.6;
        const guns = Math.floor((classData?.maxGuns ?? 8) * gunsFraction);
        await ShipQueries.insert({
          id: shipId,
          name: shipName,
          class: shipClass,
          captain_id: state.id,
          hull: 80 + Math.floor(Math.random() * 20),
          sails: 80 + Math.floor(Math.random() * 20),
          guns,
          max_guns: classData?.maxGuns ?? 16,
          crew_count: CAPTAIN_CREW_COUNT[type] ?? classData?.crewMin ?? 20,
          crew_capacity: classData?.crewMax ?? 75,
          cargo_used: 0,
          cargo_capacity: classData?.cargoCapacity ?? 100,
          speed_base: classData?.speed ?? 7,
          maneuverability: classData?.maneuverability ?? 5,
          port_id: portId,
          sea_zone_id: seaZoneId,
          status: 'docked',
          current_zone_id: null,
          barnacle_level: Math.floor(Math.random() * 15),
          rot_level: Math.floor(Math.random() * 10),
          powder_stores: 70 + Math.floor(Math.random() * 30),
          food_stores: 70 + Math.floor(Math.random() * 30),
          water_stores: 70 + Math.floor(Math.random() * 30),
          destination_port_id: null,
          origin_port_id: null,
          arrival_tick: null,
          departure_tick: null,
        });

        state.shipId = shipId;
        // Write ship_id back to agents table (insert above uses null)
        await (await import('../db/sqlite.js')).execute(
          'UPDATE agents SET ship_id = ? WHERE id = ?', [shipId, state.id]
        );
      }

      // Stagger initial action times so agents don't all fire at tick 0
      const stagger = Math.floor(Math.random() * 12);

      simAgents.push({
        state,
        nextActionTick: stagger,
        cooldownReason: 'spawn',
        totalDecisions: 0,
        lastAction: null,
        lastActionResult: null,
        lastActionWasStub: false,
        recentActions: [],
        activeEngagementId: null,
        lastLatencyMs: 0,
        memories: [],
        lastReasoning: '',
        confirmedDead: false,
      });

      if (this.options.logLevel === 'verbose' || this.options.logLevel === 'debug') {
        this.logger.verbose(`  Spawned ${type}: ${name} at ${portId}${state.shipId ? ' (with ship)' : ''} (first action tick ${stagger})`);
      }
    }

    // Post-seed: assign crew_members and quartermasters to captain ships at same port
    const CREW_TYPES = new Set(['crew_member', 'quartermaster']);
    const captainAgents = simAgents.filter(sa => CAPTAIN_TYPES.has(sa.state.type) && sa.state.shipId);

    for (const sa of simAgents) {
      if (!CREW_TYPES.has(sa.state.type)) continue;

      // Find a captain with a ship — prefer same port, fall back to any captain
      let captain = captainAgents.find(c => c.state.portId === sa.state.portId);
      if (!captain) captain = captainAgents[0]; // any captain
      if (!captain || !captain.state.shipId) continue;

      // Move crew to captain's port if different
      if (sa.state.portId !== captain.state.portId) {
        sa.state = { ...sa.state, portId: captain.state.portId, seaZoneId: captain.state.seaZoneId };
        await AgentQueries.updateLocation(sa.state.id, captain.state.portId, captain.state.seaZoneId);
      }

      const role = sa.state.type === 'quartermaster' ? 'quartermaster' : 'common_sailor';
      const crewId = uuid();

      await CrewQueries.insert({
        id: crewId,
        agent_id: sa.state.id,
        ship_id: captain.state.shipId,
        role: role as any,
        loyalty: 55 + Math.floor(Math.random() * 20),
        share_agreement: role === 'quartermaster' ? 1.5 : 1.0,
        grievances: '[]',
        skills: '{}',
        joined_tick: 0,
        status: 'active',
      });

      // Named crew agents are tracked in the crew table — don't overwrite
      // ship.crew_count which represents total hands aboard (including unnamed sailors).
      // The CAPTAIN_CREW_COUNT already set the correct starting crew at ship creation.

      // Link agent to ship in memory
      sa.state.shipId = captain.state.shipId;

      if (this.options.logLevel === 'verbose' || this.options.logLevel === 'debug') {
        this.logger.verbose(`  Assigned ${sa.state.name} (${sa.state.type}) to ${captain.state.name}'s ship`);
      }
    }

    return simAgents;
  }

  private onTick(ctx: TickContext): void {
    this.metrics.recordTick(ctx);
  }

  /** Unlock agents whose combat engagements have resolved. */
  private async syncCombatEngagements(): Promise<void> {
    // Track which engagements we've already counted (avoid double-counting for attacker+defender)
    const counted = new Set<string>();
    const currentTick = this.scheduler.getGameTime().ticksElapsed ?? 0;

    for (const sa of this.simAgents) {
      if (!sa.activeEngagementId) continue;
      const engagement = getEngagementForAgent(sa.state.id);
      if (!engagement || engagement.phase === 'resolved') {
        // Count combat outcomes once per engagement
        if (engagement && !counted.has(engagement.id)) {
          counted.add(engagement.id);
          const c = this.logger.counters;
          const log = engagement.log.join(' ');
          if (log.includes('fires a broadside') || log.includes('fires chain shot') || log.includes('fires grapeshot')) c.broadsidesFired++;
          if (log.includes('boarding action') || log.includes('boards and captures') || log.includes('boarders')) c.boardingActions++;
          if (log.includes('captured')) c.shipsCaptured++;
          if (log.includes('sunk')) c.shipsSunk++;
          if (log.includes('surrenders')) c.surrenders++;
          if (log.includes('escapes') || log.includes('slips away')) c.escapes++;
        }

        sa.activeEngagementId = null;

        // Sync in-memory status from DB (combat may have killed/imprisoned this agent)
        // MUST await — fire-and-forget caused agents to act before status was updated
        try {
          const dbAgent = await AgentQueries.getById(sa.state.id);
          if (dbAgent) {
            if (dbAgent.status === 'dead' && sa.state.status !== AgentStatus.DEAD) {
              sa.state = { ...sa.state, status: AgentStatus.DEAD };
              sa.confirmedDead = true;
              this.logger.counters.deathsFromCombat++;
              this.logger.counters.agentsDied++;
              this.logger.log('deaths', { agentId: sa.state.id, agentName: sa.state.name, cause: 'combat' });
            } else if (dbAgent.status === 'imprisoned') {
              sa.state = { ...sa.state, status: AgentStatus.IMPRISONED, portId: dbAgent.port_id || sa.state.portId };
              sa.state.lastDecisionTick = currentTick; // start imprisonment timer
            }
          }
        } catch { /* ignore DB errors */ }

        // Post-combat cooldown: 12 ticks (12 game hours) — enough time to repair, recover
        sa.cooldownReason = 'post_combat';
        sa.nextActionTick = Math.max(sa.nextActionTick, currentTick + 12);
      }
    }
  }

  private async syncArrivedAgents(): Promise<void> {
    for (const sa of this.simAgents) {
      if (sa.state.status !== AgentStatus.AT_SEA || !sa.state.shipId) continue;

      const ship = await ShipQueries.getById(sa.state.shipId);
      if (!ship || ship.status !== 'docked') continue;

      // Ship has arrived — update in-memory agent state
      sa.state = {
        ...sa.state,
        status: AgentStatus.IN_PORT,
        portId: ship.port_id ?? sa.state.portId,
        seaZoneId: ship.sea_zone_id ?? sa.state.seaZoneId,
      };
      // Reset cooldown so agent acts promptly after arrival (not idle 10-20 ticks)
      const currentTick = this.scheduler.getGameTime().ticksElapsed ?? 0;
      sa.nextActionTick = Math.min(sa.nextActionTick, currentTick + 2);
      this.logger.counters.voyagesCompleted++;
    }
  }

  private getWorldState(tick: number): WorldState {
    return {
      gameTime: this.scheduler.getGameTime(),
      weather: getWeatherState(),
      seaState: getSeaStateMap(),
      tick,
    };
  }

  // ── Population Replenishment ────────────────────────────

  private async replenishPopulation(tick: number): Promise<void> {
    const alive = this.simAgents.filter(sa => isAgentAlive(sa.state));
    const dead = this.simAgents.filter(sa => sa.state.status === AgentStatus.DEAD);

    if (dead.length === 0) return;

    // Count alive agents by type
    const aliveByType = new Map<string, number>();
    for (const sa of alive) {
      aliveByType.set(sa.state.type, (aliveByType.get(sa.state.type) ?? 0) + 1);
    }

    // For each dead agent, spawn a replacement if that type has fewer than 3 alive
    const toReplace: string[] = [];
    for (const sa of dead) {
      const count = aliveByType.get(sa.state.type) ?? 0;
      if (count < 3) {
        toReplace.push(sa.state.type);
        aliveByType.set(sa.state.type, count + 1); // prevent double-spawning same type
      }
    }

    if (toReplace.length === 0) return;

    // Cap replacements per cycle
    const maxReplacements = Math.min(toReplace.length, 8);
    const typesToReplace = toReplace.slice(0, maxReplacements);

    const { rollTraits, buildPersonaProfile } = await import('../agents/persona-engine.js');
    const { generateName } = await import('../agents/name-generator.js');
    const { GENDER_ROLE_ACCESS } = await import('../config/heritage.js');
    const { createAgentState } = await import('../agents/base-agent.js');
    const { AGENT_TYPE_CONFIGS } = await import('../config/agents.js');
    const { PORT_PROFILES } = await import('../config/ports.js');
    const { v4: uuid } = await import('uuid');

    const STARTING_CASH: Record<string, number> = {
      pirate_captain: 500, merchant_captain: 1000, naval_officer: 300,
      port_governor: 2000, fence: 800, crew_member: 10, quartermaster: 100,
      informant: 50, privateer_captain: 600, tavern_keeper: 400,
      shipwright: 300, surgeon: 200, pirate_hunter: 400,
      harbor_master: 200, plantation_owner: 1500,
    };

    const portIds = Object.keys(PORT_PROFILES);

    for (const agentType of typesToReplace) {
      try {
        const portId = portIds[Math.floor(Math.random() * portIds.length)]!;
        const port = PORT_PROFILES[portId];
        const seaZoneId = port?.seaZoneId ?? 'caribbean_deep_basin';
        const config = AGENT_TYPE_CONFIGS[agentType];

        // Roll gender using GENDER_ROLE_ACCESS weights
        const genderAccess = GENDER_ROLE_ACCESS[agentType as keyof typeof GENDER_ROLE_ACCESS];
        let gender: 'male' | 'female' = 'male';
        if (genderAccess?.female.allowed) {
          const femaleWeight = genderAccess.female.weight ?? 0.5;
          gender = Math.random() < femaleWeight ? 'female' : 'male';
        }

        const nameResult = generateName(seaZoneId, gender);
        const name = nameResult.lastName ? `${nameResult.firstName} ${nameResult.lastName}` : nameResult.firstName;
        const nationality = nameResult.nationality;
        const heritage = nationality;

        const traits = rollTraits(
          config?.requiredTraits ? { min: config.requiredTraits } : undefined
        );
        const persona = buildPersonaProfile(traits, name, agentType);
        const id = uuid();

        const agentState = createAgentState(id, agentType, name, portId, seaZoneId, persona);

        await AgentQueries.insert({
          id, type: agentType as any, name, port_id: portId, sea_zone_id: seaZoneId,
          ship_id: null, status: 'in_port', nationality,
          persona: JSON.stringify(persona), cash: STARTING_CASH[agentType] ?? 100,
          infamy: 0, gender,
          heritage, nickname: null, attributes: '{}',
          last_decision_tick: tick, cooldown_until_tick: tick + 12,
        });

        this.simAgents.push({
          state: agentState,
          nextActionTick: tick + Math.floor(Math.random() * 12),
          lastAction: '',
          lastActionResult: '',
          lastActionWasStub: false,
          totalDecisions: 0,
          recentActions: [],
          activeEngagementId: null,
          cooldownReason: 'spawned',
          lastLatencyMs: 0,
          memories: [],
          lastReasoning: '',
          confirmedDead: false,
        } as SimAgent);

        this.logger.info(`Spawned replacement ${agentType}: ${name} at ${portId}`);
      } catch (err) {
        this.logger.error(`Failed to spawn replacement ${agentType}: ${(err as Error).message}`);
      }
    }
  }
}

// ── Helpers ──────────────────────────────────────────────

function isAgentAlive(agent: AgentState): boolean {
  return agent.status !== AgentStatus.DEAD && agent.status !== AgentStatus.FLED;
}

/** Get cooldown in ticks (game-hours), aligned to batch windows. */
function getCooldownTicks(action: string): number {
  const range = COOLDOWNS[action] ?? [2, 8];
  const raw = range[0] + Math.random() * (range[1] - range[0]);
  // Align to batch window
  return Math.max(1, Math.ceil(raw / BATCH_WINDOW_TICKS) * BATCH_WINDOW_TICKS);
}

/**
 * Short-circuit: bypass LLM for deterministic situations.
 * Returns an action string or null to proceed to LLM.
 */
const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Convert a tick number (hours since game start) into a proper GameTime. */
function tickToGameTime(tick: number): GameTime {
  const startYear = 1715;
  const totalHours = tick;
  const hour = totalHours % 24;
  let remainingDays = Math.floor(totalHours / 24);

  let year = startYear;
  while (true) {
    const daysInYear = 365; // no leap year in 1715-1725
    if (remainingDays < daysInYear) break;
    remainingDays -= daysInYear;
    year++;
  }

  let month = 1;
  while (month <= 12) {
    const dim = DAYS_IN_MONTH[month]!;
    if (remainingDays < dim) break;
    remainingDays -= dim;
    month++;
  }
  if (month > 12) { month = 12; } // clamp

  const day = remainingDays + 1; // 1-indexed

  const season = month >= 3 && month <= 5 ? Season.SPRING
    : month >= 6 && month <= 8 ? Season.SUMMER
    : month >= 9 && month <= 11 ? Season.AUTUMN
    : Season.WINTER;

  return {
    year,
    month,
    day,
    hour,
    season,
    isDay: hour >= 6 && hour < 20,
    ticksElapsed: tick,
  };
}

const CAPTAIN_TYPES_SC = new Set([
  'pirate_captain', 'merchant_captain', 'naval_officer', 'privateer_captain', 'pirate_hunter',
]);

/** Extract action names from the WHAT YOU COULD DO section of the prompt text.
 *  This is the source of truth for what the LLM sees — prevents OOB mismatch. */
function extractActionsFromPrompt(prompt: string): string[] {
  const actions: string[] = [];
  const lines = prompt.split('\n');
  let inChoices = false;
  for (const line of lines) {
    if (line.includes('WHAT YOU COULD DO')) { inChoices = true; continue; }
    if (inChoices && line.startsWith('==')) break;
    if (inChoices && line.startsWith('What do you do')) break;
    if (inChoices) {
      const m = line.match(/^\s*\d+\.\s+([^—\n]+)/);
      if (m) {
        // "1. sell plunder" → "sell_plunder"
        actions.push(m[1]!.trim().replace(/\s+/g, '_'));
      }
    }
  }
  return actions;
}

function shortCircuit(agent: AgentState, sa?: { confirmedDead?: boolean }): string | null {
  // Dead or fled — nothing to decide. confirmedDead prevents zombie resurrection.
  if (agent.status === AgentStatus.DEAD || agent.status === AgentStatus.FLED || sa?.confirmedDead) {
    return 'do_nothing';
  }

  // Imprisoned — release after ~3 days (72 ticks) of imprisonment
  if (agent.status === AgentStatus.IMPRISONED) {
    return 'do_nothing';
  }

  // At sea: pirate/privateer captains always get LLM decisions (they hunt NPC ships)
  // Other captains only need LLM if other ships are nearby
  // Non-captains at sea have nothing to decide; travel-tick handles movement
  if (agent.status === AgentStatus.AT_SEA) {
    if (agent.type === 'pirate_captain' || agent.type === 'privateer_captain') {
      return null; // always LLM — can choose attack_ship against NPC targets from DB
    }
    if (CAPTAIN_TYPES_SC.has(agent.type)) {
      const zoneShips = agent.seaZoneId ? getShipsInZone(agent.seaZoneId) : [];
      const otherShips = zoneShips.filter(id => id !== agent.shipId);
      if (otherShips.length === 0) {
        return 'do_nothing'; // no encounters possible, travel-tick handles movement
      }
      return null; // ships nearby — LLM decides
    }
    return 'do_nothing';
  }

  return null; // proceed to LLM / rule-based decision
}

import type { TickHandler, TickContext, TickPhase, GameTime } from './types.js';
import { Season } from './types.js';

type TickMode = 'game' | 'sim';

interface TickSchedulerOptions {
  mode: TickMode;
  intervalMs: number;
  onTick?: (ctx: TickContext) => void;
  onError?: (error: Error, handler: string) => void;
}

const PHASE_ORDER: TickPhase[] = [
  'world' as TickPhase,
  'decay' as TickPhase,
  'economy' as TickPhase,
  'agents' as TickPhase,
  'events' as TickPhase,
  'cleanup' as TickPhase,
];

export class TickScheduler {
  private handlers: TickHandler[] = [];
  private tickNumber = 0;
  private running = false;
  private paused = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private mode: TickMode;
  private intervalMs: number;
  private onTick?: (ctx: TickContext) => void;
  private onError?: (error: Error, handler: string) => void;
  private gameTime: GameTime;

  constructor(options: TickSchedulerOptions) {
    this.mode = options.mode;
    this.intervalMs = options.intervalMs;
    this.onTick = options.onTick;
    this.onError = options.onError;
    this.gameTime = {
      year: 1715,
      month: 1,
      day: 1,
      hour: 8,
      season: Season.WINTER,
      isDay: true,
      ticksElapsed: 0,
    };
  }

  registerHandler(handler: TickHandler): void {
    this.handlers.push(handler);
    // Sort by phase order
    this.handlers.sort((a, b) =>
      PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase)
    );
  }

  registerHandlers(handlers: TickHandler[]): void {
    handlers.forEach(h => this.registerHandler(h));
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.paused = false;

    if (this.mode === 'sim') {
      // Sim mode: tick as fast as handlers complete
      await this.simLoop();
    } else {
      // Game mode: tick at wall-clock intervals
      this.scheduleNext();
    }
  }

  stop(): void {
    this.running = false;
    this.paused = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.mode === 'game') {
      this.scheduleNext();
    }
  }

  getTickNumber(): number {
    return this.tickNumber;
  }

  getGameTime(): GameTime {
    return { ...this.gameTime };
  }

  setGameTime(time: Partial<GameTime>): void {
    Object.assign(this.gameTime, time);
  }

  isRunning(): boolean {
    return this.running && !this.paused;
  }

  private async simLoop(): Promise<void> {
    while (this.running) {
      if (this.paused) {
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }
      await this.executeTick();
    }
  }

  private scheduleNext(): void {
    if (!this.running || this.paused) return;
    this.timer = setTimeout(async () => {
      await this.executeTick();
      this.scheduleNext();
    }, this.intervalMs);
  }

  private async executeTick(): Promise<void> {
    this.tickNumber++;
    this.advanceGameTime();

    const ctx: TickContext = {
      tickNumber: this.tickNumber,
      timestamp: new Date(),
      gameTime: { ...this.gameTime },
      deltaMs: this.intervalMs,
    };

    // Execute handlers in phase order
    // Handlers in the same phase run sequentially (could be parallelized later if safe)
    for (const handler of this.handlers) {
      try {
        await handler.execute(ctx);
      } catch (err) {
        if (this.onError) {
          this.onError(err instanceof Error ? err : new Error(String(err)), handler.name);
        }
      }
    }

    if (this.onTick) {
      this.onTick(ctx);
    }
  }

  private advanceGameTime(): void {
    const gt = this.gameTime;
    gt.ticksElapsed++;

    // Each tick = 1 game hour (configurable based on sim speed)
    gt.hour++;
    if (gt.hour >= 24) {
      gt.hour = 0;
      gt.day++;

      const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (gt.day > daysInMonth[gt.month]!) {
        gt.day = 1;
        gt.month++;
        if (gt.month > 12) {
          gt.month = 1;
          gt.year++;
        }
      }
    }

    // Update derived fields
    gt.isDay = gt.hour >= 6 && gt.hour < 20;
    gt.season = this.getSeason(gt.month);
  }

  private getSeason(month: number): Season {
    if (month >= 3 && month <= 5) return Season.SPRING;
    if (month >= 6 && month <= 8) return Season.SUMMER;
    if (month >= 9 && month <= 11) return Season.AUTUMN;
    return Season.WINTER;
  }
}

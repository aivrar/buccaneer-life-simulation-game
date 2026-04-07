/**
 * Virtual clock with configurable speed.
 * In sim mode, time advances as fast as ticks complete.
 * In game mode, time tracks wall-clock at a configurable ratio.
 */
export class SimClock {
  private startTime: number;
  private pausedAt: number | null = null;
  private totalPausedMs = 0;
  private speedMultiplier: number;

  constructor(speedMultiplier = 1) {
    this.startTime = Date.now();
    this.speedMultiplier = speedMultiplier;
  }

  getElapsedMs(): number {
    const now = this.pausedAt ?? Date.now();
    return (now - this.startTime - this.totalPausedMs) * this.speedMultiplier;
  }

  getElapsedSeconds(): number {
    return this.getElapsedMs() / 1000;
  }

  pause(): void {
    if (!this.pausedAt) {
      this.pausedAt = Date.now();
    }
  }

  resume(): void {
    if (this.pausedAt) {
      this.totalPausedMs += Date.now() - this.pausedAt;
      this.pausedAt = null;
    }
  }

  isPaused(): boolean {
    return this.pausedAt !== null;
  }

  setSpeed(multiplier: number): void {
    this.speedMultiplier = multiplier;
  }

  reset(): void {
    this.startTime = Date.now();
    this.pausedAt = null;
    this.totalPausedMs = 0;
  }
}

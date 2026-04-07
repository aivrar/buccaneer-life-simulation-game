import type { TickContext } from '../runtime/types.js';

export class SimMetrics {
  private totalDecisions = 0;
  private decisionsByType = new Map<string, number>();
  private decisionsByAgent = new Map<string, number>();
  private tickCount = 0;
  private tickDurations: number[] = [];
  private lastTickTime = 0;

  recordTick(ctx: TickContext): void {
    this.tickCount++;
    const now = Date.now();
    if (this.lastTickTime > 0) {
      this.tickDurations.push(now - this.lastTickTime);
    }
    this.lastTickTime = now;
  }

  recordDecision(agentId: string, agentType: string, action: string): void {
    this.totalDecisions++;
    this.decisionsByType.set(action, (this.decisionsByType.get(action) ?? 0) + 1);
    this.decisionsByAgent.set(agentId, (this.decisionsByAgent.get(agentId) ?? 0) + 1);
  }

  getTotalDecisions(): number {
    return this.totalDecisions;
  }

  getDecisionDistribution(): Record<string, number> {
    return Object.fromEntries(this.decisionsByType);
  }

  getActiveAgentCount(): number {
    return this.decisionsByAgent.size;
  }

  getAvgTickDuration(): number {
    if (this.tickDurations.length === 0) return 0;
    return this.tickDurations.reduce((a, b) => a + b, 0) / this.tickDurations.length;
  }

  getSummary() {
    return {
      totalTicks: this.tickCount,
      totalDecisions: this.totalDecisions,
      activeAgents: this.decisionsByAgent.size,
      avgTickDurationMs: this.getAvgTickDuration(),
      topActions: [...this.decisionsByType.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([action, count]) => ({ action, count })),
    };
  }

  reset(): void {
    this.totalDecisions = 0;
    this.decisionsByType.clear();
    this.decisionsByAgent.clear();
    this.tickCount = 0;
    this.tickDurations = [];
    this.lastTickTime = 0;
  }
}

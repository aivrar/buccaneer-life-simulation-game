import type { AgentState, AgentDecision, TickContext, WorldState, LLMMessage } from './types.js';
import { MemoryType } from './types.js';
import { LLMClient } from './llm-client.js';
import { MemoryStore } from './memory-store.js';
import { getMaxConcurrentLLM } from '../config/index.js';
import { AGENT_TYPE_CONFIGS } from '../config/agents.js';
import { buildNarrativePrompt } from '../strategy/narrative-prompt.js';
import { getHistoricalSystemPrompt } from '../agents/historical-figures.js';
import { fillSystemPrompt } from '../strategy/hybrid.js';

interface AgentRunnerDeps {
  llmClient: LLMClient;
  memoryStore: MemoryStore;
  filterActions: (agent: AgentState, worldState: WorldState) => string[];
  parseResponse: (content: string, validActions: string[]) => { action: string; params: Record<string, unknown>; reasoning: string } | null;
  executeAction: (agent: AgentState, decision: AgentDecision) => Promise<void>;
}

export class AgentRunner {
  private deps: AgentRunnerDeps;
  private maxConcurrent: number;

  constructor(deps: AgentRunnerDeps) {
    this.deps = deps;
    this.maxConcurrent = getMaxConcurrentLLM();
  }

  async runBatch(agents: AgentState[], worldState: WorldState, tick: TickContext): Promise<AgentDecision[]> {
    const decisions: AgentDecision[] = [];

    // Filter to agents ready for a decision
    const ready = agents.filter(a =>
      a.status === 'active' || a.status === 'in_port' || a.status === 'at_sea'
    ).filter(a =>
      a.cooldownUntilTick <= tick.tickNumber
    );

    // Process in batches for concurrency control
    for (let i = 0; i < ready.length; i += this.maxConcurrent) {
      const batch = ready.slice(i, i + this.maxConcurrent);
      const results = await Promise.allSettled(
        batch.map(agent => this.runSingle(agent, worldState, tick))
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          decisions.push(result.value);
        } else if (result.status === 'rejected') {
          console.error('Agent decision failed:', result.reason);
        }
      }
    }

    return decisions;
  }

  async runSingle(agent: AgentState, worldState: WorldState, tick: TickContext): Promise<AgentDecision | null> {
    const typeConfig = AGENT_TYPE_CONFIGS[agent.type];
    if (!typeConfig) {
      console.warn(`Unknown agent type: ${agent.type}`);
      return null;
    }

    // 1. Filter available actions
    const validActions = this.deps.filterActions(agent, worldState);
    if (validActions.length === 0) {
      return null;
    }

    // 2. Build complete narrative prompt (proprioception + nudges + memories + planning)
    const userPrompt = await buildNarrativePrompt(
      agent, worldState, this.deps.memoryStore, validActions,
    );

    // 3. Build system prompt — historical figures get character-specific prompts
    const historicalPrompt = getHistoricalSystemPrompt(agent.id);
    const systemPrompt = fillSystemPrompt(
      historicalPrompt ?? typeConfig.systemPromptTemplate, agent, worldState,
    );

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    // 4. LLM call
    const response = await this.deps.llmClient.chatCompletion({
      messages,
      temperature: typeConfig.inferenceTier === 'high' ? 0.7 : 0.5,
      maxTokens: 250,
    });

    // 5. Parse response
    const parsed = this.deps.parseResponse(response.content, validActions);
    if (!parsed) {
      console.warn(`Failed to parse response for agent ${agent.name}: ${response.content.slice(0, 100)}`);
      return null;
    }

    const decision: AgentDecision = {
      agentId: agent.id,
      action: parsed.action,
      params: parsed.params,
      reasoning: parsed.reasoning,
      confidence: 1.0,
      tickNumber: tick.tickNumber,
    };

    // 6. Execute action
    await this.deps.executeAction(agent, decision);

    // 7. Store decision as working memory
    this.deps.memoryStore.addMemory(
      agent.id,
      `I decided to ${parsed.action}: ${parsed.reasoning}`,
      MemoryType.WORKING,
      5,
    );

    return decision;
  }
}

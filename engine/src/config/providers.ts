/**
 * Provider Configuration — toggle between local vLLM and OpenRouter.
 *
 * Switch via .env:
 *   LLM_PROVIDER=local        → local vLLM (RTX 3090)
 *   LLM_PROVIDER=openrouter   → OpenRouter (Gemini 2.5 Flash default)
 *
 * Embeddings are DISABLED (text-only mode). Memory uses SQL-based
 * recency + importance ranking instead of semantic search.
 * This avoids the embedding table bloat that killed performance in RAVE LIFE.
 */

import { getConfig } from './index.js';

export interface LLMProviderConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
  isFrontier: boolean;
  maxContext: number;
  supportsJsonMode: boolean;
  supportsStructuredOutput: boolean;
  defaultParams: {
    temperature: number;
    topP: number;
    maxTokens: number;
  };
}

export interface ProprioceptionLimits {
  maxCrewMembers: number;
  maxCargoItems: number;
  maxIntel: number;
  maxNearbyShips: number;
  maxRecentEvents: number;
  maxMemories: number;
  maxBounties: number;
  maxMarketPrices: number;
  maxNavyCases: number;
  maxReputation: number;
}

export function getLLMProviderConfig(): LLMProviderConfig {
  const config = getConfig();

  if (config.LLM_PROVIDER === 'openrouter') {
    return {
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: config.OPENROUTER_API_KEY,
      model: config.OPENROUTER_LLM_MODEL,
      isFrontier: true,
      maxContext: 200000,       // Gemini 2.5 Flash has 1M context, but 200K is practical limit
      supportsJsonMode: true,
      supportsStructuredOutput: false,
      defaultParams: {
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 1024,
      },
    };
  }

  // Local vLLM — Qwen 3.5-9B on RTX 3090
  // max_model_len=2048, prefix caching enabled
  return {
    baseUrl: config.VLLM_URL,
    model: config.VLLM_MODEL,
    isFrontier: false,
    maxContext: 2048,
    supportsJsonMode: false,
    supportsStructuredOutput: false,
    defaultParams: {
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 250,
    },
  };
}

export function getProprioceptionLimits(): ProprioceptionLimits {
  const provider = getLLMProviderConfig();

  if (provider.isFrontier) {
    // Gemini 2.5 Flash — 200K+ context, can handle rich proprioception
    return {
      maxCrewMembers: 24,
      maxCargoItems: 20,
      maxIntel: 25,
      maxNearbyShips: 15,
      maxRecentEvents: 20,
      maxMemories: 15,
      maxBounties: 10,
      maxMarketPrices: 30,
      maxNavyCases: 5,
      maxReputation: 10,
    };
  }

  // Local model — tight context budget
  return {
    maxCrewMembers: 6,
    maxCargoItems: 8,
    maxIntel: 5,
    maxNearbyShips: 5,
    maxRecentEvents: 5,
    maxMemories: 5,
    maxBounties: 3,
    maxMarketPrices: 10,
    maxNavyCases: 2,
    maxReputation: 4,
  };
}

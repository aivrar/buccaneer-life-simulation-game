/**
 * Model-specific configuration for think token handling, chat templates,
 * and recommended server flags.
 */

export interface ModelConfig {
  /** Display name */
  name: string;
  /** Glob pattern to match model filenames */
  filePattern: string;
  /** Model weights size in GB (approximate, for VRAM budgeting) */
  weightsGb: number;
  /** How to disable think/reasoning tokens */
  thinkMode: {
    /** Does this model have think tokens? */
    hasThinkTokens: boolean;
    /** Chat template kwarg to disable thinking */
    templateKwarg?: Record<string, unknown>;
    /** Token IDs to ban via logit bias (fallback if template doesn't work) */
    banTokenIds?: number[];
  };
  /** Extra llama-server flags */
  extraArgs?: string[];
  /** Recommended temperature for agent workloads */
  agentTemperature: number;
  /** License */
  license: string;
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'gemma4-e4b': {
    name: 'Gemma 4 E4B (Uncensored)',
    filePattern: '**/Gemma-4-E4B*',
    weightsGb: 5.1,
    thinkMode: {
      hasThinkTokens: true,
      // Gemma 4: token 98 = <|think|>. Banning this single token prevents think mode entirely.
      // The closing </|think|> is multi-token (236820,236909,236786,36345,111038) — no need to ban.
      banTokenIds: [98],
    },
    agentTemperature: 1.0, // Gemma 4 recommended: temp=1.0, top_p=0.95, top_k=64
    license: 'Apache-2.0',
  },

  'gemma4-26b-a4b': {
    name: 'Gemma 4 26B-A4B (MoE)',
    filePattern: '**/gemma-4-26B*',
    weightsGb: 16.8, // Q4_K_M
    thinkMode: {
      hasThinkTokens: true,
      templateKwarg: { enable_thinking: false },
      // 31B and 26B may still emit empty <|think|> blocks even with template disabled
    },
    agentTemperature: 1.0,
    license: 'Apache-2.0',
  },

  'qwen35-9b': {
    name: 'Qwen 3.5-9B (Abliterated)',
    filePattern: '**/Qwen3.5-9B*',
    weightsGb: 5.5, // Q4_K_M
    thinkMode: {
      hasThinkTokens: true,
      templateKwarg: { enable_thinking: false },
      // Qwen 3.5: template alone is unreliable. Must also ban token IDs.
      // These are Qwen3.5 tokenizer-specific.
      banTokenIds: [248068, 248069], // <think>, </think>
    },
    agentTemperature: 0.7,
    license: 'Apache-2.0',
  },

  'qwen35-4b': {
    name: 'Qwen 3.5-4B',
    filePattern: '**/Qwen3.5-4B*',
    weightsGb: 2.8,
    thinkMode: {
      hasThinkTokens: true,
      templateKwarg: { enable_thinking: false },
      banTokenIds: [248068, 248069],
    },
    agentTemperature: 0.7,
    license: 'Apache-2.0',
  },
};

/** Try to match a model file path to a known config. */
export function detectModelConfig(modelPath: string): ModelConfig | null {
  const lower = modelPath.toLowerCase();
  if (lower.includes('gemma-4-e4b') || lower.includes('gemma4-e4b')) return MODEL_CONFIGS['gemma4-e4b']!;
  if (lower.includes('gemma-4-26b')) return MODEL_CONFIGS['gemma4-26b-a4b']!;
  if (lower.includes('qwen3.5-9b') || lower.includes('qwen35-9b')) return MODEL_CONFIGS['qwen35-9b']!;
  if (lower.includes('qwen3.5-4b') || lower.includes('qwen35-4b')) return MODEL_CONFIGS['qwen35-4b']!;
  return null;
}

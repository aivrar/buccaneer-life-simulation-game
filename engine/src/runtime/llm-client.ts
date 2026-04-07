import { getLLMProviderConfig, type LLMProviderConfig } from '../config/providers.js';
import { detectModelConfig } from '../config/models.js';
import type { LLMRequest, LLMResponse, LLMMessage } from './types.js';

interface ConcurrencyOptions {
  maxConcurrent: number;
  timeoutMs: number;
  maxRetries: number;
}

export class LLMClient {
  private provider: LLMProviderConfig;
  private thinkBanBias: Record<string, number> | null = null;
  private activeRequests = 0;
  private queue: Array<{
    request: LLMRequest;
    resolve: (value: LLMResponse) => void;
    reject: (error: Error) => void;
  }> = [];
  private maxConcurrent: number;
  private timeoutMs: number;
  private maxRetries: number;

  // Latency tracking
  private latencies: number[] = [];
  private totalRequests = 0;
  private failedRequests = 0;

  constructor(options?: Partial<ConcurrencyOptions>) {
    this.provider = getLLMProviderConfig();
    this.maxConcurrent = options?.maxConcurrent ?? 8;
    this.timeoutMs = options?.timeoutMs ?? 120000;
    this.maxRetries = options?.maxRetries ?? 2;

    // Build logit_bias to ban think tokens at generation time.
    // This physically prevents the model from generating think tokens — zero tokens wasted.
    // Same approach as the vLLM serve.py logit_bias={248068: -100, 248069: -100}.
    const modelConfig = detectModelConfig(this.provider.model);
    const banIds = modelConfig?.thinkMode.banTokenIds;
    if (banIds?.length) {
      this.thinkBanBias = {};
      for (const id of banIds) this.thinkBanBias[String(id)] = -100;
    }
  }

  async chatCompletion(request: LLMRequest): Promise<LLMResponse> {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const item = this.queue.shift();
      if (!item) break;

      this.activeRequests++;
      this.executeRequest(item.request)
        .then(item.resolve)
        .catch(item.reject)
        .finally(() => {
          this.activeRequests--;
          this.processQueue();
        });
    }
  }

  private async executeRequest(request: LLMRequest, attempt = 0): Promise<LLMResponse> {
    const startTime = Date.now();
    this.totalRequests++;

    // llama-server uses --reasoning off to disable think tokens at the server level.
    // No nonce injection needed — llama-server's slot system isolates requests (no KV bleed).
    // No chat_template_kwargs needed — --reasoning off replaces the deprecated flag.

    const body: Record<string, unknown> = {
      model: this.provider.model,
      messages: request.messages,
      temperature: request.temperature ?? this.provider.defaultParams.temperature,
      max_tokens: request.maxTokens ?? this.provider.defaultParams.maxTokens,
      top_p: request.topP ?? this.provider.defaultParams.topP,
    };

    if (request.jsonMode && this.provider.supportsJsonMode) {
      body.response_format = { type: 'json_object' };
    }

    // Ban think tokens via logit_bias — prevents generation, zero tokens wasted
    if (this.thinkBanBias) {
      body.logit_bias = this.thinkBanBias;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.provider.apiKey) {
      headers['Authorization'] = `Bearer ${this.provider.apiKey}`;
    }

    const url = `${this.provider.baseUrl}/chat/completions`;

    try {
      // Use AbortSignal.timeout() where available, otherwise manual AbortController.
      // Manual abort + clearTimeout can trigger libuv handle assertion crashes on Windows
      // when the timeout fires after the request has already completed.
      const signal = typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(this.timeoutMs)
        : undefined;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        ...(signal ? { signal } : {}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error ${response.status}: ${errorText}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        model?: string;
      };

      const latencyMs = Date.now() - startTime;
      this.latencies.push(latencyMs);

      // Safety net: strip any leaked think blocks (both Qwen <think> and Gemma <|think|> formats)
      let content = data.choices[0]?.message?.content ?? '';
      if (content.includes('<think>') || content.includes('<|think|>')) {
        content = content
          .replace(/<\|?think\|?>[\s\S]*?<\|?\/?think\|?>/g, '')
          .replace(/<\|?think\|?>[\s\S]*/g, '') // unterminated
          .trim();
      }

      return {
        content,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
        latencyMs,
        model: data.model ?? this.provider.model,
      };
    } catch (err) {
      if (attempt < this.maxRetries) {
        // Exponential backoff
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        return this.executeRequest(request, attempt + 1);
      }
      this.failedRequests++;
      throw err;
    }
  }

  getStats() {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    return {
      totalRequests: this.totalRequests,
      failedRequests: this.failedRequests,
      activeRequests: this.activeRequests,
      queueLength: this.queue.length,
      avgLatencyMs: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0,
      p50LatencyMs: sorted.length ? sorted[Math.floor(sorted.length * 0.5)]! : 0,
      p95LatencyMs: sorted.length ? sorted[Math.floor(sorted.length * 0.95)]! : 0,
      provider: this.provider.model,
    };
  }

  resetStats(): void {
    this.latencies = [];
    this.totalRequests = 0;
    this.failedRequests = 0;
  }
}

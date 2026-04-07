/**
 * Stress test: ramp up concurrent agents to find the real limits.
 * Requires llama-server already running (use --external with poc.ts or start manually).
 *
 * Usage:
 *   npm run stress                          # default: ramp 10 → 100
 *   npm run stress -- --max 200 --step 20   # ramp 20 → 200 in steps of 20
 *   npm run stress -- --port 8080
 */

import { LLMClient } from './runtime/llm-client.js';

const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1]! : fallback;
}

const PORT = parseInt(getArg('port', '8080'), 10);
const MAX_AGENTS = parseInt(getArg('max', '100'), 10);
const STEP = parseInt(getArg('step', '10'), 10);
const START = parseInt(getArg('start', '10'), 10);

const PROMPT = {
  messages: [
    { role: 'system' as const, content: 'You are a pirate. Pick one action: [fight, flee, negotiate, wait]. Reply with the action name only.' },
    { role: 'user' as const, content: 'A navy ship approaches. What do you do?' },
  ],
  temperature: 0.8,
  maxTokens: 32,
};

async function runBatch(client: LLMClient, count: number) {
  const start = Date.now();
  const promises = Array.from({ length: count }, () =>
    client.chatCompletion(PROMPT)
      .then(() => true)
      .catch(() => false)
  );
  const results = await Promise.all(promises);
  const elapsed = Date.now() - start;
  const successes = results.filter(Boolean).length;
  return { count, successes, failures: count - successes, elapsed };
}

async function main() {
  console.log('=== STRESS TEST ===');
  console.log(`Server: http://127.0.0.1:${PORT} | Ramp: ${START} → ${MAX_AGENTS} (step ${STEP})`);
  console.log();

  // Check server health
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/health`);
    if (!res.ok) throw new Error(`Health check returned ${res.status}`);
    console.log('Server healthy.\n');
  } catch (err) {
    console.error(`Cannot reach server on port ${PORT}. Start llama-server first.`);
    process.exit(1);
  }

  console.log('Concurrent | Success | Failed | Wall Time | Avg Latency | P95 Latency | Throughput');
  console.log('-----------|---------|--------|-----------|-------------|-------------|----------');

  for (let n = START; n <= MAX_AGENTS; n += STEP) {
    const client = new LLMClient({
      baseUrl: `http://127.0.0.1:${PORT}/v1`,
      maxConcurrent: n,
      timeoutMs: 60000,
      maxRetries: 0, // no retries during stress test
    });

    const result = await runBatch(client, n);
    const stats = client.getStats();
    const throughput = (result.successes / (result.elapsed / 1000)).toFixed(1);

    console.log(
      `${String(n).padStart(10)} | ` +
      `${String(result.successes).padStart(7)} | ` +
      `${String(result.failures).padStart(6)} | ` +
      `${String(result.elapsed + 'ms').padStart(9)} | ` +
      `${String(Math.round(stats.avgLatencyMs) + 'ms').padStart(11)} | ` +
      `${String(Math.round(stats.p95LatencyMs) + 'ms').padStart(11)} | ` +
      `${throughput.padStart(10)}/s`
    );

    // Stop if we see failures
    if (result.failures > 0) {
      console.log(`\n⚠ Failures detected at ${n} concurrent. Max safe concurrency: ${n - STEP}`);
      break;
    }
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

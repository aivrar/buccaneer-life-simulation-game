/**
 * Proof-of-concept: spawn llama-server and run concurrent agent decisions.
 *
 * Usage:
 *   npm run poc                       # auto-detect GPU, use defaults
 *   npm run poc -- --agents 50        # test with 50 concurrent agents
 *   npm run poc -- --model path.gguf  # specify model
 *   npm run poc -- --external         # skip spawning, use existing server on :8080
 */

import path from 'node:path';
import { ServerManager } from './runtime/server-manager.js';
import { LLMClient } from './runtime/llm-client.js';
import { GPU_PROFILES, autoSelectProfile } from './config/gpu-profiles.js';
import type { ServerConfig, GpuProfile } from './runtime/types.js';

// --- Parse CLI args ---
const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1]! : fallback;
}
const hasFlag = (name: string) => args.includes(`--${name}`);

const AGENT_COUNT = parseInt(getArg('agents', '20'), 10);
const MODEL_PATH = getArg('model', path.resolve('..', 'models', 'model.gguf'));
const PORT = parseInt(getArg('port', '8080'), 10);
const PROFILE_NAME = getArg('profile', '');
const EXTERNAL = hasFlag('external');

// --- Agent prompts ---
const AGENT_TYPES = [
  { type: 'pirate_captain', prompt: 'You are a feared pirate captain. Choose your next action: [raid_merchant, sail_to_port, recruit_crew, repair_ship]. Respond with just the action name and a one-sentence reason.' },
  { type: 'naval_officer', prompt: 'You are a Royal Navy officer on patrol. Choose your next action: [pursue_pirate, patrol_lanes, report_to_admiralty, inspect_vessel]. Respond with just the action name and a one-sentence reason.' },
  { type: 'merchant', prompt: 'You are a merchant captain sailing the Caribbean. Choose your next action: [trade_cargo, hire_guards, change_route, bribe_official]. Respond with just the action name and a one-sentence reason.' },
  { type: 'tavern_keeper', prompt: 'You are a tavern keeper in a pirate port. Choose your next action: [serve_drinks, sell_intel, shelter_fugitive, recruit_informant]. Respond with just the action name and a one-sentence reason.' },
  { type: 'fence', prompt: 'You are a black market fence. Choose your next action: [buy_plunder, sell_goods, bribe_guard, establish_contact]. Respond with just the action name and a one-sentence reason.' },
];

function makeAgentPrompt(agentId: number) {
  const template = AGENT_TYPES[agentId % AGENT_TYPES.length]!;
  return {
    type: template.type,
    messages: [
      { role: 'system' as const, content: `${template.prompt}\nYou are Agent #${agentId}. The weather is stormy, crew morale is low.` },
      { role: 'user' as const, content: 'What do you do?' },
    ],
  };
}

// --- Main ---
async function main() {
  console.log('=== LLAMA GAME — Concurrent Agent POC ===');
  console.log(`Agents: ${AGENT_COUNT} | Model: ${MODEL_PATH} | Port: ${PORT}`);
  console.log();

  let server: ServerManager | null = null;

  if (!EXTERNAL) {
    // Resolve GPU profile
    const profile: GpuProfile = PROFILE_NAME
      ? GPU_PROFILES[PROFILE_NAME]!
      : autoSelectProfile(24); // default to 24GB, adjust as needed

    if (!profile) {
      console.error(`Unknown profile: ${PROFILE_NAME}`);
      console.error(`Available: ${Object.keys(GPU_PROFILES).join(', ')}`);
      process.exit(1);
    }

    console.log(`GPU Profile: ${profile.name} — ${profile.description}`);
    console.log(`Parallel: ${profile.parallel} | Context: ${profile.ctxSize} | KV: ${profile.cacheTypeK}`);
    console.log();

    const config: ServerConfig = {
      modelPath: MODEL_PATH,
      host: '127.0.0.1',
      port: PORT,
      gpuLayers: 999,
      parallel: Math.max(profile.parallel, AGENT_COUNT),
      ctxSize: profile.ctxSize,
      cacheTypeK: profile.cacheTypeK,
      cacheTypeV: profile.cacheTypeV,
      flashAttn: profile.flashAttn,
      contBatching: true,
      batchSize: 2048,
      ubatchSize: 512,
      cudaDevice: 0, // pin to primary GPU
    };

    server = new ServerManager(config);
    await server.start();
  } else {
    console.log(`Using external server at http://127.0.0.1:${PORT}`);
  }

  const client = new LLMClient({
    baseUrl: `http://127.0.0.1:${PORT}/v1`,
    maxConcurrent: AGENT_COUNT,
    timeoutMs: 30000,
  });

  // Fire all agents simultaneously
  console.log(`\nFiring ${AGENT_COUNT} agent decisions simultaneously...`);
  const batchStart = Date.now();

  const promises = Array.from({ length: AGENT_COUNT }, (_, i) => {
    const agent = makeAgentPrompt(i);
    return client.chatCompletion({
      messages: agent.messages,
      temperature: 0.8,
      maxTokens: 64,
    }).then(res => ({ agentId: i, type: agent.type, response: res, error: null }))
      .catch(err => ({ agentId: i, type: agent.type, response: null, error: err as Error }));
  });

  const results = await Promise.all(promises);
  const batchMs = Date.now() - batchStart;

  // Report
  console.log('\n=== RESULTS ===\n');

  let successes = 0;
  let failures = 0;
  for (const r of results) {
    if (r.response) {
      successes++;
      const content = r.response.content.slice(0, 80).replace(/\n/g, ' ');
      console.log(`  Agent #${r.agentId} (${r.type}): ${content}... [${r.response.latencyMs}ms]`);
    } else {
      failures++;
      console.log(`  Agent #${r.agentId} (${r.type}): FAILED — ${r.error?.message}`);
    }
  }

  const stats = client.getStats();
  console.log('\n=== STATS ===');
  console.log(`  Batch wall time: ${batchMs}ms`);
  console.log(`  Success: ${successes}/${AGENT_COUNT} | Failed: ${failures}`);
  console.log(`  Avg latency: ${Math.round(stats.avgLatencyMs)}ms`);
  console.log(`  P50 latency: ${Math.round(stats.p50LatencyMs)}ms`);
  console.log(`  P95 latency: ${Math.round(stats.p95LatencyMs)}ms`);
  console.log(`  Throughput: ${(successes / (batchMs / 1000)).toFixed(1)} agents/sec`);

  if (server) {
    console.log('\nShutting down llama-server...');
    await server.stop();
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

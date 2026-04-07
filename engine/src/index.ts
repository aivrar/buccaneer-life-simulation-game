import dotenv from 'dotenv';
import { TickScheduler } from './runtime/tick-scheduler.js';
import { LLMClient } from './runtime/llm-client.js';
import { MemoryStore } from './runtime/memory-store.js';
import { bootstrapRegistry } from './agents/registry.js';
import { getAllHandlers } from './handlers/index.js';
import { getConfig, getTickIntervalMs } from './config/index.js';
import { createInitialGameTime } from './world/time.js';

dotenv.config();

async function main() {
  console.log('=== BUCCANEER LIFE ===');
  console.log('Golden Age of Piracy AI Agent Simulation\n');

  const config = getConfig();
  console.log(`LLM Provider: ${config.LLM_PROVIDER}`);
  console.log(`Tick Interval: ${config.SIM_TICK_INTERVAL_MS}ms`);
  console.log(`Max Concurrent LLM: ${config.SIM_MAX_CONCURRENT_LLM}`);

  // Bootstrap agent type registry
  bootstrapRegistry();
  console.log('Agent registry bootstrapped');

  // Initialize runtime
  const llmClient = new LLMClient({
    maxConcurrent: parseInt(config.SIM_MAX_CONCURRENT_LLM),
  });
  const memoryStore = new MemoryStore(config.SQLITE_PATH);
  console.log('Runtime initialized');

  // Create tick scheduler
  const scheduler = new TickScheduler({
    mode: 'game',
    intervalMs: getTickIntervalMs(),
    onTick: (ctx) => {
      if (ctx.tickNumber % 24 === 0) {
        const gt = ctx.gameTime;
        console.log(`[Day ${Math.floor(ctx.tickNumber / 24)}] ${gt.year}-${gt.month}-${gt.day} | Tick ${ctx.tickNumber}`);
      }
    },
    onError: (err, handler) => {
      console.error(`[ERROR] Handler ${handler}: ${err.message}`);
    },
  });

  // Set initial game time
  scheduler.setGameTime(createInitialGameTime(1715, 1, 1));

  // Register all tick handlers
  const handlers = getAllHandlers();
  scheduler.registerHandlers(handlers);
  console.log(`Registered ${handlers.length} tick handlers`);

  // Start tick loop
  console.log('\nStarting tick loop...\n');
  await scheduler.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    scheduler.stop();
    memoryStore.close();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

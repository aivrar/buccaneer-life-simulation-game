/**
 * LLAMA GAME — Play the game.
 *
 * Spawns llama-server, creates the starting world, and drops you into the hold.
 *
 * Usage:
 *   npm run play -- --model ../models/gemma4-e4b-uncensored/Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-Q4_K_P.gguf
 *   npm run play -- --external --port 8080   # use already-running server
 */

import path from 'node:path';
import { ServerManager } from './runtime/server-manager.js';
import { LLMClient } from './runtime/llm-client.js';
import { autoSelectProfile } from './config/gpu-profiles.js';
import { detectModelConfig } from './config/models.js';
import type { ServerConfig } from './runtime/types.js';
import { createStartingWorld } from './game/world-state.js';
import { createStartingPlayer } from './game/player-state.js';
import { createStartingCrew } from './agents/agent-state.js';
import { GameSession } from './game/game-session.js';

// CLI args
const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1]! : fallback;
}
const hasFlag = (name: string) => args.includes(`--${name}`);

const MODEL_PATH = getArg('model', path.resolve('..', 'models', 'model.gguf'));
const PORT = parseInt(getArg('port', '8080'), 10);
const EXTERNAL = hasFlag('external');

async function main() {
  let server: ServerManager | null = null;

  if (!EXTERNAL) {
    const profile = autoSelectProfile(24);
    const modelConfig = detectModelConfig(MODEL_PATH);

    const config: ServerConfig = {
      modelPath: MODEL_PATH,
      host: '127.0.0.1',
      port: PORT,
      gpuLayers: 999,
      parallel: profile.parallel,
      ctxSize: profile.ctxSize,
      cacheTypeK: profile.cacheTypeK,
      cacheTypeV: profile.cacheTypeV,
      flashAttn: profile.flashAttn,
      contBatching: true,
      batchSize: 2048,
      ubatchSize: 512,
      cudaDevice: 0,
    };

    server = new ServerManager(config);
    console.log('Loading AI engine...');
    await server.start();
    console.log('AI engine ready.\n');
  }

  const modelConfig = detectModelConfig(MODEL_PATH);
  const llm = new LLMClient({
    baseUrl: `http://127.0.0.1:${PORT}/v1`,
    maxConcurrent: 8,
    timeoutMs: 30000,
    modelConfig: modelConfig ?? undefined,
  });

  // Create the world
  const world = createStartingWorld();
  const agents = createStartingCrew();
  world.ship.captain = agents.find(a => a.type === 'pirate_captain')?.id ?? '';

  const player = createStartingPlayer('');

  // Start the game
  const session = new GameSession(llm, player, world, agents);

  // Cleanup on exit
  const cleanup = async () => {
    session.close();
    if (server) await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    await session.run();
  } finally {
    await cleanup();
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

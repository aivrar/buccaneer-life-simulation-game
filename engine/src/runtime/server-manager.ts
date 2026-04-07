import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import type { ServerConfig } from './types.js';
import { detectModelConfig, type ModelConfig } from '../config/models.js';

export class ServerManager {
  private process: ChildProcess | null = null;
  private config: ServerConfig;
  private llamaServerPath: string;
  private modelConfig: ModelConfig | null;

  constructor(config: ServerConfig, llamaServerPath?: string) {
    this.config = config;
    this.modelConfig = detectModelConfig(config.modelPath);
    this.llamaServerPath = llamaServerPath
      ?? path.resolve('..', 'llama.cpp', 'build', 'bin', 'Release', 'llama-server.exe');
  }

  async start(): Promise<void> {
    if (this.process) throw new Error('Server already running');

    const args = this.buildArgs();
    console.log(`[server-manager] Starting llama-server on :${this.config.port}`);
    console.log(`[server-manager] Model: ${this.config.modelPath}`);
    console.log(`[server-manager] Parallel slots: ${this.config.parallel} | Context: ${this.config.ctxSize}`);
    console.log(`[server-manager] KV cache: K=${this.config.cacheTypeK} V=${this.config.cacheTypeV} | Flash: ${this.config.flashAttn}`);
    console.log(`[server-manager] Args: ${args.join(' ')}`);

    // Pin to a single GPU if specified (avoids multi-GPU split assertion failures)
    const env = { ...process.env };
    if (this.config.cudaDevice !== undefined) {
      env.CUDA_VISIBLE_DEVICES = String(this.config.cudaDevice);
    }

    this.process = spawn(this.llamaServerPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line) console.log(`[llama-server] ${line}`);
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line) console.log(`[llama-server:err] ${line}`);
    });

    this.process.on('exit', (code) => {
      console.log(`[server-manager] llama-server exited with code ${code}`);
      this.process = null;
    });

    await this.waitForHealth();
  }

  async stop(): Promise<void> {
    if (!this.process) return;
    console.log('[server-manager] Stopping llama-server...');

    this.process.kill();
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.process?.kill('SIGKILL');
        resolve();
      }, 5000);
      this.process?.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    this.process = null;
  }

  get baseUrl(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }

  get isRunning(): boolean {
    return this.process !== null;
  }

  private buildArgs(): string[] {
    const args = [
      '--model', this.config.modelPath,
      '--host', this.config.host,
      '--port', String(this.config.port),
      '--ctx-size', String(this.config.ctxSize),
      '--parallel', String(this.config.parallel),
      '--n-gpu-layers', String(this.config.gpuLayers),
      '--cache-type-k', this.config.cacheTypeK,
      '--cache-type-v', this.config.cacheTypeV,
      '--batch-size', String(this.config.batchSize),
      '--ubatch-size', String(this.config.ubatchSize),
    ];

    if (this.config.flashAttn) args.push('--flash-attn', 'on');
    // cont-batching is enabled by default in recent llama.cpp

    // Disable think/reasoning tokens at the server level
    if (this.modelConfig?.thinkMode.hasThinkTokens) {
      args.push('--reasoning', 'off');
    }

    return args;
  }

  private async waitForHealth(maxWaitMs = 120000): Promise<void> {
    const start = Date.now();
    const url = `${this.baseUrl}/health`;

    while (Date.now() - start < maxWaitMs) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          console.log('[server-manager] llama-server is healthy');
          return;
        }
      } catch {
        // server not ready yet
      }
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error(`llama-server failed to start within ${maxWaitMs}ms`);
  }
}

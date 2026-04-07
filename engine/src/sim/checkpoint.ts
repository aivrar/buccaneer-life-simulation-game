import * as fs from 'fs';
import * as path from 'path';
import type { AgentState, GameTime } from '../runtime/types.js';

export interface Checkpoint {
  gameTime: GameTime;
  tickNumber: number;
  agents: AgentState[];
  timestamp: string;
  metadata: Record<string, unknown>;
}

const CHECKPOINT_DIR = './sim-output/checkpoints';

export function saveCheckpoint(checkpoint: Checkpoint): string {
  fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });

  const filename = `checkpoint_tick${checkpoint.tickNumber}_${Date.now()}.json`;
  const filepath = path.join(CHECKPOINT_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(checkpoint, null, 2));
  return filepath;
}

export function loadCheckpoint(filepath: string): Checkpoint | null {
  try {
    const data = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(data) as Checkpoint;
  } catch {
    return null;
  }
}

export function getLatestCheckpoint(): Checkpoint | null {
  if (!fs.existsSync(CHECKPOINT_DIR)) return null;

  const files = fs.readdirSync(CHECKPOINT_DIR)
    .filter(f => f.startsWith('checkpoint_') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;
  return loadCheckpoint(path.join(CHECKPOINT_DIR, files[0]!));
}

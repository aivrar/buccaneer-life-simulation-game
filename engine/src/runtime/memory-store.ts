/**
 * SQLite-backed agent memory store — TEXT-ONLY MODE.
 *
 * Uses sql.js (pure JS, no native compilation) instead of better-sqlite3.
 * No embeddings. Semantic search falls back to importance + recency ranking.
 * This keeps the DB lean and avoids the bloat that killed RAVE LIFE performance.
 */

import initSqlJs, { type Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import type { AgentMemoryRecord, MemoryType } from './types.js';

let sqlJsPromise: Promise<any> | null = null;

async function getSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs();
  }
  return sqlJsPromise;
}

export class MemoryStore {
  private db!: Database;
  private dbPath: string;
  private ready: Promise<void>;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.ready = this.init(dbPath);
  }

  private async init(dbPath: string): Promise<void> {
    const SQL = await getSqlJs();

    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Load existing DB or create new
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.db.run('PRAGMA journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS agent_memory (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT NOT NULL,
        importance INTEGER NOT NULL DEFAULT 5,
        is_traumatic INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        last_accessed_at TEXT NOT NULL,
        access_count INTEGER NOT NULL DEFAULT 0
      )
    `);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_memory_agent ON agent_memory(agent_id)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_memory_type ON agent_memory(agent_id, type)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_memory_importance ON agent_memory(agent_id, importance DESC)');
  }

  /** Ensure DB is initialized before any operation */
  async ensureReady(): Promise<void> {
    await this.ready;
  }

  addMemory(
    agentId: string,
    content: string,
    type: MemoryType,
    importance: number,
    isTraumatic = false,
  ): string {
    const id = uuid();
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO agent_memory (id, agent_id, content, type, importance, is_traumatic, created_at, last_accessed_at, access_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, agentId, content, type, importance, isTraumatic ? 1 : 0, now, now],
    );

    // Enforce working memory cap
    if (type === 'working') {
      this.capWorkingMemory(agentId, 20);
    }

    return id;
  }

  getWorkingMemory(agentId: string, limit = 10): AgentMemoryRecord[] {
    const rows = this.db.exec(
      `SELECT * FROM agent_memory
       WHERE agent_id = ? AND type = 'working'
       ORDER BY created_at DESC
       LIMIT ?`,
      [agentId, limit],
    );

    const records = rowsToRecords(rows);
    this.touchMemories(records.map(r => r.id));
    return records;
  }

  getEpisodicMemory(agentId: string, limit = 10): AgentMemoryRecord[] {
    const rows = this.db.exec(
      `SELECT *,
        (importance * 2 + (CASE WHEN is_traumatic THEN 50 ELSE 0 END) -
         (julianday('now') - julianday(last_accessed_at)) * 0.5) as score
       FROM agent_memory
       WHERE agent_id = ? AND type = 'episodic'
       ORDER BY score DESC
       LIMIT ?`,
      [agentId, limit],
    );

    const records = rowsToRecords(rows);
    this.touchMemories(records.map(r => r.id));
    return records;
  }

  /** Text-only search: falls back to importance + recency ranking. */
  searchSemantic(agentId: string, _query: string, limit = 5): AgentMemoryRecord[] {
    return this.getEpisodicMemory(agentId, limit);
  }

  getTraumaticMemories(agentId: string): AgentMemoryRecord[] {
    const rows = this.db.exec(
      `SELECT * FROM agent_memory
       WHERE agent_id = ? AND is_traumatic = 1
       ORDER BY importance DESC`,
      [agentId],
    );
    return rowsToRecords(rows);
  }

  deleteMemory(id: string): void {
    this.db.run('DELETE FROM agent_memory WHERE id = ?', [id]);
  }

  clearAgentMemory(agentId: string): void {
    this.db.run('DELETE FROM agent_memory WHERE agent_id = ?', [agentId]);
  }

  getMemoryCount(agentId: string): number {
    const rows = this.db.exec(
      'SELECT COUNT(*) as count FROM agent_memory WHERE agent_id = ?',
      [agentId],
    );
    return rows.length > 0 && rows[0]!.values.length > 0 ? (rows[0]!.values[0]![0] as number) : 0;
  }

  private capWorkingMemory(agentId: string, cap: number): void {
    this.db.run(
      `DELETE FROM agent_memory
       WHERE id IN (
         SELECT id FROM agent_memory
         WHERE agent_id = ? AND type = 'working' AND is_traumatic = 0
         ORDER BY created_at DESC
         LIMIT -1 OFFSET ?
       )`,
      [agentId, cap],
    );
  }

  private touchMemories(ids: string[]): void {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    for (const id of ids) {
      this.db.run(
        'UPDATE agent_memory SET last_accessed_at = ?, access_count = access_count + 1 WHERE id = ?',
        [now, id],
      );
    }
  }

  /** Persist DB to disk */
  save(): void {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  close(): void {
    try {
      this.save();
    } catch (e) {
      // Ignore save errors on shutdown
    }
    try {
      this.db.close();
    } catch (e) {
      // sql.js close() can trigger Node assertion errors on some platforms — safe to ignore
    }
  }
}

/**
 * Convert sql.js exec() result to AgentMemoryRecord[]
 */
function rowsToRecords(result: Array<{ columns: string[]; values: any[][] }>): AgentMemoryRecord[] {
  if (result.length === 0 || result[0]!.values.length === 0) return [];

  const cols = result[0]!.columns;
  return result[0]!.values.map(row => {
    const obj: Record<string, any> = {};
    cols.forEach((col, i) => { obj[col] = row[i]; });
    return {
      id: obj.id,
      agentId: obj.agent_id,
      content: obj.content,
      type: obj.type as MemoryType,
      importance: obj.importance,
      isTraumatic: obj.is_traumatic === 1,
      createdAt: new Date(obj.created_at),
      lastAccessedAt: new Date(obj.last_accessed_at),
      accessCount: obj.access_count,
    };
  });
}

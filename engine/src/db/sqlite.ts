import Database from 'better-sqlite3';
import dotenv from 'dotenv';

dotenv.config();

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(process.env.SQLITE_PATH || './game.db');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/** Sanitize params for SQLite: booleans → 0/1, objects/arrays → JSON string */
function sanitize(params?: any[]): any[] | undefined {
  if (!params) return params;
  return params.map(p => {
    if (p === true) return 1;
    if (p === false) return 0;
    if (p !== null && p !== undefined && typeof p === 'object') return JSON.stringify(p);
    return p;
  });
}

export async function query<T>(
  sql: string,
  params?: any[]
): Promise<T> {
  const stmt = getDb().prepare(sql);
  const safe = sanitize(params);
  const rows = safe ? stmt.all(...safe) : stmt.all();
  return rows as T;
}

export async function execute(
  sql: string,
  params?: any[]
): Promise<{ insertId: number | bigint; affectedRows: number }> {
  const stmt = getDb().prepare(sql);
  const safe = sanitize(params);
  const info = safe ? stmt.run(...safe) : stmt.run();
  return { insertId: info.lastInsertRowid, affectedRows: info.changes };
}

export async function transaction<T>(
  fn: (db: Database.Database) => T
): Promise<T> {
  const txn = getDb().transaction(() => {
    return fn(getDb());
  });
  return txn();
}

export async function closeDb(): Promise<void> {
  if (db) {
    db.close();
    db = null;
  }
}

// Aliases for backward compatibility
export { closeDb as closePool };

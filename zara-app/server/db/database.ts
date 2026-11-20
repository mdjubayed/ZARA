import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { SCHEMA_SQL } from './schema.js';

let database: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (database) return database;

  const dataDirectory = path.resolve(
    process.env.ZARA_DATA_DIR || path.join(process.cwd(), 'data')
  );

  mkdirSync(dataDirectory, { recursive: true });

  const databasePath = path.join(dataDirectory, 'zara.sqlite');

  database = new Database(databasePath);

  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');

  database.exec(SCHEMA_SQL);

  return database;
}

export function closeDatabase(): void {
  if (database) {
    database.close();
    database = null;
  }
}

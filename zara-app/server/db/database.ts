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

  // Keep the approved provider registry limited to the two supported brains.
  // Provider credentials are environment-only, so discard any legacy DB config.
  database.prepare("DELETE FROM providers WHERE id NOT IN ('omniroute', 'freellmapi')").run();
  database.prepare("UPDATE providers SET config = '{}'").run();

  const secretKeyPattern =
    /(api[_-]?key|secret|access[_-]?token|refresh[_-]?token|password|credential|authorization|private[_-]?key)/i;

  const sanitizeNestedSecrets = (value: unknown): { value: unknown; changed: boolean } => {
    if (Array.isArray(value)) {
      let changed = false;
      const sanitized = value.map((item) => {
        const result = sanitizeNestedSecrets(item);
        changed ||= result.changed;
        return result.value;
      });
      return { value: sanitized, changed };
    }

    if (value && typeof value === 'object') {
      let changed = false;
      const sanitized: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(value)) {
        if (secretKeyPattern.test(key)) {
          changed = true;
          continue;
        }
        const result = sanitizeNestedSecrets(nested);
        changed ||= result.changed;
        sanitized[key] = result.value;
      }
      return { value: sanitized, changed };
    }

    return { value, changed: false };
  };

  const settings = database
    .prepare('SELECT key, value FROM settings')
    .all() as Array<{ key: string; value: string }>;

  const deleteSetting = database.prepare('DELETE FROM settings WHERE key = ?');
  const updateSetting = database.prepare(
    'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
  );

  const sanitizeSettings = database.transaction(() => {
    for (const setting of settings) {
      if (secretKeyPattern.test(setting.key)) {
        deleteSetting.run(setting.key);
        continue;
      }

      try {
        const parsedValue: unknown = JSON.parse(setting.value);
        const sanitized = sanitizeNestedSecrets(parsedValue);
        if (sanitized.changed) {
          updateSetting.run(JSON.stringify(sanitized.value), setting.key);
        }
      } catch {
        // Non-JSON legacy settings are preserved unless their key is secret-like.
      }
    }
  });

  sanitizeSettings();

  return database;
}

export function closeDatabase(): void {
  if (database) {
    database.close();
    database = null;
  }
}

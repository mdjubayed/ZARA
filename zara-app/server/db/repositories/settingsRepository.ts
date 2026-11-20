import { getDatabase } from '../database.js';

export type SettingValue = string | number | boolean | object | null;

export function getSetting<T = SettingValue>(
  key: string,
  fallback: T | null = null
): T | null {
  const row = getDatabase()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(key) as { value: string } | undefined;

  if (!row) return fallback;

  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export function getAllSettings(): Record<string, SettingValue> {
  const rows = getDatabase()
    .prepare('SELECT key, value FROM settings')
    .all() as { key: string; value: string }[];

  const settings: Record<string, SettingValue> = {};

  for (const row of rows) {
    try {
      settings[row.key] = JSON.parse(row.value) as SettingValue;
    } catch {
      settings[row.key] = row.value;
    }
  }

  return settings;
}

export function setSetting(
  key: string,
  value: SettingValue
): void {
  getDatabase().prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `).run(key, JSON.stringify(value));
}

export function setMultipleSettings(
  settings: Record<string, SettingValue>
): void {
  const db = getDatabase();

  const save = db.transaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `).run(key, JSON.stringify(value));
    }
  });

  save();
}

export function deleteSetting(key: string): boolean {
  const result = getDatabase()
    .prepare('DELETE FROM settings WHERE key = ?')
    .run(key);

  return result.changes > 0;
}

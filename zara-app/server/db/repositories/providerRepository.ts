import { getDatabase } from '../database.js';

export type ProviderStatus =
  | 'unconfigured'
  | 'pending_verification'
  | 'ready'
  | 'disabled';

export interface Provider {
  id: string;
  name: string;
  status: ProviderStatus;
  enabled: number;
  config: string;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PROVIDERS = [
  { id: 'gemini', name: 'Google Gemini', status: 'unconfigured' },
  { id: 'freellmapi', name: 'FreeLLMAPI', status: 'pending_verification' },
  { id: 'openai-compatible', name: 'OpenAI Compatible', status: 'unconfigured' },
  { id: 'ollama', name: 'Ollama / LM Studio', status: 'unconfigured' },
] as const;

export function initializeProviders(): void {
  const db = getDatabase();

  const insert = db.prepare(`
    INSERT OR IGNORE INTO providers (id, name, status, enabled, config)
    VALUES (?, ?, ?, 0, '{}')
  `);

  const seed = db.transaction(() => {
    for (const provider of DEFAULT_PROVIDERS) {
      insert.run(provider.id, provider.name, provider.status);
    }
  });

  seed();
}

export function getAllProviders(): Provider[] {
  initializeProviders();

  return getDatabase()
    .prepare('SELECT * FROM providers ORDER BY name ASC')
    .all() as Provider[];
}

export function getProviderById(id: string): Provider | undefined {
  initializeProviders();

  return getDatabase()
    .prepare('SELECT * FROM providers WHERE id = ?')
    .get(id) as Provider | undefined;
}

export function updateProviderConfig(
  id: string,
  config: Record<string, unknown>
): Provider | undefined {
  const provider = getProviderById(id);

  if (!provider) return undefined;

  getDatabase().prepare(`
    UPDATE providers
    SET config = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(JSON.stringify(config), id);

  return getProviderById(id);
}

export function setProviderStatus(
  id: string,
  status: ProviderStatus
): Provider | undefined {
  const provider = getProviderById(id);

  if (!provider) return undefined;

  getDatabase().prepare(`
    UPDATE providers
    SET status = ?,
        enabled = CASE WHEN ? = 'disabled' THEN 0 ELSE enabled END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, status, id);

  return getProviderById(id);
}

export function setProviderEnabled(
  id: string,
  enabled: boolean
): Provider | undefined {
  const provider = getProviderById(id);

  if (!provider) return undefined;

  if (enabled && provider.status !== 'ready') {
    throw new Error('PROVIDER_NOT_READY');
  }

  getDatabase().prepare(`
    UPDATE providers
    SET enabled = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(enabled ? 1 : 0, id);

  return getProviderById(id);
}

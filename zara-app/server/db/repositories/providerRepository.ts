import { getDatabase } from '../database.js';
import { hasProviderApiKey } from '../../services/secretStore.js';
import { getProviderModel } from '../../services/providerConfig.js';

export type ProviderStatus =
  | 'unconfigured'
  | 'pending_verification'
  | 'ready'
  | 'disabled';

export type SupportedProviderId = 'omniroute' | 'freellmapi';

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
  { id: 'omniroute', name: 'OmniRoute', status: 'unconfigured' },
  { id: 'freellmapi', name: 'FreeLLMAPI', status: 'unconfigured' },
] as const;

export function isSupportedProviderId(id: string): id is SupportedProviderId {
  return id === 'omniroute' || id === 'freellmapi';
}

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
  const db = getDatabase();
  const syncConfiguration = db.prepare(`
    UPDATE providers
    SET status = ?, enabled = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  for (const id of ['omniroute', 'freellmapi'] as const) {
    const status = !hasProviderApiKey(id)
      ? 'unconfigured'
      : !getProviderModel(id)
        ? 'pending_verification'
        : undefined;

    if (status) syncConfiguration.run(status, id);
  }
  return db
    .prepare("SELECT * FROM providers WHERE id IN ('omniroute', 'freellmapi') ORDER BY CASE id WHEN 'omniroute' THEN 0 ELSE 1 END")
    .all() as Provider[];
}

export function getProviderById(id: string): Provider | undefined {
  initializeProviders();
  if (!isSupportedProviderId(id)) return undefined;
  return getDatabase()
    .prepare('SELECT * FROM providers WHERE id = ?')
    .get(id) as Provider | undefined;
}

export function markProviderReadyAfterVerification(id: SupportedProviderId): Provider | undefined {
  const provider = getProviderById(id);
  if (!provider) return undefined;
  getDatabase().prepare(`
    UPDATE providers
    SET status = 'ready', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);
  return getProviderById(id);
}

export function setProviderStatus(
  id: string,
  status: Exclude<ProviderStatus, 'ready'>,
): Provider | undefined {
  const provider = getProviderById(id);
  if (!provider) return undefined;
  getDatabase().prepare(`
    UPDATE providers
    SET status = ?,
        enabled = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, id);
  return getProviderById(id);
}

export function setProviderEnabled(id: string, enabled: boolean): Provider | undefined {
  const provider = getProviderById(id);
  if (!provider) return undefined;
  if (enabled && provider.status !== 'ready') throw new Error('PROVIDER_NOT_READY');
  getDatabase().prepare(`
    UPDATE providers SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(enabled ? 1 : 0, id);
  return getProviderById(id);
}

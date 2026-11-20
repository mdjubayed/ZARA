export type SecretProviderId = 'omniroute' | 'freellmapi';

const PROVIDER_SECRET_ENV: Record<SecretProviderId, string> = {
  omniroute: 'OMNIROUTE_API_KEY',
  freellmapi: 'FREELLMAPI_API_KEY',
};

/**
 * Reads a provider API key from the process environment.
 * Secrets are never persisted to SQLite or returned by API routes.
 */
export function getProviderApiKey(
  providerId: SecretProviderId
): string | undefined {
  const envName = PROVIDER_SECRET_ENV[providerId];
  const value = process.env[envName];

  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  return value;
}

/**
 * Checks whether a provider API key is configured.
 * Does not reveal or return the secret itself.
 */
export function hasProviderApiKey(
  providerId: SecretProviderId
): boolean {
  return getProviderApiKey(providerId) !== undefined;
}

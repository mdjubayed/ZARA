import { getSetting } from '../db/repositories/settingsRepository.js';
import type { SupportedProviderId } from '../db/repositories/providerRepository.js';

const MODEL_ENV: Record<SupportedProviderId, string> = {
  omniroute: 'OMNIROUTE_MODEL',
  freellmapi: 'FREELLMAPI_MODEL',
};

export function getProviderModel(providerId: SupportedProviderId): string | undefined {
  const environmentModel = process.env[MODEL_ENV[providerId]]?.trim();
  if (environmentModel) return environmentModel;

  const savedModel = getSetting<string>(`zara.provider.${providerId}.model`);
  return typeof savedModel === 'string' && savedModel.trim()
    ? savedModel.trim()
    : undefined;
}

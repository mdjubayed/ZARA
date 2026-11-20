import { getProviderById, type Provider } from '../db/repositories/providerRepository.js';
import { getProviderAdapter } from './providerRegistry.js';
import type { ProviderGenerationRequest, ProviderGenerationResponse } from './providerAdapter.js';
import { ProviderRequestError } from './providerAdapter.js';

export type BrainProviderId = 'omniroute' | 'freellmapi';

function otherProvider(id: BrainProviderId): BrainProviderId {
  return id === 'omniroute' ? 'freellmapi' : 'omniroute';
}

function getReadyProvider(id: BrainProviderId): { provider: Provider; adapter: NonNullable<ReturnType<typeof getProviderAdapter>> } {
  const provider = getProviderById(id);
  const adapter = getProviderAdapter(id);
  if (!provider || !adapter || provider.status !== 'ready' || provider.enabled !== 1) {
    throw new ProviderRequestError(id, 'PROVIDER_NOT_READY', undefined, true);
  }
  return { provider, adapter };
}

function canFailover(error: unknown): boolean {
  return error instanceof ProviderRequestError && error.recoverable;
}

function getProviderOrder(selected?: string): BrainProviderId[] {
  const primary = selected === 'freellmapi' ? 'freellmapi' : 'omniroute';
  return [primary, otherProvider(primary)];
}

export async function generateWithFailover(
  request: ProviderGenerationRequest,
  selectedProvider?: string,
): Promise<ProviderGenerationResponse & { providerId: BrainProviderId }> {
  let lastError: unknown;
  const order = getProviderOrder(selectedProvider);

  for (let index = 0; index < order.length; index += 1) {
    const providerId = order[index];
    try {
      const { adapter } = getReadyProvider(providerId);
      const result = await adapter.generate(request);
      return { ...result, providerId };
    } catch (error) {
      lastError = error;
      if (!canFailover(error) || index === order.length - 1) throw error;
    }
  }

  throw lastError ?? new ProviderRequestError('omniroute', 'NO_PROVIDER_AVAILABLE');
}

export async function streamWithFailover(
  request: ProviderGenerationRequest,
  selectedProvider: string | undefined,
  onToken: (token: string) => void,
): Promise<ProviderGenerationResponse & { providerId: BrainProviderId }> {
  let lastError: unknown;
  const order = getProviderOrder(selectedProvider);

  for (let index = 0; index < order.length; index += 1) {
    const providerId = order[index];
    let emittedToken = false;
    try {
      const { adapter } = getReadyProvider(providerId);
      const result = await adapter.stream(request, (token) => {
        emittedToken = true;
        onToken(token);
      });
      return { ...result, providerId };
    } catch (error) {
      lastError = error;
      // Never switch providers after sending partial text to the client.
      if (emittedToken || !canFailover(error) || index === order.length - 1) throw error;
    }
  }

  throw lastError ?? new ProviderRequestError('omniroute', 'NO_PROVIDER_AVAILABLE');
}

export async function verifyProvider(providerId: BrainProviderId): Promise<string[]> {
  const adapter = getProviderAdapter(providerId);
  if (!adapter) throw new ProviderRequestError(providerId, 'PROVIDER_ADAPTER_NOT_REGISTERED');
  return adapter.verify();
}

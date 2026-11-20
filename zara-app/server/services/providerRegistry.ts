
import type { ProviderAdapter } from './providerAdapter.js';

const adapters = new Map<string, ProviderAdapter>();

export function registerProviderAdapter(
  adapter: ProviderAdapter
): void {
  const providerId = adapter.providerId.trim();

  if (!providerId) {
    throw new Error('PROVIDER_ID_REQUIRED');
  }

  if (adapters.has(providerId)) {
    throw new Error('PROVIDER_ADAPTER_ALREADY_REGISTERED');
  }

  adapters.set(providerId, adapter);
}

export function getProviderAdapter(
  providerId: string
): ProviderAdapter | undefined {
  return adapters.get(providerId.trim());
}

export function hasProviderAdapter(providerId: string): boolean {
  return adapters.has(providerId.trim());
}

export function unregisterProviderAdapter(providerId: string): boolean {
  return adapters.delete(providerId.trim());
}

export function getRegisteredProviderIds(): string[] {
  return Array.from(adapters.keys());
}

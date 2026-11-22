import { config } from '../config.js';
import { OpenAICompatibleAdapter } from './openAICompatibleAdapter.js';
import { registerProviderAdapter } from './providerRegistry.js';
import { getProviderApiKey } from './secretStore.js';
import { getProviderModel } from './providerConfig.js';

let initialized = false;

export function initializeProviderAdapters(): void {
  if (initialized) return;

  registerProviderAdapter(new OpenAICompatibleAdapter({
    providerId: 'omniroute',
    baseUrl: config.omniRouteBaseUrl,
    apiKey: () => getProviderApiKey('omniroute'),
    defaultModel: () => getProviderModel('omniroute'),
    timeoutMs: config.providerTimeoutMs,
  }));

  registerProviderAdapter(new OpenAICompatibleAdapter({
    providerId: 'freellmapi',
    baseUrl: config.freeLlmApiBaseUrl,
    apiKey: () => getProviderApiKey('freellmapi'),
    defaultModel: () => getProviderModel('freellmapi'),
    timeoutMs: config.providerTimeoutMs,
  }));

  initialized = true;
}

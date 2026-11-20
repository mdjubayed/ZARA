import { config } from '../config.js';
import { OpenAICompatibleAdapter } from './openAICompatibleAdapter.js';
import { registerProviderAdapter } from './providerRegistry.js';
import { getProviderApiKey } from './secretStore.js';

let initialized = false;

export function initializeProviderAdapters(): void {
  if (initialized) return;

  registerProviderAdapter(new OpenAICompatibleAdapter({
    providerId: 'omniroute',
    baseUrl: config.omniRouteBaseUrl,
    apiKey: () => getProviderApiKey('omniroute'),
    defaultModel: () => process.env.OMNIROUTE_MODEL,
    timeoutMs: config.providerTimeoutMs,
  }));

  registerProviderAdapter(new OpenAICompatibleAdapter({
    providerId: 'freellmapi',
    baseUrl: config.freeLlmApiBaseUrl,
    apiKey: () => getProviderApiKey('freellmapi'),
    defaultModel: () => process.env.FREELLMAPI_MODEL,
    timeoutMs: config.providerTimeoutMs,
  }));

  initialized = true;
}

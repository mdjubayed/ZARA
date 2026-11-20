import { config } from '../config.js';
import { OpenAICompatibleAdapter } from './openAICompatibleAdapter.js';
import { registerProviderAdapter } from './providerRegistry.js';

let initialized = false;

export function initializeProviderAdapters(): void {
  if (initialized) return;

  registerProviderAdapter(new OpenAICompatibleAdapter({
    providerId: 'omniroute',
    baseUrl: config.omniRouteBaseUrl,
    apiKey: () => process.env.OMNIROUTE_API_KEY,
    defaultModel: () => process.env.OMNIROUTE_MODEL,
    timeoutMs: config.providerTimeoutMs,
  }));

  registerProviderAdapter(new OpenAICompatibleAdapter({
    providerId: 'freellmapi',
    baseUrl: config.freeLlmApiBaseUrl,
    apiKey: () => process.env.FREELLMAPI_API_KEY,
    defaultModel: () => process.env.FREELLMAPI_MODEL,
    timeoutMs: config.providerTimeoutMs,
  }));

  initialized = true;
}

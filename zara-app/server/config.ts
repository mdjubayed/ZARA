import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // FreeLLMAPI uses 3001 by default; ZARA therefore uses 3002.
  PORT: z.coerce.number().int().min(1).max(65535).default(3002),
  HOST: z.string().min(1).default('127.0.0.1'),
  SERVE_FRONTEND: z.enum(['true', 'false']).default('false'),
  ZARA_BACKEND_URL: z.string().optional().default(''),
  ZARA_DATA_DIR: z.string().optional().default(''),
  CORS_ORIGINS: z.string().optional().default(''),
  OMNIROUTE_BASE_URL: z.string().url().default('http://127.0.0.1:20128/v1'),
  FREELLMAPI_BASE_URL: z.string().url().default('http://127.0.0.1:3001/v1'),
  PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(180000).default(60000),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid server environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('INVALID_SERVER_ENVIRONMENT');
}

export const config = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  host: parsed.data.HOST,
  serveFrontend: parsed.data.SERVE_FRONTEND === 'true',
  dataDirectory: parsed.data.ZARA_DATA_DIR || undefined,
  omniRouteBaseUrl: parsed.data.OMNIROUTE_BASE_URL.replace(/\/+$/, ''),
  freeLlmApiBaseUrl: parsed.data.FREELLMAPI_BASE_URL.replace(/\/+$/, ''),
  providerTimeoutMs: parsed.data.PROVIDER_TIMEOUT_MS,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
};

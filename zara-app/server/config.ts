import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  ZARA_BACKEND_URL: z.string().optional().default(''),
  ZARA_DATA_DIR: z.string().optional().default(''),
  CORS_ORIGINS: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid server environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('INVALID_SERVER_ENVIRONMENT');
}

export const config = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  dataDirectory: parsed.data.ZARA_DATA_DIR || undefined,

  corsOrigins: parsed.data.CORS_ORIGINS
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),

  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
};

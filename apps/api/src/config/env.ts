import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from root monorepo or current app directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().url().describe('PostgreSQL connection string'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(16)
    .default('foodfactory_erp_jwt_secret_foundation_fallback_key'),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Environment validation failed:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    throw new Error('Invalid environment configuration');
  }

  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;

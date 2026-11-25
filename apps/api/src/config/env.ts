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
    .default('foodfactory_erp_jwt_secret_foundation_fallback_key_2026'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16)
    .default('foodfactory_erp_refresh_pepper_foundation_secret_key_2026'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().default(7),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_SECURE: z
    .string()
    .transform(v => v === 'true')
    .optional(),
  INITIAL_OWNER_EMAIL: z.string().email().optional(),
  INITIAL_OWNER_USERNAME: z.string().min(3).optional(),
  INITIAL_OWNER_PASSWORD: z.string().min(8).optional(),
  INITIAL_OWNER_FULLNAME: z.string().optional(),
  DEMO_MODE_ENABLED: z
    .string()
    .transform(v => v === 'true')
    .optional(),
  DEMO_DEFAULT_PASSWORD: z.string().min(8).optional(),
  DEMO_OWNER_EMAIL: z.string().email().optional(),
  DEMO_ADMIN_EMAIL: z.string().email().optional(),
  DEMO_SALESMAN_EMAIL: z.string().email().optional(),
  DEMO_PRODUCTION_EMAIL: z.string().email().optional(),
  DEMO_AUDITOR_EMAIL: z.string().email().optional(),
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

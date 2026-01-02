/**
 * Centralized Configuration Module
 *
 * Single source of truth for all environment variables.
 * Provides type-safe access with IDE autocomplete and compile-time validation.
 *
 * Usage:
 *   import { config } from './config';
 *   const port = config.server.port; // Type-safe, autocomplete enabled
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface ServerConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  corsOrigins: string[];
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  enableMetrics: boolean;
}

export interface DatabaseConfig {
  url: string;
  pool: {
    min: number;
    max: number;
    idleTimeoutMs: number;
    connectionTimeoutMs: number;
  };
}

export interface RedisConfig {
  url: string;
  host: string;
  port: number;
  password?: string;
  maxMemory: string;
  sentinel: {
    enabled: boolean;
    hosts?: string[];
    masterName?: string;
  };
}

export interface JwtConfig {
  secret: string;
  refreshSecret: string;
  issuer: string;
  audience: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

export interface RateLimitConfig {
  max: number;
  windowMinutes: number;
}

export interface Config {
  server: ServerConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: JwtConfig;
  supabase: SupabaseConfig;
  rateLimit: RateLimitConfig;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number for environment variable ${key}: ${value}`);
  }
  return parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

function getEnvArray(key: string, defaultValue: string[] = []): string[] {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.split(',').map((v) => v.trim());
}

// =============================================================================
// CONFIGURATION LOADING
// =============================================================================

function loadConfig(): Config {
  return {
    server: {
      nodeEnv: getEnv('NODE_ENV', 'development') as Config['server']['nodeEnv'],
      port: getEnvNumber('PORT', 3002),
      corsOrigins: getEnvArray('CORS_ORIGINS', ['http://localhost:3000', 'http://localhost:5173']),
      logLevel: getEnv('LOG_LEVEL', 'info') as Config['server']['logLevel'],
      enableMetrics: getEnvBoolean('ENABLE_METRICS', true),
    },

    database: {
      url: getEnv('DATABASE_URL'),
      pool: {
        min: getEnvNumber('DB_POOL_MIN', 2),
        max: getEnvNumber('DB_POOL_MAX', 10),
        idleTimeoutMs: getEnvNumber('DB_IDLE_TIMEOUT_MS', 30000),
        connectionTimeoutMs: getEnvNumber('DB_CONNECTION_TIMEOUT_MS', 10000),
      },
    },

    redis: {
      url: getEnv('REDIS_URL', 'redis://localhost:6379'),
      host: getEnv('REDIS_HOST', 'localhost'),
      port: getEnvNumber('REDIS_PORT', 6379),
      password: process.env.REDIS_PASSWORD,
      maxMemory: getEnv('REDIS_MAX_MEMORY', '256mb'),
      sentinel: {
        enabled: getEnvBoolean('REDIS_SENTINEL_ENABLED', false),
        hosts: process.env.REDIS_SENTINEL_HOSTS?.split(','),
        masterName: process.env.REDIS_SENTINEL_MASTER_NAME,
      },
    },

    jwt: {
      secret: getEnv('JWT_SECRET'),
      refreshSecret: getEnv('JWT_REFRESH_SECRET'),
      issuer: getEnv('JWT_ISSUER', 'intellifill'),
      audience: getEnv('JWT_AUDIENCE', 'intellifill-api'),
    },

    supabase: {
      url: getEnv('SUPABASE_URL', ''),
      anonKey: getEnv('SUPABASE_ANON_KEY', ''),
      serviceRoleKey: getEnv('SUPABASE_SERVICE_ROLE_KEY', ''),
    },

    rateLimit: {
      max: getEnvNumber('RATE_LIMIT_MAX', 100),
      windowMinutes: getEnvNumber('RATE_LIMIT_WINDOW', 15),
    },
  };
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const config = loadConfig();

// =============================================================================
// VALIDATION (for critical configs)
// =============================================================================

interface ValidationError {
  variable: string;
  message: string;
  source: string;
  fix: string;
}

/**
 * Validates all critical environment variables on startup.
 * Provides clear, actionable error messages for missing or invalid configs.
 */
export function validateConfig(): void {
  const { server, jwt, database, supabase } = config;
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // -------------------------------------------------------------------------
  // CRITICAL: These will crash the app if missing
  // -------------------------------------------------------------------------

  // Database (source: quikadmin/.env)
  if (!database.url) {
    errors.push({
      variable: 'DATABASE_URL',
      message: 'Database connection string is required',
      source: 'quikadmin/.env',
      fix: 'Add DATABASE_URL=postgresql://... to quikadmin/.env',
    });
  } else if (!database.url.startsWith('postgresql://') && !database.url.startsWith('postgres://')) {
    errors.push({
      variable: 'DATABASE_URL',
      message: 'Must be a valid PostgreSQL connection string',
      source: 'quikadmin/.env',
      fix: 'Use format: postgresql://user:password@host:port/database',
    });
  }

  // JWT Secrets (source: quikadmin/.env)
  // Require 64+ characters in ALL environments for security
  if (!jwt.secret || jwt.secret.length < 64) {
    errors.push({
      variable: 'JWT_SECRET',
      message: jwt.secret
        ? 'JWT secret must be at least 64 characters long'
        : 'JWT secret is required for authentication',
      source: 'quikadmin/.env',
      fix: "Generate with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
    });
  }
  if (!jwt.refreshSecret || jwt.refreshSecret.length < 64) {
    errors.push({
      variable: 'JWT_REFRESH_SECRET',
      message: jwt.refreshSecret
        ? 'JWT refresh secret must be at least 64 characters long'
        : 'JWT refresh secret is required for token refresh',
      source: 'quikadmin/.env',
      fix: "Generate with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
    });
  }

  // Supabase (source: quikadmin/.env ONLY - NOT root .env)
  if (!supabase.url) {
    errors.push({
      variable: 'SUPABASE_URL',
      message: 'Supabase project URL is required',
      source: 'quikadmin/.env',
      fix: 'Get from Supabase Dashboard > Project Settings > API',
    });
  }
  if (!supabase.anonKey) {
    errors.push({
      variable: 'SUPABASE_ANON_KEY',
      message: 'Supabase anonymous key is required',
      source: 'quikadmin/.env',
      fix: 'Get from Supabase Dashboard > Project Settings > API',
    });
  }
  if (!supabase.serviceRoleKey) {
    errors.push({
      variable: 'SUPABASE_SERVICE_ROLE_KEY',
      message: 'Supabase service role key is required for admin operations',
      source: 'quikadmin/.env',
      fix: 'Get from Supabase Dashboard > Project Settings > API (Keep secret!)',
    });
  }

  // Production-specific validations
  // (JWT secret length is now validated for ALL environments above)

  // -------------------------------------------------------------------------
  // WARNINGS: Non-critical but should be addressed
  // -------------------------------------------------------------------------

  // Neon SSL warning
  if (database.url?.includes('neon.tech') && !database.url.includes('sslmode=require')) {
    warnings.push('Neon database connection should include sslmode=require');
  }

  // -------------------------------------------------------------------------
  // OUTPUT RESULTS
  // -------------------------------------------------------------------------

  // Print warnings
  if (warnings.length > 0) {
    console.warn('\n⚠️  Configuration Warnings:');
    warnings.forEach((w) => console.warn(`   - ${w}`));
  }

  // Print errors and throw if any exist
  if (errors.length > 0) {
    console.error('\n❌ Configuration Errors:\n');
    errors.forEach((e) => {
      console.error(`   ${e.variable}`);
      console.error(`     Message: ${e.message}`);
      console.error(`     Source:  ${e.source}`);
      console.error(`     Fix:     ${e.fix}`);
      console.error('');
    });
    console.error('─'.repeat(60));
    console.error('\n📁 Environment Variable Sources:');
    console.error('   • Root .env        → AI tool keys only (TaskMaster, Claude)');
    console.error('   • quikadmin/.env   → All backend config (DB, Auth, Supabase)');
    console.error('   • quikadmin-web/.env → Frontend VITE_* vars only\n');

    throw new Error(
      `Missing ${errors.length} required environment variable(s). See above for details.`
    );
  }
}

// NOTE: Validation is now called explicitly in src/index.ts at startup
// This ensures clear error messages and controlled startup flow
// For testing, validateConfig() can be called manually or skipped

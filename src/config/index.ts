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
  return value.split(',').map(v => v.trim());
}

// =============================================================================
// CONFIGURATION LOADING
// =============================================================================

function loadConfig(): Config {
  return {
    server: {
      nodeEnv: (getEnv('NODE_ENV', 'development') as Config['server']['nodeEnv']),
      port: getEnvNumber('PORT', 3002),
      corsOrigins: getEnvArray('CORS_ORIGINS', ['http://localhost:3000', 'http://localhost:5173']),
      logLevel: (getEnv('LOG_LEVEL', 'info') as Config['server']['logLevel']),
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

export function validateConfig(): void {
  const { server, jwt, database } = config;

  // Production-specific validations
  if (server.nodeEnv === 'production') {
    if (jwt.secret.length < 64) {
      throw new Error('JWT_SECRET must be at least 64 characters in production');
    }
    if (jwt.refreshSecret.length < 64) {
      throw new Error('JWT_REFRESH_SECRET must be at least 64 characters in production');
    }
  }

  // Database URL validation
  if (!database.url.startsWith('postgresql://') && !database.url.startsWith('postgres://')) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection string');
  }

  // Neon-specific validation
  if (database.url.includes('neon.tech') && !database.url.includes('sslmode=require')) {
    console.warn('⚠️  WARNING: Neon database connection should include sslmode=require');
  }
}

// Auto-validate on import (can be disabled for testing)
if (process.env.NODE_ENV !== 'test') {
  validateConfig();
}

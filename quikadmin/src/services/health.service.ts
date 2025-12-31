/**
 * Health Service
 *
 * Provides comprehensive health metrics for monitoring and diagnostics.
 * Aggregates connection status for all critical infrastructure components.
 *
 * Components monitored:
 * - Database (Prisma/PostgreSQL/Neon)
 * - Redis cache/queues
 * - Supabase auth (circuit breaker status)
 * - Token cache
 * - Organization cache
 * - RLS failure tracking
 *
 * @module services/health.service
 */

import { prisma } from '../utils/prisma';
import { getRedisHealthState, checkRedisHealth, isRedisHealthy } from '../utils/redisHealth';
import {
  getAuthCircuitBreakerMetrics,
  isAuthCircuitOpen,
  getTokenCacheMetrics,
} from '../utils/supabase';
import { getOrganizationCacheStats } from '../middleware/organizationContext';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
}

export interface DatabaseHealth {
  status: 'connected' | 'disconnected' | 'error';
  responseTimeMs?: number;
  connectionPool?: {
    active?: number;
    idle?: number;
    waiting?: number;
  };
  lastError?: string;
}

export interface RedisHealth {
  status: 'connected' | 'disconnected' | 'error';
  lastCheck: number;
  lastError: string | null;
}

export interface AuthHealth {
  circuitBreaker: {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failures: number;
    successes: number;
    rejects: number;
    timeouts: number;
    latencyMean: number;
  };
  tokenCache: {
    enabled: boolean;
    stats?: {
      hits: number;
      misses: number;
      hitRate: number;
      redisHits: number;
      memoryHits: number;
    };
    memoryCacheSize?: number;
    redisConnected?: boolean;
  };
}

export interface CacheHealth {
  organizationCache: {
    size: number;
    hits: number;
    misses: number;
    evictions: number;
    hitRate: number;
  };
}

export interface RLSHealth {
  failureCount: number;
  lastFailure?: string;
  failClosedEnabled: boolean;
}

export interface DetailedHealth extends HealthStatus {
  database: DatabaseHealth;
  redis: RedisHealth;
  auth: AuthHealth;
  caches: CacheHealth;
  rls: RLSHealth;
}

// ============================================================================
// RLS Failure Tracking
// ============================================================================

let rlsFailureCount = 0;
let lastRlsFailure: Date | null = null;

/**
 * Record an RLS failure
 */
export function recordRLSFailure(): void {
  rlsFailureCount++;
  lastRlsFailure = new Date();
  logger.warn('[Health] RLS failure recorded', { totalFailures: rlsFailureCount });
}

/**
 * Get RLS failure statistics
 */
export function getRLSStats(): RLSHealth {
  return {
    failureCount: rlsFailureCount,
    lastFailure: lastRlsFailure?.toISOString(),
    failClosedEnabled: process.env.RLS_FAIL_CLOSED === 'true',
  };
}

/**
 * Reset RLS failure count (for testing or manual reset)
 */
export function resetRLSStats(): void {
  rlsFailureCount = 0;
  lastRlsFailure = null;
}

// ============================================================================
// Health Check Functions
// ============================================================================

const startTime = Date.now();

/**
 * Get basic health status
 */
export function getBasicHealth(): HealthStatus {
  const authCircuitOpen = isAuthCircuitOpen();
  const redisHealthy = isRedisHealthy();

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (authCircuitOpen || !redisHealthy) {
    status = 'degraded';
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };
}

/**
 * Check database health with response time
 */
async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTimeMs = Date.now() - start;

    return {
      status: 'connected',
      responseTimeMs,
      // Note: Prisma doesn't expose pool metrics directly
      // This would require using Prisma's metrics feature or custom instrumentation
    };
  } catch (error) {
    return {
      status: 'error',
      responseTimeMs: Date.now() - start,
      lastError: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get Redis health status
 */
function getRedisHealth(): RedisHealth {
  const state = getRedisHealthState();

  return {
    status: state.connected ? 'connected' : 'disconnected',
    lastCheck: state.lastCheck,
    lastError: state.lastError,
  };
}

/**
 * Get authentication subsystem health
 */
function getAuthHealth(): AuthHealth {
  const circuitBreaker = getAuthCircuitBreakerMetrics();
  const tokenCacheMetrics = getTokenCacheMetrics();

  return {
    circuitBreaker,
    tokenCache: tokenCacheMetrics
      ? {
          enabled: true,
          stats: tokenCacheMetrics.stats,
          memoryCacheSize: tokenCacheMetrics.memoryCacheSize,
          redisConnected: tokenCacheMetrics.redisConnected,
        }
      : { enabled: false },
  };
}

/**
 * Get cache health statistics
 */
function getCacheHealth(): CacheHealth {
  return {
    organizationCache: getOrganizationCacheStats(),
  };
}

/**
 * Get detailed health status with all component metrics
 */
export async function getDetailedHealth(): Promise<DetailedHealth> {
  const [databaseHealth] = await Promise.all([checkDatabaseHealth()]);

  const basicHealth = getBasicHealth();
  const authHealth = getAuthHealth();
  const redisHealth = getRedisHealth();
  const cacheHealth = getCacheHealth();
  const rlsHealth = getRLSStats();

  // Determine overall status based on component health
  let status = basicHealth.status;

  if (databaseHealth.status !== 'connected') {
    status = 'unhealthy';
  } else if (authHealth.circuitBreaker.state === 'OPEN') {
    status = 'degraded';
  } else if (redisHealth.status !== 'connected') {
    status = 'degraded';
  }

  return {
    ...basicHealth,
    status,
    database: databaseHealth,
    redis: redisHealth,
    auth: authHealth,
    caches: cacheHealth,
    rls: rlsHealth,
  };
}

/**
 * Perform a deep health check (actively tests connections)
 * Use sparingly as this creates additional load
 */
export async function performDeepHealthCheck(): Promise<DetailedHealth> {
  // Trigger fresh Redis check
  await checkRedisHealth();

  return getDetailedHealth();
}

// ============================================================================
// Export
// ============================================================================

export default {
  getBasicHealth,
  getDetailedHealth,
  performDeepHealthCheck,
  recordRLSFailure,
  getRLSStats,
  resetRLSStats,
};

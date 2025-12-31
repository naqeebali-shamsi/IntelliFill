/**
 * Supabase Client Utilities
 *
 * Phase 4 SDK Migration - Replaces custom JWT authentication
 *
 * Two clients:
 * 1. supabase: Public client (anon key) - for frontend-facing operations
 * 2. supabaseAdmin: Admin client (service role) - for backend operations
 *
 * Test Mode:
 * When NODE_ENV=test, Supabase is not required. Test mode uses local JWT
 * authentication via Prisma/bcrypt for E2E testing in Docker environments.
 */

import { createClient, SupabaseClient, User, AuthError } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import CircuitBreaker from 'opossum';
import { piiSafeLogger as logger } from './piiSafeLogger';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Test mode configuration
const isTestMode = process.env.NODE_ENV === 'test';
const JWT_SECRET =
  process.env.JWT_SECRET ||
  'test_jwt_secret_for_e2e_testing_environment_must_be_at_least_64_characters_long_here';

// Circuit breaker configuration from environment
const CIRCUIT_BREAKER_CONFIG = {
  resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000', 10),
  errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '50', 10),
  timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '10000', 10),
  volumeThreshold: 5, // Minimum requests before circuit can trip
  rollingCountTimeout: 10000, // 10s window for stats
  rollingCountBuckets: 10,
};

/**
 * Check if Supabase is properly configured and available
 */
export function isSupabaseEnabled(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

// Validate environment variables (skip in test mode)
if (!isTestMode) {
  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL environment variable');
  }

  if (!supabaseAnonKey) {
    throw new Error('Missing SUPABASE_ANON_KEY environment variable');
  }

  if (!supabaseServiceRoleKey) {
    console.warn('⚠️  Missing SUPABASE_SERVICE_ROLE_KEY - Admin operations will fail');
  }
} else {
  console.log('🧪 Test mode: Supabase validation bypassed, using local JWT auth');
}

/**
 * Create placeholder client for test mode
 * This client won't be used in test mode, but prevents initialization errors
 */
function createTestModeClient(): SupabaseClient {
  // Create a minimal client with placeholder values
  // This will never actually be called in test mode
  return createClient('http://localhost:54321', 'test-anon-key');
}

/**
 * Public Supabase client
 * Uses anon key - safe for frontend-facing operations
 * Rate-limited by Supabase
 */
export const supabase: SupabaseClient = isTestMode
  ? createTestModeClient()
  : createClient(supabaseUrl!, supabaseAnonKey!);

/**
 * Admin Supabase client
 * Uses service role key - bypasses RLS, use with caution
 * Required for: user creation, user deletion, admin operations
 */
export const supabaseAdmin: SupabaseClient = isTestMode
  ? createTestModeClient()
  : createClient(
      supabaseUrl!,
      supabaseServiceRoleKey || supabaseAnonKey! // Fallback to anon (will fail for admin ops)
    );

/**
 * Internal function to get user from Supabase Auth
 * This is wrapped by the circuit breaker
 */
async function _getSupabaseAuthUser(
  token: string
): Promise<{ user: User | null; error: AuthError | null }> {
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  return { user, error };
}

/**
 * Circuit breaker for Supabase Auth getUser calls
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failures exceeded threshold, requests fail fast
 * - HALF-OPEN: Testing if service recovered
 */
const supabaseAuthCircuitBreaker = new CircuitBreaker(_getSupabaseAuthUser, {
  timeout: CIRCUIT_BREAKER_CONFIG.timeout,
  errorThresholdPercentage: CIRCUIT_BREAKER_CONFIG.errorThresholdPercentage,
  resetTimeout: CIRCUIT_BREAKER_CONFIG.resetTimeout,
  volumeThreshold: CIRCUIT_BREAKER_CONFIG.volumeThreshold,
  rollingCountTimeout: CIRCUIT_BREAKER_CONFIG.rollingCountTimeout,
  rollingCountBuckets: CIRCUIT_BREAKER_CONFIG.rollingCountBuckets,
});

// Circuit breaker event logging
supabaseAuthCircuitBreaker.on('success', () => {
  logger.debug('[CircuitBreaker:supabase-auth] Request succeeded');
});

supabaseAuthCircuitBreaker.on('failure', (error: Error) => {
  logger.warn('[CircuitBreaker:supabase-auth] Request failed', {
    error: error.message,
  });
});

supabaseAuthCircuitBreaker.on('timeout', () => {
  logger.warn('[CircuitBreaker:supabase-auth] Request timed out');
});

supabaseAuthCircuitBreaker.on('reject', () => {
  logger.warn('[CircuitBreaker:supabase-auth] Request rejected (circuit open)');
});

supabaseAuthCircuitBreaker.on('open', () => {
  logger.error('[CircuitBreaker:supabase-auth] Circuit OPENED - Supabase auth appears down', {
    stats: {
      failures: supabaseAuthCircuitBreaker.stats.failures,
      successes: supabaseAuthCircuitBreaker.stats.successes,
      timeouts: supabaseAuthCircuitBreaker.stats.timeouts,
    },
  });
});

supabaseAuthCircuitBreaker.on('halfOpen', () => {
  logger.info('[CircuitBreaker:supabase-auth] Circuit HALF-OPEN - testing Supabase auth');
});

supabaseAuthCircuitBreaker.on('close', () => {
  logger.info('[CircuitBreaker:supabase-auth] Circuit CLOSED - Supabase auth recovered');
});

/**
 * Get circuit breaker metrics for monitoring
 */
export function getAuthCircuitBreakerMetrics(): {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  successes: number;
  rejects: number;
  timeouts: number;
  latencyMean: number;
} {
  const stats = supabaseAuthCircuitBreaker.stats;
  let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  if (supabaseAuthCircuitBreaker.opened) {
    state = 'OPEN';
  } else if (supabaseAuthCircuitBreaker.halfOpen) {
    state = 'HALF_OPEN';
  }

  return {
    state,
    failures: stats.failures,
    successes: stats.successes,
    rejects: stats.rejects,
    timeouts: stats.timeouts,
    latencyMean: stats.latencyMean,
  };
}

/**
 * Check if the auth circuit breaker is open (Supabase down)
 */
export function isAuthCircuitOpen(): boolean {
  return supabaseAuthCircuitBreaker.opened;
}

/**
 * Verify JWT token
 *
 * In test mode: Verifies local JWT tokens created during test login
 * In production: Verifies Supabase-issued JWT tokens (protected by circuit breaker)
 *
 * @param token - JWT token from Authorization header
 * @returns User object if valid, null if invalid
 */
export async function verifySupabaseToken(token: string): Promise<User | null> {
  // Test mode: Verify local JWT tokens
  if (isTestMode) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        sub: string;
        email: string;
        role: string;
        aud: string;
        iss: string;
      };

      // Check if this is a test-mode token
      if (decoded.iss === 'test-mode' && decoded.aud === 'authenticated') {
        console.log(`🧪 [TEST MODE] Verified token for user: ${decoded.email}`);
        return {
          id: decoded.sub,
          email: decoded.email,
          role: decoded.role,
          aud: decoded.aud,
          // Mock Supabase user structure
          app_metadata: {},
          user_metadata: {},
          email_confirmed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as User;
      }

      console.error('Test mode: Invalid token issuer');
      return null;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Test mode token verification failed:', error.message);
      return null;
    }
  }

  // Production mode: Verify with Supabase via circuit breaker
  try {
    const { user, error } = await supabaseAuthCircuitBreaker.fire(token);

    if (error) {
      logger.warn('Supabase token verification failed', { error: error.message });
      return null;
    }

    return user;
  } catch (err: unknown) {
    const error = err as Error;
    // Circuit breaker rejection or other errors
    if (error.message === 'Breaker is open') {
      logger.error('Auth request rejected: Supabase circuit breaker is OPEN', {
        metrics: getAuthCircuitBreakerMetrics(),
      });
    } else {
      logger.error('Supabase token verification error', { error: error.message });
    }
    return null;
  }
}

/**
 * Get user from Supabase by ID
 *
 * @param userId - Supabase user ID
 * @returns User object if found, null otherwise
 */
export async function getSupabaseUser(userId: string): Promise<User | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (error) {
      console.error('Failed to get Supabase user:', error.message);
      return null;
    }

    return user;
  } catch (err) {
    console.error('Error getting Supabase user:', err);
    return null;
  }
}

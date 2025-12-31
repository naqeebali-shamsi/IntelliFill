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

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Test mode configuration
const isTestMode = process.env.NODE_ENV === 'test';
const JWT_SECRET =
  process.env.JWT_SECRET ||
  'test_jwt_secret_for_e2e_testing_environment_must_be_at_least_64_characters_long_here';

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
 * Verify JWT token
 *
 * In test mode: Verifies local JWT tokens created during test login
 * In production: Verifies Supabase-issued JWT tokens
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
          email_confirmed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      console.error('Test mode: Invalid token issuer');
      return null;
    } catch (err: any) {
      console.error('Test mode token verification failed:', err.message);
      return null;
    }
  }

  // Production mode: Verify with Supabase
  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error) {
      console.error('Supabase token verification failed:', error.message);
      return null;
    }

    return user;
  } catch (err) {
    console.error('Supabase token verification error:', err);
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

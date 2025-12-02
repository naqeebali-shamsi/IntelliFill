/**
 * Supabase Client Utilities
 *
 * Phase 4 SDK Migration - Replaces custom JWT authentication
 *
 * Two clients:
 * 1. supabase: Public client (anon key) - for frontend-facing operations
 * 2. supabaseAdmin: Admin client (service role) - for backend operations
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  throw new Error('Missing SUPABASE_ANON_KEY environment variable');
}

if (!supabaseServiceRoleKey) {
  console.warn('⚠️  Missing SUPABASE_SERVICE_ROLE_KEY - Admin operations will fail');
}

/**
 * Public Supabase client
 * Uses anon key - safe for frontend-facing operations
 * Rate-limited by Supabase
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Admin Supabase client
 * Uses service role key - bypasses RLS, use with caution
 * Required for: user creation, user deletion, admin operations
 */
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey || supabaseAnonKey // Fallback to anon (will fail for admin ops)
);

/**
 * Verify Supabase JWT token
 *
 * @param token - JWT token from Authorization header
 * @returns User object if valid, null if invalid
 */
export async function verifySupabaseToken(token: string) {
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

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
export async function getSupabaseUser(userId: string) {
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(userId);

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

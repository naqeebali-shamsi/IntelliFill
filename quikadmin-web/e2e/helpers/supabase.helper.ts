/**
 * Supabase Admin Helper for E2E Tests
 *
 * Provides admin-level operations for test management:
 * - Password restoration after destructive tests
 * - User management for test isolation
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables - check both frontend and backend patterns
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Singleton client
let supabaseAdmin: SupabaseClient | null = null;

/**
 * Get or create Supabase admin client
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  if (!supabaseUrl) {
    throw new Error(
      '[Supabase Helper] Missing SUPABASE_URL or VITE_SUPABASE_URL environment variable'
    );
  }

  if (!supabaseServiceKey) {
    console.warn(
      '[Supabase Helper] Missing SUPABASE_SERVICE_ROLE_KEY - password restoration will fail.\n' +
        'Add it to quikadmin-web/.env for local testing.'
    );
  }

  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '', {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdmin;
}

/**
 * Restore a user's password to its original value
 *
 * @param email - User's email address
 * @param password - Original password to restore
 * @throws Error if user not found or update fails
 */
export async function restoreUserPassword(
  email: string,
  password: string
): Promise<void> {
  const admin = getSupabaseAdmin();

  if (!supabaseServiceKey) {
    console.warn(
      `[Supabase Helper] Cannot restore password for ${email} - missing service key`
    );
    return;
  }

  try {
    // Find user by email
    const { data, error: listError } = await admin.auth.admin.listUsers();

    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    // Type-safe access to users array
    const usersList = data?.users ?? [];
    const user = usersList.find(
      (u: { email?: string }) => u.email === email
    );

    if (!user) {
      throw new Error(`User not found: ${email}`);
    }

    // Update password
    const { error: updateError } = await admin.auth.admin.updateUserById(
      user.id,
      {
        password,
      }
    );

    if (updateError) {
      throw new Error(
        `Failed to update password for ${email}: ${updateError.message}`
      );
    }

    console.log(`[Supabase Helper] Restored password for ${email}`);
  } catch (error) {
    console.error(
      `[Supabase Helper] Error restoring password for ${email}:`,
      error
    );
    throw error;
  }
}

/**
 * Check if Supabase admin is properly configured
 */
export function isSupabaseAdminConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseServiceKey);
}

// Export the admin client for direct use if needed
export { supabaseAdmin };

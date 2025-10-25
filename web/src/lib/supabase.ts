/**
 * Supabase Client Configuration
 *
 * This file initializes the Supabase client for authentication.
 * The client handles:
 * - User authentication (login, signup, logout)
 * - Automatic token refresh
 * - Session persistence across page reloads
 * - Session detection in URL (for OAuth flows)
 *
 * Security Notes:
 * - Only uses the anon key (public key, safe for frontend)
 * - Never expose the service_role key on the frontend
 * - Supabase handles token encryption and secure storage
 */

import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate required environment variables
if (!supabaseUrl) {
  throw new Error(
    'Missing VITE_SUPABASE_URL environment variable. ' +
    'Please add it to your .env file. ' +
    'Get your project URL from: https://app.supabase.com > Settings > API'
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_ANON_KEY environment variable. ' +
    'Please add it to your .env file. ' +
    'Get your anon key from: https://app.supabase.com > Settings > API'
  );
}

/**
 * Supabase Client Instance
 *
 * Configuration:
 * - autoRefreshToken: Automatically refresh tokens before expiry
 * - persistSession: Save session to localStorage for persistence
 * - detectSessionInUrl: Detect sessions from OAuth redirects
 * - storageKey: Custom key for localStorage (prevents conflicts)
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'intellifill-supabase-auth',
  },
});

/**
 * Helper function to get the current session
 *
 * Returns the active session or null if not authenticated.
 * This is a synchronous operation that reads from local cache.
 */
export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  return session;
};

/**
 * Helper function to get the current user
 *
 * Returns the authenticated user or null if not authenticated.
 */
export const getUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  return user;
};

/**
 * Type exports for better TypeScript support
 */
export type { Session, User, AuthError } from '@supabase/supabase-js';

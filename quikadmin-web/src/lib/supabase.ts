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
 * 
 * Note: When VITE_USE_BACKEND_AUTH=true, Supabase is optional.
 * All auth will go through the backend API instead.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const useBackendAuth = import.meta.env.VITE_USE_BACKEND_AUTH === 'true';

// Validate required environment variables (only if not using backend auth)
if (!useBackendAuth) {
if (!supabaseUrl) {
    console.error(
    'Missing VITE_SUPABASE_URL environment variable. ' +
      'Please add it to your .env file, or set VITE_USE_BACKEND_AUTH=true. ' +
    'Get your project URL from: https://app.supabase.com > Settings > API'
  );
}

if (!supabaseAnonKey) {
    console.error(
    'Missing VITE_SUPABASE_ANON_KEY environment variable. ' +
      'Please add it to your .env file, or set VITE_USE_BACKEND_AUTH=true. ' +
    'Get your anon key from: https://app.supabase.com > Settings > API'
  );
  }
}

/**
 * Supabase Client Instance
 *
 * Configuration:
 * - autoRefreshToken: Automatically refresh tokens before expiry
 * - persistSession: Save session to localStorage for persistence
 * - detectSessionInUrl: Detect sessions from OAuth redirects
 * - storageKey: Custom key for localStorage (prevents conflicts)
 * 
 * When using backend auth mode (VITE_USE_BACKEND_AUTH=true), this client
 * may not be fully configured. Always check if supabase is available
 * before using it.
 */
export const supabase: SupabaseClient = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'intellifill-supabase-auth',
  },
    })
  : null as any; // Null when using backend auth mode

/**
 * Check if Supabase client is configured and available
 */
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey && supabase);
};

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

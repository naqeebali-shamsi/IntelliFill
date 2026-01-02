/**
 * Unified Auth Store Export
 *
 * Uses Backend API authentication (routes through backend API)
 * This ensures all auth requests go through our backend rather than
 * directly to Supabase, providing better control and consistency.
 *
 * Usage: import { useAuthStore } from '@/stores/auth'
 */

// console.log('🔐 Auth mode: Backend API');

// Export backend auth store
export {
  useBackendAuthStore as useAuthStore,
  useBackendAuth as useAuth,
  useBackendAuthError as useAuthError,
  authSelectors,
} from './backendAuthStore';

// Export types
export type { LoadingStage } from './backendAuthStore';

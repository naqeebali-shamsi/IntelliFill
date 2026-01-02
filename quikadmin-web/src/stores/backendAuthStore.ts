/**
 * Backend Auth Store - Uses backend API for all authentication
 *
 * This store routes all auth through the backend API at /api/auth/v2/*
 * instead of using Supabase directly. This provides:
 * - No dependency on VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY
 * - All auth goes through the backend
 * - Simpler configuration
 * - Works without Supabase SDK errors
 *
 * To use this store instead of simpleAuthStore:
 * 1. Import from '@/stores/backendAuthStore' instead of '@/stores/simpleAuthStore'
 * 2. Or set VITE_USE_BACKEND_AUTH=true in .env
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import authService, { AuthUser, AuthTokens } from '@/services/authService';
import { AUTH_STORAGE_KEY } from '@/utils/migrationUtils';
import { toast } from '@/lib/toast';

interface LoginCredentials {
  email: string;
  password: string;
  companySlug?: string;
  rememberMe?: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  fullName?: string;
  name?: string;
  acceptTerms?: boolean;
  marketingConsent?: boolean;
}

interface AppError {
  id: string;
  code: string;
  message: string;
  details?: unknown;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  resolved: boolean;
}

// Loading stage type for distinguishing rehydration vs backend validation (REQ-009)
export type LoadingStage = 'idle' | 'rehydrating' | 'validating' | 'ready';

// =================== STORE INTERFACES ===================

interface DemoInfo {
  notice: string;
  features: string[];
}

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  tokenExpiresAt: number | null; // Unix timestamp (ms) when access token expires
  company: { id: string } | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  loadingStage: LoadingStage; // REQ-009: Loading stage for better UX feedback
  error: AppError | null;
  loginAttempts: number;
  isLocked: boolean;
  lockExpiry: number | null;
  lastActivity: number;
  rememberMe: boolean;
  isDemo: boolean; // Demo mode indicator
  demoInfo: DemoInfo | null; // Demo mode info (notice, features)
}

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  demoLogin: () => Promise<void>; // Demo mode login
  refreshToken: () => Promise<void>;
  refreshTokenIfNeeded: () => Promise<boolean>; // Proactive refresh - returns true if refreshed
  isTokenExpiringSoon: () => boolean; // Check if token expires within 5 minutes
  initialize: () => Promise<void>;
  checkSession: () => boolean;
  setError: (error: AppError | null) => void;
  clearError: () => void;
  resetLoginAttempts: () => void;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  verifyResetToken: (token: string) => Promise<void>;
  // REQ-009: Loading stage actions
  setLoadingStage: (stage: LoadingStage) => void;
}

type AuthStore = AuthState & AuthActions;

// =================== INITIAL STATE ===================

const initialState: AuthState = {
  user: null,
  tokens: null,
  tokenExpiresAt: null,
  company: null,
  isAuthenticated: false,
  isInitialized: false,
  isLoading: false,
  loadingStage: 'idle', // REQ-009: Start in idle state
  error: null,
  loginAttempts: 0,
  isLocked: false,
  lockExpiry: null,
  lastActivity: Date.now(),
  rememberMe: false,
  isDemo: false,
  demoInfo: null,
};

// Token refresh buffer - refresh 5 minutes before expiration
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

// Calculate token expiration timestamp from expiresIn (seconds)
function calculateTokenExpiresAt(expiresIn: number): number {
  return Date.now() + expiresIn * 1000;
}

// =================== HELPER FUNCTIONS ===================

function createAuthError(error: any): AppError {
  const status = error.response?.status;
  const serverMessage = error.response?.data?.error || error.message;
  const serverCode = error.response?.data?.code;

  let code = 'AUTH_ERROR';
  let message = 'Authentication error';

  switch (status) {
    case 401:
      code = 'INVALID_CREDENTIALS';
      message = 'Invalid email or password';
      break;
    case 403:
      // Check the server's actual error code/message instead of assuming account deactivation
      if (serverCode === 'ACCOUNT_DEACTIVATED') {
        code = 'ACCOUNT_DEACTIVATED';
        message = 'Account is deactivated. Please contact support.';
      } else {
        // Use server's error message for other 403 errors (CSRF, forbidden, etc.)
        code = serverCode || 'FORBIDDEN';
        message = serverMessage || 'Access forbidden';
      }
      break;
    case 409:
      code = 'EMAIL_EXISTS';
      message = 'An account with this email already exists';
      break;
    case 429:
      code = 'RATE_LIMIT';
      message = 'Too many requests. Please try again later.';
      break;
    default:
      message = serverMessage || error.message || message;
      code = serverCode || code;
  }

  return {
    id: `auth_error_${Date.now()}`,
    code,
    message,
    details: error.response?.data?.details,
    timestamp: Date.now(),
    severity: 'medium',
    component: 'auth',
    resolved: false,
  };
}

// =================== STORE IMPLEMENTATION ===================

export const useBackendAuthStore = create<AuthStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // =================== AUTHENTICATION ===================

        login: async (credentials: LoginCredentials) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await authService.login({
              email: credentials.email,
              password: credentials.password,
            });

            if (!response.success || !response.data) {
              throw new Error(response.error || 'Login failed');
            }

            const { user, tokens } = response.data;

            if (!tokens) {
              throw new Error('No tokens returned from login');
            }

            set((state) => {
              state.user = user;
              state.tokens = tokens;
              state.tokenExpiresAt = tokens.expiresIn
                ? calculateTokenExpiresAt(tokens.expiresIn)
                : null;
              state.isAuthenticated = true;
              state.isInitialized = true; // Mark as initialized after successful login
              state.lastActivity = Date.now();
              state.rememberMe = credentials.rememberMe || false;
              state.loginAttempts = 0;
              state.isLocked = false;
              state.lockExpiry = null;
              state.isLoading = false;
            });
          } catch (error: any) {
            const authError = createAuthError(error);

            set((state) => {
              state.error = authError;
              state.isLoading = false;
              state.loginAttempts += 1;

              if (state.loginAttempts >= 5) {
                state.isLocked = true;
                state.lockExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes
              }
            });

            throw authError;
          }
        },

        register: async (data: RegisterData) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await authService.register({
              email: data.email,
              password: data.password,
              fullName: data.fullName || data.name || '',
            });

            if (!response.success || !response.data) {
              throw new Error(response.error || 'Registration failed');
            }

            const { user, tokens } = response.data;

            set((state) => {
              state.user = user;
              state.tokens = tokens;
              state.tokenExpiresAt = tokens?.expiresIn
                ? calculateTokenExpiresAt(tokens.expiresIn)
                : null;
              state.isAuthenticated = !!tokens;
              state.isInitialized = true; // Mark as initialized after successful registration
              state.lastActivity = Date.now();
              state.isLoading = false;
            });
          } catch (error: any) {
            const authError = createAuthError(error);

            set((state) => {
              state.error = authError;
              state.isLoading = false;
            });

            throw authError;
          }
        },

        logout: async () => {
          try {
            await authService.logout();
          } catch (error) {
            console.warn('Logout request failed:', error);
          }

          // Clear localStorage
          localStorage.removeItem(AUTH_STORAGE_KEY);

          set((state) => {
            state.user = null;
            state.tokens = null;
            state.tokenExpiresAt = null;
            state.isAuthenticated = false;
            state.isDemo = false;
            state.demoInfo = null;
            state.error = null;
          });
        },

        demoLogin: async () => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await authService.demoLogin();

            if (!response.success || !response.data) {
              throw new Error(response.error || 'Demo login failed');
            }

            const { user, tokens, demo } = response.data;

            if (!tokens) {
              throw new Error('No tokens returned from demo login');
            }

            set((state) => {
              state.user = user;
              state.tokens = tokens;
              state.tokenExpiresAt = tokens.expiresIn
                ? calculateTokenExpiresAt(tokens.expiresIn)
                : null;
              state.isAuthenticated = true;
              state.isInitialized = true;
              state.isDemo = true;
              state.demoInfo = demo || null;
              state.lastActivity = Date.now();
              state.rememberMe = false;
              state.loginAttempts = 0;
              state.isLocked = false;
              state.lockExpiry = null;
              state.isLoading = false;
            });
          } catch (error: any) {
            const authError = createAuthError(error);

            set((state) => {
              state.error = authError;
              state.isLoading = false;
            });

            throw authError;
          }
        },

        refreshToken: async () => {
          try {
            const currentTokens = get().tokens;
            // With httpOnly cookies (Phase 2 REQ-005), the refreshToken is in the cookie
            // We don't need it in state to refresh, just pass it if available for backward compatibility
            const refreshTokenValue = currentTokens?.refreshToken;

            const response = await authService.refreshToken(refreshTokenValue);

            if (!response.success || !response.data?.tokens) {
              throw new Error('Token refresh failed');
            }

            const newTokens = response.data!.tokens;
            set((state) => {
              // Update tokens - accessToken comes from response, refreshToken may not
              state.tokens = {
                accessToken: newTokens.accessToken,
                expiresIn: newTokens.expiresIn,
                tokenType: newTokens.tokenType || 'Bearer',
                // Keep existing refreshToken if new one not provided (httpOnly cookie mode)
                refreshToken: newTokens.refreshToken || state.tokens?.refreshToken,
              };
              state.tokenExpiresAt = newTokens.expiresIn
                ? calculateTokenExpiresAt(newTokens.expiresIn)
                : null;
              state.lastActivity = Date.now();
            });
          } catch (error: any) {
            // Show toast notification for refresh failure (REQ-007)
            toast.error('Session expired. Please log in again.', {
              id: 'refresh-error',
              duration: 5000,
            });
            await get().logout();
            throw createAuthError(error);
          }
        },

        // Check if token expires within TOKEN_REFRESH_BUFFER_MS (5 minutes)
        isTokenExpiringSoon: () => {
          const { tokenExpiresAt, isAuthenticated } = get();
          if (!isAuthenticated || !tokenExpiresAt) {
            return false;
          }
          return Date.now() >= tokenExpiresAt - TOKEN_REFRESH_BUFFER_MS;
        },

        // Proactive refresh - refreshes token if expiring soon
        // Returns true if token was refreshed, false if not needed
        refreshTokenIfNeeded: async () => {
          const { isTokenExpiringSoon, isAuthenticated } = get();

          // No need to refresh if not expiring soon
          if (!isTokenExpiringSoon()) {
            return false;
          }

          // Can't refresh if not authenticated
          // Note: refreshToken is now in httpOnly cookie (Phase 2 REQ-005), so we don't check for it in memory
          if (!isAuthenticated) {
            return false;
          }

          try {
            await get().refreshToken();
            return true;
          } catch (error) {
            console.warn('Proactive token refresh failed:', error);
            return false;
          }
        },

        // =================== SESSION MANAGEMENT ===================

        initialize: async () => {
          // REQ-009: Set rehydrating stage during localStorage check
          set((state) => {
            state.isLoading = true;
            state.loadingStage = 'rehydrating';
          });

          try {
            const currentTokens = get().tokens;

            if (!currentTokens?.accessToken) {
              set((state) => {
                state.isInitialized = true;
                state.isLoading = false;
                state.loadingStage = 'ready';
              });
              return;
            }

            // REQ-009: Set validating stage before backend call
            set((state) => {
              state.loadingStage = 'validating';
            });

            // Verify token by fetching current user
            const response = await authService.getMe();

            if (response.success && response.data?.user) {
              set((state) => {
                state.user = response.data!.user as AuthUser;
                state.isAuthenticated = true;
                state.isInitialized = true;
                state.isLoading = false;
                state.loadingStage = 'ready';
              });
            } else {
              // Token invalid, clear session
              set((state) => {
                state.user = null;
                state.tokens = null;
                state.isAuthenticated = false;
                state.isInitialized = true;
                state.isLoading = false;
                state.loadingStage = 'ready';
              });
            }
          } catch (error) {
            console.error('Auth initialization error:', error);
            set((state) => {
              state.user = null;
              state.tokens = null;
              state.isAuthenticated = false;
              state.isInitialized = true;
              state.isLoading = false;
              state.loadingStage = 'ready';
            });
          }
        },

        checkSession: () => {
          const { tokens, isAuthenticated } = get();
          return isAuthenticated && !!tokens?.accessToken;
        },

        // =================== ERROR HANDLING ===================

        setError: (error: AppError | null) => {
          set((state) => {
            state.error = error;
          });
        },

        clearError: () => {
          set((state) => {
            state.error = null;
          });
        },

        // =================== SECURITY ===================

        /**
         * Check if we can perform token refresh
         * With httpOnly cookies (Phase 2 REQ-005), the cookie is sent automatically
         * We just need to verify we're authenticated
         */
        canRefreshToken: () => {
          const { isAuthenticated, tokens } = get();
          // With httpOnly cookies, we can refresh if authenticated
          // even without refreshToken in state (cookie handles it)
          return isAuthenticated && !!tokens?.accessToken;
        },

        resetLoginAttempts: () => {
          set((state) => {
            state.loginAttempts = 0;
            state.isLocked = false;
            state.lockExpiry = null;
          });
        },

        // =================== PASSWORD RESET ===================

        requestPasswordReset: async (email: string) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            await authService.requestPasswordReset(email);
            set((state) => {
              state.isLoading = false;
            });
          } catch (error: any) {
            const authError = createAuthError(error);
            set((state) => {
              state.error = authError;
              state.isLoading = false;
            });
            throw authError;
          }
        },

        resetPassword: async (token: string, password: string) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            await authService.resetPassword(token, password);
            set((state) => {
              state.isLoading = false;
            });
          } catch (error: any) {
            const authError = createAuthError(error);
            set((state) => {
              state.error = authError;
              state.isLoading = false;
            });
            throw authError;
          }
        },

        verifyResetToken: async (token: string) => {
          try {
            await authService.verifyResetToken(token);
          } catch (error: any) {
            throw createAuthError(error);
          }
        },

        // REQ-009: Manually set loading stage (for external components if needed)
        setLoadingStage: (stage: LoadingStage) => {
          set((state) => {
            state.loadingStage = stage;
          });
        },
      })),
      {
        name: AUTH_STORAGE_KEY,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          user: state.user,
          // Only persist accessToken - refreshToken is now in httpOnly cookie (Phase 2 REQ-005)
          tokens: state.tokens
            ? {
                accessToken: state.tokens.accessToken,
                expiresIn: state.tokens.expiresIn,
                tokenType: state.tokens.tokenType,
                // refreshToken excluded - stored in httpOnly cookie for security
              }
            : null,
          tokenExpiresAt: state.tokenExpiresAt,
          company: state.company,
          isAuthenticated: state.isAuthenticated,
          rememberMe: state.rememberMe,
          isInitialized: state.isInitialized, // Persist initialization state to survive page reloads
          lastActivity: state.lastActivity,
        }),
        version: 1,
        // Handle rehydration from localStorage - runs after persist middleware loads saved state
        // Automatically validates persisted tokens with backend
        onRehydrateStorage: () => (state) => {
          if (state) {
            // If we have tokens persisted, validate them with backend
            if (state.tokens?.accessToken && state.isAuthenticated) {
              // Call initialize to verify token validity
              // This ensures tokens are still valid after page reload
              const store = useBackendAuthStore.getState();
              store.initialize();
            }
          }
        },
      }
    ),
    {
      name: 'IntelliFill Backend Auth Store',
    }
  )
);

// =================== SELECTORS ===================

export const authSelectors = {
  isAuthenticated: (state: AuthStore) => state.isAuthenticated,
  user: (state: AuthStore) => state.user,
  isLoading: (state: AuthStore) => state.isLoading,
  loadingStage: (state: AuthStore) => state.loadingStage, // REQ-009
  error: (state: AuthStore) => state.error,
  isLocked: (state: AuthStore) => state.isLocked,
  isDemo: (state: AuthStore) => state.isDemo,
  demoInfo: (state: AuthStore) => state.demoInfo,
  canRetry: (state: AuthStore) =>
    !state.isLocked || (state.lockExpiry && Date.now() > state.lockExpiry),
};

// =================== HOOKS ===================

export const useBackendAuth = () =>
  useBackendAuthStore((state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    loadingStage: state.loadingStage, // REQ-009
    isDemo: state.isDemo,
    demoInfo: state.demoInfo,
    login: state.login,
    logout: state.logout,
    register: state.register,
    demoLogin: state.demoLogin,
  }));

export const useBackendAuthError = () =>
  useBackendAuthStore((state) => ({
    error: state.error,
    clearError: state.clearError,
    setError: state.setError,
  }));

// Re-export as useAuthStore for easy switching
export { useBackendAuthStore as useAuthStore };

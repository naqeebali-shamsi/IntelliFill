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

import { create, type StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import * as Sentry from '@sentry/react';
import authService, { AuthUser, AuthTokens } from '@/services/authService';
import { AUTH_STORAGE_KEY } from '@/utils/migrationUtils';
import { toast } from '@/lib/toast';
import { tokenManager } from '@/lib/tokenManager';

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

// Task 504: Server-side lockout status from API response
interface ServerLockoutStatus {
  isLocked: boolean;
  attemptsRemaining: number;
  lockoutExpiresAt: Date | null;
}

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  tokenExpiresAt: number | null; // Unix timestamp (ms) when access token expires
  company: { id: string } | null;
  isAuthenticated: boolean;
  sessionIndicator: boolean; // Task 292: Indicates a session MAY exist (for silent refresh detection)
  isInitialized: boolean;
  isLoading: boolean;
  loadingStage: LoadingStage; // REQ-009: Loading stage for better UX feedback
  error: AppError | null;
  loginAttempts: number;
  isLocked: boolean;
  lockExpiry: number | null;
  serverLockout: ServerLockoutStatus | null; // Task 504: Server-side lockout info
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
  sessionIndicator: false, // Task 292: No session initially
  isInitialized: false,
  isLoading: false,
  loadingStage: 'idle', // REQ-009: Start in idle state
  error: null,
  loginAttempts: 0,
  isLocked: false,
  lockExpiry: null,
  serverLockout: null, // Task 504: No server lockout initially
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

function createAuthError(error: unknown): AppError {
  const errorObj = error as {
    response?: { status?: number; data?: { error?: string; code?: string; details?: unknown } };
    message?: string;
  };
  const status = errorObj.response?.status;
  const serverMessage = errorObj.response?.data?.error || errorObj.message;
  const serverCode = errorObj.response?.data?.code;

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
      message = serverMessage || errorObj.message || message;
      code = serverCode || code;
  }

  return {
    id: `auth_error_${Date.now()}`,
    code,
    message,
    details: errorObj.response?.data?.details,
    timestamp: Date.now(),
    severity: 'medium',
    component: 'auth',
    resolved: false,
  };
}

// =================== STORE IMPLEMENTATION ===================

// Task 296: Helper to conditionally apply devtools only in development mode
function applyDevtools<T>(middleware: T): T {
  if (import.meta.env.DEV) {
    return devtools(middleware as any, {
      name: 'IntelliFill Backend Auth Store',
    }) as T;
  }
  return middleware;
}

// =================== ACTION HELPERS ===================

type ImmerStateSetter = (fn: (state: AuthState) => void) => void;

/** Sets loading state and clears error before an action */
function startAction(set: ImmerStateSetter): void {
  set((state) => {
    state.isLoading = true;
    state.error = null;
  });
}

/** Clears loading state after action completes */
function finishAction(set: ImmerStateSetter): void {
  set((state) => {
    state.isLoading = false;
  });
}

/** Sets error and clears loading on failure */
function handleActionError(set: ImmerStateSetter, error: unknown): AppError {
  const authError = createAuthError(error);
  set((state) => {
    state.error = authError;
    state.isLoading = false;
  });
  return authError;
}

interface AuthSuccessData {
  user: AuthUser;
  tokens: AuthTokens;
  isDemo?: boolean;
  demoInfo?: DemoInfo | null;
  rememberMe?: boolean;
}

/** Updates state after successful authentication (login, register, demoLogin) */
function setAuthenticatedState(set: ImmerStateSetter, data: AuthSuccessData): void {
  const { user, tokens, isDemo = false, demoInfo = null, rememberMe = false } = data;

  // Store access token in memory (Task 277: XSS mitigation)
  tokenManager.setToken(tokens.accessToken, tokens.expiresIn);

  // Set Sentry user context for error reporting (Task 552)
  if (import.meta.env.PROD) {
    Sentry.setUser({ id: user.id, email: user.email });
  }

  set((state) => {
    state.user = user;
    state.tokens = tokens;
    state.tokenExpiresAt = tokens.expiresIn ? calculateTokenExpiresAt(tokens.expiresIn) : null;
    state.isAuthenticated = true;
    state.sessionIndicator = true;
    state.isInitialized = true;
    state.lastActivity = Date.now();
    state.isDemo = isDemo;
    state.demoInfo = demoInfo;
    state.rememberMe = rememberMe;
    state.loginAttempts = 0;
    state.isLocked = false;
    state.lockExpiry = null;
    state.serverLockout = null;
    state.isLoading = false;
  });
}

/** Clears all session state */
function clearSessionState(set: ImmerStateSetter): void {
  tokenManager.clearToken();

  // Clear Sentry user context on logout (Task 552)
  if (import.meta.env.PROD) {
    Sentry.setUser(null);
  }

  set((state) => {
    state.user = null;
    state.tokens = null;
    state.tokenExpiresAt = null;
    state.isAuthenticated = false;
    state.sessionIndicator = false;
    state.isInitialized = true;
    state.isLoading = false;
    state.loadingStage = 'ready';
  });
}

interface ServerLockoutInfo {
  code?: string;
  lockoutExpiresAt?: string;
  attemptsRemaining?: number;
}

/** Updates lockout state from server error response */
function handleLoginLockout(set: ImmerStateSetter, errorData: ServerLockoutInfo | undefined): void {
  if (!errorData) return;

  set((state) => {
    state.loginAttempts += 1;

    if (errorData.code === 'ACCOUNT_LOCKED') {
      const expiresAt = errorData.lockoutExpiresAt ? new Date(errorData.lockoutExpiresAt) : null;
      state.serverLockout = {
        isLocked: true,
        attemptsRemaining: 0,
        lockoutExpiresAt: expiresAt,
      };
      state.isLocked = true;
      state.lockExpiry = expiresAt ? expiresAt.getTime() : Date.now() + 15 * 60 * 1000;
    } else if (errorData.attemptsRemaining !== undefined) {
      state.serverLockout = {
        isLocked: false,
        attemptsRemaining: errorData.attemptsRemaining,
        lockoutExpiresAt: null,
      };
    } else if (state.loginAttempts >= 5) {
      // Fallback to client-side lockout if server doesn't provide info
      state.isLocked = true;
      state.lockExpiry = Date.now() + 15 * 60 * 1000;
    }
  });
}

export const useBackendAuthStore = create<AuthStore>()(
  applyDevtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // =================== AUTHENTICATION ===================

        login: async (credentials: LoginCredentials) => {
          startAction(set);

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

            setAuthenticatedState(set, {
              user,
              tokens,
              rememberMe: credentials.rememberMe,
            });
          } catch (error: unknown) {
            const authError = handleActionError(set, error);
            // Task 504: Handle server-side lockout
            const errorData = (error as any).response?.data?.error;
            handleLoginLockout(set, errorData);
            throw authError;
          }
        },

        register: async (data: RegisterData) => {
          startAction(set);

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

            // Registration may not return tokens (email verification required)
            if (tokens) {
              setAuthenticatedState(set, { user, tokens });
            } else {
              set((state) => {
                state.user = user;
                state.isInitialized = true;
                state.lastActivity = Date.now();
                state.isLoading = false;
              });
            }
          } catch (error: unknown) {
            throw handleActionError(set, error);
          }
        },

        logout: async () => {
          try {
            await authService.logout();
          } catch (error) {
            console.warn('Logout request failed:', error);
          }

          // Clear localStorage before state to ensure clean slate
          localStorage.removeItem(AUTH_STORAGE_KEY);

          clearSessionState(set);
          set((state) => {
            state.isDemo = false;
            state.demoInfo = null;
            state.error = null;
          });
        },

        demoLogin: async () => {
          startAction(set);

          try {
            const response = await authService.demoLogin();

            if (!response.success || !response.data) {
              throw new Error(response.error || 'Demo login failed');
            }

            const { user, tokens, demo } = response.data;
            if (!tokens) {
              throw new Error('No tokens returned from demo login');
            }

            setAuthenticatedState(set, {
              user,
              tokens,
              isDemo: true,
              demoInfo: demo || null,
            });
          } catch (error: unknown) {
            throw handleActionError(set, error);
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

            // Update in-memory token (Task 277: XSS mitigation)
            tokenManager.setToken(newTokens.accessToken, newTokens.expiresIn);

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
          } catch (error: unknown) {
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

        /**
         * Initialize auth state on app startup
         *
         * Task 278: Silent Token Refresh Flow
         * When page refreshes, the in-memory access token is lost but:
         * - isAuthenticated may still be true (from localStorage)
         * - httpOnly refresh token cookie is still valid
         *
         * Flow:
         * 1. Check if session exists (isAuthenticated from localStorage)
         * 2. If in-memory token is missing, attempt silent refresh via cookie
         * 3. On success, restore the access token in memory
         * 4. On failure, clear session and require re-login
         */
        initialize: async () => {
          // REQ-009: Set rehydrating stage during localStorage check
          set((state) => {
            state.isLoading = true;
            state.loadingStage = 'rehydrating';
          });

          /** Mark initialization complete without session */
          const completeWithoutSession = (): void => {
            set((state) => {
              state.isInitialized = true;
              state.isLoading = false;
              state.loadingStage = 'ready';
            });
          };

          /** Apply new tokens after successful refresh */
          const applyRefreshedTokens = (newTokens: AuthTokens): void => {
            tokenManager.setToken(newTokens.accessToken, newTokens.expiresIn);
            set((state) => {
              state.tokens = {
                accessToken: newTokens.accessToken,
                expiresIn: newTokens.expiresIn,
                tokenType: newTokens.tokenType || 'Bearer',
                refreshToken: newTokens.refreshToken || state.tokens?.refreshToken,
              };
              state.tokenExpiresAt = newTokens.expiresIn
                ? calculateTokenExpiresAt(newTokens.expiresIn)
                : null;
              state.isAuthenticated = true;
              state.isInitialized = true;
              state.isLoading = false;
              state.loadingStage = 'ready';
              state.lastActivity = Date.now();
            });
          };

          try {
            const { sessionIndicator } = get();
            const hasInMemoryToken = tokenManager.hasToken();

            // Case 1: No session indicator - nothing to do
            if (!sessionIndicator) {
              completeWithoutSession();
              return;
            }

            // Case 2: Session indicator exists but in-memory token is missing (page refresh)
            // Task 278: Attempt silent refresh using httpOnly refresh cookie
            if (!hasInMemoryToken) {
              console.log('[Auth DEBUG] Attempting silent refresh:', {
                sessionIndicator,
                hasInMemoryToken,
              });
              set((state) => {
                state.loadingStage = 'validating';
              });

              try {
                console.log('[Auth DEBUG] Calling authService.refreshToken()...');
                const response = await authService.refreshToken();
                console.log('[Auth DEBUG] refreshToken response:', {
                  success: response.success,
                  hasTokens: !!response.data?.tokens,
                  error: response.error,
                });

                if (response.success && response.data?.tokens) {
                  applyRefreshedTokens(response.data.tokens);

                  // Fetch user data after successful refresh
                  try {
                    const userResponse = await authService.getMe();
                    if (userResponse.success && userResponse.data?.user) {
                      set((state) => {
                        state.user = userResponse.data!.user as AuthUser;
                      });
                    }
                  } catch {
                    console.warn('[Auth] User data fetch failed after silent refresh');
                  }
                  return;
                }
              } catch (refreshError) {
                console.warn('[Auth] Silent refresh failed:', refreshError);
              }

              // Silent refresh failed - clear session
              clearSessionState(set);
              return;
            }

            // Case 3: Session exists and in-memory token is present
            // Validate the token by fetching current user
            set((state) => {
              state.loadingStage = 'validating';
            });

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
              clearSessionState(set);
            }
          } catch (error) {
            console.error('Auth initialization error:', error);
            clearSessionState(set);
          }
        },

        checkSession: () => {
          // Task 292: Verify token presence in tokenManager (source of truth)
          const { isAuthenticated } = get();
          return isAuthenticated && tokenManager.hasToken() && !tokenManager.isExpiringSoon(0);
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

        resetLoginAttempts: () => {
          set((state) => {
            state.loginAttempts = 0;
            state.isLocked = false;
            state.lockExpiry = null;
          });
        },

        // =================== PASSWORD RESET ===================

        requestPasswordReset: async (email: string) => {
          startAction(set);
          try {
            await authService.requestPasswordReset(email);
            finishAction(set);
          } catch (error: unknown) {
            throw handleActionError(set, error);
          }
        },

        resetPassword: async (token: string, password: string) => {
          startAction(set);
          try {
            await authService.resetPassword(token, password);
            finishAction(set);
          } catch (error: unknown) {
            throw handleActionError(set, error);
          }
        },

        verifyResetToken: async (token: string) => {
          try {
            await authService.verifyResetToken(token);
          } catch (error: unknown) {
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
          // Task 277: Access token is now stored in memory only (XSS mitigation)
          // Only persist metadata needed for session awareness, NOT the actual token
          tokens: state.tokens
            ? {
                // accessToken EXCLUDED - stored in memory via tokenManager (Task 277)
                // refreshToken EXCLUDED - stored in httpOnly cookie (Phase 2 REQ-005)
                expiresIn: state.tokens.expiresIn,
                tokenType: state.tokens.tokenType,
              }
            : null,
          tokenExpiresAt: state.tokenExpiresAt,
          company: state.company,
          // Task 292: Persist sessionIndicator, not isAuthenticated
          // isAuthenticated should only be true when tokenManager has a valid token
          sessionIndicator: state.isAuthenticated, // Persist indicator, not actual auth state
          rememberMe: state.rememberMe,
          // WHY isInitialized IS PERSISTED:
          // We persist isInitialized to distinguish between:
          // 1. Fresh app load (isInitialized=false) - needs full initialization
          // 2. Page reload with existing session (isInitialized=true) - needs silent refresh
          //
          // IMPORTANT: When sessionIndicator=true but no in-memory token exists (page reload),
          // onRehydrateStorage resets isInitialized=false to prevent ProtectedRoute from
          // redirecting to login before initialize() can perform silent refresh.
          // See onRehydrateStorage callback below for the race condition fix.
          isInitialized: state.isInitialized,
          lastActivity: state.lastActivity,
        }),
        version: 1,
        // Handle rehydration from localStorage - runs after persist middleware loads saved state
        // Task 292: Updated to work with sessionIndicator instead of isAuthenticated
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Task 292: If sessionIndicator exists but no token in memory,
            // isAuthenticated should remain false until initialize() completes silent refresh
            if (state.sessionIndicator && !tokenManager.hasToken()) {
              // Don't set isAuthenticated=true yet
              // initialize() will handle silent refresh and restore isAuthenticated
              state.isAuthenticated = false;
              // CRITICAL FIX: Reset isInitialized to false to prevent ProtectedRoute
              // from redirecting to login before initialize() can run silent refresh.
              // Without this, the persisted isInitialized=true causes a race condition
              // where ProtectedRoute sees isInitialized=true, calls checkSession() which
              // fails (no token), and redirects to login before initialize() runs.
              state.isInitialized = false;
              state.isLoading = true;
              state.loadingStage = 'rehydrating';
            }
          }
        },
      }
    )
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
  serverLockout: (state: AuthStore) => state.serverLockout, // Task 504
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

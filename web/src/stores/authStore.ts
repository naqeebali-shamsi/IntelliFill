/**
 * Authentication Store - Manages user authentication, tokens, and session state
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { User, AuthTokens, AppError } from './types';
import { createMiddleware } from './middleware';
import api from '@/services/api';

// =================== STORE INTERFACES ===================

interface AuthState {
  // User data
  user: User | null;
  tokens: AuthTokens | null;
  
  // Authentication status
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  
  // Session management
  sessionExpiry: number | null;
  lastActivity: number;
  rememberMe: boolean;
  
  // Error handling
  error: AppError | null;
  loginAttempts: number;
  isLocked: boolean;
  lockExpiry: number | null;
  
  // Security
  deviceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

interface AuthActions {
  // Authentication actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  
  // User management
  updateUser: (updates: Partial<User>) => void;
  updatePreferences: (preferences: Partial<User['preferences']>) => Promise<void>;
  
  // Session management
  extendSession: () => void;
  checkSession: () => boolean;
  clearSession: () => void;
  
  // Security
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  enableTwoFactor: () => Promise<string>; // Returns QR code
  verifyTwoFactor: (code: string) => Promise<void>;
  disableTwoFactor: (code: string) => Promise<void>;
  
  // Error handling
  clearError: () => void;
  setError: (error: AppError) => void;
  incrementLoginAttempts: () => void;
  resetLoginAttempts: () => void;
  
  // Initialization
  initialize: () => Promise<void>;
  hydrate: () => void;
}

// =================== REQUEST TYPES ===================

interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
  twoFactorCode?: string;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  acceptTerms: boolean;
  marketingConsent?: boolean;
}

// =================== STORE IMPLEMENTATION ===================

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  sessionExpiry: null,
  lastActivity: Date.now(),
  rememberMe: false,
  error: null,
  loginAttempts: 0,
  isLocked: false,
  lockExpiry: null,
  deviceId: null,
  ipAddress: null,
  userAgent: null,
};

export const useAuthStore = create<AuthStore>()(
  createMiddleware(
    {
      persist: true,
      persistName: 'intellifill-auth',
      persistOptions: {
        partialize: (state) => ({
          user: state.user,
          tokens: state.tokens,
          isAuthenticated: state.isAuthenticated,
          sessionExpiry: state.sessionExpiry,
          lastActivity: state.lastActivity,
          rememberMe: state.rememberMe,
          deviceId: state.deviceId,
          loginAttempts: state.loginAttempts,
          isLocked: state.isLocked,
          lockExpiry: state.lockExpiry,
        }),
        version: 1,
      },
      devtools: true,
      devtoolsName: 'IntelliFill Auth Store',
      logger: process.env.NODE_ENV === 'development',
      performance: true,
      performanceId: 'auth-store',
      errorBoundary: true,
      immer: true,
      subscribeWithSelector: true,
    },
    (set, get) => ({
      ...initialState,

      // =================== AUTHENTICATION ACTIONS ===================

      login: async (credentials: LoginCredentials) => {
        set((draft) => {
          draft.isLoading = true;
          draft.error = null;
        });

        try {
          const response = await api.post('/auth/login', {
            ...credentials,
            deviceId: get().deviceId || generateDeviceId(),
            userAgent: navigator.userAgent,
          });

          if (response.data.success) {
            const { user, tokens } = response.data.data;
            const expiresAt = Date.now() + (tokens.expiresIn * 1000);

            set((draft) => {
              draft.user = user;
              draft.tokens = { ...tokens, expiresAt };
              draft.isAuthenticated = true;
              draft.sessionExpiry = expiresAt;
              draft.rememberMe = credentials.rememberMe || false;
              draft.lastActivity = Date.now();
              draft.loginAttempts = 0;
              draft.isLocked = false;
              draft.lockExpiry = null;
              draft.isLoading = false;
            });

            // Set up token refresh
            setupTokenRefresh(tokens.expiresIn);
          }
        } catch (error: any) {
          const authError = createAuthError(error);
          
          set((draft) => {
            draft.error = authError;
            draft.isLoading = false;
            
            if (error.response?.status === 401) {
              draft.loginAttempts++;
              
              if (draft.loginAttempts >= 5) {
                draft.isLocked = true;
                draft.lockExpiry = Date.now() + (15 * 60 * 1000); // 15 minutes
              }
            }
          });
          
          throw authError;
        }
      },

      register: async (userData: RegisterData) => {
        set((draft) => {
          draft.isLoading = true;
          draft.error = null;
        });

        try {
          const response = await api.post('/auth/register', {
            ...userData,
            deviceId: generateDeviceId(),
          });

          if (response.data.success) {
            // Auto-login after successful registration
            await get().login({
              email: userData.email,
              password: userData.password,
            });
          }
        } catch (error: any) {
          const authError = createAuthError(error);
          set((draft) => {
            draft.error = authError;
            draft.isLoading = false;
          });
          throw authError;
        }
      },

      logout: async () => {
        set((draft) => {
          draft.isLoading = true;
        });

        try {
          const tokens = get().tokens;
          if (tokens) {
            await api.post('/auth/logout', { 
              refreshToken: tokens.refreshToken 
            });
          }
        } catch (error) {
          console.warn('Logout API call failed:', error);
        } finally {
          // Clear state regardless of API call success
          set((draft) => {
            Object.assign(draft, {
              ...initialState,
              isInitialized: true, // Keep initialized state
            });
          });
          
          // Clear stored tokens
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          
          clearTokenRefresh();
        }
      },

      refreshToken: async () => {
        const tokens = get().tokens;
        if (!tokens?.refreshToken) {
          throw new Error('No refresh token available');
        }

        try {
          const response = await api.post('/auth/refresh', {
            refreshToken: tokens.refreshToken,
          });

          if (response.data.success) {
            const newTokens = response.data.data.tokens;
            const expiresAt = Date.now() + (newTokens.expiresIn * 1000);

            set((draft) => {
              draft.tokens = { ...newTokens, expiresAt };
              draft.sessionExpiry = expiresAt;
              draft.lastActivity = Date.now();
            });

            setupTokenRefresh(newTokens.expiresIn);
          }
        } catch (error) {
          // Refresh failed, logout user
          await get().logout();
          throw error;
        }
      },

      // =================== USER MANAGEMENT ===================

      updateUser: (updates: Partial<User>) => {
        set((draft) => {
          if (draft.user) {
            Object.assign(draft.user, updates);
          }
        });
      },

      updatePreferences: async (preferences: Partial<User['preferences']>) => {
        const user = get().user;
        if (!user) return;

        try {
          const response = await api.put(`/users/${user.id}/preferences`, preferences);
          
          if (response.data.success) {
            set((draft) => {
              if (draft.user) {
                draft.user.preferences = { ...draft.user.preferences, ...preferences };
              }
            });
          }
        } catch (error) {
          throw createAuthError(error);
        }
      },

      // =================== SESSION MANAGEMENT ===================

      extendSession: () => {
        set((draft) => {
          draft.lastActivity = Date.now();
          if (draft.sessionExpiry) {
            // Extend session by 30 minutes if user is active
            draft.sessionExpiry = Math.max(draft.sessionExpiry, Date.now() + (30 * 60 * 1000));
          }
        });
      },

      checkSession: (): boolean => {
        const { sessionExpiry, isAuthenticated, isLocked, lockExpiry } = get();
        
        // Check if account is locked
        if (isLocked && lockExpiry && Date.now() < lockExpiry) {
          return false;
        } else if (isLocked && lockExpiry && Date.now() >= lockExpiry) {
          // Unlock account
          set((draft) => {
            draft.isLocked = false;
            draft.lockExpiry = null;
            draft.loginAttempts = 0;
          });
        }
        
        // Check session expiry
        if (isAuthenticated && sessionExpiry && Date.now() >= sessionExpiry) {
          get().logout();
          return false;
        }
        
        return isAuthenticated;
      },

      clearSession: () => {
        set((draft) => {
          Object.assign(draft, initialState);
        });
      },

      // =================== SECURITY ACTIONS ===================

      changePassword: async (currentPassword: string, newPassword: string) => {
        const user = get().user;
        if (!user) throw new Error('User not authenticated');

        try {
          await api.post('/auth/change-password', {
            currentPassword,
            newPassword,
          });
        } catch (error) {
          throw createAuthError(error);
        }
      },

      enableTwoFactor: async () => {
        const user = get().user;
        if (!user) throw new Error('User not authenticated');

        try {
          const response = await api.post('/auth/2fa/enable');
          return response.data.data.qrCode;
        } catch (error) {
          throw createAuthError(error);
        }
      },

      verifyTwoFactor: async (code: string) => {
        try {
          await api.post('/auth/2fa/verify', { code });
          
          set((draft) => {
            if (draft.user) {
              draft.user.preferences = {
                ...draft.user.preferences,
                // Add 2FA enabled flag if needed
              };
            }
          });
        } catch (error) {
          throw createAuthError(error);
        }
      },

      disableTwoFactor: async (code: string) => {
        try {
          await api.post('/auth/2fa/disable', { code });
        } catch (error) {
          throw createAuthError(error);
        }
      },

      // =================== ERROR HANDLING ===================

      clearError: () => {
        set((draft) => {
          draft.error = null;
        });
      },

      setError: (error: AppError) => {
        set((draft) => {
          draft.error = error;
        });
      },

      incrementLoginAttempts: () => {
        set((draft) => {
          draft.loginAttempts++;
          
          if (draft.loginAttempts >= 5) {
            draft.isLocked = true;
            draft.lockExpiry = Date.now() + (15 * 60 * 1000);
          }
        });
      },

      resetLoginAttempts: () => {
        set((draft) => {
          draft.loginAttempts = 0;
          draft.isLocked = false;
          draft.lockExpiry = null;
        });
      },

      // =================== INITIALIZATION ===================

      initialize: async () => {
        if (get().isInitialized) return;

        set((draft) => {
          draft.isLoading = true;
        });

        try {
          // Check for stored tokens
          const token = localStorage.getItem('token');
          const refreshToken = localStorage.getItem('refreshToken');
          const userStr = localStorage.getItem('user');

          if (token && refreshToken && userStr) {
            const user = JSON.parse(userStr);
            
            // Verify token is still valid
            try {
              const response = await api.get('/auth/me');
              
              if (response.data.success) {
                set((draft) => {
                  draft.user = response.data.data;
                  draft.tokens = { accessToken: token, refreshToken, expiresAt: 0 };
                  draft.isAuthenticated = true;
                  draft.lastActivity = Date.now();
                });
              }
            } catch (error) {
              // Token invalid, clear storage
              localStorage.removeItem('token');
              localStorage.removeItem('refreshToken');
              localStorage.removeItem('user');
            }
          }

          // Generate device ID if not exists
          if (!get().deviceId) {
            set((draft) => {
              draft.deviceId = generateDeviceId();
            });
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
        } finally {
          set((draft) => {
            draft.isLoading = false;
            draft.isInitialized = true;
          });
        }
      },

      hydrate: () => {
        // This will be called automatically by persist middleware
        set((draft) => {
          draft.isInitialized = true;
        });
      },
    })
  )
);

// =================== HELPER FUNCTIONS ===================

let refreshTimeoutId: NodeJS.Timeout | null = null;

function setupTokenRefresh(expiresInSeconds: number) {
  clearTokenRefresh();
  
  // Refresh token 5 minutes before expiry
  const refreshTime = (expiresInSeconds - 300) * 1000;
  
  if (refreshTime > 0) {
    refreshTimeoutId = setTimeout(async () => {
      try {
        await useAuthStore.getState().refreshToken();
      } catch (error) {
        console.error('Auto token refresh failed:', error);
      }
    }, refreshTime);
  }
}

function clearTokenRefresh() {
  if (refreshTimeoutId) {
    clearTimeout(refreshTimeoutId);
    refreshTimeoutId = null;
  }
}

function generateDeviceId(): string {
  return 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
}

function createAuthError(error: any): AppError {
  const { createAuthError: createStandardAuthError } = require('./errorHandler');
  const storeError = createStandardAuthError(error);
  return storeError.toAppError({
    status: error.response?.status,
    url: error.config?.url,
  });
}

// =================== SELECTORS ===================

export const authSelectors = {
  isAuthenticated: (state: AuthStore) => state.isAuthenticated,
  user: (state: AuthStore) => state.user,
  isLoading: (state: AuthStore) => state.isLoading,
  error: (state: AuthStore) => state.error,
  isLocked: (state: AuthStore) => state.isLocked,
  canLogin: (state: AuthStore) => !state.isLocked || (state.lockExpiry && Date.now() >= state.lockExpiry),
  sessionTimeRemaining: (state: AuthStore) => {
    if (!state.sessionExpiry) return null;
    return Math.max(0, state.sessionExpiry - Date.now());
  },
  userRole: (state: AuthStore) => state.user?.role,
  hasPermission: (permission: string) => (state: AuthStore) => {
    // Implement permission checking logic based on user role
    return state.user?.role === 'admin' || state.user?.subscription?.features.includes(permission);
  },
};

// =================== HOOKS FOR SPECIFIC USE CASES ===================

export const useAuth = () => useAuthStore(authSelectors.isAuthenticated);
export const useUser = () => useAuthStore(authSelectors.user);
export const useAuthError = () => useAuthStore(authSelectors.error);
export const useAuthLoading = () => useAuthStore(authSelectors.isLoading);
export const useUserRole = () => useAuthStore(authSelectors.userRole);

// =================== EXPORT TYPES ===================

export type { AuthState, AuthActions, LoginCredentials, RegisterData };
/**
 * Simplified AuthStore without complex middleware for better TypeScript compatibility
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { User, AuthTokens, AppError, LoginCredentials, RegisterData } from './types';
import api from '@/services/api';

// =================== STORE INTERFACES ===================

interface AuthState {
  // Core authentication state
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  
  // Loading and error states
  isLoading: boolean;
  error: AppError | null;
  
  // Security features
  loginAttempts: number;
  isLocked: boolean;
  lockExpiry: number | null;
  sessionExpiry: number | null;
  lastActivity: number;
  rememberMe: boolean;
  
  // Session management
  deviceId: string | null;
  ipAddress: string | null;
  userAgent: string;
}

interface AuthActions {
  // Authentication
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  
  // Session management
  initialize: () => Promise<void>;
  checkSession: () => boolean;
  extendSession: () => void;
  clearSession: () => void;
  
  // User management
  updateUser: (updates: Partial<User>) => void;
  updateProfile: (profile: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  
  // Error handling
  setError: (error: AppError | null) => void;
  clearError: () => void;
  
  // Security
  resetLoginAttempts: () => void;
}

type AuthStore = AuthState & AuthActions;

// =================== INITIAL STATE ===================

const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isInitialized: false,
  isLoading: false,
  error: null,
  loginAttempts: 0,
  isLocked: false,
  lockExpiry: null,
  sessionExpiry: null,
  lastActivity: Date.now(),
  rememberMe: false,
  deviceId: null,
  ipAddress: null,
  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
};

// =================== HELPER FUNCTIONS ===================

function generateDeviceId(): string {
  return 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
}

function createAuthError(error: any): AppError {
  const status = error.response?.status;
  const serverMessage = error.response?.data?.message;
  const serverCode = error.response?.data?.code;

  let code = 'AUTH_ERROR';
  let message = 'Authentication error';

  switch (status) {
    case 401:
      code = 'INVALID_CREDENTIALS';
      message = 'Invalid email or password';
      break;
    case 423:
      code = 'ACCOUNT_LOCKED';
      message = 'Account is temporarily locked';
      break;
    case 429:
      code = 'RATE_LIMIT';
      message = 'Too many requests. Please try again later.';
      break;
    case 409:
      code = 'EMAIL_EXISTS';
      message = 'An account with this email already exists';
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

export const useAuthStore = create<AuthStore>()(
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
            const response = await api.post('/auth/login', {
              email: credentials.email,
              password: credentials.password,
              rememberMe: credentials.rememberMe,
              deviceId: get().deviceId || generateDeviceId(),
            });

            const { user, tokens } = response.data.data;

            set((state) => {
              state.user = user;
              state.tokens = tokens;
              state.isAuthenticated = true;
              state.sessionExpiry = tokens.expiresAt;
              state.lastActivity = Date.now();
              state.rememberMe = credentials.rememberMe || false;
              state.loginAttempts = 0;
              state.isLocked = false;
              state.lockExpiry = null;
              state.deviceId = state.deviceId || generateDeviceId();
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
                state.lockExpiry = Date.now() + (15 * 60 * 1000); // 15 minutes
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
            const response = await api.post('/auth/register', {
              ...data,
              deviceId: get().deviceId || generateDeviceId(),
            });

            const { user, tokens } = response.data.data;

            set((state) => {
              state.user = user;
              state.tokens = tokens;
              state.isAuthenticated = true;
              state.sessionExpiry = tokens.expiresAt;
              state.lastActivity = Date.now();
              state.rememberMe = data.acceptTerms;
              state.deviceId = state.deviceId || generateDeviceId();
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
            if (get().tokens?.refreshToken) {
              await api.post('/auth/logout', {
                refreshToken: get().tokens?.refreshToken,
              });
            }
          } catch (error) {
            console.warn('Logout request failed:', error);
          }

          set((state) => {
            state.user = null;
            state.tokens = null;
            state.isAuthenticated = false;
            state.sessionExpiry = null;
            state.error = null;
            state.deviceId = null;
          });
        },

        refreshToken: async () => {
          const { tokens } = get();
          if (!tokens?.refreshToken) {
            throw new Error('No refresh token available');
          }

          try {
            const response = await api.post('/auth/refresh', {
              refreshToken: tokens.refreshToken,
            });

            const newTokens = response.data.data.tokens;

            set((state) => {
              state.tokens = newTokens;
              state.sessionExpiry = newTokens.expiresAt;
              state.lastActivity = Date.now();
            });
          } catch (error: any) {
            await get().logout();
            throw createAuthError(error);
          }
        },

        // =================== SESSION MANAGEMENT ===================

        initialize: async () => {
          set((state) => {
            state.isLoading = true;
          });

          try {
            const state = get();
            
            if (state.tokens?.accessToken) {
              // Validate existing session
              const isValid = get().checkSession();
              if (isValid) {
                set((draft) => {
                  draft.isAuthenticated = true;
                  draft.isInitialized = true;
                  draft.isLoading = false;
                });
                return;
              }
            }

            // No valid session
            set((state) => {
              state.isInitialized = true;
              state.isLoading = false;
            });
          } catch (error) {
            console.error('Auth initialization error:', error);
            set((state) => {
              state.isInitialized = true;
              state.isLoading = false;
            });
          }
        },

        checkSession: () => {
          const { tokens, sessionExpiry } = get();
          
          if (!tokens?.accessToken || !sessionExpiry) {
            return false;
          }

          // Check if token is expired
          if (Date.now() >= sessionExpiry) {
            get().logout();
            return false;
          }

          return true;
        },

        extendSession: () => {
          set((state) => {
            state.lastActivity = Date.now();
          });
        },

        clearSession: () => {
          set((state) => Object.assign(state, initialState));
        },

        // =================== USER MANAGEMENT ===================

        updateUser: (updates: Partial<User>) => {
          set((state) => {
            if (state.user) {
              Object.assign(state.user, updates);
            }
          });
        },

        updateProfile: async (profile: Partial<User>) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await api.put('/auth/profile', profile);
            const updatedUser = response.data.data;

            set((state) => {
              state.user = updatedUser;
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

        changePassword: async (currentPassword: string, newPassword: string) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            await api.post('/auth/change-password', {
              currentPassword,
              newPassword,
            });

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
      })),
      {
        name: 'intellifill-auth',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          user: state.user,
          tokens: state.tokens,
          isAuthenticated: state.isAuthenticated,
          sessionExpiry: state.sessionExpiry,
          rememberMe: state.rememberMe,
          deviceId: state.deviceId,
          lastActivity: state.lastActivity,
        }),
        version: 1,
      }
    ),
    {
      name: 'IntelliFill Auth Store',
    }
  )
);

// =================== SELECTORS ===================

export const authSelectors = {
  isAuthenticated: (state: AuthStore) => state.isAuthenticated,
  user: (state: AuthStore) => state.user,
  isLoading: (state: AuthStore) => state.isLoading,
  error: (state: AuthStore) => state.error,
  isLocked: (state: AuthStore) => state.isLocked,
  canRetry: (state: AuthStore) => !state.isLocked || (state.lockExpiry && Date.now() > state.lockExpiry),
};

// =================== HOOKS ===================

export const useAuth = () => useAuthStore((state) => ({
  user: state.user,
  isAuthenticated: state.isAuthenticated,
  isLoading: state.isLoading,
  login: state.login,
  logout: state.logout,
  register: state.register,
}));

export const useAuthError = () => useAuthStore((state) => ({
  error: state.error,
  clearError: state.clearError,
  setError: state.setError,
}));
/**
 * Simplified AuthStore without complex middleware for better TypeScript compatibility
 * Migrated to Supabase Auth SDK for modern authentication
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { User, AuthTokens, AppError } from './types';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import api from '@/services/api';

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
  name?: string;  // Alias for fullName
  companyName?: string;
  companySlug?: string;
  acceptTerms?: boolean;
  marketingConsent?: boolean;
}

// =================== STORE INTERFACES ===================

interface AuthState {
  // Core authentication state
  user: User | null;
  tokens: AuthTokens | null;
  session: Session | null; // Supabase session
  isAuthenticated: boolean;
  isInitialized: boolean;

  // Company context
  company: {
    id: string;
    name: string;
    slug: string;
    tier: string;
    creditsRemaining: number;
  } | null;

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
  session: null,
  isAuthenticated: false,
  isInitialized: false,
  company: null,
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

/**
 * Maps Supabase user to our User type
 */
function mapSupabaseUserToUser(supabaseUser: any): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email!,
    name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email!,
    full_name: supabaseUser.user_metadata?.full_name,
    role: supabaseUser.user_metadata?.role || 'user',
    avatar: supabaseUser.user_metadata?.avatar_url,
    preferences: {
      theme: 'system',
      notifications: {
        email: true,
        desktop: true,
        processing: true,
        errors: true,
      },
      autoSave: true,
      retentionDays: 30,
    },
    createdAt: supabaseUser.created_at,
    lastLoginAt: supabaseUser.last_sign_in_at,
  };
}

function createAuthError(error: any): AppError {
  const status = error.response?.status;
  const serverMessage = error.response?.data?.message || error.message;
  const serverCode = error.response?.data?.code || error.code;

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
      // Handle Supabase errors
      if (error.status === 400 && serverMessage?.includes('Invalid login credentials')) {
        code = 'INVALID_CREDENTIALS';
        message = 'Invalid email or password';
      } else if (error.status === 422 && serverMessage?.includes('Email already registered')) {
        code = 'EMAIL_EXISTS';
        message = 'An account with this email already exists';
      } else {
        message = serverMessage || error.message || message;
        code = serverCode || code;
      }
  }

  return {
    id: `auth_error_${Date.now()}`,
    code,
    message,
    details: error.response?.data?.details || error.details,
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
            // Authenticate with Supabase
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
              email: credentials.email,
              password: credentials.password,
            });

            if (authError) {
              throw authError;
            }

            if (!authData.session || !authData.user) {
              throw new Error('No session returned from Supabase');
            }

            // If company slug provided, get Neon context
            if (credentials.companySlug) {
              // Get Neon context using Supabase user ID
              const neonResponse = await api.post('/neon-auth/login', {
                authId: authData.user.id,
              });

              const { user, company, token: neonToken } = neonResponse.data;

              set((state) => {
                state.user = user;
                state.company = company;
                state.session = authData.session;
                state.tokens = {
                  accessToken: authData.session.access_token,
                  refreshToken: authData.session.refresh_token,
                  expiresAt: authData.session.expires_at ? authData.session.expires_at * 1000 : Date.now() + (3600 * 1000),
                };
                state.isAuthenticated = true;
                state.sessionExpiry = authData.session.expires_at ? authData.session.expires_at * 1000 : Date.now() + (3600 * 1000);
                state.lastActivity = Date.now();
                state.rememberMe = credentials.rememberMe || false;
                state.loginAttempts = 0;
                state.isLocked = false;
                state.lockExpiry = null;
                state.deviceId = state.deviceId || generateDeviceId();
                state.isLoading = false;
              });
            } else {
              // Regular Supabase auth flow
              const user = mapSupabaseUserToUser(authData.user);

              set((state) => {
                state.user = user;
                state.session = authData.session;
                state.tokens = {
                  accessToken: authData.session.access_token,
                  refreshToken: authData.session.refresh_token,
                  expiresAt: authData.session.expires_at ? authData.session.expires_at * 1000 : Date.now() + (3600 * 1000),
                };
                state.isAuthenticated = true;
                state.sessionExpiry = authData.session.expires_at ? authData.session.expires_at * 1000 : Date.now() + (3600 * 1000);
                state.lastActivity = Date.now();
                state.rememberMe = credentials.rememberMe || false;
                state.loginAttempts = 0;
                state.isLocked = false;
                state.lockExpiry = null;
                state.deviceId = state.deviceId || generateDeviceId();
                state.isLoading = false;
              });
            }
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
            // Register with Supabase
            const { data: authData, error: authError } = await supabase.auth.signUp({
              email: data.email,
              password: data.password,
              options: {
                data: {
                  full_name: data.fullName || data.name,
                },
              },
            });

            if (authError) {
              throw authError;
            }

            if (!authData.user) {
              throw new Error('No user returned from Supabase signup');
            }

            // If company data provided, use Neon signup
            if (data.companyName && data.companySlug) {
              // Create company in Neon
              const neonResponse = await api.post('/neon-auth/signup', {
                companyName: data.companyName,
                companySlug: data.companySlug,
                email: data.email,
                fullName: data.fullName || data.name,
                authId: authData.user.id,
              });

              const { user, company, token: neonToken } = neonResponse.data;

              set((state) => {
                state.user = user;
                state.company = company;
                state.session = authData.session;
                state.tokens = authData.session ? {
                  accessToken: authData.session.access_token,
                  refreshToken: authData.session.refresh_token,
                  expiresAt: authData.session.expires_at ? authData.session.expires_at * 1000 : Date.now() + (3600 * 1000),
                } : null;
                state.isAuthenticated = !!authData.session;
                state.sessionExpiry = authData.session?.expires_at ? authData.session.expires_at * 1000 : Date.now() + (3600 * 1000);
                state.lastActivity = Date.now();
                state.rememberMe = data.acceptTerms || false;
                state.deviceId = state.deviceId || generateDeviceId();
                state.isLoading = false;
              });
            } else {
              // Regular Supabase registration
              const user = mapSupabaseUserToUser(authData.user);

              set((state) => {
                state.user = user;
                state.session = authData.session;
                state.tokens = authData.session ? {
                  accessToken: authData.session.access_token,
                  refreshToken: authData.session.refresh_token,
                  expiresAt: authData.session.expires_at ? authData.session.expires_at * 1000 : Date.now() + (3600 * 1000),
                } : null;
                state.isAuthenticated = !!authData.session;
                state.sessionExpiry = authData.session?.expires_at ? authData.session.expires_at * 1000 : Date.now() + (3600 * 1000);
                state.lastActivity = Date.now();
                state.rememberMe = data.acceptTerms || false;
                state.deviceId = state.deviceId || generateDeviceId();
                state.isLoading = false;
              });
            }
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
            // Sign out from Supabase
            const { error } = await supabase.auth.signOut();
            if (error) {
              console.warn('Supabase logout error:', error);
            }
          } catch (error) {
            console.warn('Logout request failed:', error);
          }

          // Clear localStorage FIRST to prevent rehydration
          localStorage.removeItem('intellifill-auth');
          localStorage.removeItem('intellifill-supabase-auth');

          set((state) => {
            state.user = null;
            state.tokens = null;
            state.session = null;
            state.company = null;
            state.isAuthenticated = false;
            state.sessionExpiry = null;
            state.error = null;
            state.deviceId = null;
          });
        },

        refreshToken: async () => {
          try {
            // Supabase handles token refresh automatically
            // This function exists for backward compatibility
            const { data, error } = await supabase.auth.refreshSession();

            if (error) {
              throw error;
            }

            if (data.session) {
              set((state) => {
                state.session = data.session;
                state.tokens = {
                  accessToken: data.session.access_token,
                  refreshToken: data.session.refresh_token,
                  expiresAt: data.session.expires_at ? data.session.expires_at * 1000 : Date.now() + (3600 * 1000),
                };
                state.sessionExpiry = data.session.expires_at ? data.session.expires_at * 1000 : Date.now() + (3600 * 1000);
                state.lastActivity = Date.now();
              });
            }
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
            // Get session from Supabase
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
              console.error('Session initialization error:', error);
              set((state) => {
                state.isInitialized = true;
                state.isLoading = false;
              });
              return;
            }

            if (session && session.user) {
              // Valid session exists, restore auth state
              const user = mapSupabaseUserToUser(session.user);

              set((state) => {
                state.user = user;
                state.session = session;
                state.tokens = {
                  accessToken: session.access_token,
                  refreshToken: session.refresh_token,
                  expiresAt: session.expires_at ? session.expires_at * 1000 : Date.now() + (3600 * 1000),
                };
                state.isAuthenticated = true;
                state.sessionExpiry = session.expires_at ? session.expires_at * 1000 : Date.now() + (3600 * 1000);
                state.isInitialized = true;
                state.isLoading = false;
              });

              // Set up auth state change listener
              supabase.auth.onAuthStateChange((event, session) => {
                console.log('Auth state changed:', event);
                if (event === 'SIGNED_OUT') {
                  set((state) => {
                    state.user = null;
                    state.tokens = null;
                    state.session = null;
                    state.company = null;
                    state.isAuthenticated = false;
                    state.sessionExpiry = null;
                  });
                } else if (event === 'TOKEN_REFRESHED' && session) {
                  set((state) => {
                    state.session = session;
                    state.tokens = {
                      accessToken: session.access_token,
                      refreshToken: session.refresh_token,
                      expiresAt: session.expires_at ? session.expires_at * 1000 : Date.now() + (3600 * 1000),
                    };
                    state.sessionExpiry = session.expires_at ? session.expires_at * 1000 : Date.now() + (3600 * 1000);
                  });
                }
              });
            } else {
              // No valid session
              set((state) => {
                state.isInitialized = true;
                state.isLoading = false;
              });
            }
          } catch (error) {
            console.error('Auth initialization error:', error);
            set((state) => {
              state.isInitialized = true;
              state.isLoading = false;
            });
          }
        },

        checkSession: () => {
          const { session, sessionExpiry, isAuthenticated } = get();

          // If not authenticated or no session, return false
          if (!isAuthenticated || !session) {
            return false;
          }

          // Check if session is expired (with 60 second buffer for refresh)
          if (sessionExpiry && Date.now() >= (sessionExpiry - 60000)) {
            // Session is about to expire or expired
            // Supabase will handle refresh automatically
            // We just check if we still have a valid session
            return !!session.access_token;
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
          session: state.session,
          company: state.company,
          isAuthenticated: state.isAuthenticated,
          sessionExpiry: state.sessionExpiry,
          rememberMe: state.rememberMe,
          deviceId: state.deviceId,
          lastActivity: state.lastActivity,
        }),
        version: 2, // Incremented for Supabase migration
        // Validate persisted data before rehydration
        onRehydrateStorage: () => (state) => {
          if (state?.sessionExpiry && Date.now() >= state.sessionExpiry) {
            // Session expired - clear localStorage immediately
            localStorage.removeItem('intellifill-auth');
            localStorage.removeItem('intellifill-supabase-auth');
            // Reset to initial state
            state.user = null;
            state.tokens = null;
            state.session = null;
            state.company = null;
            state.isAuthenticated = false;
            state.sessionExpiry = null;
            state.error = null;
            state.deviceId = null;
          }
        },
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
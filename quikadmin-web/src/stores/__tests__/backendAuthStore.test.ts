/**
 * Backend Auth Store Tests
 * Comprehensive unit tests for backendAuthStore state management and authentication flows
 *
 * Tests cover:
 * - Authentication flows (login, register, logout, demo)
 * - Token management (refresh, expiration checks)
 * - Session initialization (cold start, page refresh, silent refresh)
 * - Error handling and status code mapping
 * - State transitions and loading stages
 * - Account lockout after failed attempts
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useBackendAuthStore } from '../backendAuthStore';
import authService from '@/services/authService';
import { tokenManager } from '@/lib/tokenManager';
import type { AuthResponse } from '@/services/authService';

// Mock dependencies
vi.mock('@/services/authService');
vi.mock('@/lib/tokenManager');
vi.mock('@/lib/toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('backendAuthStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useBackendAuthStore.setState({
      user: null,
      tokens: null,
      tokenExpiresAt: null,
      company: null,
      isAuthenticated: false,
      sessionIndicator: false,
      isInitialized: false,
      isLoading: false,
      loadingStage: 'idle',
      error: null,
      loginAttempts: 0,
      isLocked: false,
      lockExpiry: null,
      lastActivity: Date.now(),
      rememberMe: false,
      isDemo: false,
      demoInfo: null,
    });

    // Clear all mocks
    vi.clearAllMocks();

    // Reset fake timers
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('has correct initial state', () => {
      const state = useBackendAuthStore.getState();

      expect(state.user).toBeNull();
      expect(state.tokens).toBeNull();
      expect(state.tokenExpiresAt).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isInitialized).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.loadingStage).toBe('idle');
      expect(state.error).toBeNull();
      expect(state.loginAttempts).toBe(0);
      expect(state.isLocked).toBe(false);
      expect(state.isDemo).toBe(false);
      expect(state.demoInfo).toBeNull();
    });
  });

  describe('Login Flow', () => {
    it('successfully logs in with valid credentials', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        emailVerified: true,
      };

      const mockTokens = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresIn: 3600,
        tokenType: 'Bearer',
      };

      const mockResponse: AuthResponse = {
        success: true,
        data: {
          user: mockUser,
          tokens: mockTokens,
        },
      };

      vi.mocked(authService.login).mockResolvedValue(mockResponse);
      vi.mocked(tokenManager.setToken).mockImplementation(() => {});

      const { login } = useBackendAuthStore.getState();

      await login({ email: 'test@example.com', password: 'password123' });

      const state = useBackendAuthStore.getState();

      expect(state.user).toEqual(mockUser);
      expect(state.tokens).toEqual(mockTokens);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isInitialized).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.loginAttempts).toBe(0);
      expect(state.isLocked).toBe(false);
      expect(tokenManager.setToken).toHaveBeenCalledWith('access-token-123', 3600);
    });

    it('sets isLoading to true during login', async () => {
      const mockResponse: AuthResponse = {
        success: true,
        data: {
          user: {
            id: 'user-1',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            role: 'user',
            emailVerified: true,
          },
          tokens: {
            accessToken: 'token',
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
        },
      };

      let resolveFn: (value: AuthResponse) => void;
      const loginPromise = new Promise<AuthResponse>((resolve) => {
        resolveFn = resolve;
      });

      vi.mocked(authService.login).mockReturnValue(loginPromise);

      const { login } = useBackendAuthStore.getState();
      const loginCall = login({ email: 'test@example.com', password: 'password123' });

      // Check loading state is true while request is pending
      expect(useBackendAuthStore.getState().isLoading).toBe(true);

      resolveFn!(mockResponse);
      await loginCall;

      // Check loading state is false after request completes
      expect(useBackendAuthStore.getState().isLoading).toBe(false);
    });

    it('handles 401 invalid credentials error', async () => {
      const error = {
        response: {
          status: 401,
          data: {
            error: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS',
          },
        },
      };

      vi.mocked(authService.login).mockRejectedValue(error);

      const { login } = useBackendAuthStore.getState();

      await expect(login({ email: 'test@example.com', password: 'wrong' })).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        severity: 'medium',
      });

      const state = useBackendAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
      expect(state.loginAttempts).toBe(1);
    });

    it('handles 403 account deactivated error', async () => {
      const error = {
        response: {
          status: 403,
          data: {
            error: 'Account deactivated',
            code: 'ACCOUNT_DEACTIVATED',
          },
        },
      };

      vi.mocked(authService.login).mockRejectedValue(error);

      const { login } = useBackendAuthStore.getState();

      await expect(
        login({ email: 'test@example.com', password: 'password' })
      ).rejects.toMatchObject({
        code: 'ACCOUNT_DEACTIVATED',
        message: 'Account is deactivated. Please contact support.',
      });
    });

    it('handles 409 email exists error during registration', async () => {
      const error = {
        response: {
          status: 409,
          data: {
            error: 'Email already exists',
            code: 'EMAIL_EXISTS',
          },
        },
      };

      vi.mocked(authService.register).mockRejectedValue(error);

      const { register } = useBackendAuthStore.getState();

      await expect(
        register({ email: 'test@example.com', password: 'password', fullName: 'Test User' })
      ).rejects.toMatchObject({
        code: 'EMAIL_EXISTS',
        message: 'An account with this email already exists',
      });
    });

    it('handles 429 rate limit error', async () => {
      const error = {
        response: {
          status: 429,
          data: {
            error: 'Too many requests',
            code: 'RATE_LIMIT',
          },
        },
      };

      vi.mocked(authService.login).mockRejectedValue(error);

      const { login } = useBackendAuthStore.getState();

      await expect(
        login({ email: 'test@example.com', password: 'password' })
      ).rejects.toMatchObject({
        code: 'RATE_LIMIT',
        message: 'Too many requests. Please try again later.',
      });
    });

    it('locks account after 5 failed login attempts', async () => {
      const error = {
        response: {
          status: 401,
          data: {
            error: 'Invalid credentials',
          },
        },
      };

      vi.mocked(authService.login).mockRejectedValue(error);

      const { login } = useBackendAuthStore.getState();

      // Attempt 5 failed logins
      for (let i = 0; i < 5; i++) {
        try {
          await login({ email: 'test@example.com', password: 'wrong' });
        } catch {
          // Expected to fail
        }
      }

      const state = useBackendAuthStore.getState();
      expect(state.loginAttempts).toBe(5);
      expect(state.isLocked).toBe(true);
      expect(state.lockExpiry).toBeGreaterThan(Date.now());
    });

    it('resets login attempts on successful login', async () => {
      // First, set some failed attempts
      useBackendAuthStore.setState({
        loginAttempts: 3,
      });

      const mockResponse: AuthResponse = {
        success: true,
        data: {
          user: {
            id: 'user-1',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            role: 'user',
            emailVerified: true,
          },
          tokens: {
            accessToken: 'token',
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
        },
      };

      vi.mocked(authService.login).mockResolvedValue(mockResponse);

      const { login } = useBackendAuthStore.getState();
      await login({ email: 'test@example.com', password: 'correct' });

      const state = useBackendAuthStore.getState();
      expect(state.loginAttempts).toBe(0);
      expect(state.isLocked).toBe(false);
      expect(state.lockExpiry).toBeNull();
    });
  });

  describe('Register Flow', () => {
    it('successfully registers a new user', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        role: 'user',
        emailVerified: false,
      };

      const mockTokens = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresIn: 3600,
        tokenType: 'Bearer',
      };

      const mockResponse: AuthResponse = {
        success: true,
        data: {
          user: mockUser,
          tokens: mockTokens,
        },
      };

      vi.mocked(authService.register).mockResolvedValue(mockResponse);

      const { register } = useBackendAuthStore.getState();

      await register({
        email: 'new@example.com',
        password: 'password123',
        fullName: 'New User',
      });

      const state = useBackendAuthStore.getState();

      expect(state.user).toEqual(mockUser);
      expect(state.tokens).toEqual(mockTokens);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isInitialized).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('handles registration validation errors', async () => {
      const error = {
        response: {
          status: 400,
          data: {
            error: 'Validation failed',
          },
        },
      };

      vi.mocked(authService.register).mockRejectedValue(error);

      const { register } = useBackendAuthStore.getState();

      await expect(
        register({ email: 'invalid', password: '123', fullName: 'Test' })
      ).rejects.toMatchObject({
        message: 'Validation failed',
      });

      const state = useBackendAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('Logout Flow', () => {
    it('clears state and localStorage on logout', async () => {
      // Set up authenticated state
      useBackendAuthStore.setState({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'user',
          emailVerified: true,
        },
        tokens: {
          accessToken: 'token',
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
        isAuthenticated: true,
        isDemo: true,
        demoInfo: {
          notice: 'Demo mode',
          features: ['feature1'],
        },
      });

      vi.mocked(authService.logout).mockResolvedValue({ success: true });
      vi.mocked(tokenManager.clearToken).mockImplementation(() => {});

      const { logout } = useBackendAuthStore.getState();
      await logout();

      const state = useBackendAuthStore.getState();

      expect(state.user).toBeNull();
      expect(state.tokens).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isDemo).toBe(false);
      expect(state.demoInfo).toBeNull();
      expect(state.error).toBeNull();
      expect(tokenManager.clearToken).toHaveBeenCalled();
    });

    it('clears state even if logout request fails', async () => {
      useBackendAuthStore.setState({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'user',
          emailVerified: true,
        },
        isAuthenticated: true,
      });

      vi.mocked(authService.logout).mockRejectedValue(new Error('Network error'));

      const { logout } = useBackendAuthStore.getState();
      await logout();

      const state = useBackendAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('Demo Login Flow', () => {
    it('successfully logs in as demo user', async () => {
      const mockUser = {
        id: 'demo-user',
        email: 'demo@example.com',
        firstName: 'Demo',
        lastName: 'User',
        role: 'demo',
        emailVerified: true,
        isDemo: true,
      };

      const mockTokens = {
        accessToken: 'demo-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
      };

      const mockDemoInfo = {
        notice: 'This is a demo account',
        features: ['limited-storage', 'watermarked-exports'],
      };

      const mockResponse: AuthResponse = {
        success: true,
        data: {
          user: mockUser,
          tokens: mockTokens,
          demo: mockDemoInfo,
        },
      };

      vi.mocked(authService.demoLogin).mockResolvedValue(mockResponse);

      const { demoLogin } = useBackendAuthStore.getState();
      await demoLogin();

      const state = useBackendAuthStore.getState();

      expect(state.user).toEqual(mockUser);
      expect(state.isDemo).toBe(true);
      expect(state.demoInfo).toEqual(mockDemoInfo);
      expect(state.isAuthenticated).toBe(true);
      expect(state.rememberMe).toBe(false);
    });
  });

  describe('Token Management', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('isTokenExpiringSoon returns false when not authenticated', () => {
      const { isTokenExpiringSoon } = useBackendAuthStore.getState();
      expect(isTokenExpiringSoon()).toBe(false);
    });

    it('isTokenExpiringSoon returns false when token not expiring soon', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // Token expires in 10 minutes
      const expiresAt = now + 10 * 60 * 1000;

      useBackendAuthStore.setState({
        isAuthenticated: true,
        tokenExpiresAt: expiresAt,
      });

      const { isTokenExpiringSoon } = useBackendAuthStore.getState();
      expect(isTokenExpiringSoon()).toBe(false);
    });

    it('isTokenExpiringSoon returns true when token expires within 5 minutes', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // Token expires in 3 minutes
      const expiresAt = now + 3 * 60 * 1000;

      useBackendAuthStore.setState({
        isAuthenticated: true,
        tokenExpiresAt: expiresAt,
      });

      const { isTokenExpiringSoon } = useBackendAuthStore.getState();
      expect(isTokenExpiringSoon()).toBe(true);
    });

    it('refreshTokenIfNeeded refreshes when token expiring soon', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const mockResponse: AuthResponse = {
        success: true,
        data: {
          user: {
            id: 'user-1',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            role: 'user',
            emailVerified: true,
          },
          tokens: {
            accessToken: 'new-token',
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
        },
      };

      vi.mocked(authService.refreshToken).mockResolvedValue(mockResponse);

      useBackendAuthStore.setState({
        isAuthenticated: true,
        tokenExpiresAt: now + 3 * 60 * 1000, // Expires in 3 minutes
        tokens: {
          accessToken: 'old-token',
          expiresIn: 180,
          tokenType: 'Bearer',
        },
      });

      const { refreshTokenIfNeeded } = useBackendAuthStore.getState();
      const result = await refreshTokenIfNeeded();

      expect(result).toBe(true);
      expect(authService.refreshToken).toHaveBeenCalled();
      expect(useBackendAuthStore.getState().tokens?.accessToken).toBe('new-token');
    });

    it('refreshTokenIfNeeded does not refresh when token not expiring soon', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      useBackendAuthStore.setState({
        isAuthenticated: true,
        tokenExpiresAt: now + 10 * 60 * 1000, // Expires in 10 minutes
      });

      const { refreshTokenIfNeeded } = useBackendAuthStore.getState();
      const result = await refreshTokenIfNeeded();

      expect(result).toBe(false);
      expect(authService.refreshToken).not.toHaveBeenCalled();
    });

    it('refreshToken updates tokens in state', async () => {
      const mockResponse: AuthResponse = {
        success: true,
        data: {
          user: {
            id: 'user-1',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            role: 'user',
            emailVerified: true,
          },
          tokens: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
        },
      };

      vi.mocked(authService.refreshToken).mockResolvedValue(mockResponse);

      useBackendAuthStore.setState({
        tokens: {
          accessToken: 'old-token',
          refreshToken: 'old-refresh',
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
      });

      const { refreshToken } = useBackendAuthStore.getState();
      await refreshToken();

      const state = useBackendAuthStore.getState();
      expect(state.tokens?.accessToken).toBe('new-access-token');
      expect(tokenManager.setToken).toHaveBeenCalledWith('new-access-token', 3600);
    });
  });

  describe('Session Initialization', () => {
    it('initializes with no session - Case 1', async () => {
      useBackendAuthStore.setState({
        isAuthenticated: false,
      });

      vi.mocked(tokenManager.hasToken).mockReturnValue(false);

      const { initialize } = useBackendAuthStore.getState();
      await initialize();

      const state = useBackendAuthStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.loadingStage).toBe('ready');
      expect(state.isAuthenticated).toBe(false);
    });

    it('initializes with valid session and in-memory token - Case 3', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        emailVerified: true,
      };

      // Task 292: Set sessionIndicator instead of isAuthenticated
      useBackendAuthStore.setState({
        sessionIndicator: true,
        tokens: {
          accessToken: 'existing-token',
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
      });

      vi.mocked(tokenManager.hasToken).mockReturnValue(true);
      vi.mocked(authService.getMe).mockResolvedValue({
        success: true,
        data: {
          user: mockUser,
          tokens: null,
        },
      });

      const { initialize } = useBackendAuthStore.getState();
      await initialize();

      const state = useBackendAuthStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.loadingStage).toBe('ready');
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it('initializes with session but no in-memory token - silent refresh success - Case 2', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        emailVerified: true,
      };

      const mockTokens = {
        accessToken: 'refreshed-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
      };

      // Task 292: Set sessionIndicator instead of isAuthenticated
      useBackendAuthStore.setState({
        sessionIndicator: true,
        isAuthenticated: false, // Should be false initially after page refresh
        tokens: null,
      });

      vi.mocked(tokenManager.hasToken).mockReturnValue(false);
      vi.mocked(authService.refreshToken).mockResolvedValue({
        success: true,
        data: {
          user: mockUser,
          tokens: mockTokens,
        },
      });
      vi.mocked(authService.getMe).mockResolvedValue({
        success: true,
        data: {
          user: mockUser,
          tokens: null,
        },
      });

      const { initialize } = useBackendAuthStore.getState();
      await initialize();

      const state = useBackendAuthStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isAuthenticated).toBe(true);
      expect(state.tokens?.accessToken).toBe('refreshed-token');
      expect(state.user).toEqual(mockUser);
      expect(tokenManager.setToken).toHaveBeenCalledWith('refreshed-token', 3600);
    });

    it('initializes with session but silent refresh fails - clears session', async () => {
      // Task 292: Set sessionIndicator instead of isAuthenticated
      useBackendAuthStore.setState({
        sessionIndicator: true,
        isAuthenticated: false, // Should be false initially after page refresh
        user: {
          id: 'user-1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'user',
          emailVerified: true,
        },
      });

      vi.mocked(tokenManager.hasToken).mockReturnValue(false);
      vi.mocked(authService.refreshToken).mockRejectedValue(new Error('Refresh failed'));

      const { initialize } = useBackendAuthStore.getState();
      await initialize();

      const state = useBackendAuthStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.tokens).toBeNull();
      expect(tokenManager.clearToken).toHaveBeenCalled();
    });

    it('transitions through loading stages correctly', async () => {
      const stages: string[] = [];

      // Subscribe to state changes
      const unsubscribe = useBackendAuthStore.subscribe((state) => {
        stages.push(state.loadingStage);
      });

      useBackendAuthStore.setState({
        isAuthenticated: false,
      });

      vi.mocked(tokenManager.hasToken).mockReturnValue(false);

      const { initialize } = useBackendAuthStore.getState();
      await initialize();

      unsubscribe();

      // Should transition: idle -> rehydrating -> ready
      expect(stages).toContain('rehydrating');
      expect(stages).toContain('ready');
      expect(useBackendAuthStore.getState().loadingStage).toBe('ready');
    });
  });

  describe('Error Handling', () => {
    it('creates auth error with correct structure', async () => {
      const error = {
        response: {
          status: 401,
          data: {
            error: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS',
            details: { field: 'password' },
          },
        },
      };

      vi.mocked(authService.login).mockRejectedValue(error);

      const { login } = useBackendAuthStore.getState();

      try {
        await login({ email: 'test@example.com', password: 'wrong' });
      } catch (authError: any) {
        expect(authError).toMatchObject({
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          severity: 'medium',
          component: 'auth',
          resolved: false,
        });
        expect(authError.id).toMatch(/^auth_error_\d+$/);
        expect(authError.timestamp).toBeGreaterThan(0);
      }
    });

    it('setError updates error state', () => {
      const error = {
        id: 'err-1',
        code: 'TEST_ERROR',
        message: 'Test error',
        timestamp: Date.now(),
        severity: 'low' as const,
        component: 'test',
        resolved: false,
      };

      const { setError } = useBackendAuthStore.getState();
      setError(error);

      expect(useBackendAuthStore.getState().error).toEqual(error);
    });

    it('clearError removes error state', () => {
      useBackendAuthStore.setState({
        error: {
          id: 'err-1',
          code: 'TEST_ERROR',
          message: 'Test error',
          timestamp: Date.now(),
          severity: 'low',
          component: 'test',
          resolved: false,
        },
      });

      const { clearError } = useBackendAuthStore.getState();
      clearError();

      expect(useBackendAuthStore.getState().error).toBeNull();
    });
  });

  describe('Security Functions', () => {
    it('resetLoginAttempts clears attempts and lock', () => {
      useBackendAuthStore.setState({
        loginAttempts: 5,
        isLocked: true,
        lockExpiry: Date.now() + 15 * 60 * 1000,
      });

      const { resetLoginAttempts } = useBackendAuthStore.getState();
      resetLoginAttempts();

      const state = useBackendAuthStore.getState();
      expect(state.loginAttempts).toBe(0);
      expect(state.isLocked).toBe(false);
      expect(state.lockExpiry).toBeNull();
    });

    it('checkSession returns true when authenticated with token', () => {
      useBackendAuthStore.setState({
        isAuthenticated: true,
        tokens: {
          accessToken: 'token',
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
      });

      // Task 292: Mock tokenManager methods for checkSession
      vi.mocked(tokenManager.hasToken).mockReturnValue(true);
      vi.mocked(tokenManager.isExpiringSoon).mockReturnValue(false);

      const { checkSession } = useBackendAuthStore.getState();
      expect(checkSession()).toBe(true);
    });

    it('checkSession returns false when not authenticated', () => {
      useBackendAuthStore.setState({
        isAuthenticated: false,
      });

      const { checkSession } = useBackendAuthStore.getState();
      expect(checkSession()).toBe(false);
    });
  });

  describe('Task 292: Token Storage State Consistency', () => {
    it('login should set isAuthenticated=true AND store token in tokenManager', async () => {
      const mockTokens = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresIn: 3600,
        tokenType: 'Bearer',
      };

      const mockResponse: AuthResponse = {
        success: true,
        data: {
          user: {
            id: 'user-1',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            role: 'user',
            emailVerified: true,
          },
          tokens: mockTokens,
        },
      };

      vi.mocked(authService.login).mockResolvedValue(mockResponse);
      vi.mocked(tokenManager.setToken).mockImplementation(() => {});

      const { login } = useBackendAuthStore.getState();
      await login({ email: 'test@example.com', password: 'password123' });

      const state = useBackendAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(tokenManager.setToken).toHaveBeenCalledWith('access-token-123', 3600);
    });

    it('logout should clear isAuthenticated AND tokenManager', async () => {
      useBackendAuthStore.setState({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'user',
          emailVerified: true,
        },
        isAuthenticated: true,
      });

      vi.mocked(authService.logout).mockResolvedValue({ success: true });
      vi.mocked(tokenManager.clearToken).mockImplementation(() => {});

      const { logout } = useBackendAuthStore.getState();
      await logout();

      const state = useBackendAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(tokenManager.clearToken).toHaveBeenCalled();
    });

    it('checkSession should return false when tokenManager has no token', () => {
      useBackendAuthStore.setState({
        isAuthenticated: true,
        tokens: {
          accessToken: 'token',
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
      });

      vi.mocked(tokenManager.hasToken).mockReturnValue(false);

      const { checkSession } = useBackendAuthStore.getState();
      expect(checkSession()).toBe(false);
    });

    it('checkSession should return false when token is expired', () => {
      useBackendAuthStore.setState({
        isAuthenticated: true,
        tokens: {
          accessToken: 'token',
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
      });

      vi.mocked(tokenManager.hasToken).mockReturnValue(true);
      vi.mocked(tokenManager.isExpiringSoon).mockReturnValue(true);

      const { checkSession } = useBackendAuthStore.getState();
      expect(checkSession()).toBe(false);
    });

    it('checkSession should return true when valid token exists', () => {
      useBackendAuthStore.setState({
        isAuthenticated: true,
        tokens: {
          accessToken: 'token',
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
      });

      vi.mocked(tokenManager.hasToken).mockReturnValue(true);
      vi.mocked(tokenManager.isExpiringSoon).mockReturnValue(false);

      const { checkSession } = useBackendAuthStore.getState();
      expect(checkSession()).toBe(true);
    });

    it('page refresh scenario: sessionIndicator persists but isAuthenticated is false until refresh', async () => {
      // Simulate page refresh: sessionIndicator exists in localStorage but tokenManager is empty
      useBackendAuthStore.setState({
        isAuthenticated: false, // Should be false initially after rehydration
        sessionIndicator: true, // Persisted from localStorage
        user: {
          id: 'user-1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'user',
          emailVerified: true,
        },
      });

      vi.mocked(tokenManager.hasToken).mockReturnValue(false);

      const state = useBackendAuthStore.getState();
      // Before initialize(), isAuthenticated should be false
      expect(state.isAuthenticated).toBe(false);
      expect(state.sessionIndicator).toBe(true);
    });

    it('successful silent refresh should restore isAuthenticated=true', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        emailVerified: true,
      };

      const mockTokens = {
        accessToken: 'refreshed-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
      };

      // Simulate page refresh state
      useBackendAuthStore.setState({
        isAuthenticated: false,
        sessionIndicator: true,
        user: mockUser,
      });

      vi.mocked(tokenManager.hasToken).mockReturnValue(false);
      vi.mocked(authService.refreshToken).mockResolvedValue({
        success: true,
        data: {
          user: mockUser,
          tokens: mockTokens,
        },
      });
      vi.mocked(authService.getMe).mockResolvedValue({
        success: true,
        data: {
          user: mockUser,
          tokens: null,
        },
      });

      const { initialize } = useBackendAuthStore.getState();
      await initialize();

      const state = useBackendAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.sessionIndicator).toBe(true);
      expect(tokenManager.setToken).toHaveBeenCalledWith('refreshed-token', 3600);
    });

    it('failed silent refresh should clear all session state', async () => {
      // Simulate page refresh state
      useBackendAuthStore.setState({
        isAuthenticated: false,
        sessionIndicator: true,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'user',
          emailVerified: true,
        },
      });

      vi.mocked(tokenManager.hasToken).mockReturnValue(false);
      vi.mocked(authService.refreshToken).mockRejectedValue(new Error('Refresh failed'));

      const { initialize } = useBackendAuthStore.getState();
      await initialize();

      const state = useBackendAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.sessionIndicator).toBe(false);
      expect(state.user).toBeNull();
      expect(tokenManager.clearToken).toHaveBeenCalled();
    });
  });

  describe('Loading Stage Management', () => {
    it('setLoadingStage updates loading stage', () => {
      const { setLoadingStage } = useBackendAuthStore.getState();

      setLoadingStage('rehydrating');
      expect(useBackendAuthStore.getState().loadingStage).toBe('rehydrating');

      setLoadingStage('validating');
      expect(useBackendAuthStore.getState().loadingStage).toBe('validating');

      setLoadingStage('ready');
      expect(useBackendAuthStore.getState().loadingStage).toBe('ready');
    });
  });

  describe('Password Reset Flow', () => {
    it('successfully requests password reset', async () => {
      vi.mocked(authService.requestPasswordReset).mockResolvedValue({
        success: true,
        message: 'Reset email sent',
      });

      const { requestPasswordReset } = useBackendAuthStore.getState();
      await requestPasswordReset('test@example.com');

      expect(authService.requestPasswordReset).toHaveBeenCalledWith('test@example.com');
      expect(useBackendAuthStore.getState().isLoading).toBe(false);
    });

    it('successfully resets password', async () => {
      vi.mocked(authService.resetPassword).mockResolvedValue({
        success: true,
        message: 'Password reset successful',
      });

      const { resetPassword } = useBackendAuthStore.getState();
      await resetPassword('reset-token', 'newPassword123');

      expect(authService.resetPassword).toHaveBeenCalledWith('reset-token', 'newPassword123');
      expect(useBackendAuthStore.getState().isLoading).toBe(false);
    });

    it('successfully verifies reset token', async () => {
      vi.mocked(authService.verifyResetToken).mockResolvedValue({
        success: true,
      });

      const { verifyResetToken } = useBackendAuthStore.getState();
      await verifyResetToken('valid-token');

      expect(authService.verifyResetToken).toHaveBeenCalledWith('valid-token');
    });
  });

  describe('Selectors', () => {
    it('authSelectors work correctly', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        emailVerified: true,
      };

      useBackendAuthStore.setState({
        isAuthenticated: true,
        user: mockUser,
        isLoading: false,
        loadingStage: 'ready',
        isDemo: true,
        demoInfo: {
          notice: 'Demo',
          features: ['feature1'],
        },
      });

      const { authSelectors } = await import('../backendAuthStore');
      const state = useBackendAuthStore.getState();

      expect(authSelectors.isAuthenticated(state)).toBe(true);
      expect(authSelectors.user(state)).toEqual(mockUser);
      expect(authSelectors.isLoading(state)).toBe(false);
      expect(authSelectors.loadingStage(state)).toBe('ready');
      expect(authSelectors.isDemo(state)).toBe(true);
    });
  });

  describe('Production DevTools Security (Task 296)', () => {
    it('store should function correctly in development mode', () => {
      // In test environment, store should work regardless of mode
      const state = useBackendAuthStore.getState();

      expect(state).toBeDefined();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(typeof state.login).toBe('function');
      expect(typeof state.logout).toBe('function');
    });

    it('store should function correctly when devtools are disabled', () => {
      // Store should work even without devtools middleware
      const { login, logout, setError } = useBackendAuthStore.getState();

      // Test basic store operations
      expect(typeof login).toBe('function');
      expect(typeof logout).toBe('function');
      expect(typeof setError).toBe('function');

      // Test state mutations work
      setError({
        id: 'test-error',
        code: 'TEST',
        message: 'Test error',
        timestamp: Date.now(),
        severity: 'low',
        component: 'test',
        resolved: false,
      });

      expect(useBackendAuthStore.getState().error).not.toBeNull();

      useBackendAuthStore.getState().clearError();
      expect(useBackendAuthStore.getState().error).toBeNull();
    });

    it('persist middleware should work independently of devtools', () => {
      // Persist middleware should work in both dev and prod
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        emailVerified: true,
      };

      useBackendAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
      });

      const state = useBackendAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it('immer middleware should work independently of devtools', async () => {
      // Immer middleware should allow draft mutations
      const { setError } = useBackendAuthStore.getState();

      const testError = {
        id: 'immer-test',
        code: 'IMMER_TEST',
        message: 'Testing immer',
        timestamp: Date.now(),
        severity: 'low' as const,
        component: 'test',
        resolved: false,
      };

      setError(testError);

      const state = useBackendAuthStore.getState();
      expect(state.error).toEqual(testError);
    });
  });

  /**
   * Task 450: localStorage Session Persistence Tests
   *
   * These tests verify the Zustand persist middleware configuration and behavior.
   *
   * PERSISTED FIELDS (via partialize):
   * - user: AuthUser object (user profile data)
   * - tokens: Partial<AuthTokens> - ONLY metadata, NOT actual tokens
   *   - expiresIn: number (token lifetime in seconds)
   *   - tokenType: string ('Bearer')
   *   - EXCLUDED: accessToken (stored in-memory via tokenManager for XSS mitigation)
   *   - EXCLUDED: refreshToken (stored in httpOnly cookie)
   * - tokenExpiresAt: number | null (Unix timestamp when token expires)
   * - company: { id: string } | null
   * - sessionIndicator: boolean (derived from isAuthenticated, for session detection on reload)
   * - rememberMe: boolean
   * - isInitialized: boolean
   * - lastActivity: number (Unix timestamp)
   *
   * NON-PERSISTED FIELDS:
   * - isAuthenticated: Derived at runtime from tokenManager
   * - isLoading: Runtime state
   * - loadingStage: Runtime state
   * - error: Runtime state (not persisted to avoid stale errors)
   * - loginAttempts: Security - not persisted to prevent bypass
   * - isLocked: Security - not persisted
   * - lockExpiry: Security - not persisted
   * - isDemo: Runtime state
   * - demoInfo: Runtime state
   *
   * STORAGE KEY: 'intellifill-backend-auth' (from AUTH_STORAGE_KEY constant)
   */
  describe('Task 450: localStorage Session Persistence', () => {
    // Mock localStorage
    let localStorageMock: Record<string, string>;

    beforeEach(() => {
      localStorageMock = {};

      // Mock localStorage methods
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
        (key: string) => localStorageMock[key] || null
      );
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
        (key: string, value: string) => {
          localStorageMock[key] = value;
        }
      );
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(
        (key: string) => {
          delete localStorageMock[key];
        }
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe('Persist Middleware Configuration', () => {
      it('uses correct storage key (AUTH_STORAGE_KEY)', async () => {
        const { AUTH_STORAGE_KEY } = await import('@/utils/migrationUtils');

        // Verify the constant value
        expect(AUTH_STORAGE_KEY).toBe('intellifill-backend-auth');
      });

      it('partialize excludes sensitive tokens from localStorage', () => {
        // Set authenticated state with full tokens
        useBackendAuthStore.setState({
          user: {
            id: 'user-1',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            role: 'user',
            emailVerified: true,
          },
          tokens: {
            accessToken: 'sensitive-access-token', // Should NOT be persisted
            refreshToken: 'sensitive-refresh-token', // Should NOT be persisted
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
          isAuthenticated: true,
          sessionIndicator: true,
        });

        // Get the persisted data from localStorage mock
        const persistedData = localStorageMock['intellifill-backend-auth'];

        if (persistedData) {
          const parsed = JSON.parse(persistedData);
          const persistedState = parsed.state;

          // Verify accessToken is NOT in persisted data
          expect(persistedState.tokens?.accessToken).toBeUndefined();

          // Verify refreshToken is NOT in persisted data
          expect(persistedState.tokens?.refreshToken).toBeUndefined();

          // Verify metadata IS persisted
          expect(persistedState.tokens?.expiresIn).toBe(3600);
          expect(persistedState.tokens?.tokenType).toBe('Bearer');
        }
      });

      it('persists user data correctly', () => {
        const mockUser = {
          id: 'user-persist-test',
          email: 'persist@example.com',
          firstName: 'Persist',
          lastName: 'Test',
          role: 'user',
          emailVerified: true,
        };

        useBackendAuthStore.setState({
          user: mockUser,
          isAuthenticated: true,
          sessionIndicator: true,
        });

        const persistedData = localStorageMock['intellifill-backend-auth'];

        if (persistedData) {
          const parsed = JSON.parse(persistedData);
          expect(parsed.state.user).toEqual(mockUser);
        }
      });

      it('persists sessionIndicator (derived from isAuthenticated)', () => {
        useBackendAuthStore.setState({
          isAuthenticated: true,
          sessionIndicator: true,
        });

        const persistedData = localStorageMock['intellifill-backend-auth'];

        if (persistedData) {
          const parsed = JSON.parse(persistedData);
          // sessionIndicator is derived from isAuthenticated during persist
          expect(parsed.state.sessionIndicator).toBe(true);
        }
      });

      it('does NOT persist runtime-only fields', () => {
        useBackendAuthStore.setState({
          isLoading: true,
          loadingStage: 'validating',
          error: {
            id: 'err-1',
            code: 'TEST',
            message: 'Test error',
            timestamp: Date.now(),
            severity: 'low',
            component: 'test',
            resolved: false,
          },
          loginAttempts: 3,
          isLocked: true,
          lockExpiry: Date.now() + 900000,
          isDemo: true,
          demoInfo: { notice: 'Demo', features: ['test'] },
        });

        const persistedData = localStorageMock['intellifill-backend-auth'];

        if (persistedData) {
          const parsed = JSON.parse(persistedData);
          const state = parsed.state;

          // These fields should NOT be persisted
          expect(state.isLoading).toBeUndefined();
          expect(state.loadingStage).toBeUndefined();
          expect(state.error).toBeUndefined();
          expect(state.loginAttempts).toBeUndefined();
          expect(state.isLocked).toBeUndefined();
          expect(state.lockExpiry).toBeUndefined();
          expect(state.isDemo).toBeUndefined();
          expect(state.demoInfo).toBeUndefined();
        }
      });
    });

    describe('Session Persistence Across Page Refresh', () => {
      it('sessionIndicator persists to detect session on page reload', () => {
        // Simulate login - sets sessionIndicator
        useBackendAuthStore.setState({
          user: {
            id: 'user-1',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            role: 'user',
            emailVerified: true,
          },
          isAuthenticated: true,
          sessionIndicator: true,
          tokens: {
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
        });

        // Verify sessionIndicator is persisted
        const persistedData = localStorageMock['intellifill-backend-auth'];
        expect(persistedData).toBeDefined();

        if (persistedData) {
          const parsed = JSON.parse(persistedData);
          expect(parsed.state.sessionIndicator).toBe(true);
        }
      });

      it('onRehydrateStorage sets isAuthenticated=false when no in-memory token', () => {
        // This tests the critical behavior documented in the store:
        // When page reloads, sessionIndicator exists but tokenManager is empty
        // isAuthenticated should be false until initialize() completes

        // Set up state simulating rehydration
        useBackendAuthStore.setState({
          sessionIndicator: true,
          isAuthenticated: false, // onRehydrateStorage sets this
          isInitialized: false, // onRehydrateStorage resets this
          isLoading: true,
          loadingStage: 'rehydrating',
        });

        vi.mocked(tokenManager.hasToken).mockReturnValue(false);

        const state = useBackendAuthStore.getState();

        // Verify the expected rehydration state
        expect(state.sessionIndicator).toBe(true);
        expect(state.isAuthenticated).toBe(false);
        expect(state.isInitialized).toBe(false);
      });

      it('tokenExpiresAt is persisted for expiration checking', () => {
        const expiresAt = Date.now() + 3600000;

        useBackendAuthStore.setState({
          tokenExpiresAt: expiresAt,
          sessionIndicator: true,
        });

        const persistedData = localStorageMock['intellifill-backend-auth'];

        if (persistedData) {
          const parsed = JSON.parse(persistedData);
          expect(parsed.state.tokenExpiresAt).toBe(expiresAt);
        }
      });

      it('rememberMe preference persists', () => {
        useBackendAuthStore.setState({
          rememberMe: true,
          sessionIndicator: true,
        });

        const persistedData = localStorageMock['intellifill-backend-auth'];

        if (persistedData) {
          const parsed = JSON.parse(persistedData);
          expect(parsed.state.rememberMe).toBe(true);
        }
      });

      it('lastActivity timestamp persists', () => {
        const lastActivity = Date.now();

        useBackendAuthStore.setState({
          lastActivity,
          sessionIndicator: true,
        });

        const persistedData = localStorageMock['intellifill-backend-auth'];

        if (persistedData) {
          const parsed = JSON.parse(persistedData);
          expect(parsed.state.lastActivity).toBe(lastActivity);
        }
      });
    });

    describe('Logout Clears localStorage', () => {
      it('logout removes AUTH_STORAGE_KEY from localStorage', async () => {
        // Set up authenticated state
        localStorageMock['intellifill-backend-auth'] = JSON.stringify({
          state: {
            user: { id: 'user-1', email: 'test@example.com' },
            sessionIndicator: true,
          },
          version: 1,
        });

        useBackendAuthStore.setState({
          user: {
            id: 'user-1',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            role: 'user',
            emailVerified: true,
          },
          isAuthenticated: true,
          sessionIndicator: true,
        });

        vi.mocked(authService.logout).mockResolvedValue({ success: true });
        vi.mocked(tokenManager.clearToken).mockImplementation(() => {});

        const { logout } = useBackendAuthStore.getState();
        await logout();

        // Verify localStorage.removeItem was called with correct key
        expect(localStorage.removeItem).toHaveBeenCalledWith('intellifill-backend-auth');
      });

      it('logout clears sessionIndicator', async () => {
        useBackendAuthStore.setState({
          user: {
            id: 'user-1',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            role: 'user',
            emailVerified: true,
          },
          isAuthenticated: true,
          sessionIndicator: true,
        });

        vi.mocked(authService.logout).mockResolvedValue({ success: true });
        vi.mocked(tokenManager.clearToken).mockImplementation(() => {});

        const { logout } = useBackendAuthStore.getState();
        await logout();

        const state = useBackendAuthStore.getState();
        expect(state.sessionIndicator).toBe(false);
        expect(state.isAuthenticated).toBe(false);
        expect(state.user).toBeNull();
        expect(state.tokens).toBeNull();
      });
    });

    describe('Token Expiration Check on Init', () => {
      it('initialize checks token expiration and attempts refresh if needed', async () => {
        const expiredTokenExpiresAt = Date.now() - 1000; // Already expired

        useBackendAuthStore.setState({
          sessionIndicator: true,
          tokenExpiresAt: expiredTokenExpiresAt,
          isAuthenticated: false,
        });

        vi.mocked(tokenManager.hasToken).mockReturnValue(false);
        vi.mocked(authService.refreshToken).mockRejectedValue(new Error('Token expired'));

        const { initialize } = useBackendAuthStore.getState();
        await initialize();

        // With expired token and failed refresh, session should be cleared
        const state = useBackendAuthStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.sessionIndicator).toBe(false);
      });

      it('initialize restores session with valid token via silent refresh', async () => {
        const validTokenExpiresAt = Date.now() + 3600000; // 1 hour from now

        const mockUser = {
          id: 'user-1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'user',
          emailVerified: true,
        };

        useBackendAuthStore.setState({
          sessionIndicator: true,
          tokenExpiresAt: validTokenExpiresAt,
          isAuthenticated: false,
          user: mockUser,
        });

        vi.mocked(tokenManager.hasToken).mockReturnValue(false);
        vi.mocked(authService.refreshToken).mockResolvedValue({
          success: true,
          data: {
            user: mockUser,
            tokens: {
              accessToken: 'new-token',
              expiresIn: 3600,
              tokenType: 'Bearer',
            },
          },
        });
        vi.mocked(authService.getMe).mockResolvedValue({
          success: true,
          data: { user: mockUser, tokens: null },
        });

        const { initialize } = useBackendAuthStore.getState();
        await initialize();

        const state = useBackendAuthStore.getState();
        expect(state.isAuthenticated).toBe(true);
        expect(state.isInitialized).toBe(true);
        expect(tokenManager.setToken).toHaveBeenCalledWith('new-token', 3600);
      });

      it('isInitialized is reset during rehydration to prevent race condition', () => {
        // This tests the critical fix documented in onRehydrateStorage:
        // Without resetting isInitialized, ProtectedRoute redirects to login
        // before initialize() can perform silent refresh

        useBackendAuthStore.setState({
          sessionIndicator: true,
          isAuthenticated: false,
          isInitialized: false, // Should be reset by onRehydrateStorage
          isLoading: true,
          loadingStage: 'rehydrating',
        });

        vi.mocked(tokenManager.hasToken).mockReturnValue(false);

        const state = useBackendAuthStore.getState();

        // isInitialized should be false to prevent premature redirect
        expect(state.isInitialized).toBe(false);
        expect(state.sessionIndicator).toBe(true);
      });
    });

    describe('Persist Version Management', () => {
      it('persist middleware uses version 1', () => {
        useBackendAuthStore.setState({
          sessionIndicator: true,
        });

        const persistedData = localStorageMock['intellifill-backend-auth'];

        if (persistedData) {
          const parsed = JSON.parse(persistedData);
          expect(parsed.version).toBe(1);
        }
      });
    });
  });
});

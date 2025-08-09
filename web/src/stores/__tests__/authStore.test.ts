/**
 * Basic tests for AuthStore functionality
 * This is a simple test to verify the store works correctly
 */

import { useAuthStore } from '../authStore';

describe('AuthStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useAuthStore.getState().clearSession();
    localStorage.clear();
  });

  test('should initialize with default state', () => {
    const state = useAuthStore.getState();
    
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBe(null);
    expect(state.tokens).toBe(null);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe(null);
  });

  test('should handle logout correctly', async () => {
    const store = useAuthStore.getState();
    
    // Set some initial state
    store.updateUser({ 
      id: 'test-user',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      preferences: {
        theme: 'light',
        notifications: {
          email: true,
          desktop: false,
          processing: true,
          errors: true,
        },
        autoSave: true,
        retentionDays: 30,
      },
      createdAt: new Date().toISOString(),
    });

    // Verify user is set
    expect(store.user).toBeTruthy();

    // Logout
    await store.logout();

    // Verify state is cleared
    const finalState = useAuthStore.getState();
    expect(finalState.isAuthenticated).toBe(false);
    expect(finalState.user).toBe(null);
    expect(finalState.tokens).toBe(null);
  });

  test('should clear errors', () => {
    const store = useAuthStore.getState();
    
    // Set an error
    store.setError({
      id: 'test-error',
      code: 'TEST_ERROR',
      message: 'Test error message',
      timestamp: Date.now(),
      severity: 'medium',
      component: 'auth',
      resolved: false,
    });

    expect(store.error).toBeTruthy();

    // Clear error
    store.clearError();

    expect(useAuthStore.getState().error).toBe(null);
  });

  test('should check session validity', () => {
    const store = useAuthStore.getState();
    
    // Should return false when not authenticated
    expect(store.checkSession()).toBe(false);
  });

  test('should extend session', () => {
    const store = useAuthStore.getState();
    const initialActivity = store.lastActivity;
    
    // Wait a moment
    setTimeout(() => {
      store.extendSession();
      const newActivity = useAuthStore.getState().lastActivity;
      expect(newActivity).toBeGreaterThan(initialActivity);
    }, 10);
  });
});

// Mock console methods to avoid noise in test output
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
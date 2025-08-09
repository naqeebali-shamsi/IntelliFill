/**
 * Integration test for the complete authentication flow
 * This tests the interaction between components and the store
 */

import { initializeStores } from '../index';
import { useAuthStore } from '../authStore';
import { migrateAuthData, hasLegacyAuthData } from '../migrationUtils';

describe('Authentication Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset store state
    useAuthStore.getState().clearSession();
  });

  test('should initialize stores without errors', async () => {
    // Mock console.log to capture initialization success
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    await initializeStores();
    
    expect(consoleSpy).toHaveBeenCalledWith('✅ All stores initialized successfully');
    
    consoleSpy.mockRestore();
  });

  test('should migrate legacy localStorage data', () => {
    // Set up legacy data
    const legacyUser = {
      id: 'legacy-user',
      email: 'legacy@example.com',
      name: 'Legacy User',
      role: 'user',
    };

    // Create a mock JWT token (this is just for testing)
    const mockPayload = {
      sub: 'legacy-user',
      exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
    };
    const mockToken = 'header.' + btoa(JSON.stringify(mockPayload)) + '.signature';

    localStorage.setItem('token', mockToken);
    localStorage.setItem('refreshToken', 'legacy-refresh-token');
    localStorage.setItem('user', JSON.stringify(legacyUser));

    // Verify legacy data exists
    expect(hasLegacyAuthData()).toBe(true);

    // Run migration
    migrateAuthData();

    // Verify legacy data was migrated to Zustand format
    const zustandData = localStorage.getItem('intellifill-auth');
    expect(zustandData).toBeTruthy();

    // Verify legacy data was cleaned up
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  test('should not migrate if Zustand data already exists', () => {
    // Set up existing Zustand data
    const existingZustandData = {
      state: { isAuthenticated: false },
      version: 1,
    };
    localStorage.setItem('intellifill-auth', JSON.stringify(existingZustandData));

    // Set up legacy data
    localStorage.setItem('token', 'legacy-token');
    localStorage.setItem('refreshToken', 'legacy-refresh');
    localStorage.setItem('user', '{"id":"legacy"}');

    // Run migration
    migrateAuthData();

    // Verify legacy data was not touched
    expect(localStorage.getItem('token')).toBe('legacy-token');
    expect(localStorage.getItem('refreshToken')).toBe('legacy-refresh');
    expect(localStorage.getItem('user')).toBe('{"id":"legacy"}');
  });

  test('should handle expired legacy tokens', () => {
    // Create an expired token
    const expiredPayload = {
      sub: 'expired-user',
      exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
    };
    const expiredToken = 'header.' + btoa(JSON.stringify(expiredPayload)) + '.signature';

    localStorage.setItem('token', expiredToken);
    localStorage.setItem('refreshToken', 'expired-refresh-token');
    localStorage.setItem('user', '{"id":"expired-user"}');

    // Mock console.log to capture migration message
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    // Run migration
    migrateAuthData();

    // Verify migration was skipped due to expired token
    expect(consoleSpy).toHaveBeenCalledWith('Legacy token expired, skipping migration');

    // Verify legacy data was cleaned up
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();

    consoleSpy.mockRestore();
  });
});

// Setup test environment
beforeAll(() => {
  // Mock window.atob for JWT token parsing in tests
  if (typeof window.atob === 'undefined') {
    global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
  }
  
  // Mock navigator.userAgent
  Object.defineProperty(navigator, 'userAgent', {
    writable: true,
    value: 'Mozilla/5.0 (Test Environment)',
  });
});
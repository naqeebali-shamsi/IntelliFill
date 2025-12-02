/**
 * Migration utilities for moving from localStorage to Zustand persistence
 */

import { useAuthStore } from './auth';

export interface LegacyAuthData {
  token?: string;
  refreshToken?: string;
  user?: string; // JSON stringified user object
}

/**
 * Migrate existing localStorage authentication data to Zustand store
 * This should be called once during app initialization
 */
export const migrateAuthData = () => {
  try {
    // Check if we already have Zustand persisted data
    const existingZustandData = localStorage.getItem('intellifill-auth');
    if (existingZustandData) {
      // Zustand data exists, no need to migrate
      return;
    }

    // Check for legacy localStorage auth data
    const legacyToken = localStorage.getItem('token');
    const legacyRefreshToken = localStorage.getItem('refreshToken');
    const legacyUserStr = localStorage.getItem('user');

    if (!legacyToken || !legacyRefreshToken || !legacyUserStr) {
      // No legacy data to migrate
      return;
    }

    try {
      const legacyUser = JSON.parse(legacyUserStr);
      
      // Validate token expiration before migrating
      const tokenPayload = JSON.parse(atob(legacyToken.split('.')[1]));
      const expirationTime = tokenPayload.exp * 1000;
      
      if (Date.now() >= expirationTime) {
        console.log('Legacy token expired, skipping migration');
        clearLegacyAuthData();
        return;
      }

      // Create the auth state object for Zustand
      const migratedAuthState = {
        state: {
          user: legacyUser,
          tokens: {
            accessToken: legacyToken,
            refreshToken: legacyRefreshToken,
            expiresAt: expirationTime,
          },
          isAuthenticated: true,
          isInitialized: true,
          sessionExpiry: expirationTime,
          lastActivity: Date.now(),
          rememberMe: true, // Assume true since data was persisted
          deviceId: generateDeviceId(),
          // Default values for other required fields
          isLoading: false,
          error: null,
          loginAttempts: 0,
          isLocked: false,
          lockExpiry: null,
          ipAddress: null,
          userAgent: navigator.userAgent,
        },
        version: 1,
      };

      // Save to Zustand persistence
      localStorage.setItem('intellifill-auth', JSON.stringify(migratedAuthState));
      
      // Clear legacy localStorage data
      clearLegacyAuthData();
      
      console.log('✅ Successfully migrated auth data to Zustand');
    } catch (parseError) {
      console.error('Failed to parse legacy auth data:', parseError);
      clearLegacyAuthData();
    }
  } catch (error) {
    console.error('Auth migration error:', error);
  }
};

/**
 * Clear legacy localStorage auth data
 */
export const clearLegacyAuthData = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
};

/**
 * Generate a device ID for the migrated session
 */
const generateDeviceId = (): string => {
  return 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
};

/**
 * Check if there's legacy auth data that needs migration
 */
export const hasLegacyAuthData = (): boolean => {
  const token = localStorage.getItem('token');
  const refreshToken = localStorage.getItem('refreshToken');
  const user = localStorage.getItem('user');
  
  return !!(token && refreshToken && user);
};

/**
 * Validate legacy token without throwing errors
 */
export const isLegacyTokenValid = (): boolean => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return false;
    
    const tokenPayload = JSON.parse(atob(token.split('.')[1]));
    const expirationTime = tokenPayload.exp * 1000;
    
    return Date.now() < expirationTime;
  } catch {
    return false;
  }
};
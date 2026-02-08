/**
 * IntelliFill Background Service Worker
 *
 * Handles API communication, authentication, and profile caching.
 * This is the only entrypoint that holds auth tokens and makes API calls.
 * Content scripts and popup communicate through chrome.runtime messages.
 */

import { api, AuthError } from '../lib/api-client';
import {
  authToken,
  cachedProfile,
  clearAuthStorage,
  extensionSettings,
  isCacheValid,
} from '../shared/storage';
import { CACHE_DURATION_MS, PROFILE_REFRESH_MINUTES } from '../shared/constants';
import type {
  BackgroundMessage,
  LoginResult,
  LogoutResult,
  ProfileResult,
  UserResult,
  AuthCheckResult,
  CacheResult,
} from '../shared/types';

export default defineBackground(() => {
  console.log('IntelliFill: Background service worker started');

  /** Login user and cache profile */
  async function handleLogin(email: string, password: string): Promise<LoginResult> {
    try {
      const data = await api.login({ email, password });

      if (data.success && data.user) {
        // Fetch and cache profile immediately after login
        const profile = await api.getProfile();
        if (profile) {
          await cachedProfile.setValue({ profile, fetchedAt: Date.now() });
        }
        return { success: true, user: data.user };
      }
      return { success: false, error: data.message || 'Login failed' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Login failed' };
    }
  }

  /** Logout and clear all stored data */
  async function handleLogout(): Promise<LogoutResult> {
    await clearAuthStorage();
    return { success: true };
  }

  /** Fetch profile, using cache when valid */
  async function handleGetProfile(forceRefresh?: boolean): Promise<ProfileResult> {
    try {
      if (!forceRefresh && (await isCacheValid(CACHE_DURATION_MS))) {
        const cached = await cachedProfile.getValue();
        if (cached) {
          return { success: true, profile: cached.profile };
        }
      }

      const profile = await api.getProfile();
      if (profile) {
        await cachedProfile.setValue({ profile, fetchedAt: Date.now() });
        return { success: true, profile };
      }
      return { success: false, error: 'Failed to fetch profile' };
    } catch (error) {
      if (error instanceof AuthError) {
        await clearAuthStorage();
        return { success: false, error: 'Session expired - please log in again' };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch profile',
      };
    }
  }

  /** Get current user info */
  async function handleGetCurrentUser(): Promise<UserResult> {
    try {
      const user = await api.getCurrentUser();
      if (user) {
        return { success: true, user };
      }
      return { success: false, error: 'Failed to fetch user' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user',
      };
    }
  }

  /** Check if user has a valid auth token */
  async function handleIsAuthenticated(): Promise<AuthCheckResult> {
    const token = await authToken.getValue();
    return { authenticated: !!token };
  }

  /** Clear cached profile data */
  async function handleClearCache(): Promise<CacheResult> {
    await cachedProfile.setValue(null);
    return { success: true };
  }

  // Message handler for popup and content scripts
  browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    const message = raw as BackgroundMessage;
    console.log('IntelliFill: Received message', message.action);

    const handle = async () => {
      switch (message.action) {
        case 'login':
          return handleLogin(message.email, message.password);
        case 'logout':
          return handleLogout();
        case 'getProfile':
          return handleGetProfile(message.forceRefresh);
        case 'getCurrentUser':
          return handleGetCurrentUser();
        case 'isAuthenticated':
          return handleIsAuthenticated();
        case 'clearCache':
          return handleClearCache();
      }
    };

    handle().then(sendResponse);
    return true; // Keep message channel open for async response
  });

  // Set up periodic profile refresh
  browser.alarms.create('refreshProfile', {
    periodInMinutes: PROFILE_REFRESH_MINUTES,
  });

  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'refreshProfile') {
      const { authenticated } = await handleIsAuthenticated();
      if (authenticated) {
        console.log('IntelliFill: Periodic profile refresh');
        await handleGetProfile(true);
      }
    }
  });

  // Handle extension installation
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      console.log('IntelliFill: Extension installed');
      extensionSettings.setValue({
        enabled: true,
        apiEndpoint: 'http://localhost:3002/api',
        cacheMinutes: 5,
      });
    } else if (details.reason === 'update') {
      console.log('IntelliFill: Extension updated');
      // Clear cache on update to avoid stale data
      cachedProfile.setValue(null);
    }
  });
});

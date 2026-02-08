import { storage } from 'wxt/storage';
import type { UserProfile, ExtensionSettings } from './types';
import { DEFAULT_SETTINGS } from './types/settings';

/** Cached profile with timestamp for staleness checks */
export interface CachedProfile {
  profile: UserProfile;
  fetchedAt: number;
}

/** Auth token - stored in chrome.storage.local (sandboxed per-extension) */
export const authToken = storage.defineItem<string | null>('local:authToken', {
  fallback: null,
});

/** Refresh token for silent re-authentication */
export const refreshToken = storage.defineItem<string | null>('local:refreshToken', {
  fallback: null,
});

/** Cached profile data with timestamp */
export const cachedProfile = storage.defineItem<CachedProfile | null>('local:cachedProfile', {
  fallback: null,
});

/** Extension settings */
export const extensionSettings = storage.defineItem<ExtensionSettings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
});

/** Clear all auth-related storage on logout */
export async function clearAuthStorage(): Promise<void> {
  await authToken.setValue(null);
  await refreshToken.setValue(null);
  await cachedProfile.setValue(null);
}

/** Check if cached profile is still valid */
export async function isCacheValid(maxAgeMs: number): Promise<boolean> {
  const cached = await cachedProfile.getValue();
  if (!cached) return false;
  return Date.now() - cached.fetchedAt < maxAgeMs;
}

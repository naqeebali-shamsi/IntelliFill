/**
 * localStorage Migration Utilities
 *
 * Handles one-time migration from old localStorage keys to standardized key format.
 * This ensures backward compatibility when updating localStorage key structure.
 */

/**
 * Standardized localStorage key for backend auth state
 */
export const AUTH_STORAGE_KEY = 'intellifill-backend-auth';

/**
 * Legacy keys that need to be migrated
 */
const LEGACY_KEYS = ['intellifill-auth', 'auth-storage', 'backend-auth-storage'] as const;

/**
 * Migration completion flag key
 */
const MIGRATION_FLAG_KEY = 'intellifill-storage-migration-v1';

/**
 * Migrates auth data from legacy localStorage keys to the standardized key.
 *
 * Strategy:
 * 1. Check each legacy key for existing data
 * 2. If found, copy to new standardized key
 * 3. Remove legacy key
 * 4. Set migration flag to prevent re-running
 *
 * This migration is idempotent - safe to run multiple times.
 *
 * @returns {boolean} True if migration was performed, false if already migrated
 */
export function migrateAuthStorage(): boolean {
  // Skip if already migrated
  if (localStorage.getItem(MIGRATION_FLAG_KEY)) {
    return false;
  }

  let migrated = false;

  // Check each legacy key
  for (const legacyKey of LEGACY_KEYS) {
    const legacyData = localStorage.getItem(legacyKey);

    if (legacyData) {
      try {
        // Validate it's valid JSON before migrating
        JSON.parse(legacyData);

        // Only migrate if new key doesn't already have data
        // (prevents overwriting newer data with older data)
        if (!localStorage.getItem(AUTH_STORAGE_KEY)) {
          localStorage.setItem(AUTH_STORAGE_KEY, legacyData);
          console.log(
            `[Migration] Migrated auth data from '${legacyKey}' to '${AUTH_STORAGE_KEY}'`
          );
          migrated = true;
        }

        // Remove legacy key regardless
        localStorage.removeItem(legacyKey);
      } catch (error) {
        console.error(`[Migration] Invalid JSON in '${legacyKey}', skipping:`, error);
        // Remove corrupted legacy data
        localStorage.removeItem(legacyKey);
      }
    }
  }

  // Mark migration as complete
  localStorage.setItem(MIGRATION_FLAG_KEY, 'true');

  if (migrated) {
    console.log('[Migration] localStorage auth migration complete');
  }

  return migrated;
}

/**
 * Clears all auth-related localStorage data.
 * Useful for logout or debugging.
 *
 * @param {boolean} includeMigrationFlag - Whether to also clear migration flag (default: false)
 */
export function clearAuthStorage(includeMigrationFlag = false): void {
  // Clear current key
  localStorage.removeItem(AUTH_STORAGE_KEY);

  // Clear any remaining legacy keys
  for (const legacyKey of LEGACY_KEYS) {
    localStorage.removeItem(legacyKey);
  }

  // Optionally clear migration flag (for testing)
  if (includeMigrationFlag) {
    localStorage.removeItem(MIGRATION_FLAG_KEY);
  }

  console.log('[Storage] Auth storage cleared');
}

/**
 * Exports current auth storage state for debugging or backup.
 *
 * @returns {object | null} Current auth state or null if not found
 */
export function exportAuthStorage(): object | null {
  const data = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('[Storage] Failed to parse auth storage:', error);
    return null;
  }
}

/**
 * Gets the current migration status.
 *
 * @returns {object} Migration status information
 */
export function getMigrationStatus(): {
  migrated: boolean;
  hasLegacyKeys: boolean;
  legacyKeysFound: string[];
  currentKeyExists: boolean;
} {
  const migrated = !!localStorage.getItem(MIGRATION_FLAG_KEY);
  const currentKeyExists = !!localStorage.getItem(AUTH_STORAGE_KEY);

  const legacyKeysFound: string[] = [];
  for (const key of LEGACY_KEYS) {
    if (localStorage.getItem(key)) {
      legacyKeysFound.push(key);
    }
  }

  return {
    migrated,
    hasLegacyKeys: legacyKeysFound.length > 0,
    legacyKeysFound,
    currentKeyExists,
  };
}

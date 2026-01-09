/**
 * Account Store
 *
 * Zustand store for user account management (profile and settings).
 * Task 386: Frontend account store for profile and settings state management.
 *
 * @module stores/accountStore
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import accountService, {
  UserSettings,
  UserProfile,
  UpdateSettingsData,
  UpdateProfileData,
} from '@/services/accountService';

// ============================================================================
// Helper: Conditional DevTools
// ============================================================================

// Task 296: Helper to conditionally apply devtools only in development mode
const applyDevtools = <T>(middleware: T) => {
  if (import.meta.env.DEV) {
    return devtools(middleware as any, {
      name: 'IntelliFill Account Store',
    }) as T;
  }
  return middleware;
};

// ============================================================================
// Types
// ============================================================================

interface AccountState {
  // Settings state
  settings: UserSettings | null;
  isLoadingSettings: boolean;
  settingsError: string | null;

  // Profile update state (profile data is in auth store)
  isUpdatingProfile: boolean;
  profileError: string | null;

  // General update state
  isUpdating: boolean;
  error: string | null;

  // Last fetch timestamps for cache invalidation
  settingsFetchedAt: number | null;
}

interface AccountActions {
  // Settings actions
  fetchSettings: () => Promise<void>;
  updateSettings: (data: UpdateSettingsData) => Promise<UserSettings | null>;

  // Profile actions
  updateProfile: (data: UpdateProfileData) => Promise<UserProfile | null>;

  // Error management
  clearError: () => void;
  clearSettingsError: () => void;
  clearProfileError: () => void;

  // Reset
  reset: () => void;
}

type AccountStore = AccountState & AccountActions;

// ============================================================================
// Initial State
// ============================================================================

const initialState: AccountState = {
  settings: null,
  isLoadingSettings: false,
  settingsError: null,
  isUpdatingProfile: false,
  profileError: null,
  isUpdating: false,
  error: null,
  settingsFetchedAt: null,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useAccountStore = create<AccountStore>()(
  applyDevtools(
    immer((set, get) => ({
      ...initialState,

      // ========================================================================
      // Settings Actions
      // ========================================================================

      fetchSettings: async () => {
        // Skip if already loading
        if (get().isLoadingSettings) {
          return;
        }

        set((state) => {
          state.isLoadingSettings = true;
          state.settingsError = null;
        });

        try {
          const settings = await accountService.getSettings();

          set((state) => {
            state.settings = settings;
            state.isLoadingSettings = false;
            state.settingsFetchedAt = Date.now();
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to fetch settings';

          set((state) => {
            state.settingsError = errorMessage;
            state.isLoadingSettings = false;
          });
        }
      },

      updateSettings: async (data: UpdateSettingsData) => {
        set((state) => {
          state.isUpdating = true;
          state.error = null;
        });

        try {
          const updatedSettings = await accountService.updateSettings(data);

          set((state) => {
            state.settings = updatedSettings;
            state.isUpdating = false;
            state.settingsFetchedAt = Date.now();
          });

          return updatedSettings;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to update settings';

          set((state) => {
            state.error = errorMessage;
            state.isUpdating = false;
          });

          return null;
        }
      },

      // ========================================================================
      // Profile Actions
      // ========================================================================

      updateProfile: async (data: UpdateProfileData) => {
        set((state) => {
          state.isUpdatingProfile = true;
          state.profileError = null;
        });

        try {
          const updatedProfile = await accountService.updateProfile(data);

          set((state) => {
            state.isUpdatingProfile = false;
          });

          return updatedProfile;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to update profile';

          set((state) => {
            state.profileError = errorMessage;
            state.isUpdatingProfile = false;
          });

          return null;
        }
      },

      // ========================================================================
      // Error Management
      // ========================================================================

      clearError: () => {
        set((state) => {
          state.error = null;
          state.settingsError = null;
          state.profileError = null;
        });
      },

      clearSettingsError: () => {
        set((state) => {
          state.settingsError = null;
        });
      },

      clearProfileError: () => {
        set((state) => {
          state.profileError = null;
        });
      },

      // ========================================================================
      // Reset
      // ========================================================================

      reset: () => {
        set(initialState);
      },
    }))
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const useSettings = () => useAccountStore((state) => state.settings);
export const useSettingsLoading = () => useAccountStore((state) => state.isLoadingSettings);
export const useSettingsError = () => useAccountStore((state) => state.settingsError);

export const useProfileUpdating = () => useAccountStore((state) => state.isUpdatingProfile);
export const useProfileError = () => useAccountStore((state) => state.profileError);

export const useAccountUpdating = () => useAccountStore((state) => state.isUpdating);
export const useAccountError = () => useAccountStore((state) => state.error);

// ============================================================================
// Composite Hooks
// ============================================================================

/**
 * Hook for settings management
 */
export const useAccountSettings = () => {
  const settings = useAccountStore((state) => state.settings);
  const isLoading = useAccountStore((state) => state.isLoadingSettings);
  const error = useAccountStore((state) => state.settingsError);
  const fetchSettings = useAccountStore((state) => state.fetchSettings);
  const updateSettings = useAccountStore((state) => state.updateSettings);
  const clearError = useAccountStore((state) => state.clearSettingsError);

  return {
    settings,
    isLoading,
    error,
    fetchSettings,
    updateSettings,
    clearError,
  };
};

/**
 * Hook for profile management
 */
export const useAccountProfile = () => {
  const isUpdating = useAccountStore((state) => state.isUpdatingProfile);
  const error = useAccountStore((state) => state.profileError);
  const updateProfile = useAccountStore((state) => state.updateProfile);
  const clearError = useAccountStore((state) => state.clearProfileError);

  return {
    isUpdating,
    error,
    updateProfile,
    clearError,
  };
};

// ============================================================================
// Default Export
// ============================================================================

export default useAccountStore;

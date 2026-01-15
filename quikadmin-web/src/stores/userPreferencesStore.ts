/**
 * User preferences store with localStorage persistence
 * Manages wizard behavior preferences (assisted vs express mode)
 * @module stores/userPreferencesStore
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { applyDevtools } from './utils/index.js';

// =================== TYPE DEFINITIONS ===================

/**
 * Wizard mode determines the level of guidance and auto-skip behavior
 * - assisted: More guidance, lower auto-skip threshold (85%), recommended for new users
 * - express: Less guidance, higher auto-skip threshold (90%), for power users
 */
export type WizardMode = 'assisted' | 'express';

interface UserPreferencesState {
  /** Current wizard mode setting */
  wizardMode: WizardMode;
}

interface UserPreferencesActions {
  /** Set the wizard mode */
  setWizardMode: (mode: WizardMode) => void;
}

type UserPreferencesStore = UserPreferencesState & UserPreferencesActions;

// =================== INITIAL STATE ===================

const initialState: UserPreferencesState = {
  wizardMode: 'assisted', // Default for new users - safer with more guidance
};

// =================== STORE IMPLEMENTATION ===================

export const useUserPreferencesStore = create<UserPreferencesStore>()(
  applyDevtools(
    persist(
      (set) => ({
        ...initialState,

        setWizardMode: (mode: WizardMode) => {
          set({ wizardMode: mode });
        },
      }),
      {
        name: 'user-preferences', // localStorage key
        storage: createJSONStorage(() => localStorage),
      }
    ),
    'IntelliFill User Preferences Store'
  )
);

// =================== SELECTORS ===================

export const userPreferencesSelectors = {
  wizardMode: (state: UserPreferencesStore) => state.wizardMode,
  isExpressMode: (state: UserPreferencesStore) => state.wizardMode === 'express',
  isAssistedMode: (state: UserPreferencesStore) => state.wizardMode === 'assisted',
};

// =================== CONFIDENCE THRESHOLDS ===================

/**
 * Auto-skip confidence thresholds by wizard mode
 * - Express mode: 90% (higher bar for skipping - power users want control)
 * - Assisted mode: 85% (lower bar - new users get more review opportunities)
 */
export const MODE_CONFIDENCE_THRESHOLDS = {
  express: 0.9,
  assisted: 0.85,
} as const;

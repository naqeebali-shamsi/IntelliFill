/**
 * Simplified UI Store - Manages theme and basic UI state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UIState {
  theme: 'light' | 'dark' | 'system';
  resolvedTheme: 'light' | 'dark';
  globalLoading: boolean;
  sidebarCollapsed: boolean;
  compactMode: boolean;
}

export interface UIActions {
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setGlobalLoading: (loading: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCompactMode: (compact: boolean) => void;
}

type UIStore = UIState & UIActions;

/** Apply compact mode class to document element */
function applyCompactMode(compact: boolean): void {
  document.documentElement.classList.toggle('compact', compact);
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // State
      theme: 'system',
      resolvedTheme: 'light',
      globalLoading: false,
      sidebarCollapsed: false,
      compactMode: false,

      // Actions
      setTheme: (theme) => set({ theme }),
      setGlobalLoading: (loading) => set({ globalLoading: loading }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setCompactMode: (compact) => {
        applyCompactMode(compact);
        set({ compactMode: compact });
      },
    }),
    {
      name: 'intellifill-ui',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        compactMode: state.compactMode,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          // Apply compact mode on store rehydration (initial load from localStorage)
          if (state?.compactMode) {
            applyCompactMode(true);
          }
        };
      },
    }
  )
);

// Selectors
export const uiSelectors = {
  theme: (state: UIStore) => state.theme,
  globalLoading: (state: UIStore) => state.globalLoading,
  sidebarCollapsed: (state: UIStore) => state.sidebarCollapsed,
  compactMode: (state: UIStore) => state.compactMode,
};

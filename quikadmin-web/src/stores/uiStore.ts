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
}

export interface UIActions {
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setGlobalLoading: (loading: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // State
      theme: 'system',
      resolvedTheme: 'light',
      globalLoading: false,
      sidebarCollapsed: false,

      // Actions
      setTheme: (theme) => set({ theme }),
      setGlobalLoading: (loading) => set({ globalLoading: loading }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: 'intellifill-ui',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);

// Selectors
export const uiSelectors = {
  theme: (state: UIStore) => state.theme,
  globalLoading: (state: UIStore) => state.globalLoading,
  sidebarCollapsed: (state: UIStore) => state.sidebarCollapsed,
};
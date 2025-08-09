/**
 * Store Index - Central export hub for working Zustand stores
 * Simplified version with only functional stores
 */

// =================== STORE EXPORTS ===================

import { useAuthStore } from './simpleAuthStore';
import { useUIStore, uiSelectors } from './uiStore';
import type { UIState, UIActions } from './uiStore';

// Export stores
export { useAuthStore, useUIStore, uiSelectors };
export type { UIState, UIActions };

// Export types
export * from './types';

// =================== STORE INSTANCES ===================

// For cases where you need to access stores outside of React components
export const stores = {
  auth: useAuthStore,
  ui: useUIStore,
} as const;

// =================== STORE INITIALIZATION ===================

/**
 * Initialize all stores with their required data
 */
export const initializeStores = async () => {
  try {
    // Import migration utilities
    const { migrateAuthData } = await import('./migrationUtils');
    
    // Migrate legacy localStorage data before initializing stores
    migrateAuthData();
    
    // Initialize auth first (required for other stores)
    const authStore = useAuthStore.getState();
    if (authStore.initialize) {
      await authStore.initialize();
    }
    
    console.log('✅ All stores initialized successfully');
  } catch (error) {
    console.error('❌ Store initialization error:', error);
  }
};

// =================== STORE CLEANUP ===================

/**
 * Cleanup all stores (useful for testing or app shutdown)
 */
export const cleanupStores = () => {
  try {
    const authStore = useAuthStore.getState() as any;
    const uiStore = useUIStore.getState() as any;
    
    if (authStore.clearSession) {
      authStore.clearSession();
    }
    
    if (uiStore.closeAllModals) {
      uiStore.closeAllModals();
    }
    
    console.log('✅ All stores cleaned up successfully');
  } catch (error) {
    console.error('❌ Store cleanup error:', error);
  }
};

// =================== STORE PERSISTENCE ===================

/**
 * Utilities for managing store persistence
 */
export const storePersistence = {
  // Clear all persisted data
  clearAll: () => {
    localStorage.removeItem('intellifill-auth');
    localStorage.removeItem('intellifill-ui');
    localStorage.removeItem('auth-storage');
  },

  // Export all store data
  exportAll: () => {
    return {
      auth: JSON.parse(localStorage.getItem('auth-storage') || '{}'),
      ui: JSON.parse(localStorage.getItem('intellifill-ui') || '{}'),
    };
  },

  // Import store data
  importAll: (data: any) => {
    if (data.auth) {
      localStorage.setItem('auth-storage', JSON.stringify(data.auth));
    }
    if (data.ui) {
      localStorage.setItem('intellifill-ui', JSON.stringify(data.ui));
    }
  },
};

// =================== EXPORT DEFAULT ===================

export default {
  stores,
  initializeStores,
  cleanupStores,
  storePersistence,
};
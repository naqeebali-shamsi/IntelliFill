/**
 * Store Index - Central export hub for all Zustand stores
 * Provides a unified interface to access all stores and their selectors
 */

// =================== STORE EXPORTS ===================

export { useAuthStore, authSelectors } from './simpleAuthStore';
export type { LoginCredentials, RegisterData } from './types';

export { useUIStore, uiSelectors } from './uiStore';
export type { UIState, UIActions } from './uiStore';

export { useDocumentStore, documentSelectors } from './documentStore';
export type { DocumentState, DocumentActions, ProcessingOptions } from './documentStore';

export { useTemplateStore, templateSelectors } from './templateStore';
export type { TemplateState, TemplateActions } from './templateStore';

export { useSettingsStore, settingsSelectors } from './settingsStore';
export type { SettingsState, SettingsActions, SettingsBackup, ImportOptions } from './settingsStore';

// =================== TYPE EXPORTS ===================

export * from './types';
export * from './middleware';

// =================== STORE INSTANCES ===================

// For cases where you need to access stores outside of React components
export const stores = {
  auth: useAuthStore,
  ui: useUIStore,
  document: useDocumentStore,
  template: useTemplateStore,
  settings: useSettingsStore,
} as const;

// =================== COMBINED SELECTORS ===================

/**
 * Combined selectors that work across multiple stores
 */
export const combinedSelectors = {
  // Check if user can access a feature based on auth and settings
  canAccessFeature: (feature: string) => {
    const user = useAuthStore.getState().user;
    const featureFlags = useSettingsStore.getState().featureFlags;
    
    // Check user role permissions
    const hasRolePermission = user?.role === 'admin' || 
      user?.subscription?.features.includes(feature);
    
    // Check feature flag
    const isFeatureEnabled = featureFlags[feature];
    
    return hasRolePermission && isFeatureEnabled;
  },

  // Get user's effective theme considering preferences and system
  getEffectiveTheme: () => {
    const uiTheme = useUIStore.getState().theme;
    const userTheme = useSettingsStore.getState().userPreferences.theme;
    
    // UI store takes precedence, fallback to user preferences
    if (uiTheme !== 'system') return uiTheme;
    if (userTheme !== 'system') return userTheme;
    
    // System preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },

  // Check if any store is loading
  isAnyStoreLoading: () => {
    const authLoading = useAuthStore.getState().isLoading;
    const uiLoading = useUIStore.getState().globalLoading;
    const documentLoading = useDocumentStore.getState().isUploading;
    const templateLoading = useTemplateStore.getState().isLoading;
    const settingsLoading = useSettingsStore.getState().isLoading;
    
    return authLoading || uiLoading || documentLoading || templateLoading || settingsLoading;
  },

  // Get combined error state from all stores
  getAllErrors: () => {
    const authError = useAuthStore.getState().error;
    const documentError = useDocumentStore.getState().lastError;
    const templateError = useTemplateStore.getState().lastError;
    const settingsError = useSettingsStore.getState().lastError;
    
    return [authError, documentError, templateError, settingsError]
      .filter(Boolean)
      .map(error => typeof error === 'string' ? { message: error } : error);
  },

  // Check if user has unsaved changes anywhere
  hasAnyUnsavedChanges: () => {
    const templateChanges = useTemplateStore.getState().isEditing;
    const settingsChanges = useSettingsStore.getState().hasUnsavedChanges;
    
    return templateChanges || settingsChanges;
  },

  // Get processing status across all documents
  getProcessingStatus: () => {
    const jobs = useDocumentStore.getState().jobs;
    const activeJobs = jobs.filter(job => ['queued', 'processing'].includes(job.status));
    const totalProgress = activeJobs.reduce((sum, job) => sum + job.progress, 0);
    const averageProgress = activeJobs.length > 0 ? totalProgress / activeJobs.length : 0;
    
    return {
      activeJobs: activeJobs.length,
      totalJobs: jobs.length,
      averageProgress,
      isProcessing: activeJobs.length > 0,
    };
  },

  // Get user's dashboard stats
  getDashboardStats: () => {
    const user = useAuthStore.getState().user;
    const jobs = useDocumentStore.getState().jobs;
    const templates = useTemplateStore.getState().templates;
    const userTemplates = templates.filter(t => t.createdBy === user?.id);
    
    const completedJobs = jobs.filter(j => j.status === 'completed').length;
    const failedJobs = jobs.filter(j => j.status === 'failed').length;
    const successRate = jobs.length > 0 ? (completedJobs / jobs.length) * 100 : 0;
    
    return {
      totalJobs: jobs.length,
      completedJobs,
      failedJobs,
      successRate,
      totalTemplates: userTemplates.length,
      activeTemplates: userTemplates.filter(t => t.isActive).length,
    };
  },
};

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
    await useAuthStore.getState().initialize();
    
    // Initialize other stores in parallel
    await Promise.allSettled([
      useDocumentStore.getState().refreshAll(),
      useTemplateStore.getState().loadTemplates(),
      useSettingsStore.getState().loadSettings(),
    ]);
    
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
    useAuthStore.getState().clearSession?.();
    useUIStore.getState().closeAllModals?.();
    useDocumentStore.getState().cleanup?.();
    
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
    localStorage.removeItem('intellifill-documents');
    localStorage.removeItem('intellifill-templates');
    localStorage.removeItem('intellifill-settings');
  },

  // Export all store data
  exportAll: () => {
    return {
      auth: JSON.parse(localStorage.getItem('intellifill-auth') || '{}'),
      ui: JSON.parse(localStorage.getItem('intellifill-ui') || '{}'),
      documents: JSON.parse(localStorage.getItem('intellifill-documents') || '{}'),
      templates: JSON.parse(localStorage.getItem('intellifill-templates') || '{}'),
      settings: JSON.parse(localStorage.getItem('intellifill-settings') || '{}'),
    };
  },

  // Import store data
  importAll: (data: any) => {
    if (data.auth) {
      localStorage.setItem('intellifill-auth', JSON.stringify(data.auth));
    }
    if (data.ui) {
      localStorage.setItem('intellifill-ui', JSON.stringify(data.ui));
    }
    if (data.documents) {
      localStorage.setItem('intellifill-documents', JSON.stringify(data.documents));
    }
    if (data.templates) {
      localStorage.setItem('intellifill-templates', JSON.stringify(data.templates));
    }
    if (data.settings) {
      localStorage.setItem('intellifill-settings', JSON.stringify(data.settings));
    }
  },
};

// =================== STORE DEVTOOLS ===================

/**
 * Development utilities for debugging stores
 */
export const storeDevtools = {
  // Get current state of all stores
  getAllState: () => ({
    auth: useAuthStore.getState(),
    ui: useUIStore.getState(),
    document: useDocumentStore.getState(),
    template: useTemplateStore.getState(),
    settings: useSettingsStore.getState(),
  }),

  // Get store metrics if performance middleware is enabled
  getAllMetrics: () => ({
    auth: (useAuthStore.getState() as any).__performance?.getMetrics(),
    ui: (useUIStore.getState() as any).__performance?.getMetrics(),
    document: (useDocumentStore.getState() as any).__performance?.getMetrics(),
    template: (useTemplateStore.getState() as any).__performance?.getMetrics(),
    settings: (useSettingsStore.getState() as any).__performance?.getMetrics(),
  }),

  // Clear all store metrics
  clearAllMetrics: () => {
    (useAuthStore.getState() as any).__performance?.clearMetrics();
    (useUIStore.getState() as any).__performance?.clearMetrics();
    (useDocumentStore.getState() as any).__performance?.clearMetrics();
    (useTemplateStore.getState() as any).__performance?.clearMetrics();
    (useSettingsStore.getState() as any).__performance?.clearMetrics();
  },

  // Check undo/redo capabilities
  getUndoRedoState: () => ({
    template: {
      canUndo: (useTemplateStore.getState() as any).canUndo,
      canRedo: (useTemplateStore.getState() as any).canRedo,
      historySize: (useTemplateStore.getState() as any).historySize,
    },
    settings: {
      canUndo: (useSettingsStore.getState() as any).canUndo,
      canRedo: (useSettingsStore.getState() as any).canRedo,
      historySize: (useSettingsStore.getState() as any).historySize,
    },
  }),
};

// =================== GLOBAL STORE HOOKS ===================

/**
 * Convenience hooks for common cross-store operations
 */
export const useGlobalLoading = () => {
  return combinedSelectors.isAnyStoreLoading();
};

export const useGlobalErrors = () => {
  return combinedSelectors.getAllErrors();
};

export const useUnsavedChanges = () => {
  return combinedSelectors.hasAnyUnsavedChanges();
};

export const useProcessingStatus = () => {
  return combinedSelectors.getProcessingStatus();
};

export const useDashboardStats = () => {
  return combinedSelectors.getDashboardStats();
};

export const useFeatureAccess = (feature: string) => {
  return combinedSelectors.canAccessFeature(feature);
};

// =================== STORE SUBSCRIPTIONS ===================

/**
 * Subscribe to specific changes across stores
 */
export const createCrossStoreSubscription = <T>(
  selector: () => T,
  callback: (value: T, previousValue: T) => void
) => {
  let previousValue = selector();
  
  const unsubscribers = [
    useAuthStore.subscribe(() => {
      const currentValue = selector();
      if (currentValue !== previousValue) {
        callback(currentValue, previousValue);
        previousValue = currentValue;
      }
    }),
    useUIStore.subscribe(() => {
      const currentValue = selector();
      if (currentValue !== previousValue) {
        callback(currentValue, previousValue);
        previousValue = currentValue;
      }
    }),
    useDocumentStore.subscribe(() => {
      const currentValue = selector();
      if (currentValue !== previousValue) {
        callback(currentValue, previousValue);
        previousValue = currentValue;
      }
    }),
    useTemplateStore.subscribe(() => {
      const currentValue = selector();
      if (currentValue !== previousValue) {
        callback(currentValue, previousValue);
        previousValue = currentValue;
      }
    }),
    useSettingsStore.subscribe(() => {
      const currentValue = selector();
      if (currentValue !== previousValue) {
        callback(currentValue, previousValue);
        previousValue = currentValue;
      }
    }),
  ];

  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
};

// =================== EXPORT DEFAULT ===================

export default {
  stores,
  combinedSelectors,
  initializeStores,
  cleanupStores,
  storePersistence,
  storeDevtools,
  createCrossStoreSubscription,
};
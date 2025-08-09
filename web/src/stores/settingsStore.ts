/**
 * Settings Store - Manages user preferences, app configuration, and system settings
 */

import { create } from 'zustand';
import { AppSettings, UserPreferences, WebhookConfig, ApiKeyConfig, ConnectedService } from './types';
import { createMiddleware } from './middleware';
import api, { getUserSettings, updateUserSettings } from '@/services/api';

// =================== STORE INTERFACES ===================

interface SettingsState {
  // User preferences
  userPreferences: UserPreferences;
  
  // App settings
  appSettings: AppSettings;
  
  // System settings (read-only for most users)
  systemSettings: {
    version: string;
    environment: 'development' | 'staging' | 'production';
    maintenanceMode: boolean;
    maxFileSize: number;
    supportedFormats: string[];
    rateLimit: {
      requestsPerHour: number;
      requestsPerDay: number;
    };
  };
  
  // Feature flags
  featureFlags: Record<string, boolean>;
  
  // Settings state
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: string | null;
  hasUnsavedChanges: boolean;
  lastError: string | null;
  
  // Settings sections state
  activeSection: string;
  expandedSections: string[];
  
  // Form validation
  validationErrors: Record<string, string[]>;
  
  // Backup and restore
  backupInProgress: boolean;
  restoreInProgress: boolean;
  availableBackups: SettingsBackup[];
  
  // Import/Export
  exportFormat: 'json' | 'yaml';
  importInProgress: boolean;
}

interface SettingsActions {
  // Loading and saving
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  saveUserPreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  saveAppSettings: (settings: Partial<AppSettings>) => Promise<void>;
  
  // User preferences
  updateUserPreferences: (preferences: Partial<UserPreferences>) => void;
  resetUserPreferences: () => void;
  
  // App settings
  updateAppSettings: (settings: Partial<AppSettings>) => void;
  resetAppSettings: () => void;
  
  // General settings
  updateGeneralSettings: (settings: Partial<AppSettings['general']>) => void;
  
  // Processing settings
  updateProcessingSettings: (settings: Partial<AppSettings['processing']>) => void;
  
  // Security settings
  updateSecuritySettings: (settings: Partial<AppSettings['security']>) => void;
  
  // Integration settings
  updateIntegrationSettings: (settings: Partial<AppSettings['integrations']>) => void;
  
  // Webhook management
  addWebhook: (webhook: Omit<WebhookConfig, 'id'>) => string;
  updateWebhook: (id: string, webhook: Partial<WebhookConfig>) => void;
  removeWebhook: (id: string) => void;
  testWebhook: (id: string) => Promise<boolean>;
  
  // API key management
  generateApiKey: (name: string, permissions: string[]) => Promise<string>;
  updateApiKey: (id: string, apiKey: Partial<ApiKeyConfig>) => void;
  revokeApiKey: (id: string) => void;
  
  // Connected services
  connectService: (service: Omit<ConnectedService, 'id' | 'status' | 'lastSync'>) => Promise<void>;
  disconnectService: (id: string) => Promise<void>;
  syncService: (id: string) => Promise<void>;
  updateServiceConfig: (id: string, config: Record<string, any>) => void;
  
  // Feature flags
  updateFeatureFlags: (flags: Record<string, boolean>) => void;
  toggleFeatureFlag: (flag: string) => void;
  
  // Settings sections
  setActiveSection: (section: string) => void;
  toggleSection: (section: string) => void;
  expandAllSections: () => void;
  collapseAllSections: () => void;
  
  // Validation
  validateSettings: () => Promise<Record<string, string[]>>;
  clearValidationErrors: () => void;
  
  // Backup and restore
  createBackup: (name: string, description?: string) => Promise<void>;
  restoreBackup: (backupId: string) => Promise<void>;
  deleteBackup: (backupId: string) => Promise<void>;
  loadBackups: () => Promise<void>;
  
  // Import/Export
  exportSettings: (sections?: string[], format?: 'json' | 'yaml') => Promise<Blob>;
  importSettings: (file: File, options?: ImportOptions) => Promise<void>;
  
  // Utility actions
  resetToDefaults: () => Promise<void>;
  refreshAll: () => Promise<void>;
  setError: (error: string | null) => void;
  clearError: () => void;
  markUnsavedChanges: (hasChanges?: boolean) => void;
}

// =================== HELPER TYPES ===================

interface SettingsBackup {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  size: number;
  sections: string[];
}

interface ImportOptions {
  overwrite?: boolean;
  sections?: string[];
  mergeStrategy?: 'replace' | 'merge' | 'append';
}

// =================== DEFAULT SETTINGS ===================

const defaultUserPreferences: UserPreferences = {
  theme: 'system',
  notifications: {
    email: true,
    desktop: false,
    processing: true,
    errors: true,
  },
  autoSave: true,
  retentionDays: 30,
};

const defaultAppSettings: AppSettings = {
  general: {
    autoSave: true,
    autoRefresh: true,
    refreshInterval: 30000,
    retentionPolicy: 30,
    maxConcurrentJobs: 5,
    enableNotifications: true,
  },
  processing: {
    defaultQuality: 'standard',
    enableOCR: true,
    enableAI: true,
    confidenceThreshold: 0.8,
    timeout: 300000,
    retryAttempts: 3,
  },
  security: {
    sessionTimeout: 3600000,
    requirePasswordChange: false,
    enableTwoFactor: false,
    allowedFileTypes: ['pdf', 'doc', 'docx', 'jpg', 'png'],
    maxFileSize: 10485760, // 10MB
    enableAuditLog: true,
  },
  integrations: {
    webhooks: [],
    apiKeys: [],
    connectedServices: [],
  },
};

const defaultSystemSettings = {
  version: '1.0.0',
  environment: 'production' as const,
  maintenanceMode: false,
  maxFileSize: 52428800, // 50MB
  supportedFormats: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'png', 'tiff'],
  rateLimit: {
    requestsPerHour: 1000,
    requestsPerDay: 10000,
  },
};

const defaultFeatureFlags: Record<string, boolean> = {
  advancedOCR: true,
  aiProcessing: true,
  batchProcessing: true,
  realTimeUpdates: true,
  webhookSupport: true,
  apiAccess: true,
  analyticsTracking: true,
  betaFeatures: false,
};

// =================== INITIAL STATE ===================

const initialState: SettingsState = {
  userPreferences: defaultUserPreferences,
  appSettings: defaultAppSettings,
  systemSettings: defaultSystemSettings,
  featureFlags: defaultFeatureFlags,
  isLoading: false,
  isSaving: false,
  lastSaved: null,
  hasUnsavedChanges: false,
  lastError: null,
  activeSection: 'general',
  expandedSections: ['general'],
  validationErrors: {},
  backupInProgress: false,
  restoreInProgress: false,
  availableBackups: [],
  exportFormat: 'json',
  importInProgress: false,
};

// =================== STORE IMPLEMENTATION ===================

type SettingsStore = SettingsState & SettingsActions;

export const useSettingsStore = create<SettingsStore>()(
  createMiddleware(
    {
      persist: true,
      persistName: 'intellifill-settings',
      persistOptions: {
        partialize: (state) => ({
          userPreferences: state.userPreferences,
          appSettings: state.appSettings,
          featureFlags: state.featureFlags,
          activeSection: state.activeSection,
          expandedSections: state.expandedSections,
          exportFormat: state.exportFormat,
        }),
        version: 1,
      },
      devtools: true,
      devtoolsName: 'IntelliFill Settings Store',
      logger: process.env.NODE_ENV === 'development',
      performance: true,
      performanceId: 'settings-store',
      errorBoundary: true,
      immer: true,
      subscribeWithSelector: true,
      undoRedo: true,
      undoRedoSize: 10,
    },
    (set, get) => ({
      ...initialState,

      // =================== LOADING AND SAVING ===================

      loadSettings: async () => {
        set((draft) => {
          draft.isLoading = true;
          draft.lastError = null;
        });

        try {
          // Load user preferences
          const userSettings = await getUserSettings('current-user');
          
          // Load app settings (admin only)
          let appSettings = defaultAppSettings;
          try {
            const appResponse = await api.get('/settings/app');
            appSettings = appResponse.data.data || defaultAppSettings;
          } catch (error) {
            console.warn('Could not load app settings, using defaults');
          }

          // Load system settings
          let systemSettings = defaultSystemSettings;
          try {
            const systemResponse = await api.get('/settings/system');
            systemSettings = systemResponse.data.data || defaultSystemSettings;
          } catch (error) {
            console.warn('Could not load system settings, using defaults');
          }

          // Load feature flags
          let featureFlags = defaultFeatureFlags;
          try {
            const flagsResponse = await api.get('/settings/features');
            featureFlags = { ...defaultFeatureFlags, ...flagsResponse.data.data };
          } catch (error) {
            console.warn('Could not load feature flags, using defaults');
          }

          set((draft) => {
            draft.userPreferences = { ...defaultUserPreferences, ...userSettings };
            draft.appSettings = appSettings;
            draft.systemSettings = systemSettings;
            draft.featureFlags = featureFlags;
          });
        } catch (error: any) {
          set((draft) => {
            draft.lastError = error.message;
          });
        } finally {
          set((draft) => {
            draft.isLoading = false;
          });
        }
      },

      saveSettings: async () => {
        const { userPreferences, appSettings } = get();
        
        set((draft) => {
          draft.isSaving = true;
          draft.lastError = null;
        });

        try {
          // Validate before saving
          const errors = await get().validateSettings();
          if (Object.keys(errors).length > 0) {
            set((draft) => {
              draft.validationErrors = errors;
            });
            throw new Error('Settings validation failed');
          }

          // Save user preferences
          await updateUserSettings('current-user', userPreferences);

          // Save app settings (admin only)
          try {
            await api.put('/settings/app', appSettings);
          } catch (error) {
            console.warn('Could not save app settings');
          }

          set((draft) => {
            draft.lastSaved = new Date().toISOString();
            draft.hasUnsavedChanges = false;
          });
        } catch (error: any) {
          set((draft) => {
            draft.lastError = error.message;
          });
          throw error;
        } finally {
          set((draft) => {
            draft.isSaving = false;
          });
        }
      },

      saveUserPreferences: async (preferences: Partial<UserPreferences>) => {
        try {
          await updateUserSettings('current-user', preferences);
          
          set((draft) => {
            Object.assign(draft.userPreferences, preferences);
            draft.lastSaved = new Date().toISOString();
          });
        } catch (error: any) {
          set((draft) => {
            draft.lastError = error.message;
          });
          throw error;
        }
      },

      saveAppSettings: async (settings: Partial<AppSettings>) => {
        try {
          await api.put('/settings/app', settings);
          
          set((draft) => {
            Object.assign(draft.appSettings, settings);
            draft.lastSaved = new Date().toISOString();
          });
        } catch (error: any) {
          set((draft) => {
            draft.lastError = error.message;
          });
          throw error;
        }
      },

      // =================== USER PREFERENCES ===================

      updateUserPreferences: (preferences: Partial<UserPreferences>) => {
        set((draft) => {
          Object.assign(draft.userPreferences, preferences);
          draft.hasUnsavedChanges = true;
        });
      },

      resetUserPreferences: () => {
        set((draft) => {
          draft.userPreferences = { ...defaultUserPreferences };
          draft.hasUnsavedChanges = true;
        });
      },

      // =================== APP SETTINGS ===================

      updateAppSettings: (settings: Partial<AppSettings>) => {
        set((draft) => {
          Object.assign(draft.appSettings, settings);
          draft.hasUnsavedChanges = true;
        });
      },

      resetAppSettings: () => {
        set((draft) => {
          draft.appSettings = JSON.parse(JSON.stringify(defaultAppSettings));
          draft.hasUnsavedChanges = true;
        });
      },

      updateGeneralSettings: (settings: Partial<AppSettings['general']>) => {
        set((draft) => {
          Object.assign(draft.appSettings.general, settings);
          draft.hasUnsavedChanges = true;
        });
      },

      updateProcessingSettings: (settings: Partial<AppSettings['processing']>) => {
        set((draft) => {
          Object.assign(draft.appSettings.processing, settings);
          draft.hasUnsavedChanges = true;
        });
      },

      updateSecuritySettings: (settings: Partial<AppSettings['security']>) => {
        set((draft) => {
          Object.assign(draft.appSettings.security, settings);
          draft.hasUnsavedChanges = true;
        });
      },

      updateIntegrationSettings: (settings: Partial<AppSettings['integrations']>) => {
        set((draft) => {
          Object.assign(draft.appSettings.integrations, settings);
          draft.hasUnsavedChanges = true;
        });
      },

      // =================== WEBHOOK MANAGEMENT ===================

      addWebhook: (webhook: Omit<WebhookConfig, 'id'>) => {
        const id = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        set((draft) => {
          const newWebhook: WebhookConfig = {
            id,
            retryPolicy: {
              maxRetries: 3,
              backoffMultiplier: 2,
            },
            ...webhook,
          };
          
          draft.appSettings.integrations.webhooks.push(newWebhook);
          draft.hasUnsavedChanges = true;
        });

        return id;
      },

      updateWebhook: (id: string, webhook: Partial<WebhookConfig>) => {
        set((draft) => {
          const existingWebhook = draft.appSettings.integrations.webhooks.find(w => w.id === id);
          if (existingWebhook) {
            Object.assign(existingWebhook, webhook);
            draft.hasUnsavedChanges = true;
          }
        });
      },

      removeWebhook: (id: string) => {
        set((draft) => {
          draft.appSettings.integrations.webhooks = draft.appSettings.integrations.webhooks.filter(w => w.id !== id);
          draft.hasUnsavedChanges = true;
        });
      },

      testWebhook: async (id: string) => {
        const webhook = get().appSettings.integrations.webhooks.find(w => w.id === id);
        if (!webhook) throw new Error('Webhook not found');

        try {
          const response = await api.post('/webhooks/test', {
            url: webhook.url,
            headers: webhook.headers,
            secret: webhook.secret,
          });
          
          return response.data.success;
        } catch (error: any) {
          throw new Error(`Webhook test failed: ${error.message}`);
        }
      },

      // =================== API KEY MANAGEMENT ===================

      generateApiKey: async (name: string, permissions: string[]) => {
        try {
          const response = await api.post('/api-keys', { name, permissions });
          const apiKey = response.data.data;

          set((draft) => {
            draft.appSettings.integrations.apiKeys.push(apiKey);
            draft.hasUnsavedChanges = true;
          });

          return apiKey.key;
        } catch (error: any) {
          throw new Error(`Failed to generate API key: ${error.message}`);
        }
      },

      updateApiKey: (id: string, apiKey: Partial<ApiKeyConfig>) => {
        set((draft) => {
          const existingKey = draft.appSettings.integrations.apiKeys.find(k => k.id === id);
          if (existingKey) {
            Object.assign(existingKey, apiKey);
            draft.hasUnsavedChanges = true;
          }
        });
      },

      revokeApiKey: (id: string) => {
        set((draft) => {
          const apiKey = draft.appSettings.integrations.apiKeys.find(k => k.id === id);
          if (apiKey) {
            apiKey.enabled = false;
            draft.hasUnsavedChanges = true;
          }
        });
      },

      // =================== CONNECTED SERVICES ===================

      connectService: async (service: Omit<ConnectedService, 'id' | 'status' | 'lastSync'>) => {
        const id = `service_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        try {
          // Test connection
          await api.post('/services/connect', service);

          set((draft) => {
            const newService: ConnectedService = {
              id,
              status: 'connected',
              ...service,
            };
            
            draft.appSettings.integrations.connectedServices.push(newService);
            draft.hasUnsavedChanges = true;
          });
        } catch (error: any) {
          throw new Error(`Failed to connect service: ${error.message}`);
        }
      },

      disconnectService: async (id: string) => {
        try {
          await api.post(`/services/${id}/disconnect`);
          
          set((draft) => {
            const service = draft.appSettings.integrations.connectedServices.find(s => s.id === id);
            if (service) {
              service.status = 'disconnected';
              draft.hasUnsavedChanges = true;
            }
          });
        } catch (error: any) {
          throw new Error(`Failed to disconnect service: ${error.message}`);
        }
      },

      syncService: async (id: string) => {
        try {
          await api.post(`/services/${id}/sync`);
          
          set((draft) => {
            const service = draft.appSettings.integrations.connectedServices.find(s => s.id === id);
            if (service) {
              service.lastSync = new Date().toISOString();
            }
          });
        } catch (error: any) {
          throw new Error(`Failed to sync service: ${error.message}`);
        }
      },

      updateServiceConfig: (id: string, config: Record<string, any>) => {
        set((draft) => {
          const service = draft.appSettings.integrations.connectedServices.find(s => s.id === id);
          if (service) {
            service.config = { ...service.config, ...config };
            draft.hasUnsavedChanges = true;
          }
        });
      },

      // =================== FEATURE FLAGS ===================

      updateFeatureFlags: (flags: Record<string, boolean>) => {
        set((draft) => {
          Object.assign(draft.featureFlags, flags);
          draft.hasUnsavedChanges = true;
        });
      },

      toggleFeatureFlag: (flag: string) => {
        set((draft) => {
          draft.featureFlags[flag] = !draft.featureFlags[flag];
          draft.hasUnsavedChanges = true;
        });
      },

      // =================== SETTINGS SECTIONS ===================

      setActiveSection: (section: string) => {
        set((draft) => {
          draft.activeSection = section;
          
          if (!draft.expandedSections.includes(section)) {
            draft.expandedSections.push(section);
          }
        });
      },

      toggleSection: (section: string) => {
        set((draft) => {
          if (draft.expandedSections.includes(section)) {
            draft.expandedSections = draft.expandedSections.filter(s => s !== section);
          } else {
            draft.expandedSections.push(section);
          }
        });
      },

      expandAllSections: () => {
        set((draft) => {
          draft.expandedSections = ['general', 'processing', 'security', 'integrations', 'features'];
        });
      },

      collapseAllSections: () => {
        set((draft) => {
          draft.expandedSections = [draft.activeSection];
        });
      },

      // =================== VALIDATION ===================

      validateSettings: async () => {
        const { userPreferences, appSettings } = get();
        const errors: Record<string, string[]> = {};

        // Validate user preferences
        if (userPreferences.retentionDays < 1 || userPreferences.retentionDays > 365) {
          errors.retentionDays = ['Retention days must be between 1 and 365'];
        }

        // Validate app settings
        if (appSettings.general.refreshInterval < 5000) {
          errors.refreshInterval = ['Refresh interval must be at least 5 seconds'];
        }

        if (appSettings.general.maxConcurrentJobs < 1 || appSettings.general.maxConcurrentJobs > 20) {
          errors.maxConcurrentJobs = ['Max concurrent jobs must be between 1 and 20'];
        }

        if (appSettings.processing.confidenceThreshold < 0 || appSettings.processing.confidenceThreshold > 1) {
          errors.confidenceThreshold = ['Confidence threshold must be between 0 and 1'];
        }

        if (appSettings.processing.timeout < 10000) {
          errors.timeout = ['Timeout must be at least 10 seconds'];
        }

        if (appSettings.security.sessionTimeout < 300000) {
          errors.sessionTimeout = ['Session timeout must be at least 5 minutes'];
        }

        if (appSettings.security.maxFileSize < 1048576) {
          errors.maxFileSize = ['Max file size must be at least 1MB'];
        }

        // Validate webhooks
        appSettings.integrations.webhooks.forEach((webhook, index) => {
          try {
            new URL(webhook.url);
          } catch {
            errors[`webhook_${index}_url`] = ['Invalid webhook URL'];
          }
        });

        set((draft) => {
          draft.validationErrors = errors;
        });

        return errors;
      },

      clearValidationErrors: () => {
        set((draft) => {
          draft.validationErrors = {};
        });
      },

      // =================== BACKUP AND RESTORE ===================

      createBackup: async (name: string, description?: string) => {
        set((draft) => {
          draft.backupInProgress = true;
        });

        try {
          const response = await api.post('/settings/backup', {
            name,
            description,
            settings: {
              userPreferences: get().userPreferences,
              appSettings: get().appSettings,
              featureFlags: get().featureFlags,
            },
          });

          const backup = response.data.data;
          
          set((draft) => {
            draft.availableBackups.unshift(backup);
          });
        } catch (error: any) {
          throw new Error(`Failed to create backup: ${error.message}`);
        } finally {
          set((draft) => {
            draft.backupInProgress = false;
          });
        }
      },

      restoreBackup: async (backupId: string) => {
        set((draft) => {
          draft.restoreInProgress = true;
        });

        try {
          const response = await api.post(`/settings/backup/${backupId}/restore`);
          const settings = response.data.data;

          set((draft) => {
            if (settings.userPreferences) {
              draft.userPreferences = settings.userPreferences;
            }
            if (settings.appSettings) {
              draft.appSettings = settings.appSettings;
            }
            if (settings.featureFlags) {
              draft.featureFlags = settings.featureFlags;
            }
            
            draft.hasUnsavedChanges = true;
          });
        } catch (error: any) {
          throw new Error(`Failed to restore backup: ${error.message}`);
        } finally {
          set((draft) => {
            draft.restoreInProgress = false;
          });
        }
      },

      deleteBackup: async (backupId: string) => {
        try {
          await api.delete(`/settings/backup/${backupId}`);
          
          set((draft) => {
            draft.availableBackups = draft.availableBackups.filter(b => b.id !== backupId);
          });
        } catch (error: any) {
          throw new Error(`Failed to delete backup: ${error.message}`);
        }
      },

      loadBackups: async () => {
        try {
          const response = await api.get('/settings/backups');
          const backups = response.data.data || [];
          
          set((draft) => {
            draft.availableBackups = backups;
          });
        } catch (error: any) {
          console.warn('Failed to load backups:', error.message);
        }
      },

      // =================== IMPORT/EXPORT ===================

      exportSettings: async (sections?: string[], format = 'json') => {
        const { userPreferences, appSettings, featureFlags } = get();
        
        let data: any = {};
        
        if (!sections || sections.includes('userPreferences')) {
          data.userPreferences = userPreferences;
        }
        if (!sections || sections.includes('appSettings')) {
          data.appSettings = appSettings;
        }
        if (!sections || sections.includes('featureFlags')) {
          data.featureFlags = featureFlags;
        }

        let content: string;
        let mimeType: string;

        if (format === 'yaml') {
          // Simple YAML conversion (you might want to use a proper YAML library)
          content = convertToYAML(data);
          mimeType = 'application/x-yaml';
        } else {
          content = JSON.stringify(data, null, 2);
          mimeType = 'application/json';
        }

        return new Blob([content], { type: mimeType });
      },

      importSettings: async (file: File, options: ImportOptions = {}) => {
        set((draft) => {
          draft.importInProgress = true;
          draft.lastError = null;
        });

        try {
          const content = await file.text();
          let data: any;

          if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
            // Parse YAML (you might want to use a proper YAML library)
            data = parseYAML(content);
          } else {
            data = JSON.parse(content);
          }

          const { overwrite = false, sections, mergeStrategy = 'replace' } = options;

          set((draft) => {
            if (!sections || sections.includes('userPreferences')) {
              if (data.userPreferences) {
                if (mergeStrategy === 'merge') {
                  Object.assign(draft.userPreferences, data.userPreferences);
                } else {
                  draft.userPreferences = data.userPreferences;
                }
              }
            }

            if (!sections || sections.includes('appSettings')) {
              if (data.appSettings) {
                if (mergeStrategy === 'merge') {
                  mergeDeep(draft.appSettings, data.appSettings);
                } else {
                  draft.appSettings = data.appSettings;
                }
              }
            }

            if (!sections || sections.includes('featureFlags')) {
              if (data.featureFlags) {
                if (mergeStrategy === 'merge') {
                  Object.assign(draft.featureFlags, data.featureFlags);
                } else {
                  draft.featureFlags = data.featureFlags;
                }
              }
            }

            draft.hasUnsavedChanges = true;
          });
        } catch (error: any) {
          set((draft) => {
            draft.lastError = `Import failed: ${error.message}`;
          });
          throw error;
        } finally {
          set((draft) => {
            draft.importInProgress = false;
          });
        }
      },

      // =================== UTILITY ACTIONS ===================

      resetToDefaults: async () => {
        set((draft) => {
          draft.userPreferences = { ...defaultUserPreferences };
          draft.appSettings = JSON.parse(JSON.stringify(defaultAppSettings));
          draft.featureFlags = { ...defaultFeatureFlags };
          draft.hasUnsavedChanges = true;
        });
      },

      refreshAll: async () => {
        await Promise.all([
          get().loadSettings(),
          get().loadBackups(),
        ]);
      },

      setError: (error: string | null) => {
        set((draft) => {
          draft.lastError = error;
        });
      },

      clearError: () => {
        set((draft) => {
          draft.lastError = null;
        });
      },

      markUnsavedChanges: (hasChanges = true) => {
        set((draft) => {
          draft.hasUnsavedChanges = hasChanges;
        });
      },
    })
  )
);

// =================== HELPER FUNCTIONS ===================

function mergeDeep(target: any, source: any) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      mergeDeep(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

function convertToYAML(obj: any): string {
  // Simple YAML conversion - in a real app, use a proper YAML library
  return JSON.stringify(obj, null, 2)
    .replace(/"/g, '')
    .replace(/,$/gm, '')
    .replace(/{$/gm, '')
    .replace(/}$/gm, '')
    .replace(/\[/g, '- ')
    .replace(/\]/g, '');
}

function parseYAML(yaml: string): any {
  // Simple YAML parsing - in a real app, use a proper YAML library
  try {
    return JSON.parse(yaml);
  } catch {
    throw new Error('Invalid YAML format');
  }
}

// =================== SELECTORS ===================

export const settingsSelectors = {
  userPreferences: (state: SettingsStore) => state.userPreferences,
  appSettings: (state: SettingsStore) => state.appSettings,
  systemSettings: (state: SettingsStore) => state.systemSettings,
  featureFlags: (state: SettingsStore) => state.featureFlags,
  hasUnsavedChanges: (state: SettingsStore) => state.hasUnsavedChanges,
  isLoading: (state: SettingsStore) => state.isLoading,
  isSaving: (state: SettingsStore) => state.isSaving,
  validationErrors: (state: SettingsStore) => state.validationErrors,
  hasValidationErrors: (state: SettingsStore) => Object.keys(state.validationErrors).length > 0,
  activeSection: (state: SettingsStore) => state.activeSection,
  isSectionExpanded: (section: string) => (state: SettingsStore) => state.expandedSections.includes(section),
  webhooks: (state: SettingsStore) => state.appSettings.integrations.webhooks,
  apiKeys: (state: SettingsStore) => state.appSettings.integrations.apiKeys,
  connectedServices: (state: SettingsStore) => state.appSettings.integrations.connectedServices,
  activeServices: (state: SettingsStore) => state.appSettings.integrations.connectedServices.filter(s => s.status === 'connected'),
  isFeatureEnabled: (feature: string) => (state: SettingsStore) => state.featureFlags[feature] || false,
  backups: (state: SettingsStore) => state.availableBackups,
};

// =================== HOOKS FOR SPECIFIC USE CASES ===================

export const useUserPreferences = () => useSettingsStore((state) => ({
  preferences: state.userPreferences,
  update: state.updateUserPreferences,
  save: state.saveUserPreferences,
  reset: state.resetUserPreferences,
}));

export const useAppSettings = () => useSettingsStore((state) => ({
  settings: state.appSettings,
  update: state.updateAppSettings,
  save: state.saveAppSettings,
  reset: state.resetAppSettings,
}));

export const useFeatureFlags = () => useSettingsStore((state) => ({
  flags: state.featureFlags,
  isEnabled: (flag: string) => state.featureFlags[flag] || false,
  toggle: state.toggleFeatureFlag,
  update: state.updateFeatureFlags,
}));

export const useSettingsSections = () => useSettingsStore((state) => ({
  activeSection: state.activeSection,
  expandedSections: state.expandedSections,
  setActive: state.setActiveSection,
  toggle: state.toggleSection,
  expandAll: state.expandAllSections,
  collapseAll: state.collapseAllSections,
}));

export const useWebhooks = () => useSettingsStore((state) => ({
  webhooks: state.appSettings.integrations.webhooks,
  add: state.addWebhook,
  update: state.updateWebhook,
  remove: state.removeWebhook,
  test: state.testWebhook,
}));

export const useApiKeys = () => useSettingsStore((state) => ({
  apiKeys: state.appSettings.integrations.apiKeys,
  generate: state.generateApiKey,
  update: state.updateApiKey,
  revoke: state.revokeApiKey,
}));

export const useConnectedServices = () => useSettingsStore((state) => ({
  services: state.appSettings.integrations.connectedServices,
  activeServices: settingsSelectors.activeServices(state),
  connect: state.connectService,
  disconnect: state.disconnectService,
  sync: state.syncService,
  updateConfig: state.updateServiceConfig,
}));

export const useSettingsBackup = () => useSettingsStore((state) => ({
  backups: state.availableBackups,
  isCreating: state.backupInProgress,
  isRestoring: state.restoreInProgress,
  create: state.createBackup,
  restore: state.restoreBackup,
  delete: state.deleteBackup,
  load: state.loadBackups,
}));

// =================== EXPORT TYPES ===================

export type { SettingsState, SettingsActions, SettingsBackup, ImportOptions };
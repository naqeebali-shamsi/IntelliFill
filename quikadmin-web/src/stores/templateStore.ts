/**
 * Template Store
 *
 * Zustand store for managing template state and operations.
 * Handles template CRUD operations with React Query integration.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Task 296: Helper to conditionally apply devtools only in development mode
const applyDevtools = <T>(middleware: T) => {
  if (import.meta.env.DEV) {
    return devtools(middleware as any, {
      name: 'IntelliFill Template Store',
    }) as T;
  }
  return middleware;
};
import type { MappingTemplate } from '@/types/formFilling';
import * as formService from '@/services/formService';

interface TemplateState {
  /**
   * List of all templates
   */
  templates: MappingTemplate[];

  /**
   * Currently selected template
   */
  currentTemplate: MappingTemplate | null;

  /**
   * Loading state
   */
  isLoading: boolean;

  /**
   * Error state
   */
  error: string | null;
}

interface TemplateActions {
  /**
   * Load all templates from API
   */
  loadTemplates: () => Promise<void>;

  /**
   * Load a specific template by ID
   */
  loadTemplate: (templateId: string) => Promise<void>;

  /**
   * Create a new template
   */
  createTemplate: (
    template: Omit<MappingTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<MappingTemplate>;

  /**
   * Update an existing template
   */
  updateTemplate: (
    templateId: string,
    template: Partial<Omit<MappingTemplate, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<void>;

  /**
   * Delete a template
   */
  deleteTemplate: (templateId: string) => Promise<void>;

  /**
   * Set current template
   */
  setCurrentTemplate: (template: MappingTemplate | null) => void;

  /**
   * Clear error
   */
  clearError: () => void;

  /**
   * Clear all templates
   */
  clearTemplates: () => void;
}

type TemplateStore = TemplateState & TemplateActions;

const initialState: TemplateState = {
  templates: [],
  currentTemplate: null,
  isLoading: false,
  error: null,
};

export const useTemplateStore = create<TemplateStore>()(
  applyDevtools(
    immer((set, get) => ({
      ...initialState,

      loadTemplates: async () => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const templates = await formService.getTemplates();
          set((state) => {
            state.templates = templates;
            state.isLoading = false;
          });
        } catch (error: any) {
          set((state) => {
            state.error = error.message || 'Failed to load templates';
            state.isLoading = false;
          });
        }
      },

      loadTemplate: async (templateId: string) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const template = await formService.getTemplate(templateId);
          set((state) => {
            state.currentTemplate = template;
            // Update in templates list if exists
            const index = state.templates.findIndex((t) => t.id === templateId);
            if (index >= 0) {
              state.templates[index] = template;
            }
            state.isLoading = false;
          });
        } catch (error: any) {
          set((state) => {
            state.error = error.message || 'Failed to load template';
            state.isLoading = false;
          });
        }
      },

      createTemplate: async (template: Omit<MappingTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const created = await formService.createTemplate(template);
          set((state) => {
            state.templates.push(created);
            state.currentTemplate = created;
            state.isLoading = false;
          });
          return created;
        } catch (error: any) {
          set((state) => {
            state.error = error.message || 'Failed to create template';
            state.isLoading = false;
          });
          throw error;
        }
      },

      updateTemplate: async (
        templateId: string,
        template: Partial<Omit<MappingTemplate, 'id' | 'createdAt' | 'updatedAt'>>
      ) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          await formService.updateTemplate(templateId, template);
          set((state) => {
            const index = state.templates.findIndex((t) => t.id === templateId);
            if (index >= 0) {
              state.templates[index] = {
                ...state.templates[index],
                ...template,
                updatedAt: new Date().toISOString(),
              };
            }
            if (state.currentTemplate?.id === templateId) {
              state.currentTemplate = {
                ...state.currentTemplate,
                ...template,
                updatedAt: new Date().toISOString(),
              };
            }
            state.isLoading = false;
          });
        } catch (error: any) {
          set((state) => {
            state.error = error.message || 'Failed to update template';
            state.isLoading = false;
          });
          throw error;
        }
      },

      deleteTemplate: async (templateId: string) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          await formService.deleteTemplate(templateId);
          set((state) => {
            state.templates = state.templates.filter((t) => t.id !== templateId);
            if (state.currentTemplate?.id === templateId) {
              state.currentTemplate = null;
            }
            state.isLoading = false;
          });
        } catch (error: any) {
          set((state) => {
            state.error = error.message || 'Failed to delete template';
            state.isLoading = false;
          });
          throw error;
        }
      },

      setCurrentTemplate: (template: MappingTemplate | null) => {
        set((state) => {
          state.currentTemplate = template;
        });
      },

      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },

      clearTemplates: () => {
        set((state) => {
          state.templates = [];
          state.currentTemplate = null;
          state.error = null;
        });
      },
    }))
  )
);

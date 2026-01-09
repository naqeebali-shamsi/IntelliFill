/**
 * Filled Form Store
 *
 * Zustand store for managing filled forms state.
 * Handles filled form CRUD operations and caching.
 *
 * Task 490: Integrate Form Filling with Filled Forms API
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  filledFormService,
  type FilledForm,
  type GenerateFilledFormRequest,
  type ListFilledFormsParams,
} from '@/services/filledFormService';

// Helper to conditionally apply devtools only in development mode
const applyDevtools = <T>(middleware: T) => {
  if (import.meta.env.DEV) {
    return devtools(middleware as any, {
      name: 'IntelliFill Filled Form Store',
    }) as T;
  }
  return middleware;
};

// =================== STATE TYPES ===================

interface FilledFormState {
  /**
   * List of recent filled forms
   */
  filledForms: FilledForm[];

  /**
   * Currently selected filled form
   */
  currentFilledForm: FilledForm | null;

  /**
   * Pagination info
   */
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };

  /**
   * Loading states
   */
  isLoading: boolean;
  isGenerating: boolean;

  /**
   * Error state
   */
  error: string | null;

  /**
   * Last generation result (for showing success state after form fill)
   */
  lastGeneratedForm: (FilledForm & {
    filledFieldsCount: number;
    unmappedFieldsCount: number;
    warnings: string[];
  }) | null;
}

// =================== ACTION TYPES ===================

interface FilledFormActions {
  /**
   * Load filled forms with optional filtering
   */
  loadFilledForms: (params?: ListFilledFormsParams) => Promise<void>;

  /**
   * Load more filled forms (pagination)
   */
  loadMoreFilledForms: () => Promise<void>;

  /**
   * Generate a new filled form
   */
  generateFilledForm: (request: GenerateFilledFormRequest) => Promise<FilledForm>;

  /**
   * Get a single filled form by ID
   */
  getFilledForm: (id: string) => Promise<FilledForm>;

  /**
   * Download a filled form
   */
  downloadFilledForm: (id: string, filename?: string) => Promise<void>;

  /**
   * Delete a filled form
   */
  deleteFilledForm: (id: string) => Promise<void>;

  /**
   * Regenerate a filled form
   */
  regenerateFilledForm: (id: string) => Promise<void>;

  /**
   * Set current filled form
   */
  setCurrentFilledForm: (form: FilledForm | null) => void;

  /**
   * Clear last generated form
   */
  clearLastGeneratedForm: () => void;

  /**
   * Clear error
   */
  clearError: () => void;

  /**
   * Reset store
   */
  reset: () => void;
}

type FilledFormStore = FilledFormState & FilledFormActions;

// =================== INITIAL STATE ===================

const initialState: FilledFormState = {
  filledForms: [],
  currentFilledForm: null,
  pagination: {
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false,
  },
  isLoading: false,
  isGenerating: false,
  error: null,
  lastGeneratedForm: null,
};

// =================== STORE ===================

export const useFilledFormStore = create<FilledFormStore>()(
  applyDevtools(
    immer((set, get) => ({
      ...initialState,

      loadFilledForms: async (params?: ListFilledFormsParams) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const response = await filledFormService.list(params);
          set((state) => {
            state.filledForms = response.data.filledForms;
            state.pagination = response.data.pagination;
            state.isLoading = false;
          });
        } catch (error: any) {
          set((state) => {
            state.error = error.message || 'Failed to load filled forms';
            state.isLoading = false;
          });
        }
      },

      loadMoreFilledForms: async () => {
        const { pagination, filledForms } = get();
        if (!pagination.hasMore || get().isLoading) return;

        set((state) => {
          state.isLoading = true;
        });

        try {
          const response = await filledFormService.list({
            limit: pagination.limit,
            offset: pagination.offset + pagination.limit,
          });
          set((state) => {
            state.filledForms = [...filledForms, ...response.data.filledForms];
            state.pagination = response.data.pagination;
            state.isLoading = false;
          });
        } catch (error: any) {
          set((state) => {
            state.error = error.message || 'Failed to load more forms';
            state.isLoading = false;
          });
        }
      },

      generateFilledForm: async (request: GenerateFilledFormRequest) => {
        set((state) => {
          state.isGenerating = true;
          state.error = null;
          state.lastGeneratedForm = null;
        });

        try {
          const response = await filledFormService.generate(request);
          const filledForm = response.data.filledForm;

          set((state) => {
            // Add to beginning of list
            state.filledForms.unshift({
              id: filledForm.id,
              clientId: filledForm.clientId,
              clientName: filledForm.clientName,
              templateId: filledForm.templateId,
              templateName: filledForm.templateName,
              fileUrl: filledForm.fileUrl,
              downloadUrl: filledForm.downloadUrl,
              createdAt: filledForm.createdAt,
            });
            state.lastGeneratedForm = filledForm;
            state.pagination.total += 1;
            state.isGenerating = false;
          });

          return filledForm;
        } catch (error: any) {
          set((state) => {
            state.error = error.response?.data?.error || error.message || 'Failed to generate form';
            state.isGenerating = false;
          });
          throw error;
        }
      },

      getFilledForm: async (id: string) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const response = await filledFormService.get(id);
          const filledForm = response.data.filledForm;

          set((state) => {
            state.currentFilledForm = filledForm;
            state.isLoading = false;
          });

          return filledForm;
        } catch (error: any) {
          set((state) => {
            state.error = error.message || 'Failed to load form';
            state.isLoading = false;
          });
          throw error;
        }
      },

      downloadFilledForm: async (id: string, filename?: string) => {
        try {
          await filledFormService.triggerDownload(id, filename);
        } catch (error: any) {
          set((state) => {
            state.error = error.message || 'Failed to download form';
          });
          throw error;
        }
      },

      deleteFilledForm: async (id: string) => {
        try {
          await filledFormService.delete(id);
          set((state) => {
            state.filledForms = state.filledForms.filter((f) => f.id !== id);
            if (state.currentFilledForm?.id === id) {
              state.currentFilledForm = null;
            }
            state.pagination.total = Math.max(0, state.pagination.total - 1);
          });
        } catch (error: any) {
          set((state) => {
            state.error = error.message || 'Failed to delete form';
          });
          throw error;
        }
      },

      regenerateFilledForm: async (id: string) => {
        set((state) => {
          state.isGenerating = true;
          state.error = null;
        });

        try {
          const response = await filledFormService.regenerate(id);
          const updatedForm = response.data.filledForm;

          set((state) => {
            // Update in list
            const index = state.filledForms.findIndex((f) => f.id === id);
            if (index >= 0) {
              state.filledForms[index] = {
                ...state.filledForms[index],
                fileUrl: updatedForm.fileUrl,
                downloadUrl: updatedForm.downloadUrl,
                createdAt: updatedForm.createdAt,
              };
            }
            // Update current if viewing
            if (state.currentFilledForm?.id === id) {
              state.currentFilledForm = {
                ...state.currentFilledForm,
                fileUrl: updatedForm.fileUrl,
                downloadUrl: updatedForm.downloadUrl,
                createdAt: updatedForm.createdAt,
              };
            }
            state.isGenerating = false;
          });
        } catch (error: any) {
          set((state) => {
            state.error = error.message || 'Failed to regenerate form';
            state.isGenerating = false;
          });
          throw error;
        }
      },

      setCurrentFilledForm: (form: FilledForm | null) => {
        set((state) => {
          state.currentFilledForm = form;
        });
      },

      clearLastGeneratedForm: () => {
        set((state) => {
          state.lastGeneratedForm = null;
        });
      },

      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },

      reset: () => {
        set(initialState);
      },
    }))
  )
);

/**
 * Form Analytics Store
 *
 * Zustand store for managing form analytics state including
 * overview stats, usage trends, and template-specific analytics.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { applyDevtools } from './utils/index.js';
import {
  formAnalyticsService,
  type FormAnalyticsOverview,
  type UsageTrends,
  type TemplateAnalytics,
} from '@/services/formAnalyticsService';

// =================== STORE STATE ===================

interface FormAnalyticsState {
  // Data
  overview: FormAnalyticsOverview | null;
  trends: UsageTrends | null;
  selectedTemplate: TemplateAnalytics | null;

  // Loading states
  loading: boolean;
  trendsLoading: boolean;
  templateLoading: boolean;

  // Errors
  error: string | null;
}

interface FormAnalyticsActions {
  // Data fetching
  fetchOverview: () => Promise<void>;
  fetchTrends: () => Promise<void>;
  selectTemplate: (templateId: string) => Promise<void>;
  clearSelectedTemplate: () => void;

  // Reset
  reset: () => void;
}

type FormAnalyticsStore = FormAnalyticsState & FormAnalyticsActions;

// =================== INITIAL STATE ===================

const initialState: FormAnalyticsState = {
  overview: null,
  trends: null,
  selectedTemplate: null,
  loading: false,
  trendsLoading: false,
  templateLoading: false,
  error: null,
};

// =================== STORE IMPLEMENTATION ===================

export const useFormAnalyticsStore = create<FormAnalyticsStore>()(
  applyDevtools(
    immer((set, get) => ({
      ...initialState,

      // =================== DATA FETCHING ===================

      fetchOverview: async () => {
        set((state) => {
          state.loading = true;
          state.error = null;
        });

        try {
          const overview = await formAnalyticsService.getOverview();
          set((state) => {
            state.overview = overview;
            state.loading = false;
          });
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : 'Failed to fetch analytics overview';
          set((state) => {
            state.error = message;
            state.loading = false;
          });
        }
      },

      fetchTrends: async () => {
        set((state) => {
          state.trendsLoading = true;
          state.error = null;
        });

        try {
          const trends = await formAnalyticsService.getTrends();
          set((state) => {
            state.trends = trends;
            state.trendsLoading = false;
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Failed to fetch usage trends';
          set((state) => {
            state.error = message;
            state.trendsLoading = false;
          });
        }
      },

      selectTemplate: async (templateId: string) => {
        set((state) => {
          state.templateLoading = true;
          state.error = null;
        });

        try {
          const template = await formAnalyticsService.getTemplateAnalytics(templateId);
          set((state) => {
            state.selectedTemplate = template;
            state.templateLoading = false;
          });
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : 'Failed to fetch template analytics';
          set((state) => {
            state.error = message;
            state.templateLoading = false;
          });
        }
      },

      clearSelectedTemplate: () => {
        set((state) => {
          state.selectedTemplate = null;
        });
      },

      // =================== RESET ===================

      reset: () => {
        set(initialState);
      },
    })),
    'IntelliFill Form Analytics Store'
  )
);

// =================== SELECTORS ===================

export const formAnalyticsSelectors = {
  overview: (state: FormAnalyticsStore) => state.overview,
  trends: (state: FormAnalyticsStore) => state.trends,
  selectedTemplate: (state: FormAnalyticsStore) => state.selectedTemplate,
  loading: (state: FormAnalyticsStore) => state.loading,
  trendsLoading: (state: FormAnalyticsStore) => state.trendsLoading,
  templateLoading: (state: FormAnalyticsStore) => state.templateLoading,
  error: (state: FormAnalyticsStore) => state.error,
};

// =================== DERIVED SELECTORS ===================

/**
 * Selector for checking if any data is currently loading
 */
export const selectIsAnyLoading = (state: FormAnalyticsStore) =>
  state.loading || state.trendsLoading || state.templateLoading;

/**
 * Selector for checking if we have overview data
 */
export const selectHasOverview = (state: FormAnalyticsStore) => state.overview !== null;

/**
 * Selector for checking if we have trends data
 */
export const selectHasTrends = (state: FormAnalyticsStore) => state.trends !== null;

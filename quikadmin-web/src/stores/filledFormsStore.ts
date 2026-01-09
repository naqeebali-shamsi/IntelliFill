/**
 * Filled Forms Store
 *
 * Zustand store for managing filled forms history page state including
 * filters, sorting, pagination, and selection.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import * as React from 'react';

import {
  applyDevtools,
  createSelectionSlice,
  createPaginationSlice,
  type PaginationActions,
} from './utils/index.js';

// =================== TYPES ===================

export type FilledFormStatus = 'all' | 'draft' | 'completed' | 'submitted';
export type FilledFormSortField = 'createdAt' | 'templateName' | 'clientName';
export type FilledFormSortDirection = 'asc' | 'desc';

export interface FilledFormFilter {
  status: FilledFormStatus;
  templateId: string | null;
  clientId: string | null;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  searchQuery: string;
}

export interface FilledFormSort {
  field: FilledFormSortField;
  direction: FilledFormSortDirection;
}

// =================== STORE STATE ===================

interface FilledFormsState {
  // Filter state
  filter: FilledFormFilter;

  // Sort state
  sort: FilledFormSort;

  // Pagination
  page: number;
  pageSize: number;

  // Selection for bulk operations
  selectedIds: Set<string>;

  // View mode
  viewMode: 'table' | 'grid';
}

/**
 * Filled forms selection actions (aliased from SelectionActions)
 */
interface FilledFormsSelectionActions {
  selectForm: (id: string) => void;
  deselectForm: (id: string) => void;
  toggleForm: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  getSelectionCount: () => number;
}

/**
 * Filled forms specific actions beyond selection and pagination
 */
interface FilledFormsSpecificActions {
  // Filter actions
  setFilter: (filter: Partial<FilledFormFilter>) => void;
  clearFilter: () => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (status: FilledFormStatus) => void;
  setTemplateFilter: (templateId: string | null) => void;
  setClientFilter: (clientId: string | null) => void;
  setDateRange: (start: Date | null, end: Date | null) => void;
  hasActiveFilters: () => boolean;

  // Sort actions
  setSort: (sort: FilledFormSort) => void;
  toggleSortDirection: () => void;

  // View mode
  setViewMode: (mode: 'table' | 'grid') => void;

  // Reset
  reset: () => void;
}

type FilledFormsActions = FilledFormsSelectionActions &
  PaginationActions &
  FilledFormsSpecificActions;

type FilledFormsStore = FilledFormsState & FilledFormsActions;

// =================== INITIAL STATE ===================

const initialState: FilledFormsState = {
  filter: {
    status: 'all',
    templateId: null,
    clientId: null,
    dateRange: { start: null, end: null },
    searchQuery: '',
  },
  sort: {
    field: 'createdAt',
    direction: 'desc',
  },
  page: 1,
  pageSize: 20,
  selectedIds: new Set(),
  viewMode: 'table',
};

// =================== STORE IMPLEMENTATION ===================

export const useFilledFormsStore = create<FilledFormsStore>()(
  applyDevtools(
    persist(
      immer((set, get) => {
        // Create shared slices
        const selectionSlice = createSelectionSlice<FilledFormsState>(set, get);
        const paginationSlice = createPaginationSlice<FilledFormsState>(set, {
          clearSelectionOnPageChange: true,
        });

        return {
          ...initialState,

          // =================== SELECTION (aliased from utility) ===================
          selectForm: selectionSlice.selectItem,
          deselectForm: selectionSlice.deselectItem,
          toggleForm: selectionSlice.toggleItem,
          selectAll: selectionSlice.selectAll,
          clearSelection: selectionSlice.clearSelection,
          isSelected: selectionSlice.isSelected,
          getSelectionCount: selectionSlice.getSelectionCount,

          // =================== PAGINATION (from utility) ===================
          ...paginationSlice,

          // =================== FILTER ACTIONS ===================

          setFilter: (filter: Partial<FilledFormFilter>) => {
            set((state) => {
              state.filter = { ...state.filter, ...filter };
              state.page = 1;
            });
          },

          clearFilter: () => {
            set((state) => {
              state.filter = initialState.filter;
              state.page = 1;
            });
          },

          setSearchQuery: (query: string) => {
            set((state) => {
              state.filter.searchQuery = query;
              state.page = 1;
            });
          },

          setStatusFilter: (status: FilledFormStatus) => {
            set((state) => {
              state.filter.status = status;
              state.page = 1;
            });
          },

          setTemplateFilter: (templateId: string | null) => {
            set((state) => {
              state.filter.templateId = templateId;
              state.page = 1;
            });
          },

          setClientFilter: (clientId: string | null) => {
            set((state) => {
              state.filter.clientId = clientId;
              state.page = 1;
            });
          },

          setDateRange: (start: Date | null, end: Date | null) => {
            set((state) => {
              state.filter.dateRange = { start, end };
              state.page = 1;
            });
          },

          hasActiveFilters: () => {
            const { filter } = get();
            return !!(
              filter.status !== 'all' ||
              filter.templateId ||
              filter.clientId ||
              filter.searchQuery ||
              filter.dateRange.start ||
              filter.dateRange.end
            );
          },

          // =================== SORT ACTIONS ===================

          setSort: (sort: FilledFormSort) => {
            set((state) => {
              state.sort = sort;
            });
          },

          toggleSortDirection: () => {
            set((state) => {
              state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
            });
          },

          // =================== VIEW MODE ===================

          setViewMode: (mode: 'table' | 'grid') => {
            set((state) => {
              state.viewMode = mode;
            });
          },

          // =================== RESET ===================

          reset: () => {
            set(initialState);
          },
        };
      }),
      {
        name: 'filled-forms-storage',
        // Only persist view mode and page size (user preferences)
        partialize: (state) => ({
          viewMode: state.viewMode,
          pageSize: state.pageSize,
        }),
      }
    ),
    'IntelliFill Filled Forms Store'
  )
);

// =================== SELECTORS ===================

export const filledFormsSelectors = {
  filter: (state: FilledFormsStore) => state.filter,
  sort: (state: FilledFormsStore) => state.sort,
  page: (state: FilledFormsStore) => state.page,
  pageSize: (state: FilledFormsStore) => state.pageSize,
  selectedIds: (state: FilledFormsStore) => state.selectedIds,
  selectedIdsArray: (state: FilledFormsStore) => Array.from(state.selectedIds),
  selectionCount: (state: FilledFormsStore) => state.selectedIds.size,
  hasSelection: (state: FilledFormsStore) => state.selectedIds.size > 0,
  viewMode: (state: FilledFormsStore) => state.viewMode,
  hasActiveFilters: (state: FilledFormsStore) => state.hasActiveFilters(),
};

// =================== HOOKS ===================

/**
 * Hook for filled forms filter management
 */
export const useFilledFormsFilters = () => {
  const filter = useFilledFormsStore((state) => state.filter);
  const setFilter = useFilledFormsStore((state) => state.setFilter);
  const clearFilter = useFilledFormsStore((state) => state.clearFilter);
  const setSearchQuery = useFilledFormsStore((state) => state.setSearchQuery);
  const setStatusFilter = useFilledFormsStore((state) => state.setStatusFilter);
  const setTemplateFilter = useFilledFormsStore((state) => state.setTemplateFilter);
  const setClientFilter = useFilledFormsStore((state) => state.setClientFilter);
  const setDateRange = useFilledFormsStore((state) => state.setDateRange);
  const hasActiveFilters = useFilledFormsStore((state) => state.hasActiveFilters());

  return React.useMemo(
    () => ({
      filter,
      setFilter,
      clearFilter,
      setSearchQuery,
      setStatusFilter,
      setTemplateFilter,
      setClientFilter,
      setDateRange,
      hasActiveFilters,
    }),
    [
      filter,
      setFilter,
      clearFilter,
      setSearchQuery,
      setStatusFilter,
      setTemplateFilter,
      setClientFilter,
      setDateRange,
      hasActiveFilters,
    ]
  );
};

/**
 * Hook for filled forms pagination management
 */
export const useFilledFormsPagination = () => {
  const page = useFilledFormsStore((state) => state.page);
  const pageSize = useFilledFormsStore((state) => state.pageSize);
  const setPage = useFilledFormsStore((state) => state.setPage);
  const setPageSize = useFilledFormsStore((state) => state.setPageSize);
  const nextPage = useFilledFormsStore((state) => state.nextPage);
  const previousPage = useFilledFormsStore((state) => state.previousPage);
  const resetPage = useFilledFormsStore((state) => state.resetPage);

  return React.useMemo(
    () => ({
      page,
      pageSize,
      setPage,
      setPageSize,
      nextPage,
      previousPage,
      resetPage,
    }),
    [page, pageSize, setPage, setPageSize, nextPage, previousPage, resetPage]
  );
};

/**
 * Hook for filled forms selection management
 */
export const useFilledFormsSelection = () => {
  const selectionCount = useFilledFormsStore((state) => state.selectedIds.size);
  const selectForm = useFilledFormsStore((state) => state.selectForm);
  const deselectForm = useFilledFormsStore((state) => state.deselectForm);
  const toggleForm = useFilledFormsStore((state) => state.toggleForm);
  const selectAll = useFilledFormsStore((state) => state.selectAll);
  const clearSelection = useFilledFormsStore((state) => state.clearSelection);
  const isSelected = useFilledFormsStore((state) => state.isSelected);

  const selectedIds = React.useMemo(() => {
    const ids = useFilledFormsStore.getState().selectedIds;
    return Array.from(ids);
  }, [selectionCount]);

  return React.useMemo(
    () => ({
      selectedIds,
      selectionCount,
      selectForm,
      deselectForm,
      toggleForm,
      selectAll,
      clearSelection,
      isSelected,
    }),
    [
      selectedIds,
      selectionCount,
      selectForm,
      deselectForm,
      toggleForm,
      selectAll,
      clearSelection,
      isSelected,
    ]
  );
};

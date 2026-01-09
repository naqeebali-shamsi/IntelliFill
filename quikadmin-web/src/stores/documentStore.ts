/**
 * Document library state management with Zustand
 * Manages UI state for document library (selection, filters, view mode, etc.)
 * Server state (documents, statistics) is managed by React Query
 * @module stores/documentStore
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import * as React from 'react';

import {
  applyDevtools,
  createSelectionSlice,
  createPaginationSlice,
  type SelectionActions,
  type PaginationActions,
} from './utils/index.js';
import type {
  DocumentFilter,
  DocumentSort,
  DocumentViewMode,
  DateRangePreset,
} from '@/types/document';

// =================== STORE INTERFACES ===================

interface DocumentState {
  /**
   * Selected document IDs for bulk operations
   */
  selectedIds: Set<string>;

  /**
   * View mode (grid or table)
   */
  viewMode: DocumentViewMode;

  /**
   * Active filters
   */
  filter: DocumentFilter;

  /**
   * Sort configuration
   */
  sort: DocumentSort;

  /**
   * Current page number
   */
  page: number;

  /**
   * Page size (documents per page)
   */
  pageSize: number;

  /**
   * Date range preset
   */
  dateRangePreset: DateRangePreset;

  /**
   * Search query debounced value
   */
  debouncedSearch: string;
}

/**
 * Document-specific selection actions (aliased from SelectionActions)
 */
interface DocumentSelectionActions {
  selectDocument: (id: string) => void;
  deselectDocument: (id: string) => void;
  toggleDocument: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  getSelectionCount: () => number;
}

/**
 * Document-specific actions beyond selection and pagination
 */
interface DocumentSpecificActions {
  // View mode
  setViewMode: (mode: DocumentViewMode) => void;
  toggleViewMode: () => void;

  // Filters
  setFilter: (filter: Partial<DocumentFilter>) => void;
  clearFilter: () => void;
  setSearchQuery: (query: string) => void;
  setDateRangePreset: (preset: DateRangePreset) => void;
  applyDateRangePreset: (preset: DateRangePreset) => void;
  hasActiveFilters: () => boolean;

  // Sorting
  setSort: (sort: DocumentSort) => void;
  toggleSortDirection: () => void;

  // Reset
  reset: () => void;
}

type DocumentActions = DocumentSelectionActions & PaginationActions & DocumentSpecificActions;

type DocumentStore = DocumentState & DocumentActions;

// =================== INITIAL STATE ===================

const initialState: DocumentState = {
  selectedIds: new Set(),
  viewMode: 'grid',
  filter: {
    status: undefined,
    fileType: undefined,
    dateRange: { start: null, end: null },
    searchQuery: '',
    tags: undefined,
    minConfidence: undefined,
  },
  sort: {
    field: 'createdAt',
    direction: 'desc',
  },
  page: 1,
  pageSize: 25,
  dateRangePreset: 'all',
  debouncedSearch: '',
};

// =================== HELPER FUNCTIONS ===================

/**
 * Calculate date range from preset
 */
function getDateRangeFromPreset(preset: DateRangePreset): { start: Date | null; end: Date | null } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today':
      return { start: today, end: now };

    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { start: weekAgo, end: now };
    }

    case 'month': {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return { start: monthAgo, end: now };
    }

    case 'year': {
      const yearAgo = new Date(today);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      return { start: yearAgo, end: now };
    }

    case 'all':
    case 'custom':
    default:
      return { start: null, end: null };
  }
}

// =================== STORE IMPLEMENTATION ===================

export const useDocumentStore = create<DocumentStore>()(
  applyDevtools(
    persist(
      immer((set, get) => {
        // Create shared slices
        const selectionSlice = createSelectionSlice<DocumentState>(set, get);
        const paginationSlice = createPaginationSlice<DocumentState>(set, {
          clearSelectionOnPageChange: true,
        });

        return {
          ...initialState,

          // =================== SELECTION (aliased from utility) ===================
          selectDocument: selectionSlice.selectItem,
          deselectDocument: selectionSlice.deselectItem,
          toggleDocument: selectionSlice.toggleItem,
          selectAll: selectionSlice.selectAll,
          clearSelection: selectionSlice.clearSelection,
          isSelected: selectionSlice.isSelected,
          getSelectionCount: selectionSlice.getSelectionCount,

          // =================== PAGINATION (from utility) ===================
          ...paginationSlice,

          // =================== VIEW MODE ===================

          setViewMode: (mode: DocumentViewMode) => {
            set((state) => {
              state.viewMode = mode;
            });
          },

          toggleViewMode: () => {
            set((state) => {
              state.viewMode = state.viewMode === 'grid' ? 'table' : 'grid';
            });
          },

          // =================== FILTERS ===================

          setFilter: (filter: Partial<DocumentFilter>) => {
            set((state) => {
              state.filter = { ...state.filter, ...filter };
              state.page = 1;
            });
          },

          clearFilter: () => {
            set((state) => {
              state.filter = initialState.filter;
              state.dateRangePreset = 'all';
              state.page = 1;
            });
          },

          setSearchQuery: (query: string) => {
            set((state) => {
              state.filter.searchQuery = query;
              state.page = 1;
            });
          },

          setDateRangePreset: (preset: DateRangePreset) => {
            set((state) => {
              state.dateRangePreset = preset;
            });
          },

          applyDateRangePreset: (preset: DateRangePreset) => {
            set((state) => {
              state.dateRangePreset = preset;
              const dateRange = getDateRangeFromPreset(preset);
              state.filter.dateRange = dateRange;
              state.page = 1;
            });
          },

          hasActiveFilters: () => {
            const { filter, dateRangePreset } = get();
            return !!(
              filter.status?.length ||
              filter.fileType?.length ||
              filter.searchQuery ||
              filter.tags?.length ||
              filter.minConfidence ||
              dateRangePreset !== 'all'
            );
          },

          // =================== SORTING ===================

          setSort: (sort: DocumentSort) => {
            set((state) => {
              state.sort = sort;
            });
          },

          toggleSortDirection: () => {
            set((state) => {
              state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
            });
          },

          // =================== RESET ===================

          reset: () => {
            set(initialState);
          },
        };
      }),
      {
        name: 'document-library-storage',
        // Only persist view mode and page size (user preferences)
        partialize: (state) => ({
          viewMode: state.viewMode,
          pageSize: state.pageSize,
        }),
      }
    ),
    'IntelliFill Document Store'
  )
);

// =================== SELECTORS ===================

/**
 * Reusable selectors for the document store
 */
export const documentSelectors = {
  selectedIds: (state: DocumentStore) => state.selectedIds,
  selectedIdsArray: (state: DocumentStore) => Array.from(state.selectedIds),
  selectionCount: (state: DocumentStore) => state.selectedIds.size,
  hasSelection: (state: DocumentStore) => state.selectedIds.size > 0,
  viewMode: (state: DocumentStore) => state.viewMode,
  filter: (state: DocumentStore) => state.filter,
  sort: (state: DocumentStore) => state.sort,
  page: (state: DocumentStore) => state.page,
  pageSize: (state: DocumentStore) => state.pageSize,
  hasActiveFilters: (state: DocumentStore) => state.hasActiveFilters(),
  dateRangePreset: (state: DocumentStore) => state.dateRangePreset,
};

// =================== HOOKS ===================

/**
 * Hook for document selection management
 * Returns individual values to prevent unnecessary re-renders
 */
export const useDocumentSelection = () => {
  // Subscribe only to the size to determine count, not the entire set
  const selectionCount = useDocumentStore((state) => state.selectedIds.size);

  // Functions are stable references, so they won't cause re-renders
  const selectDocument = useDocumentStore((state) => state.selectDocument);
  const deselectDocument = useDocumentStore((state) => state.deselectDocument);
  const toggleDocument = useDocumentStore((state) => state.toggleDocument);
  const selectAll = useDocumentStore((state) => state.selectAll);
  const clearSelection = useDocumentStore((state) => state.clearSelection);
  const isSelected = useDocumentStore((state) => state.isSelected);

  // Get selectedIds array but use React.useMemo to stabilize the reference
  const selectedIds = React.useMemo(() => {
    const ids = useDocumentStore.getState().selectedIds;
    return Array.from(ids);
  }, [selectionCount]); // Only recompute when count changes

  // Return stable object using useMemo
  return React.useMemo(
    () => ({
      selectedIds,
      selectionCount,
      selectDocument,
      deselectDocument,
      toggleDocument,
      selectAll,
      clearSelection,
      isSelected,
    }),
    [
      selectedIds,
      selectionCount,
      selectDocument,
      deselectDocument,
      toggleDocument,
      selectAll,
      clearSelection,
      isSelected,
    ]
  );
};

/**
 * Hook for view mode management
 */
export const useDocumentViewMode = () => {
  const viewMode = useDocumentStore((state) => state.viewMode);
  const setViewMode = useDocumentStore((state) => state.setViewMode);
  const toggleViewMode = useDocumentStore((state) => state.toggleViewMode);

  return React.useMemo(
    () => ({ viewMode, setViewMode, toggleViewMode }),
    [viewMode, setViewMode, toggleViewMode]
  );
};

/**
 * Hook for filter management
 */
export const useDocumentFilters = () => {
  const filter = useDocumentStore((state) => state.filter);
  const setFilter = useDocumentStore((state) => state.setFilter);
  const clearFilter = useDocumentStore((state) => state.clearFilter);
  const setSearchQuery = useDocumentStore((state) => state.setSearchQuery);
  const hasActiveFilters = useDocumentStore((state) => state.hasActiveFilters());
  const dateRangePreset = useDocumentStore((state) => state.dateRangePreset);
  const setDateRangePreset = useDocumentStore((state) => state.setDateRangePreset);
  const applyDateRangePreset = useDocumentStore((state) => state.applyDateRangePreset);

  return React.useMemo(
    () => ({
      filter,
      setFilter,
      clearFilter,
      setSearchQuery,
      hasActiveFilters,
      dateRangePreset,
      setDateRangePreset,
      applyDateRangePreset,
    }),
    [
      filter,
      setFilter,
      clearFilter,
      setSearchQuery,
      hasActiveFilters,
      dateRangePreset,
      setDateRangePreset,
      applyDateRangePreset,
    ]
  );
};

/**
 * Hook for sort management
 */
export const useDocumentSort = () => {
  const sort = useDocumentStore((state) => state.sort);
  const setSort = useDocumentStore((state) => state.setSort);
  const toggleSortDirection = useDocumentStore((state) => state.toggleSortDirection);

  return React.useMemo(
    () => ({ sort, setSort, toggleSortDirection }),
    [sort, setSort, toggleSortDirection]
  );
};

/**
 * Hook for pagination management
 */
export const useDocumentPagination = () => {
  const page = useDocumentStore((state) => state.page);
  const pageSize = useDocumentStore((state) => state.pageSize);
  const setPage = useDocumentStore((state) => state.setPage);
  const nextPage = useDocumentStore((state) => state.nextPage);
  const previousPage = useDocumentStore((state) => state.previousPage);
  const setPageSize = useDocumentStore((state) => state.setPageSize);
  const resetPage = useDocumentStore((state) => state.resetPage);

  return React.useMemo(
    () => ({
      page,
      pageSize,
      setPage,
      nextPage,
      previousPage,
      setPageSize,
      resetPage,
    }),
    [page, pageSize, setPage, nextPage, previousPage, setPageSize, resetPage]
  );
};

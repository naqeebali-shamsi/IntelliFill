/**
 * Document library state management with Zustand
 * Manages UI state for document library (selection, filters, view mode, etc.)
 * Server state (documents, statistics) is managed by React Query
 * @module stores/documentStore
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { DocumentFilter, DocumentSort, DocumentViewMode, DateRangePreset } from '@/types/document';

// Import React for useMemo
import * as React from 'react';

// Task 296: Helper to conditionally apply devtools only in development mode
const applyDevtools = <T>(middleware: T) => {
  if (import.meta.env.DEV) {
    return devtools(middleware as any, {
      name: 'IntelliFill Document Store',
    }) as T;
  }
  return middleware;
};

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

interface DocumentActions {
  // =================== SELECTION ===================

  /**
   * Select a document
   */
  selectDocument: (id: string) => void;

  /**
   * Deselect a document
   */
  deselectDocument: (id: string) => void;

  /**
   * Toggle document selection
   */
  toggleDocument: (id: string) => void;

  /**
   * Select all documents (pass visible document IDs)
   */
  selectAll: (ids: string[]) => void;

  /**
   * Clear all selections
   */
  clearSelection: () => void;

  /**
   * Check if document is selected
   */
  isSelected: (id: string) => boolean;

  /**
   * Get selection count
   */
  getSelectionCount: () => number;

  // =================== VIEW MODE ===================

  /**
   * Set view mode (grid or table)
   */
  setViewMode: (mode: DocumentViewMode) => void;

  /**
   * Toggle view mode
   */
  toggleViewMode: () => void;

  // =================== FILTERS ===================

  /**
   * Update filter (partial update)
   */
  setFilter: (filter: Partial<DocumentFilter>) => void;

  /**
   * Clear all filters
   */
  clearFilter: () => void;

  /**
   * Set search query
   */
  setSearchQuery: (query: string) => void;

  /**
   * Set date range preset
   */
  setDateRangePreset: (preset: DateRangePreset) => void;

  /**
   * Apply date range preset to filter
   */
  applyDateRangePreset: (preset: DateRangePreset) => void;

  /**
   * Check if any filters are active
   */
  hasActiveFilters: () => boolean;

  // =================== SORTING ===================

  /**
   * Set sort configuration
   */
  setSort: (sort: DocumentSort) => void;

  /**
   * Toggle sort direction
   */
  toggleSortDirection: () => void;

  // =================== PAGINATION ===================

  /**
   * Set current page
   */
  setPage: (page: number) => void;

  /**
   * Next page
   */
  nextPage: () => void;

  /**
   * Previous page
   */
  previousPage: () => void;

  /**
   * Set page size
   */
  setPageSize: (size: number) => void;

  /**
   * Reset to first page
   */
  resetPage: () => void;

  // =================== RESET ===================

  /**
   * Reset all state to defaults
   */
  reset: () => void;
}

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
      immer((set, get) => ({
        ...initialState,

        // =================== SELECTION ===================

        selectDocument: (id: string) => {
          set((state) => {
            state.selectedIds.add(id);
          });
        },

        deselectDocument: (id: string) => {
          set((state) => {
            state.selectedIds.delete(id);
          });
        },

        toggleDocument: (id: string) => {
          set((state) => {
            if (state.selectedIds.has(id)) {
              state.selectedIds.delete(id);
            } else {
              state.selectedIds.add(id);
            }
          });
        },

        selectAll: (ids: string[]) => {
          set((state) => {
            state.selectedIds = new Set(ids);
          });
        },

        clearSelection: () => {
          set((state) => {
            state.selectedIds.clear();
          });
        },

        isSelected: (id: string) => {
          return get().selectedIds.has(id);
        },

        getSelectionCount: () => {
          return get().selectedIds.size;
        },

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
            // Reset to first page when filter changes
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
            state.page = 1; // Reset to first page on search
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

        // =================== PAGINATION ===================

        setPage: (page: number) => {
          set((state) => {
            state.page = Math.max(1, page);
            // Clear selection when changing page
            state.selectedIds.clear();
          });
        },

        nextPage: () => {
          set((state) => {
            state.page += 1;
            state.selectedIds.clear();
          });
        },

        previousPage: () => {
          set((state) => {
            state.page = Math.max(1, state.page - 1);
            state.selectedIds.clear();
          });
        },

        setPageSize: (size: number) => {
          set((state) => {
            state.pageSize = Math.max(10, Math.min(100, size));
            state.page = 1; // Reset to first page when page size changes
            state.selectedIds.clear();
          });
        },

        resetPage: () => {
          set((state) => {
            state.page = 1;
          });
        },

        // =================== RESET ===================

        reset: () => {
          set(initialState);
        },
      })),
      {
        name: 'document-library-storage',
        // Only persist view mode and page size (user preferences)
        partialize: (state) => ({
          viewMode: state.viewMode,
          pageSize: state.pageSize,
        }),
      }
    )
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

/**
 * Pagination utilities for Zustand stores
 *
 * Provides reusable pagination state and actions for immer-based stores.
 * Replaces ~25 lines of duplicate pagination logic across multiple stores.
 *
 * @module stores/utils/pagination
 */

import type { Draft } from 'immer';

// ============================================================================
// Types
// ============================================================================

/**
 * Core pagination state
 */
export interface PaginationState {
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  pageSize: number;
}

/**
 * Pagination actions for store integration
 */
export interface PaginationActions {
  /** Set current page with bounds checking */
  setPage: (page: number) => void;
  /** Set page size with min/max bounds, optionally resets page */
  setPageSize: (size: number) => void;
  /** Go to next page */
  nextPage: () => void;
  /** Go to previous page with bounds checking */
  previousPage: () => void;
  /** Reset to first page */
  resetPage: () => void;
}

/**
 * Configuration options for pagination behavior
 */
export interface PaginationOptions {
  /** Minimum allowed page size (default: 10) */
  minPageSize?: number;
  /** Maximum allowed page size (default: 100) */
  maxPageSize?: number;
  /** Clear selection when page changes (default: false) */
  clearSelectionOnPageChange?: boolean;
  /** Reset to page 1 when page size changes (default: true) */
  resetPageOnSizeChange?: boolean;
}

/**
 * State shape required for stores that use pagination with selection clearing
 */
export interface StateWithSelection extends PaginationState {
  selectedIds: Set<string>;
}

/**
 * Resolved options with defaults applied
 */
interface ResolvedOptions {
  minPageSize: number;
  maxPageSize: number;
  clearSelectionOnPageChange: boolean;
  resetPageOnSizeChange: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: ResolvedOptions = {
  minPageSize: 10,
  maxPageSize: 100,
  clearSelectionOnPageChange: false,
  resetPageOnSizeChange: true,
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates pagination actions for an immer-based Zustand store.
 *
 * @param set - The Zustand set function (immer-wrapped)
 * @param options - Configuration options for pagination behavior
 * @returns Object containing pagination action functions
 *
 * @example
 * ```typescript
 * // In a store with selection clearing:
 * const actions = createPaginationSlice<StateWithSelection>(set, {
 *   clearSelectionOnPageChange: true,
 * });
 *
 * // In a store without selection:
 * const actions = createPaginationSlice<PaginationState>(set);
 * ```
 */
export function createPaginationSlice<T extends PaginationState>(
  set: (fn: (state: Draft<T>) => void) => void,
  options: PaginationOptions = {}
): PaginationActions {
  const resolvedOptions: ResolvedOptions = { ...DEFAULT_OPTIONS, ...options };

  function clearSelectionIfNeeded(state: Draft<T>): void {
    if (
      resolvedOptions.clearSelectionOnPageChange &&
      'selectedIds' in state &&
      state.selectedIds instanceof Set
    ) {
      (state as Draft<StateWithSelection>).selectedIds.clear();
    }
  }

  return {
    setPage: (page: number) => {
      set((state) => {
        state.page = Math.max(1, page);
        clearSelectionIfNeeded(state);
      });
    },

    setPageSize: (size: number) => {
      set((state) => {
        const { minPageSize, maxPageSize, resetPageOnSizeChange } = resolvedOptions;
        state.pageSize = Math.max(minPageSize, Math.min(maxPageSize, size));

        if (resetPageOnSizeChange) {
          state.page = 1;
        }

        clearSelectionIfNeeded(state);
      });
    },

    nextPage: () => {
      set((state) => {
        state.page += 1;
        clearSelectionIfNeeded(state);
      });
    },

    previousPage: () => {
      set((state) => {
        state.page = Math.max(1, state.page - 1);
        clearSelectionIfNeeded(state);
      });
    },

    resetPage: () => {
      set((state) => {
        state.page = 1;
      });
    },
  };
}

/**
 * Creates pagination selectors for a store.
 *
 * @returns Object containing selector functions for pagination state
 *
 * @example
 * ```typescript
 * const paginationSelectors = createPaginationSelectors<MyStoreState>();
 *
 * // Use in component:
 * const page = useMyStore(paginationSelectors.page);
 * const pageSize = useMyStore(paginationSelectors.pageSize);
 * ```
 */
export function createPaginationSelectors<T extends PaginationState>(): {
  page: (state: T) => number;
  pageSize: (state: T) => number;
  paginationState: (state: T) => PaginationState;
} {
  return {
    page: (state: T) => state.page,
    pageSize: (state: T) => state.pageSize,
    paginationState: (state: T) => ({
      page: state.page,
      pageSize: state.pageSize,
    }),
  };
}

/**
 * Default pagination initial state.
 * Use this when defining initial state for stores with pagination.
 */
export const defaultPaginationState: PaginationState = {
  page: 1,
  pageSize: 20,
};

/**
 * Creates initial pagination state with custom defaults.
 *
 * @param overrides - Values to override the defaults
 * @returns Pagination state object
 *
 * @example
 * ```typescript
 * const initialState = {
 *   ...createInitialPaginationState({ pageSize: 25 }),
 *   // other state...
 * };
 * ```
 */
export function createInitialPaginationState(
  overrides: Partial<PaginationState> = {}
): PaginationState {
  return {
    ...defaultPaginationState,
    ...overrides,
  };
}

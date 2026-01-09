/**
 * Selection slice utilities for Zustand stores
 *
 * Provides reusable selection state and actions that can be composed
 * into any store that needs multi-select functionality.
 *
 * @module stores/utils/selection
 */

import type { Draft } from 'immer';

// =================== INTERFACES ===================

/**
 * Base state interface for stores with selection capability.
 * Any store using the selection slice must extend this interface.
 */
export interface SelectionState {
  selectedIds: Set<string>;
}

/**
 * Actions for managing selection state.
 * Generic names allow stores to alias them (e.g., selectDocument, selectProfile).
 */
export interface SelectionActions {
  /** Add an item to the selection */
  selectItem: (id: string) => void;
  /** Remove an item from the selection */
  deselectItem: (id: string) => void;
  /** Toggle an item's selection state */
  toggleItem: (id: string) => void;
  /** Replace selection with the provided IDs */
  selectAll: (ids: string[]) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Check if an item is selected */
  isSelected: (id: string) => boolean;
  /** Get the number of selected items */
  getSelectionCount: () => number;
}

// =================== SLICE FACTORY ===================

/**
 * Type for immer-compatible set function.
 * Accepts either a partial state update or an immer producer function.
 */
type ImmerSet<T> = (updater: T | Partial<T> | ((state: Draft<T>) => void)) => void;

/**
 * Type for Zustand get function.
 */
type ZustandGet<T> = () => T;

/**
 * Creates a selection slice with all selection actions.
 *
 * This factory function generates the selection portion of a Zustand store,
 * compatible with immer middleware for immutable state updates.
 *
 * @example
 * ```typescript
 * // In your store definition with immer middleware:
 * const useMyStore = create<MyStore>()(
 *   immer((set, get) => ({
 *     selectedIds: new Set<string>(),
 *     ...createSelectionSlice(set, get),
 *     // Other store properties...
 *   }))
 * );
 * ```
 *
 * @param set - Zustand's set function (with immer middleware)
 * @param get - Zustand's get function
 * @returns Selection actions object
 */
export function createSelectionSlice<T extends SelectionState>(
  set: ImmerSet<T>,
  get: ZustandGet<T>
): SelectionActions {
  return {
    selectItem: (id: string) => {
      set((state) => {
        state.selectedIds.add(id);
      });
    },

    deselectItem: (id: string) => {
      set((state) => {
        state.selectedIds.delete(id);
      });
    },

    toggleItem: (id: string) => {
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
        state.selectedIds = new Set(ids) as Draft<Set<string>>;
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
  };
}

// =================== SELECTORS ===================

/**
 * Factory function that creates type-safe selection selectors.
 *
 * Use this to create selectors that can be passed to useStore()
 * for optimized re-renders.
 *
 * @example
 * ```typescript
 * // Create selectors for your store type
 * const selectors = createSelectionSelectors<DocumentStore>();
 *
 * // Use in components
 * const hasSelection = useDocumentStore(selectors.hasSelection);
 * const count = useDocumentStore(selectors.selectionCount);
 * ```
 *
 * @returns Object containing selection selector functions
 */
export function createSelectionSelectors<T extends SelectionState>(): {
  /** Selector for the Set of selected IDs */
  selectedIds: (state: T) => Set<string>;
  /** Selector for selected IDs as an array */
  selectedIdsArray: (state: T) => string[];
  /** Selector for the selection count */
  selectionCount: (state: T) => number;
  /** Selector for whether any items are selected */
  hasSelection: (state: T) => boolean;
} {
  return {
    selectedIds: (state: T) => state.selectedIds,
    selectedIdsArray: (state: T) => Array.from(state.selectedIds),
    selectionCount: (state: T) => state.selectedIds.size,
    hasSelection: (state: T) => state.selectedIds.size > 0,
  };
}

// =================== INITIAL STATE HELPER ===================

/**
 * Creates the initial selection state.
 * Use this when defining initial state for stores with selection.
 *
 * @example
 * ```typescript
 * const initialState: MyState = {
 *   ...createInitialSelectionState(),
 *   // Other initial state...
 * };
 * ```
 *
 * @returns Initial selection state with empty Set
 */
export function createInitialSelectionState(): SelectionState {
  return {
    selectedIds: new Set<string>(),
  };
}

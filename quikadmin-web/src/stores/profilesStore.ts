/**
 * Profiles store for state management
 * Manages UI state for profiles list (selection, filters, view mode)
 * B2C-focused: Profiles represent different identities a user fills forms for
 * @module stores/profilesStore
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Profile, ProfileFilter, ProfileSort, ProfileType, ProfileStatus } from '@/types/profile';

// View modes
export type ProfileViewMode = 'grid' | 'table';

// =================== STORE INTERFACES ===================

interface ProfilesState {
  // Selected profile IDs for bulk operations
  selectedIds: Set<string>;

  // View mode (grid or table)
  viewMode: ProfileViewMode;

  // Active filters
  filter: ProfileFilter;

  // Sort configuration
  sort: ProfileSort;

  // Pagination
  page: number;
  pageSize: number;

  // Search query (before debounce)
  searchQuery: string;
}

interface ProfilesActions {
  // Selection
  selectProfile: (id: string) => void;
  deselectProfile: (id: string) => void;
  toggleProfile: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;

  // View mode
  setViewMode: (mode: ProfileViewMode) => void;
  toggleViewMode: () => void;

  // Filters
  setFilter: (filter: Partial<ProfileFilter>) => void;
  clearFilter: () => void;
  setTypeFilter: (type: ProfileType | undefined) => void;
  setStatusFilter: (status: ProfileStatus | undefined) => void;

  // Search
  setSearchQuery: (query: string) => void;

  // Sort
  setSort: (sort: ProfileSort) => void;
  toggleSortOrder: () => void;

  // Pagination
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  resetPage: () => void;

  // Reset
  reset: () => void;
}

type ProfilesStore = ProfilesState & ProfilesActions;

// =================== INITIAL STATE ===================

const initialState: ProfilesState = {
  selectedIds: new Set(),
  viewMode: 'grid',
  filter: {},
  sort: { field: 'createdAt', order: 'desc' },
  page: 1,
  pageSize: 12,
  searchQuery: '',
};

// =================== STORE IMPLEMENTATION ===================

export const useProfilesStore = create<ProfilesStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // =================== SELECTION ===================

        selectProfile: (id: string) => {
          set((state) => {
            state.selectedIds.add(id);
          });
        },

        deselectProfile: (id: string) => {
          set((state) => {
            state.selectedIds.delete(id);
          });
        },

        toggleProfile: (id: string) => {
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
            state.selectedIds = new Set();
          });
        },

        isSelected: (id: string) => {
          return get().selectedIds.has(id);
        },

        // =================== VIEW MODE ===================

        setViewMode: (mode: ProfileViewMode) => {
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

        setFilter: (filter: Partial<ProfileFilter>) => {
          set((state) => {
            state.filter = { ...state.filter, ...filter };
            state.page = 1; // Reset to first page on filter change
          });
        },

        clearFilter: () => {
          set((state) => {
            state.filter = {};
            state.searchQuery = '';
            state.page = 1;
          });
        },

        setTypeFilter: (type: ProfileType | undefined) => {
          set((state) => {
            if (type) {
              state.filter.type = type;
            } else {
              delete state.filter.type;
            }
            state.page = 1;
          });
        },

        setStatusFilter: (status: ProfileStatus | undefined) => {
          set((state) => {
            if (status) {
              state.filter.status = status;
            } else {
              delete state.filter.status;
            }
            state.page = 1;
          });
        },

        // =================== SEARCH ===================

        setSearchQuery: (query: string) => {
          set((state) => {
            state.searchQuery = query;
            state.filter.search = query || undefined;
            state.page = 1;
          });
        },

        // =================== SORT ===================

        setSort: (sort: ProfileSort) => {
          set((state) => {
            state.sort = sort;
          });
        },

        toggleSortOrder: () => {
          set((state) => {
            state.sort.order = state.sort.order === 'asc' ? 'desc' : 'asc';
          });
        },

        // =================== PAGINATION ===================

        setPage: (page: number) => {
          set((state) => {
            state.page = page;
          });
        },

        setPageSize: (size: number) => {
          set((state) => {
            state.pageSize = size;
            state.page = 1; // Reset to first page on page size change
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
        name: 'profiles-store',
        partialize: (state) => ({
          viewMode: state.viewMode,
          pageSize: state.pageSize,
          sort: state.sort,
        }),
      }
    ),
    { name: 'ProfilesStore' }
  )
);

// =================== SELECTOR HOOKS ===================

export const useProfilesSelection = () => {
  const selectedIds = useProfilesStore((state) => state.selectedIds);
  const selectProfile = useProfilesStore((state) => state.selectProfile);
  const deselectProfile = useProfilesStore((state) => state.deselectProfile);
  const toggleProfile = useProfilesStore((state) => state.toggleProfile);
  const selectAll = useProfilesStore((state) => state.selectAll);
  const clearSelection = useProfilesStore((state) => state.clearSelection);
  const isSelected = useProfilesStore((state) => state.isSelected);

  return {
    selectedIds,
    selectionCount: selectedIds.size,
    selectProfile,
    deselectProfile,
    toggleProfile,
    selectAll,
    clearSelection,
    isSelected,
  };
};

export const useProfilesViewMode = () => {
  const viewMode = useProfilesStore((state) => state.viewMode);
  const setViewMode = useProfilesStore((state) => state.setViewMode);
  const toggleViewMode = useProfilesStore((state) => state.toggleViewMode);

  return { viewMode, setViewMode, toggleViewMode };
};

export const useProfilesFilters = () => {
  const filter = useProfilesStore((state) => state.filter);
  const searchQuery = useProfilesStore((state) => state.searchQuery);
  const setFilter = useProfilesStore((state) => state.setFilter);
  const clearFilter = useProfilesStore((state) => state.clearFilter);
  const setTypeFilter = useProfilesStore((state) => state.setTypeFilter);
  const setStatusFilter = useProfilesStore((state) => state.setStatusFilter);
  const setSearchQuery = useProfilesStore((state) => state.setSearchQuery);

  const hasActiveFilters = Boolean(
    filter.search || filter.type || filter.status
  );

  return {
    filter,
    searchQuery,
    setFilter,
    clearFilter,
    setTypeFilter,
    setStatusFilter,
    setSearchQuery,
    hasActiveFilters,
  };
};

export const useProfilesSort = () => {
  const sort = useProfilesStore((state) => state.sort);
  const setSort = useProfilesStore((state) => state.setSort);
  const toggleSortOrder = useProfilesStore((state) => state.toggleSortOrder);

  return { sort, setSort, toggleSortOrder };
};

export const useProfilesPagination = () => {
  const page = useProfilesStore((state) => state.page);
  const pageSize = useProfilesStore((state) => state.pageSize);
  const setPage = useProfilesStore((state) => state.setPage);
  const setPageSize = useProfilesStore((state) => state.setPageSize);
  const resetPage = useProfilesStore((state) => state.resetPage);

  return { page, pageSize, setPage, setPageSize, resetPage };
};

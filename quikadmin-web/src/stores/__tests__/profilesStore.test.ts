/**
 * Profiles Store Tests
 * Comprehensive unit tests for profilesStore state management
 * Tests selection, filters, sorting, pagination, view modes, and reset functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useProfilesStore } from '@/stores/profilesStore';
import type { ProfileFilter, ProfileSort, ProfileType, ProfileStatus } from '@/types/profile';

describe('profilesStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useProfilesStore.getState().reset();
  });

  describe('Initial State', () => {
    it('has correct initial state', () => {
      const state = useProfilesStore.getState();

      expect(state.selectedIds).toEqual(new Set());
      expect(state.viewMode).toBe('grid');
      expect(state.filter).toEqual({});
      expect(state.sort).toEqual({
        field: 'createdAt',
        order: 'desc',
      });
      expect(state.page).toBe(1);
      expect(state.pageSize).toBe(12);
      expect(state.searchQuery).toBe('');
    });
  });

  describe('Selection Actions', () => {
    it('selects a profile', () => {
      const { selectProfile, isSelected } = useProfilesStore.getState();

      selectProfile('profile-1');

      expect(isSelected('profile-1')).toBe(true);
      expect(useProfilesStore.getState().selectedIds.has('profile-1')).toBe(true);
    });

    it('deselects a profile', () => {
      const { selectProfile, deselectProfile, isSelected } = useProfilesStore.getState();

      selectProfile('profile-1');
      expect(isSelected('profile-1')).toBe(true);

      deselectProfile('profile-1');
      expect(isSelected('profile-1')).toBe(false);
    });

    it('toggles profile selection', () => {
      const { toggleProfile, isSelected } = useProfilesStore.getState();

      // First toggle - should select
      toggleProfile('profile-1');
      expect(isSelected('profile-1')).toBe(true);

      // Second toggle - should deselect
      toggleProfile('profile-1');
      expect(isSelected('profile-1')).toBe(false);
    });

    it('selects all profiles from array', () => {
      const { selectAll, isSelected } = useProfilesStore.getState();

      const ids = ['profile-1', 'profile-2', 'profile-3'];
      selectAll(ids);

      expect(isSelected('profile-1')).toBe(true);
      expect(isSelected('profile-2')).toBe(true);
      expect(isSelected('profile-3')).toBe(true);
      expect(useProfilesStore.getState().selectedIds.size).toBe(3);
    });

    it('clears all selections', () => {
      const { selectAll, clearSelection } = useProfilesStore.getState();

      selectAll(['profile-1', 'profile-2', 'profile-3']);
      expect(useProfilesStore.getState().selectedIds.size).toBe(3);

      clearSelection();
      expect(useProfilesStore.getState().selectedIds.size).toBe(0);
    });

    it('replaces selection with selectAll', () => {
      const { selectAll, isSelected } = useProfilesStore.getState();

      selectAll(['profile-1', 'profile-2']);
      expect(useProfilesStore.getState().selectedIds.size).toBe(2);

      selectAll(['profile-3', 'profile-4']);
      expect(useProfilesStore.getState().selectedIds.size).toBe(2);
      expect(isSelected('profile-1')).toBe(false);
      expect(isSelected('profile-3')).toBe(true);
    });
  });

  describe('View Mode Actions', () => {
    it('sets view mode to grid', () => {
      const { setViewMode } = useProfilesStore.getState();

      setViewMode('grid');
      expect(useProfilesStore.getState().viewMode).toBe('grid');
    });

    it('sets view mode to table', () => {
      const { setViewMode } = useProfilesStore.getState();

      setViewMode('table');
      expect(useProfilesStore.getState().viewMode).toBe('table');
    });

    it('toggles view mode', () => {
      const { toggleViewMode } = useProfilesStore.getState();

      expect(useProfilesStore.getState().viewMode).toBe('grid');

      toggleViewMode();
      expect(useProfilesStore.getState().viewMode).toBe('table');

      toggleViewMode();
      expect(useProfilesStore.getState().viewMode).toBe('grid');
    });
  });

  describe('Filter Actions', () => {
    it('sets partial filter', () => {
      const { setFilter } = useProfilesStore.getState();

      setFilter({ type: 'personal' as ProfileType });

      expect(useProfilesStore.getState().filter.type).toBe('personal');
    });

    it('merges filter updates', () => {
      const { setFilter } = useProfilesStore.getState();

      setFilter({ type: 'personal' as ProfileType });
      setFilter({ status: 'active' as ProfileStatus });

      const filter = useProfilesStore.getState().filter;
      expect(filter.type).toBe('personal');
      expect(filter.status).toBe('active');
    });

    it('resets to page 1 when filter changes', () => {
      const { setPage, setFilter } = useProfilesStore.getState();

      setPage(5);
      expect(useProfilesStore.getState().page).toBe(5);

      setFilter({ type: 'personal' as ProfileType });
      expect(useProfilesStore.getState().page).toBe(1);
    });

    it('clears all filters', () => {
      const { setFilter, clearFilter } = useProfilesStore.getState();

      setFilter({
        type: 'personal' as ProfileType,
        status: 'active' as ProfileStatus,
        search: 'test',
      });

      clearFilter();

      const state = useProfilesStore.getState();
      expect(state.filter).toEqual({});
      expect(state.searchQuery).toBe('');
      expect(state.page).toBe(1);
    });

    it('sets type filter', () => {
      const { setTypeFilter } = useProfilesStore.getState();

      setTypeFilter('business' as ProfileType);

      expect(useProfilesStore.getState().filter.type).toBe('business');
      expect(useProfilesStore.getState().page).toBe(1);
    });

    it('clears type filter when set to undefined', () => {
      const { setTypeFilter } = useProfilesStore.getState();

      setTypeFilter('personal' as ProfileType);
      expect(useProfilesStore.getState().filter.type).toBe('personal');

      setTypeFilter(undefined);
      expect(useProfilesStore.getState().filter.type).toBeUndefined();
    });

    it('sets status filter', () => {
      const { setStatusFilter } = useProfilesStore.getState();

      setStatusFilter('active' as ProfileStatus);

      expect(useProfilesStore.getState().filter.status).toBe('active');
      expect(useProfilesStore.getState().page).toBe(1);
    });

    it('clears status filter when set to undefined', () => {
      const { setStatusFilter } = useProfilesStore.getState();

      setStatusFilter('active' as ProfileStatus);
      expect(useProfilesStore.getState().filter.status).toBe('active');

      setStatusFilter(undefined);
      expect(useProfilesStore.getState().filter.status).toBeUndefined();
    });
  });

  describe('Search Actions', () => {
    it('sets search query', () => {
      const { setSearchQuery } = useProfilesStore.getState();

      setSearchQuery('test query');

      expect(useProfilesStore.getState().searchQuery).toBe('test query');
      expect(useProfilesStore.getState().filter.search).toBe('test query');
      expect(useProfilesStore.getState().page).toBe(1);
    });

    it('clears search when set to empty string', () => {
      const { setSearchQuery } = useProfilesStore.getState();

      setSearchQuery('test');
      expect(useProfilesStore.getState().searchQuery).toBe('test');

      setSearchQuery('');
      expect(useProfilesStore.getState().searchQuery).toBe('');
      expect(useProfilesStore.getState().filter.search).toBeUndefined();
    });

    it('updates search query multiple times', () => {
      const { setSearchQuery } = useProfilesStore.getState();

      setSearchQuery('first');
      expect(useProfilesStore.getState().searchQuery).toBe('first');

      setSearchQuery('second');
      expect(useProfilesStore.getState().searchQuery).toBe('second');
    });
  });

  describe('Sort Actions', () => {
    it('sets sort configuration', () => {
      const { setSort } = useProfilesStore.getState();

      const newSort: ProfileSort = {
        field: 'name',
        order: 'asc',
      };

      setSort(newSort);

      expect(useProfilesStore.getState().sort).toEqual(newSort);
    });

    it('toggles sort order from desc to asc', () => {
      const { toggleSortOrder } = useProfilesStore.getState();

      expect(useProfilesStore.getState().sort.order).toBe('desc');

      toggleSortOrder();
      expect(useProfilesStore.getState().sort.order).toBe('asc');
    });

    it('toggles sort order from asc to desc', () => {
      const { setSort, toggleSortOrder } = useProfilesStore.getState();

      setSort({ field: 'name', order: 'asc' });
      expect(useProfilesStore.getState().sort.order).toBe('asc');

      toggleSortOrder();
      expect(useProfilesStore.getState().sort.order).toBe('desc');
    });

    it('toggles sort order multiple times', () => {
      const { toggleSortOrder } = useProfilesStore.getState();

      toggleSortOrder(); // desc -> asc
      expect(useProfilesStore.getState().sort.order).toBe('asc');

      toggleSortOrder(); // asc -> desc
      expect(useProfilesStore.getState().sort.order).toBe('desc');

      toggleSortOrder(); // desc -> asc
      expect(useProfilesStore.getState().sort.order).toBe('asc');
    });
  });

  describe('Pagination Actions', () => {
    it('sets page number', () => {
      const { setPage } = useProfilesStore.getState();

      setPage(3);
      expect(useProfilesStore.getState().page).toBe(3);
    });

    it('sets page to 1', () => {
      const { setPage } = useProfilesStore.getState();

      setPage(5);
      setPage(1);
      expect(useProfilesStore.getState().page).toBe(1);
    });

    it('sets page size', () => {
      const { setPageSize } = useProfilesStore.getState();

      setPageSize(24);
      expect(useProfilesStore.getState().pageSize).toBe(24);
    });

    it('resets to page 1 when changing page size', () => {
      const { setPage, setPageSize } = useProfilesStore.getState();

      setPage(5);
      expect(useProfilesStore.getState().page).toBe(5);

      setPageSize(24);
      expect(useProfilesStore.getState().page).toBe(1);
      expect(useProfilesStore.getState().pageSize).toBe(24);
    });

    it('resets to first page', () => {
      const { setPage, resetPage } = useProfilesStore.getState();

      setPage(10);
      expect(useProfilesStore.getState().page).toBe(10);

      resetPage();
      expect(useProfilesStore.getState().page).toBe(1);
    });

    it('handles page changes without affecting other state', () => {
      const { setPage, setFilter } = useProfilesStore.getState();

      setFilter({ type: 'personal' as ProfileType });

      setPage(3);

      expect(useProfilesStore.getState().page).toBe(3);
      expect(useProfilesStore.getState().filter.type).toBe('personal');
    });
  });

  describe('Reset Action', () => {
    it('resets all state to initial values', () => {
      const {
        selectProfile,
        setViewMode,
        setFilter,
        setSearchQuery,
        setPage,
        setSort,
        reset,
      } = useProfilesStore.getState();

      // Modify state
      selectProfile('profile-1');
      selectProfile('profile-2');
      setViewMode('table');
      setFilter({ type: 'personal' as ProfileType, status: 'active' as ProfileStatus });
      setSearchQuery('test');
      setPage(5);
      setSort({ field: 'name', order: 'asc' });

      // Verify changes
      expect(useProfilesStore.getState().selectedIds.size).toBe(2);
      expect(useProfilesStore.getState().viewMode).toBe('table');
      expect(useProfilesStore.getState().page).toBe(5);
      expect(useProfilesStore.getState().searchQuery).toBe('test');

      // Reset
      reset();

      // Verify reset
      const state = useProfilesStore.getState();
      expect(state.selectedIds.size).toBe(0);
      expect(state.viewMode).toBe('grid');
      expect(state.filter).toEqual({});
      expect(state.searchQuery).toBe('');
      expect(state.page).toBe(1);
      expect(state.pageSize).toBe(12);
      expect(state.sort).toEqual({ field: 'createdAt', order: 'desc' });
    });

    it('can use store normally after reset', () => {
      const { selectProfile, reset } = useProfilesStore.getState();

      selectProfile('profile-1');
      reset();

      selectProfile('profile-2');
      expect(useProfilesStore.getState().isSelected('profile-2')).toBe(true);
      expect(useProfilesStore.getState().selectedIds.size).toBe(1);
    });
  });

  describe('Selector Hooks Integration', () => {
    it('maintains state consistency for selection operations', () => {
      const { selectProfile, isSelected, selectAll, clearSelection } =
        useProfilesStore.getState();

      selectProfile('p1');
      selectProfile('p2');
      expect(isSelected('p1')).toBe(true);
      expect(isSelected('p2')).toBe(true);

      selectAll(['p3', 'p4']);
      expect(isSelected('p1')).toBe(false);
      expect(isSelected('p3')).toBe(true);

      clearSelection();
      expect(useProfilesStore.getState().selectedIds.size).toBe(0);
    });

    it('maintains state consistency for view mode operations', () => {
      const { setViewMode, toggleViewMode } = useProfilesStore.getState();

      setViewMode('table');
      expect(useProfilesStore.getState().viewMode).toBe('table');

      toggleViewMode();
      expect(useProfilesStore.getState().viewMode).toBe('grid');
    });

    it('maintains state consistency for filter operations', () => {
      const {
        setFilter,
        setTypeFilter,
        setStatusFilter,
        setSearchQuery,
        clearFilter,
      } = useProfilesStore.getState();

      setTypeFilter('personal' as ProfileType);
      expect(useProfilesStore.getState().filter.type).toBe('personal');

      setStatusFilter('active' as ProfileStatus);
      expect(useProfilesStore.getState().filter.status).toBe('active');

      setSearchQuery('test');
      expect(useProfilesStore.getState().searchQuery).toBe('test');

      clearFilter();
      expect(useProfilesStore.getState().filter).toEqual({});
    });

    it('maintains state consistency for sort operations', () => {
      const { setSort, toggleSortOrder } = useProfilesStore.getState();

      setSort({ field: 'name', order: 'asc' });
      expect(useProfilesStore.getState().sort.order).toBe('asc');

      toggleSortOrder();
      expect(useProfilesStore.getState().sort.order).toBe('desc');
    });

    it('maintains state consistency for pagination operations', () => {
      const { setPage, setPageSize, resetPage } = useProfilesStore.getState();

      setPage(5);
      expect(useProfilesStore.getState().page).toBe(5);

      setPageSize(24);
      expect(useProfilesStore.getState().page).toBe(1);

      setPage(3);
      resetPage();
      expect(useProfilesStore.getState().page).toBe(1);
    });
  });

  describe('Complex Scenarios', () => {
    it('handles multiple filter changes with page resets', () => {
      const { setPage, setTypeFilter, setStatusFilter, setSearchQuery } =
        useProfilesStore.getState();

      setPage(5);

      setTypeFilter('personal' as ProfileType);
      expect(useProfilesStore.getState().page).toBe(1);

      setPage(3);

      setStatusFilter('active' as ProfileStatus);
      expect(useProfilesStore.getState().page).toBe(1);

      setPage(2);

      setSearchQuery('test');
      expect(useProfilesStore.getState().page).toBe(1);
    });

    it('maintains selection independently of pagination', () => {
      const { selectProfile, setPage, isSelected } = useProfilesStore.getState();

      selectProfile('profile-1');
      expect(isSelected('profile-1')).toBe(true);

      setPage(2);
      expect(isSelected('profile-1')).toBe(true);

      setPage(3);
      expect(isSelected('profile-1')).toBe(true);
    });

    it('handles simultaneous filter and sort changes', () => {
      const { setFilter, setSort } = useProfilesStore.getState();

      setFilter({ type: 'personal' as ProfileType });
      setSort({ field: 'name', order: 'asc' });

      const state = useProfilesStore.getState();
      expect(state.filter.type).toBe('personal');
      expect(state.sort.field).toBe('name');
      expect(state.sort.order).toBe('asc');
    });

    it('handles view mode changes without affecting filters', () => {
      const { setFilter, toggleViewMode } = useProfilesStore.getState();

      setFilter({ type: 'business' as ProfileType });

      toggleViewMode();

      expect(useProfilesStore.getState().viewMode).toBe('table');
      expect(useProfilesStore.getState().filter.type).toBe('business');
    });

    it('handles empty selection operations', () => {
      const { selectAll, clearSelection } = useProfilesStore.getState();

      selectAll([]);
      expect(useProfilesStore.getState().selectedIds.size).toBe(0);

      clearSelection();
      expect(useProfilesStore.getState().selectedIds.size).toBe(0);
    });

    it('handles rapid state changes', () => {
      const { setPage, setFilter, toggleViewMode } = useProfilesStore.getState();

      setPage(2);
      setFilter({ type: 'personal' as ProfileType });
      toggleViewMode();
      setPage(3);
      setFilter({ status: 'active' as ProfileStatus });

      const state = useProfilesStore.getState();
      expect(state.page).toBe(1); // Reset by filter change
      expect(state.viewMode).toBe('table');
      expect(state.filter.type).toBe('personal');
      expect(state.filter.status).toBe('active');
    });
  });

  describe('Edge Cases', () => {
    it('handles toggling same profile multiple times', () => {
      const { toggleProfile, isSelected } = useProfilesStore.getState();

      toggleProfile('profile-1');
      expect(isSelected('profile-1')).toBe(true);

      toggleProfile('profile-1');
      expect(isSelected('profile-1')).toBe(false);

      toggleProfile('profile-1');
      expect(isSelected('profile-1')).toBe(true);
    });

    it('handles deselecting non-selected profile', () => {
      const { deselectProfile } = useProfilesStore.getState();

      // Should not throw error
      deselectProfile('non-existent');
      expect(useProfilesStore.getState().selectedIds.size).toBe(0);
    });

    it('handles checking selection of non-existent profile', () => {
      const { isSelected } = useProfilesStore.getState();

      expect(isSelected('non-existent')).toBe(false);
    });

    it('handles multiple clears in sequence', () => {
      const { clearFilter } = useProfilesStore.getState();

      clearFilter();
      clearFilter();
      clearFilter();

      expect(useProfilesStore.getState().filter).toEqual({});
    });

    it('preserves Set structure after operations', () => {
      const { selectProfile, deselectProfile } = useProfilesStore.getState();

      selectProfile('p1');
      selectProfile('p2');
      selectProfile('p3');
      deselectProfile('p2');

      const selectedIds = useProfilesStore.getState().selectedIds;
      expect(selectedIds).toBeInstanceOf(Set);
      expect(selectedIds.size).toBe(2);
      expect(selectedIds.has('p1')).toBe(true);
      expect(selectedIds.has('p3')).toBe(true);
    });
  });
});

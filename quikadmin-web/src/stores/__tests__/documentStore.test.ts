/**
 * Document Store Tests
 * Comprehensive unit tests for documentStore state management
 * Tests selection, filters, sorting, pagination, view modes, and reset functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDocumentStore, documentSelectors } from '@/stores/documentStore';
import type { DocumentFilter, DocumentSort, DateRangePreset } from '@/types/document';

describe('documentStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useDocumentStore.getState().reset();
  });

  describe('Initial State', () => {
    it('has correct initial state', () => {
      const state = useDocumentStore.getState();

      expect(state.selectedIds).toEqual(new Set());
      expect(state.viewMode).toBe('grid');
      expect(state.filter).toEqual({
        status: undefined,
        fileType: undefined,
        dateRange: { start: null, end: null },
        searchQuery: '',
        tags: undefined,
        minConfidence: undefined,
      });
      expect(state.sort).toEqual({
        field: 'createdAt',
        direction: 'desc',
      });
      expect(state.page).toBe(1);
      expect(state.pageSize).toBe(25);
      expect(state.dateRangePreset).toBe('all');
      expect(state.debouncedSearch).toBe('');
    });
  });

  describe('Selection Actions', () => {
    it('selects a document', () => {
      const { selectDocument, isSelected } = useDocumentStore.getState();

      selectDocument('doc-1');

      expect(isSelected('doc-1')).toBe(true);
      expect(useDocumentStore.getState().selectedIds.has('doc-1')).toBe(true);
    });

    it('deselects a document', () => {
      const { selectDocument, deselectDocument, isSelected } = useDocumentStore.getState();

      selectDocument('doc-1');
      expect(isSelected('doc-1')).toBe(true);

      deselectDocument('doc-1');
      expect(isSelected('doc-1')).toBe(false);
    });

    it('toggles document selection', () => {
      const { toggleDocument, isSelected } = useDocumentStore.getState();

      // First toggle - should select
      toggleDocument('doc-1');
      expect(isSelected('doc-1')).toBe(true);

      // Second toggle - should deselect
      toggleDocument('doc-1');
      expect(isSelected('doc-1')).toBe(false);
    });

    it('selects all documents from array', () => {
      const { selectAll, isSelected } = useDocumentStore.getState();

      const ids = ['doc-1', 'doc-2', 'doc-3'];
      selectAll(ids);

      expect(isSelected('doc-1')).toBe(true);
      expect(isSelected('doc-2')).toBe(true);
      expect(isSelected('doc-3')).toBe(true);
      expect(useDocumentStore.getState().selectedIds.size).toBe(3);
    });

    it('clears all selections', () => {
      const { selectAll, clearSelection, getSelectionCount } = useDocumentStore.getState();

      selectAll(['doc-1', 'doc-2', 'doc-3']);
      expect(getSelectionCount()).toBe(3);

      clearSelection();
      expect(getSelectionCount()).toBe(0);
      expect(useDocumentStore.getState().selectedIds.size).toBe(0);
    });

    it('returns correct selection count', () => {
      const { selectDocument, getSelectionCount } = useDocumentStore.getState();

      expect(getSelectionCount()).toBe(0);

      selectDocument('doc-1');
      expect(getSelectionCount()).toBe(1);

      selectDocument('doc-2');
      expect(getSelectionCount()).toBe(2);
    });
  });

  describe('View Mode Actions', () => {
    it('sets view mode to grid', () => {
      const { setViewMode } = useDocumentStore.getState();

      setViewMode('grid');
      expect(useDocumentStore.getState().viewMode).toBe('grid');
    });

    it('sets view mode to table', () => {
      const { setViewMode } = useDocumentStore.getState();

      setViewMode('table');
      expect(useDocumentStore.getState().viewMode).toBe('table');
    });

    it('toggles view mode from grid to table', () => {
      const { toggleViewMode } = useDocumentStore.getState();

      expect(useDocumentStore.getState().viewMode).toBe('grid');

      toggleViewMode();
      expect(useDocumentStore.getState().viewMode).toBe('table');

      toggleViewMode();
      expect(useDocumentStore.getState().viewMode).toBe('grid');
    });
  });

  describe('Filter Actions', () => {
    it('sets partial filter', () => {
      const { setFilter } = useDocumentStore.getState();

      setFilter({ status: ['completed'] });

      expect(useDocumentStore.getState().filter.status).toEqual(['completed']);
    });

    it('merges filter updates', () => {
      const { setFilter } = useDocumentStore.getState();

      setFilter({ status: ['completed'] });
      setFilter({ fileType: ['pdf'] });

      const filter = useDocumentStore.getState().filter;
      expect(filter.status).toEqual(['completed']);
      expect(filter.fileType).toEqual(['pdf']);
    });

    it('resets to page 1 when filter changes', () => {
      const { setPage, setFilter } = useDocumentStore.getState();

      setPage(5);
      expect(useDocumentStore.getState().page).toBe(5);

      setFilter({ status: ['completed'] });
      expect(useDocumentStore.getState().page).toBe(1);
    });

    it('clears all filters', () => {
      const { setFilter, clearFilter } = useDocumentStore.getState();

      setFilter({
        status: ['completed'],
        fileType: ['pdf'],
        searchQuery: 'test',
      });

      clearFilter();

      const state = useDocumentStore.getState();
      expect(state.filter).toEqual({
        status: undefined,
        fileType: undefined,
        dateRange: { start: null, end: null },
        searchQuery: '',
        tags: undefined,
        minConfidence: undefined,
      });
      expect(state.dateRangePreset).toBe('all');
      expect(state.page).toBe(1);
    });

    it('sets search query', () => {
      const { setSearchQuery } = useDocumentStore.getState();

      setSearchQuery('test query');

      expect(useDocumentStore.getState().filter.searchQuery).toBe('test query');
      expect(useDocumentStore.getState().page).toBe(1);
    });

    it('detects active filters', () => {
      const { setFilter, hasActiveFilters, clearFilter } = useDocumentStore.getState();

      expect(hasActiveFilters()).toBe(false);

      setFilter({ status: ['completed'] });
      expect(hasActiveFilters()).toBe(true);

      clearFilter();
      expect(hasActiveFilters()).toBe(false);
    });

    it('detects active search query as filter', () => {
      const { setSearchQuery, hasActiveFilters } = useDocumentStore.getState();

      setSearchQuery('test');
      expect(hasActiveFilters()).toBe(true);
    });
  });

  describe('Date Range Preset Actions', () => {
    it('sets date range preset', () => {
      const { setDateRangePreset } = useDocumentStore.getState();

      setDateRangePreset('week');
      expect(useDocumentStore.getState().dateRangePreset).toBe('week');
    });

    it('applies date range preset and updates filter', () => {
      const { applyDateRangePreset } = useDocumentStore.getState();

      applyDateRangePreset('week');

      const state = useDocumentStore.getState();
      expect(state.dateRangePreset).toBe('week');
      expect(state.filter.dateRange.start).toBeInstanceOf(Date);
      expect(state.filter.dateRange.end).toBeInstanceOf(Date);
      expect(state.page).toBe(1);
    });

    it('applies today preset correctly', () => {
      const { applyDateRangePreset } = useDocumentStore.getState();

      applyDateRangePreset('today');

      const { filter } = useDocumentStore.getState();
      expect(filter.dateRange.start).toBeInstanceOf(Date);
      expect(filter.dateRange.end).toBeInstanceOf(Date);
    });

    it('applies month preset correctly', () => {
      const { applyDateRangePreset } = useDocumentStore.getState();

      applyDateRangePreset('month');

      const { filter } = useDocumentStore.getState();
      expect(filter.dateRange.start).toBeInstanceOf(Date);
      expect(filter.dateRange.end).toBeInstanceOf(Date);
    });

    it('applies year preset correctly', () => {
      const { applyDateRangePreset } = useDocumentStore.getState();

      applyDateRangePreset('year');

      const { filter } = useDocumentStore.getState();
      expect(filter.dateRange.start).toBeInstanceOf(Date);
      expect(filter.dateRange.end).toBeInstanceOf(Date);
    });

    it('applies all preset to clear date range', () => {
      const { applyDateRangePreset } = useDocumentStore.getState();

      applyDateRangePreset('all');

      const { filter } = useDocumentStore.getState();
      expect(filter.dateRange.start).toBeNull();
      expect(filter.dateRange.end).toBeNull();
    });

    it('detects date range preset as active filter', () => {
      const { applyDateRangePreset, hasActiveFilters } = useDocumentStore.getState();

      applyDateRangePreset('week');
      expect(hasActiveFilters()).toBe(true);
    });
  });

  describe('Sort Actions', () => {
    it('sets sort configuration', () => {
      const { setSort } = useDocumentStore.getState();

      const newSort: DocumentSort = {
        field: 'fileName',
        direction: 'asc',
      };

      setSort(newSort);

      expect(useDocumentStore.getState().sort).toEqual(newSort);
    });

    it('toggles sort direction', () => {
      const { toggleSortDirection } = useDocumentStore.getState();

      expect(useDocumentStore.getState().sort.direction).toBe('desc');

      toggleSortDirection();
      expect(useDocumentStore.getState().sort.direction).toBe('asc');

      toggleSortDirection();
      expect(useDocumentStore.getState().sort.direction).toBe('desc');
    });
  });

  describe('Pagination Actions', () => {
    it('sets page number', () => {
      const { setPage } = useDocumentStore.getState();

      setPage(3);
      expect(useDocumentStore.getState().page).toBe(3);
    });

    it('prevents setting page below 1', () => {
      const { setPage } = useDocumentStore.getState();

      setPage(0);
      expect(useDocumentStore.getState().page).toBe(1);

      setPage(-5);
      expect(useDocumentStore.getState().page).toBe(1);
    });

    it('clears selection when changing page', () => {
      const { selectDocument, setPage, getSelectionCount } = useDocumentStore.getState();

      selectDocument('doc-1');
      expect(getSelectionCount()).toBe(1);

      setPage(2);
      expect(getSelectionCount()).toBe(0);
    });

    it('goes to next page', () => {
      const { nextPage } = useDocumentStore.getState();

      expect(useDocumentStore.getState().page).toBe(1);

      nextPage();
      expect(useDocumentStore.getState().page).toBe(2);

      nextPage();
      expect(useDocumentStore.getState().page).toBe(3);
    });

    it('goes to previous page', () => {
      const { setPage, previousPage } = useDocumentStore.getState();

      setPage(3);
      expect(useDocumentStore.getState().page).toBe(3);

      previousPage();
      expect(useDocumentStore.getState().page).toBe(2);

      previousPage();
      expect(useDocumentStore.getState().page).toBe(1);
    });

    it('does not go below page 1 when going previous', () => {
      const { previousPage } = useDocumentStore.getState();

      expect(useDocumentStore.getState().page).toBe(1);

      previousPage();
      expect(useDocumentStore.getState().page).toBe(1);
    });

    it('sets page size', () => {
      const { setPageSize } = useDocumentStore.getState();

      setPageSize(50);
      expect(useDocumentStore.getState().pageSize).toBe(50);
    });

    it('enforces minimum page size of 10', () => {
      const { setPageSize } = useDocumentStore.getState();

      setPageSize(5);
      expect(useDocumentStore.getState().pageSize).toBe(10);

      setPageSize(1);
      expect(useDocumentStore.getState().pageSize).toBe(10);
    });

    it('enforces maximum page size of 100', () => {
      const { setPageSize } = useDocumentStore.getState();

      setPageSize(150);
      expect(useDocumentStore.getState().pageSize).toBe(100);

      setPageSize(200);
      expect(useDocumentStore.getState().pageSize).toBe(100);
    });

    it('resets to page 1 and clears selection when changing page size', () => {
      const { setPage, selectDocument, setPageSize, getSelectionCount } = useDocumentStore.getState();

      setPage(5);
      selectDocument('doc-1');

      setPageSize(50);

      expect(useDocumentStore.getState().page).toBe(1);
      expect(getSelectionCount()).toBe(0);
    });

    it('resets to first page', () => {
      const { setPage, resetPage } = useDocumentStore.getState();

      setPage(10);
      expect(useDocumentStore.getState().page).toBe(10);

      resetPage();
      expect(useDocumentStore.getState().page).toBe(1);
    });
  });

  describe('Reset Action', () => {
    it('resets all state to initial values', () => {
      const { setViewMode, setFilter, setPage, setSort, reset } =
        useDocumentStore.getState();

      // Modify state (avoiding Set operations that might affect shared instance)
      setViewMode('table');
      setFilter({ status: ['completed'], searchQuery: 'test' });
      setPage(5);
      setSort({ field: 'fileName', direction: 'asc' });

      // Verify changes
      expect(useDocumentStore.getState().viewMode).toBe('table');
      expect(useDocumentStore.getState().page).toBe(5);
      expect(useDocumentStore.getState().filter.status).toEqual(['completed']);

      // Reset
      reset();

      // Verify reset
      const state = useDocumentStore.getState();
      expect(state.selectedIds.size).toBe(0);
      expect(state.viewMode).toBe('grid');
      expect(state.filter.searchQuery).toBe('');
      expect(state.page).toBe(1);
      expect(state.pageSize).toBe(25);
      expect(state.sort).toEqual({ field: 'createdAt', direction: 'desc' });
      expect(state.dateRangePreset).toBe('all');
    });
  });

  describe('Selectors', () => {
    it('selectedIds selector returns Set', () => {
      const { selectDocument } = useDocumentStore.getState();

      selectDocument('doc-1');

      const selectedIds = documentSelectors.selectedIds(useDocumentStore.getState());
      expect(selectedIds).toBeInstanceOf(Set);
      expect(selectedIds.has('doc-1')).toBe(true);
    });

    it('selectedIdsArray selector returns array', () => {
      const { selectAll } = useDocumentStore.getState();

      selectAll(['doc-1', 'doc-2', 'doc-3']);

      const selectedIdsArray = documentSelectors.selectedIdsArray(useDocumentStore.getState());
      expect(Array.isArray(selectedIdsArray)).toBe(true);
      expect(selectedIdsArray).toHaveLength(3);
      expect(selectedIdsArray).toContain('doc-1');
    });

    it('selectionCount selector returns number', () => {
      const { selectAll } = useDocumentStore.getState();

      selectAll(['doc-1', 'doc-2']);

      const count = documentSelectors.selectionCount(useDocumentStore.getState());
      expect(count).toBe(2);
    });

    it('hasSelection selector returns boolean', () => {
      expect(documentSelectors.hasSelection(useDocumentStore.getState())).toBe(false);

      useDocumentStore.getState().selectDocument('doc-1');

      expect(documentSelectors.hasSelection(useDocumentStore.getState())).toBe(true);
    });

    it('viewMode selector returns current view mode', () => {
      const viewMode = documentSelectors.viewMode(useDocumentStore.getState());
      expect(viewMode).toBe('grid');
    });

    it('filter selector returns current filter', () => {
      const filter = documentSelectors.filter(useDocumentStore.getState());
      expect(filter).toHaveProperty('searchQuery');
      expect(filter).toHaveProperty('status');
    });

    it('sort selector returns current sort', () => {
      const sort = documentSelectors.sort(useDocumentStore.getState());
      expect(sort).toEqual({ field: 'createdAt', direction: 'desc' });
    });

    it('page selector returns current page', () => {
      const page = documentSelectors.page(useDocumentStore.getState());
      expect(page).toBe(1);
    });

    it('pageSize selector returns current page size', () => {
      const pageSize = documentSelectors.pageSize(useDocumentStore.getState());
      expect(pageSize).toBe(25);
    });

    it('hasActiveFilters selector detects filters', () => {
      expect(documentSelectors.hasActiveFilters(useDocumentStore.getState())).toBe(false);

      useDocumentStore.getState().setFilter({ status: ['completed'] });

      expect(documentSelectors.hasActiveFilters(useDocumentStore.getState())).toBe(true);
    });

    it('dateRangePreset selector returns preset', () => {
      const preset = documentSelectors.dateRangePreset(useDocumentStore.getState());
      expect(preset).toBe('all');
    });
  });

  describe('Complex Scenarios', () => {
    it('handles multiple operations in sequence', () => {
      const {
        selectDocument,
        setFilter,
        setSort,
        setPage,
        getSelectionCount,
      } = useDocumentStore.getState();

      // Select documents
      selectDocument('doc-1');
      selectDocument('doc-2');
      expect(getSelectionCount()).toBe(2);

      // Change page (should clear selection)
      setPage(2);
      expect(getSelectionCount()).toBe(0);
      expect(useDocumentStore.getState().page).toBe(2);

      // Apply filter (should reset page)
      setFilter({ status: ['completed'] });
      expect(useDocumentStore.getState().page).toBe(1);

      // Change sort
      setSort({ field: 'fileName', direction: 'asc' });
      expect(useDocumentStore.getState().sort.field).toBe('fileName');
    });

    it('maintains selection when only modifying filters', () => {
      const { selectDocument, setFilter, getSelectionCount } = useDocumentStore.getState();

      selectDocument('doc-1');
      expect(getSelectionCount()).toBe(1);

      setFilter({ status: ['completed'] });

      // Selection should be maintained
      expect(getSelectionCount()).toBe(1);
    });

    it('handles edge case of empty selectAll', () => {
      const { selectAll, getSelectionCount } = useDocumentStore.getState();

      selectAll([]);
      expect(getSelectionCount()).toBe(0);
    });

    it('handles replacing entire selection', () => {
      const { selectAll, getSelectionCount } = useDocumentStore.getState();

      selectAll(['doc-1', 'doc-2']);
      expect(getSelectionCount()).toBe(2);

      selectAll(['doc-3', 'doc-4', 'doc-5']);
      expect(getSelectionCount()).toBe(3);
      expect(useDocumentStore.getState().isSelected('doc-1')).toBe(false);
      expect(useDocumentStore.getState().isSelected('doc-3')).toBe(true);
    });
  });
});

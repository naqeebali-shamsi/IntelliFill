/**
 * Knowledge Store Tests
 * Tests for the Knowledge Base Zustand store
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useKnowledgeStore } from '../knowledgeStore';
import knowledgeService from '@/services/knowledgeService';

// Mock the knowledge service
vi.mock('@/services/knowledgeService', () => ({
  default: {
    getKnowledgeSources: vi.fn(),
    uploadKnowledgeSource: vi.fn(),
    deleteKnowledgeSource: vi.fn(),
    getKnowledgeSource: vi.fn(),
    semanticSearch: vi.fn(),
    hybridSearch: vi.fn(),
    getFormSuggestions: vi.fn(),
    getFieldSuggestions: vi.fn(),
    getContextualSuggestions: vi.fn(),
    getKnowledgeBaseStats: vi.fn(),
  },
}));

describe('useKnowledgeStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useKnowledgeStore.getState().reset();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('has correct initial state', () => {
      const state = useKnowledgeStore.getState();

      expect(state.sources).toEqual([]);
      expect(state.sourcesLoading).toBe(false);
      expect(state.sourcesError).toBeNull();
      expect(state.searchResults).toEqual([]);
      expect(state.searchLoading).toBe(false);
      expect(state.searchQuery).toBe('');
      expect(state.fieldSuggestions).toEqual({});
      expect(state.stats).toBeNull();
    });
  });

  describe('fetchSources', () => {
    it('fetches and sets sources', async () => {
      const mockSources = [
        { id: '1', title: 'Doc 1', status: 'COMPLETED' },
        { id: '2', title: 'Doc 2', status: 'PROCESSING' },
      ];

      vi.mocked(knowledgeService.getKnowledgeSources).mockResolvedValue({
        success: true,
        sources: mockSources as any,
        pagination: { total: 2, limit: 20, offset: 0, hasMore: false },
      });

      await useKnowledgeStore.getState().fetchSources();

      const state = useKnowledgeStore.getState();
      expect(state.sources).toEqual(mockSources);
      expect(state.sourcesLoading).toBe(false);
      expect(state.sourcesError).toBeNull();
    });

    it('sets error on failure', async () => {
      vi.mocked(knowledgeService.getKnowledgeSources).mockRejectedValue(new Error('Network error'));

      await useKnowledgeStore.getState().fetchSources();

      const state = useKnowledgeStore.getState();
      expect(state.sources).toEqual([]);
      expect(state.sourcesLoading).toBe(false);
      expect(state.sourcesError).toBe('Network error');
    });

    it('sets loading state during fetch', async () => {
      let resolvePromise: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(knowledgeService.getKnowledgeSources).mockReturnValue(
        promise.then(() => ({
          success: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sources: [] as any[],
          pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
        }))
      );

      const fetchPromise = useKnowledgeStore.getState().fetchSources();

      // Check loading state
      expect(useKnowledgeStore.getState().sourcesLoading).toBe(true);

      resolvePromise!();
      await fetchPromise;

      expect(useKnowledgeStore.getState().sourcesLoading).toBe(false);
    });
  });

  describe('uploadSource', () => {
    it('uploads and adds source to list', async () => {
      const mockSource = {
        id: 'new-1',
        title: 'New Document',
        status: 'PENDING',
      };

      vi.mocked(knowledgeService.uploadKnowledgeSource).mockResolvedValue({
        success: true,
        source: mockSource as any,
        message: 'Uploaded',
      });

      const result = await useKnowledgeStore
        .getState()
        .uploadSource(new File(['content'], 'test.pdf'), 'New Document');

      expect(result).toEqual(mockSource);
      expect(useKnowledgeStore.getState().sources[0]).toEqual(mockSource);
    });

    it('returns null on failure', async () => {
      vi.mocked(knowledgeService.uploadKnowledgeSource).mockRejectedValue(
        new Error('Upload failed')
      );

      const result = await useKnowledgeStore
        .getState()
        .uploadSource(new File(['content'], 'test.pdf'), 'Test');

      expect(result).toBeNull();
      expect(useKnowledgeStore.getState().uploadError).toBe('Upload failed');
    });

    it('tracks upload progress', async () => {
      let progressCallback: (progress: number) => void;

      vi.mocked(knowledgeService.uploadKnowledgeSource).mockImplementation(
        async (file, title, onProgress) => {
          progressCallback = onProgress!;
          return {
            success: true,
            source: { id: '1', title } as any,
            message: 'Done',
          };
        }
      );

      const uploadPromise = useKnowledgeStore
        .getState()
        .uploadSource(new File(['content'], 'test.pdf'), 'Test');

      expect(useKnowledgeStore.getState().uploadLoading).toBe(true);

      await uploadPromise;

      expect(useKnowledgeStore.getState().uploadLoading).toBe(false);
      expect(useKnowledgeStore.getState().uploadProgress).toBe(100);
    });
  });

  describe('deleteSource', () => {
    it('removes source from list', async () => {
      // Setup initial state
      useKnowledgeStore.setState({
        sources: [{ id: '1', title: 'Doc 1' } as any, { id: '2', title: 'Doc 2' } as any],
        sourcePagination: { total: 2, limit: 20, offset: 0, hasMore: false },
      });

      vi.mocked(knowledgeService.deleteKnowledgeSource).mockResolvedValue({
        success: true,
        message: 'Deleted',
      });

      const result = await useKnowledgeStore.getState().deleteSource('1');

      expect(result).toBe(true);
      expect(useKnowledgeStore.getState().sources).toHaveLength(1);
      expect(useKnowledgeStore.getState().sources[0].id).toBe('2');
    });

    it('clears selected source if deleted', async () => {
      useKnowledgeStore.setState({
        sources: [{ id: '1', title: 'Doc' } as any],
        selectedSourceId: '1',
        sourcePagination: { total: 1, limit: 20, offset: 0, hasMore: false },
      });

      vi.mocked(knowledgeService.deleteKnowledgeSource).mockResolvedValue({
        success: true,
        message: 'Deleted',
      });

      await useKnowledgeStore.getState().deleteSource('1');

      expect(useKnowledgeStore.getState().selectedSourceId).toBeNull();
    });
  });

  describe('search', () => {
    it('performs semantic search', async () => {
      const mockResults = [
        { id: 'r1', text: 'Result 1', similarity: 0.9 },
        { id: 'r2', text: 'Result 2', similarity: 0.8 },
      ];

      vi.mocked(knowledgeService.semanticSearch).mockResolvedValue({
        success: true,
        results: mockResults as any,
        query: 'test query',
        totalResults: 2,
        searchParams: {},
        cached: false,
        searchTime: 100,
      });

      await useKnowledgeStore.getState().search({ query: 'test query' });

      const state = useKnowledgeStore.getState();
      expect(state.searchResults).toEqual(mockResults);
      expect(state.searchQuery).toBe('test query');
      expect(state.searchLoading).toBe(false);
    });

    it('sets error on search failure', async () => {
      vi.mocked(knowledgeService.semanticSearch).mockRejectedValue(new Error('Search error'));

      await useKnowledgeStore.getState().search({ query: 'test' });

      expect(useKnowledgeStore.getState().searchError).toBe('Search error');
    });
  });

  describe('hybridSearch', () => {
    it('performs hybrid search', async () => {
      const mockResults = [{ id: 'r1', text: 'Result', vectorScore: 0.8, keywordScore: 0.9 }];

      vi.mocked(knowledgeService.hybridSearch).mockResolvedValue({
        success: true,
        results: mockResults as any,
        query: 'test',
        totalResults: 1,
        searchParams: {},
        cached: false,
        searchTime: 150,
      });

      await useKnowledgeStore.getState().hybridSearch({
        query: 'test',
        hybridMode: 'balanced',
      });

      expect(useKnowledgeStore.getState().searchResults).toEqual(mockResults);
    });
  });

  describe('clearSearch', () => {
    it('clears search state', () => {
      useKnowledgeStore.setState({
        searchResults: [{ id: '1' } as any],
        searchQuery: 'test',
        searchTime: 100,
        searchCached: true,
      });

      useKnowledgeStore.getState().clearSearch();

      const state = useKnowledgeStore.getState();
      expect(state.searchResults).toEqual([]);
      expect(state.searchQuery).toBe('');
      expect(state.searchTime).toBe(0);
      expect(state.searchCached).toBe(false);
    });
  });

  describe('fetchFieldSuggestions', () => {
    it('fetches and stores field suggestions', async () => {
      const mockSuggestions = [
        { value: 'John', confidence: 0.9 },
        { value: 'Jane', confidence: 0.8 },
      ];

      vi.mocked(knowledgeService.getFieldSuggestions).mockResolvedValue({
        success: true,
        fieldName: 'firstName',
        suggestions: mockSuggestions as any,
        searchTime: 50,
      });

      const result = await useKnowledgeStore.getState().fetchFieldSuggestions({
        fieldName: 'firstName',
      });

      expect(result).toEqual(mockSuggestions);
      expect(useKnowledgeStore.getState().fieldSuggestions.firstName).toEqual(mockSuggestions);
    });

    it('returns empty array on failure', async () => {
      vi.mocked(knowledgeService.getFieldSuggestions).mockRejectedValue(new Error('Failed'));

      const result = await useKnowledgeStore.getState().fetchFieldSuggestions({
        fieldName: 'firstName',
      });

      expect(result).toEqual([]);
    });
  });

  describe('fetchFormSuggestions', () => {
    it('fetches suggestions for multiple fields', async () => {
      const mockResponse = {
        success: true,
        fields: {
          firstName: [{ value: 'John', confidence: 0.9 }],
          lastName: [{ value: 'Smith', confidence: 0.85 }],
        },
        totalSearchTime: 200,
        cacheHits: 1,
      };

      vi.mocked(knowledgeService.getFormSuggestions).mockResolvedValue(mockResponse as any);

      await useKnowledgeStore.getState().fetchFormSuggestions({
        fieldNames: ['firstName', 'lastName'],
      });

      const state = useKnowledgeStore.getState();
      expect(state.fieldSuggestions.firstName).toBeDefined();
      expect(state.fieldSuggestions.lastName).toBeDefined();
    });
  });

  describe('clearSuggestions', () => {
    it('clears specific field suggestions', () => {
      useKnowledgeStore.setState({
        fieldSuggestions: {
          firstName: [{ value: 'John' }] as any,
          lastName: [{ value: 'Smith' }] as any,
        },
      });

      useKnowledgeStore.getState().clearSuggestions('firstName');

      const state = useKnowledgeStore.getState();
      expect(state.fieldSuggestions.firstName).toBeUndefined();
      expect(state.fieldSuggestions.lastName).toBeDefined();
    });

    it('clears all suggestions when no field specified', () => {
      useKnowledgeStore.setState({
        fieldSuggestions: {
          firstName: [{ value: 'John' }] as any,
          lastName: [{ value: 'Smith' }] as any,
        },
      });

      useKnowledgeStore.getState().clearSuggestions();

      expect(useKnowledgeStore.getState().fieldSuggestions).toEqual({});
    });
  });

  describe('fetchStats', () => {
    it('fetches and sets stats', async () => {
      const mockStats = {
        totalSources: 10,
        totalChunks: 500,
        statusBreakdown: { COMPLETED: 8, PROCESSING: 2 },
        recentSources: [] as Array<{ id: string; title: string }>,
        embeddingQuota: 9000,
      };

      vi.mocked(knowledgeService.getKnowledgeBaseStats).mockResolvedValue({
        success: true,
        stats: mockStats as any,
      });

      await useKnowledgeStore.getState().fetchStats();

      expect(useKnowledgeStore.getState().stats).toEqual(mockStats);
    });
  });

  describe('reset', () => {
    it('resets to initial state', () => {
      useKnowledgeStore.setState({
        sources: [{ id: '1' } as any],
        searchResults: [{ id: 'r1' } as any],
        fieldSuggestions: { name: [] },
        stats: { totalSources: 5 } as any,
      });

      useKnowledgeStore.getState().reset();

      const state = useKnowledgeStore.getState();
      expect(state.sources).toEqual([]);
      expect(state.searchResults).toEqual([]);
      expect(state.fieldSuggestions).toEqual({});
      expect(state.stats).toBeNull();
    });
  });
});

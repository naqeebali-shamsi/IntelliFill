/**
 * Knowledge Base Store
 *
 * Zustand store for managing Knowledge Base state.
 * Handles document sources, search, and form suggestions.
 *
 * @module stores/knowledgeStore
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import knowledgeService, {
  DocumentSource,
  SearchResult,
  FieldSuggestion,
  KnowledgeBaseStats,
  SemanticSearchRequest,
  HybridSearchRequest,
  FormSuggestionsRequest,
  FieldSuggestRequest,
  ContextualSuggestRequest,
  DocumentSourceStatus,
} from '@/services/knowledgeService';

// ============================================================================
// Types
// ============================================================================

interface KnowledgeState {
  // Document Sources
  sources: DocumentSource[];
  sourcesLoading: boolean;
  sourcesError: string | null;
  selectedSourceId: string | null;
  sourcePagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };

  // Search
  searchResults: SearchResult[];
  searchLoading: boolean;
  searchError: string | null;
  searchQuery: string;
  searchTime: number;
  searchCached: boolean;

  // Suggestions
  fieldSuggestions: Record<string, FieldSuggestion[]>;
  suggestionsLoading: boolean;
  suggestionsError: string | null;

  // Stats
  stats: KnowledgeBaseStats | null;
  statsLoading: boolean;
  statsError: string | null;

  // Upload
  uploadProgress: number;
  uploadLoading: boolean;
  uploadError: string | null;

  // Actions - Sources
  fetchSources: (params?: {
    status?: DocumentSourceStatus;
    search?: string;
    limit?: number;
    offset?: number;
  }) => Promise<void>;
  fetchMoreSources: () => Promise<void>;
  uploadSource: (file: File, title: string) => Promise<DocumentSource | null>;
  deleteSource: (sourceId: string) => Promise<boolean>;
  selectSource: (sourceId: string | null) => void;
  refreshSource: (sourceId: string) => Promise<void>;

  // Actions - Search
  search: (request: SemanticSearchRequest) => Promise<void>;
  hybridSearch: (request: HybridSearchRequest) => Promise<void>;
  clearSearch: () => void;
  setSearchQuery: (query: string) => void;

  // Actions - Suggestions
  fetchFormSuggestions: (request: FormSuggestionsRequest) => Promise<void>;
  fetchFieldSuggestions: (request: FieldSuggestRequest) => Promise<FieldSuggestion[]>;
  fetchContextualSuggestions: (request: ContextualSuggestRequest) => Promise<FieldSuggestion[]>;
  clearSuggestions: (fieldName?: string) => void;

  // Actions - Stats
  fetchStats: () => Promise<void>;

  // Actions - Reset
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  // Document Sources
  sources: [],
  sourcesLoading: false,
  sourcesError: null,
  selectedSourceId: null,
  sourcePagination: {
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false,
  },

  // Search
  searchResults: [],
  searchLoading: false,
  searchError: null,
  searchQuery: '',
  searchTime: 0,
  searchCached: false,

  // Suggestions
  fieldSuggestions: {},
  suggestionsLoading: false,
  suggestionsError: null,

  // Stats
  stats: null,
  statsLoading: false,
  statsError: null,

  // Upload
  uploadProgress: 0,
  uploadLoading: false,
  uploadError: null,
};

// ============================================================================
// Store
// ============================================================================

export const useKnowledgeStore = create<KnowledgeState>()(
  immer((set, get) => ({
    ...initialState,

    // ========================================================================
    // Source Actions
    // ========================================================================

    fetchSources: async (params) => {
      set((state) => {
        state.sourcesLoading = true;
        state.sourcesError = null;
      });

      try {
        const response = await knowledgeService.getKnowledgeSources(params);

        set((state) => {
          state.sources = response.sources;
          state.sourcePagination = response.pagination;
          state.sourcesLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.sourcesError = error instanceof Error ? error.message : 'Failed to fetch sources';
          state.sourcesLoading = false;
        });
      }
    },

    fetchMoreSources: async () => {
      const { sourcePagination, sources } = get();

      if (!sourcePagination.hasMore) return;

      set((state) => {
        state.sourcesLoading = true;
      });

      try {
        const response = await knowledgeService.getKnowledgeSources({
          offset: sourcePagination.offset + sourcePagination.limit,
          limit: sourcePagination.limit,
        });

        set((state) => {
          state.sources = [...sources, ...response.sources];
          state.sourcePagination = response.pagination;
          state.sourcesLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.sourcesError = error instanceof Error ? error.message : 'Failed to fetch more sources';
          state.sourcesLoading = false;
        });
      }
    },

    uploadSource: async (file, title) => {
      set((state) => {
        state.uploadLoading = true;
        state.uploadError = null;
        state.uploadProgress = 0;
      });

      try {
        const response = await knowledgeService.uploadKnowledgeSource(
          file,
          title,
          (progress) => {
            set((state) => {
              state.uploadProgress = progress;
            });
          }
        );

        set((state) => {
          state.sources = [response.source, ...state.sources];
          state.sourcePagination.total += 1;
          state.uploadLoading = false;
          state.uploadProgress = 100;
        });

        return response.source;
      } catch (error) {
        set((state) => {
          state.uploadError = error instanceof Error ? error.message : 'Failed to upload source';
          state.uploadLoading = false;
        });
        return null;
      }
    },

    deleteSource: async (sourceId) => {
      try {
        await knowledgeService.deleteKnowledgeSource(sourceId);

        set((state) => {
          state.sources = state.sources.filter((s) => s.id !== sourceId);
          state.sourcePagination.total = Math.max(0, state.sourcePagination.total - 1);
          if (state.selectedSourceId === sourceId) {
            state.selectedSourceId = null;
          }
        });

        return true;
      } catch (error) {
        set((state) => {
          state.sourcesError = error instanceof Error ? error.message : 'Failed to delete source';
        });
        return false;
      }
    },

    selectSource: (sourceId) => {
      set((state) => {
        state.selectedSourceId = sourceId;
      });
    },

    refreshSource: async (sourceId) => {
      try {
        const response = await knowledgeService.getKnowledgeSource(sourceId);

        set((state) => {
          const index = state.sources.findIndex((s) => s.id === sourceId);
          if (index !== -1) {
            state.sources[index] = response.source;
          }
        });
      } catch (error) {
        console.error('Failed to refresh source:', error);
      }
    },

    // ========================================================================
    // Search Actions
    // ========================================================================

    search: async (request) => {
      set((state) => {
        state.searchLoading = true;
        state.searchError = null;
        state.searchQuery = request.query;
      });

      try {
        const response = await knowledgeService.semanticSearch(request);

        set((state) => {
          state.searchResults = response.results;
          state.searchTime = response.searchTime;
          state.searchCached = response.cached;
          state.searchLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.searchError = error instanceof Error ? error.message : 'Search failed';
          state.searchLoading = false;
        });
      }
    },

    hybridSearch: async (request) => {
      set((state) => {
        state.searchLoading = true;
        state.searchError = null;
        state.searchQuery = request.query;
      });

      try {
        const response = await knowledgeService.hybridSearch(request);

        set((state) => {
          state.searchResults = response.results;
          state.searchTime = response.searchTime;
          state.searchCached = response.cached;
          state.searchLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.searchError = error instanceof Error ? error.message : 'Search failed';
          state.searchLoading = false;
        });
      }
    },

    clearSearch: () => {
      set((state) => {
        state.searchResults = [];
        state.searchQuery = '';
        state.searchTime = 0;
        state.searchCached = false;
        state.searchError = null;
      });
    },

    setSearchQuery: (query) => {
      set((state) => {
        state.searchQuery = query;
      });
    },

    // ========================================================================
    // Suggestion Actions
    // ========================================================================

    fetchFormSuggestions: async (request) => {
      set((state) => {
        state.suggestionsLoading = true;
        state.suggestionsError = null;
      });

      try {
        const response = await knowledgeService.getFormSuggestions(request);

        set((state) => {
          state.fieldSuggestions = { ...state.fieldSuggestions, ...response.fields };
          state.suggestionsLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.suggestionsError = error instanceof Error ? error.message : 'Failed to fetch suggestions';
          state.suggestionsLoading = false;
        });
      }
    },

    fetchFieldSuggestions: async (request) => {
      set((state) => {
        state.suggestionsLoading = true;
        state.suggestionsError = null;
      });

      try {
        const response = await knowledgeService.getFieldSuggestions(request);

        set((state) => {
          state.fieldSuggestions[request.fieldName] = response.suggestions;
          state.suggestionsLoading = false;
        });

        return response.suggestions;
      } catch (error) {
        set((state) => {
          state.suggestionsError = error instanceof Error ? error.message : 'Failed to fetch suggestions';
          state.suggestionsLoading = false;
        });
        return [];
      }
    },

    fetchContextualSuggestions: async (request) => {
      set((state) => {
        state.suggestionsLoading = true;
        state.suggestionsError = null;
      });

      try {
        const response = await knowledgeService.getContextualSuggestions(request);

        set((state) => {
          state.fieldSuggestions[request.fieldName] = response.suggestions;
          state.suggestionsLoading = false;
        });

        return response.suggestions;
      } catch (error) {
        set((state) => {
          state.suggestionsError = error instanceof Error ? error.message : 'Failed to fetch suggestions';
          state.suggestionsLoading = false;
        });
        return [];
      }
    },

    clearSuggestions: (fieldName) => {
      set((state) => {
        if (fieldName) {
          delete state.fieldSuggestions[fieldName];
        } else {
          state.fieldSuggestions = {};
        }
      });
    },

    // ========================================================================
    // Stats Actions
    // ========================================================================

    fetchStats: async () => {
      set((state) => {
        state.statsLoading = true;
        state.statsError = null;
      });

      try {
        const response = await knowledgeService.getKnowledgeBaseStats();

        set((state) => {
          state.stats = response.stats;
          state.statsLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.statsError = error instanceof Error ? error.message : 'Failed to fetch stats';
          state.statsLoading = false;
        });
      }
    },

    // ========================================================================
    // Reset
    // ========================================================================

    reset: () => {
      set(initialState);
    },
  }))
);

// ============================================================================
// Selectors
// ============================================================================

export const useKnowledgeSources = () => useKnowledgeStore((state) => state.sources);
export const useKnowledgeSourcesLoading = () => useKnowledgeStore((state) => state.sourcesLoading);
export const useKnowledgeSourcesError = () => useKnowledgeStore((state) => state.sourcesError);
export const useSelectedSourceId = () => useKnowledgeStore((state) => state.selectedSourceId);

export const useSearchResults = () => useKnowledgeStore((state) => state.searchResults);
export const useSearchLoading = () => useKnowledgeStore((state) => state.searchLoading);
export const useSearchQuery = () => useKnowledgeStore((state) => state.searchQuery);

export const useFieldSuggestions = (fieldName: string) =>
  useKnowledgeStore((state) => state.fieldSuggestions[fieldName] || []);
export const useSuggestionsLoading = () => useKnowledgeStore((state) => state.suggestionsLoading);

export const useKnowledgeStats = () => useKnowledgeStore((state) => state.stats);
export const useKnowledgeStatsLoading = () => useKnowledgeStore((state) => state.statsLoading);

export const useUploadProgress = () => useKnowledgeStore((state) => state.uploadProgress);
export const useUploadLoading = () => useKnowledgeStore((state) => state.uploadLoading);

export default useKnowledgeStore;

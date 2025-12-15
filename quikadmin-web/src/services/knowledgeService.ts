/**
 * Knowledge Base Service
 *
 * API client for the Knowledge Base and Vector Search functionality.
 * Provides methods for:
 * - Document source management (upload, list, delete)
 * - Semantic and hybrid search
 * - Form field suggestions
 * - Knowledge base statistics
 *
 * @module services/knowledgeService
 */

import api from './api';

// ============================================================================
// Types
// ============================================================================

/**
 * Document source status
 */
export type DocumentSourceStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/**
 * Document source entity
 */
export interface DocumentSource {
  id: string;
  title: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  status: DocumentSourceStatus;
  chunkCount: number;
  processingTimeMs?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Search result from knowledge base
 */
export interface SearchResult {
  id: string;
  sourceId: string;
  sourceTitle: string;
  text: string;
  pageNumber: number | null;
  sectionHeader: string | null;
  chunkIndex: number;
  similarity: number;
  vectorScore?: number;
  keywordScore?: number;
  finalScore?: number;
}

/**
 * Semantic search request
 */
export interface SemanticSearchRequest {
  query: string;
  topK?: number;
  minScore?: number;
  sourceIds?: string[];
}

/**
 * Hybrid search request
 */
export interface HybridSearchRequest extends SemanticSearchRequest {
  hybridMode?: 'balanced' | 'semantic' | 'keyword';
  hybridWeight?: number;
}

/**
 * Search response
 */
export interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  query: string;
  totalResults: number;
  searchParams: Record<string, unknown>;
  cached: boolean;
  searchTime: number;
}

/**
 * Field suggestion
 */
export interface FieldSuggestion {
  value: string;
  confidence: number;
  sourceChunkId: string;
  sourceTitle: string;
  extractionMethod: 'regex' | 'semantic' | 'context';
  matchedText?: string;
}

/**
 * Form suggestions request
 */
export interface FormSuggestionsRequest {
  formId?: string;
  fieldNames: string[];
  fieldTypes?: Record<string, 'text' | 'date' | 'email' | 'phone' | 'number' | 'address' | 'name'>;
  context?: string;
  maxSuggestions?: number;
}

/**
 * Form suggestions response
 */
export interface FormSuggestionsResponse {
  success: boolean;
  formId?: string;
  fields: Record<string, FieldSuggestion[]>;
  totalSearchTime: number;
  cacheHits: number;
}

/**
 * Single field suggestion request
 */
export interface FieldSuggestRequest {
  fieldName: string;
  fieldType?: 'text' | 'date' | 'email' | 'phone' | 'number' | 'address' | 'name';
  context?: string;
  formContext?: string;
  maxSuggestions?: number;
}

/**
 * Single field suggestion response
 */
export interface FieldSuggestResponse {
  success: boolean;
  fieldName: string;
  suggestions: FieldSuggestion[];
  searchTime: number;
}

/**
 * Contextual suggestions request
 */
export interface ContextualSuggestRequest {
  fieldName: string;
  filledFields: Record<string, string>;
  maxSuggestions?: number;
}

/**
 * Knowledge base statistics
 */
export interface KnowledgeBaseStats {
  totalSources: number;
  totalChunks: number;
  statusBreakdown: Record<string, number>;
  recentSources: Array<{
    id: string;
    title: string;
    status: DocumentSourceStatus;
    createdAt: string;
  }>;
  embeddingQuota: number;
}

/**
 * Autocomplete suggestion
 */
export interface AutocompleteSuggestion {
  text: string;
  sourceTitle: string;
}

/**
 * Processing status with progress
 */
export interface ProcessingStatus {
  id: string;
  status: DocumentSourceStatus;
  errorMessage?: string;
  chunkCount?: number;
  processingTimeMs?: number;
  progress?: {
    stage: string;
    completedChunks: number;
    totalChunks: number;
    percentage: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Upload a document to the knowledge base
 */
export const uploadKnowledgeSource = async (
  file: File,
  title: string,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; source: DocumentSource; message: string }> => {
  const formData = new FormData();
  formData.append('document', file);
  formData.append('title', title);

  const response = await api.post('/knowledge/sources/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    },
  });

  return response.data;
};

/**
 * Get list of document sources
 */
export const getKnowledgeSources = async (params?: {
  status?: DocumentSourceStatus;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  sources: DocumentSource[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}> => {
  const response = await api.get('/knowledge/sources', { params });
  return response.data;
};

/**
 * Get a single document source by ID
 */
export const getKnowledgeSource = async (
  sourceId: string
): Promise<{
  success: boolean;
  source: DocumentSource & { chunkCount: number };
}> => {
  const response = await api.get(`/knowledge/sources/${sourceId}`);
  return response.data;
};

/**
 * Delete a document source
 */
export const deleteKnowledgeSource = async (
  sourceId: string
): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete(`/knowledge/sources/${sourceId}`);
  return response.data;
};

/**
 * Get processing status of a document source
 */
export const getSourceProcessingStatus = async (
  sourceId: string
): Promise<{ success: boolean; status: ProcessingStatus }> => {
  const response = await api.get(`/knowledge/sources/${sourceId}/status`);
  return response.data;
};

/**
 * Perform semantic search
 */
export const semanticSearch = async (
  request: SemanticSearchRequest
): Promise<SearchResponse> => {
  const response = await api.post('/knowledge/search', request);
  return response.data;
};

/**
 * Perform hybrid search (semantic + keyword)
 */
export const hybridSearch = async (
  request: HybridSearchRequest
): Promise<SearchResponse> => {
  const response = await api.post('/knowledge/search/hybrid', request);
  return response.data;
};

/**
 * Get autocomplete suggestions for search
 */
export const getAutocompleteSuggestions = async (
  query: string,
  limit?: number
): Promise<{
  success: boolean;
  suggestions: AutocompleteSuggestion[];
  query: string;
}> => {
  const response = await api.post('/knowledge/suggest', { query, limit });
  return response.data;
};

/**
 * Get form field suggestions
 */
export const getFormSuggestions = async (
  request: FormSuggestionsRequest
): Promise<FormSuggestionsResponse> => {
  const response = await api.post('/knowledge/suggest/form', request);
  return response.data;
};

/**
 * Get suggestions for a single field
 */
export const getFieldSuggestions = async (
  request: FieldSuggestRequest
): Promise<FieldSuggestResponse> => {
  const response = await api.post('/knowledge/suggest/field', request);
  return response.data;
};

/**
 * Get contextual suggestions based on filled fields
 */
export const getContextualSuggestions = async (
  request: ContextualSuggestRequest
): Promise<FieldSuggestResponse> => {
  const response = await api.post('/knowledge/suggest/contextual', request);
  return response.data;
};

/**
 * Get knowledge base statistics
 */
export const getKnowledgeBaseStats = async (): Promise<{
  success: boolean;
  stats: KnowledgeBaseStats;
}> => {
  const response = await api.get('/knowledge/stats');
  return response.data;
};

// ============================================================================
// Default Export
// ============================================================================

const knowledgeService = {
  // Sources
  uploadKnowledgeSource,
  getKnowledgeSources,
  getKnowledgeSource,
  deleteKnowledgeSource,
  getSourceProcessingStatus,
  // Search
  semanticSearch,
  hybridSearch,
  getAutocompleteSuggestions,
  // Suggestions
  getFormSuggestions,
  getFieldSuggestions,
  getContextualSuggestions,
  // Stats
  getKnowledgeBaseStats,
};

export default knowledgeService;

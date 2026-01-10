/**
 * React Query hook for fetching documents with filtering, sorting, and pagination
 * @module hooks/useDocuments
 */

import { useQuery, UseQueryOptions, keepPreviousData } from '@tanstack/react-query';
import { getDocuments } from '@/services/api';
import {
  Document,
  DocumentListResponse,
  DocumentFilter,
  DocumentSort,
  DocumentQueryParams,
  normalizeDocumentStatus,
} from '@/types/document';

export interface UseDocumentsOptions {
  /**
   * Filter criteria
   */
  filter?: DocumentFilter;

  /**
   * Sort configuration
   */
  sort?: DocumentSort;

  /**
   * Page number
   */
  page?: number;

  /**
   * Page size
   */
  pageSize?: number;

  /**
   * React Query options
   */
  queryOptions?: Omit<UseQueryOptions<DocumentListResponse, Error>, 'queryKey' | 'queryFn'>;
}

/**
 * Fetch documents from the API with filtering and sorting
 */
async function fetchDocuments(options: UseDocumentsOptions = {}): Promise<DocumentListResponse> {
  const { filter, sort, page = 1, pageSize = 25 } = options;

  // Build query parameters
  const params: DocumentQueryParams = {
    limit: pageSize,
    page,
  };

  // Add search query
  if (filter?.searchQuery) {
    params.search = filter.searchQuery;
  }

  if (filter?.fileType && filter.fileType.length > 0) {
    params.type = filter.fileType;
  }

  // Add sort parameter (format: "field:direction")
  if (sort) {
    params.sort = `${sort.field}:${sort.direction}`;
  }

  const response = await getDocuments(params);

  // Normalize document statuses from backend (COMPLETED -> completed)
  const documents = (response.documents || []).map((doc) => ({
    ...doc,
    status: normalizeDocumentStatus(doc.status as string),
  }));

  return {
    ...response,
    documents,
  } as DocumentListResponse;
}

/**
 * Hook to fetch documents with React Query
 *
 * Features:
 * - Automatic caching and background refetching
 * - Stale-while-revalidate pattern
 * - Automatic refetch when filters/sort/page changes
 * - Loading and error states
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useDocuments({
 *   filter: { status: ['completed'], searchQuery: 'invoice' },
 *   sort: { field: 'createdAt', direction: 'desc' },
 *   page: 1,
 *   pageSize: 25,
 * });
 * ```
 */
export function useDocuments(options: UseDocumentsOptions = {}) {
  const { filter, sort, page, pageSize, queryOptions } = options;

  return useQuery<DocumentListResponse, Error>({
    queryKey: ['documents', { filter, sort, page, pageSize }],
    queryFn: () => fetchDocuments(options),
    // Cache data for 30 seconds
    staleTime: 30000,

    // Keep cache for 5 minutes (renamed from cacheTime in v5)
    gcTime: 300000,

    // Keep previous data during pagination for smooth transitions
    placeholderData: keepPreviousData,

    // Retry failed requests twice
    retry: 2,

    // Refetch on window focus for fresh data
    refetchOnWindowFocus: true,

    // Don't refetch on mount if data is fresh
    refetchOnMount: false,

    ...queryOptions,
  });
}

/**
 * Apply client-side filtering for filters not supported by backend
 * (status, date range, min confidence, tags)
 */
export function applyClientSideFilters(documents: Document[], filter: DocumentFilter): Document[] {
  let filtered = documents;

  // Filter by status (multiple)
  if (filter.status && filter.status.length > 0) {
    filtered = filtered.filter((doc) => filter.status!.includes(doc.status));
  }

  // Filter by date range
  if (filter.dateRange) {
    const { start, end } = filter.dateRange;

    if (start) {
      filtered = filtered.filter((doc) => new Date(doc.createdAt) >= start);
    }

    if (end) {
      filtered = filtered.filter((doc) => new Date(doc.createdAt) <= end);
    }
  }

  // Filter by minimum confidence
  if (filter.minConfidence !== undefined && filter.minConfidence > 0) {
    filtered = filtered.filter(
      (doc) =>
        doc.confidence !== null &&
        doc.confidence !== undefined &&
        doc.confidence >= filter.minConfidence!
    );
  }

  // Filter by tags
  if (filter.tags && filter.tags.length > 0) {
    filtered = filtered.filter((doc) => doc.tags?.some((tag) => filter.tags!.includes(tag)));
  }

  return filtered;
}

/**
 * Apply client-side sorting
 */
export function applyClientSideSorting(documents: Document[], sort: DocumentSort): Document[] {
  return [...documents].sort((a, b) => {
    const aValue = a[sort.field];
    const bValue = b[sort.field];

    // Handle null/undefined values
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    // Compare values
    let comparison = 0;
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      comparison = aValue.localeCompare(bValue);
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue;
    } else {
      comparison = String(aValue).localeCompare(String(bValue));
    }

    return sort.direction === 'asc' ? comparison : -comparison;
  });
}

/**
 * Apply client-side pagination
 */
export function applyClientSidePagination(
  documents: Document[],
  page: number,
  pageSize: number
): { data: Document[]; total: number; totalPages: number } {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    data: documents.slice(start, end),
    total: documents.length,
    totalPages: Math.ceil(documents.length / pageSize),
  };
}

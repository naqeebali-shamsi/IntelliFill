/**
 * React Query hook for fetching single document details
 * @module hooks/useDocumentDetail
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import api from '@/services/api';
import {
  Document,
  DocumentDetailResponse,
  normalizeDocumentStatus,
} from '@/types/document';

/**
 * Fetch document details from API
 */
async function fetchDocumentDetail(documentId: string): Promise<Document> {
  const response = await api.get<DocumentDetailResponse>(`/documents/${documentId}`);

  // Normalize status from backend
  const document = {
    ...response.data.document,
    status: normalizeDocumentStatus(response.data.document.status as string),
  };

  return document;
}

/**
 * Hook to fetch single document details
 *
 * Features:
 * - Only fetches when documentId is provided
 * - Caches document data
 * - Automatic refetch on window focus
 *
 * @example
 * ```tsx
 * const { data: document, isLoading, error } = useDocumentDetail('doc-123');
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error.message} />;
 * if (!document) return null;
 *
 * return <DocumentView document={document} />;
 * ```
 */
export function useDocumentDetail(
  documentId: string | null,
  options?: Omit<UseQueryOptions<Document, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<Document, Error>({
    queryKey: ['document', documentId],
    queryFn: () => fetchDocumentDetail(documentId!),
    // Only fetch if documentId is provided
    enabled: !!documentId,

    // Cache data for 1 minute
    staleTime: 60000,

    // Keep cache for 5 minutes (renamed from cacheTime in v5)
    gcTime: 300000,

    // Retry failed requests once
    retry: 1,

    // Refetch on window focus
    refetchOnWindowFocus: true,

    ...options,
  });
}

/**
 * Hook to fetch document's extracted data only
 *
 * Useful for form filling feature where we only need the extracted data
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useDocumentData('doc-123');
 *
 * if (data) {
 *   // Use data.extractedData for form filling
 * }
 * ```
 */
export function useDocumentData(
  documentId: string | null,
  options?: Omit<UseQueryOptions<{ fileName: string; data: Record<string, any> }, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<{ fileName: string; data: Record<string, any> }, Error>({
    queryKey: ['documentData', documentId],
    queryFn: async () => {
      const response = await api.get(`/documents/${documentId}/data`);
      return response.data;
    },
    // Only fetch if documentId is provided
    enabled: !!documentId,

    // Cache data for 5 minutes
    staleTime: 300000,

    // Keep cache for 10 minutes (renamed from cacheTime in v5)
    gcTime: 600000,

    // Retry once
    retry: 1,

    ...options,
  });
}

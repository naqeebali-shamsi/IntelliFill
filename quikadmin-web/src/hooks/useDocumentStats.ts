/**
 * React Query hook for fetching document statistics
 * @module hooks/useDocumentStats
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { Document, DocumentStatistics } from '@/types/document';

/**
 * Calculate statistics from documents array
 * Used for client-side statistics calculation when backend doesn't provide them
 */
export function calculateDocumentStats(documents: Document[]): DocumentStatistics {
  const stats: DocumentStatistics = {
    total: documents.length,
    completed: 0,
    processing: 0,
    failed: 0,
    pending: 0,
    totalSize: 0,
    averageConfidence: 0,
    successRate: 0,
  };

  let confidenceSum = 0;
  let confidenceCount = 0;

  documents.forEach((doc) => {
    // Count by status
    switch (doc.status) {
      case 'completed':
        stats.completed++;
        break;
      case 'processing':
        stats.processing++;
        break;
      case 'failed':
        stats.failed++;
        break;
      case 'pending':
        stats.pending++;
        break;
    }

    // Sum file sizes
    stats.totalSize += doc.fileSize || 0;

    // Sum confidence scores
    if (doc.confidence !== null && doc.confidence !== undefined) {
      confidenceSum += doc.confidence;
      confidenceCount++;
    }
  });

  // Calculate averages and rates
  if (confidenceCount > 0) {
    stats.averageConfidence = Math.round((confidenceSum / confidenceCount) * 100) / 100;
  }

  if (stats.total > 0) {
    stats.successRate = Math.round((stats.completed / stats.total) * 100 * 10) / 10;
  }

  return stats;
}

/**
 * Hook to get document statistics
 *
 * Calculates stats from the provided documents array
 *
 * @example
 * ```tsx
 * const { data: documents } = useDocuments();
 * const stats = useDocumentStats(documents?.documents || []);
 *
 * return (
 *   <div>
 *     <p>Total: {stats.total}</p>
 *     <p>Completed: {stats.completed}</p>
 *     <p>Success Rate: {stats.successRate}%</p>
 *   </div>
 * );
 * ```
 */
export function useDocumentStats(
  documents: Document[],
  options?: Omit<UseQueryOptions<DocumentStatistics, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<DocumentStatistics, Error>({
    queryKey: ['documentStats', documents.length],
    queryFn: () => calculateDocumentStats(documents),
    // Keep data fresh
    staleTime: 0,

    // Calculate immediately when documents change
    enabled: true,

    // Don't retry (it's a pure computation)
    retry: false,

    ...options,
  });
}

/**
 * Synchronous version that returns stats directly without React Query
 *
 * Use this when you don't need caching or just want immediate stats
 *
 * @example
 * ```tsx
 * const stats = getDocumentStats(documents);
 * ```
 */
export function getDocumentStats(documents: Document[]): DocumentStatistics {
  return calculateDocumentStats(documents);
}

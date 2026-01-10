/**
 * React Query mutations for document actions (delete, download, bulk operations)
 * @module hooks/useDocumentActions
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  deleteDocument as deleteDocumentAPI,
  downloadDocument as downloadDocumentAPI,
  bulkDownloadZip,
  reprocessDocument as reprocessDocumentAPI,
  batchReprocessDocuments,
} from '@/services/api';
import { toast } from 'sonner';
import { DocumentActionResult, BulkActionResult } from '@/types/document';
import { getUserErrorMessage, isRetryableError, getErrorSuggestion } from '@/utils/errorMessages';

/**
 * Hook for document deletion
 *
 * @example
 * ```tsx
 * const { deleteDocument, isDeleting } = useDocumentActions();
 *
 * await deleteDocument.mutateAsync('doc-id');
 * ```
 */
export function useDocumentDelete() {
  const queryClient = useQueryClient();

  return useMutation<DocumentActionResult, Error, string>({
    mutationFn: async (documentId: string) => {
      await deleteDocumentAPI(documentId);
      return {
        success: true,
        documentId,
        message: 'Document deleted successfully',
      };
    },
    onSuccess: (data, documentId) => {
      // Invalidate documents query to refetch
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documentStats'] });

      // Remove from cache
      queryClient.removeQueries({ queryKey: ['document', documentId] });

      toast.success('Document deleted successfully');
    },
    onError: (error) => {
      const userMessage = getUserErrorMessage(error);
      toast.error(userMessage);

      if (isRetryableError(error)) {
        toast.info('This may be a temporary issue. You can try again.');
      }

      const suggestion = getErrorSuggestion(error);
      if (suggestion) {
        toast.info(suggestion);
      }
    },
  });
}

/**
 * Hook for document download
 *
 * @example
 * ```tsx
 * const { downloadDocument } = useDocumentActions();
 *
 * await downloadDocument.mutateAsync({ id: 'doc-id', fileName: 'invoice.pdf' });
 * ```
 */
export function useDocumentDownload() {
  return useMutation<void, Error, { id: string; fileName: string }>({
    mutationFn: async ({ id, fileName }) => {
      const blob = await downloadDocumentAPI(id);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: (_, { fileName }) => {
      toast.success(`Downloaded ${fileName}`);
    },
    onError: (error) => {
      const userMessage = getUserErrorMessage(error);
      toast.error(userMessage);

      if (isRetryableError(error)) {
        toast.info('This may be a temporary issue. You can try again.');
      }

      const suggestion = getErrorSuggestion(error);
      if (suggestion) {
        toast.info(suggestion);
      }
    },
  });
}

/**
 * Hook for bulk document deletion
 *
 * @example
 * ```tsx
 * const { bulkDelete } = useDocumentActions();
 *
 * await bulkDelete.mutateAsync(['doc-1', 'doc-2', 'doc-3']);
 * ```
 */
export function useBulkDelete() {
  const queryClient = useQueryClient();

  return useMutation<BulkActionResult, Error, string[]>({
    mutationFn: async (documentIds: string[]) => {
      const results = await Promise.allSettled(documentIds.map((id) => deleteDocumentAPI(id)));

      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      const failedCount = results.filter((r) => r.status === 'rejected').length;

      const failures = results
        .map((result, index) => {
          if (result.status === 'rejected') {
            return {
              id: documentIds[index],
              fileName: `Document ${index + 1}`,
              error: result.reason?.message || 'Unknown error',
            };
          }
          return null;
        })
        .filter((f) => f !== null) as Array<{ id: string; fileName: string; error: string }>;

      return {
        success: failedCount === 0,
        successCount,
        failedCount,
        failures: failures.length > 0 ? failures : undefined,
        message: `Deleted ${successCount} of ${documentIds.length} documents`,
      };
    },
    onSuccess: (result) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documentStats'] });

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.warning(`${result.message}. ${result.failedCount} failed.`);
      }
    },
    onError: (error) => {
      const userMessage = getUserErrorMessage(error);
      toast.error(userMessage);

      if (isRetryableError(error)) {
        toast.info('This may be a temporary issue. You can try again.');
      }

      const suggestion = getErrorSuggestion(error);
      if (suggestion) {
        toast.info(suggestion);
      }
    },
  });
}

/**
 * Hook for bulk document download as ZIP
 * Downloads multiple files as a single ZIP archive
 *
 * @example
 * ```tsx
 * const { bulkDownload } = useDocumentActions();
 *
 * await bulkDownload.mutateAsync([
 *   { id: 'doc-1', fileName: 'file1.pdf' },
 *   { id: 'doc-2', fileName: 'file2.pdf' },
 * ]);
 * ```
 */
export function useBulkDownload() {
  return useMutation<BulkActionResult, Error, Array<{ id: string; fileName: string }>>({
    mutationFn: async (documents) => {
      const documentIds = documents.map((doc) => doc.id);

      // Download as ZIP
      const blob = await bulkDownloadZip(documentIds);

      // Create download link for ZIP
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `documents-${Date.now()}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      return {
        success: true,
        successCount: documents.length,
        failedCount: 0,
        message: `Downloaded ${documents.length} documents as ZIP`,
      };
    },
    onMutate: (documents) => {
      toast.info(`Preparing ${documents.length} documents for download...`);
    },
    onSuccess: (result) => {
      toast.success(result.message);
    },
    onError: (error) => {
      const userMessage = getUserErrorMessage(error);
      toast.error(userMessage);

      if (isRetryableError(error)) {
        toast.info('This may be a temporary issue. You can try again.');
      }

      const suggestion = getErrorSuggestion(error);
      if (suggestion) {
        toast.info(suggestion);
      }
    },
  });
}

/**
 * Hook for single document reprocessing
 */
export function useDocumentReprocess() {
  const queryClient = useQueryClient();

  return useMutation<{ jobId: string }, Error, string>({
    mutationFn: async (documentId: string) => {
      return reprocessDocumentAPI(documentId);
    },
    onSuccess: (data, documentId) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      toast.success('Document queued for reprocessing');
    },
    onError: (error) => {
      const userMessage = getUserErrorMessage(error);
      toast.error(userMessage);

      if (isRetryableError(error)) {
        toast.info('This may be a temporary issue. You can try again.');
      }

      const suggestion = getErrorSuggestion(error);
      if (suggestion) {
        toast.info(suggestion);
      }
    },
  });
}

/**
 * Hook for batch document reprocessing
 */
export function useBulkReprocess() {
  const queryClient = useQueryClient();

  return useMutation<any, Error, string[]>({
    mutationFn: async (documentIds: string[]) => {
      return batchReprocessDocuments(documentIds);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success(`${data.totalQueued} documents queued for reprocessing`);
    },
    onError: (error) => {
      const userMessage = getUserErrorMessage(error);
      toast.error(userMessage);

      if (isRetryableError(error)) {
        toast.info('This may be a temporary issue. You can try again.');
      }

      const suggestion = getErrorSuggestion(error);
      if (suggestion) {
        toast.info(suggestion);
      }
    },
  });
}

/**
 * Combined hook for all document actions
 *
 * @example
 * ```tsx
 * const {
 *   deleteDocument,
 *   downloadDocument,
 *   bulkDelete,
 *   bulkDownload,
 *   isDeleting,
 *   isDownloading,
 *   reprocessDocument,
 *   bulkReprocess,
 * } = useDocumentActions();
 * ```
 */
export function useDocumentActions() {
  const deleteDoc = useDocumentDelete();
  const download = useDocumentDownload();
  const bulkDeleteMutation = useBulkDelete();
  const bulkDownloadMutation = useBulkDownload();
  const reprocess = useDocumentReprocess();
  const bulkReprocessMutation = useBulkReprocess();

  return {
    deleteDocument: deleteDoc.mutateAsync,
    isDeleting: deleteDoc.isPending,
    downloadDocument: download.mutateAsync,
    isDownloading: download.isPending,
    bulkDelete: bulkDeleteMutation.mutateAsync,
    isBulkDeleting: bulkDeleteMutation.isPending,
    bulkDownload: bulkDownloadMutation.mutateAsync,
    isBulkDownloading: bulkDownloadMutation.isPending,
    reprocessDocument: reprocess.mutateAsync,
    isReprocessing: reprocess.isPending,
    bulkReprocess: bulkReprocessMutation.mutateAsync,
    isBulkReprocessing: bulkReprocessMutation.isPending,
  };
}

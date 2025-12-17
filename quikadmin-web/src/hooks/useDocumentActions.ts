/**
 * React Query mutations for document actions (delete, download, bulk operations)
 * @module hooks/useDocumentActions
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteDocument as deleteDocumentAPI, downloadDocument as downloadDocumentAPI } from '@/services/api';
import { toast } from 'sonner';
import { Document, DocumentActionResult, BulkActionResult } from '@/types/document';

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
      toast.error(`Failed to delete document: ${error.message}`);
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
      toast.error(`Download failed: ${error.message}`);
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
      const results = await Promise.allSettled(
        documentIds.map((id) => deleteDocumentAPI(id))
      );

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
      toast.error(`Bulk delete failed: ${error.message}`);
    },
  });
}

/**
 * Hook for bulk document download
 * Downloads multiple files as individual downloads
 * (ZIP download would require backend endpoint)
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
  return useMutation<
    BulkActionResult,
    Error,
    Array<{ id: string; fileName: string }>
  >({
    mutationFn: async (documents) => {
      // Download files sequentially to avoid overwhelming the browser
      const results = [];

      for (const doc of documents) {
        try {
          const blob = await downloadDocumentAPI(doc.id);

          // Create download
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', doc.fileName);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);

          results.push({ success: true });

          // Small delay between downloads
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          results.push({ success: false, error });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.filter((r) => !r.success).length;

      return {
        success: failedCount === 0,
        successCount,
        failedCount,
        message: `Downloaded ${successCount} of ${documents.length} documents`,
      };
    },
    onMutate: (documents) => {
      toast.info(`Downloading ${documents.length} documents...`);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.warning(`${result.message}. ${result.failedCount} failed.`);
      }
    },
    onError: (error) => {
      toast.error(`Bulk download failed: ${error.message}`);
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

/**
 * Hook for single document reprocessing
 */
export function useDocumentReprocess() {
  const queryClient = useQueryClient();

  return useMutation<{ jobId: string }, Error, string>({
    mutationFn: async (documentId: string) => {
      const response = await import('@/services/api').then(m => m.reprocessDocument(documentId));
      return response;
    },
    onSuccess: (data, documentId) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      toast.success('Document queued for reprocessing');
    },
    onError: (error) => {
      toast.error(`Reprocessing failed: ${error.message}`);
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
      const response = await import('@/services/api').then(m => m.batchReprocessDocuments(documentIds));
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success(`${data.totalQueued} documents queued for reprocessing`);
    },
    onError: (error) => {
      toast.error(`Batch reprocessing failed: ${error.message}`);
    },
  });
}

/**
 * Combined hook for all document actions
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

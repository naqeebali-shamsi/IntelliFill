/**
 * Job polling hook for tracking async processing status
 * @module hooks/useJobPolling
 */

import { useQuery } from 'react-query';
import { getJobStatus } from '@/services/api';
import { JobStatus, UseJobPollingOptions } from '@/types/upload';
import { useUploadStore } from '@/stores/uploadStore';
import { toast } from 'sonner';

/**
 * Hook for polling job processing status
 * Uses React Query for smart polling with automatic stop when completed
 * @param jobId - Job ID to poll
 * @param options - Polling options
 * @returns Query result with job status
 */
export function useJobPolling(
  jobId: string | null | undefined,
  options: UseJobPollingOptions = {}
) {
  const {
    interval = 2000, // Poll every 2 seconds
    enabled = true,
    onComplete,
    onError,
    timeout = 300000, // 5 minutes timeout
  } = options;

  const setFileResult = useUploadStore((state) => state.setFileResult);
  const setFileError = useUploadStore((state) => state.setFileError);
  const updateFileProgress = useUploadStore((state) => state.updateFileProgress);
  // Don't subscribe to files - use getState() inside callbacks to avoid re-render loops
  const getFiles = () => useUploadStore.getState().files;

  return useQuery<JobStatus, Error>(
    ['job-status', jobId],
    async (): Promise<JobStatus> => {
      if (!jobId) {
        throw new Error('No job ID provided');
      }
      const result = await getJobStatus(jobId);
      // Map API response to JobStatus type
      return {
        id: jobId,
        status: result.status as 'pending' | 'processing' | 'completed' | 'failed',
        progress: result.progress,
        result: result.result,
        error: result.error,
      };
    },
    {
      enabled: enabled && !!jobId,
      refetchInterval: (data) => {
        // Stop polling if job is completed or failed
        if (!data) return interval;

        const isFinished = data.status === 'completed' || data.status === 'failed';
        return isFinished ? false : interval;
      },
      refetchIntervalInBackground: false,
      staleTime: 0, // Always fetch fresh data
      cacheTime: 5 * 60 * 1000, // Cache for 5 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      onSuccess: (data) => {
        // Find file with this jobId
        const file = getFiles().find((f) => f.jobId === jobId);
        if (!file) return;

        // Update progress
        if (data.progress !== undefined) {
          updateFileProgress(file.id, data.progress);
        }

        // Handle completion
        if (data.status === 'completed') {
          setFileResult(file.id, {
            jobId: data.id,
            status: data.status,
            data: data.result,
            metadata: data.metadata ? {
              fileName: file.file.name,
              fileSize: file.file.size,
              ...(data.metadata as Record<string, any>),
            } : undefined,
          });

          toast.success(`${file.file.name} processed successfully`);

          if (onComplete) {
            onComplete(data.result);
          }
        }

        // Handle failure
        if (data.status === 'failed') {
          const errorMessage = data.error || 'Processing failed';
          setFileError(file.id, errorMessage);

          toast.error(`Failed to process ${file.file.name}: ${errorMessage}`);

          if (onError) {
            onError(errorMessage);
          }
        }
      },
      onError: (error) => {
        // Find file with this jobId
        const file = getFiles().find((f) => f.jobId === jobId);
        if (file) {
          setFileError(file.id, error.message || 'Job polling failed');
        }

        if (onError) {
          onError(error.message);
        }
      },
    }
  );
}

/**
 * Hook for polling multiple jobs
 * @param jobIds - Array of job IDs to poll
 * @param options - Polling options
 * @returns Array of query results
 */
export function useMultiJobPolling(
  jobIds: string[],
  options: UseJobPollingOptions = {}
) {
  const queries = jobIds.map((jobId) => useJobPolling(jobId, options));

  return {
    queries,
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
    allCompleted: queries.every(
      (q) => q.data?.status === 'completed' || q.data?.status === 'failed'
    ),
    results: queries.map((q) => q.data).filter(Boolean) as JobStatus[],
  };
}

/**
 * Hook for polling all processing files in the upload queue
 * Automatically creates polling queries for all files with jobIds
 * @param options - Polling options
 */
export function useQueueJobPolling(options: UseJobPollingOptions = {}) {
  // Only subscribe to the count of processing files to minimize re-renders
  const processingCount = useUploadStore((state) =>
    state.files.filter((f) => f.status === 'processing' && f.jobId).length
  );

  // Get actual job IDs using getState() to avoid subscription issues
  const getJobIds = () => 
    useUploadStore.getState().files
      .filter((f) => f.status === 'processing' && f.jobId)
      .map((f) => f.jobId!);
  
  // Get job IDs once when count changes
  const jobIds = processingCount > 0 ? getJobIds() : [];

  return useMultiJobPolling(jobIds, options);
}

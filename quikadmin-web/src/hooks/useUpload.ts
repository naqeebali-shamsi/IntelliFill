/**
 * Upload hook for managing concurrent file uploads
 * Uses p-queue for reliable queue processing
 * @module hooks/useUpload
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PQueue from 'p-queue';
import { useUploadStore, uploadSelectors } from '@/stores/uploadStore';
import { uploadDocuments } from '@/services/api';
import { UseUploadOptions, UploadFile } from '@/types/upload';
import { toast } from 'sonner';
import { getUserErrorMessage, isRetryableError, getErrorSuggestion } from '@/utils/errorMessages';

/**
 * Hook for managing file uploads with concurrent queue processing
 * Uses p-queue library for reliable queue management
 * @param options - Upload configuration options
 * @returns Upload functions and state
 */
export function useUpload(options: UseUploadOptions = {}) {
  const {
    onSuccess,
    onError,
    onCancel,
    onProgress,
    maxConcurrent = 3,
    autoStart = true,
    retryOnError = false,
  } = options;

  // Store actions
  const updateFileStatus = useUploadStore((state) => state.updateFileStatus);
  const updateFileProgress = useUploadStore((state) => state.updateFileProgress);
  const setFileError = useUploadStore((state) => state.setFileError);
  const setFileResult = useUploadStore((state) => state.setFileResult);
  const setFileJobId = useUploadStore((state) => state.setFileJobId);
  const setFileCancelToken = useUploadStore((state) => state.setFileCancelToken);
  const setMaxConcurrent = useUploadStore((state) => state.setMaxConcurrent);
  // Task 305: Store actions for cleanup
  const cancelAllActiveUploads = useUploadStore((state) => state.cancelAllActiveUploads);
  const cleanupStale = useUploadStore((state) => state.cleanupStale);

  // Store selectors - use memoized selectors to prevent infinite loops
  const pendingFilesCount = useUploadStore(
    (state) => state.files.filter((f) => f.status === 'pending').length
  );
  const uploadingFilesCount = useUploadStore(
    (state) => state.files.filter((f) => f.status === 'uploading').length
  );

  // Get actual files arrays when needed (inside effects, not as reactive state)
  const getPendingFiles = () =>
    useUploadStore.getState().files.filter((f) => f.status === 'pending');
  const getUploadingFiles = () =>
    useUploadStore.getState().files.filter((f) => f.status === 'uploading');

  // Initialize p-queue with concurrency control
  const queueRef = useRef<PQueue | null>(null);
  const [isQueueProcessing, setIsQueueProcessing] = useState(false);
  const enqueuedFilesRef = useRef<Set<string>>(new Set());

  // Initialize queue if not exists or if concurrency changed
  useEffect(() => {
    if (!queueRef.current || queueRef.current.concurrency !== maxConcurrent) {
      // Clean up old queue if exists
      if (queueRef.current) {
        queueRef.current.clear();
        queueRef.current.pause();
      }

      queueRef.current = new PQueue({
        concurrency: maxConcurrent,
        interval: 100, // Process queue every 100ms
        intervalCap: maxConcurrent, // Allow maxConcurrent jobs per interval
      });

      // Track queue state
      queueRef.current.on('active', () => {
        setIsQueueProcessing(true);
      });

      queueRef.current.on('idle', () => {
        setIsQueueProcessing(false);
      });
    }

    // Update store setting
    setMaxConcurrent(maxConcurrent);

    // Task 305: Cleanup on unmount - abort active uploads and clear queue
    return () => {
      if (queueRef.current) {
        queueRef.current.clear();
        queueRef.current.pause();
      }
      enqueuedFilesRef.current.clear();

      // Task 305: Abort all active HTTP requests to prevent memory leaks
      // This ensures network requests don't continue after component unmount
      cancelAllActiveUploads();
    };
  }, [maxConcurrent, setMaxConcurrent, cancelAllActiveUploads]);

  // Task 305: Periodic cleanup of stale completed/failed/cancelled states
  // Runs every 5 minutes to prevent memory accumulation from old uploads
  useEffect(() => {
    const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

    const cleanupTimer = setInterval(() => {
      const removed = cleanupStale(STALE_THRESHOLD_MS);
      if (removed > 0) {
        console.debug(`[useUpload] Cleaned up ${removed} stale upload entries`);
      }
    }, CLEANUP_INTERVAL_MS);

    return () => {
      clearInterval(cleanupTimer);
    };
  }, [cleanupStale]);

  /**
   * Upload a single file
   */
  const uploadSingleFile = useCallback(
    async (uploadFile: UploadFile) => {
      const { id, file } = uploadFile;

      // Mark as uploading
      updateFileStatus(id, 'uploading');

      // Create abort controller for cancellation
      const cancelToken = new AbortController();
      setFileCancelToken(id, cancelToken);

      try {
        // Prepare form data
        const formData = new FormData();
        formData.append('documents', file);

        // Upload with progress tracking
        const result = await uploadDocuments(formData, (progress) => {
          updateFileProgress(id, progress);
          if (onProgress) {
            onProgress(uploadFile, progress);
          }
        });

        // Check if cancelled during upload
        if (cancelToken.signal.aborted) {
          updateFileStatus(id, 'cancelled');
          if (onCancel) {
            onCancel(uploadFile);
          }
          return;
        }

        // Upload successful, mark as processing
        updateFileStatus(id, 'processing');

        // Store job ID if available
        if (result.jobId) {
          setFileJobId(id, result.jobId);
        }

        // If result is immediately available (synchronous processing)
        if (result.status === 'completed' || result.data) {
          setFileResult(id, {
            jobId: result.jobId || id,
            status: 'completed',
            data: result.data,
            metadata: {
              fileName: file.name,
              fileSize: file.size,
            },
          });

          if (onSuccess) {
            onSuccess(uploadFile, {
              jobId: result.jobId || id,
              status: 'completed',
              data: result.data,
            });
          }

          toast.success(`${file.name} uploaded successfully`);
        }
        // Otherwise, job polling will handle completion
        else {
          // Keep status as 'processing', polling will update it
          toast.success(`${file.name} uploaded, processing...`);
        }
      } catch (error: any) {
        // Check if cancelled
        if (error.name === 'CanceledError' || cancelToken.signal.aborted) {
          updateFileStatus(id, 'cancelled');
          if (onCancel) {
            onCancel(uploadFile);
          }
          return;
        }

        // Handle upload error
        const userMessage = getUserErrorMessage(error);

        setFileError(id, userMessage);

        if (onError) {
          onError(uploadFile, error);
        }

        toast.error(userMessage);

        if (isRetryableError(error)) {
          toast.info('This may be a temporary issue. You can try again.');
        }

        const suggestion = getErrorSuggestion(error);
        if (suggestion) {
          toast.info(suggestion);
        }

        // Retry if enabled
        if (retryOnError) {
          toast.info(`Retrying ${file.name}...`);
          // Remove from enqueued set so it can be retried
          enqueuedFilesRef.current.delete(id);
          // Wait 2 seconds before retry
          setTimeout(() => {
            updateFileStatus(id, 'pending');
          }, 2000);
        } else {
          // Remove from enqueued set on error (no retry)
          enqueuedFilesRef.current.delete(id);
        }
      }
    },
    [
      updateFileStatus,
      updateFileProgress,
      setFileError,
      setFileResult,
      setFileJobId,
      setFileCancelToken,
      onSuccess,
      onError,
      onCancel,
      onProgress,
      retryOnError,
    ]
  );

  /**
   * Add file to queue for processing
   */
  const enqueueFileRef = useRef<((uploadFile: UploadFile) => Promise<void>) | null>(null);

  const enqueueFile = useCallback(
    async (uploadFile: UploadFile) => {
      if (!queueRef.current) return;

      // Add to queue - p-queue handles concurrency automatically
      return queueRef.current.add(() => uploadSingleFile(uploadFile));
    },
    [uploadSingleFile]
  );

  // Store latest enqueueFile in ref
  useEffect(() => {
    enqueueFileRef.current = enqueueFile;
  }, [enqueueFile]);

  /**
   * Auto-process queue when files are added
   */
  useEffect(() => {
    if (!autoStart || !queueRef.current || !enqueueFileRef.current) return;
    if (pendingFilesCount === 0) return;

    // Queue is paused if autoStart is false
    if (queueRef.current.isPaused) {
      queueRef.current.start();
    }

    // Get fresh state from store (non-reactive)
    const currentPendingFiles = getPendingFiles();
    const currentUploadingFiles = getUploadingFiles();

    // Add all pending files to queue (only if not already enqueued or uploading)
    currentPendingFiles.forEach((file) => {
      const isUploading = currentUploadingFiles.some((f) => f.id === file.id);
      const isEnqueued = enqueuedFilesRef.current.has(file.id);

      if (!isUploading && !isEnqueued) {
        enqueuedFilesRef.current.add(file.id);
        enqueueFileRef.current(file).catch((error) => {
          // Error handled in uploadSingleFile
          // Remove from enqueued set on error so it can be retried
          enqueuedFilesRef.current.delete(file.id);
          console.error('Failed to enqueue file:', error);
        });
      }
    });
  }, [autoStart, pendingFilesCount]);

  /**
   * Start processing the upload queue manually
   */
  const startUploads = useCallback(() => {
    if (!queueRef.current || !enqueueFileRef.current) return;

    // Unpause queue if paused
    if (queueRef.current.isPaused) {
      queueRef.current.start();
    }

    // Get fresh state from store
    const currentPendingFiles = getPendingFiles();
    const currentUploadingFiles = getUploadingFiles();

    // Process any pending files
    currentPendingFiles.forEach((file) => {
      const isUploading = currentUploadingFiles.some((f) => f.id === file.id);
      const isEnqueued = enqueuedFilesRef.current.has(file.id);
      if (!isUploading && !isEnqueued) {
        enqueuedFilesRef.current.add(file.id);
        enqueueFileRef.current(file).catch((error) => {
          enqueuedFilesRef.current.delete(file.id);
          console.error('Failed to enqueue file:', error);
        });
      }
    });
  }, []);

  /**
   * Pause uploads
   */
  const pauseUploads = useCallback(() => {
    if (!queueRef.current) return;
    queueRef.current.pause();
    useUploadStore.setState({ autoStart: false });
  }, []);

  /**
   * Resume uploads
   */
  const resumeUploads = useCallback(() => {
    if (!queueRef.current || !enqueueFileRef.current) return;
    queueRef.current.start();
    useUploadStore.setState({ autoStart: true });

    // Get fresh state from store
    const currentPendingFiles = getPendingFiles();
    const currentUploadingFiles = getUploadingFiles();

    // Process pending files
    currentPendingFiles.forEach((file) => {
      const isUploading = currentUploadingFiles.some((f) => f.id === file.id);
      const isEnqueued = enqueuedFilesRef.current.has(file.id);
      if (!isUploading && !isEnqueued) {
        enqueuedFilesRef.current.add(file.id);
        enqueueFileRef.current(file).catch((error) => {
          enqueuedFilesRef.current.delete(file.id);
          console.error('Failed to enqueue file:', error);
        });
      }
    });
  }, []);

  return {
    /**
     * Start processing uploads
     */
    startUploads,

    /**
     * Pause uploads
     */
    pauseUploads,

    /**
     * Resume uploads
     */
    resumeUploads,

    /**
     * Check if queue is processing
     */
    isProcessing: isQueueProcessing || uploadingFilesCount > 0,

    /**
     * Active uploads count
     */
    activeUploads: uploadingFilesCount,

    /**
     * Pending uploads count
     */
    pendingUploads: pendingFilesCount,
  };
}

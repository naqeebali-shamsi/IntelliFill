/**
 * Upload queue state management with Zustand
 * Manages file upload queue, status, and concurrent upload limits
 * @module stores/uploadStore
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { UploadFile, UploadStatus, UploadResult, UploadStats } from '@/types/upload';

// =================== STORE INTERFACES ===================

interface UploadState {
  /**
   * Files in the upload queue
   */
  files: UploadFile[];

  /**
   * Maximum concurrent uploads
   */
  maxConcurrent: number;

  /**
   * Auto-start uploads when files are added
   */
  autoStart: boolean;
}

interface UploadActions {
  /**
   * Add files to the upload queue
   */
  addFiles: (files: File[]) => void;

  /**
   * Remove a file from the queue
   */
  removeFile: (id: string) => void;

  /**
   * Update file status
   */
  updateFileStatus: (id: string, status: UploadStatus) => void;

  /**
   * Update file progress
   */
  updateFileProgress: (id: string, progress: number) => void;

  /**
   * Set file error
   */
  setFileError: (id: string, error: string) => void;

  /**
   * Set file result
   */
  setFileResult: (id: string, result: UploadResult) => void;

  /**
   * Set file job ID
   */
  setFileJobId: (id: string, jobId: string) => void;

  /**
   * Set file cancel token
   */
  setFileCancelToken: (id: string, cancelToken: AbortController) => void;

  /**
   * Cancel a file upload
   */
  cancelUpload: (id: string) => void;

  /**
   * Retry a failed upload
   */
  retryUpload: (id: string) => void;

  /**
   * Clear completed files
   */
  clearCompleted: () => void;

  /**
   * Clear failed files
   */
  clearFailed: () => void;

  /**
   * Clear all files
   */
  clearAll: () => void;

  /**
   * Get files by status
   */
  getFilesByStatus: (status: UploadStatus) => UploadFile[];

  /**
   * Get upload statistics
   */
  getStats: () => UploadStats;

  /**
   * Update max concurrent uploads
   */
  setMaxConcurrent: (max: number) => void;

  /**
   * Toggle auto-start
   */
  setAutoStart: (autoStart: boolean) => void;
}

type UploadStore = UploadState & UploadActions;

// =================== INITIAL STATE ===================

const initialState: UploadState = {
  files: [],
  maxConcurrent: 3,
  autoStart: true,
};

// =================== HELPER FUNCTIONS ===================

/**
 * Generate unique ID for upload file
 */
function generateUploadId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create UploadFile from File
 */
function createUploadFile(file: File): UploadFile {
  return {
    id: generateUploadId(),
    file,
    status: 'pending',
    progress: 0,
    addedAt: Date.now(),
  };
}

// =================== STORE IMPLEMENTATION ===================

export const useUploadStore = create<UploadStore>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // =================== QUEUE MANAGEMENT ===================

      addFiles: (files: File[]) => {
        set((state) => {
          const newFiles = files.map(createUploadFile);
          state.files.push(...newFiles);
        });
      },

      removeFile: (id: string) => {
        set((state) => {
          // Cancel upload if in progress
          const file = state.files.find((f) => f.id === id);
          if (file?.cancelToken) {
            file.cancelToken.abort();
          }

          // Remove from queue
          state.files = state.files.filter((f) => f.id !== id);
        });
      },

      // =================== STATUS UPDATES ===================

      updateFileStatus: (id: string, status: UploadStatus) => {
        set((state) => {
          const file = state.files.find((f) => f.id === id);
          if (file) {
            file.status = status;

            // Set timestamps
            if (status === 'uploading' && !file.startedAt) {
              file.startedAt = Date.now();
            }
            if (status === 'completed' || status === 'failed' || status === 'cancelled') {
              file.completedAt = Date.now();
            }

            // Clear error on retry
            if (status === 'pending' && file.error) {
              file.error = undefined;
            }
          }
        });
      },

      updateFileProgress: (id: string, progress: number) => {
        set((state) => {
          const file = state.files.find((f) => f.id === id);
          if (file) {
            file.progress = Math.min(100, Math.max(0, progress));
          }
        });
      },

      setFileError: (id: string, error: string) => {
        set((state) => {
          const file = state.files.find((f) => f.id === id);
          if (file) {
            file.error = error;
            file.status = 'failed';
            file.completedAt = Date.now();
          }
        });
      },

      setFileResult: (id: string, result: UploadResult) => {
        set((state) => {
          const file = state.files.find((f) => f.id === id);
          if (file) {
            file.result = result;
            file.status = 'completed';
            file.progress = 100;
            file.completedAt = Date.now();
          }
        });
      },

      setFileJobId: (id: string, jobId: string) => {
        set((state) => {
          const file = state.files.find((f) => f.id === id);
          if (file) {
            file.jobId = jobId;
          }
        });
      },

      setFileCancelToken: (id: string, cancelToken: AbortController) => {
        set((state) => {
          const file = state.files.find((f) => f.id === id);
          if (file) {
            file.cancelToken = cancelToken;
          }
        });
      },

      // =================== ACTIONS ===================

      cancelUpload: (id: string) => {
        set((state) => {
          const file = state.files.find((f) => f.id === id);
          if (file) {
            // Abort the upload if in progress
            if (file.cancelToken) {
              file.cancelToken.abort();
              file.cancelToken = undefined;
            }

            file.status = 'cancelled';
            file.completedAt = Date.now();
          }
        });
      },

      retryUpload: (id: string) => {
        set((state) => {
          const file = state.files.find((f) => f.id === id);
          if (file && (file.status === 'failed' || file.status === 'cancelled')) {
            file.status = 'pending';
            file.progress = 0;
            file.error = undefined;
            file.result = undefined;
            file.jobId = undefined;
            file.startedAt = undefined;
            file.completedAt = undefined;
            file.cancelToken = undefined;
          }
        });
      },

      clearCompleted: () => {
        set((state) => {
          state.files = state.files.filter((f) => f.status !== 'completed');
        });
      },

      clearFailed: () => {
        set((state) => {
          state.files = state.files.filter((f) => f.status !== 'failed');
        });
      },

      clearAll: () => {
        set((state) => {
          // Cancel all in-progress uploads
          state.files.forEach((file) => {
            if (file.cancelToken) {
              file.cancelToken.abort();
            }
          });
          state.files = [];
        });
      },

      // =================== SELECTORS ===================

      getFilesByStatus: (status: UploadStatus) => {
        return get().files.filter((f) => f.status === status);
      },

      getStats: (): UploadStats => {
        const files = get().files;

        const stats: UploadStats = {
          total: files.length,
          pending: 0,
          uploading: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          totalBytes: 0,
          uploadedBytes: 0,
          overallProgress: 0,
        };

        files.forEach((file) => {
          // Count by status
          switch (file.status) {
            case 'pending':
            case 'validating':
              stats.pending++;
              break;
            case 'uploading':
              stats.uploading++;
              break;
            case 'processing':
              stats.processing++;
              break;
            case 'completed':
              stats.completed++;
              break;
            case 'failed':
              stats.failed++;
              break;
            case 'cancelled':
              stats.cancelled++;
              break;
          }

          // Calculate sizes
          stats.totalBytes += file.file.size;
          stats.uploadedBytes += (file.file.size * file.progress) / 100;
        });

        // Calculate overall progress
        if (stats.totalBytes > 0) {
          stats.overallProgress = Math.round((stats.uploadedBytes / stats.totalBytes) * 100);
        }

        return stats;
      },

      // =================== CONFIGURATION ===================

      setMaxConcurrent: (max: number) => {
        set((state) => {
          state.maxConcurrent = Math.max(1, Math.min(10, max));
        });
      },

      setAutoStart: (autoStart: boolean) => {
        set((state) => {
          state.autoStart = autoStart;
        });
      },
    })),
    {
      name: 'Upload Queue Store',
    }
  )
);

// =================== SELECTORS ===================

/**
 * Reusable selectors for the upload store
 */
export const uploadSelectors = {
  files: (state: UploadStore) => state.files,
  pendingFiles: (state: UploadStore) => state.files.filter((f) => f.status === 'pending'),
  uploadingFiles: (state: UploadStore) => state.files.filter((f) => f.status === 'uploading'),
  processingFiles: (state: UploadStore) => state.files.filter((f) => f.status === 'processing'),
  completedFiles: (state: UploadStore) => state.files.filter((f) => f.status === 'completed'),
  failedFiles: (state: UploadStore) => state.files.filter((f) => f.status === 'failed'),
  stats: (state: UploadStore) => state.getStats(),
  hasActiveUploads: (state: UploadStore) =>
    state.files.some((f) => f.status === 'uploading' || f.status === 'processing'),
  canUploadMore: (state: UploadStore) => {
    const uploadingCount = state.files.filter((f) => f.status === 'uploading').length;
    return uploadingCount < state.maxConcurrent;
  },
};

// =================== HOOKS ===================

/**
 * Hook for upload queue management
 * Uses useShallow to prevent infinite re-renders from object comparison
 */
export const useUploadQueue = () =>
  useUploadStore(
    useShallow((state) => ({
    files: state.files,
    addFiles: state.addFiles,
    removeFile: state.removeFile,
    cancelUpload: state.cancelUpload,
    retryUpload: state.retryUpload,
    clearCompleted: state.clearCompleted,
    clearAll: state.clearAll,
    }))
  );

/**
 * Hook for upload statistics
 * Returns primitive values that don't cause re-render loops
 */
export const useUploadStats = (): UploadStats => {
  // Subscribe only to primitives, not computed objects
  const total = useUploadStore((state) => state.files.length);
  const pending = useUploadStore((state) => 
    state.files.filter((f) => f.status === 'pending' || f.status === 'validating').length
  );
  const uploading = useUploadStore((state) => 
    state.files.filter((f) => f.status === 'uploading').length
  );
  const processing = useUploadStore((state) => 
    state.files.filter((f) => f.status === 'processing').length
  );
  const completed = useUploadStore((state) => 
    state.files.filter((f) => f.status === 'completed').length
  );
  const failed = useUploadStore((state) => 
    state.files.filter((f) => f.status === 'failed').length
  );
  const cancelled = useUploadStore((state) => 
    state.files.filter((f) => f.status === 'cancelled').length
  );
  const totalBytes = useUploadStore((state) => 
    state.files.reduce((sum, f) => sum + f.file.size, 0)
  );
  const uploadedBytes = useUploadStore((state) => 
    state.files.reduce((sum, f) => sum + (f.file.size * f.progress) / 100, 0)
  );
  const overallProgress = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;

  return {
    total,
    pending,
    uploading,
    processing,
    completed,
    failed,
    cancelled,
    totalBytes,
    uploadedBytes,
    overallProgress,
  };
};

/**
 * Hook for upload status updates
 */
export const useUploadStatus = () =>
  useUploadStore((state) => ({
    updateFileStatus: state.updateFileStatus,
    updateFileProgress: state.updateFileProgress,
    setFileError: state.setFileError,
    setFileResult: state.setFileResult,
    setFileJobId: state.setFileJobId,
    setFileCancelToken: state.setFileCancelToken,
  }));

/**
 * Type definitions for document upload feature
 * @module types/upload
 */

/**
 * Upload file status
 */
export type UploadStatus =
  | 'pending'      // File added to queue, waiting to upload
  | 'validating'   // Validating file before upload
  | 'uploading'    // Currently uploading to server
  | 'processing'   // Server is processing the file
  | 'completed'    // Upload and processing complete
  | 'failed'       // Upload or processing failed
  | 'cancelled';   // Upload cancelled by user

/**
 * File in the upload queue
 */
export interface UploadFile {
  /**
   * Unique identifier for this upload
   */
  id: string;

  /**
   * The actual File object
   */
  file: File;

  /**
   * Current status of the upload
   */
  status: UploadStatus;

  /**
   * Upload progress percentage (0-100)
   */
  progress: number;

  /**
   * Job ID from backend (for polling status)
   */
  jobId?: string;

  /**
   * Error message if status is 'failed'
   */
  error?: string;

  /**
   * Processing result from backend
   */
  result?: UploadResult;

  /**
   * Timestamp when file was added to queue
   */
  addedAt: number;

  /**
   * Timestamp when upload started
   */
  startedAt?: number;

  /**
   * Timestamp when upload completed/failed
   */
  completedAt?: number;

  /**
   * Cancel function to abort upload
   */
  cancelToken?: AbortController;
}

/**
 * Upload result from backend
 */
export interface UploadResult {
  /**
   * Job ID for tracking
   */
  jobId: string;

  /**
   * Processing status
   */
  status: string;

  /**
   * Extracted data (if completed)
   */
  data?: Record<string, any>;

  /**
   * Processing metadata
   */
  metadata?: {
    fileName: string;
    fileSize: number;
    pageCount?: number;
    confidence?: number;
    processingTime?: number;
  };

  /**
   * Download URL for processed file
   */
  downloadUrl?: string;
}

/**
 * File validation error
 */
export interface FileValidationError {
  /**
   * The file that failed validation
   */
  file: File;

  /**
   * Error code
   */
  code: string;

  /**
   * Human-readable error message
   */
  message: string;
}

/**
 * Upload queue configuration
 */
export interface UploadQueueConfig {
  /**
   * Maximum concurrent uploads
   */
  maxConcurrent: number;

  /**
   * Maximum file size in bytes
   */
  maxFileSize: number;

  /**
   * Maximum total size for all files in bytes
   */
  maxTotalSize: number;

  /**
   * Maximum number of files
   */
  maxFiles: number;

  /**
   * Accepted file types (MIME types)
   */
  acceptedTypes: Record<string, string[]>;

  /**
   * Auto-start uploads when files are added
   */
  autoStart: boolean;

  /**
   * Retry failed uploads
   */
  retryOnError: boolean;

  /**
   * Number of retry attempts
   */
  maxRetries: number;
}

/**
 * Upload statistics
 */
export interface UploadStats {
  /**
   * Total files in queue
   */
  total: number;

  /**
   * Files waiting to upload
   */
  pending: number;

  /**
   * Files currently uploading
   */
  uploading: number;

  /**
   * Files being processed
   */
  processing: number;

  /**
   * Files completed successfully
   */
  completed: number;

  /**
   * Files that failed
   */
  failed: number;

  /**
   * Files cancelled
   */
  cancelled: number;

  /**
   * Total bytes to upload
   */
  totalBytes: number;

  /**
   * Bytes uploaded so far
   */
  uploadedBytes: number;

  /**
   * Overall progress percentage (0-100)
   */
  overallProgress: number;
}

/**
 * Job polling status from backend
 */
export interface JobStatus {
  /**
   * Job ID
   */
  id: string;

  /**
   * Current status
   */
  status: 'pending' | 'processing' | 'completed' | 'failed';

  /**
   * Processing progress (0-100)
   */
  progress: number;

  /**
   * Result data (if completed)
   */
  result?: any;

  /**
   * Error message (if failed)
   */
  error?: string;

  /**
   * Job metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Upload hook options
 */
export interface UseUploadOptions {
  /**
   * Callback when upload succeeds
   */
  onSuccess?: (file: UploadFile, result: UploadResult) => void;

  /**
   * Callback when upload fails
   */
  onError?: (file: UploadFile, error: Error) => void;

  /**
   * Callback when upload is cancelled
   */
  onCancel?: (file: UploadFile) => void;

  /**
   * Callback for progress updates
   */
  onProgress?: (file: UploadFile, progress: number) => void;

  /**
   * Maximum concurrent uploads
   */
  maxConcurrent?: number;

  /**
   * Auto-start uploads
   */
  autoStart?: boolean;

  /**
   * Enable retry on error
   */
  retryOnError?: boolean;
}

/**
 * Job polling hook options
 */
export interface UseJobPollingOptions {
  /**
   * Polling interval in milliseconds
   */
  interval?: number;

  /**
   * Enable polling
   */
  enabled?: boolean;

  /**
   * Callback when job completes
   */
  onComplete?: (result: any) => void;

  /**
   * Callback when job fails
   */
  onError?: (error: string) => void;

  /**
   * Stop polling after this many seconds
   */
  timeout?: number;
}

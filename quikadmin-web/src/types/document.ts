/**
 * Type definitions for document library feature
 * @module types/document
 */

/**
 * Document processing status
 * Note: Backend uses UPPERCASE (COMPLETED), frontend normalizes to lowercase
 */
export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Document file type
 */
export type DocumentFileType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'text/csv'
  | 'image/jpeg'
  | 'image/png'
  | 'text/plain'
  | string;

/**
 * Document entity from backend
 * Extends Record<string, unknown> for DataTable compatibility
 */
export interface Document extends Record<string, unknown> {
  /**
   * Unique document ID
   */
  id: string;

  /**
   * Original file name
   */
  fileName: string;

  /**
   * MIME type of the file
   */
  fileType: DocumentFileType;

  /**
   * File size in bytes
   */
  fileSize: number;

  /**
   * Current processing status
   */
  status: DocumentStatus;

  /**
   * ML confidence score (0-1)
   */
  confidence?: number | null;

  /**
   * Number of pages in document
   */
  pageCount?: number | null;

  /**
   * Extracted structured data (decrypted on retrieval)
   */
  extractedData?: Record<string, any> | null;

  /**
   * Processing error message (if failed)
   */
  error?: string | null;

  /**
   * Associated job ID for polling
   */
  jobId?: string | null;

  /**
   * Document tags for organization
   */
  tags?: string[];

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;

  /**
   * When document was uploaded
   */
  createdAt: string;

  /**
   * When document was last updated
   */
  updatedAt?: string;

  /**
   * When processing completed
   */
  processedAt?: string | null;

  /**
   * User ID (owner)
   */
  userId?: string;
}

/**
 * Document list response from API
 */
export interface DocumentListResponse {
  /**
   * Success flag
   */
  success: boolean;

  /**
   * Array of documents
   */
  documents: Document[];

  /**
   * Total count (for pagination)
   */
  total?: number;

  /**
   * Current page number
   */
  page?: number;

  /**
   * Page size
   */
  pageSize?: number;

  /**
   * Total pages
   */
  totalPages?: number;
}

/**
 * Document detail response from API
 */
export interface DocumentDetailResponse {
  /**
   * Success flag
   */
  success: boolean;

  /**
   * Document with full details
   */
  document: Document;
}

/**
 * Document statistics
 */
export interface DocumentStatistics {
  /**
   * Total documents
   */
  total: number;

  /**
   * Completed documents
   */
  completed: number;

  /**
   * Processing documents
   */
  processing: number;

  /**
   * Failed documents
   */
  failed: number;

  /**
   * Pending documents
   */
  pending: number;

  /**
   * Total storage used (bytes)
   */
  totalSize: number;

  /**
   * Average confidence score
   */
  averageConfidence?: number;

  /**
   * Success rate percentage
   */
  successRate?: number;
}

/**
 * Document filter criteria
 */
export interface DocumentFilter {
  /**
   * Filter by status (multiple)
   */
  status?: DocumentStatus[];

  /**
   * Filter by file type (multiple)
   */
  fileType?: string[];

  /**
   * Date range filter
   */
  dateRange?: {
    start: Date | null;
    end: Date | null;
  };

  /**
   * Search query (filename, content)
   */
  searchQuery?: string;

  /**
   * Filter by tags
   */
  tags?: string[];

  /**
   * Minimum confidence score
   */
  minConfidence?: number;
}

/**
 * Document sort configuration
 */
export interface DocumentSort {
  /**
   * Field to sort by
   */
  field: 'fileName' | 'createdAt' | 'fileSize' | 'status' | 'confidence' | 'processedAt';

  /**
   * Sort direction
   */
  direction: 'asc' | 'desc';
}

/**
 * View mode for document list
 */
export type DocumentViewMode = 'grid' | 'table';

/**
 * Date range preset
 */
export type DateRangePreset = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

/**
 * Document query parameters for API
 */
export interface DocumentQueryParams {
  /**
   * File type filter
   */
  type?: string;

  /**
   * Search query
   */
  search?: string;

  /**
   * Result limit
   */
  limit?: number;

  /**
   * Page number (when pagination added)
   */
  page?: number;

  /**
   * Sort field and direction
   */
  sort?: string;
}

/**
 * Document action result
 */
export interface DocumentActionResult {
  /**
   * Success flag
   */
  success: boolean;

  /**
   * Result message
   */
  message?: string;

  /**
   * Error message
   */
  error?: string;

  /**
   * Affected document ID
   */
  documentId?: string;
}

/**
 * Bulk action result
 */
export interface BulkActionResult {
  /**
   * Success flag
   */
  success: boolean;

  /**
   * Number of successful operations
   */
  successCount: number;

  /**
   * Number of failed operations
   */
  failedCount: number;

  /**
   * Failed document IDs with errors
   */
  failures?: Array<{
    id: string;
    fileName: string;
    error: string;
  }>;

  /**
   * Overall message
   */
  message?: string;
}

/**
 * Helper function to normalize document status from backend
 */
export function normalizeDocumentStatus(status: string): DocumentStatus {
  const normalized = status.toLowerCase();
  if (['pending', 'processing', 'completed', 'failed'].includes(normalized)) {
    return normalized as DocumentStatus;
  }
  return 'pending'; // Default fallback
}

/**
 * Helper function to get file type category
 */
export function getFileTypeCategory(mimeType: string): 'pdf' | 'docx' | 'csv' | 'image' | 'other' {
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('wordprocessingml')) return 'docx';
  if (mimeType.includes('csv')) return 'csv';
  if (mimeType.includes('image')) return 'image';
  return 'other';
}

/**
 * Helper function to get friendly file type name
 */
export function getFriendlyFileType(mimeType: string): string {
  const typeMap: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'text/csv': 'CSV',
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'text/plain': 'TXT',
  };

  return typeMap[mimeType] || mimeType.split('/')[1]?.toUpperCase() || 'Unknown';
}

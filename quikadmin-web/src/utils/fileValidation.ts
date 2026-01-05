/**
 * File validation utilities for upload feature
 * @module utils/fileValidation
 */

import { FileValidationError } from '@/types/upload';
import { BYTES_PER_KB } from '@/constants/file';

/**
 * Accepted file types with their MIME types and extensions
 */
export const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'text/csv': ['.csv'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
} as const;

/**
 * File size limits
 */
export const FILE_SIZE_LIMITS = {
  /**
   * Maximum size for a single file (10MB)
   */
  MAX_FILE_SIZE: 10 * BYTES_PER_KB * BYTES_PER_KB, // 10MB

  /**
   * Maximum total size for all files (50MB)
   */
  MAX_TOTAL_SIZE: 50 * BYTES_PER_KB * BYTES_PER_KB, // 50MB

  /**
   * Maximum number of files
   */
  MAX_FILES: 10,
} as const;

/**
 * Validation error codes
 */
export const VALIDATION_ERROR_CODES = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  TOO_MANY_FILES: 'TOO_MANY_FILES',
  TOTAL_SIZE_EXCEEDED: 'TOTAL_SIZE_EXCEEDED',
  EMPTY_FILE: 'EMPTY_FILE',
  DUPLICATE_FILE: 'DUPLICATE_FILE',
} as const;

/**
 * Validate a single file
 * @param file - File to validate
 * @returns Error message or null if valid
 */
export function validateFile(file: File): string | null {
  // Check if file is empty
  if (file.size === 0) {
    return 'File is empty';
  }

  // Check file size
  if (file.size > FILE_SIZE_LIMITS.MAX_FILE_SIZE) {
    const maxSizeMB = FILE_SIZE_LIMITS.MAX_FILE_SIZE / (BYTES_PER_KB * BYTES_PER_KB);
    return `File size exceeds ${maxSizeMB}MB limit`;
  }

  // Check file type
  const isValidType = Object.keys(ACCEPTED_FILE_TYPES).includes(file.type);
  if (!isValidType) {
    const acceptedExtensions = Object.values(ACCEPTED_FILE_TYPES).flat().join(', ');
    return `Invalid file type. Accepted types: ${acceptedExtensions}`;
  }

  return null;
}

/**
 * Validate multiple files
 * @param files - Files to validate
 * @param existingFiles - Already queued files (for duplicate and total size check)
 * @returns Object with valid files and invalid files with errors
 */
export function validateFiles(
  files: File[],
  existingFiles: File[] = []
): {
  valid: File[];
  invalid: FileValidationError[];
} {
  const valid: File[] = [];
  const invalid: FileValidationError[] = [];

  // Check total number of files
  const totalFiles = files.length + existingFiles.length;
  if (totalFiles > FILE_SIZE_LIMITS.MAX_FILES) {
    // Reject all new files if total exceeds limit
    files.forEach((file) => {
      invalid.push({
        file,
        code: VALIDATION_ERROR_CODES.TOO_MANY_FILES,
        message: `Maximum ${FILE_SIZE_LIMITS.MAX_FILES} files allowed`,
      });
    });
    return { valid, invalid };
  }

  // Calculate total size
  const existingTotalSize = existingFiles.reduce((sum, f) => sum + f.size, 0);
  let newTotalSize = 0;

  // Get existing file names for duplicate detection
  const existingFileNames = new Set(existingFiles.map((f) => f.name));

  for (const file of files) {
    // Check for duplicate
    if (existingFileNames.has(file.name)) {
      invalid.push({
        file,
        code: VALIDATION_ERROR_CODES.DUPLICATE_FILE,
        message: `File "${file.name}" is already in the queue`,
      });
      continue;
    }

    // Validate individual file
    const error = validateFile(file);
    if (error) {
      invalid.push({
        file,
        code: error.includes('empty')
          ? VALIDATION_ERROR_CODES.EMPTY_FILE
          : error.includes('size')
            ? VALIDATION_ERROR_CODES.FILE_TOO_LARGE
            : VALIDATION_ERROR_CODES.INVALID_FILE_TYPE,
        message: error,
      });
      continue;
    }

    // Check total size
    newTotalSize += file.size;
    if (existingTotalSize + newTotalSize > FILE_SIZE_LIMITS.MAX_TOTAL_SIZE) {
      const maxSizeMB = FILE_SIZE_LIMITS.MAX_TOTAL_SIZE / (BYTES_PER_KB * BYTES_PER_KB);
      invalid.push({
        file,
        code: VALIDATION_ERROR_CODES.TOTAL_SIZE_EXCEEDED,
        message: `Total upload size exceeds ${maxSizeMB}MB limit`,
      });
      continue;
    }

    // File is valid
    valid.push(file);
    existingFileNames.add(file.name);
  }

  return { valid, invalid };
}

/**
 * Get human-readable file size
 * @param bytes - Size in bytes
 * @returns Formatted size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(BYTES_PER_KB));

  return `${Math.round((bytes / Math.pow(BYTES_PER_KB, i)) * 100) / 100} ${sizes[i]}`;
}

/**
 * Get file extension from filename
 * @param filename - File name
 * @returns File extension (lowercase, with dot)
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length === 1) return '';
  return `.${parts[parts.length - 1].toLowerCase()}`;
}

/**
 * Check if a file type is accepted
 * @param mimeType - MIME type to check
 * @returns True if accepted
 */
export function isAcceptedFileType(mimeType: string): boolean {
  return Object.keys(ACCEPTED_FILE_TYPES).includes(mimeType);
}

/**
 * Get accepted file extensions as a string
 * @returns Comma-separated list of extensions
 */
export function getAcceptedExtensions(): string {
  return Object.values(ACCEPTED_FILE_TYPES).flat().join(', ');
}

/**
 * Get file type category for display
 * @param mimeType - MIME type
 * @returns File type category
 */
export function getFileTypeCategory(mimeType: string): 'pdf' | 'docx' | 'csv' | 'image' | 'other' {
  if (mimeType === 'application/pdf') return 'pdf';
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    return 'docx';
  }
  if (mimeType === 'text/csv') return 'csv';
  if (mimeType.startsWith('image/')) return 'image';
  return 'other';
}

/**
 * Calculate total size of files
 * @param files - Array of files
 * @returns Total size in bytes
 */
export function calculateTotalSize(files: File[]): number {
  return files.reduce((sum, file) => sum + file.size, 0);
}

/**
 * Check if files can be added to queue
 * @param newFiles - Files to add
 * @param existingFiles - Files already in queue
 * @returns Object with canAdd boolean and reason if not
 */
export function canAddFiles(
  newFiles: File[],
  existingFiles: File[]
): { canAdd: boolean; reason?: string } {
  const totalFiles = newFiles.length + existingFiles.length;
  if (totalFiles > FILE_SIZE_LIMITS.MAX_FILES) {
    return {
      canAdd: false,
      reason: `Maximum ${FILE_SIZE_LIMITS.MAX_FILES} files allowed. You have ${existingFiles.length} files in queue.`,
    };
  }

  const existingSize = calculateTotalSize(existingFiles);
  const newSize = calculateTotalSize(newFiles);
  const totalSize = existingSize + newSize;

  if (totalSize > FILE_SIZE_LIMITS.MAX_TOTAL_SIZE) {
    const maxSizeMB = FILE_SIZE_LIMITS.MAX_TOTAL_SIZE / (BYTES_PER_KB * BYTES_PER_KB);
    const currentSizeMB = Math.round((existingSize / (BYTES_PER_KB * BYTES_PER_KB)) * 100) / 100;
    return {
      canAdd: false,
      reason: `Total size exceeds ${maxSizeMB}MB limit. Current: ${currentSizeMB}MB`,
    };
  }

  return { canAdd: true };
}

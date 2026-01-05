/**
 * File Constants
 *
 * Centralized constants for file operations and formatting.
 *
 * @module constants/file
 */

/**
 * Bytes per kilobyte (base-2)
 * Used for file size calculations and formatting
 */
export const BYTES_PER_KB = 1024 as const;

/**
 * File size unit labels
 */
export const FILE_SIZE_UNITS = ['Bytes', 'KB', 'MB', 'GB', 'TB'] as const;

/**
 * File type display names
 */
export const FILE_TYPE_NAMES = {
  pdf: 'PDF Document',
  docx: 'Word Document',
  csv: 'CSV File',
  image: 'Image',
  other: 'File',
} as const;

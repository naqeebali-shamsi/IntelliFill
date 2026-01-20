/**
 * Centralized File Upload Configuration
 *
 * Provides standardized file upload configs and multer middleware factories
 * to ensure consistent security validation across all upload endpoints.
 *
 * Usage:
 *   import { createUploadMiddleware, FileUploadPresets } from '../config/fileUpload.config';
 *   const upload = createUploadMiddleware(FileUploadPresets.CLIENT_DOCUMENTS);
 */

import multer, { FileFilterCallback, StorageEngine } from 'multer';
import path from 'path';
import { Request } from 'express';
import { fileValidationService } from '../services/fileValidation.service';
import { FileValidationError } from '../utils/FileValidationError';
import { logger } from '../utils/logger';
import { validateFilePath } from '../utils/security';

// ============================================================================
// File Type Definitions
// ============================================================================

/**
 * Allowed file extensions by category
 * Centralized to ensure consistency across all upload endpoints
 */
export const AllowedFileTypes = {
  // Standard document types (images + PDFs)
  DOCUMENTS: ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'] as const,

  // Extended types including office documents
  DOCUMENTS_EXTENDED: [
    '.pdf',
    '.docx',
    '.doc',
    '.txt',
    '.csv',
    '.jpeg',
    '.jpg',
    '.png',
    '.gif',
    '.webp',
  ] as const,

  // Strict image-only types
  IMAGES_ONLY: ['.jpg', '.jpeg', '.png', '.gif', '.webp'] as const,

  // Minimal types for profile/ID documents
  PROFILE_DOCS: ['.pdf', '.jpg', '.jpeg', '.png'] as const,

  // Knowledge base documents - text-only formats (no images)
  KNOWLEDGE_DOCS: ['.pdf', '.docx', '.doc', '.txt', '.csv'] as const,
} as const;

/**
 * MIME type mappings for extension validation
 */
export const MimeTypeMappings: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.doc': ['application/msword'],
  '.txt': ['text/plain'],
  '.csv': ['text/csv', 'application/csv'],
};

// ============================================================================
// Upload Configuration Types
// ============================================================================

export interface FileUploadConfig {
  /** Destination folder relative to project root */
  destination: string;
  /** File name prefix (e.g., 'doc', 'profile') */
  filePrefix: string;
  /** Max file size in bytes */
  maxFileSize: number;
  /** Max number of files per request */
  maxFiles?: number;
  /** Allowed file extensions */
  allowedTypes: readonly string[];
  /** Enable enhanced security checks (double extension, MIME spoofing) */
  enhancedSecurity?: boolean;
}

/**
 * Preset configurations for common upload scenarios
 */
export const FileUploadPresets: Record<string, FileUploadConfig> = {
  /**
   * Client documents - high security, standard document types
   * Used by: client-documents.routes.ts
   */
  CLIENT_DOCUMENTS: {
    destination: 'uploads/client-documents/',
    filePrefix: 'doc',
    maxFileSize: 15 * 1024 * 1024, // 15MB
    allowedTypes: AllowedFileTypes.DOCUMENTS,
    enhancedSecurity: true,
  },

  /**
   * Smart profile detection - batch uploads with strict types
   * Used by: smart-profile.routes.ts
   */
  SMART_PROFILE: {
    destination: 'uploads/smart-profile/',
    filePrefix: 'detect',
    maxFileSize: 10 * 1024 * 1024, // 10MB per file
    maxFiles: 20,
    allowedTypes: AllowedFileTypes.PROFILE_DOCS,
    enhancedSecurity: true,
  },

  /**
   * General document uploads - extended types
   * Used by: routes.ts (legacy), document processing
   */
  GENERAL: {
    destination: 'uploads/',
    filePrefix: '',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: AllowedFileTypes.DOCUMENTS_EXTENDED,
    enhancedSecurity: false,
  },

  /**
   * Knowledge base documents - text-only formats for semantic processing
   * Used by: knowledge.routes.ts
   */
  KNOWLEDGE: {
    destination: 'uploads/knowledge/',
    filePrefix: 'knowledge',
    maxFileSize: 50 * 1024 * 1024, // 50MB limit for large documents
    allowedTypes: AllowedFileTypes.KNOWLEDGE_DOCS,
    enhancedSecurity: true,
  },

  /**
   * Form templates - PDFs only
   * Used by: form-template.routes.ts
   */
  FORM_TEMPLATES: {
    destination: 'uploads/templates/',
    filePrefix: 'template',
    maxFileSize: 20 * 1024 * 1024, // 20MB for large form templates
    allowedTypes: ['.pdf'] as readonly string[],
    enhancedSecurity: true,
  },
} as const;

// ============================================================================
// Storage Factory
// ============================================================================

/**
 * Create a multer disk storage configuration
 */
export function createDiskStorage(config: FileUploadConfig): StorageEngine {
  return multer.diskStorage({
    destination: config.destination,
    filename: (_req: Request, file: Express.Multer.File, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname).toLowerCase();
      const prefix = config.filePrefix ? `${config.filePrefix}-` : '';
      cb(null, `${prefix}${uniqueSuffix}${ext}`);
    },
  });
}

// ============================================================================
// File Filter Factory
// ============================================================================

/**
 * Create a file filter function with appropriate security checks
 */
export function createFileFilter(
  config: FileUploadConfig
): (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => void {
  return (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();

    try {
      // Always validate for path traversal
      validateFilePath(file.originalname);

      // Enhanced security checks if enabled
      if (config.enhancedSecurity) {
        // Check for double extensions (e.g., file.pdf.exe)
        const doubleExtCheck = fileValidationService.hasDoubleExtension(
          file.originalname,
          config.allowedTypes as string[]
        );
        if (doubleExtCheck.isDouble) {
          logger.warn('Double extension attack detected', {
            filename: file.originalname,
            extensions: doubleExtCheck.extensions,
            dangerousExtension: doubleExtCheck.dangerousExtension,
            destination: config.destination,
          });
          return cb(
            new FileValidationError(
              `Suspicious double extension detected: ${file.originalname}. File rejected for security reasons.`,
              'DOUBLE_EXTENSION'
            )
          );
        }

        // Check for MIME type spoofing
        const expectedMimes = MimeTypeMappings[ext];
        if (expectedMimes && !expectedMimes.includes(file.mimetype)) {
          logger.warn('MIME type spoofing detected', {
            filename: file.originalname,
            extension: ext,
            declaredMimeType: file.mimetype,
            expectedMimeTypes: expectedMimes,
            destination: config.destination,
          });
          return cb(
            new FileValidationError(
              `MIME type mismatch: file extension ${ext} does not match declared type ${file.mimetype}`,
              'MIME_TYPE_MISMATCH'
            )
          );
        }
      }

      // Check allowed types
      if (config.allowedTypes.includes(ext)) {
        cb(null, true);
      } else {
        cb(
          new Error(
            `File type ${ext} not supported. Allowed: ${(config.allowedTypes as string[]).join(', ')}`
          )
        );
      }
    } catch (error) {
      cb(error as Error);
    }
  };
}

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create a configured multer middleware instance
 *
 * @param config - Upload configuration or preset name
 * @returns Configured multer instance
 *
 * @example
 * // Using preset
 * const upload = createUploadMiddleware(FileUploadPresets.CLIENT_DOCUMENTS);
 * router.post('/upload', upload.single('file'), handler);
 *
 * @example
 * // Using custom config
 * const upload = createUploadMiddleware({
 *   destination: 'uploads/custom/',
 *   filePrefix: 'custom',
 *   maxFileSize: 5 * 1024 * 1024,
 *   allowedTypes: ['.pdf', '.png'],
 *   enhancedSecurity: true,
 * });
 */
export function createUploadMiddleware(config: FileUploadConfig): multer.Multer {
  const storage = createDiskStorage(config);
  const fileFilter = createFileFilter(config);

  const limits: multer.Options['limits'] = {
    fileSize: config.maxFileSize,
  };

  if (config.maxFiles) {
    limits.files = config.maxFiles;
  }

  return multer({
    storage,
    limits,
    fileFilter,
  });
}

// ============================================================================
// Exports
// ============================================================================

export default {
  AllowedFileTypes,
  MimeTypeMappings,
  FileUploadPresets,
  createDiskStorage,
  createFileFilter,
  createUploadMiddleware,
};

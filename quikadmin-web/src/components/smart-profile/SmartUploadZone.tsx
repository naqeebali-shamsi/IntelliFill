/**
 * SmartUploadZone Component
 *
 * Drag-and-drop upload zone with automatic document type detection.
 * Uses react-dropzone for file handling and calls the detect-types API.
 *
 * @module components/smart-profile/SmartUploadZone
 */

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { startTiming } from '@/lib/performance';
import { Upload, FileUp, AlertCircle } from 'lucide-react';
import { FileCard } from './FileCard';
import {
  useSmartUpload,
  useSmartProfileStore,
  type DocumentType,
} from '@/stores/smartProfileStore';
import { fileObjectStore } from '@/stores/fileObjectStore';
import api from '@/services/api';

// ============================================================================
// Types
// ============================================================================

export interface SmartUploadZoneProps {
  /** Additional class names */
  className?: string;
  /** Callback when files are ready (all detected) */
  onFilesReady?: () => void;
}

interface DetectionResult {
  fileId: string;
  fileName: string;
  detectedType: DocumentType;
  confidence: number;
  alternativeTypes?: Array<{ type: DocumentType; confidence: number }>;
  error?: string;
}

interface DetectTypesResponse {
  success: boolean;
  results: DetectionResult[];
  totalFiles: number;
  detectedCount: number;
  errorCount: number;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 20;

const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

// ============================================================================
// Component
// ============================================================================

/**
 * SmartUploadZone provides drag-and-drop file upload with auto-detection.
 *
 * @example
 * ```tsx
 * <SmartUploadZone
 *   onFilesReady={() => console.log('All files detected')}
 * />
 * ```
 */
export function SmartUploadZone({ className, onFilesReady }: SmartUploadZoneProps) {
  const { files, addFiles, removeFile, updateFileDetection, setFileError, setFileStatus } =
    useSmartUpload();

  // Detect document types via API
  const detectDocumentTypes = useCallback(
    async (newFiles: Array<{ id: string; file: File }>) => {
      if (newFiles.length === 0) return;

      // Create form data with files
      const formData = new FormData();
      newFiles.forEach(({ file }) => {
        formData.append('files', file);
      });

      try {
        // Start detection timing
        const endDetectionTiming = startTiming('Document Detection');

        // Call detect-types API
        // Don't set Content-Type manually - axios will set it with correct boundary for FormData
        const response = await api.post<DetectTypesResponse>(
          '/smart-profile/detect-types',
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        // End detection timing
        endDetectionTiming();

        if (response.data.success) {
          // Match results to our file IDs by fileName
          response.data.results.forEach((result: DetectionResult, index: number) => {
            const fileEntry = newFiles[index];
            if (fileEntry) {
              if (result.error) {
                setFileError(fileEntry.id, result.error);
              } else {
                updateFileDetection(fileEntry.id, result.detectedType, result.confidence);
              }
            }
          });

          // Check if all files are now detected
          const store = useSmartProfileStore.getState();
          const allDetected = store.uploadedFiles.every(
            (f) => f.status === 'detected' || f.status === 'error'
          );
          if (allDetected && onFilesReady) {
            onFilesReady();
          }
        }
      } catch (error) {
        // Mark all files as error
        newFiles.forEach(({ id }) => {
          setFileError(id, 'Detection failed. Please try again.');
        });
      }
    },
    [updateFileDetection, setFileError, onFilesReady]
  );

  // Handle file drop
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      // Generate IDs and add to store
      const newFileEntries = acceptedFiles.map((file) => {
        const id = `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        fileObjectStore.set(id, file);
        return {
          id,
          file,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        };
      });

      // Add files to store (status: pending)
      addFiles(
        newFileEntries.map(({ id, fileName, fileSize, mimeType }) => ({
          id,
          fileName,
          fileSize,
          mimeType,
        }))
      );

      // Set status to detecting
      newFileEntries.forEach(({ id }) => {
        setFileStatus(id, 'detecting');
      });

      // Detect types
      await detectDocumentTypes(newFileEntries);
    },
    [addFiles, setFileStatus, detectDocumentTypes]
  );

  // Handle file removal
  const handleRemove = useCallback(
    (fileId: string) => {
      removeFile(fileId);
      fileObjectStore.remove(fileId);
    },
    [removeFile]
  );

  // Handle manual type change
  const handleTypeChange = useCallback(
    (fileId: string, newType: DocumentType) => {
      // Update with full confidence since it's user-specified
      updateFileDetection(fileId, newType, 1.0);
    },
    [updateFileDetection]
  );

  // Setup dropzone
  const { getRootProps, getInputProps, isDragActive, isDragReject, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES,
    multiple: true,
  });

  const hasFiles = files.length > 0;
  const hasRejections = fileRejections.length > 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={cn(
          'relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          'hover:border-primary/50 hover:bg-primary/5',
          isDragActive && !isDragReject && 'border-primary bg-primary/10',
          isDragReject && 'border-status-error bg-status-error/10',
          hasFiles && 'p-4'
        )}
      >
        <input {...getInputProps()} />

        <AnimatePresence mode="wait">
          {isDragActive && !isDragReject ? (
            <motion.div
              key="drag-active"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-2"
            >
              <FileUp className="h-12 w-12 text-primary" />
              <p className="text-lg font-medium text-primary">Drop files here</p>
            </motion.div>
          ) : isDragReject ? (
            <motion.div
              key="drag-reject"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-2"
            >
              <AlertCircle className="h-12 w-12 text-status-error" />
              <p className="text-lg font-medium text-status-error-foreground">Invalid file type</p>
              <p className="text-sm text-muted-foreground">
                Only PDF, JPG, and PNG files are supported
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="rounded-full bg-primary/10 p-4">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-lg font-medium">Drop documents here or click to browse</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Passport, Emirates ID, Driver's License, Bank Statement
                </p>
              </div>
              <p className="text-xs text-muted-foreground">PDF, JPG, PNG up to 10MB</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Rejection Errors */}
      {hasRejections && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-md border border-status-error/30 bg-status-error/10 p-3"
        >
          <div className="flex items-center gap-2 text-status-error-foreground">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">Some files were rejected:</span>
          </div>
          <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
            {fileRejections.slice(0, 3).map(({ file, errors }) => (
              <li key={file.name}>
                {file.name}: {errors[0]?.message || 'Invalid file'}
              </li>
            ))}
            {fileRejections.length > 3 && <li>...and {fileRejections.length - 3} more</li>}
          </ul>
        </motion.div>
      )}

      {/* File Cards */}
      {hasFiles && (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {files.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                onTypeChange={handleTypeChange}
                onRemove={handleRemove}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* File Count Summary */}
      {hasFiles && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-sm text-muted-foreground"
        >
          {files.filter((f) => f.status === 'detected').length} of {files.length} documents ready
        </motion.p>
      )}
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default SmartUploadZone;

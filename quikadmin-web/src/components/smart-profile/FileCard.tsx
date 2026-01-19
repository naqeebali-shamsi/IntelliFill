/**
 * FileCard Component
 *
 * Displays an uploaded file with its detected document type and confidence badge.
 * Supports manual type override and removal.
 *
 * @module components/smart-profile/FileCard
 */

import { forwardRef, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/utils/fileValidation';
import { File, FileImage, X, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfidenceBadge } from '@/components/ui/confidence-badge';
import type { UploadedFile, DocumentType, UploadStatus } from '@/stores/smartProfileStore';

// ============================================================================
// Types
// ============================================================================

export interface FileCardProps {
  /** File data from store */
  file: UploadedFile;
  /** Callback when type is manually changed */
  onTypeChange?: (fileId: string, newType: DocumentType) => void;
  /** Callback when file is removed */
  onRemove?: (fileId: string) => void;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  PASSPORT: 'Passport',
  EMIRATES_ID: 'Emirates ID',
  DRIVERS_LICENSE: "Driver's License",
  BANK_STATEMENT: 'Bank Statement',
  OTHER: 'Other Document',
};

const DOCUMENT_TYPE_OPTIONS: DocumentType[] = [
  'PASSPORT',
  'EMIRATES_ID',
  'DRIVERS_LICENSE',
  'BANK_STATEMENT',
  'OTHER',
];

// ============================================================================
// Helper Components
// ============================================================================

function FileIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const isImage = mimeType.startsWith('image/');
  const Icon = isImage ? FileImage : File;
  return <Icon className={cn('text-muted-foreground', className)} />;
}

function StatusIndicator({ status }: { status: UploadStatus }) {
  switch (status) {
    case 'pending':
    case 'detecting':
      return (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Analyzing...</span>
        </div>
      );
    case 'error':
      return <span className="text-sm text-status-error-foreground">Detection failed</span>;
    default:
      return null;
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * FileCard displays an uploaded file with detection results.
 *
 * @example
 * ```tsx
 * <FileCard
 *   file={uploadedFile}
 *   onTypeChange={(id, type) => updateFileType(id, type)}
 *   onRemove={(id) => removeFile(id)}
 * />
 * ```
 */
const FileCard = forwardRef<HTMLDivElement, FileCardProps>(function FileCard(
  { file, onTypeChange, onRemove, className },
  ref
): JSX.Element {
  const [isHovered, setIsHovered] = useState(false);

  const handleTypeChange = useCallback(
    (type: DocumentType) => {
      onTypeChange?.(file.id, type);
    },
    [file.id, onTypeChange]
  );

  const handleRemove = useCallback(() => {
    onRemove?.(file.id);
  }, [file.id, onRemove]);

  const displayType = useMemo(() => {
    if (file.status !== 'detected' || !file.detectedType) {
      return null;
    }
    return DOCUMENT_TYPE_LABELS[file.detectedType] || 'Unknown';
  }, [file.status, file.detectedType]);

  const isProcessing = file.status === 'pending' || file.status === 'detecting';
  const hasError = file.status === 'error';
  const isDetected = file.status === 'detected';

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg border p-3 transition-colors',
        isProcessing && 'bg-muted/50',
        hasError && 'border-status-error/50 bg-status-error/5',
        isDetected && 'bg-card hover:bg-accent/50',
        className
      )}
    >
      {/* File Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
        <FileIcon mimeType={file.mimeType} className="h-5 w-5" />
      </div>

      {/* File Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground" title={file.fileName}>
            {file.fileName}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatFileSize(file.fileSize)}
          </span>
        </div>

        {/* Status or Detection Result */}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {isProcessing && <StatusIndicator status={file.status} />}
          {hasError && (
            <span className="text-sm text-status-error-foreground">
              {file.error || 'Detection failed'}
            </span>
          )}
          {isDetected && (
            <>
              {/* Document Type Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto min-w-0 max-w-full gap-1 px-2 py-0.5 text-sm font-normal"
                  >
                    <span className="max-w-40 truncate text-muted-foreground sm:max-w-none">
                      {displayType}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {DOCUMENT_TYPE_OPTIONS.map((type) => (
                    <DropdownMenuItem
                      key={type}
                      onClick={() => handleTypeChange(type)}
                      className={cn(file.detectedType === type && 'bg-accent')}
                    >
                      {DOCUMENT_TYPE_LABELS[type]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Confidence Badge */}
              <ConfidenceBadge confidence={file.confidence} size="sm" />
            </>
          )}
        </div>
      </div>

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-8 w-8 shrink-0 opacity-0 transition-opacity',
          (isHovered || hasError) && 'opacity-100'
        )}
        onClick={handleRemove}
        aria-label={`Remove ${file.fileName}`}
      >
        <X className="h-4 w-4" />
      </Button>
    </motion.div>
  );
});

FileCard.displayName = 'FileCard';

// ============================================================================
// Exports
// ============================================================================

export { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_OPTIONS, FileCard };
export default FileCard;

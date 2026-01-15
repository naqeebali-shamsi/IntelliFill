/**
 * ExtractionProgressIndicator Component
 *
 * Shows meaningful progress feedback during document extraction.
 * Displays current file being processed, progress count, and visual progress bar.
 *
 * Replaces generic spinner with contextual information so users understand
 * what's happening during 10+ second operations.
 *
 * @module components/smart-profile/ExtractionProgressIndicator
 */

import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useExtractionProgress } from '@/stores/smartProfileStore';
import type { ExtractionStatus } from '@/stores/smartProfileStore';

// ============================================================================
// Types
// ============================================================================

export interface ExtractionProgressIndicatorProps {
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Status Messages
// ============================================================================

const STATUS_CONFIG: Record<
  ExtractionStatus,
  { message: string; icon: typeof Loader2; spin?: boolean }
> = {
  idle: { message: 'Ready to extract', icon: FileText },
  extracting: { message: 'Extracting document data...', icon: Loader2, spin: true },
  merging: { message: 'Merging profile data...', icon: Loader2, spin: true },
  complete: { message: 'Extraction complete', icon: CheckCircle2 },
  error: { message: 'Extraction failed', icon: AlertCircle },
};

// ============================================================================
// Component
// ============================================================================

/**
 * ExtractionProgressIndicator displays meaningful progress during document extraction.
 *
 * Shows:
 * - Current file being processed
 * - "X of Y documents" counter
 * - Visual progress bar
 * - Status-appropriate messages ("Extracting...", "Merging profile data...")
 *
 * @example
 * ```tsx
 * // Use during extraction in the wizard
 * {isExtracting && <ExtractionProgressIndicator />}
 * ```
 */
export function ExtractionProgressIndicator({ className }: ExtractionProgressIndicatorProps) {
  const { progress, isExtracting } = useExtractionProgress();

  // Don't render if idle
  if (progress.status === 'idle') {
    return null;
  }

  const config = STATUS_CONFIG[progress.status];
  const Icon = config.icon;
  const progressPercentage =
    progress.totalCount > 0 ? (progress.processedCount / progress.totalCount) * 100 : 0;

  return (
    <div
      className={cn('flex flex-col items-center gap-3 py-8 px-4', className)}
      role="status"
      aria-live="polite"
      aria-label={`Extraction progress: ${config.message}`}
    >
      {/* Icon */}
      <Icon
        className={cn(
          'h-10 w-10',
          config.spin && 'animate-spin',
          progress.status === 'complete' && 'text-status-success',
          progress.status === 'error' && 'text-status-error',
          isExtracting && 'text-primary'
        )}
      />

      {/* Status message */}
      <div className="text-center space-y-1">
        <p className="text-base font-medium">{config.message}</p>

        {/* Current file being processed */}
        {isExtracting && progress.currentFile && (
          <p className="text-sm text-muted-foreground">Processing {progress.currentFile}...</p>
        )}

        {/* Document count */}
        {progress.totalCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {progress.processedCount} of {progress.totalCount} document
            {progress.totalCount !== 1 ? 's' : ''}
          </p>
        )}

        {/* Error message */}
        {progress.status === 'error' && progress.errorMessage && (
          <p className="text-sm text-status-error mt-2">{progress.errorMessage}</p>
        )}
      </div>

      {/* Progress bar */}
      {isExtracting && progress.totalCount > 0 && (
        <Progress
          value={progressPercentage}
          className="w-48 h-2"
          aria-label="Extraction progress"
        />
      )}
    </div>
  );
}

export default ExtractionProgressIndicator;

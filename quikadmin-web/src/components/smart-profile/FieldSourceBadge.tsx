/**
 * FieldSourceBadge Component
 *
 * Shows field provenance (source document or manual edit) with a tooltip.
 * Icon-only by default, with detailed tooltip on hover/focus.
 *
 * @module components/smart-profile/FieldSourceBadge
 */

import { cn } from '@/lib/utils';
import { Edit, FileText } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

// ============================================================================
// Types
// ============================================================================

export interface FieldSourceBadgeSource {
  /** Document ID this field came from */
  documentId: string;
  /** Document name for display */
  documentName: string;
  /** Extraction confidence (0-1) */
  confidence: number;
  /** When the field was extracted */
  extractedAt: string;
  /** Whether user manually edited this field */
  manuallyEdited?: boolean;
}

export interface FieldSourceBadgeProps {
  /** Source information for the field */
  source: FieldSourceBadgeSource;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format date for display in tooltip
 */
function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Format confidence as percentage
 */
function formatConfidence(confidence: number): string {
  // Handle both 0-1 and 0-100 scales
  const normalized = confidence > 1 ? confidence : confidence * 100;
  return `${Math.round(normalized)}%`;
}

// ============================================================================
// Component
// ============================================================================

/**
 * FieldSourceBadge displays the provenance of a profile field.
 * Shows an icon with a tooltip containing full source details.
 *
 * @example
 * ```tsx
 * // From document
 * <FieldSourceBadge
 *   source={{
 *     documentId: '123',
 *     documentName: 'passport.pdf',
 *     confidence: 0.95,
 *     extractedAt: '2024-01-15T10:00:00Z'
 *   }}
 * />
 *
 * // Manually edited
 * <FieldSourceBadge
 *   source={{
 *     documentId: 'manual',
 *     documentName: 'Manual Entry',
 *     confidence: 1,
 *     extractedAt: '2024-01-15T10:00:00Z',
 *     manuallyEdited: true
 *   }}
 * />
 * ```
 */
export function FieldSourceBadge({ source, className }: FieldSourceBadgeProps) {
  const Icon = source.manuallyEdited ? Edit : FileText;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center',
              'text-muted-foreground hover:text-foreground',
              'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              'rounded p-0.5',
              className
            )}
            aria-label={source.manuallyEdited ? 'Manually edited' : `From: ${source.documentName}`}
          >
            <Icon className="h-3 w-3" />
            <span className="sr-only">Field source</span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs bg-popover text-popover-foreground border shadow-md"
        >
          <div className="space-y-1.5 p-1">
            {source.manuallyEdited ? (
              <p className="font-medium text-sm">Manually edited</p>
            ) : (
              <>
                <p className="font-medium text-sm">From: {source.documentName}</p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>Confidence: {formatConfidence(source.confidence)}</p>
                  <p>Extracted: {formatDate(source.extractedAt)}</p>
                </div>
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default FieldSourceBadge;

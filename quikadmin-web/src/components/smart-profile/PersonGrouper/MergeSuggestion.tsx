/**
 * MergeSuggestion Component
 *
 * Displays a merge suggestion banner when the AI detects that two person
 * groups might be the same person. Provides merge/dismiss actions.
 *
 * @module components/smart-profile/PersonGrouper/MergeSuggestion
 */

import { Users, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ============================================================================
// Types
// ============================================================================

export interface MergeSuggestionGroup {
  id: string;
  name: string | null;
}

export interface MergeSuggestionProps {
  /** The two groups being suggested to merge */
  groups: [MergeSuggestionGroup, MergeSuggestionGroup];
  /** Confidence score for the merge suggestion (0-1) */
  confidence: number;
  /** Reason for the suggestion (e.g., "similar names") */
  reason: string;
  /** Callback when user confirms the merge */
  onMerge: () => void;
  /** Callback when user dismisses the suggestion */
  onDismiss: () => void;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * MergeSuggestion displays a banner suggesting two person groups be merged.
 *
 * Shows:
 * - The two person names being suggested for merge
 * - Confidence percentage and reason
 * - Merge and Dismiss action buttons
 *
 * @example
 * ```tsx
 * <MergeSuggestion
 *   groups={[
 *     { id: 'p1', name: 'Mohamed Ali' },
 *     { id: 'p2', name: 'Mohammed Ali' }
 *   ]}
 *   confidence={0.92}
 *   reason="Similar names"
 *   onMerge={() => mergeGroups('p1', 'p2')}
 *   onDismiss={() => dismissSuggestion('p1-p2')}
 * />
 * ```
 */
export function MergeSuggestion({
  groups,
  confidence,
  reason,
  onMerge,
  onDismiss,
  className,
}: MergeSuggestionProps) {
  const [group1, group2] = groups;
  const name1 = group1.name || 'Unknown Person';
  const name2 = group2.name || 'Unknown Person';
  const confidencePercent = Math.round(confidence * 100);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 p-3 rounded-lg',
        'bg-status-pending/10 border border-status-pending/30',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <Users className="h-5 w-5 text-status-pending-foreground shrink-0" />

      {/* Message */}
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">Did you mean to combine </span>
          <span className="font-semibold">{name1}</span>
          <span className="font-medium"> and </span>
          <span className="font-semibold">{name2}</span>
          <span className="font-medium">?</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {confidencePercent}% match - {reason}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onMerge}
          className="text-status-success-foreground hover:bg-status-success/10"
        >
          <Check className="h-4 w-4 mr-1" />
          Merge
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss} className="text-muted-foreground">
          <X className="h-4 w-4 mr-1" />
          Dismiss
        </Button>
      </div>
    </div>
  );
}

export default MergeSuggestion;

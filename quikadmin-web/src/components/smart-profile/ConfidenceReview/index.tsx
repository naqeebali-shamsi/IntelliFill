/**
 * ConfidenceReview Component
 *
 * Main review step for low-confidence fields and field conflicts.
 * Shows only fields that need attention - high confidence fields pass through silently.
 *
 * @module components/smart-profile/ConfidenceReview
 */

import * as React from 'react';
import { ReviewField } from './ReviewField';
import { FieldConflict } from './FieldConflict';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface LowConfidenceFieldData {
  /** Field name/key */
  fieldName: string;
  /** Extracted value */
  value: unknown;
  /** Confidence score (0-1) */
  confidence: number;
  /** Source document ID */
  documentId: string;
  /** Source document name for display */
  documentName: string;
}

export interface ConflictData {
  /** Field name/key */
  fieldName: string;
  /** Array of conflicting values from different documents */
  values: Array<{
    value: unknown;
    source: {
      documentId: string;
      documentName: string;
      confidence: number;
    };
  }>;
  /** Index of currently selected value (-1 for custom) */
  selectedIndex: number;
  /** Custom value if selectedIndex is -1 */
  customValue?: string;
}

export interface ConfidenceReviewProps {
  /** Fields with low confidence that need review */
  lowConfidenceFields: LowConfidenceFieldData[];
  /** Fields with conflicting values from multiple documents */
  conflicts: ConflictData[];
  /** Callback when a field value is updated */
  onFieldUpdate: (fieldName: string, value: unknown) => void;
  /** Callback when a conflict is resolved by selecting an index */
  onConflictResolve: (fieldName: string, selectedIndex: number, customValue?: string) => void;
  /** Callback when review is complete */
  onComplete: () => void;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ConfidenceReview orchestrates review of low-confidence fields and conflicts.
 *
 * Features:
 * - Header with count of fields needing review
 * - Section for low confidence fields (if any)
 * - Section for conflicts (if any)
 * - Progress indicator: "X of Y reviewed"
 * - "Confirm All" button - enabled only when all fields reviewed/resolved
 * - Auto-skip: If no fields to review, calls onComplete immediately
 * - Empty state: "All fields extracted with high confidence!"
 *
 * @example
 * ```tsx
 * <ConfidenceReview
 *   lowConfidenceFields={lowConfFields}
 *   conflicts={fieldConflicts}
 *   onFieldUpdate={(field, val) => updateProfile(field, val)}
 *   onConflictResolve={(field, idx) => resolveConflict(field, idx)}
 *   onComplete={() => goToNextStep()}
 * />
 * ```
 */
export function ConfidenceReview({
  lowConfidenceFields,
  conflicts,
  onFieldUpdate,
  onConflictResolve,
  onComplete,
  className,
}: ConfidenceReviewProps) {
  // Track which low-confidence fields have been confirmed
  const [confirmedFields, setConfirmedFields] = React.useState<Set<string>>(new Set());

  // Calculate totals and progress
  const totalLowConfidence = lowConfidenceFields.length;
  const totalConflicts = conflicts.length;
  const totalFields = totalLowConfidence + totalConflicts;

  // Count resolved items
  const confirmedCount = confirmedFields.size;
  // Conflicts are "resolved" if they have a valid selection (not -1 without custom value)
  const resolvedConflictsCount = conflicts.filter(
    (c) => c.selectedIndex >= 0 || (c.selectedIndex === -1 && c.customValue?.trim())
  ).length;
  const reviewedCount = confirmedCount + resolvedConflictsCount;

  // All fields reviewed?
  const allReviewed = reviewedCount >= totalFields;

  // Auto-skip if nothing to review
  React.useEffect(() => {
    if (totalFields === 0) {
      onComplete();
    }
  }, [totalFields, onComplete]);

  // Handle confirming a low-confidence field
  const handleConfirmField = (fieldName: string) => {
    setConfirmedFields((prev) => new Set([...prev, fieldName]));
  };

  // Handle field value change
  const handleFieldValueChange = (fieldName: string, newValue: unknown) => {
    onFieldUpdate(fieldName, newValue);
  };

  // Handle conflict selection
  const handleConflictSelect = (fieldName: string, index: number) => {
    // Find the conflict to get the selected value
    const conflict = conflicts.find((c) => c.fieldName === fieldName);
    if (conflict && index >= 0) {
      // Update profile with selected value
      const selectedValue = conflict.values[index].value;
      onFieldUpdate(fieldName, selectedValue);
    }
    onConflictResolve(fieldName, index);
  };

  // Handle custom conflict value
  const handleConflictCustomValue = (fieldName: string, customValue: unknown) => {
    onFieldUpdate(fieldName, customValue);
    onConflictResolve(fieldName, -1, String(customValue));
  };

  // Empty state - nothing to review
  if (totalFields === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
        <CheckCircle2 className="mb-4 h-12 w-12 text-status-success" />
        <h3 className="text-lg font-semibold">All fields extracted with high confidence!</h3>
        <p className="mt-2 text-muted-foreground">
          No fields require manual review. Proceeding to profile view...
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 rounded-lg border border-status-warning/30 bg-status-warning/10 p-4">
        <AlertCircle className="h-5 w-5 text-status-warning-foreground shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-status-warning-foreground">
            {totalFields} field{totalFields !== 1 ? 's' : ''} need{totalFields === 1 ? 's' : ''} your
            review
          </h3>
          <p className="text-sm text-muted-foreground">
            Review and confirm these fields before proceeding
          </p>
        </div>
        <div className="text-sm font-medium">
          {reviewedCount} of {totalFields} reviewed
        </div>
      </div>

      {/* Low confidence fields section */}
      {totalLowConfidence > 0 && (
        <section className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Low Confidence Fields ({totalLowConfidence})
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {lowConfidenceFields.map((field) => (
              <ReviewField
                key={field.fieldName}
                fieldName={field.fieldName}
                value={field.value}
                confidence={field.confidence}
                source={{
                  documentId: field.documentId,
                  documentName: field.documentName,
                }}
                onValueChange={(newValue) => handleFieldValueChange(field.fieldName, newValue)}
                onConfirm={() => handleConfirmField(field.fieldName)}
                isConfirmed={confirmedFields.has(field.fieldName)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Conflicts section */}
      {totalConflicts > 0 && (
        <section className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Conflicting Values ({totalConflicts})
          </h4>
          <div className="grid gap-3">
            {conflicts.map((conflict) => (
              <FieldConflict
                key={conflict.fieldName}
                fieldName={conflict.fieldName}
                values={conflict.values}
                selectedIndex={conflict.selectedIndex}
                customValue={conflict.customValue}
                onSelect={(index) => handleConflictSelect(conflict.fieldName, index)}
                onCustomValue={(value) => handleConflictCustomValue(conflict.fieldName, value)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Confirm All button */}
      <div className="flex justify-end pt-4">
        <Button size="lg" onClick={onComplete} disabled={!allReviewed}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Confirm All & Continue
        </Button>
      </div>
    </div>
  );
}

// Re-export subcomponents
export { ReviewField } from './ReviewField';
export { FieldConflict } from './FieldConflict';
export default ConfidenceReview;

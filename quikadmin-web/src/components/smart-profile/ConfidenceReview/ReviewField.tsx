/**
 * ReviewField Component
 *
 * Displays a single low-confidence field for user review and correction.
 * Shows extraction confidence, source document, and allows inline editing.
 *
 * @module components/smart-profile/ConfidenceReview/ReviewField
 */

import * as React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfidenceBadge } from '@/components/ui/confidence-badge';
import { FieldSourcePill } from '../FieldSourcePill';
import { cn } from '@/lib/utils';
import { Check, Pencil } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ReviewFieldProps {
  /** Field name/key */
  fieldName: string;
  /** Current value */
  value: unknown;
  /** Extraction confidence (0-1) */
  confidence: number;
  /** Source document info */
  source: {
    documentId: string;
    documentName: string;
  };
  /** Callback when value is changed */
  onValueChange: (newValue: unknown) => void;
  /** Callback when field is confirmed */
  onConfirm: () => void;
  /** Whether this field has been confirmed */
  isConfirmed?: boolean;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert camelCase/snake_case field name to human-readable "Title Case" label.
 * e.g., "firstName" -> "First Name", "date_of_birth" -> "Date Of Birth"
 */
function formatFieldLabel(fieldName: string): string {
  return (
    fieldName
      // Insert space before uppercase letters (camelCase)
      .replace(/([A-Z])/g, ' $1')
      // Replace underscores with spaces (snake_case)
      .replace(/_/g, ' ')
      // Capitalize first letter of each word
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim()
  );
}

/**
 * Format value for display based on type
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    return JSON.stringify(value);
  }
  return String(value);
}

// ============================================================================
// Component
// ============================================================================

/**
 * ReviewField displays a low-confidence field for user review.
 *
 * Features:
 * - Card-style layout with field name header
 * - Current value displayed prominently
 * - Confidence badge showing extraction confidence
 * - Source pill showing origin document
 * - Editable input for corrections
 * - Confirm button to mark as reviewed
 * - Visual state change when confirmed
 *
 * @example
 * ```tsx
 * <ReviewField
 *   fieldName="dateOfBirth"
 *   value="1990-05-15"
 *   confidence={0.65}
 *   source={{ documentId: 'doc1', documentName: 'passport.pdf' }}
 *   onValueChange={(v) => handleChange('dateOfBirth', v)}
 *   onConfirm={() => handleConfirm('dateOfBirth')}
 * />
 * ```
 */
export function ReviewField({
  fieldName,
  value,
  confidence,
  source,
  onValueChange,
  onConfirm,
  isConfirmed = false,
  className,
}: ReviewFieldProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(formatValue(value));
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Update edit value when value prop changes
  React.useEffect(() => {
    setEditValue(formatValue(value));
  }, [value]);

  // Focus input when entering edit mode
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (isConfirmed) return;
    setEditValue(formatValue(value));
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    onValueChange(editValue);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditValue(formatValue(value));
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleConfirmClick = () => {
    if (isEditing) {
      handleSaveEdit();
    }
    onConfirm();
  };

  const displayValue = formatValue(value);
  const label = formatFieldLabel(fieldName);

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        isConfirmed
          ? 'border-status-success/30 bg-status-success/5'
          : 'border-status-warning/30 bg-status-warning/5',
        className
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">{label}</h4>
          <div className="flex items-center gap-2">
            <ConfidenceBadge confidence={confidence} size="sm" />
            <FieldSourcePill documentName={source.documentName} size="sm" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Value display or edit */}
        <div className="min-h-[40px]">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter value..."
                className="h-9"
              />
              <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="shrink-0">
                Cancel
              </Button>
            </div>
          ) : (
            <div
              className={cn(
                'group flex items-center gap-2 rounded-md px-3 py-2 transition-colors',
                !isConfirmed && 'cursor-pointer hover:bg-background/50'
              )}
              onClick={handleStartEdit}
              onKeyDown={(e) => e.key === 'Enter' && handleStartEdit()}
              tabIndex={isConfirmed ? -1 : 0}
              role={isConfirmed ? undefined : 'button'}
            >
              <span
                className={cn(
                  'text-base font-medium flex-1',
                  !displayValue && 'text-muted-foreground italic'
                )}
              >
                {displayValue || 'No value extracted'}
              </span>
              {!isConfirmed && (
                <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
          )}
        </div>

        {/* Confirm button */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {isConfirmed ? 'Field confirmed' : 'Review and confirm this value'}
          </p>
          <Button
            size="sm"
            variant={isConfirmed ? 'outline' : 'default'}
            onClick={handleConfirmClick}
            disabled={isConfirmed}
            className={cn(isConfirmed && 'border-status-success/30 text-status-success-foreground')}
          >
            <Check className="mr-1.5 h-4 w-4" />
            {isConfirmed ? 'Confirmed' : 'Confirm'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ReviewField;

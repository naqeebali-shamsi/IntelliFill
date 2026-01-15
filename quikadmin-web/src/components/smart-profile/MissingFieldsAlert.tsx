/**
 * MissingFieldsAlert Component
 *
 * Shows a warning alert when required fields are missing for a target form.
 * Lists missing fields and suggests documents to upload.
 *
 * @module components/smart-profile/MissingFieldsAlert
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, X, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFieldLabel } from '@/lib/form-fields';

// ============================================================================
// Types
// ============================================================================

export interface MissingFieldsAlertProps {
  /** Array of missing field names */
  missingFields: string[];
  /** Suggested documents that could provide the missing fields */
  suggestedDocuments?: string[];
  /** Callback when user dismisses the alert */
  onDismiss?: () => void;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * MissingFieldsAlert displays a warning banner when fields are missing.
 * Shows the list of missing fields and suggests documents to upload.
 *
 * @example
 * ```tsx
 * <MissingFieldsAlert
 *   missingFields={['passportNumber', 'dateOfBirth']}
 *   suggestedDocuments={['Passport']}
 *   onDismiss={() => setDismissed(true)}
 * />
 * ```
 */
export function MissingFieldsAlert({
  missingFields,
  suggestedDocuments,
  onDismiss,
  className,
}: MissingFieldsAlertProps) {
  // Don't render if no missing fields
  if (missingFields.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'relative rounded-lg border border-status-warning/30 bg-status-warning/10 p-4',
        className
      )}
      role="alert"
    >
      {/* Dismiss button */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2 top-2 rounded-md p-1 text-status-warning-foreground/70 hover:bg-status-warning/20 hover:text-status-warning-foreground transition-colors"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 pr-8">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-status-warning/20">
          <AlertTriangle className="h-4 w-4 text-status-warning-foreground" />
        </div>

        <div className="flex-1 space-y-3">
          {/* Title */}
          <div>
            <h4 className="font-semibold text-status-warning-foreground">
              {missingFields.length} field{missingFields.length !== 1 ? 's' : ''} still needed for
              this form
            </h4>
            <p className="text-sm text-status-warning-foreground/80 mt-0.5">
              Complete these fields to ensure your form can be filled accurately
            </p>
          </div>

          {/* Missing fields list */}
          <div className="flex flex-wrap gap-2">
            {missingFields.map((field) => (
              <span
                key={field}
                className="inline-flex items-center rounded-full border border-status-warning/30 bg-background px-2.5 py-0.5 text-xs font-medium text-foreground"
              >
                {getFieldLabel(field)}
              </span>
            ))}
          </div>

          {/* Suggested documents */}
          {suggestedDocuments && suggestedDocuments.length > 0 && (
            <div className="flex items-start gap-2 rounded-md bg-background/50 p-3">
              <FileUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="text-muted-foreground">To fill these fields, upload: </span>
                <span className="font-medium text-foreground">{suggestedDocuments.join(', ')}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action button */}
      {onDismiss && (
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onDismiss} className="text-muted-foreground">
            Proceed anyway
          </Button>
        </div>
      )}
    </div>
  );
}

export default MissingFieldsAlert;

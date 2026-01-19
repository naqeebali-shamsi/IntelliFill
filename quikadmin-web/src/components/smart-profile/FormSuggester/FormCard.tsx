/**
 * FormCard Component
 *
 * Displays a single form suggestion with confidence, matched documents,
 * and selection state. Used within FormSuggester.
 *
 * @module components/smart-profile/FormSuggester/FormCard
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FileText, Check, AlertTriangle, ChevronRight } from 'lucide-react';
import { ConfidenceBadge } from '@/components/ui/confidence-badge';
import { getFormTypeLabel, type FormSuggestion } from '@/lib/form-fields';

// ============================================================================
// Types
// ============================================================================

export interface FormCardProps {
  /** Form suggestion data */
  form: FormSuggestion;
  /** Whether this form is currently selected */
  isSelected: boolean;
  /** Callback when form is clicked */
  onSelect: () => void;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * FormCard displays a form suggestion as a selectable card.
 * Shows form name, confidence badge, matched document count, and missing field alert.
 *
 * @example
 * ```tsx
 * <FormCard
 *   form={suggestion}
 *   isSelected={selectedFormId === suggestion.formId}
 *   onSelect={() => handleSelect(suggestion.formId)}
 * />
 * ```
 */
export function FormCard({ form, isSelected, onSelect, className }: FormCardProps) {
  const {
    formId,
    confidence,
    matchedDocuments,
    missingDocuments,
    matchedFieldCount,
    totalFieldCount,
  } = form;
  const formLabel = getFormTypeLabel(formId);
  const hasFullCoverage = missingDocuments.length === 0;
  const coveragePercent = Math.round((matchedFieldCount / totalFieldCount) * 100);

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative w-full rounded-lg border p-4 text-left transition-all',
        'hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        isSelected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card hover:bg-accent/5',
        className
      )}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-4 w-4" />
        </div>
      )}

      {/* Form icon and name */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            isSelected ? 'bg-primary/20' : 'bg-muted'
          )}
        >
          <FileText
            className={cn('h-5 w-5', isSelected ? 'text-primary' : 'text-muted-foreground')}
          />
        </div>

        <div className="min-w-0 flex-1 pr-8">
          {/* Form name */}
          <h4
            className={cn(
              'font-semibold truncate',
              isSelected ? 'text-primary' : 'text-foreground'
            )}
          >
            {formLabel}
          </h4>

          {/* Confidence badge */}
          <div className="mt-1">
            <ConfidenceBadge confidence={confidence} size="sm" />
          </div>

          {/* Coverage info */}
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {matchedFieldCount}/{totalFieldCount} fields ({coveragePercent}% coverage)
            </span>
          </div>

          {/* Matched documents */}
          {matchedDocuments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {matchedDocuments.map((doc) => (
                <span
                  key={doc}
                  className="inline-flex items-center rounded-full bg-status-success/10 px-2 py-0.5 text-xs text-status-success-foreground"
                >
                  {doc}
                </span>
              ))}
            </div>
          )}

          {/* Missing documents warning */}
          {!hasFullCoverage && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-status-warning-foreground">
              <AlertTriangle className="h-3 w-3" />
              <span>Missing: {missingDocuments.join(', ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hover indicator */}
      <ChevronRight
        className={cn(
          'absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 transition-opacity',
          isSelected ? 'opacity-0' : 'opacity-0 group-hover:opacity-50'
        )}
      />
    </motion.button>
  );
}

export default FormCard;

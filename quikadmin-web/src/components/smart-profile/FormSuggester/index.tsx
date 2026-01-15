/**
 * FormSuggester Component
 *
 * Displays ranked form suggestions based on uploaded document types.
 * Allows users to select which form they want to fill.
 *
 * @module components/smart-profile/FormSuggester
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FileQuestion, Sparkles } from 'lucide-react';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { suggestForms, type FormSuggestion } from '@/lib/form-fields';
import { FormCard } from './FormCard';

// ============================================================================
// Types
// ============================================================================

export interface FormSuggesterProps {
  /** Uploaded document types (e.g., ['Passport', 'Emirates ID']) */
  documentTypes: string[];
  /** Currently selected form ID */
  selectedFormId: string | null;
  /** Callback when a form is selected */
  onSelectForm: (formId: string) => void;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * FormSuggester shows ranked form suggestions based on uploaded documents.
 * Uses suggestForms() to calculate which forms can be filled with available data.
 *
 * @example
 * ```tsx
 * <FormSuggester
 *   documentTypes={['Passport', 'Emirates ID']}
 *   selectedFormId={selectedFormId}
 *   onSelectForm={(formId) => setSelectedFormId(formId)}
 * />
 * ```
 */
export function FormSuggester({
  documentTypes,
  selectedFormId,
  onSelectForm,
  className,
}: FormSuggesterProps) {
  // Calculate form suggestions from document types
  const suggestions = React.useMemo(() => {
    return suggestForms(documentTypes);
  }, [documentTypes]);

  // Empty state when no documents uploaded
  if (documentTypes.length === 0) {
    return (
      <div
        className={cn(
          'flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center',
          className
        )}
      >
        <FileQuestion className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <p className="text-muted-foreground">No documents uploaded yet</p>
        <p className="mt-2 text-xs text-muted-foreground/70">
          Upload documents to see which forms you can fill
        </p>
      </div>
    );
  }

  // Empty state when no forms match uploaded documents
  if (suggestions.length === 0) {
    return (
      <div
        className={cn(
          'flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center',
          className
        )}
      >
        <FileQuestion className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <p className="text-muted-foreground">No matching forms found</p>
        <p className="mt-2 text-xs text-muted-foreground/70">
          Upload different documents to find applicable forms
        </p>
      </div>
    );
  }

  // Calculate best suggestion for header text
  const bestSuggestion = suggestions[0];
  const highConfidenceCount = suggestions.filter((s) => s.confidence >= 0.85).length;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with AI suggestion indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>
          {highConfidenceCount > 0 ? (
            <>
              <strong className="text-foreground">{highConfidenceCount}</strong> form
              {highConfidenceCount !== 1 ? 's' : ''} with high coverage
            </>
          ) : (
            <>
              <strong className="text-foreground">{suggestions.length}</strong> possible form
              {suggestions.length !== 1 ? 's' : ''}
            </>
          )}{' '}
          based on your documents
        </span>
      </div>

      {/* Form cards with staggered animation */}
      <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" animate="show">
        {suggestions.map((suggestion) => (
          <motion.div key={suggestion.formId} variants={fadeInUp}>
            <FormCard
              form={suggestion}
              isSelected={selectedFormId === suggestion.formId}
              onSelect={() => onSelectForm(suggestion.formId)}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Help text */}
      {!selectedFormId && (
        <p className="text-center text-sm text-muted-foreground">Select a form to proceed</p>
      )}
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export { FormCard, type FormCardProps } from './FormCard';
export type { FormSuggestion };
export default FormSuggester;

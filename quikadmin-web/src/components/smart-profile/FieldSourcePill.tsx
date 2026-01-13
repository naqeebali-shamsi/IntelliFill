/**
 * FieldSourcePill Component
 *
 * Small pill showing the source document for a profile field.
 * Uses muted styling to not distract from field values.
 *
 * @module components/smart-profile/FieldSourcePill
 */

import { cn } from '@/lib/utils';
import { FileText, CreditCard, Car, Landmark, Pencil } from 'lucide-react';
import type { DocumentType } from '@/stores/smartProfileStore';

// ============================================================================
// Types
// ============================================================================

export interface FieldSourcePillProps {
  /** Source document name */
  documentName: string;
  /** Document type for icon selection */
  documentType?: DocumentType | string;
  /** Whether the field was manually edited */
  manuallyEdited?: boolean;
  /** Optional size variant */
  size?: 'sm' | 'md';
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DOCUMENT_ICONS: Record<string, typeof FileText> = {
  PASSPORT: FileText,
  EMIRATES_ID: CreditCard,
  DRIVERS_LICENSE: Car,
  BANK_STATEMENT: Landmark,
  OTHER: FileText,
};

// ============================================================================
// Component
// ============================================================================

const sizeClasses = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2 py-0.5 gap-1.5',
};

const iconSizes = {
  sm: 10,
  md: 12,
};

/**
 * FieldSourcePill displays the source document for a profile field.
 *
 * @example
 * ```tsx
 * // From passport
 * <FieldSourcePill documentName="passport_scan.pdf" documentType="PASSPORT" />
 *
 * // Manually edited
 * <FieldSourcePill documentName="Manual Entry" manuallyEdited />
 * ```
 */
export function FieldSourcePill({
  documentName,
  documentType,
  manuallyEdited = false,
  size = 'sm',
  className,
}: FieldSourcePillProps) {
  // If manually edited, show "Manual" with pencil icon
  if (manuallyEdited) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full border border-primary/30 bg-primary/10 font-medium text-primary',
          sizeClasses[size],
          className
        )}
      >
        <Pencil size={iconSizes[size]} className="shrink-0" />
        <span>Manual</span>
      </span>
    );
  }

  // Get icon based on document type
  const Icon = DOCUMENT_ICONS[documentType || 'OTHER'] || FileText;

  // Truncate long document names
  const displayName =
    documentName.length > 20 ? `${documentName.substring(0, 17)}...` : documentName;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-muted-foreground/20 bg-muted/50 font-medium text-muted-foreground',
        sizeClasses[size],
        className
      )}
      title={documentName}
    >
      <Icon size={iconSizes[size]} className="shrink-0" />
      <span className="truncate">{displayName}</span>
    </span>
  );
}

export default FieldSourcePill;

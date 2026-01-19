/**
 * ProfileView Component
 *
 * Displays extracted profile data organized by category with source indicators.
 * Each field shows its source document and confidence level.
 *
 * @module components/smart-profile/ProfileView
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, User, FileText, Phone, Settings } from 'lucide-react';
import { FieldSourcePill } from './FieldSourcePill';
import { FieldSourceBadge } from './FieldSourceBadge';
import { ConfidenceBadge, CONFIDENCE_THRESHOLDS } from '@/components/ui/confidence-badge';
import { EditableField, detectFieldType } from './EditableField';
import type { FieldSource } from '@/stores/smartProfileStore';

// ============================================================================
// Types
// ============================================================================

export interface ProfileViewProps {
  /** Profile data - key/value pairs */
  profileData: Record<string, unknown>;
  /** Field sources - metadata about where each field came from */
  fieldSources: Record<string, FieldSource>;
  /** Callback when a field value is changed */
  onFieldChange?: (fieldName: string, newValue: unknown) => void;
  /** Callback when editing is completed for a field */
  onFieldEdited?: (fieldName: string) => void;
  /** Whether fields are editable */
  editable?: boolean;
  /** Additional class names */
  className?: string;
}

export interface FieldCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  fieldKeys: string[];
}

// ============================================================================
// Constants - Field Categories
// ============================================================================

const PERSONAL_FIELDS = [
  'firstName',
  'lastName',
  'fullName',
  'middleName',
  'dateOfBirth',
  'nationality',
  'gender',
  'placeOfBirth',
];

const DOCUMENT_FIELDS = [
  'passportNumber',
  'emiratesIdNumber',
  'licenseNumber',
  'passportExpiry',
  'emiratesIdExpiry',
  'licenseExpiry',
  'issueDate',
  'expiryDate',
  'documentNumber',
];

const CONTACT_FIELDS = [
  'email',
  'phone',
  'mobile',
  'address',
  'city',
  'state',
  'country',
  'postalCode',
  'zipCode',
];

const CATEGORY_CONFIG: Record<string, { name: string; icon: typeof User }> = {
  personal: { name: 'Personal Information', icon: User },
  documents: { name: 'Document Details', icon: FileText },
  contact: { name: 'Contact Information', icon: Phone },
  other: { name: 'Other', icon: Settings },
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Categorize a field by its key name
 */
function categorizeField(fieldKey: string): string {
  const lowerKey = fieldKey.toLowerCase();

  // Check personal fields
  if (PERSONAL_FIELDS.some((f) => lowerKey.includes(f.toLowerCase()))) {
    return 'personal';
  }

  // Check document fields
  if (DOCUMENT_FIELDS.some((f) => lowerKey.includes(f.toLowerCase()))) {
    return 'documents';
  }

  // Check contact fields
  if (CONTACT_FIELDS.some((f) => lowerKey.includes(f.toLowerCase()))) {
    return 'contact';
  }

  return 'other';
}

/**
 * Format field key to human-readable label
 */
function formatFieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

/**
 * Format field value for display
 */
function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ============================================================================
// Sub-Components
// ============================================================================

interface FieldRowProps {
  fieldKey: string;
  value: unknown;
  source?: FieldSource;
  editable: boolean;
  onValueChange?: (newValue: unknown) => void;
  onEditComplete?: () => void;
}

function FieldRow({
  fieldKey,
  value,
  source,
  editable,
  onValueChange,
  onEditComplete,
}: FieldRowProps) {
  const isLowConfidence = source?.confidence && source.confidence < CONFIDENCE_THRESHOLDS.HIGH;
  const { type: fieldType, options } = detectFieldType(fieldKey);

  const handleSave = (newValue: string) => {
    onValueChange?.(newValue);
    onEditComplete?.();
  };

  return (
    <div className="flex items-start justify-between gap-4 py-3 px-4 hover:bg-muted/50 transition-colors">
      {/* Field label and value */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-muted-foreground">
          {formatFieldLabel(fieldKey)}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          {editable ? (
            <EditableField
              value={formatFieldValue(value)}
              fieldType={fieldType}
              options={options}
              onSave={handleSave}
              placeholder={`Enter ${formatFieldLabel(fieldKey).toLowerCase()}`}
            />
          ) : (
            <div className="text-base font-medium break-words">{formatFieldValue(value)}</div>
          )}
          {/* Field source badge - inline with value */}
          {source && (
            <FieldSourceBadge
              source={{
                documentId: source.documentId,
                documentName: source.documentName,
                confidence: source.confidence,
                extractedAt: source.extractedAt,
                manuallyEdited: source.manuallyEdited,
              }}
            />
          )}
        </div>
      </div>

      {/* Source pill and confidence indicators */}
      <div className="flex items-center gap-2 shrink-0">
        {source && (
          <FieldSourcePill
            documentName={source.documentName}
            manuallyEdited={source.manuallyEdited}
            size="sm"
          />
        )}
        {isLowConfidence && source && (
          <ConfidenceBadge confidence={source.confidence} size="sm" showIcon={false} />
        )}
      </div>
    </div>
  );
}

interface CategorySectionProps {
  categoryId: string;
  config: { name: string; icon: React.ComponentType<{ className?: string }> };
  fields: Array<{ key: string; value: unknown; source?: FieldSource }>;
  editable: boolean;
  onFieldChange?: (fieldName: string, value: unknown) => void;
  onFieldEdited?: (fieldName: string) => void;
  defaultExpanded?: boolean;
}

function CategorySection({
  categoryId,
  config,
  fields,
  editable,
  onFieldChange,
  onFieldEdited,
  defaultExpanded = true,
}: CategorySectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const Icon = config.icon;

  if (fields.length === 0) return null;

  return (
    <Card>
      <button
        type="button"
        className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{config.name}</h3>
            <p className="text-sm text-muted-foreground">
              {fields.length} field{fields.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {fields.length}
          </Badge>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <CardContent className="pt-0 pb-2">
          <div className="divide-y border-t">
            {fields.map((field) => (
              <FieldRow
                key={field.key}
                fieldKey={field.key}
                value={field.value}
                source={field.source}
                editable={editable}
                onValueChange={onFieldChange ? (v) => onFieldChange(field.key, v) : undefined}
                onEditComplete={onFieldEdited ? () => onFieldEdited(field.key) : undefined}
              />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ProfileView displays extracted profile data organized by category.
 *
 * @example
 * ```tsx
 * <ProfileView
 *   profileData={{ firstName: 'John', lastName: 'Doe' }}
 *   fieldSources={{ firstName: { documentName: 'passport.pdf', confidence: 0.95 } }}
 *   editable
 *   onFieldChange={(field, value) => console.log(field, value)}
 * />
 * ```
 */
export function ProfileView({
  profileData,
  fieldSources,
  onFieldChange,
  onFieldEdited,
  editable = false,
  className,
}: ProfileViewProps) {
  // Categorize all fields
  const categorizedFields = React.useMemo(() => {
    const result: Record<string, Array<{ key: string; value: unknown; source?: FieldSource }>> = {
      personal: [],
      documents: [],
      contact: [],
      other: [],
    };

    Object.entries(profileData).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;

      const category = categorizeField(key);
      result[category].push({
        key,
        value,
        source: fieldSources[key],
      });
    });

    // Sort fields within each category alphabetically
    Object.keys(result).forEach((cat) => {
      result[cat].sort((a, b) => a.key.localeCompare(b.key));
    });

    return result;
  }, [profileData, fieldSources]);

  // Calculate total field count
  const totalFields = Object.values(categorizedFields).reduce(
    (sum, fields) => sum + fields.length,
    0
  );

  // Empty state
  if (totalFields === 0) {
    return (
      <Card className={cn('text-center py-12', className)}>
        <CardContent>
          <User className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">No profile data extracted yet</p>
          <p className="text-sm text-muted-foreground/70 mt-2">
            Upload documents to extract profile information
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          {totalFields} field{totalFields !== 1 ? 's' : ''} extracted from your documents
        </p>
      </div>

      {/* Category sections */}
      {Object.entries(CATEGORY_CONFIG).map(([categoryId, config]) => (
        <CategorySection
          key={categoryId}
          categoryId={categoryId}
          config={config}
          fields={categorizedFields[categoryId]}
          editable={editable}
          onFieldChange={onFieldChange}
          onFieldEdited={onFieldEdited}
          defaultExpanded={categorizedFields[categoryId].length > 0 && categoryId !== 'other'}
        />
      ))}
    </div>
  );
}

export default ProfileView;

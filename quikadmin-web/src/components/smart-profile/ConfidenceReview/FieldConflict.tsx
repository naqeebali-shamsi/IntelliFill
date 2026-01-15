/**
 * FieldConflict Component
 *
 * Displays conflicting values from multiple documents for the same field.
 * Allows user to select which value to use or enter a custom value.
 *
 * @module components/smart-profile/ConfidenceReview/FieldConflict
 */

import * as React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ConfidenceBadge } from '../ConfidenceBadge';
import { cn } from '@/lib/utils';
import { AlertTriangle, Edit3 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ConflictValue {
  /** The extracted value */
  value: unknown;
  /** Source document info */
  source: {
    documentId: string;
    documentName: string;
    confidence: number;
  };
}

export interface FieldConflictProps {
  /** Field name/key */
  fieldName: string;
  /** Array of conflicting values from different documents */
  values: ConflictValue[];
  /** Index of currently selected value (-1 for custom) */
  selectedIndex: number;
  /** Callback when a value is selected */
  onSelect: (index: number) => void;
  /** Callback when custom value is entered */
  onCustomValue: (value: unknown) => void;
  /** Current custom value (if selectedIndex is -1) */
  customValue?: string;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert camelCase/snake_case field name to human-readable "Title Case" label.
 */
function formatFieldLabel(fieldName: string): string {
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

/**
 * Format value for display based on type
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '(empty)';
  }
  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Check if field is likely a name field (for transliteration message)
 */
function isNameField(fieldName: string): boolean {
  const lowerName = fieldName.toLowerCase();
  return (
    lowerName.includes('name') ||
    lowerName.includes('firstname') ||
    lowerName.includes('lastname') ||
    lowerName.includes('fullname')
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * FieldConflict displays conflicting values for user resolution.
 *
 * Features:
 * - Card with field name header and conflict indicator
 * - List of options with radio button selection
 * - Each option shows value, source document, confidence
 * - Custom value input option
 * - Special message for name transliteration cases
 *
 * @example
 * ```tsx
 * <FieldConflict
 *   fieldName="firstName"
 *   values={[
 *     { value: 'Mohammed', source: { documentId: '1', documentName: 'passport.pdf', confidence: 0.92 } },
 *     { value: 'Muhammad', source: { documentId: '2', documentName: 'id_card.pdf', confidence: 0.88 } },
 *   ]}
 *   selectedIndex={0}
 *   onSelect={(idx) => setSelected(idx)}
 *   onCustomValue={(val) => setCustom(val)}
 * />
 * ```
 */
export function FieldConflict({
  fieldName,
  values,
  selectedIndex,
  onSelect,
  onCustomValue,
  customValue = '',
  className,
}: FieldConflictProps) {
  const [localCustomValue, setLocalCustomValue] = React.useState(customValue);
  const label = formatFieldLabel(fieldName);
  const showNameMessage = isNameField(fieldName);

  // Update local custom value when prop changes
  React.useEffect(() => {
    setLocalCustomValue(customValue);
  }, [customValue]);

  const handleRadioChange = (value: string) => {
    if (value === 'custom') {
      onSelect(-1);
    } else {
      const idx = parseInt(value, 10);
      onSelect(idx);
    }
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalCustomValue(newValue);
    onCustomValue(newValue);
  };

  return (
    <Card className={cn('border-status-warning/30 bg-status-warning/5', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-status-warning-foreground" />
          <div>
            <h4 className="text-sm font-semibold">{label}</h4>
            <p className="text-xs text-muted-foreground">Conflicting values detected</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Helper text */}
        <p className="text-sm text-muted-foreground">
          Select which value to use, or enter a custom value
        </p>

        {/* Name transliteration message */}
        {showNameMessage && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-muted-foreground/30 pl-2">
            Both spellings may be valid (transliteration variants)
          </p>
        )}

        {/* Radio group for value selection */}
        <RadioGroup
          value={selectedIndex === -1 ? 'custom' : selectedIndex.toString()}
          onValueChange={handleRadioChange}
          className="space-y-2"
        >
          {values.map((item, index) => (
            <div
              key={index}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                selectedIndex === index
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/50'
              )}
            >
              <RadioGroupItem value={index.toString()} id={`value-${index}`} />
              <Label htmlFor={`value-${index}`} className="flex-1 cursor-pointer">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{formatValue(item.value)}</span>
                  <div className="flex items-center gap-2">
                    <ConfidenceBadge confidence={item.source.confidence} size="sm" />
                    <span className="text-xs text-muted-foreground">
                      from {item.source.documentName}
                    </span>
                  </div>
                </div>
              </Label>
            </div>
          ))}

          {/* Custom value option */}
          <div
            className={cn(
              'rounded-lg border p-3 transition-colors',
              selectedIndex === -1
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/50'
            )}
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem value="custom" id="value-custom" />
              <Label htmlFor="value-custom" className="flex items-center gap-2 cursor-pointer">
                <Edit3 className="h-4 w-4 text-muted-foreground" />
                <span>Use custom value</span>
              </Label>
            </div>
            {selectedIndex === -1 && (
              <div className="mt-3 ml-7">
                <Input
                  value={localCustomValue}
                  onChange={handleCustomInputChange}
                  placeholder="Enter custom value..."
                  className="h-9"
                  autoFocus
                />
              </div>
            )}
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}

export default FieldConflict;

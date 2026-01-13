/**
 * EditableField Component
 *
 * Inline editable field with display/edit modes.
 * Supports text, date, and select field types.
 *
 * @module components/smart-profile/EditableField
 */

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Pencil, Check, X } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type FieldType = 'text' | 'date' | 'select';

export interface SelectOption {
  value: string;
  label: string;
}

export interface EditableFieldProps {
  /** Current field value */
  value: string;
  /** Field type for input rendering */
  fieldType?: FieldType;
  /** Options for select field type */
  options?: SelectOption[];
  /** Callback when value is saved */
  onSave: (newValue: string) => void;
  /** Callback when edit is cancelled */
  onCancel?: () => void;
  /** Whether editing is disabled */
  disabled?: boolean;
  /** Placeholder text for input */
  placeholder?: string;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Field Type Detection
// ============================================================================

const DATE_FIELDS = ['dateofbirth', 'dob', 'birthdate', 'expiry', 'issue', 'date'];
const SELECT_FIELDS: Record<string, SelectOption[]> = {
  gender: [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
  ],
  nationality: [
    { value: 'UAE', label: 'United Arab Emirates' },
    { value: 'USA', label: 'United States' },
    { value: 'UK', label: 'United Kingdom' },
    { value: 'IN', label: 'India' },
    { value: 'PK', label: 'Pakistan' },
    { value: 'PH', label: 'Philippines' },
    { value: 'other', label: 'Other' },
  ],
};

/**
 * Detect field type from field key name
 */
export function detectFieldType(fieldKey: string): {
  type: FieldType;
  options?: SelectOption[];
} {
  const lowerKey = fieldKey.toLowerCase();

  // Check for select fields
  for (const [key, options] of Object.entries(SELECT_FIELDS)) {
    if (lowerKey.includes(key)) {
      return { type: 'select', options };
    }
  }

  // Check for date fields
  if (DATE_FIELDS.some((df) => lowerKey.includes(df))) {
    return { type: 'date' };
  }

  // Default to text
  return { type: 'text' };
}

// ============================================================================
// Component
// ============================================================================

/**
 * EditableField provides inline editing for profile fields.
 *
 * @example
 * ```tsx
 * <EditableField
 *   value="John"
 *   fieldType="text"
 *   onSave={(newValue) => console.log('Saved:', newValue)}
 * />
 * ```
 */
export function EditableField({
  value,
  fieldType = 'text',
  options = [],
  onSave,
  onCancel,
  disabled = false,
  placeholder = 'Enter value',
  className,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Update edit value when value prop changes
  React.useEffect(() => {
    setEditValue(value);
  }, [value]);

  // Focus input when entering edit mode
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (disabled) return;
    setEditValue(value);
    setIsEditing(true);
  };

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Display mode
  if (!isEditing) {
    return (
      <div
        className={cn(
          'group flex items-center gap-2 cursor-pointer rounded px-1 -mx-1 hover:bg-muted/50 transition-colors',
          className
        )}
        onClick={handleStartEdit}
        onKeyDown={(e) => e.key === 'Enter' && handleStartEdit()}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label={`Edit value: ${value || 'empty'}`}
      >
        <span className={cn('text-base font-medium', !value && 'text-muted-foreground italic')}>
          {value || placeholder}
        </span>
        {!disabled && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              handleStartEdit();
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  // Edit mode - Select
  if (fieldType === 'select' && options.length > 0) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Select value={editValue} onValueChange={setEditValue}>
          <SelectTrigger className="h-8 w-[180px]">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSave}>
          <Check className="h-4 w-4 text-status-success" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCancel}>
          <X className="h-4 w-4 text-status-error" />
        </Button>
      </div>
    );
  }

  // Edit mode - Text or Date
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Input
        ref={inputRef}
        type={fieldType === 'date' ? 'date' : 'text'}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-8"
      />
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSave}>
        <Check className="h-4 w-4 text-status-success" />
      </Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCancel}>
        <X className="h-4 w-4 text-status-error" />
      </Button>
    </div>
  );
}

export default EditableField;

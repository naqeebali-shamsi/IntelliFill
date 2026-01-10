/**
 * Editable Field Table Component
 *
 * Enhanced field mapping table that allows editing field values before form filling.
 * Features:
 * - Shows form field name and mapped profile field
 * - Editable value input for each field
 * - Pre-populates values from profile data
 * - Visual indicator for edited vs auto-filled values
 * - Highlights empty/unmapped fields
 */

import { useState } from 'react';
import { AlertCircle, RotateCcw, Edit2, Check, X } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { FormField, FieldMapping } from '@/types/formFilling';
import { cn } from '@/lib/utils';

interface EditableFieldTableProps {
  formFields: FormField[];
  mappings: FieldMapping[];
  profileData: Record<string, unknown>;
  editedValues: Record<string, string>;
  onValueChange: (fieldName: string, value: string) => void;
  onMappingChange: (formField: string, dataField: string | null) => void;
  onResetValue: (fieldName: string) => void;
  disabled?: boolean;
}

/**
 * Get the display value for a field
 */
function getFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    // Handle ExtractedFieldResult format
    if ('value' in value) {
      return String((value as { value: unknown }).value ?? '');
    }
    return JSON.stringify(value);
  }
  return String(value);
}

export function EditableFieldTable({
  formFields,
  mappings,
  profileData,
  editedValues,
  onValueChange,
  onMappingChange,
  onResetValue,
  disabled = false,
}: EditableFieldTableProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState('');

  const profileFieldNames = Object.keys(profileData);

  const getMappedProfileField = (formFieldName: string): string | null => {
    return mappings.find((m) => m.formField === formFieldName)?.documentField || null;
  };

  const getOriginalValue = (formFieldName: string): string => {
    const profileField = getMappedProfileField(formFieldName);
    return profileField ? getFieldValue(profileData[profileField]) : '';
  };

  const getCurrentValue = (formFieldName: string): string => {
    // Check if user has edited this field
    if (formFieldName in editedValues) {
      return editedValues[formFieldName];
    }
    // Otherwise return the original mapped value
    return getOriginalValue(formFieldName);
  };

  const isEdited = (formFieldName: string): boolean => {
    if (!(formFieldName in editedValues)) return false;
    return editedValues[formFieldName] !== getOriginalValue(formFieldName);
  };

  const startEditing = (fieldName: string) => {
    setEditingField(fieldName);
    setTempValue(getCurrentValue(fieldName));
  };

  const saveEdit = (fieldName: string) => {
    onValueChange(fieldName, tempValue);
    setEditingField(null);
    setTempValue('');
  };

  const cancelEdit = () => {
    setEditingField(null);
    setTempValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, fieldName: string) => {
    if (e.key === 'Enter') {
      saveEdit(fieldName);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  // Count stats
  const filledCount = formFields.filter((f) => getCurrentValue(f.name)).length;
  const emptyCount = formFields.length - filledCount;
  const editedCount = formFields.filter((f) => isEdited(f.name)).length;

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{filledCount}</span> fields filled
        </span>
        {emptyCount > 0 && (
          <span className="text-warning">
            <span className="font-medium">{emptyCount}</span> empty
          </span>
        )}
        {editedCount > 0 && (
          <span className="text-primary">
            <span className="font-medium">{editedCount}</span> edited
          </span>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[25%]">Form Field</TableHead>
              <TableHead className="w-[25%]">Profile Field</TableHead>
              <TableHead className="w-[40%]">Value</TableHead>
              <TableHead className="w-[10%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formFields.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No form fields detected.
                </TableCell>
              </TableRow>
            ) : (
              formFields.map((field) => {
                const mappedField = getMappedProfileField(field.name);
                const currentValue = getCurrentValue(field.name);
                const fieldIsEdited = isEdited(field.name);
                const isUnmapped = !mappedField;
                const isEmpty = !currentValue;
                const isCurrentlyEditing = editingField === field.name;

                return (
                  <TableRow
                    key={field.name}
                    className={cn(isEmpty && 'bg-warning/5', fieldIsEdited && 'bg-primary/5')}
                  >
                    {/* Form Field Name */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{field.name}</span>
                        {field.required && (
                          <Badge variant="outline" className="text-xs">
                            Required
                          </Badge>
                        )}
                        {field.required && isEmpty && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertCircle className="h-4 w-4 text-destructive" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Required field is empty</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>

                    {/* Profile Field Dropdown */}
                    <TableCell>
                      <Select
                        value={mappedField || 'unmapped'}
                        onValueChange={(value) => {
                          const newValue = value === 'unmapped' ? null : value;
                          onMappingChange(field.name, newValue);
                        }}
                        disabled={disabled}
                      >
                        <SelectTrigger className="w-full h-9">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unmapped">
                            <span className="text-muted-foreground italic">-- None --</span>
                          </SelectItem>
                          {profileFieldNames.map((profileField) => (
                            <SelectItem key={profileField} value={profileField}>
                              {profileField}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Editable Value */}
                    <TableCell>
                      {isCurrentlyEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, field.name)}
                            className="h-9"
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => saveEdit(field.name)}
                            className="h-8 w-8 p-0 text-primary"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelEdit}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-md border border-transparent',
                            'hover:border-border hover:bg-muted/50 cursor-pointer transition-colors',
                            isEmpty && 'text-muted-foreground italic',
                            disabled && 'pointer-events-none opacity-50'
                          )}
                          onClick={() => !disabled && startEditing(field.name)}
                        >
                          <span className="flex-1 truncate">
                            {currentValue || 'Click to add value...'}
                          </span>
                          {fieldIsEdited && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              Edited
                            </Badge>
                          )}
                          {!disabled && (
                            <Edit2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      {fieldIsEdited && !isCurrentlyEditing && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onResetValue(field.name)}
                                className="h-8 w-8 p-0"
                                disabled={disabled}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Reset to original value</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

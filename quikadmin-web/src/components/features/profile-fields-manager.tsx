/**
 * ProfileFieldsManager - Component to manage data fields for a profile
 * B2C-focused: Allows users to view, edit, add, and delete field values
 * Groups fields by category (personal, address, financial, etc.)
 * @module components/features/profile-fields-manager
 */

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Save,
  Database,
  User,
  MapPin,
  Briefcase,
  CreditCard,
  FileText,
  Settings,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyStateSimple } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { cn } from '@/lib/utils';

// =================== TYPES ===================

export interface FieldValue {
  key: string;
  value: string;
  source?: 'ocr' | 'manual' | 'imported';
  confidence?: number;
  lastUpdated?: string;
}

export interface FieldCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: FieldValue[];
}

export interface ProfileFieldsManagerProps {
  /**
   * Profile ID
   */
  profileId: string;
  /**
   * Profile data fields
   */
  fields: Record<string, any>;
  /**
   * Field sources metadata
   */
  fieldSources?: Record<string, string>;
  /**
   * Whether the component is in loading state
   */
  isLoading?: boolean;
  /**
   * Callback when fields are updated
   */
  onFieldsUpdate?: (fields: Record<string, any>) => void;
  /**
   * Whether to allow editing
   */
  editable?: boolean;
}

// =================== FIELD CATEGORIES ===================

const FIELD_CATEGORIES: Record<
  string,
  { name: string; icon: React.ComponentType<{ className?: string }>; keywords: string[] }
> = {
  personal: {
    name: 'Personal Information',
    icon: User,
    keywords: [
      'name',
      'first',
      'last',
      'middle',
      'full',
      'dob',
      'birth',
      'gender',
      'nationality',
      'citizen',
      'ssn',
      'social',
      'passport',
      'license',
      'id',
    ],
  },
  contact: {
    name: 'Contact Information',
    icon: MapPin,
    keywords: [
      'email',
      'phone',
      'mobile',
      'tel',
      'address',
      'street',
      'city',
      'state',
      'zip',
      'postal',
      'country',
      'apt',
      'apartment',
      'suite',
      'unit',
    ],
  },
  employment: {
    name: 'Employment',
    icon: Briefcase,
    keywords: [
      'employer',
      'job',
      'title',
      'occupation',
      'company',
      'work',
      'position',
      'department',
      'office',
      'salary',
      'income',
      'annual',
    ],
  },
  financial: {
    name: 'Financial',
    icon: CreditCard,
    keywords: [
      'bank',
      'account',
      'routing',
      'credit',
      'card',
      'tax',
      'ein',
      'tin',
      'payment',
      'balance',
      'amount',
    ],
  },
  documents: {
    name: 'Document Details',
    icon: FileText,
    keywords: [
      'issue',
      'expiry',
      'expiration',
      'number',
      'document',
      'visa',
      'permit',
      'certificate',
    ],
  },
  other: {
    name: 'Other',
    icon: Settings,
    keywords: [], // Catch-all category
  },
};

function categorizeField(fieldKey: string): string {
  const lowerKey = fieldKey.toLowerCase();

  for (const [category, config] of Object.entries(FIELD_CATEGORIES)) {
    if (category === 'other') continue;
    if (config.keywords.some((keyword) => lowerKey.includes(keyword))) {
      return category;
    }
  }

  return 'other';
}

function formatFieldName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\./g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

function getSourceBadge(source?: string): {
  label: string;
  variant: 'default' | 'secondary' | 'outline';
} {
  switch (source) {
    case 'ocr':
      return { label: 'OCR', variant: 'secondary' };
    case 'manual':
      return { label: 'Manual', variant: 'outline' };
    case 'imported':
      return { label: 'Imported', variant: 'default' };
    default:
      return { label: 'Unknown', variant: 'outline' };
  }
}

// =================== FIELD ROW COMPONENT ===================

interface FieldRowProps {
  fieldKey: string;
  value: string;
  source?: string;
  editable: boolean;
  onEdit: (key: string, value: string) => void;
  onDelete: (key: string) => void;
}

function FieldRow({ fieldKey, value, source, editable, onEdit, onDelete }: FieldRowProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    onEdit(fieldKey, editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const sourceBadge = getSourceBadge(source);

  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50 group">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground">{formatFieldName(fieldKey)}</div>
        {isEditing ? (
          <div className="flex items-center gap-2 mt-1">
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8"
            />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSave}>
              <Check className="h-4 w-4 text-status-success" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCancel}>
              <X className="h-4 w-4 text-status-error" />
            </Button>
          </div>
        ) : (
          <div className="font-medium truncate">{value || '-'}</div>
        )}
      </div>

      <Badge variant={sourceBadge.variant} className="text-xs shrink-0">
        {sourceBadge.label}
      </Badge>

      {editable && !isEditing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Field</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{formatFieldName(fieldKey)}"? This action cannot
                  be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(fieldKey)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

// =================== CATEGORY SECTION COMPONENT ===================

interface CategorySectionProps {
  category: string;
  config: { name: string; icon: React.ComponentType<{ className?: string }> };
  fields: Array<{ key: string; value: string; source?: string }>;
  editable: boolean;
  onEditField: (key: string, value: string) => void;
  onDeleteField: (key: string) => void;
  defaultExpanded?: boolean;
}

function CategorySection({
  category,
  config,
  fields,
  editable,
  onEditField,
  onDeleteField,
  defaultExpanded = true,
}: CategorySectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const Icon = config.icon;

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="border rounded-lg">
      <button
        type="button"
        className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{config.name}</span>
          <Badge variant="secondary" className="text-xs">
            {fields.length}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t divide-y">
          {fields.map((field) => (
            <FieldRow
              key={field.key}
              fieldKey={field.key}
              value={field.value}
              source={field.source}
              editable={editable}
              onEdit={onEditField}
              onDelete={onDeleteField}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =================== ADD FIELD DIALOG ===================

interface AddFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (key: string, value: string, category: string) => void;
  existingKeys: string[];
}

function AddFieldDialog({ open, onOpenChange, onAdd, existingKeys }: AddFieldDialogProps) {
  const [fieldName, setFieldName] = React.useState('');
  const [fieldValue, setFieldValue] = React.useState('');
  const [category, setCategory] = React.useState('other');
  const [error, setError] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const key = fieldName.toLowerCase().replace(/\s+/g, '_');

    if (existingKeys.includes(key)) {
      setError('A field with this name already exists');
      return;
    }

    onAdd(key, fieldValue, category);
    setFieldName('');
    setFieldValue('');
    setCategory('other');
    setError('');
    onOpenChange(false);
  };

  const handleClose = () => {
    setFieldName('');
    setFieldValue('');
    setCategory('other');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Custom Field</DialogTitle>
          <DialogDescription>
            Add a new data field to this profile. This field will be available for form filling.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="field-name">Field Name</Label>
            <Input
              id="field-name"
              placeholder="e.g., Emergency Contact"
              value={fieldName}
              onChange={(e) => {
                setFieldName(e.target.value);
                setError('');
              }}
              required
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-value">Value</Label>
            <Input
              id="field-value"
              placeholder="Enter value"
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FIELD_CATEGORIES).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!fieldName || !fieldValue}>
              Add Field
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// =================== MAIN COMPONENT ===================

export function ProfileFieldsManager({
  profileId,
  fields,
  fieldSources = {},
  isLoading = false,
  onFieldsUpdate,
  editable = true,
}: ProfileFieldsManagerProps) {
  const [localFields, setLocalFields] = React.useState<Record<string, any>>(fields);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);

  // Update local fields when props change
  React.useEffect(() => {
    setLocalFields(fields);
    setHasChanges(false);
  }, [fields]);

  // Categorize fields
  const categorizedFields = React.useMemo(() => {
    const result: Record<string, Array<{ key: string; value: string; source?: string }>> = {};

    // Initialize all categories
    Object.keys(FIELD_CATEGORIES).forEach((cat) => {
      result[cat] = [];
    });

    // Categorize each field
    Object.entries(localFields).forEach(([key, value]) => {
      if (value === null || value === undefined) return;

      const category = categorizeField(key);
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

      result[category].push({
        key,
        value: stringValue,
        source: fieldSources[key] || 'manual',
      });
    });

    // Sort fields within each category
    Object.keys(result).forEach((cat) => {
      result[cat].sort((a, b) => a.key.localeCompare(b.key));
    });

    return result;
  }, [localFields, fieldSources]);

  const handleEditField = (key: string, value: string) => {
    setLocalFields((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleDeleteField = (key: string) => {
    setLocalFields((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    setHasChanges(true);
    toast.success('Field deleted');
  };

  const handleAddField = (key: string, value: string, _category: string) => {
    setLocalFields((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    toast.success('Field added');
  };

  const handleSaveChanges = () => {
    onFieldsUpdate?.(localFields);
    setHasChanges(false);
    toast.success('Changes saved');
  };

  const handleDiscardChanges = () => {
    setLocalFields(fields);
    setHasChanges(false);
  };

  const totalFields = Object.keys(localFields).length;
  const existingKeys = Object.keys(localFields);

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Stored Field Data
            </CardTitle>
            <CardDescription>
              {totalFields} data field{totalFields !== 1 ? 's' : ''} stored for form auto-filling
            </CardDescription>
          </div>
          {editable && (
            <div className="flex items-center gap-2">
              {hasChanges && (
                <>
                  <Button variant="outline" size="sm" onClick={handleDiscardChanges}>
                    Discard
                  </Button>
                  <Button size="sm" onClick={handleSaveChanges}>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Field
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {totalFields === 0 ? (
          <EmptyStateSimple
            icon={Database}
            message="No field data stored yet. Data will appear here after processing documents or adding fields manually."
          />
        ) : (
          <div className="space-y-3">
            {Object.entries(FIELD_CATEGORIES).map(([category, config]) => (
              <CategorySection
                key={category}
                category={category}
                config={config}
                fields={categorizedFields[category]}
                editable={editable}
                onEditField={handleEditField}
                onDeleteField={handleDeleteField}
                defaultExpanded={categorizedFields[category].length > 0 && category !== 'other'}
              />
            ))}
          </div>
        )}
      </CardContent>

      <AddFieldDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddField}
        existingKeys={existingKeys}
      />
    </Card>
  );
}

export default ProfileFieldsManager;

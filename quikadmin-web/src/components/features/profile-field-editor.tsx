import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Edit2,
  Trash2,
  Check,
  X,
  FileText,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { ProfileFieldValue } from '@/services/userProfileService';
import { getFieldValidator, validateField } from '@/lib/validations/profile';
import { cn } from '@/lib/utils';

interface ProfileFieldEditorProps {
  field: ProfileFieldValue;
  onUpdate: (fieldKey: string, value: string) => Promise<void>;
  onDelete: (fieldKey: string) => Promise<void>;
  onViewSource?: (documentId: string) => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

export function ProfileFieldEditor({
  field,
  onUpdate,
  onDelete,
  onViewSource,
  isUpdating = false,
  isDeleting = false,
}: ProfileFieldEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(field.values[0] || '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const displayValue = field.values.join(', ') || 'N/A';
  const fieldLabel = field.key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Get confidence color
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (confidence >= 50) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  };

  // Handle edit mode
  const handleEditClick = () => {
    setIsEditing(true);
    setEditValue(field.values[0] || '');
    setValidationError(null);
  };

  // Handle save
  const handleSave = async () => {
    // Validate field
    const validation = validateField(field.key, editValue);

    if (!validation.success) {
      setValidationError(validation.error || 'Invalid value');
      toast.error('Validation Failed', {
        description: validation.error || 'Invalid value',
      });
      return;
    }

    try {
      await onUpdate(field.key, editValue);
      setIsEditing(false);
      setValidationError(null);
      toast.success('Field Updated', {
        description: `${fieldLabel} has been updated successfully.`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update field';
      setValidationError(errorMessage);
      toast.error('Update Failed', {
        description: errorMessage,
      });
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(field.values[0] || '');
    setValidationError(null);
  };

  // Handle delete
  const handleDelete = async () => {
    try {
      await onDelete(field.key);
      toast.success('Field Deleted', {
        description: `${fieldLabel} has been removed from your profile.`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete field';
      toast.error('Delete Failed', {
        description: errorMessage,
      });
    }
  };

  // Format last updated date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="group relative rounded-lg border bg-card p-4 transition-all hover:shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          {/* Field Label */}
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">{fieldLabel}</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="secondary"
                    className={cn('text-xs', getConfidenceColor(field.confidence))}
                  >
                    {field.confidence.toFixed(0)}%
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Confidence Score: {field.confidence.toFixed(1)}%</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Field Value - Edit or Display Mode */}
          {isEditing ? (
            <div className="space-y-2">
              <Input
                value={editValue}
                onChange={(e) => {
                  setEditValue(e.target.value);
                  setValidationError(null);
                }}
                placeholder={`Enter ${fieldLabel.toLowerCase()}`}
                className={cn(
                  'w-full',
                  validationError && 'border-destructive focus-visible:ring-destructive'
                )}
                disabled={isUpdating}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSave();
                  } else if (e.key === 'Escape') {
                    handleCancel();
                  }
                }}
              />
              {validationError && (
                <div className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{validationError}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground break-words">
              {displayValue}
            </p>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-help">
                    <FileText className="h-3 w-3" />
                    <span>{field.sourceCount} source{field.sourceCount !== 1 ? 's' : ''}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Found in {field.sourceCount} document{field.sourceCount !== 1 ? 's' : ''}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span>•</span>
            <span>Updated {formatDate(field.lastUpdated)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
                onClick={handleSave}
                disabled={isUpdating || !editValue.trim()}
                title="Save changes"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={handleCancel}
                disabled={isUpdating}
                title="Cancel editing"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleEditClick}
                disabled={isUpdating || isDeleting}
                title="Edit field"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={isUpdating || isDeleting}
                    title="Delete field"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Field</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete the field "{fieldLabel}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfileFieldEditor;

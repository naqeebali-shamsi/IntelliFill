/**
 * TemplatePreviewModal Component
 *
 * Displays a preview of a template including its structure,
 * field mappings, and a sample filled output preview.
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  ArrowRight,
  Edit,
  Sparkles,
  Calendar,
  BarChart3,
  Loader2,
  AlertCircle,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getTemplate } from '@/services/formService';
import type { MappingTemplate } from '@/types/formFilling';

/**
 * Props for the TemplatePreviewModal component
 */
export interface TemplatePreviewModalProps {
  /**
   * Template ID to preview
   */
  templateId: string | null;
  /**
   * Whether the modal is open
   */
  open: boolean;
  /**
   * Handler for closing the modal
   */
  onOpenChange: (open: boolean) => void;
  /**
   * Handler for edit action
   */
  onEdit?: (templateId: string) => void;
  /**
   * Handler for use template action
   */
  onUseTemplate?: (templateId: string) => void;
}

/**
 * Sample data for preview demonstration
 */
const SAMPLE_DATA: Record<string, string> = {
  first_name: 'John',
  last_name: 'Doe',
  full_name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '(555) 123-4567',
  date_of_birth: '1990-01-15',
  ssn: '***-**-1234',
  address: '123 Main Street',
  city: 'New York',
  state: 'NY',
  zip: '10001',
  employer_name: 'Acme Corporation',
  employer_ein: '12-3456789',
  wages: '$85,000.00',
  federal_tax: '$12,750.00',
  social_security_wages: '$85,000.00',
  medicare_wages: '$85,000.00',
};

/**
 * Get a sample value for a field based on its name
 */
function getSampleValue(fieldName: string): string {
  const normalizedName = fieldName.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  // Check for exact match
  if (SAMPLE_DATA[normalizedName]) {
    return SAMPLE_DATA[normalizedName];
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(SAMPLE_DATA)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return value;
    }
  }

  // Generate placeholder based on field name
  if (normalizedName.includes('date')) return '2024-01-15';
  if (normalizedName.includes('email')) return 'user@example.com';
  if (normalizedName.includes('phone')) return '(555) 000-0000';
  if (normalizedName.includes('amount') || normalizedName.includes('wage') || normalizedName.includes('tax')) return '$0.00';
  if (normalizedName.includes('number') || normalizedName.includes('ssn') || normalizedName.includes('ein')) return '000-00-0000';

  return 'Sample Value';
}

/**
 * Format date for display
 */
function formatDate(dateString?: string): string {
  if (!dateString) return 'Unknown';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * TemplatePreviewModal component
 */
export function TemplatePreviewModal({
  templateId,
  open,
  onOpenChange,
  onEdit,
  onUseTemplate,
}: TemplatePreviewModalProps) {
  // Fetch template details when modal opens
  const {
    data: template,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['template', templateId],
    queryFn: () => getTemplate(templateId!),
    enabled: open && !!templateId,
  });

  // Get field mappings array
  const fieldMappings = React.useMemo(() => {
    if (!template) return [];

    // Handle both mappings object and fieldMappings array
    if (template.fieldMappings && Array.isArray(template.fieldMappings)) {
      return template.fieldMappings;
    }

    if (template.mappings && typeof template.mappings === 'object') {
      return Object.entries(template.mappings).map(([formField, documentField]) => ({
        targetField: formField,
        sourceField: documentField,
      }));
    }

    return [];
  }, [template]);

  const handleEdit = () => {
    if (templateId && onEdit) {
      onEdit(templateId);
      onOpenChange(false);
    }
  };

  const handleUseTemplate = () => {
    if (templateId && onUseTemplate) {
      onUseTemplate(templateId);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="2xl"
        className="max-h-[85vh] flex flex-col"
        data-testid="template-preview-modal"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Template Preview
          </DialogTitle>
          <DialogDescription>
            Review the template structure and field mappings before using it.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary/50" />
            <p>Loading template details...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-destructive">
            <AlertCircle className="h-8 w-8 mb-4" />
            <p>Failed to load template</p>
            <p className="text-sm text-muted-foreground mt-1">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        ) : template ? (
          <div className="flex-1 overflow-hidden flex flex-col gap-6">
            {/* Template Info Header */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{template.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {template.description || 'No description provided.'}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {template.formType || 'Custom'}
                </Badge>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  <span>{fieldMappings.length} field mappings</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4" />
                  <span>{template.usageCount || 0} uses</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span>Updated {formatDate(template.updatedAt || template.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Field Mappings Table */}
            <div className="flex-1 border rounded-lg overflow-hidden">
              <div className="bg-muted/30 border-b px-4 py-2">
                <h4 className="font-medium text-sm">Field Mappings</h4>
              </div>

              {fieldMappings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No field mappings defined yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[250px]">
                  <div className="divide-y divide-border/50">
                    {/* Header Row */}
                    <div className="grid grid-cols-[1fr_auto_1fr_1fr] gap-4 px-4 py-2 bg-muted/20 text-xs font-medium text-muted-foreground">
                      <div>Form Field</div>
                      <div className="w-6" />
                      <div>Source Field</div>
                      <div>Sample Value</div>
                    </div>

                    {/* Mapping Rows */}
                    {fieldMappings.map((mapping: any, index: number) => {
                      const formField = mapping.targetField || mapping.formField;
                      const sourceField = mapping.sourceField || mapping.documentField;
                      const sampleValue = sourceField ? getSampleValue(sourceField) : '-';

                      return (
                        <div
                          key={`${formField}-${index}`}
                          className="grid grid-cols-[1fr_auto_1fr_1fr] gap-4 px-4 py-3 text-sm hover:bg-muted/10 transition-colors"
                          data-testid={`field-mapping-${index}`}
                        >
                          <div className="font-medium truncate" title={formField}>
                            {formField}
                          </div>
                          <div className="flex items-center justify-center w-6">
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div
                            className={cn(
                              'truncate',
                              sourceField ? 'text-foreground' : 'text-muted-foreground italic'
                            )}
                            title={sourceField || 'Unmapped'}
                          >
                            {sourceField || 'Unmapped'}
                          </div>
                          <div className="text-muted-foreground truncate" title={sampleValue}>
                            {sampleValue}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Sample Output Preview */}
            {fieldMappings.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/30 border-b px-4 py-2">
                  <h4 className="font-medium text-sm">Sample Output Preview</h4>
                </div>
                <div className="p-4 bg-muted/10">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {fieldMappings.slice(0, 6).map((mapping: any, index: number) => {
                      const formField = mapping.targetField || mapping.formField;
                      const sourceField = mapping.sourceField || mapping.documentField;
                      const sampleValue = sourceField ? getSampleValue(sourceField) : '';

                      return (
                        <div key={`preview-${index}`} className="flex items-center gap-2">
                          <span className="text-muted-foreground w-32 truncate" title={formField}>
                            {formField}:
                          </span>
                          <span className="font-medium truncate" title={sampleValue}>
                            {sampleValue || '-'}
                          </span>
                        </div>
                      );
                    })}
                    {fieldMappings.length > 6 && (
                      <div className="col-span-2 text-muted-foreground text-xs mt-2">
                        + {fieldMappings.length - 6} more fields...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {template && onEdit && (
            <Button variant="secondary" onClick={handleEdit} data-testid="preview-edit-button">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {template && onUseTemplate && (
            <Button onClick={handleUseTemplate} data-testid="preview-use-button">
              <Sparkles className="mr-2 h-4 w-4" />
              Use Template
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TemplatePreviewModal;

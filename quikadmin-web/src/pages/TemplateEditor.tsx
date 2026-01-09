/**
 * TemplateEditor Page
 *
 * Form for creating and editing templates with field mapping configuration.
 * Route: `/templates/new` (create mode) and `/templates/:id/edit` (edit mode)
 */

import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  GripVertical,
  FileText,
  Eye,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
import { PageHeader } from '@/components/layout/page-header';

import { useTemplateStore } from '@/stores/templateStore';
import {
  templateFormSchema,
  type TemplateFormData,
  type FieldMapping,
  templateCategoryOptions,
  createDefaultFieldMapping,
  transformFormDataToApi,
} from '@/lib/validations/template';

// ============================================================================
// Constants
// ============================================================================

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'select', label: 'Select' },
] as const;

const CATEGORY_OPTIONS = [
  { value: 'legal', label: 'Legal' },
  { value: 'financial', label: 'Financial' },
  { value: 'hr', label: 'Human Resources' },
  { value: 'medical', label: 'Medical' },
  { value: 'custom', label: 'Custom' },
] as const;

// ============================================================================
// Field Mapping Item Component
// ============================================================================

interface FieldMappingItemProps {
  field: FieldMapping;
  index: number;
  onUpdate: (index: number, data: Partial<FieldMapping>) => void;
  onRemove: (index: number) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  error?: Record<string, { message?: string }>;
}

function FieldMappingItem({
  field,
  index,
  onUpdate,
  onRemove,
  isExpanded,
  onToggleExpand,
  error,
}: FieldMappingItemProps) {
  return (
    <Reorder.Item
      value={field}
      id={field.id}
      className="bg-background/50 border border-border/50 rounded-lg overflow-hidden"
    >
      {/* Collapsed Header */}
      <div className="flex items-center gap-3 p-3">
        <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {field.label || `Field ${index + 1}`}
            </span>
            <Badge variant="outline" className="text-xs">
              {field.fieldType}
            </Badge>
            {field.required && (
              <Badge variant="secondary" className="text-xs">
                Required
              </Badge>
            )}
          </div>
          {field.formField && (
            <span className="text-xs text-muted-foreground">
              {field.formField}
            </span>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggleExpand}
          aria-label={isExpanded ? 'Collapse field' : 'Expand field'}
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          className="text-destructive hover:bg-destructive/10"
          aria-label="Remove field"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 border-t border-border/50 bg-muted/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Label */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Label *</label>
                  <Input
                    value={field.label}
                    onChange={(e) => onUpdate(index, { label: e.target.value })}
                    placeholder="e.g., Full Name"
                    aria-invalid={!!error?.label}
                  />
                  {error?.label && (
                    <p className="text-sm text-destructive">{error.label.message}</p>
                  )}
                </div>

                {/* Form Field ID */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Form Field ID *</label>
                  <Input
                    value={field.formField}
                    onChange={(e) => onUpdate(index, { formField: e.target.value })}
                    placeholder="e.g., full_name"
                    aria-invalid={!!error?.formField}
                  />
                  {error?.formField && (
                    <p className="text-sm text-destructive">{error.formField.message}</p>
                  )}
                </div>

                {/* Document Field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Document Field</label>
                  <Input
                    value={field.documentField || ''}
                    onChange={(e) => onUpdate(index, { documentField: e.target.value || null })}
                    placeholder="e.g., extracted_name"
                  />
                  <p className="text-xs text-muted-foreground">
                    Field name in extracted document data
                  </p>
                </div>

                {/* Field Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Field Type</label>
                  <Select
                    value={field.fieldType}
                    onValueChange={(value) =>
                      onUpdate(index, { fieldType: value as FieldMapping['fieldType'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Required Checkbox */}
                <div className="flex items-center gap-2 md:col-span-2">
                  <Checkbox
                    id={`required-${field.id}`}
                    checked={field.required}
                    onCheckedChange={(checked) =>
                      onUpdate(index, { required: checked === true })
                    }
                  />
                  <label
                    htmlFor={`required-${field.id}`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    This field is required
                  </label>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}

// ============================================================================
// Template Preview Panel
// ============================================================================

interface TemplatePreviewProps {
  name: string;
  description?: string;
  category?: string;
  fieldMappings: FieldMapping[];
}

function TemplatePreview({ name, description, category, fieldMappings }: TemplatePreviewProps) {
  return (
    <Card className="sticky top-6">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Preview</h3>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {name || 'Untitled Template'}
            </h4>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
            {category && (
              <Badge variant="outline" className="mt-2">
                {CATEGORY_OPTIONS.find((c) => c.value === category)?.label || category}
              </Badge>
            )}
          </div>

          {fieldMappings.length > 0 ? (
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-muted-foreground">
                Fields ({fieldMappings.length})
              </h5>
              <div className="space-y-1.5">
                {fieldMappings.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded-md"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">{index + 1}.</span>
                      {field.label || 'Unnamed Field'}
                      {field.required && (
                        <span className="text-destructive">*</span>
                      )}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {field.fieldType}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Add fields to see them here
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  // Store
  const {
    currentTemplate,
    isLoading: storeLoading,
    error: storeError,
    loadTemplate,
    createTemplate,
    updateTemplate,
    clearError,
  } = useTemplateStore();

  // Local state
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [expandedFields, setExpandedFields] = React.useState<Set<string>>(new Set());

  // Form setup
  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: '',
      description: '',
      category: 'custom',
      fieldMappings: [createDefaultFieldMapping(0)],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'fieldMappings',
    keyName: 'key',
  });

  // Watch form values for preview
  const watchedValues = form.watch();

  // Load template data in edit mode
  React.useEffect(() => {
    if (isEditMode && id) {
      loadTemplate(id);
    }
  }, [isEditMode, id, loadTemplate]);

  // Reset form when template data loads
  React.useEffect(() => {
    if (isEditMode && currentTemplate) {
      // Transform template data to form format
      const formData: TemplateFormData = {
        name: currentTemplate.name,
        description: currentTemplate.description || '',
        category: (currentTemplate.formType as TemplateFormData['category']) || 'custom',
        fieldMappings: currentTemplate.fieldMappings?.map((fm: any, index: number) => ({
          id: fm.id || `field_${index}`,
          formField: fm.formField || '',
          documentField: fm.documentField || null,
          label: fm.label || fm.formField || '',
          fieldType: fm.fieldType || 'text',
          required: fm.required || false,
          order: fm.order ?? index,
        })) || [createDefaultFieldMapping(0)],
      };
      form.reset(formData);

      // Expand first field if only one exists
      if (formData.fieldMappings.length === 1) {
        setExpandedFields(new Set([formData.fieldMappings[0].id]));
      }
    }
  }, [isEditMode, currentTemplate, form]);

  // Clear error on unmount
  React.useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // Handlers
  const handleSubmit = async (data: TemplateFormData) => {
    setIsSubmitting(true);
    try {
      const apiData = transformFormDataToApi(data);

      if (isEditMode && id) {
        await updateTemplate(id, apiData);
        toast.success('Template updated successfully');
      } else {
        await createTemplate(apiData);
        toast.success('Template created successfully');
      }
      navigate('/templates');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save template');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddField = () => {
    const newField = createDefaultFieldMapping(fields.length);
    append(newField);
    setExpandedFields((prev) => new Set([...prev, newField.id]));
  };

  const handleRemoveField = (index: number) => {
    const fieldId = fields[index]?.id;
    remove(index);
    if (fieldId) {
      setExpandedFields((prev) => {
        const next = new Set(prev);
        next.delete(fieldId);
        return next;
      });
    }
  };

  const handleToggleExpand = (fieldId: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  };

  const handleReorder = (newOrder: FieldMapping[]) => {
    // Update the order property and form state
    const reorderedFields = newOrder.map((field, index) => ({
      ...field,
      order: index,
    }));
    form.setValue('fieldMappings', reorderedFields);
  };

  const handleCancel = () => {
    navigate('/templates');
  };

  // Loading state
  if (isEditMode && storeLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  // Error state
  if (isEditMode && storeError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 max-w-lg mx-auto text-center">
        <div className="bg-error-light p-4 rounded-full text-error mb-4">
          <AlertTriangle className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Template Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The template you are looking for does not exist or has been deleted.
        </p>
        <Button onClick={() => navigate('/templates')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Templates
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6" data-testid="template-editor">
      {/* Page Header */}
      <PageHeader
        title={isEditMode ? 'Edit Template' : 'Create Template'}
        description={
          isEditMode
            ? 'Modify your template configuration and field mappings.'
            : 'Create a new template for quick form filling.'
        }
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Templates', href: '/templates' },
          { label: isEditMode ? 'Edit Template' : 'New Template' },
        ]}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Info Card */}
              <Card>
                <CardHeader className="border-b border-border/50">
                  <h3 className="font-semibold">Template Details</h3>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., W-2 Tax Form"
                            {...field}
                            data-testid="template-name-input"
                          />
                        </FormControl>
                        <FormDescription>
                          A descriptive name for this template
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe what this template is used for..."
                            rows={3}
                            {...field}
                            data-testid="template-description-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="template-category-select">
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CATEGORY_OPTIONS.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Field Mappings Card */}
              <Card>
                <CardHeader className="border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Field Mappings</h3>
                      <p className="text-sm text-muted-foreground">
                        Define the fields that will be auto-filled in this template
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddField}
                      data-testid="add-field-button"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Field
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {fields.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="mb-4">No fields defined yet</p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddField}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Field
                      </Button>
                    </div>
                  ) : (
                    <Reorder.Group
                      axis="y"
                      values={fields as FieldMapping[]}
                      onReorder={handleReorder}
                      className="space-y-3"
                    >
                      {fields.map((field, index) => (
                        <FieldMappingItem
                          key={field.id}
                          field={field as FieldMapping}
                          index={index}
                          onUpdate={(idx, data) => {
                            const currentField = form.getValues(`fieldMappings.${idx}`);
                            form.setValue(`fieldMappings.${idx}`, {
                              ...currentField,
                              ...data,
                            });
                          }}
                          onRemove={handleRemoveField}
                          isExpanded={expandedFields.has(field.id)}
                          onToggleExpand={() => handleToggleExpand(field.id)}
                          error={
                            form.formState.errors.fieldMappings?.[index] as
                              | Record<string, { message?: string }>
                              | undefined
                          }
                        />
                      ))}
                    </Reorder.Group>
                  )}

                  {form.formState.errors.fieldMappings?.root && (
                    <p className="text-sm text-destructive mt-4">
                      {form.formState.errors.fieldMappings.root.message}
                    </p>
                  )}
                </CardContent>
                <CardFooter className="border-t border-border/50 bg-muted/20">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GripVertical className="h-4 w-4" />
                    Drag fields to reorder them
                  </div>
                </CardFooter>
              </Card>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You have unsaved changes. Are you sure you want to leave?
                        Your changes will be lost.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Continue Editing</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancel}>
                        Discard Changes
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="shadow-lg shadow-primary/20"
                  data-testid="save-template-button"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {isEditMode ? 'Update Template' : 'Create Template'}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Preview Panel */}
            <div className="hidden lg:block">
              <TemplatePreview
                name={watchedValues.name}
                description={watchedValues.description}
                category={watchedValues.category}
                fieldMappings={watchedValues.fieldMappings || []}
              />
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

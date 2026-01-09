/**
 * Template Validation Schemas
 *
 * Zod validation schemas for template creation and editing.
 * Task 486: Template validation schemas for TemplateEditor.
 *
 * @module lib/validations/template
 */

import { z } from 'zod';

// ============================================================================
// Template Category Enum
// ============================================================================

/**
 * Template category options
 */
export const templateCategoryOptions = ['legal', 'financial', 'hr', 'medical', 'custom'] as const;
export type TemplateCategory = (typeof templateCategoryOptions)[number];

// ============================================================================
// Field Mapping Schema
// ============================================================================

/**
 * Schema for individual field mapping
 */
export const fieldMappingSchema = z.object({
  /**
   * Unique identifier for the field mapping
   */
  id: z.string().min(1, 'Field ID is required'),

  /**
   * Form field name/identifier
   */
  formField: z.string().min(1, 'Form field name is required'),

  /**
   * Document field to map to
   */
  documentField: z.string().nullable(),

  /**
   * Display label for the field
   */
  label: z.string().min(1, 'Field label is required'),

  /**
   * Field type
   */
  fieldType: z.enum(['text', 'email', 'number', 'date', 'checkbox', 'select']).default('text'),

  /**
   * Whether the field is required
   */
  required: z.boolean().default(false),

  /**
   * Sort order for display
   */
  order: z.number().int().nonnegative().default(0),
});

export type FieldMapping = z.infer<typeof fieldMappingSchema>;

// ============================================================================
// Template Form Schema
// ============================================================================

/**
 * Schema for creating/editing a template
 */
export const templateFormSchema = z.object({
  /**
   * Template name
   */
  name: z
    .string()
    .min(1, 'Template name is required')
    .max(100, 'Template name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Template name can only contain letters, numbers, spaces, hyphens, and underscores'),

  /**
   * Template description
   */
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .or(z.literal('')),

  /**
   * Template category
   */
  category: z.enum(templateCategoryOptions, {
    errorMap: () => ({ message: 'Please select a valid category' }),
  }),

  /**
   * Field mappings for the template
   */
  fieldMappings: z
    .array(fieldMappingSchema)
    .min(1, 'At least one field mapping is required')
    .max(50, 'Templates cannot have more than 50 field mappings'),
});

export type TemplateFormData = z.infer<typeof templateFormSchema>;

// ============================================================================
// API Request Schema
// ============================================================================

/**
 * Schema for template creation API request
 * Transforms form data to API format
 */
export const createTemplateApiSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  formType: z.string().optional(),
  mappings: z.record(z.string(), z.string()),
  fieldMappings: z.array(fieldMappingSchema).optional(),
});

export type CreateTemplateApiInput = z.infer<typeof createTemplateApiSchema>;

/**
 * Type for creating a template (matches store's createTemplate parameter)
 * Ensures name and mappings are always present
 */
export interface CreateTemplateData {
  name: string;
  description?: string;
  formType?: string;
  mappings: Record<string, string>;
  fieldMappings?: FieldMapping[];
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate template form data
 * @param data - Data to validate
 * @returns Validation result with parsed data or error
 */
export const validateTemplateForm = (data: unknown) => {
  return templateFormSchema.safeParse(data);
};

/**
 * Transform form data to API format
 * @param formData - Validated form data
 * @returns Data formatted for API with required fields guaranteed
 */
export const transformFormDataToApi = (formData: TemplateFormData): CreateTemplateData => {
  // Convert fieldMappings array to mappings record
  const mappings: Record<string, string> = {};
  formData.fieldMappings.forEach((field) => {
    if (field.documentField) {
      mappings[field.formField] = field.documentField;
    }
  });

  return {
    name: formData.name,
    description: formData.description || undefined,
    formType: formData.category,
    mappings,
    fieldMappings: formData.fieldMappings,
  };
};

/**
 * Generate a unique field ID
 * @returns Unique string ID
 */
export const generateFieldId = (): string => {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

/**
 * Create a default field mapping
 * @param order - Sort order for the field
 * @returns Default field mapping object
 */
export const createDefaultFieldMapping = (order: number = 0): FieldMapping => ({
  id: generateFieldId(),
  formField: '',
  documentField: null,
  label: '',
  fieldType: 'text',
  required: false,
  order,
});

// ============================================================================
// Default Export
// ============================================================================

export default {
  templateFormSchema,
  fieldMappingSchema,
  createTemplateApiSchema,
  templateCategoryOptions,
  validateTemplateForm,
  transformFormDataToApi,
  generateFieldId,
  createDefaultFieldMapping,
};

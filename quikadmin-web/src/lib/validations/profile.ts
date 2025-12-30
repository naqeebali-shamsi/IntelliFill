import { z } from 'zod';

// Common field validations
export const emailSchema = z.string().email('Invalid email format').min(1, 'Email is required');

export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .regex(/^[\d\s()+.-]+$/, 'Invalid phone number format')
  .refine((val) => {
    const digits = val.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  }, 'Phone number must be between 10 and 15 digits');

export const ssnSchema = z
  .string()
  .min(1, 'SSN is required')
  .regex(/^\d{3}-?\d{2}-?\d{4}$/, 'SSN must be in format XXX-XX-XXXX or XXXXXXXXX');

export const dateSchema = z
  .string()
  .min(1, 'Date is required')
  .regex(
    /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$|^\d{2}-\d{2}-\d{4}$/,
    'Date must be in format YYYY-MM-DD, MM/DD/YYYY, or MM-DD-YYYY'
  );

export const zipCodeSchema = z
  .string()
  .min(1, 'ZIP code is required')
  .regex(/^\d{5}(-\d{4})?$/, 'ZIP code must be in format XXXXX or XXXXX-XXXX');

export const stateSchema = z
  .string()
  .min(2, 'State is required')
  .max(2, 'State must be 2-letter code')
  .regex(/^[A-Z]{2}$/, 'State must be 2-letter uppercase code');

// Profile field types
export const profileFieldTypes = {
  // Personal Information
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  middleName: z.string().max(50).optional(),
  dateOfBirth: dateSchema,
  ssn: ssnSchema,

  // Contact Information
  email: emailSchema,
  phone: phoneSchema,
  mobile: phoneSchema,

  // Address Information
  street: z.string().min(1, 'Street address is required').max(200),
  street2: z.string().max(200).optional(),
  city: z.string().min(1, 'City is required').max(100),
  state: stateSchema,
  zip: zipCodeSchema,
  country: z.string().min(1, 'Country is required').max(100),

  // Generic text field (for custom fields)
  text: z.string().min(1, 'Value is required').max(500),
} as const;

// Schema for editing a single field
export const editFieldSchema = z.object({
  fieldKey: z.string().min(1, 'Field key is required'),
  value: z.string().min(1, 'Value is required'),
});

export type EditFieldInput = z.infer<typeof editFieldSchema>;

// Schema for adding a custom field
export const addCustomFieldSchema = z.object({
  fieldName: z
    .string()
    .min(1, 'Field name is required')
    .max(50, 'Field name must be less than 50 characters')
    .regex(
      /^[a-zA-Z0-9_\s-]+$/,
      'Field name can only contain letters, numbers, spaces, hyphens, and underscores'
    ),
  fieldValue: z
    .string()
    .min(1, 'Field value is required')
    .max(500, 'Field value must be less than 500 characters'),
});

export type AddCustomFieldInput = z.infer<typeof addCustomFieldSchema>;

// Full profile schema (optional for bulk updates)
export const profileSchema = z
  .object({
    // Personal Information
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    middleName: z.string().optional(),
    dateOfBirth: z.string().optional(),
    ssn: z.string().optional(),

    // Contact Information
    email: z.string().email().optional(),
    phone: z.string().optional(),
    mobile: z.string().optional(),

    // Address Information
    street: z.string().optional(),
    street2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  })
  .passthrough(); // Allow additional custom fields

export type ProfileInput = z.infer<typeof profileSchema>;

/**
 * Get validator for a specific field type
 */
export const getFieldValidator = (fieldKey: string): z.ZodSchema => {
  const normalizedKey = fieldKey.toLowerCase();

  // Email fields
  if (normalizedKey.includes('email')) {
    return emailSchema;
  }

  // Phone fields
  if (
    normalizedKey.includes('phone') ||
    normalizedKey.includes('tel') ||
    normalizedKey.includes('mobile')
  ) {
    return phoneSchema;
  }

  // SSN fields
  if (normalizedKey.includes('ssn') || normalizedKey.includes('social')) {
    return ssnSchema;
  }

  // Date fields
  if (
    normalizedKey.includes('date') ||
    normalizedKey.includes('dob') ||
    normalizedKey === 'dateofbirth'
  ) {
    return dateSchema;
  }

  // ZIP code fields
  if (normalizedKey.includes('zip') || normalizedKey === 'postalcode') {
    return zipCodeSchema;
  }

  // State fields
  if (normalizedKey === 'state') {
    return stateSchema;
  }

  // Check if field exists in predefined types
  if (fieldKey in profileFieldTypes) {
    return profileFieldTypes[fieldKey as keyof typeof profileFieldTypes];
  }

  // Default to generic text validation
  return profileFieldTypes.text;
};

/**
 * Validate a field value dynamically
 */
export const validateField = (
  fieldKey: string,
  value: string
): { success: boolean; error?: string } => {
  try {
    const validator = getFieldValidator(fieldKey);
    validator.parse(value);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || 'Invalid value' };
    }
    return { success: false, error: 'Validation failed' };
  }
};

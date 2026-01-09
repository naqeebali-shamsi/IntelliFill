/**
 * Account Validation Schemas
 *
 * Zod validation schemas for user profile and settings updates.
 * Task 386: Frontend validation schemas for account management.
 *
 * These schemas align with the backend validation in:
 * quikadmin/src/validators/schemas/settingsSchemas.ts
 *
 * @module lib/validations/account
 */

import { z } from 'zod';

// ============================================================================
// Profile Schemas
// ============================================================================

/**
 * Schema for updating user profile
 * All fields are optional to allow partial updates
 */
export const updateProfileSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name must be at least 1 character')
    .max(50, 'First name cannot exceed 50 characters')
    .optional(),

  lastName: z
    .string()
    .max(50, 'Last name cannot exceed 50 characters')
    .nullable()
    .optional(),

  avatarUrl: z
    .string()
    .url('Avatar URL must be a valid URL')
    .nullable()
    .optional(),

  phone: z
    .string()
    .max(30, 'Phone number cannot exceed 30 characters')
    .nullable()
    .optional(),

  jobTitle: z
    .string()
    .max(100, 'Job title cannot exceed 100 characters')
    .nullable()
    .optional(),

  bio: z
    .string()
    .max(500, 'Bio cannot exceed 500 characters')
    .nullable()
    .optional(),
});

/**
 * Type derived from updateProfileSchema
 */
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Profile form validation schema (for UI forms with required firstName)
 * Used in Settings page Account tab
 */
export const profileFormSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters'),
  lastName: z
    .string()
    .max(50, 'Last name must be less than 50 characters')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .max(20, 'Phone number must be less than 20 characters')
    .optional()
    .or(z.literal('')),
  jobTitle: z
    .string()
    .max(100, 'Job title must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  bio: z
    .string()
    .max(500, 'Bio must be less than 500 characters')
    .optional()
    .or(z.literal('')),
});

export type ProfileFormData = z.infer<typeof profileFormSchema>;

// ============================================================================
// Settings Schemas
// ============================================================================

/**
 * Digest frequency options
 */
export const digestFrequencyOptions = ['daily', 'weekly', 'never'] as const;
export type DigestFrequency = (typeof digestFrequencyOptions)[number];

/**
 * Theme options
 */
export const themeOptions = ['light', 'dark', 'system'] as const;
export type Theme = (typeof themeOptions)[number];

/**
 * Output format options
 */
export const outputFormatOptions = ['pdf', 'docx'] as const;
export type OutputFormat = (typeof outputFormatOptions)[number];

/**
 * Schema for updating user settings
 * All fields are optional to allow partial updates
 */
export const updateSettingsSchema = z.object({
  // Language & Localization
  preferredLanguage: z
    .string()
    .length(2, 'Language code must be exactly 2 characters (ISO 639-1)')
    .optional(),

  timezone: z
    .string()
    .max(50, 'Timezone cannot exceed 50 characters')
    .optional(),

  // Notification Preferences
  emailNotifications: z.boolean().optional(),

  notifyOnProcessComplete: z.boolean().optional(),

  notifyOnOrgInvite: z.boolean().optional(),

  digestFrequency: z
    .enum(digestFrequencyOptions, {
      errorMap: () => ({ message: 'Digest frequency must be one of: daily, weekly, never' }),
    })
    .optional(),

  // UI Preferences
  theme: z
    .enum(themeOptions, {
      errorMap: () => ({ message: 'Theme must be one of: light, dark, system' }),
    })
    .optional(),

  compactMode: z.boolean().optional(),

  // Processing Preferences
  autoOcr: z.boolean().optional(),

  autoMlEnhancement: z.boolean().optional(),

  defaultOutputFormat: z
    .enum(outputFormatOptions, {
      errorMap: () => ({ message: 'Default output format must be one of: pdf, docx' }),
    })
    .optional(),

  // Integration
  webhookUrl: z
    .string()
    .url('Webhook URL must be a valid URL')
    .nullable()
    .optional(),
});

/**
 * Type derived from updateSettingsSchema
 */
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/**
 * Settings form validation schema (simplified for UI forms)
 * Used in Settings page General tab
 */
export const settingsFormSchema = z.object({
  preferredLanguage: z.string().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  compactMode: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  notifyOnProcessComplete: z.boolean().optional(),
  notifyOnOrgInvite: z.boolean().optional(),
  digestFrequency: z.enum(['never', 'daily', 'weekly']).optional(),
});

export type SettingsFormData = z.infer<typeof settingsFormSchema>;

// ============================================================================
// Notification Settings Schema (subset for notification preferences)
// ============================================================================

/**
 * Schema for notification settings only
 */
export const notificationSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  notifyOnProcessComplete: z.boolean().optional(),
  notifyOnOrgInvite: z.boolean().optional(),
  digestFrequency: z.enum(digestFrequencyOptions).optional(),
});

export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;

// ============================================================================
// Appearance Settings Schema (subset for UI preferences)
// ============================================================================

/**
 * Schema for appearance settings only
 */
export const appearanceSettingsSchema = z.object({
  theme: z.enum(themeOptions).optional(),
  compactMode: z.boolean().optional(),
});

export type AppearanceSettingsInput = z.infer<typeof appearanceSettingsSchema>;

// ============================================================================
// Processing Settings Schema (subset for processing preferences)
// ============================================================================

/**
 * Schema for processing settings only
 */
export const processingSettingsSchema = z.object({
  autoOcr: z.boolean().optional(),
  autoMlEnhancement: z.boolean().optional(),
  defaultOutputFormat: z.enum(outputFormatOptions).optional(),
});

export type ProcessingSettingsInput = z.infer<typeof processingSettingsSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate profile update data
 * @param data - Data to validate
 * @returns Validation result with parsed data or error
 */
export const validateProfileUpdate = (data: unknown) => {
  return updateProfileSchema.safeParse(data);
};

/**
 * Validate settings update data
 * @param data - Data to validate
 * @returns Validation result with parsed data or error
 */
export const validateSettingsUpdate = (data: unknown) => {
  return updateSettingsSchema.safeParse(data);
};

// ============================================================================
// Default Export
// ============================================================================

export default {
  updateProfileSchema,
  updateSettingsSchema,
  profileFormSchema,
  settingsFormSchema,
  notificationSettingsSchema,
  appearanceSettingsSchema,
  processingSettingsSchema,
  validateProfileUpdate,
  validateSettingsUpdate,
  digestFrequencyOptions,
  themeOptions,
  outputFormatOptions,
};

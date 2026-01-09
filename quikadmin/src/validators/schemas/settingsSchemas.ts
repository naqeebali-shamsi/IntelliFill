/**
 * Settings and Profile Validation Schemas
 *
 * Task 385: User account settings and profile update validation schemas.
 * These schemas align with the UserSettings model and User profile fields.
 *
 * @module validators/schemas/settingsSchemas
 */

import Joi from 'joi';
import { safeStringSchema } from './common';

// ============================================================================
// User Settings Schemas
// ============================================================================

/**
 * Update user settings schema
 * - All fields optional (partial updates allowed)
 * - Aligns with UserSettings model in Prisma schema
 */
export const updateSettingsSchema = Joi.object({
  preferredLanguage: Joi.string().length(2).messages({
    'string.length': 'Language code must be exactly 2 characters (ISO 639-1)',
  }),
  emailNotifications: Joi.boolean(),
  notifyOnProcessComplete: Joi.boolean(),
  notifyOnOrgInvite: Joi.boolean(),
  digestFrequency: Joi.string().valid('daily', 'weekly', 'never').messages({
    'any.only': 'Digest frequency must be one of: daily, weekly, never',
  }),
  theme: Joi.string().valid('light', 'dark', 'system').messages({
    'any.only': 'Theme must be one of: light, dark, system',
  }),
  compactMode: Joi.boolean(),
  timezone: safeStringSchema.max(50).messages({
    'string.max': 'Timezone cannot exceed 50 characters',
  }),
  autoOcr: Joi.boolean(),
  autoMlEnhancement: Joi.boolean(),
  defaultOutputFormat: Joi.string().valid('pdf', 'docx').messages({
    'any.only': 'Default output format must be one of: pdf, docx',
  }),
  webhookUrl: Joi.string().uri().allow(null).messages({
    'string.uri': 'Webhook URL must be a valid URL',
  }),
})
  .min(1)
  .messages({
    'object.min': 'At least one setting field must be provided',
  });

// ============================================================================
// User Profile Schemas
// ============================================================================

/**
 * Update user profile schema
 * - All fields optional (partial updates allowed)
 * - Aligns with User model profile fields in Prisma schema
 */
export const updateProfileSchema = Joi.object({
  firstName: safeStringSchema.min(1).max(50).messages({
    'string.min': 'First name must be at least 1 character',
    'string.max': 'First name cannot exceed 50 characters',
  }),
  lastName: safeStringSchema.max(50).allow(null).messages({
    'string.max': 'Last name cannot exceed 50 characters',
  }),
  avatarUrl: Joi.string().uri().allow(null).messages({
    'string.uri': 'Avatar URL must be a valid URL',
  }),
  phone: safeStringSchema.max(30).allow(null).messages({
    'string.max': 'Phone number cannot exceed 30 characters',
  }),
  jobTitle: safeStringSchema.max(100).allow(null).messages({
    'string.max': 'Job title cannot exceed 100 characters',
  }),
  bio: safeStringSchema.max(500).allow(null).messages({
    'string.max': 'Bio cannot exceed 500 characters',
  }),
})
  .min(1)
  .messages({
    'object.min': 'At least one profile field must be provided',
  });

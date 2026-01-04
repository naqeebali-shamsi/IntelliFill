import Joi from 'joi';
import { emailSchema, passwordSchema, safeStringSchema } from './common';

// Login schema (Task 281: Uses common schemas)
export const loginSchema = Joi.object({
  email: emailSchema.required().messages({
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'any.required': 'Password is required',
  }),
  deviceInfo: safeStringSchema.max(500).optional(),
  ipAddress: Joi.string().ip().optional(),
  userAgent: safeStringSchema.max(500).optional(),
});

// Registration schema (Task 281: Uses common schemas)
export const registerSchema = Joi.object({
  email: emailSchema.required().messages({
    'any.required': 'Email is required',
  }),
  password: passwordSchema.required().messages({
    'any.required': 'Password is required',
  }),
  fullName: safeStringSchema.min(2).max(100).required().messages({
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name cannot exceed 100 characters',
    'any.required': 'Full name is required',
  }),
  role: Joi.string().valid('user', 'admin').optional().default('user'),
});

// Refresh token schema (Task 281: Uses common schemas)
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token is required',
  }),
});

// Password reset request schema (Task 281: Uses common schemas)
export const passwordResetRequestSchema = Joi.object({
  email: emailSchema.required().messages({
    'any.required': 'Email is required',
  }),
});

// Password reset schema (Task 281: Uses common schemas)
export const passwordResetSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Reset token is required',
  }),
  newPassword: passwordSchema.required().messages({
    'any.required': 'New password is required',
  }),
});

// Change password schema (Task 281: Added for completeness)
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(1).required().messages({
    'any.required': 'Current password is required',
  }),
  newPassword: passwordSchema.required().messages({
    'any.required': 'New password is required',
  }),
});

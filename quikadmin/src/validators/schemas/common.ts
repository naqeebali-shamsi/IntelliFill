/**
 * Common Reusable Validation Schemas
 *
 * Task 281: Centralized Joi schemas for common patterns used across the API.
 * These schemas prevent injection and ensure data integrity.
 *
 * @module validators/schemas/common
 */

import Joi from 'joi';

// ============================================================================
// Primitive Type Schemas
// ============================================================================

/**
 * Email validation schema
 * - Lowercase normalization
 * - Standard email format validation
 * - Max 254 characters (RFC 5321)
 */
export const emailSchema = Joi.string()
  .email({ tlds: { allow: false } }) // Allow any TLD
  .lowercase()
  .max(254)
  .messages({
    'string.email': 'Please provide a valid email address',
    'string.max': 'Email address is too long',
  });

/**
 * UUID v4 validation schema
 * - Strict UUID v4 format
 * - Lowercase normalization
 */
export const uuidSchema = Joi.string().uuid({ version: 'uuidv4' }).lowercase().messages({
  'string.guid': 'Invalid UUID format',
});

/**
 * Flexible ID schema (accepts UUID or numeric string)
 * - Useful for routes that accept either format
 */
export const idSchema = Joi.alternatives()
  .try(Joi.string().uuid({ version: 'uuidv4' }), Joi.string().pattern(/^\d+$/).max(20))
  .messages({
    'alternatives.match': 'Invalid ID format',
  });

/**
 * Safe string schema - prevents control characters and null bytes
 * - Uses custom validator to strip control characters (Task 281 security requirement)
 * - Used as base for text input fields
 */
export const safeStringSchema = Joi.string()
  .custom((value, helpers) => {
    // Check for control characters (0x00-0x1F and 0x7F)
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1F\x7F]/.test(value)) {
      return helpers.error('string.controlChars');
    }
    return value;
  })
  .messages({
    'string.controlChars': 'Input contains invalid characters',
  });

// ============================================================================
// Pagination Schemas
// ============================================================================

/**
 * Page number schema (1-indexed)
 */
export const pageSchema = Joi.number().integer().min(1).default(1).messages({
  'number.min': 'Page number must be at least 1',
  'number.integer': 'Page number must be an integer',
});

/**
 * Page size/limit schema
 * - Default: 20
 * - Max: 100 (prevents excessive data retrieval)
 */
export const limitSchema = Joi.number().integer().min(1).max(100).default(20).messages({
  'number.min': 'Limit must be at least 1',
  'number.max': 'Limit cannot exceed 100',
  'number.integer': 'Limit must be an integer',
});

/**
 * Offset schema for cursor-based pagination
 */
export const offsetSchema = Joi.number().integer().min(0).default(0).messages({
  'number.min': 'Offset cannot be negative',
  'number.integer': 'Offset must be an integer',
});

/**
 * Standard pagination object schema
 * - page: 1-indexed page number
 * - limit: items per page (max 100)
 * - sortBy: optional sort field
 * - sortOrder: 'asc' or 'desc'
 */
export const paginationSchema = Joi.object({
  page: pageSchema,
  limit: limitSchema,
  sortBy: Joi.string().max(50).optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
}).default({
  page: 1,
  limit: 20,
  sortOrder: 'desc',
});

/**
 * Cursor-based pagination schema
 * - cursor: optional cursor token
 * - limit: items per page
 */
export const cursorPaginationSchema = Joi.object({
  cursor: Joi.string().max(500).optional(),
  limit: limitSchema,
});

// ============================================================================
// Date/Time Schemas
// ============================================================================

/**
 * ISO 8601 date string schema
 */
export const isoDateSchema = Joi.date().iso().messages({
  'date.format': 'Date must be in ISO 8601 format',
});

/**
 * Date range schema for filtering
 */
export const dateRangeSchema = Joi.object({
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
})
  .custom((value, helpers) => {
    if (value.startDate && value.endDate && value.startDate > value.endDate) {
      return helpers.error('date.range');
    }
    return value;
  })
  .messages({
    'date.range': 'Start date must be before end date',
  });

// ============================================================================
// Search & Filter Schemas
// ============================================================================

/**
 * Search query schema
 * - Trims whitespace
 * - Max 200 characters
 * - Strips potentially dangerous characters
 */
export const searchQuerySchema = Joi.string()
  .trim()
  .max(200)
  .replace(/[<>'"]/g, '') // Strip HTML/SQL injection characters
  .messages({
    'string.max': 'Search query is too long',
  });

/**
 * Status filter schema (common statuses)
 */
export const statusFilterSchema = Joi.string()
  .valid('pending', 'processing', 'completed', 'failed', 'cancelled')
  .messages({
    'any.only': 'Invalid status value',
  });

// ============================================================================
// Security Schemas
// ============================================================================

/**
 * JWT token schema
 * - Basic JWT format validation
 */
export const jwtTokenSchema = Joi.string()
  .pattern(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/)
  .messages({
    'string.pattern.base': 'Invalid token format',
  });

/**
 * Password schema (strong password requirements)
 * - Minimum 8 characters
 * - At least one uppercase, one lowercase, one digit
 */
export const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .messages({
    'string.min': 'Password must be at least 8 characters',
    'string.max': 'Password is too long',
    'string.pattern.base': 'Password must contain uppercase, lowercase, and number',
  });

// ============================================================================
// Composite Schemas
// ============================================================================

/**
 * Standard query parameters for list endpoints
 * - Pagination
 * - Search
 * - Status filter
 * - Date range
 */
export const listQuerySchema = Joi.object({
  page: pageSchema,
  limit: limitSchema,
  sortBy: Joi.string().max(50).optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  search: searchQuerySchema.optional(),
  status: statusFilterSchema.optional(),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
});

/**
 * ID params schema for route parameters
 * - Validates :id parameter as UUID
 */
export const idParamsSchema = Joi.object({
  id: uuidSchema.required().messages({
    'any.required': 'ID parameter is required',
  }),
});

/**
 * Multiple IDs schema (for bulk operations)
 * - Array of UUIDs
 * - Min 1, Max 100 items
 */
export const multipleIdsSchema = Joi.object({
  ids: Joi.array().items(uuidSchema).min(1).max(100).required().messages({
    'array.min': 'At least one ID is required',
    'array.max': 'Maximum 100 IDs allowed per request',
    'any.required': 'IDs array is required',
  }),
});

// ============================================================================
// Export all schemas as named exports for tree-shaking
// ============================================================================

export default {
  // Primitives
  email: emailSchema,
  uuid: uuidSchema,
  id: idSchema,
  safeString: safeStringSchema,

  // Pagination
  page: pageSchema,
  limit: limitSchema,
  offset: offsetSchema,
  pagination: paginationSchema,
  cursorPagination: cursorPaginationSchema,

  // Date/Time
  isoDate: isoDateSchema,
  dateRange: dateRangeSchema,

  // Search/Filter
  searchQuery: searchQuerySchema,
  statusFilter: statusFilterSchema,

  // Security
  jwtToken: jwtTokenSchema,
  password: passwordSchema,

  // Composite
  listQuery: listQuerySchema,
  idParams: idParamsSchema,
  multipleIds: multipleIdsSchema,
};

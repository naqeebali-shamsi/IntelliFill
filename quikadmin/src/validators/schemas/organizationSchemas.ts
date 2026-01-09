import Joi from 'joi';
import { safeStringSchema, emailSchema, pageSchema, limitSchema, uuidSchema } from './common';

/**
 * Organization Validation Schemas
 * Task 382: Create organization CRUD validation schemas
 * Task 383: Add membership management validation schemas
 */

// Create organization schema
export const createOrganizationSchema = Joi.object({
  name: safeStringSchema.min(2).max(100).required().messages({
    'string.min': 'Organization name must be at least 2 characters',
    'string.max': 'Organization name cannot exceed 100 characters',
    'any.required': 'Organization name is required',
  }),
});

// Update organization schema
export const updateOrganizationSchema = Joi.object({
  name: safeStringSchema.min(2).max(100).optional().messages({
    'string.min': 'Organization name must be at least 2 characters',
    'string.max': 'Organization name cannot exceed 100 characters',
  }),
  website: Joi.string().uri().max(255).optional().allow(null).messages({
    'string.uri': 'Website must be a valid URL',
    'string.max': 'Website cannot exceed 255 characters',
  }),
  status: Joi.string().valid('ACTIVE', 'INACTIVE').optional().messages({
    'any.only': 'Status must be either ACTIVE or INACTIVE',
  }),
  settings: Joi.object().optional(),
});

// Organization ID param schema
export const organizationIdParamSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid organization ID format',
    'any.required': 'Organization ID is required',
  }),
});

// ============================================================================
// Task 383: Membership Management Schemas
// ============================================================================

/**
 * Organization member role enum
 * - OWNER: Full control including deletion
 * - ADMIN: Can manage members and settings
 * - MEMBER: Standard access
 * - VIEWER: Read-only access
 */
export const orgMemberRoleSchema = Joi.string()
  .valid('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')
  .messages({
    'any.only': 'Invalid role. Must be one of: OWNER, ADMIN, MEMBER, VIEWER',
  });

/**
 * Membership status enum
 */
export const membershipStatusSchema = Joi.string()
  .valid('PENDING', 'ACTIVE', 'SUSPENDED', 'LEFT')
  .messages({
    'any.only': 'Invalid status. Must be one of: PENDING, ACTIVE, SUSPENDED, LEFT',
  });

/**
 * Update member role schema (PATCH /members/:userId)
 * - Only role can be changed via this endpoint
 * - Business rules enforced in route handler:
 *   - Cannot demote last OWNER
 *   - Cannot demote last ADMIN if no OWNER exists
 */
export const updateMemberRoleSchema = Joi.object({
  role: orgMemberRoleSchema.required().messages({
    'any.required': 'Role is required',
  }),
});

/**
 * List members query schema (GET /members)
 * - Supports pagination
 * - Optional search by name/email
 * - Optional filter by role
 * - Optional filter by status
 */
export const listMembersQuerySchema = Joi.object({
  page: pageSchema,
  limit: limitSchema,
  search: safeStringSchema.max(100).optional().messages({
    'string.max': 'Search query cannot exceed 100 characters',
  }),
  role: orgMemberRoleSchema.optional(),
  status: membershipStatusSchema.optional(),
});

/**
 * Member user ID param schema (for member-specific operations)
 */
export const memberUserIdParamSchema = Joi.object({
  id: uuidSchema.required(),
  userId: uuidSchema.required().messages({
    'any.required': 'User ID is required',
  }),
});

/**
 * Invite member schema
 */
export const inviteMemberSchema = Joi.object({
  email: emailSchema.required().messages({
    'any.required': 'Email is required',
  }),
  role: orgMemberRoleSchema.optional().default('MEMBER'),
});

/**
 * Invitation token param schema (for public invitation validation/acceptance)
 */
export const invitationTokenParamSchema = Joi.object({
  token: uuidSchema.required().messages({
    'any.required': 'Invitation token is required',
  }),
});

/**
 * Invite ID param schema (for canceling invitations)
 */
export const inviteIdParamSchema = Joi.object({
  id: uuidSchema.required(),
  inviteId: uuidSchema.required().messages({
    'any.required': 'Invitation ID is required',
  }),
});

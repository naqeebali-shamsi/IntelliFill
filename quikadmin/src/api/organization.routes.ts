/**
 * Organization API Routes
 *
 * Implements CRUD operations for organizations with role-based access control
 * Task 382: Backend: Create Organization API Routes and Services
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateSupabase, AuthenticatedRequest } from '../middleware/supabaseAuth';
import { requireOrgAdmin, requireOrgOwner } from '../middleware/organizationContext';
import { validate, validateParams, validateQuery } from '../middleware/validation';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  organizationIdParamSchema,
  inviteMemberSchema,
  inviteIdParamSchema,
  invitationTokenParamSchema,
  listMembersQuerySchema,
  updateMemberRoleSchema,
  memberUserIdParamSchema,
} from '../validators/schemas/organizationSchemas';
import { prisma } from '../utils/prisma';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { sendInvitationEmail } from '../services/emailService';
import { OrganizationStatus, OrgMemberRole } from '@prisma/client';
import crypto from 'crypto';

/**
 * Generate unique slug from organization name
 */
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
  const suffix = crypto.randomBytes(4).toString('hex');
  return `${base}-${suffix}`;
}

/**
 * Result of checking if a member can be removed/demoted from organization
 */
interface ProtectionCheckResult {
  allowed: boolean;
  code?: 'LAST_OWNER_PROTECTION' | 'LAST_ADMIN_PROTECTION';
  message?: string;
}

/**
 * Check if removing/demoting a member would leave the organization without leadership.
 * Enforces:
 * - Cannot demote/remove last OWNER
 * - Cannot demote/remove last ADMIN if no OWNER exists
 */
async function checkLeadershipProtection(
  organizationId: string,
  currentRole: OrgMemberRole,
  isSelfAction: boolean
): Promise<ProtectionCheckResult> {
  if (currentRole === 'OWNER') {
    const ownerCount = await prisma.organizationMembership.count({
      where: { organizationId, role: 'OWNER', status: 'ACTIVE' },
    });

    if (ownerCount <= 1) {
      return {
        allowed: false,
        code: 'LAST_OWNER_PROTECTION',
        message: isSelfAction
          ? 'Cannot leave organization as the last owner. Transfer ownership first or delete the organization.'
          : 'Cannot demote/remove the last owner. Promote another member to owner first.',
      };
    }
  }

  if (currentRole === 'ADMIN' || currentRole === 'OWNER') {
    const adminCount = await prisma.organizationMembership.count({
      where: { organizationId, role: { in: ['ADMIN', 'OWNER'] }, status: 'ACTIVE' },
    });

    if (adminCount <= 1) {
      return {
        allowed: false,
        code: 'LAST_ADMIN_PROTECTION',
        message: isSelfAction
          ? 'Cannot leave organization as the last admin. Promote another member first.'
          : 'Cannot demote/remove the last admin. Promote another member to admin or owner first.',
      };
    }
  }

  return { allowed: true };
}

export function createOrganizationRoutes(): Router {
  const router = Router();

  /**
   * POST /api/organizations - Create a new organization
   * Creator automatically becomes OWNER
   */
  router.post(
    '/',
    authenticateSupabase,
    validate(createOrganizationSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthenticatedRequest).user?.id;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const { name } = req.body;

        // Check if user already has an organization
        const existingMembership = await prisma.organizationMembership.findFirst({
          where: {
            userId,
            status: 'ACTIVE',
          },
          include: {
            organization: true,
          },
        });

        if (existingMembership) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'User already belongs to an organization',
            existingOrganization: {
              id: existingMembership.organization.id,
              name: existingMembership.organization.name,
            },
          });
        }

        // Generate unique slug
        const slug = generateSlug(name);

        // Create organization and membership in transaction
        const result = await prisma.$transaction(async (tx) => {
          // Create organization
          const organization = await tx.organization.create({
            data: {
              name: name.trim(),
              slug,
              status: 'ACTIVE',
            },
          });

          // Create OWNER membership for creator
          await tx.organizationMembership.create({
            data: {
              userId,
              organizationId: organization.id,
              role: 'OWNER',
              status: 'ACTIVE',
              joinedAt: new Date(),
            },
          });

          // Update user's organizationId
          await tx.user.update({
            where: { id: userId },
            data: { organizationId: organization.id },
          });

          return organization;
        });

        logger.info('[Organization] Organization created', {
          organizationId: result.id,
          userId,
          name: result.name,
        });

        res.status(201).json({
          success: true,
          message: 'Organization created successfully',
          data: {
            id: result.id,
            name: result.name,
            slug: result.slug,
            status: result.status,
            role: 'OWNER',
            createdAt: result.createdAt.toISOString(),
          },
        });
      } catch (error) {
        logger.error('[Organization] Create error', { error });
        next(error);
      }
    }
  );

  /**
   * GET /api/organizations/me - Get current user's organization
   */
  router.get(
    '/me',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthenticatedRequest).user?.id;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const membership = await prisma.organizationMembership.findFirst({
          where: {
            userId,
            status: 'ACTIVE',
          },
          include: {
            organization: {
              include: {
                _count: {
                  select: {
                    users: true,
                    memberships: true,
                    documentSources: true,
                  },
                },
              },
            },
          },
        });

        if (!membership) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'User does not belong to any organization',
          });
        }

        res.json({
          success: true,
          data: {
            id: membership.organization.id,
            name: membership.organization.name,
            slug: membership.organization.slug,
            status: membership.organization.status,
            website: membership.organization.website,
            logoUrl: membership.organization.logoUrl,
            settings: membership.organization.settings,
            role: membership.role,
            joinedAt: membership.joinedAt?.toISOString() || null,
            memberCount: membership.organization._count.memberships,
            userCount: membership.organization._count.users,
            documentSourceCount: membership.organization._count.documentSources,
            createdAt: membership.organization.createdAt.toISOString(),
            updatedAt: membership.organization.updatedAt.toISOString(),
          },
        });
      } catch (error) {
        logger.error('[Organization] Get my organization error', { error });
        next(error);
      }
    }
  );

  /**
   * PATCH /api/organizations/:id - Update organization (Admin or Owner only)
   */
  router.patch(
    '/:id',
    authenticateSupabase,
    validateParams(organizationIdParamSchema),
    requireOrgAdmin,
    validate(updateOrganizationSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const { name, website, status, settings } = req.body;

        // Build update data
        const updateData: {
          name?: string;
          website?: string | null;
          status?: OrganizationStatus;
          settings?: object;
        } = {};

        if (name !== undefined) updateData.name = name.trim();
        if (website !== undefined) updateData.website = website;
        if (status !== undefined) updateData.status = status as OrganizationStatus;
        if (settings !== undefined) updateData.settings = settings;

        // Update organization
        const organization = await prisma.organization.update({
          where: { id },
          data: updateData,
        });

        logger.info('[Organization] Organization updated', {
          organizationId: id,
          updates: Object.keys(updateData),
        });

        res.json({
          success: true,
          message: 'Organization updated successfully',
          data: {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            status: organization.status,
            website: organization.website,
            logoUrl: organization.logoUrl,
            settings: organization.settings,
            updatedAt: organization.updatedAt.toISOString(),
          },
        });
      } catch (error) {
        logger.error('[Organization] Update error', { error });
        next(error);
      }
    }
  );

  /**
   * DELETE /api/organizations/:id - Delete organization (Owner only)
   * Cascades to delete all memberships and invitations
   */
  router.delete(
    '/:id',
    authenticateSupabase,
    validateParams(organizationIdParamSchema),
    requireOrgOwner,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        // Delete organization (cascade will handle memberships and invitations)
        await prisma.organization.delete({
          where: { id },
        });

        logger.info('[Organization] Organization deleted', {
          organizationId: id,
        });

        res.json({
          success: true,
          message: 'Organization deleted successfully',
        });
      } catch (error) {
        logger.error('[Organization] Delete error', { error });
        next(error);
      }
    }
  );

  // ============================================================================
  // Task 383: Membership Management Endpoints
  // ============================================================================

  /**
   * GET /api/organizations/:id/members - List organization members
   * Any member can view the member list (MEMBER, ADMIN, OWNER)
   * Supports pagination, search, and role filtering
   */
  router.get(
    '/:id/members',
    authenticateSupabase,
    validateParams(organizationIdParamSchema),
    validateQuery(listMembersQuerySchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthenticatedRequest).user?.id;
        const { id: organizationId } = req.params;
        const { page = 1, limit = 20, search, role, status = 'ACTIVE' } = req.query;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Check if user is a member of the organization
        const userMembership = await prisma.organizationMembership.findFirst({
          where: {
            userId,
            organizationId,
            status: 'ACTIVE',
          },
        });

        if (!userMembership) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'You are not a member of this organization',
            code: 'NOT_ORG_MEMBER',
          });
        }

        // Build where clause
        const where: any = {
          organizationId,
          status: status as string,
        };

        if (role) {
          where.role = role;
        }

        if (search) {
          where.user = {
            OR: [
              { email: { contains: search as string, mode: 'insensitive' } },
              { firstName: { contains: search as string, mode: 'insensitive' } },
              { lastName: { contains: search as string, mode: 'insensitive' } },
            ],
          };
        }

        // Get total count
        const total = await prisma.organizationMembership.count({ where });

        // Get paginated members
        const memberships = await prisma.organizationMembership.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                createdAt: true,
              },
            },
          },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
        });

        const members = memberships.map((m) => ({
          userId: m.user.id,
          email: m.user.email,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          status: m.status,
          joinedAt: m.joinedAt?.toISOString() || null,
          invitedAt: m.invitedAt?.toISOString() || null,
        }));

        res.json({
          success: true,
          data: {
            members,
            pagination: {
              page: Number(page),
              limit: Number(limit),
              total,
              totalPages: Math.ceil(total / Number(limit)),
            },
          },
        });
      } catch (error) {
        logger.error('[Organization] List members error', { error });
        next(error);
      }
    }
  );

  /**
   * PATCH /api/organizations/:id/members/:userId - Change member role
   * Admin or Owner only
   * Business rules:
   * - Cannot demote last OWNER
   * - Cannot demote last ADMIN if no OWNER exists
   * - ADMIN cannot promote members to OWNER
   */
  router.patch(
    '/:id/members/:userId',
    authenticateSupabase,
    validateParams(memberUserIdParamSchema),
    validate(updateMemberRoleSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const currentUserId = (req as AuthenticatedRequest).user?.id;
        const { id: organizationId, userId: targetUserId } = req.params;
        const { role: newRole } = req.body;

        if (!currentUserId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Check if current user is admin or owner
        const currentUserMembership = await prisma.organizationMembership.findFirst({
          where: {
            userId: currentUserId,
            organizationId,
            status: 'ACTIVE',
            role: { in: ['ADMIN', 'OWNER'] },
          },
        });

        if (!currentUserMembership) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'You must be an admin or owner to change member roles',
            code: 'ADMIN_REQUIRED',
          });
        }

        // Get target member
        const targetMembership = await prisma.organizationMembership.findFirst({
          where: {
            userId: targetUserId,
            organizationId,
            status: 'ACTIVE',
          },
        });

        if (!targetMembership) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Member not found',
          });
        }

        // Business Rule: ADMIN cannot promote to OWNER
        if (currentUserMembership.role === 'ADMIN' && newRole === 'OWNER') {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Only owners can promote members to owner role',
            code: 'OWNER_PROMOTION_DENIED',
          });
        }

        // Check if demotion would leave org without leadership
        const isDemotion =
          (targetMembership.role === 'OWNER' && newRole !== 'OWNER') ||
          (targetMembership.role === 'ADMIN' && newRole !== 'ADMIN' && newRole !== 'OWNER');

        if (isDemotion) {
          const protection = await checkLeadershipProtection(
            organizationId,
            targetMembership.role,
            false
          );
          if (!protection.allowed) {
            return res.status(400).json({
              error: 'Bad Request',
              message: protection.message,
              code: protection.code,
            });
          }
        }

        // Update role
        const updatedMembership = await prisma.organizationMembership.update({
          where: {
            id: targetMembership.id,
          },
          data: {
            role: newRole,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });

        logger.info('[Organization] Member role updated', {
          organizationId,
          targetUserId,
          oldRole: targetMembership.role,
          newRole,
          updatedBy: currentUserId,
        });

        res.json({
          success: true,
          message: 'Member role updated successfully',
          data: {
            userId: updatedMembership.user.id,
            email: updatedMembership.user.email,
            firstName: updatedMembership.user.firstName,
            lastName: updatedMembership.user.lastName,
            role: updatedMembership.role,
            updatedAt: updatedMembership.updatedAt.toISOString(),
          },
        });
      } catch (error) {
        logger.error('[Organization] Update member role error', { error });
        next(error);
      }
    }
  );

  /**
   * DELETE /api/organizations/:id/members/:userId - Remove member from organization
   * Admin or Owner only
   * Business rules:
   * - Cannot remove last OWNER
   * - Cannot remove last ADMIN if no OWNER exists
   * - Member can remove themselves (self-leave) unless they're last admin/owner
   */
  router.delete(
    '/:id/members/:userId',
    authenticateSupabase,
    validateParams(memberUserIdParamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const currentUserId = (req as AuthenticatedRequest).user?.id;
        const { id: organizationId, userId: targetUserId } = req.params;

        if (!currentUserId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const isSelfRemoval = currentUserId === targetUserId;

        // If not self-removal, check if current user is admin or owner
        if (!isSelfRemoval) {
          const currentUserMembership = await prisma.organizationMembership.findFirst({
            where: {
              userId: currentUserId,
              organizationId,
              status: 'ACTIVE',
              role: { in: ['ADMIN', 'OWNER'] },
            },
          });

          if (!currentUserMembership) {
            return res.status(403).json({
              error: 'Forbidden',
              message: 'You must be an admin or owner to remove members',
              code: 'ADMIN_REQUIRED',
            });
          }
        }

        // Get target member
        const targetMembership = await prisma.organizationMembership.findFirst({
          where: {
            userId: targetUserId,
            organizationId,
            status: 'ACTIVE',
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });

        if (!targetMembership) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Member not found',
          });
        }

        // Check if removal would leave org without leadership
        const protection = await checkLeadershipProtection(
          organizationId,
          targetMembership.role,
          isSelfRemoval
        );
        if (!protection.allowed) {
          return res.status(400).json({
            error: 'Bad Request',
            message: protection.message,
            code: protection.code,
          });
        }

        // Update membership status to LEFT (soft delete)
        await prisma.organizationMembership.update({
          where: {
            id: targetMembership.id,
          },
          data: {
            status: 'LEFT',
          },
        });

        // If self-removal, also clear user's organizationId
        if (isSelfRemoval) {
          await prisma.user.update({
            where: { id: currentUserId },
            data: { organizationId: null },
          });
        }

        logger.info('[Organization] Member removed', {
          organizationId,
          targetUserId,
          removedBy: currentUserId,
          isSelfRemoval,
        });

        res.json({
          success: true,
          message: isSelfRemoval ? 'You have left the organization' : 'Member removed successfully',
        });
      } catch (error) {
        logger.error('[Organization] Remove member error', { error });
        next(error);
      }
    }
  );

  /**
   * POST /api/organizations/:id/leave - Leave organization (self-removal)
   * User can leave unless they're the last admin/owner
   * Convenience endpoint for self-removal with clearer semantics
   */
  router.post(
    '/:id/leave',
    authenticateSupabase,
    validateParams(organizationIdParamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthenticatedRequest).user?.id;
        const { id: organizationId } = req.params;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get user's membership
        const membership = await prisma.organizationMembership.findFirst({
          where: {
            userId,
            organizationId,
            status: 'ACTIVE',
          },
        });

        if (!membership) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'You are not a member of this organization',
          });
        }

        // Check if leaving would leave org without leadership
        const protection = await checkLeadershipProtection(organizationId, membership.role, true);
        if (!protection.allowed) {
          return res.status(400).json({
            error: 'Bad Request',
            message: protection.message,
            code: protection.code,
          });
        }

        // Update membership status to LEFT
        await prisma.organizationMembership.update({
          where: {
            id: membership.id,
          },
          data: {
            status: 'LEFT',
          },
        });

        // Clear user's organizationId
        await prisma.user.update({
          where: { id: userId },
          data: { organizationId: null },
        });

        logger.info('[Organization] User left organization', {
          organizationId,
          userId,
        });

        res.json({
          success: true,
          message: 'You have successfully left the organization',
        });
      } catch (error) {
        logger.error('[Organization] Leave organization error', { error });
        next(error);
      }
    }
  );

  // ============================================================================
  // Invitation Endpoints (Task 384)
  // ============================================================================

  /**
   * POST /api/organizations/:id/members/invite - Send invitation (Admin/Owner only)
   * Creates or updates an invitation for the specified email
   * Re-inviting same email updates existing pending invitation
   */
  router.post(
    '/:id/members/invite',
    authenticateSupabase,
    validateParams(organizationIdParamSchema),
    requireOrgAdmin,
    validate(inviteMemberSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as AuthenticatedRequest).user?.id;
        const organizationId = req.params.id;
        const { email, role } = req.body;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Calculate expiration (7 days from now)
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // Check if user is already a member
        const existingMember = await prisma.organizationMembership.findFirst({
          where: {
            organizationId,
            user: {
              email: email.toLowerCase(),
            },
          },
        });

        if (existingMember) {
          return res.status(409).json({
            error: 'Conflict',
            message: 'User is already a member of this organization',
            code: 'USER_ALREADY_MEMBER',
          });
        }

        // Upsert invitation (update if exists, create if not)
        const invitation = await prisma.organizationInvitation.upsert({
          where: {
            organizationId_email: {
              organizationId,
              email: email.toLowerCase(),
            },
          },
          update: {
            role,
            expiresAt,
            status: 'PENDING',
            invitedBy: userId,
          },
          create: {
            organizationId,
            email: email.toLowerCase(),
            role,
            invitedBy: userId,
            expiresAt,
            status: 'PENDING',
          },
          include: {
            organization: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        });

        const inviter = await prisma.user.findUnique({
          where: { supabaseUserId: userId },
          select: { firstName: true, lastName: true, email: true },
        });
        const inviterName = inviter?.firstName
          ? [inviter.firstName, inviter.lastName].filter(Boolean).join(' ')
          : inviter?.email || 'A team member';

        sendInvitationEmail({
          email: email.toLowerCase(),
          organizationName: invitation.organization.name,
          inviterName,
          role,
          invitationId: invitation.id,
        }).catch((err) => {
          logger.error('[Organization] Failed to send invitation email', { error: err });
        });

        logger.info('[Organization] Invitation created', {
          invitationId: invitation.id,
          organizationId,
          email: email.toLowerCase(),
          role,
          invitedBy: userId,
        });

        res.status(201).json({
          success: true,
          message: 'Invitation sent successfully',
          data: {
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            status: invitation.status,
            expiresAt: invitation.expiresAt.toISOString(),
            organization: {
              id: invitation.organizationId,
              name: invitation.organization.name,
            },
            // Include token for testing purposes (in production, this would be sent via email)
            invitationUrl: `/invites/${invitation.id}/accept`,
          },
        });
      } catch (error) {
        logger.error('[Organization] Invitation error', { error });
        next(error);
      }
    }
  );

  /**
   * DELETE /api/organizations/:id/invites/:inviteId - Cancel invitation (Admin/Owner)
   * Updates invitation status to CANCELLED
   */
  router.delete(
    '/:id/invites/:inviteId',
    authenticateSupabase,
    validateParams(inviteIdParamSchema),
    requireOrgAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id: organizationId, inviteId } = req.params;

        // Verify invitation exists and belongs to organization
        const invitation = await prisma.organizationInvitation.findUnique({
          where: { id: inviteId },
        });

        if (!invitation) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Invitation not found',
            code: 'INVITATION_NOT_FOUND',
          });
        }

        if (invitation.organizationId !== organizationId) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Invitation does not belong to this organization',
            code: 'INVITATION_MISMATCH',
          });
        }

        // Update invitation status to CANCELLED
        await prisma.organizationInvitation.update({
          where: { id: inviteId },
          data: { status: 'CANCELLED' },
        });

        logger.info('[Organization] Invitation cancelled', {
          invitationId: inviteId,
          organizationId,
        });

        res.json({
          success: true,
          message: 'Invitation cancelled successfully',
        });
      } catch (error) {
        logger.error('[Organization] Cancel invitation error', { error });
        next(error);
      }
    }
  );

  return router;
}

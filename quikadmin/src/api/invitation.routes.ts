/**
 * Invitation API Routes (Public)
 *
 * Public endpoints for invitation validation and acceptance
 * Task 384: Backend: Create Invitation System Endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateSupabase, AuthenticatedRequest } from '../middleware/supabaseAuth';
import { validateParams } from '../middleware/validation';
import { invitationTokenParamSchema } from '../validators/schemas/organizationSchemas';
import { prisma } from '../utils/prisma';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';

export function createInvitationRoutes(): Router {
  const router = Router();

  /**
   * GET /api/invites/:token - Validate invitation (Public - no auth required)
   * Checks if invitation exists, is pending, and not expired
   */
  router.get(
    '/:token',
    validateParams(invitationTokenParamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { token } = req.params;

        // Find invitation by ID (token is the invitation ID)
        const invitation = await prisma.organizationInvitation.findUnique({
          where: { id: token },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });

        if (!invitation) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Invitation not found',
            code: 'INVITATION_NOT_FOUND',
          });
        }

        // Check invitation status
        if (invitation.status !== 'PENDING') {
          return res.status(410).json({
            error: 'Gone',
            message: `Invitation is no longer valid (status: ${invitation.status})`,
            code: 'INVITATION_INVALID_STATUS',
            status: invitation.status,
          });
        }

        // Check expiration
        if (invitation.expiresAt < new Date()) {
          // Update status to EXPIRED
          await prisma.organizationInvitation.update({
            where: { id: token },
            data: { status: 'EXPIRED' },
          });

          return res.status(410).json({
            error: 'Gone',
            message: 'Invitation has expired',
            code: 'INVITATION_EXPIRED',
            expiresAt: invitation.expiresAt.toISOString(),
          });
        }

        // Return valid invitation
        res.json({
          success: true,
          data: {
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            organization: {
              id: invitation.organization.id,
              name: invitation.organization.name,
              slug: invitation.organization.slug,
            },
            expiresAt: invitation.expiresAt.toISOString(),
            createdAt: invitation.createdAt.toISOString(),
          },
        });
      } catch (error) {
        logger.error('[Invitation] Validation error', { error });
        next(error);
      }
    }
  );

  /**
   * POST /api/invites/:token/accept - Accept invitation (Authenticated)
   * Creates organization membership and updates invitation status to ACCEPTED
   * Uses transaction to ensure atomicity
   */
  router.post(
    '/:token/accept',
    authenticateSupabase,
    validateParams(invitationTokenParamSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;
        const userEmail = req.user?.email;
        const { token } = req.params;

        if (!userId || !userEmail) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Find invitation
        const invitation = await prisma.organizationInvitation.findUnique({
          where: { id: token },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });

        if (!invitation) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Invitation not found',
            code: 'INVITATION_NOT_FOUND',
          });
        }

        // Verify email matches
        if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'This invitation is for a different email address',
            code: 'EMAIL_MISMATCH',
            invitedEmail: invitation.email,
          });
        }

        // Check invitation status
        if (invitation.status !== 'PENDING') {
          return res.status(410).json({
            error: 'Gone',
            message: `Invitation is no longer valid (status: ${invitation.status})`,
            code: 'INVITATION_INVALID_STATUS',
            status: invitation.status,
          });
        }

        // Check expiration
        if (invitation.expiresAt < new Date()) {
          await prisma.organizationInvitation.update({
            where: { id: token },
            data: { status: 'EXPIRED' },
          });

          return res.status(410).json({
            error: 'Gone',
            message: 'Invitation has expired',
            code: 'INVITATION_EXPIRED',
            expiresAt: invitation.expiresAt.toISOString(),
          });
        }

        // Check if user is already a member
        const existingMembership = await prisma.organizationMembership.findFirst({
          where: {
            userId,
            organizationId: invitation.organizationId,
          },
        });

        if (existingMembership) {
          return res.status(409).json({
            error: 'Conflict',
            message: 'User is already a member of this organization',
            code: 'USER_ALREADY_MEMBER',
            membership: {
              role: existingMembership.role,
              status: existingMembership.status,
            },
          });
        }

        // Accept invitation in transaction
        const result = await prisma.$transaction(async (tx) => {
          // Update invitation status to ACCEPTED
          await tx.organizationInvitation.update({
            where: { id: token },
            data: {
              status: 'ACCEPTED',
              acceptedAt: new Date(),
            },
          });

          // Create organization membership
          const membership = await tx.organizationMembership.create({
            data: {
              userId,
              organizationId: invitation.organizationId,
              role: invitation.role,
              status: 'ACTIVE',
              invitedBy: invitation.invitedBy,
              invitedAt: invitation.createdAt,
              joinedAt: new Date(),
            },
          });

          // Update user's organizationId if not set
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { organizationId: true },
          });

          if (!user?.organizationId) {
            await tx.user.update({
              where: { id: userId },
              data: { organizationId: invitation.organizationId },
            });
          }

          return membership;
        });

        logger.info('[Invitation] Invitation accepted', {
          invitationId: token,
          userId,
          organizationId: invitation.organizationId,
          role: invitation.role,
        });

        res.json({
          success: true,
          message: 'Invitation accepted successfully',
          data: {
            organization: {
              id: invitation.organization.id,
              name: invitation.organization.name,
              slug: invitation.organization.slug,
            },
            membership: {
              role: result.role,
              status: result.status,
              joinedAt: result.joinedAt?.toISOString() || null,
            },
          },
        });
      } catch (error) {
        logger.error('[Invitation] Accept error', { error });
        next(error);
      }
    }
  );

  return router;
}

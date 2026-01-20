/**
 * User Service
 *
 * Handles user-related business logic including account deletion.
 * Extracted from users.routes.ts for better separation of concerns.
 */

import bcrypt from 'bcrypt';
import { prisma } from '../utils/prisma';
import { supabaseAdmin } from '../utils/supabase';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';

/**
 * Context information for audit logging
 */
export interface AuditContext {
  ip?: string;
  userAgent?: string;
}

/**
 * Result of a user deletion operation
 */
export interface DeleteUserResult {
  success: boolean;
  email?: string;
  error?: string;
}

/**
 * User Service class for handling user-related operations
 */
export class UserService {
  /**
   * Delete a user account with full cascade deletion
   *
   * This method:
   * 1. Verifies the user's password
   * 2. Creates an audit log entry BEFORE deletion
   * 3. Deletes all user data in a transaction (cascading through 12+ tables)
   * 4. Deletes the Supabase auth user if present
   *
   * Note: Some of these deletes may be redundant due to Prisma schema cascades,
   * but we keep them for safety and explicit control over deletion order.
   *
   * @param userId - The ID of the user to delete
   * @param password - The user's current password for verification
   * @param auditContext - IP and user agent for audit logging
   * @returns Result indicating success/failure and the deleted user's email
   */
  async deleteUser(
    userId: string,
    password: string,
    auditContext: AuditContext
  ): Promise<DeleteUserResult> {
    // Fetch user with password hash
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        password: true,
        supabaseUserId: true,
      },
    });

    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      logger.warn('Delete account: invalid password attempt', { userId, email: user.email });
      return {
        success: false,
        error: 'Invalid password',
      };
    }

    // Create audit log entry BEFORE deletion (so we have userId reference)
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_DELETED',
        entityType: 'User',
        entityId: user.id,
        metadata: {
          email: user.email,
          deletedAt: new Date().toISOString(),
          ipAddress: auditContext.ip,
          userAgent: auditContext.userAgent,
        },
      },
    });

    // Delete all user data in transaction (order matters for FK constraints)
    // Note: Some of these deletes may be redundant due to Prisma schema cascades (onDelete: Cascade),
    // but we keep explicit deletes for safety, visibility, and to ensure deletion order.
    await prisma.$transaction(async (tx) => {
      // Get client IDs for cascading deletes
      const clients = await tx.client.findMany({
        where: { userId },
        select: { id: true },
      });
      const clientIds = clients.map((c) => c.id);

      // Delete records that reference clients
      await tx.filledForm.deleteMany({ where: { clientId: { in: clientIds } } });
      await tx.clientProfile.deleteMany({ where: { clientId: { in: clientIds } } });

      // Delete user-owned records
      await tx.clientDocument.deleteMany({ where: { userId } });
      await tx.client.deleteMany({ where: { userId } });
      await tx.document.deleteMany({ where: { userId } });
      await tx.organizationMembership.deleteMany({ where: { userId } });
      await tx.organizationInvitation.deleteMany({ where: { invitedBy: userId } });
      await tx.userSettings.deleteMany({ where: { userId } });
      await tx.userProfile.deleteMany({ where: { userId } });
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.formTemplate.deleteMany({ where: { userId } });
      await tx.documentSource.deleteMany({ where: { userId } });
      await tx.userFeedback.deleteMany({ where: { userId } });

      // Finally delete the user
      await tx.user.delete({ where: { id: userId } });
    });

    // Delete Supabase auth user if exists
    if (user.supabaseUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(user.supabaseUserId);
      } catch (supabaseError) {
        // Log but don't fail - Prisma user is already deleted
        logger.error('Failed to delete Supabase auth user', {
          userId,
          supabaseUserId: user.supabaseUserId,
          error: supabaseError,
        });
      }
    }

    logger.info('User account deleted successfully', { userId, email: user.email });

    return {
      success: true,
      email: user.email,
    };
  }
}

// Export singleton instance
export const userService = new UserService();

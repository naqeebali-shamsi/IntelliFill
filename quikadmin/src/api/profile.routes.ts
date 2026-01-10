import { Router, Request, Response, NextFunction } from 'express';
import { ProfileService, AuditContext } from '../services/ProfileService';
import { authenticateSupabase, AuthenticatedRequest } from '../middleware/supabaseAuth';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { prisma } from '../utils/prisma';

/**
 * Extract audit context from Express request
 */
function getAuditContext(req: Request): AuditContext {
  return {
    ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || undefined,
    userAgent: req.headers['user-agent'] || undefined,
  };
}

export function createProfileRoutes(): Router {
  const router = Router();
  const profileService = new ProfileService();

  /**
   * GET /api/users/me/profile - Get user's aggregated profile
   * Returns aggregated data from all user's documents
   * Automatically aggregates if profile doesn't exist or is stale
   */
  router.get(
    '/me/profile',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'User ID not found in request',
          });
        }

        logger.info(`Fetching profile for user: ${userId}`);

        // Try to get existing profile
        let profile = await profileService.getProfile(userId);

        // If no profile exists, aggregate from documents
        if (!profile) {
          logger.info(`No profile found for user ${userId}, aggregating from documents`);
          profile = await profileService.aggregateUserProfile(userId);
          await profileService.saveProfile(userId, profile, getAuditContext(req));
        }

        // Check if profile is stale (older than 1 hour and user has new documents)
        const staleThreshold = 60 * 60 * 1000; // 1 hour
        const isStale = Date.now() - profile.lastAggregated.getTime() > staleThreshold;

        if (isStale) {
          logger.info(`Profile for user ${userId} is stale, refreshing`);
          profile = await profileService.refreshProfile(userId, getAuditContext(req));
        }

        // Format response
        const responseData = {
          userId: profile.userId,
          fields: Object.values(profile.fields).map((field) => ({
            key: field.key,
            values: field.values,
            sourceCount: field.sources.length,
            confidence: Math.round(field.confidence * 100) / 100,
            lastUpdated: field.lastUpdated,
          })),
          lastAggregated: profile.lastAggregated,
          documentCount: profile.documentCount,
        };

        res.json({
          success: true,
          profile: responseData,
        });
      } catch (error) {
        logger.error('Get profile error:', error);
        next(error);
      }
    }
  );

  /**
   * PUT /api/users/me/profile - Update user profile manually
   * Allows users to add or modify profile fields
   * Merges with existing aggregated data
   */
  router.put(
    '/me/profile',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'User ID not found in request',
          });
        }

        const updates = req.body;

        if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Profile updates are required',
          });
        }

        logger.info(`Updating profile for user: ${userId}`);

        // Update profile with new data (with audit logging)
        const updatedProfile = await profileService.updateProfile(
          userId,
          updates,
          getAuditContext(req)
        );

        // Format response
        const responseData = {
          userId: updatedProfile.userId,
          fields: Object.values(updatedProfile.fields).map((field) => ({
            key: field.key,
            values: field.values,
            sourceCount: field.sources.length,
            confidence: Math.round(field.confidence * 100) / 100,
            lastUpdated: field.lastUpdated,
          })),
          lastAggregated: updatedProfile.lastAggregated,
          documentCount: updatedProfile.documentCount,
        };

        res.json({
          success: true,
          message: 'Profile updated successfully',
          profile: responseData,
        });
      } catch (error) {
        logger.error('Update profile error:', error);
        next(error);
      }
    }
  );

  /**
   * POST /api/users/me/profile/refresh - Manually refresh profile
   * Re-aggregates data from all documents
   * Useful when user uploads new documents and wants immediate refresh
   */
  router.post(
    '/me/profile/refresh',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'User ID not found in request',
          });
        }

        logger.info(`Refreshing profile for user: ${userId}`);

        const profile = await profileService.refreshProfile(userId, getAuditContext(req));

        // Format response
        const responseData = {
          userId: profile.userId,
          fields: Object.values(profile.fields).map((field) => ({
            key: field.key,
            values: field.values,
            sourceCount: field.sources.length,
            confidence: Math.round(field.confidence * 100) / 100,
            lastUpdated: field.lastUpdated,
          })),
          lastAggregated: profile.lastAggregated,
          documentCount: profile.documentCount,
        };

        res.json({
          success: true,
          message: 'Profile refreshed successfully',
          profile: responseData,
        });
      } catch (error) {
        logger.error('Refresh profile error:', error);
        next(error);
      }
    }
  );

  /**
   * DELETE /api/users/me/profile - Delete user profile
   * Removes aggregated profile data (documents remain intact)
   */
  router.delete(
    '/me/profile',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'User ID not found in request',
          });
        }

        logger.info(`Deleting profile for user: ${userId}`);

        await profileService.deleteProfile(userId, getAuditContext(req));

        res.json({
          success: true,
          message: 'Profile deleted successfully',
        });
      } catch (error) {
        // Handle case where profile doesn't exist
        if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Profile not found',
          });
        }

        logger.error('Delete profile error:', error);
        next(error);
      }
    }
  );

  /**
   * GET /api/users/me/profile/field/:fieldKey - Get specific field from profile
   * Returns values for a specific field key
   */
  router.get(
    '/me/profile/field/:fieldKey',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;
        const { fieldKey } = req.params;

        if (!userId) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'User ID not found in request',
          });
        }

        if (!fieldKey) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Field key is required',
          });
        }

        logger.info(`Fetching field ${fieldKey} for user: ${userId}`);

        const profile = await profileService.getProfile(userId);

        if (!profile) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Profile not found',
          });
        }

        // Normalize field key to match stored format
        const normalizedKey = fieldKey.toLowerCase().replace(/[_\s-]+/g, '_');
        const field = profile.fields[normalizedKey];

        if (!field) {
          return res.status(404).json({
            error: 'Not Found',
            message: `Field '${fieldKey}' not found in profile`,
          });
        }

        res.json({
          success: true,
          field: {
            key: field.key,
            values: field.values,
            sourceCount: field.sources.length,
            confidence: Math.round(field.confidence * 100) / 100,
            lastUpdated: field.lastUpdated,
          },
        });
      } catch (error) {
        logger.error('Get profile field error:', error);
        next(error);
      }
    }
  );

  /**
   * GET /api/users/me/profile/audit - Get profile audit history
   * Returns paginated list of profile changes
   * Query params: limit (default 50), offset (default 0)
   */
  router.get(
    '/me/profile/audit',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'User ID not found in request',
          });
        }

        // Get profile ID for the user
        const profile = await prisma.userProfile.findUnique({
          where: { userId },
          select: { id: true },
        });

        if (!profile) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Profile not found',
          });
        }

        // Parse pagination params
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
        const offset = parseInt(req.query.offset as string) || 0;

        logger.info(`Fetching audit history for profile: ${profile.id}`);

        const auditHistory = await profileService.getAuditHistory(profile.id, { limit, offset });

        // Format logs for response
        const formattedLogs = auditHistory.logs.map((log) => ({
          id: log.id,
          fieldName: log.fieldName,
          action: log.action,
          oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
          newValue: log.newValue ? JSON.parse(log.newValue) : null,
          ipAddress: log.ipAddress,
          createdAt: log.createdAt,
        }));

        res.json({
          success: true,
          logs: formattedLogs,
          pagination: {
            total: auditHistory.total,
            limit,
            offset,
            hasMore: auditHistory.hasMore,
          },
        });
      } catch (error) {
        logger.error('Get profile audit history error:', error);
        next(error);
      }
    }
  );

  return router;
}

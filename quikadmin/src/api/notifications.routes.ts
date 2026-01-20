/**
 * Notification API Routes
 * REST endpoints for listing, marking as read, and managing notifications
 */

import { Router, Response, NextFunction } from 'express';
import { authenticateSupabase, AuthenticatedRequest } from '../middleware/supabaseAuth';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getUserId(req: AuthenticatedRequest): string {
  return req.user!.id;
}

function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

function invalidIdResponse(res: Response): Response {
  return res.status(400).json({
    success: false,
    error: 'Invalid notification ID format',
  });
}

function notFoundResponse(res: Response): Response {
  return res.status(404).json({
    success: false,
    error: 'Notification not found',
  });
}

async function findUserNotification(id: string, userId: string) {
  return prisma.notification.findFirst({
    where: { id, userId },
  });
}

function clampLimit(value: string | undefined, defaultValue = 20, max = 100): number {
  const parsed = parseInt(String(value ?? defaultValue), 10) || defaultValue;
  return Math.min(Math.max(1, parsed), max);
}

export function createNotificationRoutes(): Router {
  const router = Router();

  // GET /api/notifications - List notifications
  router.get('/', authenticateSupabase, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const limit = clampLimit(req.query.limit as string);
      const unreadOnly = req.query.unreadOnly === 'true';

      const [notifications, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where: {
            userId,
            ...(unreadOnly && { read: false }),
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        prisma.notification.count({
          where: { userId, read: false },
        }),
      ]);

      return res.json({
        success: true,
        data: { notifications, unreadCount },
      });
    } catch (error) {
      logger.error('Failed to list notifications:', error);
      next(error);
    }
  });

  // GET /api/notifications/:id - Get single notification
  router.get(
    '/:id',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        if (!isValidUUID(id)) return invalidIdResponse(res);

        const notification = await findUserNotification(id, getUserId(req));
        if (!notification) return notFoundResponse(res);

        return res.json({
          success: true,
          data: notification,
        });
      } catch (error) {
        logger.error('Failed to get notification:', error);
        next(error);
      }
    }
  );

  // PATCH /api/notifications/:id/read - Mark as read
  router.patch(
    '/:id/read',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        if (!isValidUUID(id)) return invalidIdResponse(res);

        const existing = await findUserNotification(id, getUserId(req));
        if (!existing) return notFoundResponse(res);

        const notification = await prisma.notification.update({
          where: { id },
          data: { read: true, readAt: new Date() },
        });

        return res.json({
          success: true,
          data: notification,
        });
      } catch (error) {
        logger.error('Failed to mark notification as read:', error);
        next(error);
      }
    }
  );

  // POST /api/notifications/mark-all-read - Mark all as read
  router.post(
    '/mark-all-read',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const result = await prisma.notification.updateMany({
          where: { userId: getUserId(req), read: false },
          data: { read: true, readAt: new Date() },
        });

        return res.json({
          success: true,
          data: { updatedCount: result.count },
        });
      } catch (error) {
        logger.error('Failed to mark all notifications as read:', error);
        next(error);
      }
    }
  );

  // DELETE /api/notifications/:id - Delete single notification
  router.delete(
    '/:id',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        if (!isValidUUID(id)) return invalidIdResponse(res);

        const existing = await findUserNotification(id, getUserId(req));
        if (!existing) return notFoundResponse(res);

        await prisma.notification.delete({ where: { id } });

        return res.json({
          success: true,
          message: 'Notification deleted',
        });
      } catch (error) {
        logger.error('Failed to delete notification:', error);
        next(error);
      }
    }
  );

  // DELETE /api/notifications - Delete all read notifications
  router.delete(
    '/',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const result = await prisma.notification.deleteMany({
          where: { userId: getUserId(req), read: true },
        });

        return res.json({
          success: true,
          data: { deletedCount: result.count },
        });
      } catch (error) {
        logger.error('Failed to delete read notifications:', error);
        next(error);
      }
    }
  );

  return router;
}

export default createNotificationRoutes;

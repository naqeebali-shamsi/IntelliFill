/**
 * Security Audit Dashboard API Routes
 *
 * Task 285: Expose security event metrics and reports for administrative review.
 *
 * Endpoints:
 * - GET /api/admin/security/metrics - Summary metrics
 * - GET /api/admin/security/events - Paginated event list
 * - GET /api/admin/security/export - CSV/JSON export
 * - GET /api/admin/security/csp-violations - CSP violation aggregates
 *
 * @module api/security-dashboard.routes
 */

import { Router, Response, NextFunction, IRouter } from 'express';
import { prisma } from '../utils/prisma';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { authenticateSupabase, AuthenticatedRequest } from '../middleware/supabaseAuth';
import { cspMonitoringService } from '../services/CspMonitoringService';
import { isSuspiciousIp } from '../middleware/rateLimiter';
import { isSecretRotationInProgress, getRotationStatus } from '../utils/jwtVerify';

const router: IRouter = Router();

// ============================================================================
// Middleware: Admin-only access
// ============================================================================

/**
 * Require admin role for all security dashboard endpoints
 */
const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'ADMIN') {
    logger.warn('[SecurityDashboard] Unauthorized access attempt', {
      userId: req.user?.id,
      role: req.user?.role,
      path: req.path,
    });
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
  }
  next();
};

// ============================================================================
// Types
// ============================================================================

interface SecurityMetrics {
  authFailures: {
    last24h: number;
    last7d: number;
    trend: 'up' | 'down' | 'stable';
  };
  cspViolations: {
    last24h: number;
    last7d: number;
    topBlockedUris: Array<{ uri: string; count: number }>;
  };
  rateLimitHits: {
    last24h: number;
    last7d: number;
  };
  criticalEvents: {
    last24h: number;
    unacknowledged: number;
  };
  systemStatus: {
    jwtRotationActive: boolean;
    accessSecretRotating: boolean;
    refreshSecretRotating: boolean;
  };
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/admin/security/metrics
 * Get summary security metrics for dashboard
 */
router.get(
  '/metrics',
  authenticateSupabase,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Auth failures from AuditLog
      const [authFailures24h, authFailures7d, authFailuresPrev7d] = await Promise.all([
        prisma.auditLog.count({
          where: {
            action: { startsWith: 'SECURITY:AUTH_FAILED' },
            createdAt: { gte: last24h },
          },
        }),
        prisma.auditLog.count({
          where: {
            action: { startsWith: 'SECURITY:AUTH_FAILED' },
            createdAt: { gte: last7d },
          },
        }),
        prisma.auditLog.count({
          where: {
            action: { startsWith: 'SECURITY:AUTH_FAILED' },
            createdAt: { gte: last14d, lt: last7d },
          },
        }),
      ]);

      // CSP violations
      const cspViolations24h = await cspMonitoringService.getRecentViolationCount(24 * 60);
      const cspViolations7d = await cspMonitoringService.getRecentViolationCount(7 * 24 * 60);
      const topCspViolations = await cspMonitoringService.getAggregatedViolations({
        limit: 5,
        since: last7d,
      });

      // Rate limit hits
      const [rateLimitHits24h, rateLimitHits7d] = await Promise.all([
        prisma.auditLog.count({
          where: {
            action: { startsWith: 'SECURITY:RATE_LIMIT' },
            createdAt: { gte: last24h },
          },
        }),
        prisma.auditLog.count({
          where: {
            action: { startsWith: 'SECURITY:RATE_LIMIT' },
            createdAt: { gte: last7d },
          },
        }),
      ]);

      // Critical events
      const [criticalEvents24h, unacknowledgedCritical] = await Promise.all([
        prisma.auditLog.count({
          where: {
            action: { startsWith: 'SECURITY:' },
            metadata: { path: ['severity'], equals: 'CRITICAL' },
            createdAt: { gte: last24h },
          },
        }),
        prisma.auditLog.count({
          where: {
            action: { startsWith: 'SECURITY:' },
            AND: [
              { metadata: { path: ['severity'], equals: 'CRITICAL' } },
              { metadata: { path: ['acknowledged'], equals: false } },
            ],
          },
        }),
      ]);

      // Calculate trend
      const authTrend: 'up' | 'down' | 'stable' =
        authFailures7d > authFailuresPrev7d * 1.2
          ? 'up'
          : authFailures7d < authFailuresPrev7d * 0.8
            ? 'down'
            : 'stable';

      const rotationStatus = getRotationStatus();

      const metrics: SecurityMetrics = {
        authFailures: {
          last24h: authFailures24h,
          last7d: authFailures7d,
          trend: authTrend,
        },
        cspViolations: {
          last24h: cspViolations24h,
          last7d: cspViolations7d,
          topBlockedUris: topCspViolations.map((v) => ({
            uri: v.blockedUri,
            count: v.count,
          })),
        },
        rateLimitHits: {
          last24h: rateLimitHits24h,
          last7d: rateLimitHits7d,
        },
        criticalEvents: {
          last24h: criticalEvents24h,
          unacknowledged: unacknowledgedCritical,
        },
        systemStatus: {
          jwtRotationActive: isSecretRotationInProgress(),
          ...rotationStatus,
        },
      };

      res.json({ success: true, data: metrics });
    } catch (error) {
      logger.error('[SecurityDashboard] Failed to get metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve security metrics',
      });
    }
  }
);

/**
 * GET /api/admin/security/events
 * Get paginated list of security events
 */
router.get(
  '/events',
  authenticateSupabase,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = (page - 1) * limit;

      // Filters
      const eventType = req.query.type as string;
      const severity = req.query.severity as string;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const whereClause: any = {
        action: { startsWith: 'SECURITY:' },
      };

      if (eventType) {
        whereClause.action = `SECURITY:${eventType}`;
      }

      if (severity) {
        whereClause.metadata = { path: ['severity'], equals: severity };
      }

      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = startDate;
        if (endDate) whereClause.createdAt.lte = endDate;
      }

      const [events, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
          select: {
            id: true,
            action: true,
            userId: true,
            metadata: true,
            createdAt: true,
          },
        }),
        prisma.auditLog.count({ where: whereClause }),
      ]);

      // Transform events
      const transformedEvents = events.map((event) => ({
        id: event.id,
        type: event.action.replace('SECURITY:', ''),
        userId: event.userId,
        timestamp: event.createdAt,
        ...(event.metadata as Record<string, unknown>),
      }));

      res.json({
        success: true,
        data: {
          events: transformedEvents,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      logger.error('[SecurityDashboard] Failed to get events', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve security events',
      });
    }
  }
);

/**
 * GET /api/admin/security/export
 * Export security events as CSV or JSON
 */
router.get(
  '/export',
  authenticateSupabase,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const format = (req.query.format as string) || 'json';
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const eventType = req.query.type as string;

      const whereClause: any = {
        action: { startsWith: 'SECURITY:' },
        createdAt: { gte: startDate, lte: endDate },
      };

      if (eventType) {
        whereClause.action = `SECURITY:${eventType}`;
      }

      const events = await prisma.auditLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 10000, // Limit export size
        select: {
          id: true,
          action: true,
          userId: true,
          metadata: true,
          createdAt: true,
        },
      });

      // Log export for audit
      logger.info('[SecurityDashboard] Security events exported', {
        userId: req.user?.id,
        format,
        eventCount: events.length,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      if (format === 'csv') {
        // Generate CSV
        const headers = ['ID', 'Type', 'Severity', 'User ID', 'IP Address', 'Timestamp', 'Details'];
        const rows = events.map((event) => {
          const meta = event.metadata as Record<string, unknown>;
          return [
            event.id,
            event.action.replace('SECURITY:', ''),
            meta.severity || 'UNKNOWN',
            event.userId || '',
            meta.ip || '',
            event.createdAt.toISOString(),
            JSON.stringify(meta.details || {}),
          ].join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="security-events-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv"`
        );
        return res.send(csv);
      }

      // JSON format
      const jsonData = events.map((event) => ({
        id: event.id,
        type: event.action.replace('SECURITY:', ''),
        userId: event.userId,
        timestamp: event.createdAt.toISOString(),
        ...(event.metadata as Record<string, unknown>),
      }));

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="security-events-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.json"`
      );
      return res.json({
        exportedAt: new Date().toISOString(),
        dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
        eventCount: jsonData.length,
        events: jsonData,
      });
    } catch (error) {
      logger.error('[SecurityDashboard] Failed to export events', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        success: false,
        error: 'Failed to export security events',
      });
    }
  }
);

/**
 * GET /api/admin/security/csp-violations
 * Get CSP violation summary
 */
router.get(
  '/csp-violations',
  authenticateSupabase,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const since = req.query.since
        ? new Date(req.query.since as string)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const violations = await cspMonitoringService.getAggregatedViolations({
        limit,
        since,
      });

      const recentCount = await cspMonitoringService.getRecentViolationCount(60);

      res.json({
        success: true,
        data: {
          recentViolationsLastHour: recentCount,
          aggregatedViolations: violations,
        },
      });
    } catch (error) {
      logger.error('[SecurityDashboard] Failed to get CSP violations', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve CSP violations',
      });
    }
  }
);

/**
 * POST /api/admin/security/acknowledge
 * Acknowledge a critical security event
 */
router.post(
  '/acknowledge/:eventId',
  authenticateSupabase,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId, 10);

      if (isNaN(eventId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid event ID',
        });
      }

      const event = await prisma.auditLog.findUnique({
        where: { id: eventId },
      });

      if (!event || !event.action.startsWith('SECURITY:')) {
        return res.status(404).json({
          success: false,
          error: 'Security event not found',
        });
      }

      // Update metadata to mark as acknowledged
      const currentMeta = (event.metadata as Record<string, unknown>) || {};
      await prisma.auditLog.update({
        where: { id: eventId },
        data: {
          metadata: {
            ...currentMeta,
            acknowledged: true,
            acknowledgedBy: req.user?.id,
            acknowledgedAt: new Date().toISOString(),
          },
        },
      });

      logger.info('[SecurityDashboard] Security event acknowledged', {
        eventId,
        acknowledgedBy: req.user?.id,
      });

      res.json({ success: true, message: 'Event acknowledged' });
    } catch (error) {
      logger.error('[SecurityDashboard] Failed to acknowledge event', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        success: false,
        error: 'Failed to acknowledge event',
      });
    }
  }
);

/**
 * GET /api/admin/security/ip-status/:ip
 * Check if an IP is flagged as suspicious
 */
router.get(
  '/ip-status/:ip',
  authenticateSupabase,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { ip } = req.params;
      const status = isSuspiciousIp(ip);

      res.json({
        success: true,
        data: {
          ip,
          isSuspicious: status.suspicious,
          rateLimitFactor: status.factor,
        },
      });
    } catch (error) {
      logger.error('[SecurityDashboard] Failed to get IP status', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        success: false,
        error: 'Failed to check IP status',
      });
    }
  }
);

export default router;

/**
 * Audit Logger Middleware
 *
 * Comprehensive audit logging for security and compliance.
 * Implements requirements from PRD Vector Search v2.0:
 * - REQ-SEC-007: Audit logging for all vector operations
 * - REQ-SEC-008: Anomaly detection for suspicious patterns
 * - VULN-003: Embedding poisoning & data leakage prevention
 *
 * Features:
 * - Logs all authenticated operations
 * - Tracks entity changes (old/new values)
 * - Detects anomalous behavior patterns
 * - Alerts on suspicious activities
 *
 * @module middleware/auditLogger
 */

import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { createClient } from 'redis';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface AuditLogEntry {
  userId: string | null;
  organizationId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AnomalyDetectionConfig {
  searchThresholdPerMinute: number;
  uploadThresholdPerMinute: number;
  deleteThresholdPerMinute: number;
  alertThreshold: number;
  windowSizeMs: number;
}

export interface AnomalyAlert {
  type:
    | 'HIGH_FREQUENCY_SEARCH'
    | 'HIGH_FREQUENCY_UPLOAD'
    | 'CROSS_TENANT_ATTEMPT'
    | 'BULK_DELETE'
    | 'SUSPICIOUS_PATTERN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId: string;
  organizationId: string | null;
  message: string;
  context: Record<string, unknown>;
  timestamp: Date;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_ANOMALY_CONFIG: AnomalyDetectionConfig = {
  searchThresholdPerMinute: 50,
  uploadThresholdPerMinute: 20,
  deleteThresholdPerMinute: 10,
  alertThreshold: 3, // Number of violations before alert
  windowSizeMs: 60 * 1000, // 1 minute window
};

// Actions to audit
const AUDITED_ACTIONS = [
  // Document operations
  'DOCUMENT_UPLOAD',
  'DOCUMENT_DELETE',
  'DOCUMENT_VIEW',
  'DOCUMENT_DOWNLOAD',
  // Knowledge base operations
  'KNOWLEDGE_SOURCE_CREATE',
  'KNOWLEDGE_SOURCE_DELETE',
  'KNOWLEDGE_SEARCH',
  'KNOWLEDGE_HYBRID_SEARCH',
  // Form operations
  'FORM_FILL',
  'FORM_SUGGESTION',
  // User operations
  'USER_LOGIN',
  'USER_LOGOUT',
  'USER_PROFILE_UPDATE',
  'PASSWORD_CHANGE',
  // Admin operations
  'USER_CREATE',
  'USER_DELETE',
  'ORGANIZATION_CREATE',
  'SETTINGS_UPDATE',
] as const;

type AuditAction = (typeof AUDITED_ACTIONS)[number];

// Entity types for categorization
const ENTITY_TYPES = [
  'document',
  'document_source',
  'document_chunk',
  'user',
  'organization',
  'template',
  'client',
  'form',
] as const;

type EntityType = (typeof ENTITY_TYPES)[number];

// ============================================================================
// Redis client for anomaly detection counters
// ============================================================================

let redisClient: ReturnType<typeof createClient> | null = null;
let redisConnected = false;

// In-memory fallback for counters when Redis unavailable
const memoryCounters = new Map<string, { count: number; timestamp: number }>();

async function initRedisForAudit(): Promise<void> {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = createClient({ url: redisUrl });

    redisClient.on('error', (err) => {
      logger.warn('Redis error in audit logger:', err.message);
      redisConnected = false;
    });

    redisClient.on('ready', () => {
      redisConnected = true;
    });

    await redisClient.connect();
  } catch (err) {
    logger.warn('Failed to connect Redis for audit - using memory counters');
    redisClient = null;
    redisConnected = false;
  }
}

// Initialize Redis connection
initRedisForAudit();

// ============================================================================
// Audit Logger Service
// ============================================================================

export class AuditLoggerService {
  private config: AnomalyDetectionConfig;
  private alertHandlers: ((alert: AnomalyAlert) => void)[] = [];

  constructor(config: Partial<AnomalyDetectionConfig> = {}) {
    this.config = { ...DEFAULT_ANOMALY_CONFIG, ...config };
  }

  /**
   * Log an audit event
   *
   * @param entry - Audit log entry
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Store in database
      await prisma.auditLog.create({
        data: {
          userId: entry.userId,
          organizationId: entry.organizationId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          oldValue: (entry.oldValue || undefined) as Prisma.InputJsonValue | undefined,
          newValue: (entry.newValue || undefined) as Prisma.InputJsonValue | undefined,
          metadata: (entry.metadata || undefined) as Prisma.InputJsonValue | undefined,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });

      // Log to application logs for immediate visibility
      logger.info('Audit event', {
        action: entry.action,
        userId: entry.userId,
        organizationId: entry.organizationId,
        entityType: entry.entityType,
        entityId: entry.entityId,
      });

      // Run anomaly detection asynchronously
      if (entry.userId) {
        this.detectAnomalies(entry).catch((err) => {
          logger.error('Anomaly detection error', { error: err.message });
        });
      }
    } catch (error) {
      logger.error('Failed to write audit log', {
        error: error instanceof Error ? error.message : 'Unknown error',
        entry,
      });
      // Don't throw - audit logging should not block operations
    }
  }

  /**
   * Register an alert handler for anomaly notifications
   *
   * @param handler - Function to call when anomaly detected
   */
  onAlert(handler: (alert: AnomalyAlert) => void): void {
    this.alertHandlers.push(handler);
  }

  /**
   * Detect anomalous behavior patterns
   *
   * @param entry - Audit log entry to analyze
   */
  private async detectAnomalies(entry: AuditLogEntry): Promise<void> {
    if (!entry.userId) return;

    const checks = [
      this.checkSearchFrequency(entry),
      this.checkUploadFrequency(entry),
      this.checkDeleteFrequency(entry),
      this.checkCrossTenantAttempt(entry),
    ];

    await Promise.all(checks);
  }

  /**
   * Check for high-frequency search patterns
   */
  private async checkSearchFrequency(entry: AuditLogEntry): Promise<void> {
    if (!entry.action.includes('SEARCH')) return;

    const key = `audit:search:${entry.userId}`;
    const count = await this.incrementCounter(key);

    if (count > this.config.searchThresholdPerMinute) {
      await this.raiseAlert({
        type: 'HIGH_FREQUENCY_SEARCH',
        severity: count > this.config.searchThresholdPerMinute * 2 ? 'HIGH' : 'MEDIUM',
        userId: entry.userId!,
        organizationId: entry.organizationId,
        message: `User exceeded search threshold: ${count} searches in last minute`,
        context: {
          searchCount: count,
          threshold: this.config.searchThresholdPerMinute,
          action: entry.action,
        },
        timestamp: new Date(),
      });
    }
  }

  /**
   * Check for high-frequency upload patterns
   */
  private async checkUploadFrequency(entry: AuditLogEntry): Promise<void> {
    if (!entry.action.includes('UPLOAD') && !entry.action.includes('CREATE')) return;

    const key = `audit:upload:${entry.userId}`;
    const count = await this.incrementCounter(key);

    if (count > this.config.uploadThresholdPerMinute) {
      await this.raiseAlert({
        type: 'HIGH_FREQUENCY_UPLOAD',
        severity: 'MEDIUM',
        userId: entry.userId!,
        organizationId: entry.organizationId,
        message: `User exceeded upload threshold: ${count} uploads in last minute`,
        context: {
          uploadCount: count,
          threshold: this.config.uploadThresholdPerMinute,
          action: entry.action,
        },
        timestamp: new Date(),
      });
    }
  }

  /**
   * Check for bulk delete patterns
   */
  private async checkDeleteFrequency(entry: AuditLogEntry): Promise<void> {
    if (!entry.action.includes('DELETE')) return;

    const key = `audit:delete:${entry.userId}`;
    const count = await this.incrementCounter(key);

    if (count > this.config.deleteThresholdPerMinute) {
      await this.raiseAlert({
        type: 'BULK_DELETE',
        severity: 'HIGH',
        userId: entry.userId!,
        organizationId: entry.organizationId,
        message: `User exceeded delete threshold: ${count} deletes in last minute`,
        context: {
          deleteCount: count,
          threshold: this.config.deleteThresholdPerMinute,
          action: entry.action,
        },
        timestamp: new Date(),
      });
    }
  }

  /**
   * Check for cross-tenant access attempts
   */
  private async checkCrossTenantAttempt(entry: AuditLogEntry): Promise<void> {
    // Look for metadata indicating cross-tenant attempt
    if (entry.metadata && (entry.metadata as any).crossTenantAttempt) {
      await this.raiseAlert({
        type: 'CROSS_TENANT_ATTEMPT',
        severity: 'CRITICAL',
        userId: entry.userId!,
        organizationId: entry.organizationId,
        message: 'Potential cross-tenant data access attempt detected',
        context: {
          requestedOrg: (entry.metadata as any).requestedOrganizationId,
          userOrg: entry.organizationId,
          action: entry.action,
          entityId: entry.entityId,
        },
        timestamp: new Date(),
      });
    }
  }

  /**
   * Increment counter for rate tracking
   */
  private async incrementCounter(key: string): Promise<number> {
    if (redisClient && redisConnected) {
      try {
        const multi = redisClient.multi();
        multi.incr(key);
        multi.expire(key, 60); // 1 minute expiry
        const results = await multi.exec();
        return (results?.[0] as number) || 1;
      } catch (err) {
        logger.warn('Redis counter increment failed', { key });
      }
    }

    // Fallback to memory counter
    const now = Date.now();
    const existing = memoryCounters.get(key);

    if (existing && now - existing.timestamp < this.config.windowSizeMs) {
      existing.count++;
      return existing.count;
    }

    memoryCounters.set(key, { count: 1, timestamp: now });

    // Cleanup old entries periodically
    if (memoryCounters.size > 1000) {
      for (const [k, v] of memoryCounters.entries()) {
        if (now - v.timestamp > this.config.windowSizeMs * 2) {
          memoryCounters.delete(k);
        }
      }
    }

    return 1;
  }

  /**
   * Raise an anomaly alert
   */
  private async raiseAlert(alert: AnomalyAlert): Promise<void> {
    // Log the alert
    logger.warn('ANOMALY DETECTED', alert);

    // Store alert in database for historical analysis
    try {
      await prisma.auditLog.create({
        data: {
          userId: alert.userId,
          organizationId: alert.organizationId,
          action: `ANOMALY_${alert.type}`,
          entityType: 'security',
          metadata: {
            alertType: alert.type,
            severity: alert.severity,
            message: alert.message,
            context: alert.context as Prisma.InputJsonValue,
          } as Prisma.InputJsonValue,
          ipAddress: null,
          userAgent: null,
        },
      });
    } catch (err) {
      logger.error('Failed to store anomaly alert', { error: err });
    }

    // Notify registered handlers
    for (const handler of this.alertHandlers) {
      try {
        handler(alert);
      } catch (err) {
        logger.error('Alert handler error', { error: err });
      }
    }

    // For critical alerts, consider additional actions
    if (alert.severity === 'CRITICAL') {
      // TODO: Send to security team, block user, etc.
      logger.error('CRITICAL SECURITY ALERT', alert);
    }
  }

  /**
   * Get recent audit logs for a user
   */
  async getUserAuditLogs(
    userId: string,
    options: { limit?: number; offset?: number; actions?: string[] } = {}
  ): Promise<any[]> {
    const { limit = 100, offset = 0, actions } = options;

    return prisma.auditLog.findMany({
      where: {
        userId,
        ...(actions && { action: { in: actions } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get audit logs for an organization
   */
  async getOrganizationAuditLogs(
    organizationId: string,
    options: { limit?: number; offset?: number; actions?: string[]; userId?: string } = {}
  ): Promise<any[]> {
    const { limit = 100, offset = 0, actions, userId } = options;

    return prisma.auditLog.findMany({
      where: {
        organizationId,
        ...(actions && { action: { in: actions } }),
        ...(userId && { userId }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Count recent searches for anomaly detection
   */
  async countRecentSearches(userId: string, windowSeconds: number): Promise<number> {
    const since = new Date(Date.now() - windowSeconds * 1000);

    const result = await prisma.auditLog.count({
      where: {
        userId,
        action: { contains: 'SEARCH' },
        createdAt: { gte: since },
      },
    });

    return result;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const auditLoggerService = new AuditLoggerService();

// ============================================================================
// Express Middleware
// ============================================================================

/**
 * Create audit logging middleware
 * Automatically logs HTTP requests with user context
 *
 * @param options - Middleware options
 * @returns Express middleware function
 */
export function createAuditMiddleware(
  options: {
    excludePaths?: string[];
    includeRequestBody?: boolean;
    includeResponseBody?: boolean;
  } = {}
) {
  const {
    excludePaths = ['/health', '/metrics'],
    includeRequestBody = false,
    includeResponseBody = false,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip excluded paths
    if (excludePaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    const startTime = Date.now();
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();

    // Capture original res.json for response logging
    const originalJson = res.json.bind(res);
    let responseBody: any = null;

    if (includeResponseBody) {
      res.json = (body: any) => {
        responseBody = body;
        return originalJson(body);
      };
    }

    // Log on response finish
    res.on('finish', async () => {
      const duration = Date.now() - startTime;
      const user = (req as any).user;

      // Determine action from method and path
      const action = mapRequestToAction(req.method, req.path);

      // Extract entity info from path
      const { entityType, entityId } = extractEntityFromPath(req.path);

      const entry: AuditLogEntry = {
        userId: user?.id || null,
        organizationId: user?.organizationId || null,
        action,
        entityType,
        entityId,
        oldValue: null,
        newValue:
          includeRequestBody && ['POST', 'PUT', 'PATCH'].includes(req.method)
            ? sanitizeBody(req.body)
            : null,
        metadata: {
          requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          ...(responseBody && includeResponseBody
            ? { responseBody: sanitizeBody(responseBody) }
            : {}),
        },
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || null,
      };

      // Log asynchronously
      auditLoggerService.log(entry).catch((err) => {
        logger.error('Audit middleware logging failed', { error: err.message });
      });
    });

    next();
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map HTTP request to audit action
 */
function mapRequestToAction(method: string, path: string): string {
  const pathLower = path.toLowerCase();

  // Knowledge base operations
  if (pathLower.includes('/knowledge')) {
    if (pathLower.includes('/search')) {
      return pathLower.includes('/hybrid') ? 'KNOWLEDGE_HYBRID_SEARCH' : 'KNOWLEDGE_SEARCH';
    }
    if (pathLower.includes('/sources')) {
      if (method === 'POST') return 'KNOWLEDGE_SOURCE_CREATE';
      if (method === 'DELETE') return 'KNOWLEDGE_SOURCE_DELETE';
      return 'KNOWLEDGE_SOURCE_VIEW';
    }
  }

  // Document operations
  if (pathLower.includes('/document')) {
    if (method === 'POST' && pathLower.includes('/upload')) return 'DOCUMENT_UPLOAD';
    if (method === 'DELETE') return 'DOCUMENT_DELETE';
    if (method === 'GET') return 'DOCUMENT_VIEW';
    return 'DOCUMENT_UPDATE';
  }

  // Auth operations
  if (pathLower.includes('/auth')) {
    if (pathLower.includes('/login')) return 'USER_LOGIN';
    if (pathLower.includes('/logout')) return 'USER_LOGOUT';
    if (pathLower.includes('/register')) return 'USER_CREATE';
    if (pathLower.includes('/password')) return 'PASSWORD_CHANGE';
  }

  // Form operations
  if (pathLower.includes('/form') || pathLower.includes('/fill')) {
    if (pathLower.includes('/suggest')) return 'FORM_SUGGESTION';
    return 'FORM_FILL';
  }

  // Generic mapping
  return `${method.toUpperCase()}_${path.split('/').filter(Boolean).slice(0, 2).join('_').toUpperCase()}`;
}

/**
 * Extract entity type and ID from request path
 */
function extractEntityFromPath(path: string): {
  entityType: string | null;
  entityId: string | null;
} {
  const segments = path.split('/').filter(Boolean);

  // Look for UUID pattern in path
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  for (let i = 0; i < segments.length; i++) {
    if (uuidPattern.test(segments[i])) {
      // Entity type is the segment before the ID
      const entityType = i > 0 ? singularize(segments[i - 1]) : null;
      return { entityType, entityId: segments[i] };
    }
  }

  // If no UUID found, try to determine entity type from path
  const pathLower = path.toLowerCase();
  if (pathLower.includes('/document')) return { entityType: 'document', entityId: null };
  if (pathLower.includes('/knowledge')) return { entityType: 'document_source', entityId: null };
  if (pathLower.includes('/user')) return { entityType: 'user', entityId: null };
  if (pathLower.includes('/client')) return { entityType: 'client', entityId: null };

  return { entityType: null, entityId: null };
}

/**
 * Convert plural to singular (basic implementation)
 */
function singularize(word: string): string {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('es')) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/**
 * Sanitize request/response body for logging
 * Removes sensitive fields
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'cookie',
    'embedding',
  ];
  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  // Recursively sanitize nested objects
  for (const [key, value] of Object.entries(sanitized)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeBody(value);
    }
  }

  return sanitized;
}

/**
 * Get client IP from request (handles proxies)
 */
function getClientIp(req: Request): string | null {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || null;
}

// Need crypto for UUID generation in middleware
import crypto from 'crypto';

// ============================================================================
// Default Export
// ============================================================================

export default auditLoggerService;

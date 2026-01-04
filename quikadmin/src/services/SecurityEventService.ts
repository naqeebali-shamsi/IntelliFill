/**
 * Security Event Logging Service
 *
 * Specialized service for logging security-sensitive events with standardized
 * metadata for audit, compliance, and incident response.
 *
 * Task 276: Security Hardening - Security Event Logging
 *
 * Integrates with existing audit middleware while providing focused
 * security event tracking for:
 * - Authentication failures
 * - Token validation errors
 * - CSRF/XSS protection triggers
 * - Rate limit violations
 * - Privilege escalation attempts
 * - Suspicious activity patterns
 */

import { Request } from 'express';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { prisma } from '../utils/prisma';

// ============================================================================
// Enums and Types
// ============================================================================

/**
 * Security event types for categorization and filtering
 */
export enum SecurityEventType {
  // Authentication events
  AUTH_FAILED = 'AUTH_FAILED',
  AUTH_LOCKOUT = 'AUTH_LOCKOUT',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_REVOKED = 'TOKEN_REVOKED',
  SESSION_HIJACK_ATTEMPT = 'SESSION_HIJACK_ATTEMPT',

  // Protection events
  CSRF_BLOCKED = 'CSRF_BLOCKED',
  XSS_BLOCKED = 'XSS_BLOCKED',
  SQL_INJECTION_BLOCKED = 'SQL_INJECTION_BLOCKED',
  CSP_VIOLATION = 'CSP_VIOLATION',
  CSP_VIOLATION_SPIKE = 'CSP_VIOLATION_SPIKE', // Task 282: High volume of CSP violations

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  RATE_LIMIT_WARNING = 'RATE_LIMIT_WARNING',

  // Access control
  CORS_REJECTED = 'CORS_REJECTED',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  FORBIDDEN_RESOURCE = 'FORBIDDEN_RESOURCE',

  // Data security
  PII_ACCESS = 'PII_ACCESS',
  SENSITIVE_DATA_EXPORT = 'SENSITIVE_DATA_EXPORT',
  DATA_TAMPERING_ATTEMPT = 'DATA_TAMPERING_ATTEMPT',

  // Account security
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  MFA_FAILED = 'MFA_FAILED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',

  // System events
  SUSPICIOUS_PATTERN = 'SUSPICIOUS_PATTERN',
  BRUTE_FORCE_DETECTED = 'BRUTE_FORCE_DETECTED',
  BOT_DETECTED = 'BOT_DETECTED',
}

/**
 * Severity levels for prioritizing incident response
 */
export enum SecuritySeverity {
  LOW = 'LOW', // Informational, logged for compliance
  MEDIUM = 'MEDIUM', // Worth investigating
  HIGH = 'HIGH', // Requires prompt attention
  CRITICAL = 'CRITICAL', // Immediate action required
}

/**
 * Security event metadata structure
 */
export interface ISecurityEvent {
  type: SecurityEventType;
  severity: SecuritySeverity;
  timestamp: Date;
  ip: string | null;
  userAgent: string | null;
  userId: string | null;
  email?: string | null;
  requestPath?: string;
  requestMethod?: string;
  origin?: string | null;
  details: Record<string, unknown>;
}

/**
 * Options for logging security events
 */
export interface SecurityEventOptions {
  type: SecurityEventType;
  severity: SecuritySeverity;
  req?: Request;
  userId?: string | null;
  email?: string | null;
  details?: Record<string, unknown>;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Minimum severity level to persist to database
 * Events below this level are only logged to console
 */
const MIN_PERSIST_SEVERITY: SecuritySeverity =
  (process.env.SECURITY_MIN_PERSIST_LEVEL as SecuritySeverity) || SecuritySeverity.MEDIUM;

/**
 * Severity hierarchy for comparison
 */
const SEVERITY_LEVELS: Record<SecuritySeverity, number> = {
  [SecuritySeverity.LOW]: 0,
  [SecuritySeverity.MEDIUM]: 1,
  [SecuritySeverity.HIGH]: 2,
  [SecuritySeverity.CRITICAL]: 3,
};

// ============================================================================
// SecurityEventService Class
// ============================================================================

export class SecurityEventService {
  /**
   * Log a security event with full context
   *
   * @param options - Security event configuration
   * @returns Promise<void>
   *
   * @example
   * await SecurityEventService.logEvent({
   *   type: SecurityEventType.AUTH_FAILED,
   *   severity: SecuritySeverity.MEDIUM,
   *   req,
   *   email: 'user@example.com',
   *   details: { reason: 'Invalid password', attempts: 3 }
   * });
   */
  static async logEvent(options: SecurityEventOptions): Promise<void> {
    try {
      const { type, severity, req, userId, email, details = {} } = options;

      // Build security event object
      const event: ISecurityEvent = {
        type,
        severity,
        timestamp: new Date(),
        ip: SecurityEventService.extractIP(req),
        userAgent: req?.headers['user-agent'] || null,
        userId: userId || (req as any)?.user?.id || null,
        email: email || (req as any)?.user?.email || null,
        requestPath: req?.path,
        requestMethod: req?.method,
        origin: req?.headers.origin || null,
        details,
      };

      // Always log to console with appropriate level
      const logFn = SecurityEventService.getLogFunction(severity);
      logFn('[SecurityEvent]', {
        type: event.type,
        severity: event.severity,
        ip: event.ip,
        userId: event.userId,
        path: event.requestPath,
        details: event.details,
      });

      // Persist to database if severity meets threshold
      if (SecurityEventService.shouldPersist(severity)) {
        await SecurityEventService.persistEvent(event);
      }

      // Trigger alerts for critical events
      if (severity === SecuritySeverity.CRITICAL) {
        SecurityEventService.triggerAlert(event);
      }
    } catch (error) {
      // Never let logging failures crash the application
      logger.error('[SecurityEventService] Failed to log security event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: options.type,
      });
    }
  }

  /**
   * Extract IP address from request with proxy support
   */
  private static extractIP(req?: Request): string | null {
    if (!req) return null;

    // Trust proxy should be configured in Express
    return req.ip || req.socket?.remoteAddress || null;
  }

  /**
   * Get appropriate log function based on severity
   */
  private static getLogFunction(
    severity: SecuritySeverity
  ): (message: string, meta?: Record<string, unknown>) => void {
    switch (severity) {
      case SecuritySeverity.CRITICAL:
        return (msg, meta) => logger.error(msg, meta);
      case SecuritySeverity.HIGH:
        return (msg, meta) => logger.error(msg, meta);
      case SecuritySeverity.MEDIUM:
        return (msg, meta) => logger.warn(msg, meta);
      case SecuritySeverity.LOW:
      default:
        return (msg, meta) => logger.info(msg, meta);
    }
  }

  /**
   * Check if event should be persisted to database
   */
  private static shouldPersist(severity: SecuritySeverity): boolean {
    return SEVERITY_LEVELS[severity] >= SEVERITY_LEVELS[MIN_PERSIST_SEVERITY];
  }

  /**
   * Persist security event to database
   */
  private static async persistEvent(event: ISecurityEvent): Promise<void> {
    try {
      // Use Prisma to store the event in AuditLog table
      await prisma.auditLog.create({
        data: {
          userId: event.userId,
          action: `SECURITY:${event.type}`,
          entityType: 'SECURITY_EVENT',
          entityId: null,
          oldValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
          metadata: {
            severity: event.severity,
            ip: event.ip,
            userAgent: event.userAgent,
            email: event.email,
            requestPath: event.requestPath,
            requestMethod: event.requestMethod,
            origin: event.origin,
            details: event.details,
          } as Prisma.InputJsonValue,
          ipAddress: event.ip,
          userAgent: event.userAgent,
        },
      });
    } catch (error) {
      logger.error('[SecurityEventService] Failed to persist event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventType: event.type,
      });
    }
  }

  /**
   * Trigger alert for critical security events
   * Can be extended to send notifications, webhooks, etc.
   */
  private static triggerAlert(event: ISecurityEvent): void {
    logger.error('[SECURITY ALERT]', {
      type: event.type,
      severity: 'CRITICAL',
      timestamp: event.timestamp.toISOString(),
      ip: event.ip,
      userId: event.userId,
      details: event.details,
      message: 'Critical security event detected - immediate attention required',
    });

    // TODO: In production, integrate with:
    // - PagerDuty/OpsGenie for on-call alerts
    // - Slack/Teams webhook for security channel
    // - SIEM integration (Splunk, Datadog, etc.)
  }

  // ============================================================================
  // Convenience Methods for Common Events
  // ============================================================================

  /**
   * Log failed authentication attempt
   */
  static async logAuthFailure(
    req: Request,
    email: string,
    reason: string,
    attempts?: number
  ): Promise<void> {
    const severity = attempts && attempts >= 5 ? SecuritySeverity.HIGH : SecuritySeverity.MEDIUM;

    await SecurityEventService.logEvent({
      type: SecurityEventType.AUTH_FAILED,
      severity,
      req,
      email,
      details: { reason, attempts },
    });
  }

  /**
   * Log invalid token attempt
   */
  static async logTokenInvalid(req: Request, reason: string): Promise<void> {
    await SecurityEventService.logEvent({
      type: SecurityEventType.TOKEN_INVALID,
      severity: SecuritySeverity.MEDIUM,
      req,
      details: { reason },
    });
  }

  /**
   * Log CSRF protection trigger
   */
  static async logCSRFBlocked(req: Request): Promise<void> {
    await SecurityEventService.logEvent({
      type: SecurityEventType.CSRF_BLOCKED,
      severity: SecuritySeverity.HIGH,
      req,
      details: {
        origin: req.headers.origin,
        referer: req.headers.referer,
      },
    });
  }

  /**
   * Log rate limit violation
   */
  static async logRateLimitExceeded(req: Request, limiterName: string): Promise<void> {
    await SecurityEventService.logEvent({
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      severity: SecuritySeverity.MEDIUM,
      req,
      details: { limiter: limiterName },
    });
  }

  /**
   * Log CORS rejection
   */
  static async logCORSRejected(req: Request, origin: string): Promise<void> {
    await SecurityEventService.logEvent({
      type: SecurityEventType.CORS_REJECTED,
      severity: SecuritySeverity.MEDIUM,
      req,
      details: { rejectedOrigin: origin },
    });
  }

  /**
   * Log privilege escalation attempt
   */
  static async logPrivilegeEscalation(
    req: Request,
    attemptedAction: string,
    requiredRole: string
  ): Promise<void> {
    await SecurityEventService.logEvent({
      type: SecurityEventType.PRIVILEGE_ESCALATION,
      severity: SecuritySeverity.CRITICAL,
      req,
      details: { attemptedAction, requiredRole },
    });
  }

  /**
   * Log brute force detection
   */
  static async logBruteForceDetected(
    req: Request,
    targetEmail: string,
    attempts: number
  ): Promise<void> {
    await SecurityEventService.logEvent({
      type: SecurityEventType.BRUTE_FORCE_DETECTED,
      severity: SecuritySeverity.CRITICAL,
      req,
      details: { targetEmail, attempts },
    });
  }
}

// Import Prisma namespace for JSON null handling
import { Prisma } from '@prisma/client';

// Export singleton-style access for convenience
export const securityEvents = SecurityEventService;

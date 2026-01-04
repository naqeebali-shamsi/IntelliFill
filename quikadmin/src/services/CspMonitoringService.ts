/**
 * CSP Monitoring Service
 *
 * Task 282: Store and aggregate CSP violation reports for security monitoring.
 *
 * Features:
 * - Store CSP reports in database
 * - Aggregate reports by document-uri and blocked-uri
 * - Alert when violations exceed threshold
 *
 * @module services/CspMonitoringService
 */

import { prisma } from '../utils/prisma';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { SecurityEventService, SecurityEventType, SecuritySeverity } from './SecurityEventService';
import { Request } from 'express';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * CSP violation report from browser
 */
export interface CspViolationReport {
  'document-uri'?: string;
  'blocked-uri'?: string;
  'violated-directive'?: string;
  'effective-directive'?: string;
  'original-policy'?: string;
  'source-file'?: string;
  'line-number'?: number;
  'column-number'?: number;
  // Alternative format (newer browsers)
  documentURL?: string;
  blockedURL?: string;
  violatedDirective?: string;
  effectiveDirective?: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
}

/**
 * Normalized CSP report data
 */
export interface NormalizedCspReport {
  documentUri: string;
  blockedUri: string;
  violatedDirective: string;
  effectiveDirective?: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Aggregation result
 */
export interface CspAggregation {
  documentUri: string;
  blockedUri: string;
  violatedDirective: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // Alert threshold: trigger alert if more than X violations in Y minutes
  ALERT_THRESHOLD_COUNT: 50,
  ALERT_THRESHOLD_WINDOW_MINUTES: 15,
  // Cleanup: remove reports older than X days
  REPORT_RETENTION_DAYS: 30,
  // Max URI length to store (prevent DoS via long URIs)
  MAX_URI_LENGTH: 2000,
};

// ============================================================================
// CSP Monitoring Service
// ============================================================================

export class CspMonitoringService {
  /**
   * Normalize browser CSP report to consistent format
   */
  private normalizeReport(
    rawReport: CspViolationReport | { 'csp-report': CspViolationReport },
    req: Request
  ): NormalizedCspReport {
    // Handle both { 'csp-report': {...} } and direct report formats
    const report = 'csp-report' in rawReport ? rawReport['csp-report'] : rawReport;

    const truncate = (str: string | undefined, maxLen: number): string => {
      if (!str) return '';
      return str.length > maxLen ? str.substring(0, maxLen) : str;
    };

    return {
      documentUri: truncate(
        report['document-uri'] || report.documentURL || 'unknown',
        CONFIG.MAX_URI_LENGTH
      ),
      blockedUri: truncate(
        report['blocked-uri'] || report.blockedURL || 'unknown',
        CONFIG.MAX_URI_LENGTH
      ),
      violatedDirective: report['violated-directive'] || report.violatedDirective || 'unknown',
      effectiveDirective: report['effective-directive'] || report.effectiveDirective || undefined,
      sourceFile:
        truncate(report['source-file'] || report.sourceFile, CONFIG.MAX_URI_LENGTH) || undefined,
      lineNumber: report['line-number'] || report.lineNumber,
      columnNumber: report['column-number'] || report.columnNumber,
      userAgent: req.headers['user-agent']?.substring(0, 500),
      ipAddress: req.ip || undefined,
    };
  }

  /**
   * Save a CSP violation report to the database
   * Uses upsert to aggregate similar reports
   */
  async saveReport(
    rawReport: CspViolationReport | { 'csp-report': CspViolationReport },
    req: Request
  ): Promise<void> {
    try {
      const report = this.normalizeReport(rawReport, req);

      // Skip inline and eval violations (common and often benign)
      if (
        report.blockedUri === 'inline' ||
        report.blockedUri === 'eval' ||
        report.blockedUri === "'inline'" ||
        report.blockedUri === "'eval'"
      ) {
        logger.debug('[CSP] Skipping inline/eval violation', {
          violatedDirective: report.violatedDirective,
        });
        return;
      }

      // Check for existing report with same signature (aggregate)
      const existingReport = await prisma.cspReport.findFirst({
        where: {
          documentUri: report.documentUri,
          blockedUri: report.blockedUri,
          violatedDirective: report.violatedDirective,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingReport) {
        // Update existing aggregated report
        await prisma.cspReport.update({
          where: { id: existingReport.id },
          data: {
            count: existingReport.count + 1,
            lastSeen: new Date(),
            userAgent: report.userAgent || existingReport.userAgent,
            ipAddress: report.ipAddress || existingReport.ipAddress,
          },
        });

        logger.debug('[CSP] Updated aggregated report', {
          id: existingReport.id,
          count: existingReport.count + 1,
        });
      } else {
        // Create new report
        await prisma.cspReport.create({
          data: {
            documentUri: report.documentUri,
            blockedUri: report.blockedUri,
            violatedDirective: report.violatedDirective,
            effectiveDirective: report.effectiveDirective,
            sourceFile: report.sourceFile,
            lineNumber: report.lineNumber,
            columnNumber: report.columnNumber,
            userAgent: report.userAgent,
            ipAddress: report.ipAddress,
          },
        });

        logger.debug('[CSP] Created new report', {
          documentUri: report.documentUri,
          blockedUri: report.blockedUri,
        });
      }

      // Check if we need to send an alert
      await this.checkAlertThreshold(report, req);
    } catch (error) {
      logger.error('[CSP] Failed to save report', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - we don't want to break the CSP endpoint
    }
  }

  /**
   * Check if violations exceed alert threshold
   */
  private async checkAlertThreshold(report: NormalizedCspReport, req: Request): Promise<void> {
    try {
      const windowStart = new Date(Date.now() - CONFIG.ALERT_THRESHOLD_WINDOW_MINUTES * 60 * 1000);

      // Count violations for this document/blocked URI combination
      const recentViolations = await prisma.cspReport.aggregate({
        where: {
          documentUri: report.documentUri,
          blockedUri: report.blockedUri,
          createdAt: { gte: windowStart },
          alertSent: false,
        },
        _sum: { count: true },
      });

      const totalCount = recentViolations._sum.count || 0;

      if (totalCount >= CONFIG.ALERT_THRESHOLD_COUNT) {
        logger.error('[CSP] ALERT: High volume of CSP violations detected', {
          documentUri: report.documentUri,
          blockedUri: report.blockedUri,
          violationCount: totalCount,
          windowMinutes: CONFIG.ALERT_THRESHOLD_WINDOW_MINUTES,
        });

        // Log security event
        await SecurityEventService.logEvent({
          type: SecurityEventType.CSP_VIOLATION_SPIKE,
          severity: SecuritySeverity.HIGH,
          req,
          details: {
            documentUri: report.documentUri,
            blockedUri: report.blockedUri,
            violatedDirective: report.violatedDirective,
            violationCount: totalCount,
            windowMinutes: CONFIG.ALERT_THRESHOLD_WINDOW_MINUTES,
            alert: 'Possible XSS attack detected',
          },
        });

        // Mark reports as alerted to prevent duplicate alerts
        await prisma.cspReport.updateMany({
          where: {
            documentUri: report.documentUri,
            blockedUri: report.blockedUri,
            createdAt: { gte: windowStart },
            alertSent: false,
          },
          data: {
            alertSent: true,
            alertSentAt: new Date(),
          },
        });
      }
    } catch (error) {
      logger.error('[CSP] Failed to check alert threshold', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get aggregated CSP violations for monitoring dashboard
   */
  async getAggregatedViolations(options: {
    limit?: number;
    since?: Date;
  }): Promise<CspAggregation[]> {
    const { limit = 100, since = new Date(Date.now() - 24 * 60 * 60 * 1000) } = options;

    try {
      const reports = await prisma.cspReport.groupBy({
        by: ['documentUri', 'blockedUri', 'violatedDirective'],
        where: {
          createdAt: { gte: since },
        },
        _sum: { count: true },
        _min: { firstSeen: true },
        _max: { lastSeen: true },
        orderBy: { _sum: { count: 'desc' } },
        take: limit,
      });

      return reports.map((r) => ({
        documentUri: r.documentUri,
        blockedUri: r.blockedUri,
        violatedDirective: r.violatedDirective,
        count: r._sum.count || 0,
        firstSeen: r._min.firstSeen || new Date(),
        lastSeen: r._max.lastSeen || new Date(),
      }));
    } catch (error) {
      logger.error('[CSP] Failed to get aggregated violations', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get recent violation count for health checks
   */
  async getRecentViolationCount(windowMinutes: number = 60): Promise<number> {
    try {
      const since = new Date(Date.now() - windowMinutes * 60 * 1000);
      const result = await prisma.cspReport.aggregate({
        where: { createdAt: { gte: since } },
        _sum: { count: true },
      });
      return result._sum.count || 0;
    } catch (error) {
      logger.error('[CSP] Failed to get recent violation count', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Cleanup old reports (run periodically)
   */
  async cleanupOldReports(): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - CONFIG.REPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

      const result = await prisma.cspReport.deleteMany({
        where: { createdAt: { lt: cutoffDate } },
      });

      if (result.count > 0) {
        logger.info('[CSP] Cleaned up old reports', {
          deletedCount: result.count,
          retentionDays: CONFIG.REPORT_RETENTION_DAYS,
        });
      }

      return result.count;
    } catch (error) {
      logger.error('[CSP] Failed to cleanup old reports', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const cspMonitoringService = new CspMonitoringService();

export default cspMonitoringService;

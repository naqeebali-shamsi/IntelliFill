/**
 * Content Security Policy (CSP) Middleware
 *
 * Implements CSP headers to prevent XSS and data exfiltration attacks.
 * - Development: Allows 'unsafe-inline' and 'unsafe-eval' for Vite HMR
 * - Production: Strict policy with nonce-based script execution
 *
 * Task 273: Security Hardening - CSP Implementation
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';

// Extend Express Request to include CSP nonce

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      cspNonce?: string;
    }
  }
}

/**
 * CSP Directive Configuration
 */
interface CSPDirectives {
  'default-src': string[];
  'script-src': string[];
  'style-src': string[];
  'img-src': string[];
  'font-src': string[];
  'connect-src': string[];
  'frame-ancestors': string[];
  'form-action': string[];
  'base-uri': string[];
  'object-src': string[];
  'media-src'?: string[];
  'worker-src'?: string[];
  'child-src'?: string[];
  'report-uri'?: string[];
  'upgrade-insecure-requests'?: boolean;
}

/**
 * Generate a cryptographic nonce for script tags
 * Must be unique per request
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Development CSP configuration
 * More permissive to allow Vite HMR, hot reloading, and dev tools
 */
const devCSPDirectives: CSPDirectives = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for Vite HMR
    "'unsafe-eval'", // Required for Vite HMR source maps
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for CSS-in-JS and Tailwind
  ],
  'img-src': ["'self'", 'data:', 'https:', 'blob:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'ws://localhost:*', // Vite HMR WebSocket
    'http://localhost:*', // Local API calls
  ],
  'frame-ancestors': ["'none'"],
  'form-action': ["'self'"],
  'base-uri': ["'self'"],
  'object-src': ["'none'"],
  'worker-src': ["'self'", 'blob:'],
  'child-src': ["'self'", 'blob:'],
};

/**
 * Production CSP configuration
 * Strict policy - no unsafe-inline or unsafe-eval
 * Uses nonces for inline scripts
 */
const prodCSPDirectives: CSPDirectives = {
  'default-src': ["'self'"],
  'script-src': ["'self'"], // Nonce added dynamically
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Still needed for Tailwind/CSS-in-JS in production
  ],
  'img-src': ["'self'", 'data:', 'https:', 'blob:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://*.upstash.io', // Redis
  ],
  'frame-ancestors': ["'none'"],
  'form-action': ["'self'"],
  'base-uri': ["'self'"],
  'object-src': ["'none'"],
  'worker-src': ["'self'", 'blob:'],
  'child-src': ["'self'", 'blob:'],
  'report-uri': ['/api/csp-report'],
  'upgrade-insecure-requests': true,
};

/**
 * Build CSP header string from directives
 */
function buildCSPString(directives: CSPDirectives, nonce?: string): string {
  const parts: string[] = [];

  for (const [directive, values] of Object.entries(directives)) {
    if (directive === 'upgrade-insecure-requests') {
      if (values === true) {
        parts.push('upgrade-insecure-requests');
      }
      continue;
    }

    if (Array.isArray(values) && values.length > 0) {
      const directiveValues = [...values];

      // Add nonce to script-src in production
      if (directive === 'script-src' && nonce) {
        directiveValues.push(`'nonce-${nonce}'`);
      }

      parts.push(`${directive} ${directiveValues.join(' ')}`);
    }
  }

  return parts.join('; ');
}

/**
 * CSP Middleware Factory
 *
 * Creates middleware that sets appropriate CSP headers based on environment
 *
 * @param options - Configuration options
 * @returns Express middleware function
 */
export function cspMiddleware(options?: {
  reportOnly?: boolean;
  additionalDirectives?: Partial<CSPDirectives>;
}) {
  const { reportOnly = false, additionalDirectives = {} } = options || {};

  return (req: Request, res: Response, next: NextFunction) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const isTest = process.env.NODE_ENV === 'test';

    // Skip CSP in test mode to avoid interference with test frameworks
    if (isTest) {
      return next();
    }

    // Generate nonce for this request (used in production)
    const nonce = generateNonce();
    req.cspNonce = nonce;
    res.locals.cspNonce = nonce;

    // Select appropriate directives based on environment
    const baseDirectives = isProduction ? prodCSPDirectives : devCSPDirectives;

    // Merge with any additional directives
    const mergedDirectives: CSPDirectives = {
      ...baseDirectives,
    };

    // Merge additional directives (only string array directives)
    for (const [key, values] of Object.entries(additionalDirectives)) {
      if (Array.isArray(values)) {
        const directiveKey = key as keyof CSPDirectives;
        const existingValues = mergedDirectives[directiveKey];
        if (Array.isArray(existingValues)) {
          (mergedDirectives[directiveKey] as string[]) = [...existingValues, ...values];
        } else if (existingValues === undefined) {
          // New directive that wasn't in base
          (mergedDirectives as unknown as Record<string, string[]>)[key] = [...values];
        }
      }
    }

    // Build CSP string
    const cspString = buildCSPString(mergedDirectives, isProduction ? nonce : undefined);

    // Set appropriate header
    const headerName = reportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';

    res.setHeader(headerName, cspString);

    // Also expose nonce via header for SSR frameworks that need it
    if (isProduction) {
      res.setHeader('X-CSP-Nonce', nonce);
    }

    next();
  };
}

/**
 * CSP Violation Report Handler
 *
 * Endpoint to receive and log CSP violation reports from browsers
 * Should be mounted at /api/csp-report
 *
 * Task 282: Enhanced with database storage and aggregation
 */
export function cspReportHandler(req: Request, res: Response) {
  try {
    const report = req.body;

    // Log the violation for analysis
    logger.warn('CSP Violation Report', {
      documentUri: report?.['csp-report']?.['document-uri'] || report?.documentURL,
      blockedUri: report?.['csp-report']?.['blocked-uri'] || report?.blockedURL,
      violatedDirective:
        report?.['csp-report']?.['violated-directive'] || report?.violatedDirective,
      effectiveDirective:
        report?.['csp-report']?.['effective-directive'] || report?.effectiveDirective,
      originalPolicy:
        report?.['csp-report']?.['original-policy']?.substring(0, 200) || // Truncate long policies
        report?.originalPolicy?.substring(0, 200),
      sourceFile: report?.['csp-report']?.['source-file'] || report?.sourceFile,
      lineNumber: report?.['csp-report']?.['line-number'] || report?.lineNumber,
      columnNumber: report?.['csp-report']?.['column-number'] || report?.columnNumber,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    // Task 282: Save to database for aggregation and monitoring
    // Import dynamically to avoid circular dependencies
    import('../services/CspMonitoringService')
      .then(({ cspMonitoringService }) => {
        cspMonitoringService.saveReport(report, req).catch((err) => {
          logger.error('Failed to save CSP report to database', {
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        });
      })
      .catch((err) => {
        logger.error('Failed to load CSP monitoring service', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      });

    // Return 204 No Content as per CSP spec
    res.status(204).end();
  } catch (error) {
    logger.error('Error processing CSP report', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(204).end(); // Still return 204 to prevent retry loops
  }
}

/**
 * Get CSP nonce for use in templates/responses
 * Use this when rendering HTML that needs inline scripts
 */
export function getCSPNonce(req: Request): string | undefined {
  return req.cspNonce;
}

// Export default middleware instance
export default cspMiddleware();

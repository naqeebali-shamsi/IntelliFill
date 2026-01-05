/**
 * Security Middleware Collection
 * Enhanced security middleware implementations for Express.js
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';
// Note: helmet will be added in Phase 2 security hardening

/**
 * Async handler wrapper to eliminate try-catch boilerplate
 * Automatically catches errors and passes them to Express error handler
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Request context middleware for tracking and correlation
 * Adds unique request ID and timing information
 */
export const requestContext = (
  req: Request & { id?: string; timestamp?: number },
  res: Response,
  next: NextFunction
) => {
  req.id = crypto.randomUUID();
  req.timestamp = Date.now();

  // Add request ID to response headers for client correlation
  res.setHeader('X-Request-ID', req.id);

  // Track response time
  const startTime = process.hrtime.bigint();

  // Override writeHead to inject response time before headers are sent
  const originalWriteHead = res.writeHead;
  res.writeHead = function (this: Response, ...args: any[]): Response {
    const endTime = process.hrtime.bigint();
    const responseTime = Number((endTime - startTime) / BigInt(1000000)); // Convert to ms
    res.setHeader('X-Response-Time', `${responseTime}ms`);

    // Call original writeHead
    return originalWriteHead.apply(this, args);
  };

  next();
};

/**
 * Basic security headers middleware
 * Task 280: Environment-aware HSTS headers
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Basic security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  // Note: X-XSS-Protection header removed per modern security standards (2025).
  // This header is deprecated and can actually make XSS protection worse in some cases.
  // Modern browsers have disabled this feature and security tools like Helmet.js
  // explicitly don't set it anymore. Content-Security-Policy is the recommended approach.
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Task 280: Environment-aware HSTS configuration
  // - Production: 1 year max-age with includeSubDomains and preload
  // - Development: 1 hour max-age for testing (allows reverting if needed)
  // - Test: No HSTS to avoid complicating test environment
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  } else if (process.env.NODE_ENV !== 'test' && process.env.ENABLE_HSTS_DEV === 'true') {
    // Development HSTS - only enabled when explicitly requested and running HTTPS
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=3600' // 1 hour - short duration for development
    );
  }

  next();
};
// Basic security implementation - helmet configuration moved to Phase 2

// Task 302: Removed unused verifyRequestSignature utility

// Task 302: Removed unused compose utility

/**
 * Environment variable validation middleware
 * Ensures all required environment variables are set
 */
export const validateEnvironment = (requiredVars: string[]) => {
  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Additional validation for production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET === 'your-jwt-secret-key') {
      throw new Error('Default JWT secret detected in production!');
    }

    if (process.env.JWT_REFRESH_SECRET === 'your-jwt-refresh-secret-key') {
      throw new Error('Default refresh secret detected in production!');
    }
  }
};

/**
 * Response caching middleware
 * Adds cache headers for static responses
 */
export const cacheControl = (
  options: { maxAge?: number; public?: boolean; immutable?: boolean } = {}
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const {
      maxAge = 3600, // 1 hour default
      public: isPublic = true,
      immutable = false,
    } = options;

    const directives = [];
    directives.push(isPublic ? 'public' : 'private');
    directives.push(`max-age=${maxAge}`);

    if (immutable) {
      directives.push('immutable');
    }

    res.setHeader('Cache-Control', directives.join(', '));
    next();
  };
};

/**
 * Request sanitization middleware
 * Removes dangerous characters from request data
 * Logs a warning if sanitization modifies any data
 */
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction) => {
  let wasModified = false;

  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove null bytes and control characters
      // eslint-disable-next-line no-control-regex
      const sanitized = obj.replace(/\0/g, '').replace(/[\x00-\x1F\x7F]/g, '');
      if (sanitized !== obj) {
        wasModified = true;
      }
      return sanitized;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          // Sanitize key and value
          const sanitizedKey = sanitize(key);
          sanitized[sanitizedKey] = sanitize(obj[key]);
        }
      }
      return sanitized;
    }

    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }

  if (req.query) {
    req.query = sanitize(req.query) as any;
  }

  if (req.params) {
    req.params = sanitize(req.params) as any;
  }

  // Log warning if sanitization modified data (potential attack indicator)
  if (wasModified) {
    logger.warn('Request sanitization modified input data', {
      path: req.path,
      method: req.method,
      requestId: req.headers['x-request-id'] || 'N/A',
      ip: req.ip,
    });
  }

  next();
};

// Task 302: Removed unused performanceMonitor and AdaptiveRateLimiter utilities

/**
 * Security Middleware Collection
 * Enhanced security middleware implementations for Express.js
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
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
  res.setHeader('X-Response-Time', '0');

  // Track response time
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const responseTime = Number((endTime - startTime) / BigInt(1000000)); // Convert to ms
    res.setHeader('X-Response-Time', `${responseTime}ms`);
  });

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

/**
 * Request signature verification middleware
 * Validates HMAC signatures for API requests
 */
export const verifyRequestSignature = (secret: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const signature = req.headers['x-signature'] as string;
    const timestamp = req.headers['x-timestamp'] as string;

    if (!signature || !timestamp) {
      return res.status(401).json({ error: 'Missing signature headers' });
    }

    // Check timestamp to prevent replay attacks (5 minute window)
    const requestTime = parseInt(timestamp);
    const currentTime = Date.now();
    if (Math.abs(currentTime - requestTime) > 300000) {
      return res.status(401).json({ error: 'Request timestamp expired' });
    }

    // Verify HMAC signature
    const payload = `${timestamp}.${JSON.stringify(req.body)}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
  };
};

/**
 * Middleware composition utility
 * Combines multiple middleware into a single middleware function
 */
export const compose = (
  ...middlewares: Array<(req: Request, res: Response, next: NextFunction) => void>
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }
      index = i;

      const fn = middlewares[i];
      if (!fn) {
        return next();
      }

      try {
        await fn(req, res, () => dispatch(i + 1));
      } catch (err) {
        next(err);
      }
    };

    return dispatch(0);
  };
};

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
 */
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction) => {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove null bytes and control characters
      // eslint-disable-next-line no-control-regex
      return obj.replace(/\0/g, '').replace(/[\x00-\x1F\x7F]/g, '');
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

  next();
};

/**
 * Performance monitoring middleware
 * Tracks slow requests and logs performance metrics
 */
export const performanceMonitor = (threshold: number = 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;

      if (duration > threshold) {
        console.warn(`Slow request detected: ${req.method} ${req.path} took ${duration}ms`);
      }

      // Log metrics (integrate with your metrics service)
      const metrics = {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        timestamp: new Date().toISOString(),
      };

      // Example: Send to monitoring service
      // metricsService.record(metrics);
    });

    next();
  };
};

/**
 * IP-based rate limiting with exponential backoff
 * More sophisticated than basic rate limiting
 */
export class AdaptiveRateLimiter {
  private attempts: Map<string, { count: number; resetTime: number; backoffLevel: number }> =
    new Map();

  constructor(
    private windowMs: number = 60000,
    private maxAttempts: number = 10,
    private backoffMultiplier: number = 2
  ) {}

  middleware = (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();

    let record = this.attempts.get(ip);

    if (!record || record.resetTime < now) {
      // Create new record or reset expired one
      record = {
        count: 1,
        resetTime: now + this.windowMs,
        backoffLevel: 0,
      };
      this.attempts.set(ip, record);
      return next();
    }

    record.count++;

    if (record.count > this.maxAttempts) {
      // Apply exponential backoff
      record.backoffLevel++;
      const backoffTime = this.windowMs * Math.pow(this.backoffMultiplier, record.backoffLevel);
      record.resetTime = now + backoffTime;

      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());

      return res.status(429).json({
        error: 'Too many requests',
        retryAfter,
        message: `Please retry after ${retryAfter} seconds`,
      });
    }

    next();
  };

  // Cleanup old records periodically
  cleanup() {
    const now = Date.now();
    for (const [ip, record] of this.attempts.entries()) {
      if (record.resetTime < now - this.windowMs * 10) {
        this.attempts.delete(ip);
      }
    }
  }
}

// Export a pre-configured instance
export const adaptiveRateLimiter = new AdaptiveRateLimiter();

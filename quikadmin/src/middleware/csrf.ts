import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

// Double-submit cookie pattern for CSRF protection
// No session dependency, simpler than csurf

interface CSRFRequest extends Request {
  csrfToken?: string;
}

// Generate secure random token
const generateToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Token cookie options
const COOKIE_OPTIONS = {
  httpOnly: false, // Must be readable by JS for double-submit
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 1000, // 1 hour
};

// Set CSRF token cookie
export const setCSRFToken = (req: CSRFRequest, res: Response, next: NextFunction) => {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Generate token if not present
  if (!req.cookies?.csrf_token) {
    const token = generateToken();
    res.cookie('csrf_token', token, COOKIE_OPTIONS);
    req.csrfToken = token;
  } else {
    req.csrfToken = req.cookies.csrf_token;
  }

  next();
};

// Verify CSRF token
export const verifyCSRFToken = (req: CSRFRequest, res: Response, next: NextFunction) => {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip for API endpoints that use JWT auth
  if (req.path.startsWith('/api/') && req.headers.authorization) {
    return next();
  }

  // Skip for auth API endpoints (login, register, demo, etc.)
  // These use JWT tokens which aren't vulnerable to CSRF attacks
  // and are protected by rate limiting instead
  if (req.path.startsWith('/api/auth/')) {
    return next();
  }

  // Skip for Stripe webhook - uses signature verification instead of CSRF
  if (req.path === '/api/stripe/webhook') {
    return next();
  }

  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.headers['x-csrf-token'] as string;
  const bodyToken = req.body?._csrf;

  const submittedToken = headerToken || bodyToken;

  // Verify tokens match
  if (!cookieToken || !submittedToken) {
    logger.warn('CSRF token missing', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    return res.status(403).json({ error: 'CSRF token missing' });
  }

  if (cookieToken !== submittedToken) {
    logger.warn('CSRF token mismatch', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
};

// Helper middleware to provide token to views
export const provideCSRFToken = (req: CSRFRequest, res: Response, next: NextFunction) => {
  // Make token available to response locals for rendering
  if (req.csrfToken) {
    res.locals.csrfToken = req.csrfToken;
  }
  next();
};

// Combined CSRF protection middleware
export const csrfProtection = [setCSRFToken, verifyCSRFToken, provideCSRFToken];

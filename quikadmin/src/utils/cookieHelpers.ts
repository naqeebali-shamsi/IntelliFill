/**
 * Cookie Helper Functions
 *
 * Shared utilities for managing httpOnly refresh token cookies.
 * Used by auth routes and user routes for consistent cookie handling.
 */

import { Request, Response } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

// Cookie domain for cross-subdomain sharing in production
const cookieDomain = isProduction && process.env.COOKIE_DOMAIN ? process.env.COOKIE_DOMAIN : undefined;

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Check if the request originates from localhost
 */
export function isLocalhostRequest(req: Request): boolean {
  const origin = req.headers.origin;
  if (origin) {
    try {
      const { hostname } = new URL(origin);
      if (LOCALHOST_HOSTNAMES.has(hostname)) {
        return true;
      }
    } catch {
      // Ignore malformed Origin headers
    }
  }
  return LOCALHOST_HOSTNAMES.has(req.hostname);
}

/**
 * Get environment-specific cookie options
 *
 * Production: secure, SameSite=None (required for cross-origin fetch)
 * Dev/Test/Local: not secure, SameSite=Lax (allows localhost)
 */
export function getCookieEnvOptions(req: Request): {
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  domain?: string;
} {
  const useLocalOptions = !isProduction || isLocalhostRequest(req);
  return {
    secure: !useLocalOptions,
    // SameSite=None required for cross-origin cookie sending (fetch/XHR) in production
    // Local/dev uses Lax to allow http://localhost without Secure cookies
    sameSite: useLocalOptions ? 'lax' : 'none',
    ...(useLocalOptions || !cookieDomain ? {} : { domain: cookieDomain }),
  };
}

/**
 * Get full refresh token cookie options
 */
export function getRefreshTokenCookieOptions(req: Request): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  maxAge: number;
  path: string;
  domain?: string;
} {
  return {
    httpOnly: true,
    ...getCookieEnvOptions(req),
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api', // Must cover all API endpoints including /api/realtime for SSE
  };
}

/**
 * Clear legacy cookie with old path (for migration from /api/auth to /api)
 */
export function clearLegacyCookie(req: Request, res: Response): void {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    ...getCookieEnvOptions(req),
    path: '/api/auth',
  });
}

/**
 * Set refresh token as httpOnly cookie
 */
export function setRefreshTokenCookie(req: Request, res: Response, refreshToken: string): void {
  // Clear legacy cookie path first to prevent conflicts
  clearLegacyCookie(req, res);
  res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions(req));
}

/**
 * Clear refresh token cookie
 *
 * Must match all options from getRefreshTokenCookieOptions (except expires/maxAge)
 * for clearCookie to work properly across all browsers.
 */
export function clearRefreshTokenCookie(req: Request, res: Response): void {
  const { maxAge: _maxAge, ...cookieOptions } = getRefreshTokenCookieOptions(req);
  res.clearCookie('refreshToken', cookieOptions);

  // Also clear legacy cookie path to prevent conflicts after path migration
  clearLegacyCookie(req, res);
}

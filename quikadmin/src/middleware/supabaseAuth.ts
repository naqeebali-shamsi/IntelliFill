/**
 * Supabase Authentication Middleware
 *
 * Phase 4 SDK Migration - Replaces custom JWT verification
 * Verifies Supabase-issued JWTs using server-side validation
 *
 * IMPORTANT: Always use getUser() (not getSession()) for server-side auth
 * See: https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { Request, Response, NextFunction } from 'express';
import { User } from '@supabase/supabase-js';
import { verifySupabaseToken } from '../utils/supabase';
import { prisma } from '../utils/prisma';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { recordRLSFailure } from '../services/health.service';

/**
 * Extended Request interface with Supabase user
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    supabaseUserId: string;
    firstName?: string;
    lastName?: string;
  };
  supabaseUser?: User;
  rlsContextSet?: boolean;
}

/** Database user selection fields */
const USER_SELECT_FIELDS = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  supabaseUserId: true,
  isActive: true,
} as const;

type DbUser = {
  id: string;
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  supabaseUserId: string | null;
  isActive: boolean;
};

/**
 * Extract and validate Bearer token from Authorization header
 * Returns null if invalid or missing
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  if (!token || token.trim() === '' || token.length < 20 || token.length > 2048) {
    return null;
  }

  return token;
}

/**
 * Build user object for request from database user
 */
function buildRequestUser(dbUser: DbUser, supabaseUserId: string): AuthenticatedRequest['user'] {
  return {
    id: dbUser.id,
    email: dbUser.email,
    role: dbUser.role,
    supabaseUserId: dbUser.supabaseUserId || supabaseUserId,
    firstName: dbUser.firstName || undefined,
    lastName: dbUser.lastName || undefined,
  };
}

/**
 * Set RLS context for database-level security
 * Returns true if successful, false otherwise
 */
async function setRLSContext(req: AuthenticatedRequest, userId: string): Promise<boolean> {
  try {
    await prisma.$executeRawUnsafe('SELECT set_user_context($1)', userId);
    return true;
  } catch (error) {
    logger.error('SECURITY: Failed to set RLS context', {
      userId,
      requestId: req.headers['x-request-id'] || 'N/A',
      path: req.path,
      method: req.method,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    recordRLSFailure();
    return false;
  }
}

/**
 * Authenticate request using Supabase JWT
 *
 * Extracts JWT from Authorization header, verifies with Supabase,
 * loads user profile from Prisma database
 */
export async function authenticateSupabase(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      });
      return;
    }

    const supabaseUser = await verifySupabaseToken(token);

    if (!supabaseUser) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
      return;
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: supabaseUser.id },
      select: USER_SELECT_FIELDS,
    });

    if (!dbUser) {
      logger.error(`User ${supabaseUser.id} authenticated with Supabase but not found in database`);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found in database',
      });
      return;
    }

    if (!dbUser.isActive) {
      logger.warn('Inactive user attempted access', { userId: dbUser.id });
      res.status(403).json({
        error: 'Forbidden',
        message: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED',
      });
      return;
    }

    req.user = buildRequestUser(dbUser, supabaseUser.id);
    req.supabaseUser = supabaseUser;
    req.rlsContextSet = await setRLSContext(req, dbUser.id);

    if (!req.rlsContextSet) {
      const shouldFailClosed = process.env.RLS_FAIL_CLOSED !== 'false';

      if (shouldFailClosed) {
        logger.error('SECURITY: RLS context failed - failing closed', { userId: dbUser.id });
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Security context initialization failed',
          code: 'RLS_CONTEXT_FAILED',
        });
        return;
      }

      logger.warn(
        'SECURITY: RLS context failed but RLS_FAIL_CLOSED=false - continuing with degraded security',
        { userId: dbUser.id }
      );
    }

    next();
  } catch (error: unknown) {
    logger.error('Supabase authentication error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
}

/**
 * Role-based authorization middleware for Supabase auth
 *
 * @param allowedRoles - Array of roles allowed to access the route
 * @returns Express middleware function
 */
export function authorizeSupabase(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    // Normalize role comparison (case-insensitive)
    const userRole = req.user.role.toUpperCase();
    const normalizedAllowedRoles = allowedRoles.map((r) => r.toUpperCase());

    if (!normalizedAllowedRoles.includes(userRole)) {
      logger.warn('Authorization failed: Insufficient permissions', {
        userId: req.user.id,
        userRole,
        requiredRoles: allowedRoles,
      });
      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication middleware
 * Attaches user if authenticated, but doesn't fail if not
 */
export async function optionalAuthSupabase(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      next();
      return;
    }

    const supabaseUser = await verifySupabaseToken(token);

    if (!supabaseUser) {
      next();
      return;
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: supabaseUser.id },
      select: USER_SELECT_FIELDS,
    });

    if (!dbUser || !dbUser.isActive) {
      next();
      return;
    }

    req.rlsContextSet = await setRLSContext(req, dbUser.id);

    // SECURITY: Fail safe - do NOT attach user if RLS context failed
    // User continues as anonymous rather than with potentially insecure auth
    if (!req.rlsContextSet) {
      next();
      return;
    }

    req.user = buildRequestUser(dbUser, supabaseUser.id);
    req.supabaseUser = supabaseUser;

    next();
  } catch (error) {
    // Silent failure - continue without user
    if (isSuspiciousTokenError(error)) {
      logger.warn('Suspicious token in optional auth:', (error as Error).message);
    }
    next();
  }
}

/**
 * Check if error indicates a suspicious token manipulation attempt
 */
function isSuspiciousTokenError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message;
  return message.includes('algorithm') || message.includes('none') || message.includes('signature');
}

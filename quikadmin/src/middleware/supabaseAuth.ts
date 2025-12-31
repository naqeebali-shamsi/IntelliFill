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
  supabaseUser?: User; // Raw Supabase user object
}

/**
 * Authenticate request using Supabase JWT
 *
 * Extracts JWT from Authorization header, verifies with Supabase,
 * loads user profile from Prisma database
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export async function authenticateSupabase(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // SECURITY: Basic token format validation
    if (!token || token.trim() === '') {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided',
      });
      return;
    }

    // SECURITY: Check for suspicious tokens (too short/long)
    if (token.length < 20 || token.length > 2048) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Token length is invalid',
      });
      return;
    }

    // Verify token with Supabase (server-side validation)
    const supabaseUser = await verifySupabaseToken(token);

    if (!supabaseUser) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
      return;
    }

    // Load user profile from Prisma database
    const dbUser = await prisma.user.findUnique({
      where: { id: supabaseUser.id },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        supabaseUserId: true,
        isActive: true,
      },
    });

    if (!dbUser) {
      // User exists in Supabase but not in database
      // This could happen during migration or if user was deleted from Prisma
      logger.error(`User ${supabaseUser.id} authenticated with Supabase but not found in database`);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found in database',
      });
      return;
    }

    // SECURITY: Check if user account is active
    if (!dbUser.isActive) {
      logger.warn('Inactive user attempted access', { userId: dbUser.id });
      res.status(403).json({
        error: 'Forbidden',
        message: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED',
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      supabaseUserId: dbUser.supabaseUserId || supabaseUser.id,
      firstName: dbUser.firstName || undefined,
      lastName: dbUser.lastName || undefined,
    };

    req.supabaseUser = supabaseUser; // Raw Supabase user for advanced use cases

    // Set RLS user context for Row Level Security policies
    // This enables database-level data isolation (defense in depth)
    try {
      await prisma.$executeRawUnsafe('SELECT set_user_context($1)', dbUser.id);
    } catch (rlsError) {
      // Log but don't fail - application-level filtering still works
      logger.warn('Failed to set RLS context', { userId: dbUser.id, error: rlsError });
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
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export async function optionalAuthSupabase(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No auth header, continue without user
      next();
      return;
    }

    const token = authHeader.substring(7);

    // SECURITY: Basic validation even for optional auth
    if (!token || token.trim() === '' || token.length < 20 || token.length > 2048) {
      next();
      return;
    }

    const supabaseUser = await verifySupabaseToken(token);

    if (supabaseUser) {
      const dbUser = await prisma.user.findUnique({
        where: { id: supabaseUser.id },
        select: {
          id: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
          supabaseUserId: true,
          isActive: true,
        },
      });

      if (dbUser && dbUser.isActive) {
        req.user = {
          id: dbUser.id,
          email: dbUser.email,
          role: dbUser.role,
          supabaseUserId: dbUser.supabaseUserId || supabaseUser.id,
          firstName: dbUser.firstName || undefined,
          lastName: dbUser.lastName || undefined,
        };
        req.supabaseUser = supabaseUser;

        // Set RLS user context for optional auth as well
        try {
          await prisma.$executeRawUnsafe('SELECT set_user_context($1)', dbUser.id);
        } catch {
          // Silent failure for optional auth
        }
      }
    }

    next();
  } catch (error) {
    // Silent failure - continue without user
    // Log suspicious activity but don't block request
    if (
      error instanceof Error &&
      (error.message.includes('algorithm') ||
        error.message.includes('none') ||
        error.message.includes('signature'))
    ) {
      logger.warn('Suspicious token in optional auth:', error.message);
    }
    next();
  }
}

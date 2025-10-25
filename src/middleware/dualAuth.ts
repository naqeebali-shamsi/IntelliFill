/**
 * Dual Authentication Middleware
 *
 * Phase 4 SDK Migration - Transition Period Support
 * Supports both custom JWT and Supabase JWT during migration
 *
 * Flow:
 * 1. Try Supabase JWT first (new system)
 * 2. Fall back to custom JWT (legacy system)
 * 3. Fail if neither works
 */

import { Request, Response, NextFunction } from 'express';
import { authenticateSupabase, AuthenticatedRequest } from './supabaseAuth';
import { authenticate } from './auth'; // Legacy auth middleware
import { logger } from '../utils/logger';

/**
 * Dual authentication middleware
 * Tries Supabase auth first, falls back to custom JWT
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export async function dualAuthenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Track which auth method succeeded (for logging/metrics)
  let authMethod: 'supabase' | 'legacy' | 'failed' = 'failed';

  // Try Supabase authentication first
  const supabaseAuth = new Promise<boolean>((resolve) => {
    authenticateSupabase(req, res, (err?: any) => {
      if (err) {
        resolve(false);
      } else if (req.user) {
        authMethod = 'supabase';
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });

  const supabaseSuccess = await supabaseAuth;

  if (supabaseSuccess) {
    // Supabase auth succeeded
    logger.debug(`Dual auth: Supabase authentication succeeded for ${req.user?.email}`);
    next();
    return;
  }

  // Fall back to legacy JWT authentication
  logger.debug('Dual auth: Supabase authentication failed, trying legacy JWT');

  // Create a new response handler to capture legacy auth result
  const legacyAuthResult = new Promise<boolean>((resolve) => {
    authenticate(req, res, (err?: any) => {
      if (err) {
        resolve(false);
      } else if (req.user) {
        authMethod = 'legacy';
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });

  const legacySuccess = await legacyAuthResult;

  if (legacySuccess) {
    // Legacy auth succeeded
    logger.debug(`Dual auth: Legacy authentication succeeded for ${req.user?.email}`);
    next();
    return;
  }

  // Both methods failed - return 401
  logger.warn('Dual auth: Both Supabase and legacy authentication failed');
  res.status(401).json({
    error: 'Unauthorized',
    message: 'Authentication failed. Please login again.'
  });
}

/**
 * Dual authorization middleware
 * Works with both Supabase and custom JWT auth
 *
 * @param allowedRoles - Array of roles allowed to access the route
 * @returns Express middleware function
 */
export function dualAuthorize(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return;
    }

    // Normalize role comparison (case-insensitive)
    const userRole = req.user.role.toUpperCase();
    const normalizedAllowedRoles = allowedRoles.map(r => r.toUpperCase());

    if (!normalizedAllowedRoles.includes(userRole)) {
      logger.warn(`Dual authorization failed: User ${req.user.email} (${userRole}) attempted to access route requiring ${allowedRoles.join(', ')}`);
      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
      return;
    }

    next();
  };
}

/**
 * Optional dual authentication middleware
 * Tries both auth methods but doesn't fail if neither works
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export async function optionalDualAuth(
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

    // Try Supabase first
    const supabaseAuth = new Promise<boolean>((resolve) => {
      authenticateSupabase(req, res, (err?: any) => {
        if (!err && req.user) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });

    const supabaseSuccess = await supabaseAuth;

    if (supabaseSuccess) {
      next();
      return;
    }

    // Try legacy auth
    const legacyAuth = new Promise<boolean>((resolve) => {
      authenticate(req, res, (err?: any) => {
        if (!err && req.user) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });

    const legacySuccess = await legacyAuth;

    // Continue regardless of auth success (optional auth)
    next();
  } catch (error) {
    // Silent failure - continue without user
    next();
  }
}

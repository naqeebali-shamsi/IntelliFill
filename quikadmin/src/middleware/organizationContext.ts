/**
 * Organization Context Middleware
 *
 * Dedicated middleware for organizationId extraction, validation, and
 * consistent enforcement across org-scoped endpoints.
 *
 * Features:
 * - Extracts organization from authenticated user's profile
 * - Optional in-memory caching to reduce database lookups
 * - Configurable enforcement modes (required, optional)
 * - Consistent error responses
 * - Request correlation for debugging
 *
 * Usage:
 *   // Required organization context
 *   router.get('/endpoint', authenticateSupabase, requireOrganization, handler);
 *
 *   // Optional organization context (attaches if available)
 *   router.get('/endpoint', authenticateSupabase, optionalOrganization, handler);
 *
 * @module middleware/organizationContext
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './supabaseAuth';
import { prisma } from '../utils/prisma';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import {
  sendOrgContextError,
  sendCustomOrgError,
  OrgContextErrorKey,
} from './utils/orgContextErrors';
import { findActiveMembership } from './utils/membershipLookup';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Extended request interface with organization context
 */
export interface OrganizationRequest extends AuthenticatedRequest {
  organizationId?: string;
  organizationContext?: {
    id: string;
    name?: string;
    role?: string;
    permissions?: string[];
    cachedAt?: Date;
  };
}

interface CacheEntry {
  organizationId: string | null;
  organizationName?: string;
  role?: string;
  permissions?: string[];
  timestamp: number;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CACHE_TTL_MS = 60 * 1000; // 60 seconds (reduced from 5 min to limit stale access after role/member changes)
const MAX_CACHE_SIZE = 10000;

const config = {
  enableCache: process.env.ORG_CONTEXT_CACHE !== 'false',
  cacheTtlMs: parseInt(process.env.ORG_CONTEXT_CACHE_TTL || String(DEFAULT_CACHE_TTL_MS), 10),
  maxCacheSize: parseInt(process.env.ORG_CONTEXT_MAX_CACHE || String(MAX_CACHE_SIZE), 10),
};

// ============================================================================
// In-Memory Cache
// ============================================================================

const organizationCache = new Map<string, CacheEntry>();
const cacheStats = {
  hits: 0,
  misses: 0,
  evictions: 0,
};

/**
 * Get cached organization for user
 */
function getCachedOrganization(userId: string): CacheEntry | null {
  const entry = organizationCache.get(userId);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > config.cacheTtlMs) {
    organizationCache.delete(userId);
    return null;
  }

  cacheStats.hits++;
  return entry;
}

/**
 * Cache organization for user
 */
function setCachedOrganization(
  userId: string,
  organizationId: string | null,
  extras?: {
    organizationName?: string;
    role?: string;
    permissions?: string[];
  }
): void {
  if (organizationCache.size >= config.maxCacheSize) {
    const oldestKey = organizationCache.keys().next().value;
    if (oldestKey) {
      organizationCache.delete(oldestKey);
      cacheStats.evictions++;
    }
  }

  organizationCache.set(userId, {
    organizationId,
    organizationName: extras?.organizationName,
    role: extras?.role,
    permissions: extras?.permissions,
    timestamp: Date.now(),
  });
}

/**
 * Invalidate cached organization for user
 */
export function invalidateOrganizationCache(userId: string): void {
  organizationCache.delete(userId);
}

/**
 * Clear entire organization cache
 */
export function clearOrganizationCache(): void {
  organizationCache.clear();
  logger.info('[OrgContext] Cache cleared');
}

/**
 * Get cache statistics
 */
export function getOrganizationCacheStats(): {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
} {
  const total = cacheStats.hits + cacheStats.misses;
  return {
    size: organizationCache.size,
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    evictions: cacheStats.evictions,
    hitRate: total > 0 ? cacheStats.hits / total : 0,
  };
}

// ============================================================================
// Core Organization Lookup
// ============================================================================

/**
 * Fetch organization context from database
 */
async function fetchOrganizationContext(
  userId: string
): Promise<{ organizationId: string | null; organizationName?: string; role?: string } | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        organizationId: true,
        organization: { select: { name: true } },
        role: true,
      },
    });

    if (!user) return null;

    return {
      organizationId: user.organizationId,
      organizationName: user.organization?.name,
      role: user.role,
    };
  } catch (error) {
    logger.error('[OrgContext] Failed to fetch organization', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get organization context for user (with caching)
 */
async function getOrganizationForUser(userId: string): Promise<{
  organizationId: string | null;
  organizationName?: string;
  role?: string;
}> {
  if (config.enableCache) {
    const cached = getCachedOrganization(userId);
    if (cached) {
      logger.debug('[OrgContext] Cache hit', { userId });
      return {
        organizationId: cached.organizationId,
        organizationName: cached.organizationName,
        role: cached.role,
      };
    }
    cacheStats.misses++;
  }

  const context = await fetchOrganizationContext(userId);
  if (!context) {
    return { organizationId: null };
  }

  if (config.enableCache) {
    setCachedOrganization(userId, context.organizationId, {
      organizationName: context.organizationName,
      role: context.role,
    });
  }

  return context;
}

// ============================================================================
// Helper: Attach Organization Context to Request
// ============================================================================

function attachOrganizationContext(
  req: OrganizationRequest,
  organizationId: string,
  extras?: { name?: string; role?: string }
): void {
  req.organizationId = organizationId;
  req.organizationContext = {
    id: organizationId,
    name: extras?.name,
    role: extras?.role,
    cachedAt: new Date(),
  };
}

// ============================================================================
// Middleware Functions
// ============================================================================

/**
 * Require organization context middleware
 *
 * Ensures the authenticated user belongs to an organization.
 * Returns 403 if user has no organization association.
 */
export async function requireOrganization(
  req: OrganizationRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    const requestId = req.headers['x-request-id'] as string | undefined;

    if (!userId) {
      sendOrgContextError(res, 'AUTH_REQUIRED');
      return;
    }

    const context = await getOrganizationForUser(userId);

    if (!context.organizationId) {
      logger.warn('[OrgContext] User has no organization', { userId, requestId });
      sendOrgContextError(res, 'ORGANIZATION_REQUIRED');
      return;
    }

    attachOrganizationContext(req, context.organizationId, {
      name: context.organizationName,
      role: context.role,
    });

    // Set org context for RLS policies on knowledge base tables
    try {
      await prisma.$executeRawUnsafe('SELECT set_org_context($1)', context.organizationId);
    } catch (error) {
      logger.warn('[OrgContext] Failed to set RLS org context', {
        userId,
        organizationId: context.organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Non-fatal: application-level filtering still works as fallback
    }

    logger.debug('[OrgContext] Organization context attached', {
      userId,
      organizationId: context.organizationId,
      requestId,
    });

    next();
  } catch (error) {
    logger.error('[OrgContext] Middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });
    sendOrgContextError(res, 'ORG_CONTEXT_ERROR');
  }
}

/**
 * Optional organization context middleware
 *
 * Attaches organization context if available, but doesn't fail if missing.
 * Useful for endpoints that work with or without organization context.
 */
export async function optionalOrganization(
  req: OrganizationRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      next();
      return;
    }

    const context = await getOrganizationForUser(userId);

    if (context.organizationId) {
      attachOrganizationContext(req, context.organizationId, {
        name: context.organizationName,
        role: context.role,
      });
    }

    next();
  } catch (error) {
    logger.warn('[OrgContext] Optional organization lookup failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });
    next();
  }
}

/**
 * Validate specific organization ID middleware factory
 *
 * Ensures user belongs to the organization specified in the request.
 * Useful for endpoints that take organizationId as a parameter.
 *
 * @param source - Where to extract organizationId from ('params', 'query', 'body')
 * @param paramName - Name of the parameter (default: 'organizationId')
 */
export function validateOrganizationAccess(
  source: 'params' | 'query' | 'body' = 'params',
  paramName = 'organizationId'
) {
  return async (req: OrganizationRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        sendOrgContextError(res, 'AUTH_REQUIRED');
        return;
      }

      const targetOrgId =
        source === 'params'
          ? req.params[paramName]
          : source === 'query'
            ? (req.query[paramName] as string)
            : req.body[paramName];

      if (!targetOrgId) {
        sendCustomOrgError(
          res,
          400,
          'Bad Request',
          `Missing ${paramName} in ${source}`,
          'MISSING_ORG_ID'
        );
        return;
      }

      const context = await getOrganizationForUser(userId);

      if (!context.organizationId) {
        sendOrgContextError(res, 'NO_ORGANIZATION');
        return;
      }

      if (context.organizationId !== targetOrgId) {
        logger.warn('[OrgContext] Organization access denied', {
          userId,
          userOrgId: context.organizationId,
          targetOrgId,
        });
        sendOrgContextError(res, 'ORG_ACCESS_DENIED');
        return;
      }

      attachOrganizationContext(req, context.organizationId, {
        name: context.organizationName,
        role: context.role,
      });

      next();
    } catch (error) {
      logger.error('[OrgContext] Access validation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      sendOrgContextError(res, 'ORG_ACCESS_ERROR');
    }
  };
}

// ============================================================================
// Role-Based Middleware Factory
// ============================================================================

type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

interface RoleMiddlewareConfig {
  name: string;
  roleFilter?: MembershipRole[];
  permissionDeniedError: OrgContextErrorKey;
  internalError: OrgContextErrorKey;
}

/**
 * Factory function to create role-based organization membership middleware
 */
function createRoleMiddleware(config: RoleMiddlewareConfig) {
  return async (req: OrganizationRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const orgId = req.params.id;

      if (!userId) {
        sendOrgContextError(res, 'AUTH_REQUIRED');
        return;
      }

      if (!orgId) {
        sendOrgContextError(res, 'MISSING_ORG_ID');
        return;
      }

      const membership = await findActiveMembership(userId, orgId, config.roleFilter);

      if (!membership) {
        logger.warn(`[OrgContext] User is not a ${config.name} of organization`, { userId, orgId });
        sendOrgContextError(res, config.permissionDeniedError);
        return;
      }

      attachOrganizationContext(req, membership.organizationId, { role: membership.role });

      logger.debug(
        `[OrgContext] ${config.name.charAt(0).toUpperCase() + config.name.slice(1)} context attached`,
        {
          userId,
          orgId,
          role: membership.role,
        }
      );

      next();
    } catch (error) {
      logger.error(
        `[OrgContext] ${config.name.charAt(0).toUpperCase() + config.name.slice(1)} check error`,
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: req.user?.id,
        }
      );
      sendOrgContextError(res, config.internalError);
    }
  };
}

// ============================================================================
// Role-Based Middleware Exports
// ============================================================================

/**
 * Require organization member middleware
 *
 * Ensures the authenticated user is an ACTIVE member of the organization.
 * Attaches membership role to request for downstream authorization checks.
 *
 * Usage: router.get('/:id/members', authenticateSupabase, requireOrgMember, handler)
 */
export const requireOrgMember = createRoleMiddleware({
  name: 'member',
  roleFilter: undefined,
  permissionDeniedError: 'NOT_ORG_MEMBER',
  internalError: 'ORG_MEMBER_CHECK_ERROR',
});

/**
 * Require organization admin middleware
 *
 * Ensures the authenticated user is an ADMIN or OWNER of the organization.
 * Returns 403 if user is not an admin.
 *
 * Usage: router.patch('/:id/members/:userId', authenticateSupabase, requireOrgAdmin, handler)
 */
export const requireOrgAdmin = createRoleMiddleware({
  name: 'admin',
  roleFilter: ['OWNER', 'ADMIN'],
  permissionDeniedError: 'ADMIN_REQUIRED',
  internalError: 'ORG_ADMIN_CHECK_ERROR',
});

/**
 * Require organization owner middleware
 *
 * Ensures the authenticated user is an OWNER of the organization.
 * Returns 403 if user is not an owner.
 *
 * Usage: router.delete('/:id', authenticateSupabase, requireOrgOwner, handler)
 */
export const requireOrgOwner = createRoleMiddleware({
  name: 'owner',
  roleFilter: ['OWNER'],
  permissionDeniedError: 'OWNER_REQUIRED',
  internalError: 'ORG_OWNER_CHECK_ERROR',
});

// ============================================================================
// Exports
// ============================================================================

export default {
  requireOrganization,
  optionalOrganization,
  validateOrganizationAccess,
  requireOrgMember,
  requireOrgAdmin,
  requireOrgOwner,
  invalidateOrganizationCache,
  clearOrganizationCache,
  getOrganizationCacheStats,
};

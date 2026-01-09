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

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
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

  // Check if expired
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
  // Evict oldest entries if at capacity
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
        organization: {
          select: {
            name: true,
          },
        },
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
  // Check cache first
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

  // Fetch from database
  const context = await fetchOrganizationContext(userId);
  if (!context) {
    return { organizationId: null };
  }

  // Cache the result
  if (config.enableCache) {
    setCachedOrganization(userId, context.organizationId, {
      organizationName: context.organizationName,
      role: context.role,
    });
  }

  return context;
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
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const context = await getOrganizationForUser(userId);

    if (!context.organizationId) {
      logger.warn('[OrgContext] User has no organization', { userId, requestId });
      res.status(403).json({
        error: 'Forbidden',
        message: 'User must belong to an organization to access this resource',
        code: 'ORGANIZATION_REQUIRED',
      });
      return;
    }

    // Attach organization context to request
    req.organizationId = context.organizationId;
    req.organizationContext = {
      id: context.organizationId,
      name: context.organizationName,
      role: context.role,
      cachedAt: new Date(),
    };

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
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate organization context',
      code: 'ORG_CONTEXT_ERROR',
    });
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
      // No user, no organization - continue anyway
      next();
      return;
    }

    const context = await getOrganizationForUser(userId);

    if (context.organizationId) {
      req.organizationId = context.organizationId;
      req.organizationContext = {
        id: context.organizationId,
        name: context.organizationName,
        role: context.role,
        cachedAt: new Date(),
      };
    }

    next();
  } catch (error) {
    // Log but don't fail - optional means we continue even on error
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
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      // Extract target organization from request
      const targetOrgId =
        source === 'params'
          ? req.params[paramName]
          : source === 'query'
            ? (req.query[paramName] as string)
            : req.body[paramName];

      if (!targetOrgId) {
        res.status(400).json({
          error: 'Bad Request',
          message: `Missing ${paramName} in ${source}`,
          code: 'MISSING_ORG_ID',
        });
        return;
      }

      // Get user's organization
      const context = await getOrganizationForUser(userId);

      if (!context.organizationId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'User has no organization membership',
          code: 'NO_ORGANIZATION',
        });
        return;
      }

      // Validate access
      if (context.organizationId !== targetOrgId) {
        logger.warn('[OrgContext] Organization access denied', {
          userId,
          userOrgId: context.organizationId,
          targetOrgId,
        });
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied to this organization',
          code: 'ORG_ACCESS_DENIED',
        });
        return;
      }

      // Attach context
      req.organizationId = context.organizationId;
      req.organizationContext = {
        id: context.organizationId,
        name: context.organizationName,
        role: context.role,
        cachedAt: new Date(),
      };

      next();
    } catch (error) {
      logger.error('[OrgContext] Access validation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to validate organization access',
        code: 'ORG_ACCESS_ERROR',
      });
    }
  };
}

// ============================================================================
// Task 383: Member Authorization Middleware
// ============================================================================

/**
 * Require organization member middleware
 *
 * Ensures the authenticated user is an ACTIVE member of the organization.
 * Attaches membership role to request for downstream authorization checks.
 *
 * Usage: router.get('/:id/members', authenticateSupabase, requireOrgMember, handler)
 */
export async function requireOrgMember(
  req: OrganizationRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    const orgId = req.params.id;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    if (!orgId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Organization ID is required',
        code: 'MISSING_ORG_ID',
      });
      return;
    }

    // Check membership
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId: orgId,
        status: 'ACTIVE',
      },
      select: {
        role: true,
        organizationId: true,
      },
    });

    if (!membership) {
      logger.warn('[OrgContext] User is not a member of organization', { userId, orgId });
      res.status(403).json({
        error: 'Forbidden',
        message: 'You are not a member of this organization',
        code: 'NOT_ORG_MEMBER',
      });
      return;
    }

    // Attach membership context to request
    req.organizationId = membership.organizationId;
    req.organizationContext = {
      id: membership.organizationId,
      role: membership.role,
    };

    logger.debug('[OrgContext] Member context attached', {
      userId,
      orgId,
      role: membership.role,
    });

    next();
  } catch (error) {
    logger.error('[OrgContext] Member check error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate organization membership',
      code: 'ORG_MEMBER_CHECK_ERROR',
    });
  }
}

/**
 * Require organization admin middleware
 *
 * Ensures the authenticated user is an ADMIN or OWNER of the organization.
 * Returns 403 if user is not an admin.
 *
 * Usage: router.patch('/:id/members/:userId', authenticateSupabase, requireOrgAdmin, handler)
 */
export async function requireOrgAdmin(
  req: OrganizationRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    const orgId = req.params.id;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    if (!orgId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Organization ID is required',
        code: 'MISSING_ORG_ID',
      });
      return;
    }

    // Check membership and role
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId: orgId,
        status: 'ACTIVE',
        role: {
          in: ['OWNER', 'ADMIN'],
        },
      },
      select: {
        role: true,
        organizationId: true,
      },
    });

    if (!membership) {
      logger.warn('[OrgContext] User is not an admin of organization', { userId, orgId });
      res.status(403).json({
        error: 'Forbidden',
        message: 'You must be an admin or owner to perform this action',
        code: 'ADMIN_REQUIRED',
      });
      return;
    }

    // Attach membership context to request
    req.organizationId = membership.organizationId;
    req.organizationContext = {
      id: membership.organizationId,
      role: membership.role,
    };

    logger.debug('[OrgContext] Admin context attached', {
      userId,
      orgId,
      role: membership.role,
    });

    next();
  } catch (error) {
    logger.error('[OrgContext] Admin check error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate admin permissions',
      code: 'ORG_ADMIN_CHECK_ERROR',
    });
  }
}

/**
 * Require organization owner middleware
 *
 * Ensures the authenticated user is an OWNER of the organization.
 * Returns 403 if user is not an owner.
 *
 * Usage: router.delete('/:id', authenticateSupabase, requireOrgOwner, handler)
 */
export async function requireOrgOwner(
  req: OrganizationRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    const orgId = req.params.id;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    if (!orgId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Organization ID is required',
        code: 'MISSING_ORG_ID',
      });
      return;
    }

    // Check membership and role
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId: orgId,
        status: 'ACTIVE',
        role: 'OWNER',
      },
      select: {
        role: true,
        organizationId: true,
      },
    });

    if (!membership) {
      logger.warn('[OrgContext] User is not an owner of organization', { userId, orgId });
      res.status(403).json({
        error: 'Forbidden',
        message: 'You must be an owner to perform this action',
        code: 'OWNER_REQUIRED',
      });
      return;
    }

    // Attach membership context to request
    req.organizationId = membership.organizationId;
    req.organizationContext = {
      id: membership.organizationId,
      role: membership.role,
    };

    logger.debug('[OrgContext] Owner context attached', {
      userId,
      orgId,
      role: membership.role,
    });

    next();
  } catch (error) {
    logger.error('[OrgContext] Owner check error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate owner permissions',
      code: 'ORG_OWNER_CHECK_ERROR',
    });
  }
}

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

/**
 * E2E Test Routes
 *
 * Task 478: Add Seed Health Check Endpoint
 *
 * Test-only API endpoints for E2E testing infrastructure.
 * These routes are ONLY available when E2E_TEST_MODE=true or NODE_ENV=test
 *
 * Endpoints:
 * - GET /api/e2e/seed-status - Verify E2E test users are properly seeded
 *
 * @security These routes expose internal test data and must NEVER be enabled in production
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';

// Test mode check - matches the pattern in supabase-auth.routes.ts
const isTestMode = process.env.NODE_ENV === 'test' || process.env.E2E_TEST_MODE === 'true';

/**
 * E2E Test Users - MUST match quikadmin/scripts/seed-e2e-users.ts
 * and quikadmin-web/e2e/data/test-users.json
 */
const E2E_TEST_USER_EMAILS = [
  'test-admin@intellifill.local',
  'test-owner@intellifill.local',
  'test-member@intellifill.local',
  'test-viewer@intellifill.local',
  'test-password-reset@intellifill.local',
];

/**
 * User status for seed health check response
 */
interface UserSeedStatus {
  email: string;
  exists: boolean;
  hasValidHash: boolean;
  hasMembership: boolean;
}

/**
 * Seed health check response
 */
interface SeedHealthResponse {
  healthy: boolean;
  users: UserSeedStatus[];
  errors: string[];
}

/**
 * Validates that a password hash is valid bcrypt format
 * bcrypt hashes start with $2a$, $2b$, or $2y$ followed by cost factor
 */
function isValidBcryptHash(hash: string | null): boolean {
  if (!hash) return false;
  // bcrypt hash format: $2a$12$... or $2b$12$... or $2y$12$...
  // The hash should be 60 characters long
  const bcryptPattern = /^\$2[aby]\$\d{2}\$.{53}$/;
  return bcryptPattern.test(hash);
}

/**
 * Create E2E routes
 *
 * @returns Router instance with E2E test endpoints
 * @throws Error if called in production mode
 */
export function createE2ERoutes(): Router {
  const router = Router();

  // Safety check - this should never be called in production
  // but we double-check as a defense-in-depth measure
  if (!isTestMode) {
    logger.error('E2E routes creation attempted in non-test mode - this should not happen');
    throw new Error('E2E routes cannot be created in production mode');
  }

  /**
   * GET /api/e2e/seed-status
   *
   * Health check endpoint that verifies E2E test users are properly seeded.
   * Returns detailed status for each test user including:
   * - Whether the user exists in the database
   * - Whether the password hash is valid bcrypt format
   * - Whether the user has an organization membership
   *
   * @returns {SeedHealthResponse} JSON response with overall health and per-user status
   */
  router.get('/seed-status', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const userStatuses: UserSeedStatus[] = [];
      const errors: string[] = [];

      for (const email of E2E_TEST_USER_EMAILS) {
        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            memberships: {
              where: { status: 'ACTIVE' },
              take: 1,
            },
          },
        });

        if (!user) {
          userStatuses.push({
            email,
            exists: false,
            hasValidHash: false,
            hasMembership: false,
          });
          errors.push(`User not found: ${email}`);
          continue;
        }

        const hasValidHash = isValidBcryptHash(user.password);
        const hasMembership = user.memberships && user.memberships.length > 0;

        if (!hasValidHash) {
          errors.push(`Invalid password hash for ${email}`);
        }
        if (!hasMembership) {
          errors.push(`No organization membership for ${email}`);
        }

        userStatuses.push({
          email,
          exists: true,
          hasValidHash,
          hasMembership,
        });
      }

      // Overall health: all users exist, have valid hashes, and have memberships
      const healthy = userStatuses.every(
        (status) => status.exists && status.hasValidHash && status.hasMembership
      );

      const response: SeedHealthResponse = {
        healthy,
        users: userStatuses,
        errors,
      };

      // Use appropriate status code
      const statusCode = healthy ? 200 : 503;
      res.status(statusCode).json(response);
    } catch (error) {
      logger.error('E2E seed status check failed', { error });
      next(error);
    }
  });

  return router;
}

/**
 * Guard function to check if E2E routes should be enabled
 * Use this in the main routes.ts before registering E2E routes
 */
export function isE2ETestMode(): boolean {
  return isTestMode;
}

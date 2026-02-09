/**
 * Supabase Authentication Middleware Tests
 *
 * Tests JWT verification, user loading, and authorization
 */

import { Request, Response } from 'express';

// Mock dependencies BEFORE imports
jest.mock('../../src/utils/supabase', () => ({
  verifySupabaseToken: jest.fn(),
  supabase: {},
  supabaseAdmin: {},
}));
jest.mock('../../src/utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    $executeRawUnsafe: jest.fn(),
  },
}));
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}));
jest.mock('../../src/utils/piiSafeLogger', () => ({
  piiSafeLogger: {
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}));
jest.mock('../../src/services/health.service', () => ({
  recordRLSFailure: jest.fn(),
}));

// Now import after mocks are set up
import {
  authenticateSupabase,
  authorizeSupabase,
  optionalAuthSupabase,
} from '../../src/middleware/supabaseAuth';
import { verifySupabaseToken } from '../../src/utils/supabase';
import { prisma } from '../../src/utils/prisma';
import { piiSafeLogger } from '../../src/utils/piiSafeLogger';
import { recordRLSFailure } from '../../src/services/health.service';

describe('Supabase Authentication Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(), // Return this to allow chaining
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateSupabase', () => {
    it('should authenticate valid Supabase JWT', async () => {
      // Mock valid token (needs to be >= 20 chars)
      req.headers = {
        authorization: 'Bearer valid-supabase-token-12345678',
      };

      const mockSupabaseUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const mockDbUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        firstName: 'Test',
        lastName: 'User',
        supabaseUserId: 'user-123',
        isActive: true,
      };

      (verifySupabaseToken as jest.Mock).mockResolvedValue(mockSupabaseUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockDbUser);

      await authenticateSupabase(req as any, res as any, next);

      expect(verifySupabaseToken).toHaveBeenCalledWith('valid-supabase-token-12345678');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
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
      expect((req as any).user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        supabaseUserId: 'user-123',
        firstName: 'Test',
        lastName: 'User',
      });
      expect((req as any).supabaseUser).toEqual(mockSupabaseUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject missing Authorization header', async () => {
      req.headers = {};

      await authenticateSupabase(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid Bearer token format', async () => {
      req.headers = {
        authorization: 'InvalidFormat token',
      };

      await authenticateSupabase(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject empty token', async () => {
      req.headers = {
        authorization: 'Bearer ',
      };

      await authenticateSupabase(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject token that is too short', async () => {
      req.headers = {
        authorization: 'Bearer short',
      };

      await authenticateSupabase(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject token that is too long', async () => {
      req.headers = {
        authorization: 'Bearer ' + 'x'.repeat(2100),
      };

      await authenticateSupabase(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      req.headers = {
        authorization: 'Bearer invalid-token-but-correct-length-xxxx',
      };

      (verifySupabaseToken as jest.Mock).mockResolvedValue(null);

      await authenticateSupabase(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject user not in database', async () => {
      req.headers = {
        authorization: 'Bearer valid-token-but-no-db-user-xxx',
      };

      const mockSupabaseUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      (verifySupabaseToken as jest.Mock).mockResolvedValue(mockSupabaseUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await authenticateSupabase(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'User not found in database',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject inactive user', async () => {
      req.headers = {
        authorization: 'Bearer valid-token-inactive-user-xxx',
      };

      const mockSupabaseUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const mockDbUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        firstName: 'Test',
        lastName: 'User',
        supabaseUserId: 'user-123',
        isActive: false, // Inactive user
      };

      (verifySupabaseToken as jest.Mock).mockResolvedValue(mockSupabaseUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockDbUser);

      await authenticateSupabase(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle internal errors gracefully', async () => {
      req.headers = {
        authorization: 'Bearer valid-token-with-error-xxxxx',
      };

      (verifySupabaseToken as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      await authenticateSupabase(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Authentication failed',
      });
      expect(next).not.toHaveBeenCalled();
    });

    describe('RLS Fail-Closed Security (Task 290)', () => {
      beforeEach(() => {
        // Clear environment variable before each test
        delete process.env.RLS_FAIL_CLOSED;
      });

      afterEach(() => {
        // Clean up after each test
        delete process.env.RLS_FAIL_CLOSED;
      });

      it('should proceed normally when RLS context succeeds', async () => {
        req.headers = {
          authorization: 'Bearer valid-token-rls-success-xxxxx',
        };

        const mockSupabaseUser = {
          id: 'user-123',
          email: 'test@example.com',
        };

        const mockDbUser = {
          id: 'user-123',
          email: 'test@example.com',
          role: 'USER',
          firstName: 'Test',
          lastName: 'User',
          supabaseUserId: 'user-123',
          isActive: true,
        };

        (verifySupabaseToken as jest.Mock).mockResolvedValue(mockSupabaseUser);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockDbUser);
        // Mock successful RLS context setup
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        await authenticateSupabase(req as any, res as any, next);

        expect((req as any).rlsContextSet).toBe(true);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should reject with 500 when RLS fails and RLS_FAIL_CLOSED is not set (default)', async () => {
        req.headers = {
          authorization: 'Bearer valid-token-rls-fail-default-xxx',
        };
        req.path = '/api/documents';
        req.method = 'GET';
        req.headers['x-request-id'] = 'test-request-123';

        const mockSupabaseUser = {
          id: 'user-123',
          email: 'test@example.com',
        };

        const mockDbUser = {
          id: 'user-123',
          email: 'test@example.com',
          role: 'USER',
          firstName: 'Test',
          lastName: 'User',
          supabaseUserId: 'user-123',
          isActive: true,
        };

        (verifySupabaseToken as jest.Mock).mockResolvedValue(mockSupabaseUser);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockDbUser);
        // Mock RLS context failure
        (prisma.$executeRawUnsafe as jest.Mock).mockRejectedValue(
          new Error('RLS function not found')
        );

        await authenticateSupabase(req as any, res as any, next);

        // Should fail closed by default
        expect((req as any).rlsContextSet).toBe(false);
        expect(recordRLSFailure).toHaveBeenCalled();
        expect(piiSafeLogger.error).toHaveBeenCalledWith(
          'SECURITY: Failed to set RLS context',
          expect.objectContaining({
            userId: 'user-123',
            requestId: 'test-request-123',
            path: '/api/documents',
            method: 'GET',
          })
        );
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Internal Server Error',
          message: 'Security context initialization failed',
          code: 'RLS_CONTEXT_FAILED',
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should reject with 500 when RLS fails and RLS_FAIL_CLOSED=true', async () => {
        process.env.RLS_FAIL_CLOSED = 'true';

        req.headers = {
          authorization: 'Bearer valid-token-rls-fail-explicit-xxx',
        };
        req.path = '/api/profile';
        req.method = 'PUT';

        const mockSupabaseUser = {
          id: 'user-456',
          email: 'admin@example.com',
        };

        const mockDbUser = {
          id: 'user-456',
          email: 'admin@example.com',
          role: 'ADMIN',
          firstName: 'Admin',
          lastName: 'User',
          supabaseUserId: 'user-456',
          isActive: true,
        };

        (verifySupabaseToken as jest.Mock).mockResolvedValue(mockSupabaseUser);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockDbUser);
        // Mock RLS context failure
        (prisma.$executeRawUnsafe as jest.Mock).mockRejectedValue(new Error('Database error'));

        await authenticateSupabase(req as any, res as any, next);

        // Should fail closed explicitly
        expect((req as any).rlsContextSet).toBe(false);
        expect(recordRLSFailure).toHaveBeenCalled();
        expect(piiSafeLogger.error).toHaveBeenCalledWith(
          'SECURITY: Failed to set RLS context',
          expect.any(Object)
        );
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Internal Server Error',
          message: 'Security context initialization failed',
          code: 'RLS_CONTEXT_FAILED',
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should warn and continue when RLS fails and RLS_FAIL_CLOSED=false', async () => {
        process.env.RLS_FAIL_CLOSED = 'false';

        req.headers = {
          authorization: 'Bearer valid-token-rls-fail-open-xxxxx',
        };

        const mockSupabaseUser = {
          id: 'user-789',
          email: 'devmode@example.com',
        };

        const mockDbUser = {
          id: 'user-789',
          email: 'devmode@example.com',
          role: 'USER',
          firstName: 'Dev',
          lastName: 'User',
          supabaseUserId: 'user-789',
          isActive: true,
        };

        (verifySupabaseToken as jest.Mock).mockResolvedValue(mockSupabaseUser);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockDbUser);
        // Mock RLS context failure
        (prisma.$executeRawUnsafe as jest.Mock).mockRejectedValue(new Error('RLS setup failed'));

        await authenticateSupabase(req as any, res as any, next);

        // Should continue with degraded security
        expect((req as any).rlsContextSet).toBe(false);
        expect(recordRLSFailure).toHaveBeenCalled();
        expect(piiSafeLogger.error).toHaveBeenCalledWith(
          'SECURITY: Failed to set RLS context',
          expect.any(Object)
        );
        expect(piiSafeLogger.warn).toHaveBeenCalledWith(
          'SECURITY: RLS context failed but RLS_FAIL_CLOSED=false - continuing with degraded security',
          expect.objectContaining({ userId: 'user-789' })
        );
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should include error code RLS_CONTEXT_FAILED in response', async () => {
        req.headers = {
          authorization: 'Bearer valid-token-check-error-code-xxx',
        };

        const mockSupabaseUser = {
          id: 'user-check',
          email: 'check@example.com',
        };

        const mockDbUser = {
          id: 'user-check',
          email: 'check@example.com',
          role: 'USER',
          firstName: 'Check',
          lastName: 'User',
          supabaseUserId: 'user-check',
          isActive: true,
        };

        (verifySupabaseToken as jest.Mock).mockResolvedValue(mockSupabaseUser);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockDbUser);
        (prisma.$executeRawUnsafe as jest.Mock).mockRejectedValue(new Error('RLS error'));

        await authenticateSupabase(req as any, res as any, next);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'RLS_CONTEXT_FAILED',
          })
        );
      });

      it('should log at ERROR level when failing closed', async () => {
        req.headers = {
          authorization: 'Bearer valid-token-error-level-xxxxx',
        };

        const mockSupabaseUser = {
          id: 'user-log',
          email: 'log@example.com',
        };

        const mockDbUser = {
          id: 'user-log',
          email: 'log@example.com',
          role: 'USER',
          firstName: 'Log',
          lastName: 'User',
          supabaseUserId: 'user-log',
          isActive: true,
        };

        (verifySupabaseToken as jest.Mock).mockResolvedValue(mockSupabaseUser);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockDbUser);
        (prisma.$executeRawUnsafe as jest.Mock).mockRejectedValue(new Error('RLS failure'));

        await authenticateSupabase(req as any, res as any, next);

        // Verify ERROR level logging (not WARN)
        expect(piiSafeLogger.error).toHaveBeenCalledWith(
          'SECURITY: Failed to set RLS context',
          expect.objectContaining({
            userId: 'user-log',
            error: 'RLS failure',
          })
        );
      });
    });
  });

  describe('authorizeSupabase', () => {
    it('should allow user with correct role', () => {
      (req as any).user = {
        id: 'user-123',
        email: 'admin@example.com',
        role: 'ADMIN',
      };

      const middleware = authorizeSupabase(['admin']);
      middleware(req as any, res as any, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow user with role in mixed case', () => {
      (req as any).user = {
        id: 'user-123',
        email: 'admin@example.com',
        role: 'Admin', // Mixed case
      };

      const middleware = authorizeSupabase(['ADMIN']); // Upper case
      middleware(req as any, res as any, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow user with one of multiple allowed roles', () => {
      (req as any).user = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'USER',
      };

      const middleware = authorizeSupabase(['admin', 'user']);
      middleware(req as any, res as any, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject user without authentication', () => {
      // No req.user set
      const middleware = authorizeSupabase(['admin']);
      middleware(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject user with wrong role', () => {
      (req as any).user = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'USER',
      };

      const middleware = authorizeSupabase(['admin']);
      middleware(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuthSupabase', () => {
    it('should attach user if valid token provided', async () => {
      req.headers = {
        authorization: 'Bearer valid-optional-token-xxxxxxxxx',
      };

      const mockSupabaseUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const mockDbUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        firstName: 'Test',
        lastName: 'User',
        supabaseUserId: 'user-123',
        isActive: true,
      };

      (verifySupabaseToken as jest.Mock).mockResolvedValue(mockSupabaseUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockDbUser);
      // Mock successful RLS context setup
      (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

      await optionalAuthSupabase(req as any, res as any, next);

      expect((req as any).user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        supabaseUserId: 'user-123',
        firstName: 'Test',
        lastName: 'User',
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should continue without user if no token provided', async () => {
      req.headers = {};

      await optionalAuthSupabase(req as any, res as any, next);

      expect((req as any).user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should continue without user if invalid token provided', async () => {
      req.headers = {
        authorization: 'Bearer invalid-optional-token-xxxx',
      };

      (verifySupabaseToken as jest.Mock).mockResolvedValue(null);

      await optionalAuthSupabase(req as any, res as any, next);

      expect((req as any).user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should continue without user if token too short', async () => {
      req.headers = {
        authorization: 'Bearer short',
      };

      await optionalAuthSupabase(req as any, res as any, next);

      expect((req as any).user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(verifySupabaseToken).not.toHaveBeenCalled();
    });

    it('should continue without user if user not in database', async () => {
      req.headers = {
        authorization: 'Bearer valid-token-no-db-user-xxxxxx',
      };

      const mockSupabaseUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      (verifySupabaseToken as jest.Mock).mockResolvedValue(mockSupabaseUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await optionalAuthSupabase(req as any, res as any, next);

      expect((req as any).user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should continue without user if user is inactive', async () => {
      req.headers = {
        authorization: 'Bearer valid-token-inactive-xxxxxxxxx',
      };

      const mockSupabaseUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const mockDbUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        firstName: 'Test',
        lastName: 'User',
        supabaseUserId: 'user-123',
        isActive: false,
      };

      (verifySupabaseToken as jest.Mock).mockResolvedValue(mockSupabaseUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockDbUser);

      await optionalAuthSupabase(req as any, res as any, next);

      expect((req as any).user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully and continue', async () => {
      req.headers = {
        authorization: 'Bearer token-with-error-xxxxxxxxxxx',
      };

      (verifySupabaseToken as jest.Mock).mockRejectedValue(new Error('Network error'));

      await optionalAuthSupabase(req as any, res as any, next);

      expect((req as any).user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    describe('RLS Fail-Safe Security in Optional Auth', () => {
      it('should proceed with user when RLS context succeeds', async () => {
        req.headers = {
          authorization: 'Bearer optional-token-rls-success-xxx',
        };

        const mockSupabaseUser = {
          id: 'user-rls-ok',
          email: 'rlsok@example.com',
        };

        const mockDbUser = {
          id: 'user-rls-ok',
          email: 'rlsok@example.com',
          role: 'USER',
          firstName: 'RLS',
          lastName: 'Success',
          supabaseUserId: 'user-rls-ok',
          isActive: true,
        };

        (verifySupabaseToken as jest.Mock).mockResolvedValue(mockSupabaseUser);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockDbUser);
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        await optionalAuthSupabase(req as any, res as any, next);

        expect((req as any).user).toBeDefined();
        expect((req as any).rlsContextSet).toBe(true);
        expect(next).toHaveBeenCalled();
      });

      it('should log ERROR and record failure when RLS context fails', async () => {
        req.headers = {
          authorization: 'Bearer optional-token-rls-fail-xxxxx',
        };
        req.path = '/api/public';
        req.method = 'GET';
        req.headers['x-request-id'] = 'opt-req-123';

        const mockSupabaseUser = {
          id: 'user-rls-fail',
          email: 'rlsfail@example.com',
        };

        const mockDbUser = {
          id: 'user-rls-fail',
          email: 'rlsfail@example.com',
          role: 'USER',
          firstName: 'RLS',
          lastName: 'Fail',
          supabaseUserId: 'user-rls-fail',
          isActive: true,
        };

        (verifySupabaseToken as jest.Mock).mockResolvedValue(mockSupabaseUser);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockDbUser);
        (prisma.$executeRawUnsafe as jest.Mock).mockRejectedValue(new Error('RLS optional fail'));

        await optionalAuthSupabase(req as any, res as any, next);

        // Should log at ERROR level (not silent) - logged by setRLSContext helper
        expect(piiSafeLogger.error).toHaveBeenCalledWith(
          'SECURITY: Failed to set RLS context',
          expect.objectContaining({
            userId: 'user-rls-fail',
            requestId: 'opt-req-123',
            path: '/api/public',
            method: 'GET',
          })
        );

        // Should record failure for health monitoring
        expect(recordRLSFailure).toHaveBeenCalled();
      });

      it('should continue WITHOUT user when RLS context fails (fail-safe)', async () => {
        req.headers = {
          authorization: 'Bearer optional-token-rls-fail-safe',
        };

        const mockSupabaseUser = {
          id: 'user-safe',
          email: 'safe@example.com',
        };

        const mockDbUser = {
          id: 'user-safe',
          email: 'safe@example.com',
          role: 'USER',
          firstName: 'Safe',
          lastName: 'User',
          supabaseUserId: 'user-safe',
          isActive: true,
        };

        (verifySupabaseToken as jest.Mock).mockResolvedValue(mockSupabaseUser);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockDbUser);
        (prisma.$executeRawUnsafe as jest.Mock).mockRejectedValue(new Error('RLS safe fail'));

        await optionalAuthSupabase(req as any, res as any, next);

        // Should NOT attach user (fail-safe: anonymous access instead of insecure auth)
        expect((req as any).user).toBeUndefined();
        expect((req as any).supabaseUser).toBeUndefined();
        expect((req as any).rlsContextSet).toBe(false);

        // Should still continue (it's optional auth)
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });
  });
});

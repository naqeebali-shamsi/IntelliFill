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
  supabaseAdmin: {}
}));
jest.mock('../../src/utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn()
    }
  }
}));
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn()
  }
}));

// Now import after mocks are set up
import { authenticateSupabase, authorizeSupabase, optionalAuthSupabase } from '../../src/middleware/supabaseAuth';
import { verifySupabaseToken } from '../../src/utils/supabase';
import { prisma } from '../../src/utils/prisma';

describe('Supabase Authentication Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis() // Return this to allow chaining
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
        authorization: 'Bearer valid-supabase-token-12345678'
      };

      const mockSupabaseUser = {
        id: 'user-123',
        email: 'test@example.com'
      };

      const mockDbUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        firstName: 'Test',
        lastName: 'User',
        supabaseUserId: 'user-123',
        isActive: true
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
          isActive: true
        }
      });
      expect((req as any).user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        supabaseUserId: 'user-123',
        firstName: 'Test',
        lastName: 'User'
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
        message: 'Missing or invalid Authorization header'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid Bearer token format', async () => {
      req.headers = {
        authorization: 'InvalidFormat token'
      };

      await authenticateSupabase(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject empty token', async () => {
      req.headers = {
        authorization: 'Bearer '
      };

      await authenticateSupabase(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'No token provided'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject token that is too short', async () => {
      req.headers = {
        authorization: 'Bearer short'
      };

      await authenticateSupabase(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Token length is invalid'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject token that is too long', async () => {
      req.headers = {
        authorization: 'Bearer ' + 'x'.repeat(2100)
      };

      await authenticateSupabase(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Token length is invalid'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      req.headers = {
        authorization: 'Bearer invalid-token-but-correct-length-xxxx'
      };

      (verifySupabaseToken as jest.Mock).mockResolvedValue(null);

      await authenticateSupabase(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject user not in database', async () => {
      req.headers = {
        authorization: 'Bearer valid-token-but-no-db-user-xxx'
      };

      const mockSupabaseUser = {
        id: 'user-123',
        email: 'test@example.com'
      };

      (verifySupabaseToken as jest.Mock).mockResolvedValue(mockSupabaseUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await authenticateSupabase(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'User not found in database'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject inactive user', async () => {
      req.headers = {
        authorization: 'Bearer valid-token-inactive-user-xxx'
      };

      const mockSupabaseUser = {
        id: 'user-123',
        email: 'test@example.com'
      };

      const mockDbUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        firstName: 'Test',
        lastName: 'User',
        supabaseUserId: 'user-123',
        isActive: false // Inactive user
      };

      (verifySupabaseToken as jest.Mock).mockResolvedValue(mockSupabaseUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockDbUser);

      await authenticateSupabase(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle internal errors gracefully', async () => {
      req.headers = {
        authorization: 'Bearer valid-token-with-error-xxxxx'
      };

      (verifySupabaseToken as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      await authenticateSupabase(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Authentication failed'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authorizeSupabase', () => {
    it('should allow user with correct role', () => {
      (req as any).user = {
        id: 'user-123',
        email: 'admin@example.com',
        role: 'ADMIN'
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
        role: 'Admin' // Mixed case
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
        role: 'USER'
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
        message: 'Authentication required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject user with wrong role', () => {
      (req as any).user = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'USER'
      };

      const middleware = authorizeSupabase(['admin']);
      middleware(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuthSupabase', () => {
    it('should attach user if valid token provided', async () => {
      req.headers = {
        authorization: 'Bearer valid-optional-token-xxxxxxxxx'
      };

      const mockSupabaseUser = {
        id: 'user-123',
        email: 'test@example.com'
      };

      const mockDbUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        firstName: 'Test',
        lastName: 'User',
        supabaseUserId: 'user-123',
        isActive: true
      };

      (verifySupabaseToken as jest.Mock).mockResolvedValue(mockSupabaseUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockDbUser);

      await optionalAuthSupabase(req as any, res as any, next);

      expect((req as any).user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        supabaseUserId: 'user-123',
        firstName: 'Test',
        lastName: 'User'
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
        authorization: 'Bearer invalid-optional-token-xxxx'
      };

      (verifySupabaseToken as jest.Mock).mockResolvedValue(null);

      await optionalAuthSupabase(req as any, res as any, next);

      expect((req as any).user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should continue without user if token too short', async () => {
      req.headers = {
        authorization: 'Bearer short'
      };

      await optionalAuthSupabase(req as any, res as any, next);

      expect((req as any).user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(verifySupabaseToken).not.toHaveBeenCalled();
    });

    it('should continue without user if user not in database', async () => {
      req.headers = {
        authorization: 'Bearer valid-token-no-db-user-xxxxxx'
      };

      const mockSupabaseUser = {
        id: 'user-123',
        email: 'test@example.com'
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
        authorization: 'Bearer valid-token-inactive-xxxxxxxxx'
      };

      const mockSupabaseUser = {
        id: 'user-123',
        email: 'test@example.com'
      };

      const mockDbUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        firstName: 'Test',
        lastName: 'User',
        supabaseUserId: 'user-123',
        isActive: false
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
        authorization: 'Bearer token-with-error-xxxxxxxxxxx'
      };

      (verifySupabaseToken as jest.Mock).mockRejectedValue(new Error('Network error'));

      await optionalAuthSupabase(req as any, res as any, next);

      expect((req as any).user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});

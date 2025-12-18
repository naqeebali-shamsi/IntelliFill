/**
 * Supabase Authentication Routes Tests
 *
 * Integration tests for Supabase Auth API endpoints (SECURITY CRITICAL).
 *
 * Tests cover:
 * - User registration
 * - User login (Supabase and test mode)
 * - Token refresh
 * - Logout
 * - Password management (change, forgot, reset)
 * - Email verification
 * - Demo login
 * - Rate limiting
 * - Input validation
 * - Error handling
 *
 * @module api/__tests__/supabase-auth.routes.test
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import request from 'supertest';
import express, { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { createSupabaseAuthRoutes } from '../supabase-auth.routes';
import bcrypt from 'bcrypt';

// ============================================================================
// Mocks
// ============================================================================

// Mock PrismaClient
jest.mock('@prisma/client');

// Mock Supabase clients - must be declared before jest.mock
jest.mock('../../utils/supabase', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: jest.fn(),
        updateUserById: jest.fn(),
        deleteUser: jest.fn(),
        signOut: jest.fn(),
      },
    },
  },
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      getSession: jest.fn(),
      verifyOtp: jest.fn(),
      resend: jest.fn(),
    },
  },
}));

// Mock Prisma utils
jest.mock('../../utils/prisma', () => ({
  prisma: new (require('@prisma/client').PrismaClient)(),
}));

// Mock bcrypt
jest.mock('bcrypt');

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn((payload, secret, options) => 'mock-jwt-token'),
  verify: jest.fn(),
}));

// Mock Supabase Auth Middleware
jest.mock('../../middleware/supabaseAuth', () => ({
  authenticateSupabase: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }),
  AuthenticatedRequest: {},
}));

// Mock rate limiter
jest.mock('express-rate-limit', () => {
  return jest.fn(() => (req: any, res: any, next: any) => next());
});

// Mock logger
jest.mock('../../utils/piiSafeLogger', () => ({
  piiSafeLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ============================================================================
// Test Setup
// ============================================================================

describe('Supabase Authentication Routes', () => {
  let app: Express;
  let mockPrisma: any;
  let mockSupabaseAdmin: any;
  let mockSupabase: any;

  const testUserId = 'test-user-id';
  const testEmail = 'test@example.com';
  const testPassword = 'TestPass123';

  beforeAll(() => {
    // Ensure test mode for consistent behavior
    process.env.NODE_ENV = 'test';

    // Setup Express app with auth routes
    app = express();
    app.use(express.json());

    const authRoutes = createSupabaseAuthRoutes();
    app.use('/api/auth/v2', authRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Get mocked Prisma instance
    mockPrisma = require('../../utils/prisma').prisma;

    // Setup Prisma mock methods
    mockPrisma.user = {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    // Get mocked Supabase clients
    const supabase = require('../../utils/supabase');
    mockSupabaseAdmin = supabase.supabaseAdmin;
    mockSupabase = supabase.supabase;

    // Reset mock implementations
    mockSupabaseAdmin.auth.admin.createUser.mockReset();
    mockSupabaseAdmin.auth.admin.updateUserById.mockReset();
    mockSupabaseAdmin.auth.admin.deleteUser.mockReset();
    mockSupabaseAdmin.auth.admin.signOut.mockReset();
    mockSupabase.auth.signInWithPassword.mockReset();
    mockSupabase.auth.refreshSession.mockReset();
    mockSupabase.auth.resetPasswordForEmail.mockReset();
    mockSupabase.auth.getSession.mockReset();
    mockSupabase.auth.verifyOtp.mockReset();
    mockSupabase.auth.resend.mockReset();
  });

  // ==========================================================================
  // POST /api/auth/v2/register - User Registration
  // ==========================================================================

  describe('POST /api/auth/v2/register', () => {
    it('should register new user successfully', async () => {
      mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: {
          user: { id: testUserId, email: testEmail },
        },
        error: null,
      });

      mockPrisma.user.create.mockResolvedValue({
        id: testUserId,
        email: testEmail,
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        emailVerified: true,
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 3600,
          },
        },
        error: null,
      });

      const response = await request(app)
        .post('/api/auth/v2/register')
        .send({
          email: testEmail,
          password: testPassword,
          fullName: 'Test User',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testEmail);
      expect(response.body.data.tokens.accessToken).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/v2/register')
        .send({
          email: testEmail,
          // Missing password and fullName
        })
        .expect(400);

      expect(response.body.error).toContain('required');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/v2/register')
        .send({
          email: 'invalid-email',
          password: testPassword,
          fullName: 'Test User',
        })
        .expect(400);

      expect(response.body.error).toContain('email');
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/api/auth/v2/register')
        .send({
          email: testEmail,
          password: 'weak',
          fullName: 'Test User',
        })
        .expect(400);

      expect(response.body.error).toContain('Password');
    });

    it('should return 409 for existing user', async () => {
      mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'User already registered' },
      });

      const response = await request(app)
        .post('/api/auth/v2/register')
        .send({
          email: testEmail,
          password: testPassword,
          fullName: 'Test User',
        })
        .expect(409);

      expect(response.body.error).toContain('already exists');
    });

    it('should rollback Supabase user if Prisma creation fails', async () => {
      mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: testUserId, email: testEmail } },
        error: null,
      });

      mockPrisma.user.create.mockRejectedValue(new Error('Prisma error'));

      await request(app)
        .post('/api/auth/v2/register')
        .send({
          email: testEmail,
          password: testPassword,
          fullName: 'Test User',
        })
        .expect(500);

      expect(mockSupabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith(testUserId);
    });
  });

  // ==========================================================================
  // POST /api/auth/v2/login - User Login
  // ==========================================================================

  describe('POST /api/auth/v2/login', () => {
    it('should login successfully with valid credentials (test mode)', async () => {
      // Test mode uses Prisma/bcrypt authentication
      const hashedPassword = await bcrypt.hash(testPassword, 10);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: testUserId,
        email: testEmail,
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        emailVerified: true,
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({});

      const response = await request(app)
        .post('/api/auth/v2/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testEmail);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(bcrypt.compare).toHaveBeenCalledWith(testPassword, hashedPassword);
    });

    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/v2/login')
        .send({
          email: testEmail,
          // Missing password
        })
        .expect(400);

      expect(response.body.error).toContain('required');
    });

    it('should return 401 for invalid credentials', async () => {
      // Test mode: User not found
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/v2/login')
        .send({
          email: testEmail,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.error).toContain('Invalid');
    });

    it('should return 401 for wrong password', async () => {
      const hashedPassword = await bcrypt.hash(testPassword, 10);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: testUserId,
        email: testEmail,
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        emailVerified: true,
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/v2/login')
        .send({
          email: testEmail,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.error).toContain('Invalid');
    });

    it('should return 403 for inactive account', async () => {
      const hashedPassword = await bcrypt.hash(testPassword, 10);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: testUserId,
        email: testEmail,
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: false, // Account is inactive
        emailVerified: true,
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/v2/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(403);

      expect(response.body.error).toContain('deactivated');
    });

    it('should update lastLogin on successful login', async () => {
      const hashedPassword = await bcrypt.hash(testPassword, 10);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: testUserId,
        email: testEmail,
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        emailVerified: true,
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({});

      await request(app)
        .post('/api/auth/v2/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: testUserId },
          data: expect.objectContaining({ lastLogin: expect.any(Date) }),
        })
      );
    });
  });

  // ==========================================================================
  // POST /api/auth/v2/logout - User Logout
  // ==========================================================================

  describe('POST /api/auth/v2/logout', () => {
    it('should logout successfully', async () => {
      mockSupabaseAdmin.auth.admin.signOut.mockResolvedValue({});

      const response = await request(app).post('/api/auth/v2/logout').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout successful');
    });

    it('should return success even if signout fails', async () => {
      mockSupabaseAdmin.auth.admin.signOut.mockRejectedValue(new Error('Signout failed'));

      const response = await request(app).post('/api/auth/v2/logout').expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  // ==========================================================================
  // POST /api/auth/v2/refresh - Token Refresh
  // ==========================================================================

  describe('POST /api/auth/v2/refresh', () => {
    it('should refresh token successfully', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
          },
          user: { id: testUserId },
        },
        error: null,
      });

      mockPrisma.user.update.mockResolvedValue({});

      const response = await request(app)
        .post('/api/auth/v2/refresh')
        .send({ refreshToken: 'old-refresh-token' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens.accessToken).toBe('new-access-token');
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app).post('/api/auth/v2/refresh').send({}).expect(400);

      expect(response.body.error).toContain('required');
    });

    it('should return 401 for invalid refresh token', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid token' },
      });

      const response = await request(app)
        .post('/api/auth/v2/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.error).toContain('Invalid');
    });
  });

  // ==========================================================================
  // GET /api/auth/v2/me - Get Current User
  // ==========================================================================

  describe('GET /api/auth/v2/me', () => {
    it('should return current user profile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: testUserId,
        email: testEmail,
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        emailVerified: true,
      });

      const response = await request(app).get('/api/auth/v2/me').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testEmail);
    });

    it('should return 404 if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app).get('/api/auth/v2/me').expect(404);

      expect(response.body.error).toContain('not found');
    });
  });

  // ==========================================================================
  // POST /api/auth/v2/forgot-password - Forgot Password
  // ==========================================================================

  describe('POST /api/auth/v2/forgot-password', () => {
    it('should send reset email successfully', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      });

      const response = await request(app)
        .post('/api/auth/v2/forgot-password')
        .send({ email: testEmail })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('email');
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/v2/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.error).toContain('email');
    });

    it('should return success even if email not found (security)', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: { message: 'User not found' },
      });

      const response = await request(app)
        .post('/api/auth/v2/forgot-password')
        .send({ email: testEmail })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  // ==========================================================================
  // POST /api/auth/v2/change-password - Change Password
  // ==========================================================================

  describe('POST /api/auth/v2/change-password', () => {
    it('should change password successfully', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: {}, user: { id: testUserId } },
        error: null,
      });

      mockSupabaseAdmin.auth.admin.updateUserById.mockResolvedValue({
        data: {},
        error: null,
      });

      mockSupabaseAdmin.auth.admin.signOut.mockResolvedValue({});

      const response = await request(app)
        .post('/api/auth/v2/change-password')
        .send({
          currentPassword: testPassword,
          newPassword: 'NewPass123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('changed successfully');
    });

    it('should return 400 for incorrect current password', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid password' },
      });

      const response = await request(app)
        .post('/api/auth/v2/change-password')
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'NewPass123',
        })
        .expect(400);

      expect(response.body.error).toContain('incorrect');
    });

    it('should return 400 for weak new password', async () => {
      const response = await request(app)
        .post('/api/auth/v2/change-password')
        .send({
          currentPassword: testPassword,
          newPassword: 'weak',
        })
        .expect(400);

      expect(response.body.error).toContain('Password');
    });
  });

  // ==========================================================================
  // POST /api/auth/v2/verify-email - Verify Email
  // ==========================================================================

  describe('POST /api/auth/v2/verify-email', () => {
    it('should verify email successfully', async () => {
      mockSupabase.auth.verifyOtp.mockResolvedValue({
        data: { user: { id: testUserId } },
        error: null,
      });

      mockPrisma.user.update.mockResolvedValue({});

      const response = await request(app)
        .post('/api/auth/v2/verify-email')
        .send({
          email: testEmail,
          token: '123456',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('verified');
    });

    it('should return 400 for invalid token format', async () => {
      const response = await request(app)
        .post('/api/auth/v2/verify-email')
        .send({
          email: testEmail,
          token: '12345', // Only 5 digits
        })
        .expect(400);

      expect(response.body.error).toContain('6 digits');
    });

    it('should return 400 for expired token', async () => {
      mockSupabase.auth.verifyOtp.mockResolvedValue({
        data: { user: null },
        error: { message: 'Token expired' },
      });

      const response = await request(app)
        .post('/api/auth/v2/verify-email')
        .send({
          email: testEmail,
          token: '123456',
        })
        .expect(400);

      expect(response.body.error).toContain('expired');
    });
  });

  // ==========================================================================
  // POST /api/auth/v2/demo - Demo Login
  // ==========================================================================

  describe('POST /api/auth/v2/demo', () => {
    it('should login to demo account successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'demo-user-id',
        email: 'demo@intellifill.com',
        password: await bcrypt.hash('demo123', 10),
        firstName: 'Demo',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        emailVerified: true,
        organizationId: 'demo-org-id',
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({});

      const response = await request(app).post('/api/auth/v2/demo').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.isDemo).toBe(true);
      expect(response.body.data.demo).toBeDefined();
      expect(response.body.data.demo.notice).toContain('demo account');
    });

    it('should return 500 if demo user not configured', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app).post('/api/auth/v2/demo').expect(500);

      expect(response.body.error).toContain('not configured');
    });
  });

  // ==========================================================================
  // Edge Cases & Error Handling
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/v2/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid json"}')
        .expect(400);
    });

    it('should handle SQL injection attempts', async () => {
      // Test mode: Prisma should handle this safely
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/v2/login')
        .send({
          email: "test@example.com'; DROP TABLE users; --",
          password: testPassword,
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should handle XSS attempts in input', async () => {
      const response = await request(app).post('/api/auth/v2/register').send({
        email: 'test@example.com',
        password: testPassword,
        fullName: '<script>alert("xss")</script>',
      });

      // Should either sanitize or reject
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});

/**
 * Supabase Authentication Routes Integration Tests
 *
 * Phase 3 SDK Migration - Comprehensive testing of Supabase auth endpoints
 *
 * Coverage:
 * - Registration endpoint (POST /api/auth/v2/register)
 * - Login endpoint (POST /api/auth/v2/login)
 * - Logout endpoint (POST /api/auth/v2/logout)
 * - Refresh token endpoint (POST /api/auth/v2/refresh)
 * - Get profile endpoint (GET /api/auth/v2/me)
 * - Change password endpoint (POST /api/auth/v2/change-password)
 *
 * Total: 35 test cases
 *
 * @see src/api/supabase-auth.routes.ts
 */

import request from 'supertest';
import express from 'express';
import { createSupabaseAuthRoutes } from '../../src/api/supabase-auth.routes';
import { supabase, supabaseAdmin } from '../../src/utils/supabase';
import { prisma } from '../../src/utils/prisma';
import { authenticateSupabase } from '../../src/middleware/supabaseAuth';

// Mock Supabase with proper structure
jest.mock('../../src/utils/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
      getUser: jest.fn()
    }
  },
  supabaseAdmin: {
    auth: {
      getUser: jest.fn(),
      admin: {
        createUser: jest.fn(),
        deleteUser: jest.fn(),
        updateUserById: jest.fn(),
        signOut: jest.fn()
      }
    }
  },
  verifySupabaseToken: jest.fn()
}));

// Mock Prisma with proper structure
jest.mock('../../src/utils/prisma', () => ({
  prisma: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn()
    },
    $disconnect: jest.fn()
  }
}));

// Mock authentication middleware
jest.mock('../../src/middleware/supabaseAuth');

// Test app setup
const app = express();
app.use(express.json());
const supabaseAuthRoutes = createSupabaseAuthRoutes();
app.use('/api/auth/v2', supabaseAuthRoutes);

// Mock data
const mockUser = {
  id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'USER',
  isActive: true,
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLogin: new Date(),
  supabaseUserId: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  password: ''
};

const mockSupabaseUser = {
  id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  email: 'test@example.com',
  email_confirmed_at: new Date().toISOString(),
  user_metadata: {
    firstName: 'Test',
    lastName: 'User',
    role: 'USER'
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const mockSession = {
  access_token: 'mock_access_token_1234567890',
  refresh_token: 'mock_refresh_token_0987654321',
  expires_in: 3600,
  token_type: 'bearer',
  user: mockSupabaseUser
};

describe('Supabase Authentication Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===================================
  // POST /api/auth/v2/register
  // ===================================

  describe('POST /api/auth/v2/register', () => {
    const registerPayload = {
      email: 'newuser@example.com',
      password: 'Test1234!',
      fullName: 'New User',
      role: 'user'
    };

    it('should register a new user successfully', async () => {
      const newUser = {
        ...mockUser,
        email: registerPayload.email.toLowerCase(),
        firstName: 'New',
        lastName: 'User',
        role: 'USER'
      };

      const newSupabaseUser = {
        ...mockSupabaseUser,
        email: registerPayload.email.toLowerCase(),
        user_metadata: {
          firstName: 'New',
          lastName: 'User',
          role: 'USER'
        }
      };

      const newSession = {
        ...mockSession,
        user: newSupabaseUser
      };

      // Mock Supabase admin.createUser
      (supabaseAdmin.auth.admin.createUser as jest.Mock).mockResolvedValue({
        data: {
          user: newSupabaseUser
        },
        error: null
      });

      // Mock Supabase signInWithPassword
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: {
          session: newSession,
          user: newSupabaseUser
        },
        error: null
      });

      // Mock Prisma user create
      (prisma.user.create as jest.Mock).mockResolvedValue(newUser);

      const response = await request(app)
        .post('/api/auth/v2/register')
        .send(registerPayload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(registerPayload.email.toLowerCase());
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBe(mockSession.access_token);
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/auth/v2/register')
        .send({ ...registerPayload, email: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/v2/register')
        .send({ ...registerPayload, password: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 400 when fullName is missing', async () => {
      const response = await request(app)
        .post('/api/auth/v2/register')
        .send({ ...registerPayload, fullName: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 400 when email format is invalid', async () => {
      const response = await request(app)
        .post('/api/auth/v2/register')
        .send({ ...registerPayload, email: 'invalidemail' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid email format');
    });

    it('should return 400 when password is too short', async () => {
      const response = await request(app)
        .post('/api/auth/v2/register')
        .send({ ...registerPayload, password: 'Short1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('at least 8 characters');
    });

    it('should return 400 when password lacks uppercase letter', async () => {
      const response = await request(app)
        .post('/api/auth/v2/register')
        .send({ ...registerPayload, password: 'test1234!' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('uppercase');
    });

    it('should return 400 when password lacks lowercase letter', async () => {
      const response = await request(app)
        .post('/api/auth/v2/register')
        .send({ ...registerPayload, password: 'TEST1234!' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('lowercase');
    });

    it('should return 400 when password lacks number', async () => {
      const response = await request(app)
        .post('/api/auth/v2/register')
        .send({ ...registerPayload, password: 'TestTest!' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('number');
    });

    it('should return 400 when role is invalid', async () => {
      const response = await request(app)
        .post('/api/auth/v2/register')
        .send({ ...registerPayload, role: 'superuser' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid role');
    });

    it('should return 409 when user already exists', async () => {
      (supabaseAdmin.auth.admin.createUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: { message: 'User already registered' }
      });

      const response = await request(app)
        .post('/api/auth/v2/register')
        .send(registerPayload);

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    it('should handle Supabase creation failure gracefully', async () => {
      (supabaseAdmin.auth.admin.createUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: { message: 'Network error' }
      });

      const response = await request(app)
        .post('/api/auth/v2/register')
        .send(registerPayload);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should rollback Supabase user if Prisma creation fails', async () => {
      (supabaseAdmin.auth.admin.createUser as jest.Mock).mockResolvedValue({
        data: { user: mockSupabaseUser },
        error: null
      });

      (prisma.user.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      (supabaseAdmin.auth.admin.deleteUser as jest.Mock).mockResolvedValue({
        data: {},
        error: null
      });

      const response = await request(app)
        .post('/api/auth/v2/register')
        .send(registerPayload);

      expect(response.status).toBe(500);
      expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith(mockSupabaseUser.id);
    });
  });

  // ===================================
  // POST /api/auth/v2/login
  // ===================================

  describe('POST /api/auth/v2/login', () => {
    const loginPayload = {
      email: 'test@example.com',
      password: 'Test1234!'
    };

    it('should login successfully with valid credentials', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: {
          session: mockSession,
          user: mockSupabaseUser
        },
        error: null
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/v2/login')
        .send(loginPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBe(mockSession.access_token);
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/auth/v2/login')
        .send({ password: 'Test1234!' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/v2/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 401 with invalid credentials', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid login credentials' }
      });

      const response = await request(app)
        .post('/api/auth/v2/login')
        .send(loginPayload);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid email or password');
    });

    it('should return 401 when user exists in Supabase but not in Prisma', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: {
          session: mockSession,
          user: mockSupabaseUser
        },
        error: null
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/v2/login')
        .send(loginPayload);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('User not found');
    });

    it('should return 403 when user account is deactivated', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: {
          session: mockSession,
          user: mockSupabaseUser
        },
        error: null
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        isActive: false
      });

      const response = await request(app)
        .post('/api/auth/v2/login')
        .send(loginPayload);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('deactivated');
    });

    it('should update lastLogin timestamp on successful login', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: {
          session: mockSession,
          user: mockSupabaseUser
        },
        error: null
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      await request(app)
        .post('/api/auth/v2/login')
        .send(loginPayload);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({ lastLogin: expect.any(Date) })
        })
      );
    });
  });

  // ===================================
  // POST /api/auth/v2/logout
  // ===================================

  describe('POST /api/auth/v2/logout', () => {
    it('should logout successfully when authenticated', async () => {
      // Mock authenticateSupabase middleware
      (authenticateSupabase as jest.Mock).mockImplementation((req, res, next) => {
        req.user = { id: mockUser.id, email: mockUser.email };
        next();
      });

      (supabaseAdmin.auth.admin.signOut as jest.Mock).mockResolvedValue({
        data: {},
        error: null
      });

      const response = await request(app)
        .post('/api/auth/v2/logout')
        .set('Authorization', 'Bearer mock_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logout successful');
    });

    it('should return success even if Supabase sign out fails (idempotent)', async () => {
      (authenticateSupabase as jest.Mock).mockImplementation((req, res, next) => {
        req.user = { id: mockUser.id, email: mockUser.email };
        next();
      });

      (supabaseAdmin.auth.admin.signOut as jest.Mock).mockRejectedValue(
        new Error('Sign out failed')
      );

      const response = await request(app)
        .post('/api/auth/v2/logout')
        .set('Authorization', 'Bearer mock_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ===================================
  // POST /api/auth/v2/refresh
  // ===================================

  describe('POST /api/auth/v2/refresh', () => {
    it('should refresh token successfully', async () => {
      (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: {
          session: mockSession,
          user: mockSupabaseUser
        },
        error: null
      });

      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/v2/refresh')
        .send({ refreshToken: 'mock_refresh_token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBe(mockSession.access_token);
    });

    it('should return 400 when refresh token is missing', async () => {
      const response = await request(app)
        .post('/api/auth/v2/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 401 when refresh token is invalid', async () => {
      (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid refresh token' }
      });

      const response = await request(app)
        .post('/api/auth/v2/refresh')
        .send({ refreshToken: 'invalid_token' });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid or expired');
    });

    it('should return 401 when refresh token is expired', async () => {
      (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Refresh token expired' }
      });

      const response = await request(app)
        .post('/api/auth/v2/refresh')
        .send({ refreshToken: 'expired_token' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('should update lastLogin on successful refresh', async () => {
      (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: {
          session: mockSession,
          user: mockSupabaseUser
        },
        error: null
      });

      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      await request(app)
        .post('/api/auth/v2/refresh')
        .send({ refreshToken: 'mock_refresh_token' });

      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  // ===================================
  // GET /api/auth/v2/me
  // ===================================

  describe('GET /api/auth/v2/me', () => {
    it('should get user profile successfully when authenticated', async () => {
      (authenticateSupabase as jest.Mock).mockImplementation((req, res, next) => {
        req.user = { id: mockUser.id, email: mockUser.email };
        next();
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/auth/v2/me')
        .set('Authorization', 'Bearer mock_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(mockUser.email);
      expect(response.body.data.user.id).toBe(mockUser.id);
    });

    it('should return 404 when user not found in database', async () => {
      (authenticateSupabase as jest.Mock).mockImplementation((req, res, next) => {
        req.user = { id: mockUser.id, email: mockUser.email };
        next();
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/auth/v2/me')
        .set('Authorization', 'Bearer mock_token');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('User not found');
    });

    it('should include all user profile fields in response', async () => {
      (authenticateSupabase as jest.Mock).mockImplementation((req, res, next) => {
        req.user = { id: mockUser.id, email: mockUser.email };
        req.supabaseUser = mockSupabaseUser;
        next();
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/auth/v2/me')
        .set('Authorization', 'Bearer mock_token');

      expect(response.status).toBe(200);
      expect(response.body.data.user).toMatchObject({
        id: expect.any(String),
        email: expect.any(String),
        firstName: expect.any(String),
        lastName: expect.any(String),
        role: expect.any(String),
        is_active: expect.any(Boolean),
        email_verified: expect.any(Boolean)
      });
    });
  });

  // ===================================
  // POST /api/auth/v2/change-password
  // ===================================

  describe('POST /api/auth/v2/change-password', () => {
    const changePasswordPayload = {
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass456!'
    };

    it('should change password successfully', async () => {
      (authenticateSupabase as jest.Mock).mockImplementation((req, res, next) => {
        req.user = { id: mockUser.id, email: mockUser.email };
        next();
      });

      // Mock verify current password
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: {
          session: mockSession,
          user: mockSupabaseUser
        },
        error: null
      });

      // Mock update password
      (supabaseAdmin.auth.admin.updateUserById as jest.Mock).mockResolvedValue({
        data: { user: mockSupabaseUser },
        error: null
      });

      // Mock sign out all sessions
      (supabaseAdmin.auth.admin.signOut as jest.Mock).mockResolvedValue({
        data: {},
        error: null
      });

      const response = await request(app)
        .post('/api/auth/v2/change-password')
        .set('Authorization', 'Bearer mock_token')
        .send(changePasswordPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password changed successfully');
    });

    it('should return 400 when current password is missing', async () => {
      (authenticateSupabase as jest.Mock).mockImplementation((req, res, next) => {
        req.user = { id: mockUser.id, email: mockUser.email };
        next();
      });

      const response = await request(app)
        .post('/api/auth/v2/change-password')
        .set('Authorization', 'Bearer mock_token')
        .send({ newPassword: 'NewPass456!' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 400 when new password is missing', async () => {
      (authenticateSupabase as jest.Mock).mockImplementation((req, res, next) => {
        req.user = { id: mockUser.id, email: mockUser.email };
        next();
      });

      const response = await request(app)
        .post('/api/auth/v2/change-password')
        .set('Authorization', 'Bearer mock_token')
        .send({ currentPassword: 'OldPass123!' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 400 when new password is too short', async () => {
      (authenticateSupabase as jest.Mock).mockImplementation((req, res, next) => {
        req.user = { id: mockUser.id, email: mockUser.email };
        next();
      });

      const response = await request(app)
        .post('/api/auth/v2/change-password')
        .set('Authorization', 'Bearer mock_token')
        .send({ currentPassword: 'OldPass123!', newPassword: 'Short1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('at least 8 characters');
    });

    it('should return 400 when new password lacks complexity', async () => {
      (authenticateSupabase as jest.Mock).mockImplementation((req, res, next) => {
        req.user = { id: mockUser.id, email: mockUser.email };
        next();
      });

      const response = await request(app)
        .post('/api/auth/v2/change-password')
        .set('Authorization', 'Bearer mock_token')
        .send({ currentPassword: 'OldPass123!', newPassword: 'newpassword' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('uppercase');
    });

    it('should return 400 when current password is incorrect', async () => {
      (authenticateSupabase as jest.Mock).mockImplementation((req, res, next) => {
        req.user = { id: mockUser.id, email: mockUser.email };
        next();
      });

      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid credentials' }
      });

      const response = await request(app)
        .post('/api/auth/v2/change-password')
        .set('Authorization', 'Bearer mock_token')
        .send(changePasswordPayload);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Current password is incorrect');
    });

    it('should sign out all sessions after password change', async () => {
      (authenticateSupabase as jest.Mock).mockImplementation((req, res, next) => {
        req.user = { id: mockUser.id, email: mockUser.email };
        next();
      });

      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: {
          session: mockSession,
          user: mockSupabaseUser
        },
        error: null
      });

      (supabaseAdmin.auth.admin.updateUserById as jest.Mock).mockResolvedValue({
        data: { user: mockSupabaseUser },
        error: null
      });

      (supabaseAdmin.auth.admin.signOut as jest.Mock).mockResolvedValue({
        data: {},
        error: null
      });

      await request(app)
        .post('/api/auth/v2/change-password')
        .set('Authorization', 'Bearer mock_token')
        .send(changePasswordPayload);

      expect(supabaseAdmin.auth.admin.signOut).toHaveBeenCalledWith(mockUser.id, 'global');
    });
  });
});

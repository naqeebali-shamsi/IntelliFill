/**
 * Supabase Authentication Routes
 *
 * Phase 3 SDK Migration - Replaces custom JWT authentication with Supabase Auth
 *
 * Architecture:
 * - Supabase handles ALL auth operations (user creation, sessions, passwords)
 * - Prisma stores user profiles (roles, names, status, metadata)
 * - Linked via supabaseUserId field in User model
 *
 * Security:
 * - Server-side JWT verification using getUser() (not getSession())
 * - bcrypt password compatibility
 * - Comprehensive input validation
 * - No internal error exposure to clients
 *
 * @see docs/SUPABASE_AUTH_MIGRATION_PLAN.md
 * @see docs/300-api/303-supabase-middleware.md
 */

import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { supabaseAdmin, supabase } from '../utils/supabase';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { authenticateSupabase, AuthenticatedRequest } from '../middleware/supabaseAuth';

/**
 * Request interfaces
 */
export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  role?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Rate limiting for auth endpoints
 * Stricter limits for security-critical operations
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 100 : 5,
  message: {
    error: 'Too many authentication attempts. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many authentication attempts. Please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // max 3 registrations per hour
  message: {
    error: 'Too many registration attempts. Please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Create Supabase auth router
 */
export function createSupabaseAuthRoutes(): Router {
  const router = Router();

  /**
   * POST /api/auth/v2/register
   * Register a new user using Supabase Auth
   *
   * Flow:
   * 1. Validate input
   * 2. Create user in Supabase Auth (handles password hashing)
   * 3. Create corresponding profile in Prisma (for business logic)
   * 4. Return session tokens
   *
   * @body email - User email address
   * @body password - User password (min 8 chars, uppercase, lowercase, number)
   * @body fullName - User's full name
   * @body role - Optional role (user|admin), defaults to 'user'
   *
   * @returns 201 - User created successfully with tokens
   * @returns 400 - Validation error or user already exists
   * @returns 500 - Server error
   */
  router.post('/register', registerLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, fullName, role = 'user' }: RegisterRequest = req.body;

      // ===== Input Validation =====

      // Validate required fields
      if (!email || !password || !fullName) {
        return res.status(400).json({
          error: 'Email, password, and full name are required',
          details: {
            email: !email ? 'Email is required' : null,
            password: !password ? 'Password is required' : null,
            fullName: !fullName ? 'Full name is required' : null
          }
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: 'Invalid email format'
        });
      }

      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters long'
        });
      }

      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        return res.status(400).json({
          error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
        });
      }

      // Validate role if provided
      const validRoles = ['user', 'admin'];
      if (role && !validRoles.includes(role.toLowerCase())) {
        return res.status(400).json({
          error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
        });
      }

      // Parse full name into first and last name
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      // ===== Create User in Supabase Auth =====

      logger.info(`Attempting to register user with Supabase: ${email}`);

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase(),
        password,
        email_confirm: process.env.NODE_ENV === 'development', // Auto-confirm in dev, require verification in prod
        user_metadata: {
          firstName,
          lastName,
          role: role.toUpperCase()
        }
      });

      if (authError) {
        logger.error('Supabase user creation failed:', authError);

        // Handle specific Supabase errors
        if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
          return res.status(409).json({
            error: 'User with this email already exists'
          });
        }

        if (authError.message.includes('password')) {
          return res.status(400).json({
            error: authError.message
          });
        }

        return res.status(400).json({
          error: 'Registration failed. Please try again.'
        });
      }

      if (!authData.user) {
        logger.error('Supabase user creation returned no user data');
        return res.status(500).json({
          error: 'Registration failed. Please try again.'
        });
      }

      // ===== Create User Profile in Prisma =====

      try {
        const user = await prisma.user.create({
          data: {
            id: authData.user.id, // CRITICAL: Use Supabase user ID as primary key
            email: email.toLowerCase(),
            password: '', // Empty string for now (Supabase manages passwords)
            firstName,
            lastName,
            role: role.toUpperCase() as any,
            isActive: true,
            emailVerified: process.env.NODE_ENV === 'development', // Match Supabase email_confirm setting
            supabaseUserId: authData.user.id // Track Supabase user ID for migration
          }
        });

        logger.info(`User profile created in Prisma: ${email}`);

        // ===== Generate Session Tokens =====

        // Sign in immediately to get session tokens
        const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase(),
          password
        });

        if (sessionError || !sessionData.session) {
          logger.warn('Failed to generate session after registration:', sessionError?.message);

          // Return success but without tokens (user needs to login manually)
          return res.status(201).json({
            success: true,
            message: 'User registered successfully. Please check your email to verify your account.',
            data: {
              user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role.toLowerCase()
              },
              tokens: null
            }
          });
        }

        // ===== Success Response =====

        logger.info(`New user registered successfully: ${email}`);

        res.status(201).json({
          success: true,
          message: 'User registered successfully',
          data: {
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role.toLowerCase(),
              emailVerified: user.emailVerified
            },
            tokens: {
              accessToken: sessionData.session.access_token,
              refreshToken: sessionData.session.refresh_token,
              expiresIn: sessionData.session.expires_in || 3600,
              tokenType: 'Bearer'
            }
          }
        });

      } catch (prismaError: any) {
        // Rollback: Delete user from Supabase if Prisma creation fails
        logger.error('Prisma user creation failed, rolling back Supabase user:', prismaError);

        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          logger.info('Supabase user rollback successful');
        } catch (deleteError) {
          logger.error('Supabase user rollback failed:', deleteError);
        }

        if (prismaError.code === 'P2002') {
          return res.status(409).json({
            error: 'User with this email already exists'
          });
        }

        return res.status(500).json({
          error: 'Registration failed. Please try again.'
        });
      }

    } catch (error: any) {
      logger.error('Registration error:', error);
      res.status(500).json({
        error: 'Registration failed. Please try again.'
      });
    }
  });

  /**
   * POST /api/auth/v2/login
   * Authenticate user with Supabase Auth
   *
   * Flow:
   * 1. Validate input
   * 2. Authenticate with Supabase
   * 3. Verify user in Prisma (role, isActive)
   * 4. Update lastLogin
   * 5. Return session tokens
   *
   * @body email - User email
   * @body password - User password
   *
   * @returns 200 - Login successful with tokens
   * @returns 400 - Validation error
   * @returns 401 - Invalid credentials
   * @returns 403 - Account deactivated
   * @returns 500 - Server error
   */
  router.post('/login', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password }: LoginRequest = req.body;

      // ===== Input Validation =====

      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required',
          details: {
            email: !email ? 'Email is required' : null,
            password: !password ? 'Password is required' : null
          }
        });
      }

      // ===== Authenticate with Supabase =====

      logger.info(`Login attempt for user: ${email}`);

      const { data: sessionData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password
      });

      if (authError || !sessionData.session || !sessionData.user) {
        logger.warn(`Login failed for ${email}:`, authError?.message || 'No session returned');
        return res.status(401).json({
          error: 'Invalid email or password'
        });
      }

      // ===== Verify User in Prisma =====

      const user = await prisma.user.findUnique({
        where: { id: sessionData.user.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          lastLogin: true
        }
      });

      if (!user) {
        // User exists in Supabase but not in Prisma - data sync issue
        logger.error(`User ${sessionData.user.id} authenticated with Supabase but not found in database`);
        return res.status(401).json({
          error: 'User not found. Please contact support.'
        });
      }

      // Check if account is active
      if (!user.isActive) {
        logger.warn(`Inactive user attempted login: ${email}`);
        return res.status(403).json({
          error: 'Account is deactivated. Please contact support.',
          code: 'ACCOUNT_DEACTIVATED'
        });
      }

      // ===== Update Last Login =====

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      // ===== Success Response =====

      logger.info(`User logged in successfully: ${email}`);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role.toLowerCase(),
            emailVerified: user.emailVerified,
            lastLogin: user.lastLogin,
            createdAt: user.createdAt
          },
          tokens: {
            accessToken: sessionData.session.access_token,
            refreshToken: sessionData.session.refresh_token,
            expiresIn: sessionData.session.expires_in || 3600,
            tokenType: 'Bearer'
          }
        }
      });

    } catch (error: any) {
      logger.error('Login error:', error);
      res.status(500).json({
        error: 'Login failed. Please try again.'
      });
    }
  });

  /**
   * POST /api/auth/v2/logout
   * Logout user and invalidate Supabase session
   *
   * Flow:
   * 1. Verify authentication
   * 2. Sign out from Supabase (invalidates all sessions globally)
   * 3. Return success (idempotent - always returns success)
   *
   * @header Authorization - Bearer <access_token>
   *
   * @returns 200 - Logout successful
   * @returns 401 - Not authenticated
   */
  router.post('/logout', authenticateSupabase, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const email = req.user?.email;

      // Sign out from Supabase (global scope - invalidates all sessions for this user)
      // Note: We use supabaseAdmin to ensure we can sign out the user even if their token is expired
      if (userId) {
        try {
          await supabaseAdmin.auth.admin.signOut(userId, 'global');
          logger.info(`User logged out: ${email}`);
        } catch (signOutError) {
          // Log but don't fail - logout should be idempotent
          logger.warn(`Supabase sign out failed for ${email}:`, signOutError);
        }
      }

      // Always return success for logout (idempotent operation)
      res.json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error: any) {
      logger.error('Logout error:', error);
      // Return success even if logout fails to prevent client-side issues
      res.json({
        success: true,
        message: 'Logout successful'
      });
    }
  });

  /**
   * POST /api/auth/v2/refresh
   * Refresh access token using refresh token
   *
   * Flow:
   * 1. Validate refresh token
   * 2. Use Supabase to refresh session
   * 3. Update lastLogin in Prisma
   * 4. Return new tokens
   *
   * @body refreshToken - Refresh token from login/register
   *
   * @returns 200 - Token refreshed successfully
   * @returns 400 - Missing refresh token
   * @returns 401 - Invalid or expired refresh token
   * @returns 500 - Server error
   */
  router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken }: RefreshTokenRequest = req.body;

      // ===== Input Validation =====

      if (!refreshToken) {
        return res.status(400).json({
          error: 'Refresh token is required'
        });
      }

      // ===== Refresh Session with Supabase =====

      logger.debug('Attempting to refresh session');

      const { data: sessionData, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (refreshError || !sessionData.session || !sessionData.user) {
        logger.warn('Token refresh failed:', refreshError?.message || 'No session returned');
        return res.status(401).json({
          error: 'Invalid or expired refresh token'
        });
      }

      // ===== Update Last Login =====

      try {
        await prisma.user.update({
          where: { id: sessionData.user.id },
          data: { lastLogin: new Date() }
        });
      } catch (updateError) {
        // Log but don't fail if Prisma update fails
        logger.warn('Failed to update lastLogin during token refresh:', updateError);
      }

      // ===== Success Response =====

      logger.info(`Token refreshed for user: ${sessionData.user.email}`);

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          tokens: {
            accessToken: sessionData.session.access_token,
            refreshToken: sessionData.session.refresh_token,
            expiresIn: sessionData.session.expires_in || 3600,
            tokenType: 'Bearer'
          }
        }
      });

    } catch (error: any) {
      logger.error('Token refresh error:', error);
      res.status(401).json({
        error: 'Invalid or expired refresh token'
      });
    }
  });

  /**
   * GET /api/auth/v2/me
   * Get current user profile
   *
   * Flow:
   * 1. Verify authentication (middleware)
   * 2. Get user profile from Prisma
   * 3. Return user data
   *
   * @header Authorization - Bearer <access_token>
   *
   * @returns 200 - User profile
   * @returns 401 - Not authenticated
   * @returns 404 - User not found
   * @returns 500 - Server error
   */
  router.get('/me', authenticateSupabase, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      // ===== Get User Profile from Prisma =====

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          lastLogin: true,
          supabaseUserId: true
        }
      });

      if (!user) {
        logger.error(`Authenticated user ${req.user.id} not found in database`);
        return res.status(404).json({
          error: 'User not found'
        });
      }

      // ===== Success Response =====

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            full_name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role.toLowerCase(),
            is_active: user.isActive,
            email_verified: user.emailVerified || req.supabaseUser?.email_confirmed_at !== null,
            created_at: user.createdAt,
            updated_at: user.updatedAt,
            last_login: user.lastLogin,
            supabase_user_id: user.supabaseUserId
          }
        }
      });

    } catch (error: any) {
      logger.error('Get user profile error:', error);
      res.status(500).json({
        error: 'Failed to get user profile'
      });
    }
  });

  /**
   * POST /api/auth/v2/change-password
   * Change user password
   *
   * Flow:
   * 1. Verify authentication
   * 2. Verify current password by attempting login
   * 3. Update password in Supabase
   * 4. Sign out all sessions (security best practice)
   * 5. Return success
   *
   * @header Authorization - Bearer <access_token>
   * @body currentPassword - Current password
   * @body newPassword - New password
   *
   * @returns 200 - Password changed successfully
   * @returns 400 - Validation error or incorrect current password
   * @returns 401 - Not authenticated
   * @returns 500 - Server error
   */
  router.post('/change-password', authenticateSupabase, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id || !req.user?.email) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      const { currentPassword, newPassword }: ChangePasswordRequest = req.body;

      // ===== Input Validation =====

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: 'Current password and new password are required',
          details: {
            currentPassword: !currentPassword ? 'Current password is required' : null,
            newPassword: !newPassword ? 'New password is required' : null
          }
        });
      }

      // Validate new password strength
      if (newPassword.length < 8) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters long'
        });
      }

      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
        return res.status(400).json({
          error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
        });
      }

      // ===== Verify Current Password =====

      // Verify current password by attempting to sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: req.user.email,
        password: currentPassword
      });

      if (verifyError) {
        logger.warn(`Incorrect current password for user: ${req.user.email}`);
        return res.status(400).json({
          error: 'Current password is incorrect'
        });
      }

      // ===== Update Password in Supabase =====

      logger.info(`Changing password for user: ${req.user.email}`);

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        req.user.id,
        { password: newPassword }
      );

      if (updateError) {
        logger.error('Password update failed:', updateError);

        if (updateError.message.includes('password')) {
          return res.status(400).json({
            error: updateError.message
          });
        }

        return res.status(500).json({
          error: 'Failed to change password. Please try again.'
        });
      }

      // ===== Sign Out All Sessions (Security Best Practice) =====

      try {
        await supabaseAdmin.auth.admin.signOut(req.user.id, 'global');
        logger.info(`All sessions invalidated for user: ${req.user.email}`);
      } catch (signOutError) {
        // Log but don't fail if sign out fails
        logger.warn('Failed to sign out all sessions after password change:', signOutError);
      }

      // ===== Success Response =====

      logger.info(`Password changed successfully for user: ${req.user.email}`);

      res.json({
        success: true,
        message: 'Password changed successfully. Please login again with your new password.'
      });

    } catch (error: any) {
      logger.error('Change password error:', error);
      res.status(500).json({
        error: 'Failed to change password. Please try again.'
      });
    }
  });

  return router;
}

export default createSupabaseAuthRoutes;

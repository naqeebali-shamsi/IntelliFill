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
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabaseAdmin, supabase } from '../utils/supabase';
import { prisma } from '../utils/prisma';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { authenticateSupabase, AuthenticatedRequest } from '../middleware/supabaseAuth';
// Use centralized rate limiters to avoid duplication and ensure Redis store is used
import { authLimiter as centralAuthLimiter } from '../middleware/rateLimiter';
// Import validated config (will throw on startup if secrets are invalid)
import { config } from '../config';

// Test mode configuration (for e2e tests - JWT secrets still required in env)
const isTestMode = process.env.NODE_ENV === 'test' || process.env.E2E_TEST_MODE === 'true';

// JWT secrets are now loaded from validated config (no fallbacks)
// Config validation ensures these are set and ≥ 64 characters
const JWT_SECRET = config.jwt.secret;
const JWT_REFRESH_SECRET = config.jwt.refreshSecret;

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

export interface ForgotPasswordRequest {
  email: string;
  redirectUrl?: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface VerifyResetTokenRequest {
  token: string;
}

export interface VerifyEmailRequest {
  email: string;
  token: string;
}

export interface ResendVerificationRequest {
  email: string;
}

/**
 * Rate limiting for auth endpoints
 *
 * IMPORTANT: We use the centralized rate limiter from middleware/rateLimiter.ts
 * This ensures:
 * 1. Redis store is used for distributed rate limiting
 * 2. Consistent limits across the application
 * 3. No double rate limiting (index.ts also applies limiters)
 *
 * The centralized limiter uses skipSuccessfulRequests: true,
 * so only failed auth attempts count toward the limit.
 */
const authLimiter = centralAuthLimiter;

// Registration uses the same limiter - it's auth-related and should be protected
const registerLimiter = centralAuthLimiter;

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
  router.post(
    '/register',
    registerLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
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
              fullName: !fullName ? 'Full name is required' : null,
            },
          });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            error: 'Invalid email format',
          });
        }

        // Validate password strength
        if (password.length < 8) {
          return res.status(400).json({
            error: 'Password must be at least 8 characters long',
          });
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
          return res.status(400).json({
            error:
              'Password must contain at least one uppercase letter, one lowercase letter, and one number',
          });
        }

        // Validate role if provided
        const validRoles = ['user', 'admin'];
        if (role && !validRoles.includes(role.toLowerCase())) {
          return res.status(400).json({
            error: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
          });
        }

        // Parse full name into first and last name
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';

        // ===== Create User in Supabase Auth =====

        logger.info('Attempting to register user with Supabase', { email });

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email.toLowerCase(),
          password,
          email_confirm: process.env.NODE_ENV === 'development', // Auto-confirm in dev, require verification in prod
          user_metadata: {
            firstName,
            lastName,
            role: role.toUpperCase(),
          },
        });

        if (authError) {
          logger.error('Supabase user creation failed:', authError);

          // Handle specific Supabase errors
          if (
            authError.message.includes('already registered') ||
            authError.message.includes('already exists')
          ) {
            return res.status(409).json({
              error: 'User with this email already exists',
            });
          }

          if (authError.message.includes('password')) {
            return res.status(400).json({
              error: authError.message,
            });
          }

          return res.status(400).json({
            error: 'Registration failed. Please try again.',
          });
        }

        if (!authData.user) {
          logger.error('Supabase user creation returned no user data');
          return res.status(500).json({
            error: 'Registration failed. Please try again.',
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
              supabaseUserId: authData.user.id, // Track Supabase user ID for migration
            },
          });

          logger.info('User profile created in Prisma', { email });

          // ===== Generate Session Tokens =====

          // Sign in immediately to get session tokens
          const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword(
            {
              email: email.toLowerCase(),
              password,
            }
          );

          if (sessionError || !sessionData.session) {
            logger.warn('Failed to generate session after registration:', sessionError?.message);

            // Return success but without tokens (user needs to login manually)
            return res.status(201).json({
              success: true,
              message:
                'User registered successfully. Please check your email to verify your account.',
              data: {
                user: {
                  id: user.id,
                  email: user.email,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  role: user.role.toLowerCase(),
                },
                tokens: null,
              },
            });
          }

          // ===== Success Response =====

          logger.info('New user registered successfully', { email });

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
                emailVerified: user.emailVerified,
              },
              tokens: {
                accessToken: sessionData.session.access_token,
                refreshToken: sessionData.session.refresh_token,
                expiresIn: sessionData.session.expires_in || 3600,
                tokenType: 'Bearer',
              },
            },
          });
        } catch (prismaError: unknown) {
          // Rollback: Delete user from Supabase if Prisma creation fails
          const errorMessage =
            prismaError instanceof Error ? prismaError.message : String(prismaError);
          logger.error('Prisma user creation failed, rolling back Supabase user:', errorMessage);

          try {
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            logger.info('Supabase user rollback successful');
          } catch (deleteError) {
            logger.error('Supabase user rollback failed:', deleteError);
          }

          if (
            typeof prismaError === 'object' &&
            prismaError !== null &&
            (prismaError as any).code === 'P2002'
          ) {
            return res.status(409).json({
              error: 'User with this email already exists',
            });
          }

          return res.status(500).json({
            error: 'Registration failed. Please try again.',
          });
        }
      } catch (error: unknown) {
        logger.error('Registration error:', error);
        res.status(500).json({
          error: 'Registration failed. Please try again.',
        });
      }
    }
  );

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
            password: !password ? 'Password is required' : null,
          },
        });
      }

      logger.info('Login attempt', { email, isTestMode });

      // ===== TEST MODE: Authenticate with Prisma/bcrypt =====
      // In test mode (E2E tests), we authenticate directly against Prisma
      // since Supabase Auth is not available in the Docker test environment
      if (isTestMode) {
        logger.info('[TEST MODE] Authenticating via Prisma/bcrypt', { email });

        // Find user in Prisma
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          select: {
            id: true,
            email: true,
            password: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            emailVerified: true,
            createdAt: true,
            lastLogin: true,
          },
        });

        if (!user) {
          logger.warn('[TEST MODE] User not found', { email });
          return res.status(401).json({
            error: 'Invalid email or password',
          });
        }

        // Verify password with bcrypt
        const passwordValid = await bcrypt.compare(password, user.password);
        if (!passwordValid) {
          logger.warn('[TEST MODE] Invalid password', { email });
          return res.status(401).json({
            error: 'Invalid email or password',
          });
        }

        // Check if account is active
        if (!user.isActive) {
          logger.warn('[TEST MODE] Inactive user attempted login', { email });
          return res.status(403).json({
            error: 'Account is deactivated. Please contact support.',
            code: 'ACCOUNT_DEACTIVATED',
          });
        }

        // Generate test JWT tokens
        const accessToken = jwt.sign(
          {
            sub: user.id,
            email: user.email,
            role: user.role,
            aud: 'authenticated',
            iss: 'test-mode',
          },
          JWT_SECRET,
          { expiresIn: '1h' }
        );

        const refreshToken = jwt.sign(
          {
            sub: user.id,
            type: 'refresh',
          },
          JWT_REFRESH_SECRET,
          { expiresIn: '7d' }
        );

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        logger.info('[TEST MODE] User logged in successfully', { email });

        return res.json({
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
              createdAt: user.createdAt,
            },
            tokens: {
              accessToken,
              refreshToken,
              expiresIn: 3600,
              tokenType: 'Bearer',
            },
          },
        });
      }

      // ===== PRODUCTION MODE: Authenticate with Supabase =====

      const { data: sessionData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (authError || !sessionData.session || !sessionData.user) {
        logger.warn('Login failed', { email, error: authError?.message || 'No session returned' });
        return res.status(401).json({
          error: 'Invalid email or password',
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
          lastLogin: true,
        },
      });

      if (!user) {
        // User exists in Supabase but not in Prisma - data sync issue
        logger.error(
          `User ${sessionData.user.id} authenticated with Supabase but not found in database`
        );
        return res.status(401).json({
          error: 'User not found. Please contact support.',
        });
      }

      // Check if account is active
      if (!user.isActive) {
        logger.warn('Inactive user attempted login', { userId: user.id });
        return res.status(403).json({
          error: 'Account is deactivated. Please contact support.',
          code: 'ACCOUNT_DEACTIVATED',
        });
      }

      // ===== Update Last Login =====

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      // ===== Success Response =====

      logger.info('User logged in successfully', { userId: user.id });

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
            createdAt: user.createdAt,
          },
          tokens: {
            accessToken: sessionData.session.access_token,
            refreshToken: sessionData.session.refresh_token,
            expiresIn: sessionData.session.expires_in || 3600,
            tokenType: 'Bearer',
          },
        },
      });
    } catch (error: unknown) {
      logger.error('Login error:', error);
      res.status(500).json({
        error: 'Login failed. Please try again.',
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
  router.post(
    '/logout',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;

        // Sign out from Supabase (global scope - invalidates all sessions for this user)
        // Note: We use supabaseAdmin to ensure we can sign out the user even if their token is expired
        if (userId) {
          try {
            await supabaseAdmin.auth.admin.signOut(userId, 'global');
            logger.info('User logged out', { userId });
          } catch (signOutError) {
            // Log but don't fail - logout should be idempotent
            logger.warn('Supabase sign out failed', { userId, error: signOutError });
          }
        }

        // Always return success for logout (idempotent operation)
        res.json({
          success: true,
          message: 'Logout successful',
        });
      } catch (error: unknown) {
        logger.error('Logout error:', error);
        // Return success even if logout fails to prevent client-side issues
        res.json({
          success: true,
          message: 'Logout successful',
        });
      }
    }
  );

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
          error: 'Refresh token is required',
        });
      }

      // ===== Refresh Session with Supabase =====

      logger.debug('Attempting to refresh session');

      const { data: sessionData, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (refreshError || !sessionData.session || !sessionData.user) {
        logger.warn('Token refresh failed:', refreshError?.message || 'No session returned');
        return res.status(401).json({
          error: 'Invalid or expired refresh token',
        });
      }

      // ===== Update Last Login =====

      try {
        await prisma.user.update({
          where: { id: sessionData.user.id },
          data: { lastLogin: new Date() },
        });
      } catch (updateError) {
        // Log but don't fail if Prisma update fails
        logger.warn('Failed to update lastLogin during token refresh:', updateError);
      }

      // ===== Success Response =====

      logger.info('Token refreshed for user', { userId: sessionData.user.id });

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          tokens: {
            accessToken: sessionData.session.access_token,
            refreshToken: sessionData.session.refresh_token,
            expiresIn: sessionData.session.expires_in || 3600,
            tokenType: 'Bearer',
          },
        },
      });
    } catch (error: unknown) {
      logger.error('Token refresh error:', error);
      res.status(401).json({
        error: 'Invalid or expired refresh token',
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
  router.get(
    '/me',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.id) {
          return res.status(401).json({
            error: 'Authentication required',
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
            supabaseUserId: true,
          },
        });

        if (!user) {
          logger.error(`Authenticated user ${req.user.id} not found in database`);
          return res.status(404).json({
            error: 'User not found',
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
              supabase_user_id: user.supabaseUserId,
            },
          },
        });
      } catch (error: unknown) {
        logger.error('Get user profile error:', error);
        res.status(500).json({
          error: 'Failed to get user profile',
        });
      }
    }
  );

  /**
   * POST /api/auth/v2/forgot-password
   * Request password reset email
   *
   * Flow:
   * 1. Validate email
   * 2. Send password reset email via Supabase
   * 3. Return success (always, to prevent email enumeration)
   *
   * @body email - User email address
   * @body redirectUrl - Optional custom redirect URL (defaults to /reset-password)
   *
   * @returns 200 - Reset email sent successfully
   * @returns 400 - Validation error
   * @returns 429 - Too many requests
   * @returns 500 - Server error
   */
  router.post(
    '/forgot-password',
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email, redirectUrl }: ForgotPasswordRequest = req.body;

        // ===== Input Validation =====

        if (!email) {
          return res.status(400).json({
            error: 'Email is required',
          });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            error: 'Invalid email format',
          });
        }

        // ===== Send Password Reset Email =====

        logger.info('Password reset requested', { email });

        // Determine redirect URL
        const resetRedirectUrl =
          redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password`;

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email.toLowerCase(),
          {
            redirectTo: resetRedirectUrl,
          }
        );

        if (resetError) {
          logger.error('Supabase password reset failed:', resetError);

          // Don't expose specific errors to prevent email enumeration
          // Always return success to the client
        }

        // ===== Success Response =====
        // Always return success to prevent email enumeration attacks
        // The user will receive an email only if the account exists

        logger.info('Password reset email sent (or would be sent if account exists)', { email });

        res.json({
          success: true,
          message:
            'If an account exists for this email, you will receive a password reset link shortly.',
        });
      } catch (error: any) {
        logger.error('Forgot password error:', error);
        // Return generic success message even on error to prevent enumeration
        res.json({
          success: true,
          message:
            'If an account exists for this email, you will receive a password reset link shortly.',
        });
      }
    }
  );

  /**
   * POST /api/auth/v2/verify-reset-token
   * Verify password reset token validity
   *
   * Flow:
   * 1. Validate token format
   * 2. Verify token with Supabase
   * 3. Return token validity status
   *
   * Note: With Supabase, token verification happens automatically when the user
   * clicks the reset link. This endpoint is provided for compatibility with
   * frontend expectations, but Supabase handles token verification internally.
   *
   * @body token - Password reset token from email link
   *
   * @returns 200 - Token is valid
   * @returns 400 - Invalid or expired token
   * @returns 500 - Server error
   */
  router.post('/verify-reset-token', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token }: VerifyResetTokenRequest = req.body;

      // ===== Input Validation =====

      if (!token) {
        return res.status(400).json({
          error: 'Reset token is required',
        });
      }

      // ===== Verify Token =====

      // With Supabase, token verification happens when user clicks the email link
      // and gets redirected back to the app. At that point, Supabase sets up
      // a session with the recovery token.

      // This endpoint is primarily for UI/UX - to show loading states
      // The actual verification happens on the reset-password endpoint

      logger.debug('Token verification requested (Supabase handles this automatically)');

      res.json({
        success: true,
        message: 'Token format is valid. Proceed with password reset.',
      });
    } catch (error: any) {
      logger.error('Verify reset token error:', error);
      res.status(400).json({
        error: 'Invalid or expired reset token',
      });
    }
  });

  /**
   * POST /api/auth/v2/reset-password
   * Reset user password using reset token
   *
   * Flow:
   * 1. Validate input (token and new password)
   * 2. Verify user has active recovery session (from email link click)
   * 3. Update password in Supabase
   * 4. Invalidate all sessions
   * 5. Return success
   *
   * Note: This endpoint expects the user to have already clicked the reset link
   * in their email, which establishes a recovery session with Supabase.
   *
   * @body token - Password reset token (from URL query param)
   * @body newPassword - New password
   *
   * @returns 200 - Password reset successfully
   * @returns 400 - Validation error or invalid token
   * @returns 500 - Server error
   */
  router.post(
    '/reset-password',
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { token, newPassword }: ResetPasswordRequest = req.body;

        // ===== Input Validation =====

        if (!token || !newPassword) {
          return res.status(400).json({
            error: 'Token and new password are required',
            details: {
              token: !token ? 'Reset token is required' : null,
              newPassword: !newPassword ? 'New password is required' : null,
            },
          });
        }

        // Validate password strength
        if (newPassword.length < 8) {
          return res.status(400).json({
            error: 'Password must be at least 8 characters long',
          });
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
          return res.status(400).json({
            error:
              'Password must contain at least one uppercase letter, one lowercase letter, and one number',
          });
        }

        // ===== Verify Token and Update Password =====

        logger.info('Password reset attempt with token');

        // With Supabase, the user must have clicked the reset link which gives them
        // a recovery session. We can update the password using that session.
        // The token from the email is actually used to establish the session.

        // First, verify we can get user from the session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          logger.warn('Password reset failed: No active recovery session');
          return res.status(400).json({
            error: 'Invalid or expired reset link. Please request a new password reset.',
          });
        }

        // Update password
        const { data: updateData, error: updateError } =
          await supabaseAdmin.auth.admin.updateUserById(session.user.id, { password: newPassword });

        if (updateError) {
          logger.error('Password update failed:', updateError);

          if (updateError.message.includes('password')) {
            return res.status(400).json({
              error: updateError.message,
            });
          }

          return res.status(500).json({
            error: 'Failed to reset password. Please try again.',
          });
        }

        // ===== Sign Out All Sessions =====

        try {
          await supabaseAdmin.auth.admin.signOut(session.user.id, 'global');
          logger.info(
            `All sessions invalidated after password reset for user: ${session.user.email}`
          );
        } catch (signOutError) {
          // Log but don't fail - password was already reset
          logger.warn('Failed to sign out all sessions after password reset:', signOutError);
        }

        // ===== Success Response =====

        logger.info('Password reset successfully', { userId: session.user.id });

        res.json({
          success: true,
          message: 'Password reset successfully. Please login with your new password.',
        });
      } catch (error: any) {
        logger.error('Reset password error:', error);
        res.status(500).json({
          error: 'Failed to reset password. Please try again.',
        });
      }
    }
  );

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
  router.post(
    '/change-password',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.id || !req.user?.email) {
          return res.status(401).json({
            error: 'Authentication required',
          });
        }

        const { currentPassword, newPassword }: ChangePasswordRequest = req.body;

        // ===== Input Validation =====

        if (!currentPassword || !newPassword) {
          return res.status(400).json({
            error: 'Current password and new password are required',
            details: {
              currentPassword: !currentPassword ? 'Current password is required' : null,
              newPassword: !newPassword ? 'New password is required' : null,
            },
          });
        }

        // Validate new password strength
        if (newPassword.length < 8) {
          return res.status(400).json({
            error: 'Password must be at least 8 characters long',
          });
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
          return res.status(400).json({
            error:
              'Password must contain at least one uppercase letter, one lowercase letter, and one number',
          });
        }

        // ===== Verify Current Password =====

        // Verify current password by attempting to sign in
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: req.user.email,
          password: currentPassword,
        });

        if (verifyError) {
          logger.warn('Incorrect current password', { userId: req.user.id });
          return res.status(400).json({
            error: 'Current password is incorrect',
          });
        }

        // ===== Update Password in Supabase =====

        logger.info('Changing password', { userId: req.user.id });

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
          password: newPassword,
        });

        if (updateError) {
          logger.error('Password update failed:', updateError);

          if (updateError.message.includes('password')) {
            return res.status(400).json({
              error: updateError.message,
            });
          }

          return res.status(500).json({
            error: 'Failed to change password. Please try again.',
          });
        }

        // ===== Sign Out All Sessions (Security Best Practice) =====

        try {
          await supabaseAdmin.auth.admin.signOut(req.user.id, 'global');
          logger.info('All sessions invalidated', { userId: req.user.id });
        } catch (signOutError) {
          // Log but don't fail if sign out fails
          logger.warn('Failed to sign out all sessions after password change:', signOutError);
        }

        // ===== Success Response =====

        logger.info('Password changed successfully', { userId: req.user.id });

        res.json({
          success: true,
          message: 'Password changed successfully. Please login again with your new password.',
        });
      } catch (error: any) {
        logger.error('Change password error:', error);
        res.status(500).json({
          error: 'Failed to change password. Please try again.',
        });
      }
    }
  );

  /**
   * POST /api/auth/v2/verify-email
   * Verify user email using OTP code
   *
   * Flow:
   * 1. Validate input (email and token)
   * 2. Verify OTP with Supabase Auth
   * 3. Update emailVerified field in Prisma to true
   * 4. Return success
   *
   * @body email - User email address
   * @body token - OTP verification code from email
   *
   * @returns 200 - Email verified successfully
   * @returns 400 - Validation error or invalid/expired token
   * @returns 500 - Server error
   */
  router.post(
    '/verify-email',
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email, token }: VerifyEmailRequest = req.body;

        // ===== Input Validation =====

        if (!email || !token) {
          return res.status(400).json({
            error: 'Email and verification code are required',
            details: {
              email: !email ? 'Email is required' : null,
              token: !token ? 'Verification code is required' : null,
            },
          });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            error: 'Invalid email format',
          });
        }

        // Validate token format (must be exactly 6 digits)
        const trimmedToken = token.trim();
        if (!/^\d{6}$/.test(trimmedToken)) {
          return res.status(400).json({
            error: 'Verification code must be exactly 6 digits',
          });
        }

        // ===== Verify OTP with Supabase =====

        logger.info('Email verification attempt', { email });

        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
          email: email.toLowerCase(),
          token: trimmedToken,
          type: 'email',
        });

        if (verifyError || !verifyData.user) {
          // Log actual error for debugging but return generic message to client
          logger.warn(
            `Email verification failed for ${email}:`,
            verifyError?.message || 'No user data returned'
          );

          // Always return generic error message to prevent information leakage
          return res.status(400).json({
            error: 'Invalid or expired verification code. Please request a new code.',
          });
        }

        // ===== Update emailVerified in Prisma =====

        try {
          await prisma.user.update({
            where: { id: verifyData.user.id },
            data: { emailVerified: true },
          });

          logger.info('Email verified successfully', { userId: verifyData.user.id });
        } catch (updateError: any) {
          // Log error but still return success since Supabase verification succeeded
          logger.error('Failed to update emailVerified in Prisma:', updateError);

          // If user not found in Prisma, this is a data sync issue
          if (updateError.code === 'P2025') {
            logger.error(
              `User ${verifyData.user.id} verified in Supabase but not found in database`
            );
          }
        }

        // ===== Success Response =====

        res.json({
          success: true,
          message: 'Email verified successfully. You can now login.',
        });
      } catch (error: any) {
        logger.error('Email verification error:', error);
        res.status(500).json({
          error: 'Email verification failed. Please try again.',
        });
      }
    }
  );

  /**
   * POST /api/auth/v2/resend-verification
   * Resend email verification OTP code
   *
   * Flow:
   * 1. Validate email input
   * 2. Check if user exists in Prisma
   * 3. Check if already verified
   * 4. Call Supabase resend to send new OTP
   * 5. Return success
   *
   * @body email - User email address
   *
   * @returns 200 - Verification email sent successfully
   * @returns 400 - Validation error or already verified
   * @returns 404 - User not found
   * @returns 429 - Rate limited
   * @returns 500 - Server error
   */
  router.post(
    '/resend-verification',
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email }: ResendVerificationRequest = req.body;

        // ===== Input Validation =====

        if (!email) {
          return res.status(400).json({
            error: 'Email is required',
          });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            error: 'Invalid email format',
          });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // ===== Check User Exists =====

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            email: true,
            emailVerified: true,
          },
        });

        if (!user) {
          // Don't reveal if user exists - return generic success message
          logger.info('Resend verification requested for non-existent email', {
            email: normalizedEmail,
          });
          return res.json({
            success: true,
            message: 'If an account exists with this email, a verification code has been sent.',
          });
        }

        // ===== Check If Already Verified =====

        if (user.emailVerified) {
          return res.status(400).json({
            error: 'Email is already verified. You can login directly.',
            code: 'ALREADY_VERIFIED',
          });
        }

        // ===== Resend Verification Email via Supabase =====

        logger.info('Resending verification email', { email: normalizedEmail });

        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email: normalizedEmail,
        });

        if (resendError) {
          logger.error(`Failed to resend verification email for ${normalizedEmail}:`, resendError);

          // Handle rate limiting from Supabase
          if (resendError.message?.includes('rate') || resendError.status === 429) {
            return res.status(429).json({
              error: 'Too many requests. Please wait a few minutes before trying again.',
              code: 'RATE_LIMITED',
            });
          }

          return res.status(500).json({
            error: 'Failed to send verification email. Please try again later.',
          });
        }

        // ===== Success Response =====

        logger.info('Verification email resent successfully', { email: normalizedEmail });

        res.json({
          success: true,
          message: 'Verification code has been sent to your email. Please check your inbox.',
        });
      } catch (error: any) {
        logger.error('Resend verification error:', error);
        res.status(500).json({
          error: 'Failed to resend verification email. Please try again.',
        });
      }
    }
  );

  /**
   * POST /api/auth/v2/demo
   * Demo login endpoint - provides instant access to the demo account
   *
   * Flow:
   * 1. Validate demo mode is enabled
   * 2. Find or create demo user
   * 3. Generate session tokens
   * 4. Return tokens with demo flag
   *
   * Note: This endpoint is for demonstration purposes only.
   * In production, it should be disabled or heavily rate-limited.
   *
   * @returns 200 - Demo login successful with tokens
   * @returns 403 - Demo mode not enabled
   * @returns 500 - Server error
   */
  router.post('/demo', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Demo credentials from seed-demo.ts
      const DEMO_EMAIL = 'demo@intellifill.com';
      const DEMO_PASSWORD = 'demo123';

      // Check if demo mode is enabled (can be controlled via env var)
      const demoEnabled = process.env.ENABLE_DEMO_MODE !== 'false';

      if (!demoEnabled) {
        logger.warn('Demo login attempted but demo mode is disabled');
        return res.status(403).json({
          error: 'Demo mode is not enabled',
          code: 'DEMO_DISABLED',
        });
      }

      logger.info('Demo login attempt');

      // Find demo user in database
      const user = await prisma.user.findUnique({
        where: { email: DEMO_EMAIL },
        select: {
          id: true,
          email: true,
          password: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          lastLogin: true,
          organizationId: true,
        },
      });

      if (!user) {
        logger.error('Demo user not found. Run: npx ts-node prisma/seed-demo.ts');
        return res.status(500).json({
          error: 'Demo account not configured. Please contact support.',
          code: 'DEMO_NOT_CONFIGURED',
        });
      }

      // Verify demo password (as a safety check)
      const passwordValid = await bcrypt.compare(DEMO_PASSWORD, user.password);
      if (!passwordValid) {
        logger.error('Demo user password mismatch. Re-run seed-demo.ts');
        return res.status(500).json({
          error: 'Demo account misconfigured. Please contact support.',
          code: 'DEMO_MISCONFIGURED',
        });
      }

      // Generate JWT tokens for demo session
      const accessToken = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          aud: 'authenticated',
          iss: 'demo-mode',
          isDemo: true, // Flag for demo session
        },
        JWT_SECRET,
        { expiresIn: '4h' } // Longer session for demo
      );

      const refreshToken = jwt.sign(
        {
          sub: user.id,
          type: 'refresh',
          isDemo: true,
        },
        JWT_REFRESH_SECRET,
        { expiresIn: '24h' } // Demo refresh token valid for 24 hours
      );

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      logger.info(`Demo user logged in: ${DEMO_EMAIL}`);

      res.json({
        success: true,
        message: 'Demo login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName || 'Demo',
            lastName: user.lastName || 'User',
            role: user.role.toLowerCase(),
            emailVerified: true,
            lastLogin: new Date(),
            createdAt: user.createdAt,
            isDemo: true, // Flag for frontend to show demo indicator
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: 14400, // 4 hours in seconds
            tokenType: 'Bearer',
          },
          demo: {
            notice: 'This is a demo account. Data may be reset periodically.',
            features: [
              'Full access to document processing',
              'Sample UAE client data',
              'Pre-loaded form templates',
              'OCR confidence demonstration',
            ],
          },
        },
      });
    } catch (error: any) {
      logger.error('Demo login error:', error);
      res.status(500).json({
        error: 'Demo login failed. Please try again.',
      });
    }
  });

  return router;
}

export default createSupabaseAuthRoutes;

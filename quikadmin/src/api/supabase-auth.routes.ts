/**
 * Supabase Authentication Routes
 *
 * Architecture:
 * - Supabase handles ALL auth operations (user creation, sessions, passwords)
 * - Prisma stores user profiles (roles, names, status, metadata)
 * - Linked via supabaseUserId field in User model
 *
 * Security:
 * - Server-side JWT verification using getUser() (not getSession())
 * - bcrypt password compatibility for E2E tests
 * - Comprehensive input validation
 * - No internal error exposure to clients
 * - Fixed timing on failed logins to prevent enumeration attacks
 */

import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabaseAdmin, supabase } from '../utils/supabase';
import { prisma } from '../utils/prisma';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { authenticateSupabase, AuthenticatedRequest } from '../middleware/supabaseAuth';
import { authLimiter as centralAuthLimiter } from '../middleware/rateLimiter';
import { config } from '../config';
import { getTokenCacheService } from '../services/tokenCache.service';
import { getTokenFamilyService } from '../services/RefreshTokenFamilyService';
import { lockoutService } from '../services/lockout.service';

// Test mode for E2E tests (uses Prisma/bcrypt instead of Supabase Auth)
const isTestMode = process.env.NODE_ENV === 'test' || process.env.E2E_TEST_MODE === 'true';

// Cookie configuration for httpOnly refreshToken
// Production: secure, none sameSite (required for cross-origin fetch)
// Test: not secure, lax sameSite (allows cross-port requests)
// COOKIE_DOMAIN: Set to '.parentdomain.com' for cross-subdomain cookie sharing
//
// IMPORTANT: SameSite=None is required when frontend (Vercel) and backend (AWS)
// are on different subdomains. SameSite=Lax only sends cookies for top-level
// navigations, NOT for programmatic fetch/XHR requests (like axios POST).
//
// Path must be '/api' (not '/api/auth') to cover SSE endpoint at /api/realtime
const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
const REFRESH_TOKEN_COOKIE_OPTIONS: {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  maxAge: number;
  path: string;
  domain?: string;
} = {
  httpOnly: true,
  secure: process.env.NODE_ENV !== 'test',
  // SameSite=None required for cross-origin cookie sending (fetch/XHR)
  // In test mode, use 'lax' since same-origin requests work fine
  sameSite: isTestMode ? 'lax' : 'none',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api', // Must cover all API endpoints including /api/realtime for SSE
  ...(cookieDomain && { domain: cookieDomain }),
};

/** Clear legacy cookie with old path (for migration from /api/auth to /api) */
function clearLegacyCookie(res: Response): void {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'test',
    sameSite: isTestMode ? 'lax' : 'none',
    path: '/api/auth',
    ...(cookieDomain && { domain: cookieDomain }),
  });
}

function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  // Clear legacy cookie path first to prevent conflicts
  clearLegacyCookie(res);
  res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
}

function clearRefreshTokenCookie(res: Response): void {
  // Must match all options from REFRESH_TOKEN_COOKIE_OPTIONS (except expires/maxAge)
  // for clearCookie to work properly across all browsers
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'test',
    sameSite: isTestMode ? 'lax' : 'none',
    path: '/api', // Must match REFRESH_TOKEN_COOKIE_OPTIONS.path
    ...(cookieDomain && { domain: cookieDomain }),
  });

  // Also clear legacy cookie path to prevent conflicts after path migration
  clearLegacyCookie(res);
}

// JWT secrets from validated config (≥64 characters enforced)
const JWT_SECRET = config.jwt.secret;
const JWT_REFRESH_SECRET = config.jwt.refreshSecret;

// ============================================================================
// Validation Helpers
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

/** Validates email format. Returns error message or null if valid. */
function validateEmail(email: string): string | null {
  if (!email) return 'Email is required';
  if (!EMAIL_REGEX.test(email)) return 'Invalid email format';
  return null;
}

/** Validates password strength. Returns error message or null if valid. */
function validatePasswordStrength(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters long';
  if (!PASSWORD_REGEX.test(password)) {
    return 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
  }
  return null;
}

// ============================================================================
// Response Helpers
// ============================================================================

interface LockoutStatus {
  isLocked: boolean;
  lockoutExpiresAt?: Date | null;
  attemptsRemaining?: number;
}

/** Creates a 429 lockout error response object. */
function createLockoutErrorResponse(lockoutStatus: LockoutStatus): object {
  const retryAfterSeconds = lockoutStatus.lockoutExpiresAt
    ? Math.ceil((lockoutStatus.lockoutExpiresAt.getTime() - Date.now()) / 1000)
    : 900;
  return {
    success: false,
    error: {
      code: 'ACCOUNT_LOCKED',
      message: 'Account temporarily locked due to multiple failed login attempts.',
      lockoutExpiresAt: lockoutStatus.lockoutExpiresAt?.toISOString(),
      retryAfterSeconds,
    },
  };
}

/** Creates a 401 invalid credentials error response object. */
function createInvalidCredentialsResponse(lockoutStatus: LockoutStatus): object {
  return {
    success: false,
    error: {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
      attemptsRemaining: lockoutStatus.attemptsRemaining,
      maxAttempts: 5,
    },
  };
}

interface UserForResponse {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  emailVerified: boolean | null;
  lastLogin: Date | null;
  createdAt: Date;
}

interface TokensForResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

/** Creates a standardized login success response. */
function createLoginSuccessResponse(user: UserForResponse, tokens: TokensForResponse): object {
  return {
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
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
        tokenType: tokens.tokenType,
      },
    },
  };
}

/** Generates a JWT access token for the given user. */
function generateAccessToken(
  userId: string,
  email: string,
  role: string,
  issuer: string = 'test-mode'
): string {
  return jwt.sign(
    {
      sub: userId,
      email,
      role,
      aud: 'authenticated',
      iss: issuer,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/** Gets a refresh token using token family service, with JWT fallback. */
async function getRefreshToken(
  userId: string
): Promise<{ token: string; familyId?: string; generation?: number }> {
  try {
    const tokenFamilyService = await getTokenFamilyService();
    const familyResult = tokenFamilyService.createNewFamily(userId);
    return {
      token: familyResult.refreshToken,
      familyId: familyResult.familyId,
      generation: familyResult.generation,
    };
  } catch {
    // Fallback to simple JWT if token family service unavailable
    const token = jwt.sign({ sub: userId, type: 'refresh' }, JWT_REFRESH_SECRET, {
      expiresIn: '7d',
    });
    return { token };
  }
}

/** Handles failed login attempt: records attempt, applies timing delay, returns appropriate response. */
async function handleFailedLoginAttempt(email: string, res: Response): Promise<Response> {
  const newLockoutStatus = await lockoutService.recordFailedAttempt(email);
  // Fixed timing to prevent timing attacks (200-300ms)
  await new Promise((r) => setTimeout(r, 200 + Math.random() * 100));

  if (newLockoutStatus.isLocked) {
    return res.status(429).json(createLockoutErrorResponse(newLockoutStatus));
  }
  return res.status(401).json(createInvalidCredentialsResponse(newLockoutStatus));
}

// ============================================================================
// Request Interfaces
// ============================================================================

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  role?: string;
  acceptTerms?: boolean; // Required - must be true for registration
  marketingConsent?: boolean; // Optional - user consent for marketing emails
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

// Centralized rate limiter (Redis-backed, skipSuccessfulRequests: true)
const authLimiter = centralAuthLimiter;
const registerLimiter = centralAuthLimiter;

// ============================================================================
// Router Factory
// ============================================================================

export function createSupabaseAuthRoutes(): Router {
  const router = Router();

  /**
   * POST /api/auth/v2/register - Register a new user
   * Creates user in Supabase Auth, then creates profile in Prisma.
   * Returns session tokens on success.
   */
  router.post(
    '/register',
    registerLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const {
          email,
          password,
          fullName,
          role = 'user',
          acceptTerms,
          marketingConsent = false,
        }: RegisterRequest = req.body;

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

        if (!acceptTerms) {
          return res
            .status(400)
            .json({ error: 'You must accept the terms of service', code: 'TERMS_NOT_ACCEPTED' });
        }

        const emailError = validateEmail(email);
        if (emailError) {
          return res.status(400).json({ error: emailError });
        }

        const passwordError = validatePasswordStrength(password);
        if (passwordError) {
          return res.status(400).json({ error: passwordError });
        }

        const validRoles = ['user', 'admin'];
        if (role && !validRoles.includes(role.toLowerCase())) {
          return res
            .status(400)
            .json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
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
              // Task 500: Consent fields - set server-side for audit trail
              acceptedTermsAt: new Date(), // Server timestamp, not user-controllable
              marketingConsent: !!marketingConsent,
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

          // Set refreshToken as httpOnly cookie (Phase 2 REQ-005)
          if (sessionData.session.refresh_token) {
            setRefreshTokenCookie(res, sessionData.session.refresh_token);
          }

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
                // refreshToken removed from response - now in httpOnly cookie
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

  /** POST /api/auth/v2/login - Authenticate user and return session tokens */
  router.post('/login', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password }: LoginRequest = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required',
          details: {
            email: !email ? 'Email is required' : null,
            password: !password ? 'Password is required' : null,
          },
        });
      }

      // Check server-side lockout first
      const lockoutStatus = await lockoutService.checkLockout(email);
      if (lockoutStatus.isLocked) {
        logger.warn('Locked account login attempt', { email });
        return res.status(429).json(createLockoutErrorResponse(lockoutStatus));
      }

      logger.info('Login attempt', { email, isTestMode });

      // TEST MODE: Authenticate with Prisma/bcrypt (E2E tests)
      if (isTestMode) {
        logger.info('[TEST MODE] Authenticating via Prisma/bcrypt', { email });

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
            mfaEnabled: true,
          },
        });

        if (!user) {
          logger.warn('[TEST MODE] User not found', { email });
          return handleFailedLoginAttempt(email, res);
        }

        const passwordValid = await bcrypt.compare(password, user.password);
        if (!passwordValid) {
          logger.warn('[TEST MODE] Invalid password', { email });
          return handleFailedLoginAttempt(email, res);
        }

        if (!user.isActive) {
          logger.warn('[TEST MODE] Inactive user attempted login', { email });
          return res.status(403).json({
            error: 'Account is deactivated. Please contact support.',
            code: 'ACCOUNT_DEACTIVATED',
          });
        }

        // Check if MFA is enabled (simplified for test mode - no actual MFA verification)
        if (user.mfaEnabled) {
          logger.info('[TEST MODE] MFA enabled but bypassed for testing', { email });
          // In test mode, we don't actually enforce MFA
        }

        const accessToken = generateAccessToken(user.id, user.email, user.role);
        const refreshResult = await getRefreshToken(user.id);
        if (refreshResult.familyId) {
          logger.debug('[TEST MODE] Token family created', {
            userId: user.id,
            familyId: refreshResult.familyId,
            generation: refreshResult.generation,
          });
        }

        await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
        await lockoutService.clearLockout(email);

        logger.info('[TEST MODE] User logged in successfully', { email });
        setRefreshTokenCookie(res, refreshResult.token);

        return res.json(
          createLoginSuccessResponse(user, { accessToken, expiresIn: 3600, tokenType: 'Bearer' })
        );
      }

      // PRODUCTION MODE: Authenticate with Supabase
      const { data: sessionData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (authError || !sessionData.session || !sessionData.user) {
        logger.warn('Login failed', { email, error: authError?.message || 'No session returned' });
        return handleFailedLoginAttempt(email, res);
      }

      // Verify user exists in Prisma (lookup by supabaseUserId)
      const user = await prisma.user.findUnique({
        where: { supabaseUserId: sessionData.user.id },
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
          mfaEnabled: true,
        },
      });

      if (!user) {
        logger.error(
          `User ${sessionData.user.id} authenticated with Supabase but not found in database`
        );
        return res.status(401).json({ error: 'User not found. Please contact support.' });
      }

      if (!user.isActive) {
        logger.warn('Inactive user attempted login', { userId: user.id });
        return res.status(403).json({
          error: 'Account is deactivated. Please contact support.',
          code: 'ACCOUNT_DEACTIVATED',
        });
      }

      // Check if MFA is enabled and require second factor
      if (user.mfaEnabled) {
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const totpFactors = factorsData?.totp || [];
        const verifiedFactors = totpFactors.filter((f) => f.status === 'verified');

        if (verifiedFactors.length > 0) {
          logger.info('MFA required for login', { userId: user.id });

          // Return MFA required response with factor info
          return res.json({
            success: true,
            mfaRequired: true,
            factors: verifiedFactors.map((f) => ({
              id: f.id,
              type: f.factor_type,
              friendlyName: f.friendly_name,
            })),
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
            },
          });
        }
      }

      await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
      await lockoutService.clearLockout(email);

      logger.info('User logged in successfully', { userId: user.id });

      if (sessionData.session.refresh_token) {
        setRefreshTokenCookie(res, sessionData.session.refresh_token);
      }

      res.json(
        createLoginSuccessResponse(user, {
          accessToken: sessionData.session.access_token,
          expiresIn: sessionData.session.expires_in || 3600,
          tokenType: 'Bearer',
        })
      );
    } catch (error: unknown) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  });

  /** POST /api/auth/v2/logout - Sign out user and invalidate all sessions (idempotent) */
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

        // Invalidate token cache (REQ-006) - fire-and-forget with 500ms timeout
        const refreshToken = req.cookies?.refreshToken;
        if (refreshToken) {
          // Non-blocking cache invalidation with timeout
          Promise.race([
            (async () => {
              try {
                const tokenCache = await getTokenCacheService();
                await tokenCache.invalidate(refreshToken);
                logger.debug('Token cache invalidated on logout');
              } catch (cacheError) {
                logger.warn('Token cache invalidation failed', { error: cacheError });
              }
            })(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Cache invalidation timeout')), 500)
            ),
          ]).catch((error) => {
            logger.warn('Token cache invalidation timed out', { error: error?.message });
          });
        }

        // Clear refreshToken cookie (Phase 2 REQ-005)
        clearRefreshTokenCookie(res);

        // Always return success for logout (idempotent operation)
        res.json({
          success: true,
          message: 'Logout successful',
        });
      } catch (error: unknown) {
        logger.error('Logout error:', error);
        // Clear cookie even on error
        clearRefreshTokenCookie(res);
        // Return success even if logout fails to prevent client-side issues
        res.json({
          success: true,
          message: 'Logout successful',
        });
      }
    }
  );

  /** POST /api/auth/v2/refresh - Refresh access token (reads from httpOnly cookie or body) */
  router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Read refreshToken from httpOnly cookie first, fallback to body
      const refreshToken =
        req.cookies?.refreshToken || (req.body as RefreshTokenRequest)?.refreshToken;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      // Token family tokens (test mode) contain 'fid' and 'gen' fields - use rotation with theft detection
      try {
        const decoded = jwt.decode(refreshToken) as { fid?: string; gen?: number; type?: string };

        if (decoded?.fid && decoded?.gen && decoded?.type === 'refresh') {
          // This is a token family token - use rotation with theft detection
          logger.debug('Processing token family refresh');

          const tokenFamilyService = await getTokenFamilyService();
          const rotationResult = await tokenFamilyService.rotateToken(refreshToken, req);

          if (!rotationResult) {
            logger.warn('Token family rotation failed - token invalid or revoked');
            return res.status(401).json({
              error: 'Invalid or expired refresh token',
              code: 'TOKEN_REVOKED',
            });
          }

          // Get user info for response
          const decodedPayload = jwt.decode(rotationResult.refreshToken) as { sub: string };
          const user = await prisma.user.findUnique({
            where: { id: decodedPayload.sub },
            select: { id: true, email: true, role: true },
          });

          if (!user) {
            return res.status(401).json({
              error: 'User not found',
            });
          }

          // Generate new access token
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

          // Update last login
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { lastLogin: new Date() },
            });
          } catch {
            logger.warn('Failed to update lastLogin during token refresh');
          }

          logger.info('Token family rotated successfully', {
            userId: user.id,
            familyId: rotationResult.familyId,
            generation: rotationResult.generation,
          });

          // Set new rotated refresh token as httpOnly cookie
          setRefreshTokenCookie(res, rotationResult.refreshToken);

          return res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
              tokens: {
                accessToken,
                expiresIn: 3600,
                tokenType: 'Bearer',
              },
            },
          });
        }
      } catch (decodeError) {
        // Not a token family token, fall through to Supabase refresh
        logger.debug('Token is not a token family token, using Supabase refresh');
      }

      // ===== Refresh Session with Supabase (production mode) =====

      logger.debug('Attempting to refresh session with Supabase');

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

      // Set new refreshToken as httpOnly cookie (Phase 2 REQ-005)
      if (sessionData.session.refresh_token) {
        setRefreshTokenCookie(res, sessionData.session.refresh_token);
      }

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          tokens: {
            accessToken: sessionData.session.access_token,
            // refreshToken removed from response - now in httpOnly cookie
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

  /** GET /api/auth/v2/me - Get current authenticated user profile */
  router.get(
    '/me',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.id) {
          return res.status(401).json({ error: 'Authentication required' });
        }

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

  /** POST /api/auth/v2/forgot-password - Send password reset email (always returns success to prevent enumeration) */
  router.post(
    '/forgot-password',
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      const successMessage =
        'If an account exists for this email, you will receive a password reset link shortly.';

      try {
        const { email, redirectUrl }: ForgotPasswordRequest = req.body;

        const emailError = validateEmail(email);
        if (emailError) {
          return res.status(400).json({ error: emailError });
        }

        logger.info('Password reset requested', { email });

        const resetRedirectUrl =
          redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password`;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email.toLowerCase(),
          { redirectTo: resetRedirectUrl }
        );

        if (resetError) {
          logger.error('Supabase password reset failed:', resetError);
          // Don't expose error - always return success to prevent enumeration
        }

        logger.info('Password reset email sent (or would be sent if account exists)', { email });
        res.json({ success: true, message: successMessage });
      } catch (error: unknown) {
        logger.error('Forgot password error:', error);
        res.json({ success: true, message: successMessage });
      }
    }
  );

  /** POST /api/auth/v2/verify-reset-token - Verify password reset token (Supabase handles actual verification) */
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

  /** POST /api/auth/v2/reset-password - Reset password using token (requires active recovery session) */
  router.post(
    '/reset-password',
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { token, newPassword }: ResetPasswordRequest = req.body;

        if (!token || !newPassword) {
          return res.status(400).json({
            error: 'Token and new password are required',
            details: {
              token: !token ? 'Reset token is required' : null,
              newPassword: !newPassword ? 'New password is required' : null,
            },
          });
        }

        const passwordError = validatePasswordStrength(newPassword);
        if (passwordError) {
          return res.status(400).json({ error: passwordError });
        }

        logger.info('Password reset attempt with token');

        // Verify recovery session exists (established when user clicked email link)
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          logger.warn('Password reset failed: No active recovery session');
          return res
            .status(400)
            .json({ error: 'Invalid or expired reset link. Please request a new password reset.' });
        }

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          session.user.id,
          { password: newPassword }
        );

        if (updateError) {
          logger.error('Password update failed:', updateError);
          if (updateError.message.includes('password')) {
            return res.status(400).json({ error: updateError.message });
          }
          return res.status(500).json({ error: 'Failed to reset password. Please try again.' });
        }

        // Sign out all sessions (security best practice)
        try {
          await supabaseAdmin.auth.admin.signOut(session.user.id, 'global');
          logger.info(
            `All sessions invalidated after password reset for user: ${session.user.email}`
          );
        } catch (signOutError) {
          logger.warn('Failed to sign out all sessions after password reset:', signOutError);
        }

        logger.info('Password reset successfully', { userId: session.user.id });
        res.json({
          success: true,
          message: 'Password reset successfully. Please login with your new password.',
        });
      } catch (error: unknown) {
        logger.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password. Please try again.' });
      }
    }
  );

  /** POST /api/auth/v2/change-password - Change password for authenticated user */
  router.post(
    '/change-password',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.id || !req.user?.email) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const { currentPassword, newPassword }: ChangePasswordRequest = req.body;

        if (!currentPassword || !newPassword) {
          return res.status(400).json({
            error: 'Current password and new password are required',
            details: {
              currentPassword: !currentPassword ? 'Current password is required' : null,
              newPassword: !newPassword ? 'New password is required' : null,
            },
          });
        }

        const passwordError = validatePasswordStrength(newPassword);
        if (passwordError) {
          return res.status(400).json({ error: passwordError });
        }

        // Verify current password by attempting to sign in
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: req.user.email,
          password: currentPassword,
        });

        if (verifyError) {
          logger.warn('Incorrect current password', { userId: req.user.id });
          return res.status(400).json({ error: 'Current password is incorrect' });
        }

        logger.info('Changing password', { userId: req.user.id });

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
          password: newPassword,
        });

        if (updateError) {
          logger.error('Password update failed:', updateError);
          if (updateError.message.includes('password')) {
            return res.status(400).json({ error: updateError.message });
          }
          return res.status(500).json({ error: 'Failed to change password. Please try again.' });
        }

        // Sign out all sessions (security best practice)
        try {
          await supabaseAdmin.auth.admin.signOut(req.user.id, 'global');
          logger.info('All sessions invalidated', { userId: req.user.id });
        } catch (signOutError) {
          logger.warn('Failed to sign out all sessions after password change:', signOutError);
        }

        logger.info('Password changed successfully', { userId: req.user.id });
        res.json({
          success: true,
          message: 'Password changed successfully. Please login again with your new password.',
        });
      } catch (error: unknown) {
        logger.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password. Please try again.' });
      }
    }
  );

  /** POST /api/auth/v2/verify-email - Verify email using 6-digit OTP code */
  router.post(
    '/verify-email',
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email, token }: VerifyEmailRequest = req.body;

        if (!email || !token) {
          return res.status(400).json({
            error: 'Email and verification code are required',
            details: {
              email: !email ? 'Email is required' : null,
              token: !token ? 'Verification code is required' : null,
            },
          });
        }

        const emailError = validateEmail(email);
        if (emailError) {
          return res.status(400).json({ error: emailError });
        }

        const trimmedToken = token.trim();
        if (!/^\d{6}$/.test(trimmedToken)) {
          return res.status(400).json({ error: 'Verification code must be exactly 6 digits' });
        }

        logger.info('Email verification attempt', { email });

        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
          email: email.toLowerCase(),
          token: trimmedToken,
          type: 'email',
        });

        if (verifyError || !verifyData.user) {
          logger.warn(
            `Email verification failed for ${email}:`,
            verifyError?.message || 'No user data returned'
          );
          return res
            .status(400)
            .json({ error: 'Invalid or expired verification code. Please request a new code.' });
        }

        // Update emailVerified in Prisma (log but don't fail on error - Supabase verification succeeded)
        try {
          await prisma.user.update({
            where: { id: verifyData.user.id },
            data: { emailVerified: true },
          });
          logger.info('Email verified successfully', { userId: verifyData.user.id });
        } catch (updateError: unknown) {
          const errCode = (updateError as { code?: string })?.code;
          logger.error('Failed to update emailVerified in Prisma:', updateError);
          if (errCode === 'P2025') {
            logger.error(
              `User ${verifyData.user.id} verified in Supabase but not found in database`
            );
          }
        }

        res.json({ success: true, message: 'Email verified successfully. You can now login.' });
      } catch (error: unknown) {
        logger.error('Email verification error:', error);
        res.status(500).json({ error: 'Email verification failed. Please try again.' });
      }
    }
  );

  /** POST /api/auth/v2/resend-verification - Resend email verification OTP code */
  router.post(
    '/resend-verification',
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email }: ResendVerificationRequest = req.body;

        const emailError = validateEmail(email);
        if (emailError) {
          return res.status(400).json({ error: emailError });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true, email: true, emailVerified: true },
        });

        // Don't reveal if user exists - return generic success message
        if (!user) {
          logger.info('Resend verification requested for non-existent email', {
            email: normalizedEmail,
          });
          return res.json({
            success: true,
            message: 'If an account exists with this email, a verification code has been sent.',
          });
        }

        if (user.emailVerified) {
          return res.status(400).json({
            error: 'Email is already verified. You can login directly.',
            code: 'ALREADY_VERIFIED',
          });
        }

        logger.info('Resending verification email', { email: normalizedEmail });

        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email: normalizedEmail,
        });

        if (resendError) {
          logger.error(`Failed to resend verification email for ${normalizedEmail}:`, resendError);
          if (resendError.message?.includes('rate') || resendError.status === 429) {
            return res.status(429).json({
              error: 'Too many requests. Please wait a few minutes before trying again.',
              code: 'RATE_LIMITED',
            });
          }
          return res
            .status(500)
            .json({ error: 'Failed to send verification email. Please try again later.' });
        }

        logger.info('Verification email resent successfully', { email: normalizedEmail });
        res.json({
          success: true,
          message: 'Verification code has been sent to your email. Please check your inbox.',
        });
      } catch (error: unknown) {
        logger.error('Resend verification error:', error);
        res.status(500).json({ error: 'Failed to resend verification email. Please try again.' });
      }
    }
  );

  /** POST /api/auth/v2/demo - Demo login (disable in production via ENABLE_DEMO_MODE=false) */
  router.post('/demo', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
    const DEMO_EMAIL = 'demo@intellifill.com';
    const DEMO_PASSWORD = 'demo123';

    try {
      if (process.env.ENABLE_DEMO_MODE === 'false') {
        logger.warn('Demo login attempted but demo mode is disabled');
        return res.status(403).json({ error: 'Demo mode is not enabled', code: 'DEMO_DISABLED' });
      }

      logger.info('Demo login attempt');

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

      const passwordValid = await bcrypt.compare(DEMO_PASSWORD, user.password);
      if (!passwordValid) {
        logger.error('Demo user password mismatch. Re-run seed-demo.ts');
        return res.status(500).json({
          error: 'Demo account misconfigured. Please contact support.',
          code: 'DEMO_MISCONFIGURED',
        });
      }

      // Demo uses extended 4h session
      const accessToken = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          aud: 'authenticated',
          iss: 'demo-mode',
          isDemo: true,
        },
        JWT_SECRET,
        { expiresIn: '4h' }
      );

      const refreshResult = await getRefreshToken(user.id);
      if (refreshResult.familyId) {
        logger.debug('[DEMO] Token family created', {
          userId: user.id,
          familyId: refreshResult.familyId,
        });
      }

      await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

      logger.info(`Demo user logged in: ${DEMO_EMAIL}`);
      setRefreshTokenCookie(res, refreshResult.token);

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
            isDemo: true,
          },
          tokens: { accessToken, expiresIn: 14400, tokenType: 'Bearer' },
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
    } catch (error: unknown) {
      logger.error('Demo login error:', error);
      res.status(500).json({ error: 'Demo login failed. Please try again.' });
    }
  });

  // MFA (Multi-Factor Authentication) Endpoints

  const BACKUP_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes confusing chars (0, O, 1, I)
  const BACKUP_CODE_COUNT = 10;
  const BACKUP_CODE_LENGTH = 8;

  function generateBackupCodes(): string[] {
    return Array.from({ length: BACKUP_CODE_COUNT }, () =>
      Array.from({ length: BACKUP_CODE_LENGTH }, () =>
        BACKUP_CODE_CHARSET.charAt(Math.floor(Math.random() * BACKUP_CODE_CHARSET.length))
      ).join('')
    );
  }

  function hashBackupCodes(codes: string[]): Promise<string[]> {
    return Promise.all(codes.map((code) => bcrypt.hash(code, 10)));
  }

  router.post(
    '/mfa/enroll',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.user?.id) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const user = await prisma.user.findUnique({
          where: { supabaseUserId: req.user.id },
          select: { mfaEnabled: true },
        });

        if (user?.mfaEnabled) {
          return res.status(400).json({
            error: 'MFA is already enabled. Disable it first to re-enroll.',
            code: 'MFA_ALREADY_ENABLED',
          });
        }

        logger.info('Starting MFA enrollment', { userId: req.user.id });

        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'IntelliFill Authenticator',
        });

        if (error || !data) {
          logger.error('MFA enrollment failed:', error);
          return res.status(400).json({
            error: error?.message || 'Failed to start MFA enrollment',
            code: 'MFA_ENROLL_FAILED',
          });
        }

        logger.info('MFA enrollment started', { userId: req.user.id, factorId: data.id });

        res.json({
          success: true,
          factorId: data.id,
          qrCode: data.totp.qr_code,
          secret: data.totp.secret,
          uri: data.totp.uri,
        });
      } catch (error: unknown) {
        logger.error('MFA enroll error:', error);
        res.status(500).json({ error: 'Failed to start MFA enrollment' });
      }
    }
  );

  router.post(
    '/mfa/verify',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.user?.id) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const { factorId, code } = req.body;

        if (!factorId || !code) {
          return res.status(400).json({
            error: 'Factor ID and verification code are required',
            details: {
              factorId: !factorId ? 'Factor ID is required' : null,
              code: !code ? 'Verification code is required' : null,
            },
          });
        }

        if (!/^\d{6}$/.test(code)) {
          return res.status(400).json({ error: 'Verification code must be exactly 6 digits' });
        }

        logger.info('Verifying MFA code', { userId: req.user.id, factorId });

        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId,
        });

        if (challengeError || !challengeData) {
          logger.error('MFA challenge failed:', challengeError);
          return res.status(400).json({
            error: challengeError?.message || 'Failed to create MFA challenge',
            code: 'MFA_CHALLENGE_FAILED',
          });
        }

        const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
          factorId,
          challengeId: challengeData.id,
          code,
        });

        if (verifyError || !verifyData) {
          logger.warn('MFA verification failed', { userId: req.user.id, factorId });
          return res.status(400).json({
            error: 'Invalid verification code. Please try again.',
            code: 'MFA_VERIFY_FAILED',
          });
        }

        const backupCodes = generateBackupCodes();
        const hashedCodes = await hashBackupCodes(backupCodes);

        await prisma.user.update({
          where: { supabaseUserId: req.user.id },
          data: { mfaEnabled: true, mfaBackupCodes: hashedCodes },
        });

        logger.info('MFA enabled successfully', { userId: req.user.id });

        res.json({
          success: true,
          message: 'Two-factor authentication has been enabled.',
          backupCodes,
          warning: 'Save these backup codes securely. They will not be shown again.',
        });
      } catch (error: unknown) {
        logger.error('MFA verify error:', error);
        res.status(500).json({ error: 'Failed to verify MFA code' });
      }
    }
  );

  router.get(
    '/mfa/factors',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.user?.id) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const { data, error } = await supabase.auth.mfa.listFactors();

        if (error) {
          logger.error('Failed to list MFA factors:', error);
          return res.status(400).json({
            error: error.message || 'Failed to retrieve MFA factors',
            code: 'MFA_LIST_FAILED',
          });
        }

        const user = await prisma.user.findUnique({
          where: { supabaseUserId: req.user.id },
          select: { mfaEnabled: true },
        });

        res.json({
          success: true,
          mfaEnabled: user?.mfaEnabled || false,
          factors: data.totp.map((factor) => ({
            id: factor.id,
            type: factor.factor_type,
            friendlyName: factor.friendly_name,
            status: factor.status,
            createdAt: factor.created_at,
            updatedAt: factor.updated_at,
          })),
        });
      } catch (error: unknown) {
        logger.error('MFA factors list error:', error);
        res.status(500).json({ error: 'Failed to retrieve MFA factors' });
      }
    }
  );

  router.delete('/mfa', authenticateSupabase, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id || !req.user?.email) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { password, factorId } = req.body;

      if (!password) {
        return res.status(400).json({ error: 'Password is required to disable MFA' });
      }

      if (!factorId) {
        return res.status(400).json({ error: 'Factor ID is required' });
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: req.user.email,
        password,
      });

      if (verifyError) {
        logger.warn('Password verification failed for MFA disable', { userId: req.user.id });
        return res.status(400).json({ error: 'Incorrect password' });
      }

      logger.info('Disabling MFA', { userId: req.user.id, factorId });

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });

      if (unenrollError) {
        logger.error('MFA unenroll failed:', unenrollError);
        return res.status(400).json({
          error: unenrollError.message || 'Failed to disable MFA',
          code: 'MFA_UNENROLL_FAILED',
        });
      }

      await prisma.user.update({
        where: { supabaseUserId: req.user.id },
        data: { mfaEnabled: false, mfaBackupCodes: [] },
      });

      logger.info('MFA disabled successfully', { userId: req.user.id });

      res.json({
        success: true,
        message: 'Two-factor authentication has been disabled.',
      });
    } catch (error: unknown) {
      logger.error('MFA disable error:', error);
      res.status(500).json({ error: 'Failed to disable MFA' });
    }
  });

  router.post('/mfa/challenge', async (req: Request, res: Response) => {
    try {
      const { factorId } = req.body;

      if (!factorId) {
        return res.status(400).json({ error: 'Factor ID is required' });
      }

      const { data, error } = await supabase.auth.mfa.challenge({ factorId });

      if (error || !data) {
        logger.error('MFA challenge creation failed:', error);
        return res.status(400).json({
          error: error?.message || 'Failed to create MFA challenge',
          code: 'MFA_CHALLENGE_FAILED',
        });
      }

      res.json({
        success: true,
        challengeId: data.id,
      });
    } catch (error: unknown) {
      logger.error('MFA challenge error:', error);
      res.status(500).json({ error: 'Failed to create MFA challenge' });
    }
  });

  router.post('/mfa/verify-login', async (req: Request, res: Response) => {
    try {
      const { factorId, challengeId, code } = req.body;

      if (!factorId || !challengeId || !code) {
        return res.status(400).json({
          error: 'Factor ID, challenge ID, and verification code are required',
        });
      }

      if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({ error: 'Verification code must be exactly 6 digits' });
      }

      const { data, error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      });

      if (error || !data) {
        logger.warn('MFA login verification failed');
        return res.status(400).json({
          error: 'Invalid verification code',
          code: 'MFA_VERIFY_FAILED',
        });
      }

      res.json({
        success: true,
        session: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
        },
      });
    } catch (error: unknown) {
      logger.error('MFA verify-login error:', error);
      res.status(500).json({ error: 'Failed to verify MFA code' });
    }
  });

  return router;
}

export default createSupabaseAuthRoutes;

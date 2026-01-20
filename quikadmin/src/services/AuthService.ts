/**
 * Authentication Service
 *
 * Extracts business logic from auth routes for better testability and maintainability.
 * Handles user registration, authentication (test mode + production), and session management.
 *
 * Architecture:
 * - Supabase handles ALL auth operations (user creation, sessions, passwords)
 * - Prisma stores user profiles (roles, names, status, metadata)
 * - Linked via supabaseUserId field in User model
 *
 * @module services/AuthService
 */

import bcrypt from 'bcrypt';
import { User as PrismaUser, UserRole } from '@prisma/client';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabaseAdmin, supabase } from '../utils/supabase';
import { prisma } from '../utils/prisma';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';

// ============================================================================
// Types
// ============================================================================

/** Subset of User fields returned from registration/login queries */
export interface AuthUser {
  id: string;
  email: string;
  password?: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean | null;
  createdAt: Date;
  lastLogin: Date | null;
  mfaEnabled?: boolean;
}

/** Result of Supabase user creation */
export interface SupabaseUserResult {
  user: SupabaseUser;
  error: null;
}

/** Error result from Supabase operations */
export interface SupabaseError {
  message: string;
  code?: string;
}

/** Result of Supabase authentication */
export interface SupabaseAuthResult {
  session: Session;
  user: SupabaseUser;
}

/** Result of login permission check */
export interface LoginPermissionResult {
  allowed: boolean;
  error?: string;
  code?: string;
}

/** MFA factors returned during login */
export interface MfaFactor {
  id: string;
  type: string;
  friendlyName: string | null;
}

/** Result indicating MFA is required */
export interface MfaRequiredResult {
  mfaRequired: true;
  factors: MfaFactor[];
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

// ============================================================================
// AuthService Class
// ============================================================================

export class AuthService {
  /**
   * Creates a user in Supabase Auth
   *
   * @param email - User's email address (will be lowercased)
   * @param password - User's password (validated before calling)
   * @param firstName - User's first name
   * @param lastName - User's last name
   * @param role - User role (will be uppercased)
   * @returns Supabase user on success
   * @throws Error with user-friendly message on failure
   */
  async createSupabaseUser(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: string
  ): Promise<SupabaseUser> {
    logger.info('Attempting to register user with Supabase', { email });

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: process.env.NODE_ENV === 'development',
      user_metadata: {
        firstName,
        lastName,
        role: role.toUpperCase(),
      },
    });

    if (authError) {
      logger.error('Supabase user creation failed:', authError);

      if (
        authError.message.includes('already registered') ||
        authError.message.includes('already exists')
      ) {
        const error = new Error('User with this email already exists');
        (error as any).code = 'USER_EXISTS';
        (error as any).status = 409;
        throw error;
      }

      if (authError.message.includes('password')) {
        const error = new Error(authError.message);
        (error as any).code = 'INVALID_PASSWORD';
        (error as any).status = 400;
        throw error;
      }

      const error = new Error('Registration failed. Please try again.');
      (error as any).status = 400;
      throw error;
    }

    if (!authData.user) {
      logger.error('Supabase user creation returned no user data');
      const error = new Error('Registration failed. Please try again.');
      (error as any).status = 500;
      throw error;
    }

    return authData.user;
  }

  /**
   * Creates a user profile in Prisma database
   *
   * @param supabaseUserId - The Supabase user ID (used as Prisma ID)
   * @param email - User's email address
   * @param firstName - User's first name
   * @param lastName - User's last name
   * @param role - User role
   * @param marketingConsent - Whether user consented to marketing
   * @returns Created user record
   * @throws Error with code 'USER_EXISTS' if email already exists
   */
  async createUserProfile(
    supabaseUserId: string,
    email: string,
    firstName: string,
    lastName: string,
    role: string,
    marketingConsent: boolean
  ): Promise<AuthUser> {
    try {
      const user = await prisma.user.create({
        data: {
          id: supabaseUserId,
          email: email.toLowerCase(),
          password: '',
          firstName,
          lastName,
          role: role.toUpperCase() as UserRole,
          isActive: true,
          emailVerified: process.env.NODE_ENV === 'development',
          supabaseUserId: supabaseUserId,
          acceptedTermsAt: new Date(),
          marketingConsent: !!marketingConsent,
        },
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

      logger.info('User profile created in Prisma', { email });
      return user;
    } catch (prismaError: unknown) {
      const errorMessage =
        prismaError instanceof Error ? prismaError.message : String(prismaError);
      logger.error('Prisma user creation failed:', errorMessage);

      if (
        typeof prismaError === 'object' &&
        prismaError !== null &&
        (prismaError as any).code === 'P2002'
      ) {
        const error = new Error('User with this email already exists');
        (error as any).code = 'USER_EXISTS';
        (error as any).status = 409;
        throw error;
      }

      const error = new Error('Registration failed. Please try again.');
      (error as any).status = 500;
      throw error;
    }
  }

  /**
   * Rolls back a Supabase user creation (used when Prisma profile creation fails)
   *
   * @param supabaseUserId - The Supabase user ID to delete
   */
  async rollbackSupabaseUser(supabaseUserId: string): Promise<void> {
    try {
      await supabaseAdmin.auth.admin.deleteUser(supabaseUserId);
      logger.info('Supabase user rollback successful');
    } catch (deleteError) {
      logger.error('Supabase user rollback failed:', deleteError);
    }
  }

  /**
   * Authenticates a user using bcrypt password comparison (for test mode)
   *
   * @param email - User's email address
   * @param password - Password to verify
   * @returns User if credentials are valid, null otherwise
   */
  async authenticateWithBcrypt(email: string, password: string): Promise<AuthUser | null> {
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
      return null;
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      logger.warn('[TEST MODE] Invalid password', { email });
      return null;
    }

    return user;
  }

  /**
   * Authenticates a user using Supabase (for production mode)
   *
   * @param email - User's email address
   * @param password - Password to verify
   * @returns Session and user data if valid, null otherwise
   */
  async authenticateWithSupabase(
    email: string,
    password: string
  ): Promise<SupabaseAuthResult | null> {
    const { data: sessionData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (authError || !sessionData.session || !sessionData.user) {
      logger.warn('Login failed', { email, error: authError?.message || 'No session returned' });
      return null;
    }

    return {
      session: sessionData.session,
      user: sessionData.user,
    };
  }

  /**
   * Retrieves user profile from Prisma by Supabase user ID
   *
   * @param supabaseUserId - The Supabase user ID
   * @returns User profile or null if not found
   */
  async getUserBySupabaseId(supabaseUserId: string): Promise<AuthUser | null> {
    const user = await prisma.user.findUnique({
      where: { supabaseUserId },
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

    return user;
  }

  /**
   * Verifies if a user is allowed to login (checks isActive status)
   *
   * @param user - User to check
   * @returns Object indicating if login is allowed and error details if not
   */
  verifyUserCanLogin(user: AuthUser): LoginPermissionResult {
    if (!user.isActive) {
      logger.warn('Inactive user attempted login', { userId: user.id });
      return {
        allowed: false,
        error: 'Account is deactivated. Please contact support.',
        code: 'ACCOUNT_DEACTIVATED',
      };
    }

    return { allowed: true };
  }

  /**
   * Checks if MFA is required for a user during login
   *
   * @param user - User attempting to login
   * @returns MfaRequiredResult if MFA needed, null otherwise
   */
  async checkMfaRequired(user: AuthUser): Promise<MfaRequiredResult | null> {
    if (!user.mfaEnabled) {
      return null;
    }

    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const totpFactors = factorsData?.totp || [];
    const verifiedFactors = totpFactors.filter((f) => f.status === 'verified');

    if (verifiedFactors.length > 0) {
      logger.info('MFA required for login', { userId: user.id });

      return {
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
      };
    }

    return null;
  }

  /**
   * Records a successful login by updating lastLogin timestamp
   *
   * @param userId - User ID to update
   */
  async recordLoginSuccess(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLogin: new Date() },
    });
  }

  /**
   * Signs in user immediately after registration to get session tokens
   *
   * @param email - User's email
   * @param password - User's password
   * @returns Session data or null if sign-in fails
   */
  async signInAfterRegistration(
    email: string,
    password: string
  ): Promise<Session | null> {
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (sessionError || !sessionData.session) {
      logger.warn('Failed to generate session after registration:', sessionError?.message);
      return null;
    }

    return sessionData.session;
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;

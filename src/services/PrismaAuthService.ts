import { PrismaClient, UserRole } from '@prisma/client';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface LoginRequest {
  email: string;
  password: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  role?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export class PrismaAuthService {
  private jwtSecret: string;
  private jwtRefreshSecret: string;
  private jwtExpiresIn: string;
  private refreshTokenExpiresIn: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET!;
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET!;
    
    if (!this.jwtSecret || !this.jwtRefreshSecret) {
      throw new Error('CRITICAL: JWT_SECRET and JWT_REFRESH_SECRET environment variables are required');
    }
    
    if (this.jwtSecret.length < 64 || this.jwtRefreshSecret.length < 64) {
      throw new Error('CRITICAL: JWT secrets must be at least 64 characters long');
    }
    
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m';
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
  }

  async register(userData: RegisterRequest): Promise<{ user: any; tokens: AuthTokens }> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email.toLowerCase() }
      });

      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password with bcrypt
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Parse full name into first and last name
      const nameParts = userData.fullName.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      // Create user
      const user = await prisma.user.create({
        data: {
          email: userData.email.toLowerCase(),
          password: hashedPassword,
          firstName,
          lastName,
          role: (userData.role?.toUpperCase() as UserRole) || UserRole.USER,
          isActive: true
        }
      });

      // Generate tokens
      const tokens = await this.generateTokens(user);

      logger.info(`User registered successfully: ${userData.email}`);

      // Return user without password
      const { password, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        tokens
      };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  async login(credentials: LoginRequest): Promise<{ user: any; tokens: AuthTokens }> {
    try {
      const user = await prisma.user.findUnique({
        where: { email: credentials.email }
      });

      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check if account is active
      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Verify password with bcrypt
      const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Return user without password
      const { password, ...userWithoutPassword } = user;
      
      return {
        user: userWithoutPassword,
        tokens
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  private async generateTokens(user: any): Promise<AuthTokens> {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    // SECURITY: Generate access token with strict algorithm specification
    const accessToken = jwt.sign(
      payload,
      this.jwtSecret,
      { 
        expiresIn: this.jwtExpiresIn,
        issuer: process.env.JWT_ISSUER || 'quikadmin-api',
        audience: process.env.JWT_AUDIENCE || 'quikadmin-client',
        algorithm: 'HS256', // Explicitly set algorithm
        notBefore: 0, // Valid immediately
        jwtid: crypto.randomUUID() // Add unique JWT ID
      } as jwt.SignOptions
    );

    // SECURITY: Generate refresh token with strict algorithm specification
    const refreshToken = jwt.sign(
      { ...payload, jti: crypto.randomUUID() }, // Add unique identifier
      this.jwtRefreshSecret,
      { 
        expiresIn: this.refreshTokenExpiresIn,
        issuer: process.env.JWT_ISSUER || 'quikadmin-api',
        audience: process.env.JWT_AUDIENCE || 'quikadmin-client',
        algorithm: 'HS256', // Explicitly set algorithm
        notBefore: 0
      } as jwt.SignOptions
    );

    // Clean up any existing refresh tokens for this user to prevent duplicates
    await prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
        OR: [
          { expiresAt: { lt: new Date() } }, // Delete expired tokens
          { expiresAt: { gt: new Date() } }  // Delete valid tokens (force re-login)
        ]
      }
    });

    // Store new refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      tokenType: 'Bearer'
    };
  }

  // Alias for backward compatibility
  async verifyAccessToken(token: string): Promise<any> {
    return this.verifyToken(token);
  }

  async verifyToken(token: string): Promise<any> {
    try {
      // SECURITY: Validate token format first
      if (!token || typeof token !== 'string') {
        throw new Error('Invalid token format');
      }

      // SECURITY: Check token structure (JWT must have 3 parts)
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Invalid token structure');
      }

      // SECURITY: Decode and check header for algorithm confusion attacks
      let header;
      try {
        header = JSON.parse(Buffer.from(tokenParts[0], 'base64url').toString());
      } catch {
        throw new Error('Invalid token header');
      }

      // SECURITY: Explicitly reject 'none' algorithm and enforce HS256 only
      if (!header.alg || header.alg === 'none' || header.alg !== 'HS256') {
        throw new Error('Invalid or unsupported algorithm');
      }

      // SECURITY: Verify token with industry-standard options
      const payload = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'], // Only accept HS256
        issuer: process.env.JWT_ISSUER || 'quikadmin-api',
        audience: process.env.JWT_AUDIENCE || 'quikadmin-client',
        clockTolerance: 30 // Industry standard: 30s clock drift tolerance
      }) as any;

      // SECURITY: Additional payload validation
      if (!payload || typeof payload !== 'object' || !payload.id || !payload.email) {
        throw new Error('Invalid token payload');
      }

      // SECURITY: Validate token expiration explicitly
      if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
        throw new Error('Token has expired');
      }

      return payload;
    } catch (error) {
      logger.error('Token verification error:', error);
      if (error instanceof jwt.JsonWebTokenError) {
        if (error.name === 'TokenExpiredError') {
          throw new Error('Token has expired');
        } else if (error.name === 'JsonWebTokenError') {
          throw new Error('Invalid token signature');
        } else if (error.name === 'NotBeforeError') {
          throw new Error('Token not active yet');
        }
      }
      throw new Error('Invalid token');
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, this.jwtRefreshSecret, {
        algorithms: ['HS256'],
        issuer: process.env.JWT_ISSUER || 'quikadmin-api',
        audience: process.env.JWT_AUDIENCE || 'quikadmin-client'
      }) as any;

      // Find stored refresh token
      const storedToken = await prisma.refreshToken.findFirst({
        where: {
          token: refreshToken,
          userId: payload.id,
          expiresAt: { gt: new Date() }
        }
      });

      if (!storedToken) {
        throw new Error('Invalid or expired refresh token');
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: payload.id }
      });

      if (!user || !user.isActive) {
        throw new Error('User not found or deactivated');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      logger.info(`Tokens refreshed for user: ${user.email}`);

      return tokens;
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw new Error('Invalid refresh token');
    }
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      // Delete the refresh token
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken }
      });
      logger.info('User logged out successfully');
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  }

  async logoutAllDevices(userId: string): Promise<void> {
    try {
      // Delete all refresh tokens for the user
      await prisma.refreshToken.deleteMany({
        where: { userId }
      });
      logger.info(`Logged out from all devices for user: ${userId}`);
    } catch (error) {
      logger.error('Logout all devices error:', error);
      throw error;
    }
  }

  async getUserProfile(userId: string): Promise<any> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
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
          lastLogin: true
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Convert to expected format
      return {
        id: user.id,
        email: user.email,
        full_name: `${user.firstName} ${user.lastName}`.trim(),
        role: user.role.toLowerCase(),
        is_active: user.isActive,
        email_verified: user.emailVerified,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
        last_login: user.lastLogin
      };
    } catch (error) {
      logger.error('Get user profile error:', error);
      throw error;
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Validate new password
      this.validatePassword(newPassword);

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: newPasswordHash }
      });

      // Revoke all refresh tokens to force re-login
      await this.logoutAllDevices(userId);

      logger.info(`Password changed for user: ${user.email}`);
    } catch (error) {
      logger.error('Change password error:', error);
      throw error;
    }
  }

  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    }
  }
}

export default PrismaAuthService;
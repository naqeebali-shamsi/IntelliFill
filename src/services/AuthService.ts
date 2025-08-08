import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { DatabaseService } from '../database/DatabaseService';
import { logger } from '../utils/logger';

export interface User {
  id: string;
  email: string;
  password_hash?: string;
  full_name: string;
  role: 'user' | 'admin' | 'api';
  is_active: boolean;
  email_verified: boolean;
  created_at: Date;
  updated_at: Date;
  last_login?: Date;
  login_attempts: number;
  locked_until?: Date;
  two_factor_enabled: boolean;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  last_used?: Date;
  is_revoked: boolean;
  device_info?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

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
  role?: 'user' | 'admin';
}

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export class AuthService {
  private db: DatabaseService;
  private jwtSecret: string;
  private jwtRefreshSecret: string;
  private jwtExpiresIn: string;
  private refreshTokenExpiresIn: string;
  private saltRounds: number;
  private maxLoginAttempts: number;
  private lockoutDuration: number; // in minutes

  constructor(db: DatabaseService) {
    this.db = db;
    this.jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret-key';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'your-jwt-refresh-secret-key';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m';
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
    this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    this.maxLoginAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
    this.lockoutDuration = parseInt(process.env.LOCKOUT_DURATION_MINUTES || '30');

    if (this.jwtSecret === 'your-jwt-secret-key' || this.jwtRefreshSecret === 'your-jwt-refresh-secret-key') {
      logger.warn('Using default JWT secrets. Please set JWT_SECRET and JWT_REFRESH_SECRET environment variables in production.');
    }
  }

  /**
   * Register a new user
   */
  async register(userData: RegisterRequest): Promise<{ user: Omit<User, 'password_hash'>; tokens: AuthTokens }> {
    try {
      // Check if user already exists
      const existingUser = await this.findUserByEmail(userData.email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Validate password strength
      this.validatePassword(userData.password);

      // Hash the password
      const passwordHash = await this.hashPassword(userData.password);

      // Create user
      const userId = crypto.randomUUID();
      const result = await this.db.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, email_verified, is_active) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id, email, full_name, role, is_active, email_verified, created_at, updated_at, last_login, login_attempts, locked_until, two_factor_enabled`,
        [userId, userData.email.toLowerCase(), passwordHash, userData.fullName, userData.role || 'user', false, true]
      );

      if (result.rowCount === 0) {
        throw new Error('Failed to create user');
      }

      const user = result.rows[0];
      
      // Generate tokens
      const tokens = await this.generateTokens(user);

      logger.info(`User registered successfully: ${userData.email}`);
      
      return {
        user: this.sanitizeUser(user),
        tokens
      };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Authenticate user and generate tokens
   */
  async login(credentials: LoginRequest): Promise<{ user: Omit<User, 'password_hash'>; tokens: AuthTokens }> {
    try {
      const user = await this.findUserByEmail(credentials.email);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check if account is locked
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const lockoutEnd = new Date(user.locked_until).toLocaleString();
        throw new Error(`Account is locked until ${lockoutEnd}`);
      }

      // Check if account is active
      if (!user.is_active) {
        throw new Error('Account is deactivated');
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(credentials.password, user.password_hash!);
      if (!isPasswordValid) {
        await this.handleFailedLogin(credentials.email);
        throw new Error('Invalid credentials');
      }

      // Reset login attempts on successful login
      await this.resetLoginAttempts(credentials.email);

      // Generate tokens
      const tokens = await this.generateTokens(user, credentials);

      logger.info(`User logged in successfully: ${credentials.email}`);
      
      return {
        user: this.sanitizeUser(user),
        tokens
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, this.jwtRefreshSecret) as TokenPayload;
      
      // Find refresh token in database
      const tokenHash = this.hashRefreshToken(refreshToken);
      const tokenRecord = await this.findRefreshToken(tokenHash);
      
      if (!tokenRecord || tokenRecord.is_revoked || new Date(tokenRecord.expires_at) < new Date()) {
        throw new Error('Invalid or expired refresh token');
      }

      // Find user
      const user = await this.findUserById(payload.id);
      if (!user || !user.is_active) {
        throw new Error('User not found or deactivated');
      }

      // Update last used timestamp
      await this.updateRefreshTokenLastUsed(tokenRecord.id);

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      logger.info(`Tokens refreshed for user: ${user.email}`);
      
      return tokens;
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Logout user by revoking refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      const tokenHash = this.hashRefreshToken(refreshToken);
      await this.revokeRefreshToken(tokenHash);
      logger.info('User logged out successfully');
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  }

  /**
   * Logout from all devices by revoking all user's refresh tokens
   */
  async logoutAllDevices(userId: string): Promise<void> {
    try {
      await this.db.query('UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1', [userId]);
      logger.info(`Logged out from all devices for user: ${userId}`);
    } catch (error) {
      logger.error('Logout all devices error:', error);
      throw error;
    }
  }

  /**
   * Verify JWT token
   */
  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as TokenPayload;
      
      // Optionally verify user still exists and is active
      const user = await this.findUserById(payload.id);
      if (!user || !user.is_active) {
        throw new Error('User not found or deactivated');
      }

      return payload;
    } catch (error) {
      logger.error('Token verification error:', error);
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<Omit<User, 'password_hash'>> {
    try {
      const user = await this.findUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      return this.sanitizeUser(user);
    } catch (error) {
      logger.error('Get user profile error:', error);
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await this.findUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await this.verifyPassword(currentPassword, user.password_hash!);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Validate new password
      this.validatePassword(newPassword);

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Update password
      await this.db.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newPasswordHash, userId]
      );

      // Revoke all refresh tokens to force re-login
      await this.logoutAllDevices(userId);

      logger.info(`Password changed for user: ${user.email}`);
    } catch (error) {
      logger.error('Change password error:', error);
      throw error;
    }
  }

  // Private helper methods

  private async findUserByEmail(email: string): Promise<User | null> {
    const result = await this.db.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    return result.rows[0] || null;
  }

  private async findUserById(id: string): Promise<User | null> {
    const result = await this.db.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    }
  }

  private async generateTokens(user: User, loginInfo?: Partial<LoginRequest>): Promise<AuthTokens> {
    const payload: TokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    // Generate access token
    const accessToken = jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
    
    // Generate refresh token
    const refreshToken = jwt.sign(payload, this.jwtRefreshSecret, { expiresIn: this.refreshTokenExpiresIn });
    
    // Store refresh token in database
    await this.storeRefreshToken(user.id, refreshToken, loginInfo);

    // Parse expiration time
    const expiresIn = this.parseExpirationTime(this.jwtExpiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer'
    };
  }

  private async storeRefreshToken(userId: string, refreshToken: string, loginInfo?: Partial<LoginRequest>): Promise<void> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.parseExpirationDays(this.refreshTokenExpiresIn));

    await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_info, ip_address, user_agent) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, tokenHash, expiresAt, loginInfo?.deviceInfo, loginInfo?.ipAddress, loginInfo?.userAgent]
    );
  }

  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    const result = await this.db.query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1',
      [tokenHash]
    );
    return result.rows[0] || null;
  }

  private async updateRefreshTokenLastUsed(tokenId: string): Promise<void> {
    await this.db.query(
      'UPDATE refresh_tokens SET last_used = CURRENT_TIMESTAMP WHERE id = $1',
      [tokenId]
    );
  }

  private async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.db.query(
      'UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1',
      [tokenHash]
    );
  }

  private async handleFailedLogin(email: string): Promise<void> {
    await this.db.query('SELECT handle_failed_login($1)', [email]);
  }

  private async resetLoginAttempts(email: string): Promise<void> {
    await this.db.query('SELECT reset_login_attempts($1)', [email]);
  }

  private sanitizeUser(user: User): Omit<User, 'password_hash'> {
    const { password_hash, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  private parseExpirationTime(timeStr: string): number {
    // Convert JWT expiration string to seconds
    const match = timeStr.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default 15 minutes

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 900;
    }
  }

  private parseExpirationDays(timeStr: string): number {
    // Convert expiration string to days
    const match = timeStr.match(/^(\d+)([smhd])$/);
    if (!match) return 7; // Default 7 days

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value / 86400;
      case 'm': return value / 1440;
      case 'h': return value / 24;
      case 'd': return value;
      default: return 7;
    }
  }
}
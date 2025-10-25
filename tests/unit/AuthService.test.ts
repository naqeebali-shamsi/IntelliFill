import { AuthService, RegisterRequest, LoginRequest } from '../../src/services/AuthService';
import { DatabaseService } from '../../src/database/DatabaseService';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../src/database/DatabaseService');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  let authService: AuthService;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    // Set required environment variables for testing
    process.env.JWT_SECRET = 'test_jwt_secret_that_is_long_enough_to_pass_validation_64_chars_min';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_that_is_long_enough_to_pass_validation_64_chars';
    
    mockDb = new DatabaseService() as jest.Mocked<DatabaseService>;
    authService = new AuthService(mockDb);
    jest.clearAllMocks();
  });

  describe('register', () => {
    const validUserData: RegisterRequest = {
      email: 'test@example.com',
      password: 'ValidPass123!',
      fullName: 'Test User',
      role: 'user'
    };

    it('should register a new user successfully', async () => {
      // Mock database responses
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // findUserByEmail returns no user
        .mockResolvedValueOnce({ 
          rows: [{
            id: 'user-123',
            email: 'test@example.com',
            full_name: 'Test User',
            role: 'user',
            is_active: true,
            email_verified: false,
            created_at: new Date(),
            updated_at: new Date(),
            login_attempts: 0,
            two_factor_enabled: false
          }],
          rowCount: 1
        }) // create user
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // store refresh token

      // Mock bcrypt
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      
      // Mock JWT
      (jwt.sign as jest.Mock)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await authService.register(validUserData);

      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.accessToken).toBe('access-token');
      expect(result.tokens.refreshToken).toBe('refresh-token');
      expect(bcrypt.hash).toHaveBeenCalledWith('ValidPass123!', 12);
    });

    it('should throw error if user already exists', async () => {
      mockDb.query.mockResolvedValueOnce({ 
        rows: [{ id: 'existing-user' }], 
        rowCount: 1 
      });

      await expect(authService.register(validUserData)).rejects.toThrow(
        'User with this email already exists'
      );
    });

    it('should validate password strength', async () => {
      const weakPasswordData = {
        ...validUserData,
        password: '123'
      };

      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(authService.register(weakPasswordData)).rejects.toThrow(
        'Password must be at least 8 characters long'
      );
    });
  });

  describe('login', () => {
    const loginData: LoginRequest = {
      email: 'test@example.com',
      password: 'ValidPass123!'
    };

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      password_hash: 'hashed-password',
      full_name: 'Test User',
      role: 'user',
      is_active: true,
      email_verified: true,
      locked_until: null,
      login_attempts: 0,
      two_factor_enabled: false
    };

    it('should login successfully with valid credentials', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 }) // findUserByEmail
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // resetLoginAttempts
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // store refresh token

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await authService.login(loginData);

      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.accessToken).toBe('access-token');
      expect(bcrypt.compare).toHaveBeenCalledWith('ValidPass123!', 'hashed-password');
    });

    it('should throw error for invalid credentials', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 }) // findUserByEmail
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // handleFailedLogin

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login(loginData)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error if account is locked', async () => {
      const lockedUser = {
        ...mockUser,
        locked_until: new Date(Date.now() + 1000 * 60 * 30) // 30 minutes from now
      };

      mockDb.query.mockResolvedValueOnce({ rows: [lockedUser], rowCount: 1 });

      await expect(authService.login(loginData)).rejects.toThrow('Account is locked until');
    });

    it('should throw error if account is inactive', async () => {
      const inactiveUser = {
        ...mockUser,
        is_active: false
      };

      mockDb.query.mockResolvedValueOnce({ rows: [inactiveUser], rowCount: 1 });

      await expect(authService.login(loginData)).rejects.toThrow('Account is deactivated');
    });
  });

  describe('refreshToken', () => {
    const refreshToken = 'valid-refresh-token';
    const mockTokenRecord = {
      id: 'token-123',
      user_id: 'user-123',
      token_hash: 'hashed-token',
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days from now
      is_revoked: false
    };

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'user',
      is_active: true
    };

    it('should refresh token successfully', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 'user-123', email: 'test@example.com', role: 'user' });

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockTokenRecord], rowCount: 1 }) // findRefreshToken
        .mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 }) // findUserById
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // updateRefreshTokenLastUsed
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // store new refresh token

      (jwt.sign as jest.Mock)
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await authService.refreshToken(refreshToken);

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should throw error for invalid refresh token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.refreshToken('invalid-token')).rejects.toThrow('Invalid refresh token');
    });

    it('should throw error for revoked refresh token', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 'user-123', email: 'test@example.com', role: 'user' });

      const revokedToken = { ...mockTokenRecord, is_revoked: true };
      mockDb.query.mockResolvedValueOnce({ rows: [revokedToken], rowCount: 1 });

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('verifyAccessToken', () => {
    const validToken = 'valid-access-token';
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'user',
      is_active: true
    };

    it('should verify token successfully', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ 
        id: 'user-123', 
        email: 'test@example.com', 
        role: 'user' 
      });
      
      mockDb.query.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 });

      const result = await authService.verifyAccessToken(validToken);

      expect(result.id).toBe('user-123');
      expect(result.email).toBe('test@example.com');
      expect(result.role).toBe('user');
    });

    it('should throw error for expired token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      await expect(authService.verifyAccessToken('expired-token')).rejects.toThrow('Invalid or expired token');
    });

    it('should throw error if user is deactivated', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ 
        id: 'user-123', 
        email: 'test@example.com', 
        role: 'user' 
      });
      
      const deactivatedUser = { ...mockUser, is_active: false };
      mockDb.query.mockResolvedValueOnce({ rows: [deactivatedUser], rowCount: 1 });

      await expect(authService.verifyAccessToken(validToken)).rejects.toThrow('Invalid or expired token');
    });
  });

  describe('changePassword', () => {
    const userId = 'user-123';
    const currentPassword = 'OldPass123!';
    const newPassword = 'NewPass456!';
    
    const mockUser = {
      id: userId,
      email: 'test@example.com',
      password_hash: 'current-password-hash'
    };

    it('should change password successfully', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 }) // findUserById
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // update password
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // revoke refresh tokens

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-password-hash');

      await authService.changePassword(userId, currentPassword, newPassword);

      expect(bcrypt.compare).toHaveBeenCalledWith(currentPassword, 'current-password-hash');
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
    });

    it('should throw error for incorrect current password', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.changePassword(userId, 'wrong-password', newPassword))
        .rejects.toThrow('Current password is incorrect');
    });

    it('should validate new password strength', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(authService.changePassword(userId, currentPassword, 'weak'))
        .rejects.toThrow('Password must be at least 8 characters long');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await authService.logout(refreshToken);

      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1',
        expect.any(Array)
      );
    });
  });

  describe('logoutAllDevices', () => {
    it('should logout from all devices successfully', async () => {
      const userId = 'user-123';
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await authService.logoutAllDevices(userId);

      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1',
        [userId]
      );
    });
  });
});
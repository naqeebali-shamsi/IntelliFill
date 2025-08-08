import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthService, LoginRequest, RegisterRequest } from '../services/AuthService';
import { DatabaseService } from '../database/DatabaseService';
import { logger } from '../utils/logger';
import { authenticate, AuthRequest } from '../middleware/auth';

export interface AuthRouterDependencies {
  db: DatabaseService;
}

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 attempts per window
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

export function createAuthRoutes({ db }: AuthRouterDependencies): Router {
  const router = Router();
  const authService = new AuthService(db);

  /**
   * POST /api/auth/register
   * Register a new user
   */
  router.post('/register', registerLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, fullName, role }: RegisterRequest = req.body;

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

      // Validate role if provided
      if (role && !['user', 'admin'].includes(role)) {
        return res.status(400).json({
          error: 'Invalid role. Must be either "user" or "admin"'
        });
      }

      const result = await authService.register({
        email,
        password,
        fullName,
        role
      });

      logger.info(`New user registered: ${email}`);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: result.user,
          tokens: result.tokens
        }
      });
    } catch (error: any) {
      logger.error('Registration error:', error);
      
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: 'User with this email already exists'
        });
      }
      
      if (error.message.includes('Password must')) {
        return res.status(400).json({
          error: error.message
        });
      }

      res.status(500).json({
        error: 'Registration failed. Please try again.'
      });
    }
  });

  /**
   * POST /api/auth/login
   * Authenticate user and return tokens
   */
  router.post('/login', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password }: LoginRequest = req.body;

      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required',
          details: {
            email: !email ? 'Email is required' : null,
            password: !password ? 'Password is required' : null
          }
        });
      }

      // Collect device information for security
      const loginData: LoginRequest = {
        email,
        password,
        deviceInfo: req.headers['user-device'] as string,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      };

      const result = await authService.login(loginData);

      // Set secure HTTP-only cookie for refresh token (optional)
      if (process.env.USE_REFRESH_TOKEN_COOKIE === 'true') {
        res.cookie('refreshToken', result.tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
      }

      logger.info(`User logged in: ${email}`);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          tokens: result.tokens
        }
      });
    } catch (error: any) {
      logger.error('Login error:', error);
      
      if (error.message.includes('Invalid credentials')) {
        return res.status(401).json({
          error: 'Invalid email or password'
        });
      }
      
      if (error.message.includes('locked')) {
        return res.status(423).json({
          error: error.message
        });
      }
      
      if (error.message.includes('deactivated')) {
        return res.status(403).json({
          error: 'Account is deactivated'
        });
      }

      res.status(500).json({
        error: 'Login failed. Please try again.'
      });
    }
  });

  /**
   * POST /api/auth/refresh
   * Refresh access token using refresh token
   */
  router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
      let refreshToken = req.body.refreshToken;
      
      // Try to get refresh token from cookie if not in body
      if (!refreshToken && req.cookies?.refreshToken) {
        refreshToken = req.cookies.refreshToken;
      }

      if (!refreshToken) {
        return res.status(400).json({
          error: 'Refresh token is required'
        });
      }

      const tokens = await authService.refreshToken(refreshToken);

      // Update refresh token cookie if using cookies
      if (process.env.USE_REFRESH_TOKEN_COOKIE === 'true') {
        res.cookie('refreshToken', tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
      }

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          tokens
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
   * POST /api/auth/logout
   * Logout user and revoke refresh token
   */
  router.post('/logout', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      let refreshToken = req.body.refreshToken;
      
      // Try to get refresh token from cookie if not in body
      if (!refreshToken && req.cookies?.refreshToken) {
        refreshToken = req.cookies.refreshToken;
      }

      if (refreshToken) {
        await authService.logout(refreshToken);
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      logger.info(`User logged out: ${req.user?.email}`);

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
   * POST /api/auth/logout-all
   * Logout from all devices by revoking all refresh tokens
   */
  router.post('/logout-all', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      await authService.logoutAllDevices(req.user.id);
      
      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      logger.info(`User logged out from all devices: ${req.user.email}`);

      res.json({
        success: true,
        message: 'Logged out from all devices successfully'
      });
    } catch (error: any) {
      logger.error('Logout all devices error:', error);
      res.status(500).json({
        error: 'Logout failed. Please try again.'
      });
    }
  });

  /**
   * GET /api/auth/me
   * Get current user profile
   */
  router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      const user = await authService.getUserProfile(req.user.id);

      res.json({
        success: true,
        data: {
          user
        }
      });
    } catch (error: any) {
      logger.error('Get user profile error:', error);
      
      if (error.message.includes('User not found')) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      res.status(500).json({
        error: 'Failed to get user profile'
      });
    }
  });

  /**
   * POST /api/auth/change-password
   * Change user password
   */
  router.post('/change-password', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      const { currentPassword, newPassword } = req.body;

      // Validate required fields
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: 'Current password and new password are required',
          details: {
            currentPassword: !currentPassword ? 'Current password is required' : null,
            newPassword: !newPassword ? 'New password is required' : null
          }
        });
      }

      await authService.changePassword(req.user.id, currentPassword, newPassword);

      logger.info(`Password changed for user: ${req.user.email}`);

      res.json({
        success: true,
        message: 'Password changed successfully. Please login again with your new password.'
      });
    } catch (error: any) {
      logger.error('Change password error:', error);
      
      if (error.message.includes('Current password is incorrect')) {
        return res.status(400).json({
          error: 'Current password is incorrect'
        });
      }
      
      if (error.message.includes('Password must')) {
        return res.status(400).json({
          error: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to change password. Please try again.'
      });
    }
  });

  /**
   * POST /api/auth/verify-token
   * Verify if the provided token is valid
   */
  router.post('/verify-token', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          error: 'Token is required'
        });
      }

      const payload = await authService.verifyAccessToken(token);

      res.json({
        success: true,
        message: 'Token is valid',
        data: {
          payload
        }
      });
    } catch (error: any) {
      logger.error('Token verification error:', error);
      
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  });

  return router;
}
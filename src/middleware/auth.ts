import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { AuthService } from '../services/AuthService';
import { DatabaseService } from '../database/DatabaseService';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// Lazy-loaded auth service instance
let authServiceInstance: AuthService | null = null;

const getAuthService = (): AuthService => {
  if (!authServiceInstance) {
    const db = new DatabaseService();
    authServiceInstance = new AuthService(db);
  }
  return authServiceInstance;
};

export const generateToken = (userId: string, email: string, role: string = 'user'): string => {
  return jwt.sign(
    { id: userId, email, role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

export const verifyToken = (token: string): any => {
  return jwt.verify(token, JWT_SECRET);
};

/**
 * Enhanced authentication middleware with proper token validation
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    }

    // Also check for token in query params or body (for WebSocket upgrades or special cases)
    if (!token) {
      token = req.query.token as string || req.body.token;
    }

    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No access token provided' 
      });
    }

    // Verify token using AuthService for enhanced security
    const authService = getAuthService();
    const payload = await authService.verifyAccessToken(token);
    
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role
    };

    next();
  } catch (error: any) {
    logger.error('Authentication error:', error);
    
    if (error.message.includes('expired')) {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Your session has expired. Please login again.'
      });
    }
    
    if (error.message.includes('deactivated')) {
      return res.status(403).json({ 
        error: 'Account deactivated',
        message: 'Your account has been deactivated.'
      });
    }
    
    return res.status(401).json({ 
      error: 'Invalid token',
      message: 'Invalid or malformed access token'
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token is provided
 */
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const authService = getAuthService();
      const payload = await authService.verifyAccessToken(token);
      
      req.user = {
        id: payload.id,
        email: payload.email,
        role: payload.role
      };
    }
    
    next();
  } catch (error) {
    // Silently continue without authentication
    next();
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Rate limiting configurations
export const createRateLimiter = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: message || 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        error: message || 'Too many requests, please try again later.'
      });
    }
  });
};

// Different rate limiters for different endpoints
export const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // max requests
  'Too many requests from this IP, please try again after 15 minutes'
);

export const uploadLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  20, // max uploads
  'Upload limit exceeded. Please try again after an hour'
);

export const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // max attempts
  'Too many authentication attempts. Please try again later'
);

// API Key authentication for programmatic access
export const apiKeyAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return authenticate(req, res, next); // Fall back to JWT auth
  }

  try {
    // In production, validate API key against database
    // For now, we'll use a simple check
    if (apiKey === process.env.MASTER_API_KEY) {
      req.user = {
        id: 'api-user',
        email: 'api@system.local',
        role: 'api'
      };
      next();
    } else {
      return res.status(401).json({ error: 'Invalid API key' });
    }
  } catch (error) {
    logger.error('API key authentication error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};
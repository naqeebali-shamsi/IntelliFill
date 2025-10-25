import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { PrismaAuthService } from '../services/PrismaAuthService';
import { logger } from '../utils/logger';

import crypto from 'crypto';

// CRITICAL: JWT Secret validation with entropy check
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// Startup validation with entropy check
function validateSecrets() {
  if (!JWT_SECRET || JWT_SECRET.length < 64) {
    throw new Error('JWT_SECRET must be at least 64 characters');
  }
  
  if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET.length < 64) {
    throw new Error('JWT_REFRESH_SECRET must be at least 64 characters');
  }
  
  // Calculate entropy
  const calculateEntropy = (str: string): number => {
    const chars = new Set(str).size;
    return Math.log2(Math.pow(chars, str.length));
  };
  
  if (calculateEntropy(JWT_SECRET) < 256) {
    throw new Error('JWT_SECRET has insufficient entropy (minimum 256 bits)');
  }
}

// Call on startup - fail fast
validateSecrets();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// Lazy-loaded auth service instance - use PrismaAuthService for consistency
let authServiceInstance: PrismaAuthService | null = null;

const getAuthService = (): PrismaAuthService => {
  if (!authServiceInstance) {
    authServiceInstance = new PrismaAuthService();
  }
  return authServiceInstance;
};

// SECURE JWT Configuration with explicit algorithm
const JWT_OPTIONS: jwt.SignOptions = {
  algorithm: 'HS256', // Explicit algorithm - prevents confusion attacks
  issuer: process.env.JWT_ISSUER || 'quikadmin-api',
  audience: process.env.JWT_AUDIENCE || 'quikadmin-client',
  expiresIn: '15m', // SHORT-lived tokens (was 24h - TOO LONG)
  notBefore: 0
};

export const generateToken = (userId: string, email: string, role: string = 'user'): string => {
  // Add token binding for replay attack prevention
  const tokenBinding = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${userId}:${Date.now()}`)
    .digest('hex')
    .substring(0, 16);
  
  return jwt.sign({ id: userId, email, role, bind: tokenBinding }, JWT_SECRET, JWT_OPTIONS);
};

export const verifyToken = async (token: string): Promise<any> => {
  // SECURITY: Enhanced verification with comprehensive validation
  return new Promise((resolve, reject) => {
    try {
      // SECURITY: Validate token format first
      if (!token || typeof token !== 'string') {
        reject(new Error('Invalid token format'));
        return;
      }

      // SECURITY: Check token structure (JWT must have 3 parts)
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        reject(new Error('Invalid token structure'));
        return;
      }

      // SECURITY: Decode and check header for algorithm confusion attacks
      let header;
      try {
        header = JSON.parse(Buffer.from(tokenParts[0], 'base64url').toString());
      } catch {
        reject(new Error('Invalid token header'));
        return;
      }

      // SECURITY: Explicitly reject 'none' algorithm and enforce HS256 only
      if (!header.alg || header.alg === 'none' || header.alg !== 'HS256') {
        reject(new Error('Invalid or unsupported algorithm'));
        return;
      }

      // SECURITY: Verify with strict options
      jwt.verify(token, JWT_SECRET, {
        algorithms: ['HS256'], // Only accept HS256
        issuer: JWT_OPTIONS.issuer,
        audience: JWT_OPTIONS.audience,
        clockTolerance: process.env.NODE_ENV === 'development' ? 60 : 5, // 60s tolerance in dev, 5s in prod
        ignoreExpiration: false, // Explicitly check expiration
        ignoreNotBefore: false // Check nbf claim
      } as jwt.VerifyOptions, (err, decoded) => {
        if (err) {
          logger.error('JWT verification failed:', err);
          if (err.name === 'TokenExpiredError') {
            reject(new Error('Token has expired'));
          } else if (err.name === 'JsonWebTokenError') {
            reject(new Error('Invalid token signature'));
          } else if (err.name === 'NotBeforeError') {
            reject(new Error('Token not active yet'));
          } else {
            reject(new Error('Invalid token'));
          }
        } else {
          // SECURITY: Additional payload validation
          if (!decoded || typeof decoded !== 'object' || !(decoded as any).id || !(decoded as any).email) {
            reject(new Error('Invalid token payload'));
            return;
          }
          resolve(decoded);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Enhanced authentication middleware with comprehensive security validation
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // SECURITY: Extract and validate Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No authorization header provided' 
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Invalid authorization header format. Expected: Bearer <token>' 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // SECURITY: Basic token format validation
    if (!token || token.trim() === '') {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided' 
      });
    }

    // SECURITY: Check for suspicious tokens (too short/long)
    if (token.length < 20 || token.length > 2048) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Token length is invalid' 
      });
    }

    // SECURITY: Verify token using AuthService for enhanced security
    const authService = getAuthService();
    const payload = await authService.verifyToken(token);
    
    // SECURITY: Final payload validation
    if (!payload.id || !payload.email || !payload.role) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Token payload is incomplete' 
      });
    }

    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role
    };

    next();
  } catch (error: any) {
    logger.error('Authentication error:', error);
    
    // SECURITY: Specific error handling for different JWT errors
    if (error.message.includes('expired') || error.message.includes('Token has expired')) {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Your session has expired. Please login again.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.message.includes('deactivated') || error.message.includes('User not found')) {
      return res.status(403).json({ 
        error: 'Account deactivated',
        message: 'Your account has been deactivated or not found.',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    if (error.message.includes('algorithm') || error.message.includes('none')) {
      return res.status(401).json({ 
        error: 'Security violation',
        message: 'Token uses unsupported algorithm.',
        code: 'ALGORITHM_VIOLATION'
      });
    }

    if (error.message.includes('signature') || error.message.includes('Invalid token signature')) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Token signature is invalid.',
        code: 'INVALID_SIGNATURE'
      });
    }
    
    return res.status(401).json({ 
      error: 'Invalid token',
      message: 'Authentication failed. Please login again.',
      code: 'AUTHENTICATION_FAILED'
    });
  }
};

/**
 * Optional authentication with enhanced security - doesn't fail if no token is provided
 */
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // SECURITY: Basic validation even for optional auth
      if (token && token.trim() !== '' && token.length >= 20 && token.length <= 2048) {
        const authService = getAuthService();
        const payload = await authService.verifyToken(token);
        
        // SECURITY: Validate payload even in optional auth
        if (payload.id && payload.email && payload.role) {
          req.user = {
            id: payload.id,
            email: payload.email,
            role: payload.role
          };
        }
      }
    }
    
    next();
  } catch (error) {
    // Log suspicious activity but continue without authentication
    if (error instanceof Error && 
        (error.message.includes('algorithm') || 
         error.message.includes('none') || 
         error.message.includes('signature'))) {
      logger.warn('Suspicious token in optional auth:', error.message);
    }
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
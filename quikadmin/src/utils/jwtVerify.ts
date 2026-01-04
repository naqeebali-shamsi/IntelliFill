/**
 * JWT Verification Utilities
 *
 * Task 283: Dual-key JWT verification for zero-downtime secret rotation.
 *
 * This module provides JWT verification with automatic fallback to old secrets,
 * enabling seamless secret rotation without invalidating existing tokens.
 *
 * Usage:
 *   import { verifyAccessToken, verifyRefreshToken } from './jwtVerify';
 *   const payload = await verifyAccessToken(token);
 *
 * @module utils/jwtVerify
 */

import jwt, { JsonWebTokenError, TokenExpiredError, JwtPayload } from 'jsonwebtoken';
import { config } from '../config';
import { piiSafeLogger as logger } from './piiSafeLogger';

// ============================================================================
// Types
// ============================================================================

export interface TokenPayload extends JwtPayload {
  sub: string;
  type?: 'access' | 'refresh';
  [key: string]: unknown;
}

export interface VerifyResult {
  valid: boolean;
  payload?: TokenPayload;
  error?: string;
  usedOldSecret?: boolean;
}

// ============================================================================
// Dual-Key Verification Functions
// ============================================================================

/**
 * Verify a JWT token with automatic fallback to old secret.
 *
 * @param token - JWT token to verify
 * @param primarySecret - Primary (current) secret
 * @param fallbackSecret - Optional fallback (old) secret for rotation
 * @returns VerifyResult with payload or error
 */
function verifyWithFallback(
  token: string,
  primarySecret: string,
  fallbackSecret?: string
): VerifyResult {
  // Attempt verification with primary secret
  try {
    const payload = jwt.verify(token, primarySecret) as TokenPayload;
    return { valid: true, payload, usedOldSecret: false };
  } catch (primaryError) {
    // If it's not a signature error, no point trying fallback
    if (!(primaryError instanceof JsonWebTokenError)) {
      if (primaryError instanceof TokenExpiredError) {
        return { valid: false, error: 'Token expired' };
      }
      return { valid: false, error: 'Token verification failed' };
    }

    // Only attempt fallback for signature errors, not other JWT errors
    if (!fallbackSecret) {
      return { valid: false, error: 'Invalid token signature' };
    }

    // Attempt verification with fallback (old) secret
    try {
      const payload = jwt.verify(token, fallbackSecret) as TokenPayload;

      // Log that we used the old secret (important for monitoring rotation progress)
      logger.info('[JWT] Token verified using old secret (rotation in progress)', {
        tokenType: payload.type || 'unknown',
        sub: payload.sub,
      });

      return { valid: true, payload, usedOldSecret: true };
    } catch (fallbackError) {
      // Both secrets failed
      if (fallbackError instanceof TokenExpiredError) {
        return { valid: false, error: 'Token expired' };
      }
      return { valid: false, error: 'Invalid token signature' };
    }
  }
}

/**
 * Verify an access token with dual-key support.
 *
 * @param token - Access token to verify
 * @returns VerifyResult
 */
export function verifyAccessToken(token: string): VerifyResult {
  return verifyWithFallback(token, config.jwt.secret, config.jwt.secretOld);
}

/**
 * Verify a refresh token with dual-key support.
 *
 * @param token - Refresh token to verify
 * @returns VerifyResult
 */
export function verifyRefreshToken(token: string): VerifyResult {
  return verifyWithFallback(token, config.jwt.refreshSecret, config.jwt.refreshSecretOld);
}

/**
 * Decode a token without verification (for debugging/logging only).
 * WARNING: Do not trust the payload for authorization!
 *
 * @param token - JWT token
 * @returns Decoded payload or null
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload | null;
  } catch {
    return null;
  }
}

/**
 * Check if JWT_SECRET_OLD is configured (useful for monitoring).
 * This indicates a rotation is in progress.
 */
export function isSecretRotationInProgress(): boolean {
  return !!(config.jwt.secretOld || config.jwt.refreshSecretOld);
}

/**
 * Get rotation status for health checks.
 */
export function getRotationStatus(): {
  accessSecretRotating: boolean;
  refreshSecretRotating: boolean;
} {
  return {
    accessSecretRotating: !!config.jwt.secretOld,
    refreshSecretRotating: !!config.jwt.refreshSecretOld,
  };
}

export default {
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  isSecretRotationInProgress,
  getRotationStatus,
};

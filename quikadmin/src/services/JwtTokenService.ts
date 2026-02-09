/**
 * JWT Token Service
 *
 * Centralized service for all JWT token generation operations.
 * Eliminates token generation duplication across the codebase.
 *
 * Token Types:
 * - Access Token: Standard 1h expiry for authenticated sessions
 * - Demo Access Token: Extended 4h expiry with demo-specific claims
 * - Refresh Token: 7d expiry, supports token family rotation
 */

import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getTokenFamilyService } from './RefreshTokenFamilyService';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';

// JWT secrets from validated config (64+ characters enforced)
const JWT_SECRET = config.jwt.secret;
const JWT_REFRESH_SECRET = config.jwt.refreshSecret;

/**
 * Standard JWT access token payload
 */
export interface AccessTokenPayload {
  sub: string; // User ID
  email: string;
  role: string;
  aud: string; // Audience
  iss: string; // Issuer
}

/**
 * Demo JWT access token payload (extended claims)
 */
export interface DemoAccessTokenPayload extends AccessTokenPayload {
  organizationId: string | null;
  isDemo: boolean;
}

/**
 * Refresh token result with optional family tracking
 */
export interface RefreshTokenResult {
  token: string;
  familyId?: string;
  generation?: number;
}

/**
 * Centralized JWT Token Service
 *
 * Provides consistent token generation across all authentication flows:
 * - Standard login/registration
 * - Token refresh
 * - Demo mode authentication
 */
class JwtTokenService {
  /**
   * Generates a standard access token.
   *
   * @param userId - The user's unique identifier (UUID)
   * @param email - The user's email address
   * @param role - The user's role (ADMIN, OWNER, MEMBER, VIEWER)
   * @param issuer - Token issuer identifier (default: 'test-mode')
   * @returns Signed JWT access token with 1h expiry
   */
  generateAccessToken(
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
      } satisfies AccessTokenPayload,
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  /**
   * Generates an extended access token for demo accounts.
   *
   * Demo tokens have:
   * - Extended 4h expiry (vs standard 1h)
   * - Organization ID in claims
   * - isDemo flag for frontend detection
   *
   * @param userId - The demo user's unique identifier
   * @param email - The demo user's email address
   * @param role - The demo user's role
   * @param organizationId - The demo user's organization (can be null)
   * @returns Signed JWT access token with 4h expiry and demo claims
   */
  generateDemoAccessToken(
    userId: string,
    email: string,
    role: string,
    organizationId: string | null
  ): string {
    return jwt.sign(
      {
        sub: userId,
        email,
        role,
        organizationId,
        aud: 'authenticated',
        iss: 'demo-mode',
        isDemo: true,
      } satisfies DemoAccessTokenPayload,
      JWT_SECRET,
      { expiresIn: '4h' }
    );
  }

  /**
   * Generates a refresh token using token family service with JWT fallback.
   *
   * Token Family Service provides:
   * - Refresh token rotation
   * - Family-based revocation (detect token reuse attacks)
   * - Generation tracking
   *
   * Falls back to simple JWT if token family service is unavailable.
   *
   * @param userId - The user's unique identifier
   * @returns Refresh token with optional family metadata
   */
  async generateRefreshToken(userId: string): Promise<RefreshTokenResult> {
    try {
      const tokenFamilyService = await getTokenFamilyService();
      const familyResult = await tokenFamilyService.createNewFamily(userId);
      return {
        token: familyResult.refreshToken,
        familyId: familyResult.familyId,
        generation: familyResult.generation,
      };
    } catch (error) {
      // Fallback to simple JWT if token family service unavailable
      logger.warn('Token family service unavailable, using JWT fallback', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      const token = jwt.sign({ sub: userId, type: 'refresh' }, JWT_REFRESH_SECRET, {
        expiresIn: '7d',
      });
      return { token };
    }
  }
}

// Export singleton instance
export const jwtTokenService = new JwtTokenService();

// Also export the class for testing purposes
export { JwtTokenService };

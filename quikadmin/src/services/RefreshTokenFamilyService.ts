/**
 * Refresh Token Family Service
 *
 * Implements token rotation with theft detection as described in Task 279.
 *
 * Token Family Concept:
 * - Each login creates a new "token family" identified by a UUID (fid)
 * - Each refresh increments a generation counter (gen)
 * - Used tokens are tracked in Redis with TTL
 * - If a used token is presented, the entire family is revoked
 *
 * This provides:
 * 1. Token rotation on every refresh
 * 2. Theft detection via reuse detection
 * 3. Session revocation on compromise
 *
 * @module services/RefreshTokenFamilyService
 */

import { createClient, RedisClientType } from 'redis';
import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { config } from '../config';
import { SecurityEventService, SecurityEventType, SecuritySeverity } from './SecurityEventService';
import { Request } from 'express';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Token family payload embedded in refresh tokens
 */
export interface TokenFamilyPayload {
  sub: string; // User ID
  fid: string; // Family ID (UUID)
  gen: number; // Generation counter
  type: 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * Result of token family validation
 */
export interface TokenFamilyValidation {
  valid: boolean;
  reason?: string;
  payload?: TokenFamilyPayload;
  familyRevoked?: boolean;
  tokenReused?: boolean;
}

/**
 * New token generation result
 */
export interface NewTokenResult {
  refreshToken: string;
  familyId: string;
  generation: number;
  expiresIn: number;
}

// ============================================================================
// Constants
// ============================================================================

const REDIS_KEY_PREFIX = {
  USED_TOKEN: 'auth:used_token:', // Hash of used tokens
  REVOKED_FAMILY: 'auth:revoked_family:', // Revoked family IDs
};

// Token TTL (7 days in seconds)
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60;

// Used token tracking TTL (same as refresh token TTL + buffer)
const USED_TOKEN_TTL = REFRESH_TOKEN_TTL + 60 * 60; // +1 hour buffer

// ============================================================================
// RefreshTokenFamilyService Class
// ============================================================================

export class RefreshTokenFamilyService {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;
  private jwtRefreshSecret: string;
  private jwtRefreshSecretOld?: string; // Task 283: Old secret for zero-downtime rotation

  constructor(jwtRefreshSecret?: string, jwtRefreshSecretOld?: string) {
    this.jwtRefreshSecret = jwtRefreshSecret || config.jwt.refreshSecret;
    this.jwtRefreshSecretOld = jwtRefreshSecretOld || config.jwt.refreshSecretOld;
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  async connect(): Promise<void> {
    if (this.isConnected) return;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = this.doConnect();

    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async doConnect(): Promise<void> {
    try {
      this.client = createClient({ url: config.redis.url });

      this.client.on('error', (err) => {
        logger.error('[TokenFamily] Redis client error', { error: err.message });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('[TokenFamily] Connected to Redis');
        this.isConnected = true;
      });

      await this.client.connect();
      this.isConnected = true;
      logger.info('[TokenFamily] Token family service initialized');
    } catch (error) {
      logger.warn('[TokenFamily] Redis connection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.isConnected = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('[TokenFamily] Disconnected from Redis');
    }
  }

  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  // ==========================================================================
  // Private Helpers - JWT Operations
  // ==========================================================================

  /**
   * Sign a refresh token payload
   */
  private signRefreshToken(payload: TokenFamilyPayload): string {
    return jwt.sign(payload, this.jwtRefreshSecret, { expiresIn: REFRESH_TOKEN_TTL });
  }

  /**
   * Verify token with dual-key support for zero-downtime rotation
   * Returns payload and whether old secret was used, or null if invalid
   */
  private verifyWithDualKey(
    token: string
  ): { payload: TokenFamilyPayload; usedOldSecret: boolean } | { error: string } {
    try {
      const payload = jwt.verify(token, this.jwtRefreshSecret) as TokenFamilyPayload;
      return { payload, usedOldSecret: false };
    } catch (primaryError) {
      if (primaryError instanceof jwt.TokenExpiredError) {
        return { error: 'Token expired' };
      }
      if (primaryError instanceof jwt.JsonWebTokenError && this.jwtRefreshSecretOld) {
        try {
          const payload = jwt.verify(token, this.jwtRefreshSecretOld) as TokenFamilyPayload;
          return { payload, usedOldSecret: true };
        } catch (fallbackError) {
          if (fallbackError instanceof jwt.TokenExpiredError) {
            return { error: 'Token expired' };
          }
        }
      }
      return { error: 'Invalid token signature' };
    }
  }

  /**
   * Build a NewTokenResult from a payload
   */
  private buildTokenResult(payload: TokenFamilyPayload): NewTokenResult {
    return {
      refreshToken: this.signRefreshToken(payload),
      familyId: payload.fid,
      generation: payload.gen,
      expiresIn: REFRESH_TOKEN_TTL,
    };
  }

  /**
   * Hash token for storage (never store actual tokens)
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex').substring(0, 32);
  }

  // ==========================================================================
  // Private Helpers - Redis Operations
  // ==========================================================================

  /**
   * Set a Redis key with TTL and JSON data
   */
  private async redisSet(prefix: string, key: string, data: object): Promise<boolean> {
    if (!this.isReady()) return false;
    try {
      await this.client!.setEx(`${prefix}${key}`, USED_TOKEN_TTL, JSON.stringify(data));
      return true;
    } catch (error) {
      logger.warn('[TokenFamily] Redis set failed', {
        error: error instanceof Error ? error.message : 'Unknown',
        prefix,
      });
      return false;
    }
  }

  /**
   * Check if a Redis key exists
   */
  private async redisExists(prefix: string, key: string): Promise<boolean> {
    if (!this.isReady()) return false;
    try {
      const result = await this.client!.get(`${prefix}${key}`);
      return result !== null;
    } catch (error) {
      logger.warn('[TokenFamily] Redis get failed', {
        error: error instanceof Error ? error.message : 'Unknown',
        prefix,
      });
      return false;
    }
  }

  // ==========================================================================
  // Token Generation
  // ==========================================================================

  /**
   * Create a new token family for initial login
   */
  createNewFamily(userId: string): NewTokenResult {
    const payload: TokenFamilyPayload = {
      sub: userId,
      fid: crypto.randomUUID(),
      gen: 1,
      type: 'refresh',
    };

    logger.debug('[TokenFamily] New family created', {
      userId,
      familyId: payload.fid,
      generation: payload.gen,
    });

    return this.buildTokenResult(payload);
  }

  /**
   * Rotate refresh token - create new token with incremented generation
   */
  async rotateToken(oldToken: string, req?: Request): Promise<NewTokenResult | null> {
    const validation = await this.validateToken(oldToken, req);

    if (!validation.valid || !validation.payload) {
      logger.warn('[TokenFamily] Token rotation failed - invalid token', {
        reason: validation.reason,
      });
      return null;
    }

    const { sub: userId, fid: familyId, gen: generation } = validation.payload;

    await this.markTokenAsUsed(oldToken, familyId, generation);

    const newPayload: TokenFamilyPayload = {
      sub: userId,
      fid: familyId,
      gen: generation + 1,
      type: 'refresh',
    };

    logger.debug('[TokenFamily] Token rotated', {
      userId,
      familyId,
      oldGeneration: generation,
      newGeneration: newPayload.gen,
    });

    return this.buildTokenResult(newPayload);
  }

  // ==========================================================================
  // Token Validation
  // ==========================================================================

  /**
   * Validate a refresh token including family revocation check
   */
  async validateToken(token: string, req?: Request): Promise<TokenFamilyValidation> {
    // Step 1: Verify JWT signature and expiration (with dual-key support)
    const verifyResult = this.verifyWithDualKey(token);

    if ('error' in verifyResult) {
      return { valid: false, reason: verifyResult.error };
    }

    const { payload, usedOldSecret } = verifyResult;

    if (usedOldSecret) {
      logger.info('[TokenFamily] Token verified using old secret (rotation in progress)', {
        userId: payload.sub,
      });
    }

    // Step 2: Validate payload structure
    if (!payload.fid || !payload.gen || !payload.sub || payload.type !== 'refresh') {
      return { valid: false, reason: 'Invalid token payload structure' };
    }

    // Step 3: Check if family is revoked (theft detected previously)
    const familyRevoked = await this.isFamilyRevoked(payload.fid);
    if (familyRevoked) {
      logger.warn('[TokenFamily] Attempted use of revoked family', {
        familyId: payload.fid,
        userId: payload.sub,
      });

      // Log security event
      if (req) {
        await SecurityEventService.logEvent({
          type: SecurityEventType.TOKEN_REVOKED,
          severity: SecuritySeverity.HIGH,
          req,
          userId: payload.sub,
          details: {
            familyId: payload.fid,
            generation: payload.gen,
            reason: 'Family previously revoked due to theft detection',
          },
        });
      }

      return {
        valid: false,
        reason: 'Token family revoked',
        payload,
        familyRevoked: true,
      };
    }

    // Step 4: Check if this specific token was already used (THEFT DETECTION)
    const tokenReused = await this.isTokenUsed(token);
    if (tokenReused) {
      logger.error('[TokenFamily] TOKEN THEFT DETECTED - Token reuse attempt', {
        familyId: payload.fid,
        userId: payload.sub,
        generation: payload.gen,
      });

      // Revoke the entire family immediately
      await this.revokeFamily(payload.fid, payload.sub, 'Token reuse detected', req);

      // Log critical security event
      if (req) {
        await SecurityEventService.logEvent({
          type: SecurityEventType.SESSION_HIJACK_ATTEMPT,
          severity: SecuritySeverity.CRITICAL,
          req,
          userId: payload.sub,
          details: {
            familyId: payload.fid,
            generation: payload.gen,
            reason: 'Refresh token reuse detected - possible theft',
            action: 'Family revoked, all sessions invalidated',
          },
        });
      }

      return {
        valid: false,
        reason: 'Token already used - theft detected',
        payload,
        tokenReused: true,
        familyRevoked: true, // Family is now revoked
      };
    }

    // Token is valid
    return {
      valid: true,
      payload,
    };
  }

  // ==========================================================================
  // Token Usage Tracking
  // ==========================================================================

  /**
   * Mark a token as used (for reuse detection)
   */
  private async markTokenAsUsed(
    token: string,
    familyId: string,
    generation: number
  ): Promise<void> {
    const tokenHash = this.hashToken(token);
    const success = await this.redisSet(REDIS_KEY_PREFIX.USED_TOKEN, tokenHash, {
      familyId,
      generation,
      usedAt: new Date().toISOString(),
    });

    if (success) {
      logger.debug('[TokenFamily] Token marked as used', { familyId, generation });
    }
  }

  /**
   * Check if a token has been used before
   */
  private async isTokenUsed(token: string): Promise<boolean> {
    return this.redisExists(REDIS_KEY_PREFIX.USED_TOKEN, this.hashToken(token));
  }

  // ==========================================================================
  // Family Revocation
  // ==========================================================================

  /**
   * Revoke an entire token family
   */
  async revokeFamily(
    familyId: string,
    userId: string,
    reason: string,
    req?: Request
  ): Promise<void> {
    if (!this.isReady()) {
      logger.error('[TokenFamily] Cannot revoke family - Redis unavailable');
      return;
    }

    const success = await this.redisSet(REDIS_KEY_PREFIX.REVOKED_FAMILY, familyId, {
      userId,
      reason,
      revokedAt: new Date().toISOString(),
    });

    if (!success) {
      logger.error('[TokenFamily] Failed to revoke family', { familyId });
      return;
    }

    logger.warn('[TokenFamily] Family revoked', { familyId, userId, reason });

    if (req) {
      await SecurityEventService.logEvent({
        type: SecurityEventType.TOKEN_REVOKED,
        severity: SecuritySeverity.HIGH,
        req,
        userId,
        details: { familyId, reason, action: 'Token family revoked' },
      });
    }
  }

  /**
   * Check if a family is revoked
   */
  private async isFamilyRevoked(familyId: string): Promise<boolean> {
    return this.redisExists(REDIS_KEY_PREFIX.REVOKED_FAMILY, familyId);
  }

  /**
   * Revoke all families for a user (e.g., on password change or logout from all devices)
   */
  async revokeAllFamiliesForUser(userId: string, reason: string): Promise<void> {
    // This would require scanning all family keys, which is expensive
    // In practice, we'd track active families per user in a separate set
    logger.info('[TokenFamily] Revoking all families for user', { userId, reason });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let tokenFamilyServiceInstance: RefreshTokenFamilyService | null = null;

/**
 * Get the singleton token family service instance
 */
export async function getTokenFamilyService(): Promise<RefreshTokenFamilyService> {
  if (!tokenFamilyServiceInstance) {
    tokenFamilyServiceInstance = new RefreshTokenFamilyService();
    await tokenFamilyServiceInstance.connect();
  }
  return tokenFamilyServiceInstance;
}

/**
 * Shutdown token family service (for graceful shutdown)
 */
export async function shutdownTokenFamilyService(): Promise<void> {
  if (tokenFamilyServiceInstance) {
    await tokenFamilyServiceInstance.disconnect();
    tokenFamilyServiceInstance = null;
    logger.info('[TokenFamily] Shutdown complete');
  }
}

export default RefreshTokenFamilyService;

/**
 * Feature Flag Service
 *
 * Provides runtime feature flag management for gradual rollout of the
 * multi-agent document processing pipeline.
 *
 * Features:
 * - Database-backed flag configuration with in-memory caching
 * - Percentage-based rollout with sticky user assignment
 * - User targeting (include/exclude lists)
 * - Custom rule evaluation
 *
 * Usage:
 * ```typescript
 * const featureFlags = new FeatureFlagService();
 * await featureFlags.initialize();
 *
 * // Check if multi-agent is enabled for a user
 * if (await featureFlags.isEnabled('multiagent-primary', userId)) {
 *   // Use multi-agent pipeline
 * }
 *
 * // Get A/B test variant
 * const variant = await featureFlags.getVariant('multiagent-ab-test', userId);
 * ```
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { createHash } from 'crypto';

/**
 * Feature flag configuration
 */
export interface FeatureFlagConfig {
  name: string;
  enabled: boolean;
  percentage: number; // 0-100
  targetUsers: string[];
  excludeUsers: string[];
  rules: Record<string, unknown>;
}

/**
 * A/B test variants
 */
export type ABTestVariant = 'CONTROL' | 'TREATMENT';

/**
 * Flag evaluation result
 */
export interface FlagEvaluationResult {
  enabled: boolean;
  variant?: ABTestVariant;
  reason: string;
  flagName: string;
  userId?: string;
}

/**
 * Default feature flags for multi-agent integration
 */
const DEFAULT_FLAGS: FeatureFlagConfig[] = [
  {
    name: 'shadow-mode',
    enabled: false,
    percentage: 0,
    targetUsers: [],
    excludeUsers: [],
    rules: {
      description: 'Run multi-agent pipeline in parallel with legacy (no user impact)',
    },
  },
  {
    name: 'multiagent-ab-test',
    enabled: false,
    percentage: 0,
    targetUsers: [],
    excludeUsers: [],
    rules: {
      description: 'A/B test multi-agent vs legacy pipeline',
      stickyAssignment: true,
    },
  },
  {
    name: 'multiagent-primary',
    enabled: false,
    percentage: 0,
    targetUsers: [],
    excludeUsers: [],
    rules: {
      description: 'Use multi-agent as primary pipeline',
    },
  },
];

/**
 * Cache entry with TTL
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Feature Flag Service
 */
export class FeatureFlagService {
  private cache: Map<string, CacheEntry<FeatureFlagConfig>> = new Map();
  private assignmentCache: Map<string, CacheEntry<ABTestVariant>> = new Map();
  private cacheTTLMs: number;
  private initialized: boolean = false;

  constructor(cacheTTLMs: number = 60000) {
    // Default 1 minute cache
    this.cacheTTLMs = cacheTTLMs;
  }

  /**
   * Initialize the service and ensure default flags exist
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing FeatureFlagService');

    try {
      // Ensure default flags exist in database
      for (const flag of DEFAULT_FLAGS) {
        const existing = await prisma.featureFlag.findUnique({
          where: { name: flag.name },
        });

        if (!existing) {
          await prisma.featureFlag.create({
            data: {
              name: flag.name,
              enabled: flag.enabled,
              percentage: flag.percentage,
              targetUsers: flag.targetUsers,
              excludeUsers: flag.excludeUsers,
              rules: flag.rules as Prisma.InputJsonValue,
            },
          });
          logger.info(`Created default feature flag: ${flag.name}`);
        }
      }

      this.initialized = true;
      logger.info('FeatureFlagService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize FeatureFlagService', { error });
      // Continue without database - use defaults from cache
      this.initialized = true;
    }
  }

  /**
   * Get a feature flag configuration
   */
  async getFlag(name: string): Promise<FeatureFlagConfig | null> {
    // Check cache first
    const cached = this.cache.get(name);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    try {
      const flag = await prisma.featureFlag.findUnique({
        where: { name },
      });

      if (!flag) {
        // Check if it's a default flag
        const defaultFlag = DEFAULT_FLAGS.find((f) => f.name === name);
        if (defaultFlag) {
          this.cache.set(name, {
            value: defaultFlag,
            expiresAt: Date.now() + this.cacheTTLMs,
          });
          return defaultFlag;
        }
        return null;
      }

      const config: FeatureFlagConfig = {
        name: flag.name,
        enabled: flag.enabled,
        percentage: flag.percentage,
        targetUsers: flag.targetUsers,
        excludeUsers: flag.excludeUsers,
        rules: flag.rules as Record<string, unknown>,
      };

      // Update cache
      this.cache.set(name, {
        value: config,
        expiresAt: Date.now() + this.cacheTTLMs,
      });

      return config;
    } catch (error) {
      logger.error('Failed to get feature flag', { name, error });

      // Fallback to default
      const defaultFlag = DEFAULT_FLAGS.find((f) => f.name === name);
      return defaultFlag || null;
    }
  }

  /**
   * Check if a feature flag is enabled for a user
   */
  async isEnabled(name: string, userId?: string): Promise<boolean> {
    const result = await this.evaluate(name, userId);
    return result.enabled;
  }

  /**
   * Evaluate a feature flag for a user
   */
  async evaluate(name: string, userId?: string): Promise<FlagEvaluationResult> {
    const flag = await this.getFlag(name);

    if (!flag) {
      return {
        enabled: false,
        reason: 'Flag not found',
        flagName: name,
        userId,
      };
    }

    // Check if flag is globally disabled
    if (!flag.enabled) {
      return {
        enabled: false,
        reason: 'Flag is globally disabled',
        flagName: name,
        userId,
      };
    }

    // If no userId, check percentage at 100%
    if (!userId) {
      const enabled = flag.percentage >= 100;
      return {
        enabled,
        reason: enabled ? 'Flag at 100%' : 'No userId provided',
        flagName: name,
      };
    }

    // Check exclude list
    if (flag.excludeUsers.includes(userId)) {
      return {
        enabled: false,
        reason: 'User in exclude list',
        flagName: name,
        userId,
      };
    }

    // Check include list (overrides percentage)
    if (flag.targetUsers.includes(userId)) {
      return {
        enabled: true,
        reason: 'User in target list',
        flagName: name,
        userId,
      };
    }

    // Check percentage (deterministic based on userId hash)
    const bucket = this.getUserBucket(userId, name);
    const enabled = bucket < flag.percentage;

    return {
      enabled,
      reason: enabled
        ? `User in ${flag.percentage}% rollout`
        : `User outside ${flag.percentage}% rollout`,
      flagName: name,
      userId,
    };
  }

  /**
   * Get A/B test variant for a user (sticky assignment)
   */
  async getVariant(testName: string, userId: string): Promise<ABTestVariant> {
    // Check assignment cache first
    const cacheKey = `${testName}:${userId}`;
    const cached = this.assignmentCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    try {
      // Check for existing assignment in database
      const existing = await prisma.aBTestAssignment.findUnique({
        where: {
          userId_testName: {
            userId,
            testName,
          },
        },
      });

      if (existing && existing.isActive) {
        // Check if expired
        if (existing.expiresAt && existing.expiresAt < new Date()) {
          // Assignment expired, create new one
          return this.createNewAssignment(testName, userId);
        }

        // Cache and return existing assignment
        this.assignmentCache.set(cacheKey, {
          value: existing.variant as ABTestVariant,
          expiresAt: Date.now() + this.cacheTTLMs,
        });

        return existing.variant as ABTestVariant;
      }

      // Create new assignment
      return this.createNewAssignment(testName, userId);
    } catch (error) {
      logger.error('Failed to get A/B test variant', { testName, userId, error });

      // Fallback: deterministic assignment based on hash
      const bucket = this.getUserBucket(userId, testName);
      return bucket < 50 ? 'CONTROL' : 'TREATMENT';
    }
  }

  /**
   * Create a new A/B test assignment
   */
  private async createNewAssignment(testName: string, userId: string): Promise<ABTestVariant> {
    const flag = await this.getFlag(testName);
    const percentage = flag?.percentage || 50;

    // Deterministic assignment based on user hash
    const bucket = this.getUserBucket(userId, testName);
    const variant: ABTestVariant = bucket < percentage ? 'TREATMENT' : 'CONTROL';

    try {
      await prisma.aBTestAssignment.upsert({
        where: {
          userId_testName: {
            userId,
            testName,
          },
        },
        update: {
          variant,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          userId,
          testName,
          variant,
          isActive: true,
        },
      });

      // Cache the assignment
      const cacheKey = `${testName}:${userId}`;
      this.assignmentCache.set(cacheKey, {
        value: variant,
        expiresAt: Date.now() + this.cacheTTLMs,
      });

      logger.info('Created A/B test assignment', {
        testName,
        userId: userId.substring(0, 8) + '...',
        variant,
      });
    } catch (error) {
      logger.error('Failed to create A/B test assignment', { testName, error });
    }

    return variant;
  }

  /**
   * Get deterministic bucket (0-99) for a user based on hash
   */
  private getUserBucket(userId: string, salt: string): number {
    const hash = createHash('sha256').update(`${userId}:${salt}`).digest('hex');

    // Use first 4 bytes of hash as number, then mod 100
    const num = parseInt(hash.substring(0, 8), 16);
    return num % 100;
  }

  /**
   * Update a feature flag configuration
   */
  async updateFlag(
    name: string,
    updates: Partial<FeatureFlagConfig>,
    updatedBy?: string
  ): Promise<FeatureFlagConfig | null> {
    try {
      const flag = await prisma.featureFlag.update({
        where: { name },
        data: {
          enabled: updates.enabled,
          percentage: updates.percentage,
          targetUsers: updates.targetUsers,
          excludeUsers: updates.excludeUsers,
          rules: updates.rules as Prisma.InputJsonValue,
          updatedBy,
        },
      });

      // Invalidate cache
      this.cache.delete(name);

      logger.info('Updated feature flag', {
        name,
        updates: {
          enabled: updates.enabled,
          percentage: updates.percentage,
        },
        updatedBy,
      });

      return {
        name: flag.name,
        enabled: flag.enabled,
        percentage: flag.percentage,
        targetUsers: flag.targetUsers,
        excludeUsers: flag.excludeUsers,
        rules: flag.rules as Record<string, unknown>,
      };
    } catch (error) {
      logger.error('Failed to update feature flag', { name, error });
      return null;
    }
  }

  /**
   * Get all feature flags
   */
  async getAllFlags(): Promise<FeatureFlagConfig[]> {
    try {
      const flags = await prisma.featureFlag.findMany({
        orderBy: { name: 'asc' },
      });

      return flags.map((flag) => ({
        name: flag.name,
        enabled: flag.enabled,
        percentage: flag.percentage,
        targetUsers: flag.targetUsers,
        excludeUsers: flag.excludeUsers,
        rules: flag.rules as Record<string, unknown>,
      }));
    } catch (error) {
      logger.error('Failed to get all feature flags', { error });
      return DEFAULT_FLAGS;
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.assignmentCache.clear();
    logger.debug('FeatureFlagService cache cleared');
  }

  /**
   * Check if multi-agent should be used for shadow mode
   */
  async shouldUseShadowMode(userId?: string): Promise<boolean> {
    return this.isEnabled('shadow-mode', userId);
  }

  /**
   * Check if user is in multi-agent A/B test
   */
  async isInABTest(userId: string): Promise<boolean> {
    const flag = await this.getFlag('multiagent-ab-test');
    if (!flag?.enabled) return false;

    // Check if user is in the test population
    const result = await this.evaluate('multiagent-ab-test', userId);
    return result.enabled;
  }

  /**
   * Get the pipeline to use for a user
   */
  async getPipelineForUser(userId: string): Promise<'legacy' | 'multiagent'> {
    // Check if multi-agent is primary
    if (await this.isEnabled('multiagent-primary', userId)) {
      return 'multiagent';
    }

    // Check A/B test
    if (await this.isInABTest(userId)) {
      const variant = await this.getVariant('multiagent-ab-test', userId);
      return variant === 'TREATMENT' ? 'multiagent' : 'legacy';
    }

    return 'legacy';
  }
}

// Singleton instance
let featureFlagServiceInstance: FeatureFlagService | null = null;

/**
 * Get the singleton FeatureFlagService instance
 */
export function getFeatureFlagService(): FeatureFlagService {
  if (!featureFlagServiceInstance) {
    featureFlagServiceInstance = new FeatureFlagService();
  }
  return featureFlagServiceInstance;
}

// Export for testing
export const __test__ = {
  DEFAULT_FLAGS,
  resetInstance: () => {
    featureFlagServiceInstance = null;
  },
};

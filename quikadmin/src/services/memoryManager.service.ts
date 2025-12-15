/**
 * Memory Manager Service
 *
 * Provides memory monitoring, upload slot management, and circuit breaker
 * functionality to ensure system stability during document processing.
 *
 * Implements requirements from PRD Vector Search v2.0:
 * - REQ-PERF-001: Maximum 5 concurrent document uploads per instance
 * - REQ-PERF-002: Memory usage threshold at 85% triggers rejection
 * - REQ-PERF-004: Circuit breaker after 5 consecutive failures
 *
 * Critical for PERF-001 mitigation (memory exhaustion prevention).
 *
 * @module services/memoryManager.service
 */

import v8 from 'v8';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  heapLimit: number;
  usagePercent: number;
  external: number;
  arrayBuffers: number;
  rss: number;
}

export interface UploadSlot {
  id: string;
  acquiredAt: Date;
  userId?: string;
  filename?: string;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  nextRetryAt?: Date;
}

export interface MemoryManagerConfig {
  warningThreshold: number;
  criticalThreshold: number;
  maxConcurrentUploads: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetTimeout: number;
  halfOpenMaxAttempts: number;
  monitoringInterval: number;
}

export interface MemoryCheckResult {
  allowed: boolean;
  level: 'OK' | 'WARNING' | 'CRITICAL';
  stats: MemoryStats;
  message?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: MemoryManagerConfig = {
  warningThreshold: 0.75, // 75% heap usage triggers warning
  criticalThreshold: 0.85, // 85% heap usage triggers rejection
  maxConcurrentUploads: 5, // Maximum concurrent uploads
  circuitBreakerThreshold: 5, // Failures before circuit opens
  circuitBreakerResetTimeout: 60000, // 1 minute before retry
  halfOpenMaxAttempts: 3, // Max attempts in half-open state
  monitoringInterval: 30000, // Memory monitoring interval (30s)
};

// ============================================================================
// Memory Manager Service Class
// ============================================================================

export class MemoryManagerService extends EventEmitter {
  private config: MemoryManagerConfig;
  private activeSlots: Map<string, UploadSlot>;
  private circuitState: CircuitState;
  private failureCount: number;
  private successCount: number;
  private lastFailure?: Date;
  private lastSuccess?: Date;
  private resetTimer?: NodeJS.Timeout;
  private monitoringTimer?: NodeJS.Timeout;
  private halfOpenAttempts: number;

  constructor(config: Partial<MemoryManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.activeSlots = new Map();
    this.circuitState = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenAttempts = 0;
  }

  // ==========================================================================
  // Memory Monitoring
  // ==========================================================================

  /**
   * Get current memory statistics
   *
   * @returns Detailed memory statistics
   */
  getMemoryStats(): MemoryStats {
    const heapStats = v8.getHeapStatistics();
    const memUsage = process.memoryUsage();

    const usagePercent = heapStats.used_heap_size / heapStats.heap_size_limit;

    return {
      heapUsed: heapStats.used_heap_size,
      heapTotal: heapStats.total_heap_size,
      heapLimit: heapStats.heap_size_limit,
      usagePercent,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      rss: memUsage.rss,
    };
  }

  /**
   * Check if memory usage allows new operations
   * Addresses: REQ-PERF-002 (Memory threshold rejection)
   *
   * @returns Memory check result with level and stats
   */
  checkMemory(): MemoryCheckResult {
    const stats = this.getMemoryStats();

    if (stats.usagePercent >= this.config.criticalThreshold) {
      logger.error('Critical memory usage detected', {
        usagePercent: (stats.usagePercent * 100).toFixed(1) + '%',
        heapUsed: this.formatBytes(stats.heapUsed),
        heapLimit: this.formatBytes(stats.heapLimit),
      });

      this.emit('memory:critical', stats);

      return {
        allowed: false,
        level: 'CRITICAL',
        stats,
        message: 'System under high memory load. Please try again later.',
      };
    }

    if (stats.usagePercent >= this.config.warningThreshold) {
      logger.warn('High memory usage detected', {
        usagePercent: (stats.usagePercent * 100).toFixed(1) + '%',
        heapUsed: this.formatBytes(stats.heapUsed),
        heapLimit: this.formatBytes(stats.heapLimit),
      });

      this.emit('memory:warning', stats);

      return {
        allowed: true,
        level: 'WARNING',
        stats,
        message: 'Memory usage is elevated. Processing may be slower.',
      };
    }

    return {
      allowed: true,
      level: 'OK',
      stats,
    };
  }

  /**
   * Start continuous memory monitoring
   */
  startMonitoring(): void {
    if (this.monitoringTimer) {
      return;
    }

    this.monitoringTimer = setInterval(() => {
      const result = this.checkMemory();
      if (result.level !== 'OK') {
        logger.info('Memory monitoring check', {
          level: result.level,
          usagePercent: (result.stats.usagePercent * 100).toFixed(1) + '%',
        });
      }
    }, this.config.monitoringInterval);

    logger.info('Memory monitoring started', {
      interval: this.config.monitoringInterval,
    });
  }

  /**
   * Stop continuous memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
      logger.info('Memory monitoring stopped');
    }
  }

  // ==========================================================================
  // Upload Slot Management
  // ==========================================================================

  /**
   * Acquire an upload slot for document processing
   * Addresses: REQ-PERF-001 (Concurrent upload limits)
   *
   * @param userId - Optional user ID for tracking
   * @param filename - Optional filename for logging
   * @returns Slot ID if acquired, null if no slots available
   */
  async acquireUploadSlot(
    userId?: string,
    filename?: string
  ): Promise<string | null> {
    // Check circuit breaker first
    if (!this.canExecute()) {
      logger.warn('Circuit breaker preventing new uploads', {
        state: this.circuitState,
        userId,
      });
      return null;
    }

    // Check memory before allowing new upload
    const memoryCheck = this.checkMemory();
    if (!memoryCheck.allowed) {
      logger.warn('Memory check failed, rejecting upload slot request', {
        level: memoryCheck.level,
        userId,
      });
      return null;
    }

    // Check slot availability
    if (this.activeSlots.size >= this.config.maxConcurrentUploads) {
      logger.warn('Upload slots exhausted', {
        activeSlots: this.activeSlots.size,
        maxSlots: this.config.maxConcurrentUploads,
        userId,
      });
      return null;
    }

    // Generate unique slot ID
    const slotId = this.generateSlotId();

    const slot: UploadSlot = {
      id: slotId,
      acquiredAt: new Date(),
      userId,
      filename,
    };

    this.activeSlots.set(slotId, slot);

    logger.info('Upload slot acquired', {
      slotId,
      activeSlots: this.activeSlots.size,
      maxSlots: this.config.maxConcurrentUploads,
      userId,
    });

    this.emit('slot:acquired', slot);

    return slotId;
  }

  /**
   * Release an upload slot after processing
   *
   * @param slotId - Slot ID to release
   * @param success - Whether the operation was successful
   */
  releaseUploadSlot(slotId: string, success: boolean = true): void {
    const slot = this.activeSlots.get(slotId);

    if (!slot) {
      logger.warn('Attempted to release unknown slot', { slotId });
      return;
    }

    this.activeSlots.delete(slotId);

    const processingTime = Date.now() - slot.acquiredAt.getTime();

    logger.info('Upload slot released', {
      slotId,
      success,
      processingTime,
      activeSlots: this.activeSlots.size,
    });

    this.emit('slot:released', { slot, success, processingTime });

    // Update circuit breaker state
    if (success) {
      this.recordSuccess();
    } else {
      this.recordFailure();
    }
  }

  /**
   * Get current slot status
   *
   * @returns Active slots count and max slots
   */
  getSlotStatus(): {
    active: number;
    max: number;
    available: number;
    slots: UploadSlot[];
  } {
    return {
      active: this.activeSlots.size,
      max: this.config.maxConcurrentUploads,
      available: this.config.maxConcurrentUploads - this.activeSlots.size,
      slots: Array.from(this.activeSlots.values()),
    };
  }

  // ==========================================================================
  // Circuit Breaker
  // ==========================================================================

  /**
   * Check if operations can be executed (circuit breaker check)
   * Addresses: REQ-PERF-004 (Circuit breaker pattern)
   *
   * @returns True if operations are allowed
   */
  canExecute(): boolean {
    switch (this.circuitState) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        return false;

      case 'HALF_OPEN':
        // Allow limited attempts in half-open state
        return this.halfOpenAttempts < this.config.halfOpenMaxAttempts;
    }
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    this.successCount++;
    this.lastSuccess = new Date();

    if (this.circuitState === 'HALF_OPEN') {
      this.halfOpenAttempts++;

      // If enough successes in half-open state, close the circuit
      if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        this.closeCircuit();
      }
    }

    // Reset failure count on success
    if (this.circuitState === 'CLOSED') {
      this.failureCount = 0;
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailure = new Date();

    logger.warn('Operation failure recorded', {
      failureCount: this.failureCount,
      threshold: this.config.circuitBreakerThreshold,
      circuitState: this.circuitState,
    });

    if (this.circuitState === 'HALF_OPEN') {
      // Any failure in half-open state reopens the circuit
      this.openCircuit();
      return;
    }

    if (
      this.circuitState === 'CLOSED' &&
      this.failureCount >= this.config.circuitBreakerThreshold
    ) {
      this.openCircuit();
    }
  }

  /**
   * Open the circuit breaker (stop accepting requests)
   */
  private openCircuit(): void {
    this.circuitState = 'OPEN';
    this.halfOpenAttempts = 0;

    logger.error('Circuit breaker OPENED - stopping new operations', {
      failureCount: this.failureCount,
      resetTimeout: this.config.circuitBreakerResetTimeout,
    });

    this.emit('circuit:open', this.getCircuitBreakerStats());

    // Schedule transition to half-open state
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    this.resetTimer = setTimeout(() => {
      this.halfOpenCircuit();
    }, this.config.circuitBreakerResetTimeout);
  }

  /**
   * Transition to half-open state (allow limited requests)
   */
  private halfOpenCircuit(): void {
    this.circuitState = 'HALF_OPEN';
    this.halfOpenAttempts = 0;

    logger.info('Circuit breaker HALF-OPEN - allowing limited operations');
    this.emit('circuit:half-open', this.getCircuitBreakerStats());
  }

  /**
   * Close the circuit breaker (normal operation)
   */
  private closeCircuit(): void {
    this.circuitState = 'CLOSED';
    this.failureCount = 0;
    this.halfOpenAttempts = 0;

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }

    logger.info('Circuit breaker CLOSED - normal operation resumed');
    this.emit('circuit:closed', this.getCircuitBreakerStats());
  }

  /**
   * Get circuit breaker statistics
   *
   * @returns Current circuit breaker state and stats
   */
  getCircuitBreakerStats(): CircuitBreakerStats {
    return {
      state: this.circuitState,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      nextRetryAt:
        this.circuitState === 'OPEN' && this.resetTimer
          ? new Date(Date.now() + this.config.circuitBreakerResetTimeout)
          : undefined,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  resetCircuitBreaker(): void {
    this.closeCircuit();
    this.successCount = 0;
    logger.info('Circuit breaker manually reset');
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Execute a function with circuit breaker protection
   *
   * @param fn - Function to execute
   * @returns Function result or throws if circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      const error = new Error('Circuit breaker is OPEN - system overloaded');
      (error as any).code = 'CIRCUIT_BREAKER_OPEN';
      throw error;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Generate unique slot ID
   */
  private generateSlotId(): string {
    return `slot_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let value = bytes;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Clean up resources
   */
  shutdown(): void {
    this.stopMonitoring();

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }

    this.activeSlots.clear();
    this.removeAllListeners();

    logger.info('Memory manager shutdown complete');
  }
}

// ============================================================================
// Default Export - Singleton Instance
// ============================================================================

export const memoryManager = new MemoryManagerService();

export default memoryManager;

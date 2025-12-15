/**
 * Memory Manager Service Tests
 *
 * Comprehensive unit tests for the MemoryManagerService covering:
 * - Memory monitoring (REQ-PERF-002)
 * - Upload slot management (REQ-PERF-001)
 * - Circuit breaker pattern (REQ-PERF-004)
 */

import { MemoryManagerService } from '../memoryManager.service';

describe('MemoryManagerService', () => {
  let service: MemoryManagerService;

  beforeEach(() => {
    service = new MemoryManagerService({
      maxConcurrentUploads: 3,
      circuitBreakerThreshold: 3,
      circuitBreakerResetTimeout: 100, // Short timeout for testing
      halfOpenMaxAttempts: 2,
    });
  });

  afterEach(() => {
    service.shutdown();
  });

  // ==========================================================================
  // Memory Monitoring Tests
  // ==========================================================================

  describe('Memory Monitoring', () => {
    describe('getMemoryStats', () => {
      it('should return valid memory statistics', () => {
        const stats = service.getMemoryStats();

        expect(stats.heapUsed).toBeGreaterThan(0);
        expect(stats.heapTotal).toBeGreaterThan(0);
        expect(stats.heapLimit).toBeGreaterThan(0);
        expect(stats.usagePercent).toBeGreaterThanOrEqual(0);
        expect(stats.usagePercent).toBeLessThanOrEqual(1);
        expect(stats.rss).toBeGreaterThan(0);
      });

      it('should have heapUsed less than heapLimit', () => {
        const stats = service.getMemoryStats();
        expect(stats.heapUsed).toBeLessThan(stats.heapLimit);
      });
    });

    describe('checkMemory', () => {
      it('should return OK level under normal conditions', () => {
        const result = service.checkMemory();

        // Under test conditions, memory should be OK
        expect(result.allowed).toBe(true);
        expect(['OK', 'WARNING']).toContain(result.level);
        expect(result.stats).toBeDefined();
      });

      it('should include stats in the result', () => {
        const result = service.checkMemory();

        expect(result.stats.heapUsed).toBeDefined();
        expect(result.stats.heapTotal).toBeDefined();
        expect(result.stats.usagePercent).toBeDefined();
      });
    });

    describe('monitoring lifecycle', () => {
      it('should start and stop monitoring', () => {
        service.startMonitoring();
        // No error means it started successfully

        service.stopMonitoring();
        // No error means it stopped successfully
      });

      it('should be idempotent for start/stop', () => {
        service.startMonitoring();
        service.startMonitoring(); // Should not throw

        service.stopMonitoring();
        service.stopMonitoring(); // Should not throw
      });
    });
  });

  // ==========================================================================
  // Upload Slot Management Tests
  // ==========================================================================

  describe('Upload Slot Management', () => {
    describe('acquireUploadSlot', () => {
      it('should acquire a slot successfully', async () => {
        const slotId = await service.acquireUploadSlot('user1', 'file.pdf');

        expect(slotId).toBeDefined();
        expect(typeof slotId).toBe('string');
        expect(slotId).toMatch(/^slot_/);
      });

      it('should track user and filename', async () => {
        await service.acquireUploadSlot('user123', 'document.pdf');
        const status = service.getSlotStatus();

        expect(status.slots[0].userId).toBe('user123');
        expect(status.slots[0].filename).toBe('document.pdf');
      });

      it('should respect maximum concurrent uploads', async () => {
        // Acquire all available slots
        const slot1 = await service.acquireUploadSlot();
        const slot2 = await service.acquireUploadSlot();
        const slot3 = await service.acquireUploadSlot();

        expect(slot1).toBeDefined();
        expect(slot2).toBeDefined();
        expect(slot3).toBeDefined();

        // Try to acquire one more
        const slot4 = await service.acquireUploadSlot();
        expect(slot4).toBeNull();
      });

      it('should emit slot:acquired event', async () => {
        const acquiredSpy = jest.fn();
        service.on('slot:acquired', acquiredSpy);

        await service.acquireUploadSlot('user1', 'file.pdf');

        expect(acquiredSpy).toHaveBeenCalledTimes(1);
        expect(acquiredSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user1',
            filename: 'file.pdf',
          })
        );
      });
    });

    describe('releaseUploadSlot', () => {
      it('should release a slot successfully', async () => {
        const slotId = await service.acquireUploadSlot();
        expect(slotId).toBeDefined();

        const statusBefore = service.getSlotStatus();
        expect(statusBefore.active).toBe(1);

        service.releaseUploadSlot(slotId!, true);

        const statusAfter = service.getSlotStatus();
        expect(statusAfter.active).toBe(0);
      });

      it('should handle unknown slot gracefully', () => {
        // Should not throw
        service.releaseUploadSlot('unknown-slot-id', true);
      });

      it('should emit slot:released event', async () => {
        const releasedSpy = jest.fn();
        service.on('slot:released', releasedSpy);

        const slotId = await service.acquireUploadSlot();
        service.releaseUploadSlot(slotId!, true);

        expect(releasedSpy).toHaveBeenCalledTimes(1);
        expect(releasedSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
          })
        );
      });

      it('should allow new slots after release', async () => {
        // Fill all slots
        const slots = await Promise.all([
          service.acquireUploadSlot(),
          service.acquireUploadSlot(),
          service.acquireUploadSlot(),
        ]);

        // Try to get another (should fail)
        const extraSlot = await service.acquireUploadSlot();
        expect(extraSlot).toBeNull();

        // Release one slot
        service.releaseUploadSlot(slots[0]!, true);

        // Now we should be able to get another
        const newSlot = await service.acquireUploadSlot();
        expect(newSlot).toBeDefined();
      });
    });

    describe('getSlotStatus', () => {
      it('should return correct slot counts', async () => {
        const initialStatus = service.getSlotStatus();
        expect(initialStatus.active).toBe(0);
        expect(initialStatus.max).toBe(3);
        expect(initialStatus.available).toBe(3);

        await service.acquireUploadSlot();
        await service.acquireUploadSlot();

        const updatedStatus = service.getSlotStatus();
        expect(updatedStatus.active).toBe(2);
        expect(updatedStatus.available).toBe(1);
      });

      it('should include slot details', async () => {
        await service.acquireUploadSlot('user1', 'file1.pdf');

        const status = service.getSlotStatus();
        expect(status.slots).toHaveLength(1);
        expect(status.slots[0]).toMatchObject({
          userId: 'user1',
          filename: 'file1.pdf',
        });
        expect(status.slots[0].acquiredAt).toBeInstanceOf(Date);
      });
    });
  });

  // ==========================================================================
  // Circuit Breaker Tests
  // ==========================================================================

  describe('Circuit Breaker', () => {
    describe('initial state', () => {
      it('should start in CLOSED state', () => {
        const stats = service.getCircuitBreakerStats();
        expect(stats.state).toBe('CLOSED');
        expect(stats.failureCount).toBe(0);
      });

      it('should allow execution in CLOSED state', () => {
        expect(service.canExecute()).toBe(true);
      });
    });

    describe('failure tracking', () => {
      it('should track failures', () => {
        service.recordFailure();
        service.recordFailure();

        const stats = service.getCircuitBreakerStats();
        expect(stats.failureCount).toBe(2);
        expect(stats.lastFailure).toBeDefined();
      });

      it('should open circuit after threshold failures', () => {
        service.recordFailure();
        service.recordFailure();
        service.recordFailure(); // Threshold is 3

        const stats = service.getCircuitBreakerStats();
        expect(stats.state).toBe('OPEN');
        expect(service.canExecute()).toBe(false);
      });

      it('should emit circuit:open event', () => {
        const openSpy = jest.fn();
        service.on('circuit:open', openSpy);

        service.recordFailure();
        service.recordFailure();
        service.recordFailure();

        expect(openSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('success tracking', () => {
      it('should reset failure count on success', () => {
        service.recordFailure();
        service.recordFailure();

        const statsBefore = service.getCircuitBreakerStats();
        expect(statsBefore.failureCount).toBe(2);

        service.recordSuccess();

        const statsAfter = service.getCircuitBreakerStats();
        expect(statsAfter.failureCount).toBe(0);
        expect(statsAfter.lastSuccess).toBeDefined();
      });
    });

    describe('state transitions', () => {
      it('should transition from OPEN to HALF_OPEN after timeout', async () => {
        // Open the circuit
        service.recordFailure();
        service.recordFailure();
        service.recordFailure();

        expect(service.getCircuitBreakerStats().state).toBe('OPEN');

        // Wait for reset timeout (100ms in test config)
        await new Promise((resolve) => setTimeout(resolve, 150));

        expect(service.getCircuitBreakerStats().state).toBe('HALF_OPEN');
      });

      it('should close circuit after successes in HALF_OPEN', async () => {
        // Open the circuit
        service.recordFailure();
        service.recordFailure();
        service.recordFailure();

        // Wait for HALF_OPEN
        await new Promise((resolve) => setTimeout(resolve, 150));

        expect(service.getCircuitBreakerStats().state).toBe('HALF_OPEN');

        // Record successes (need 2 for test config)
        service.recordSuccess();
        service.recordSuccess();

        expect(service.getCircuitBreakerStats().state).toBe('CLOSED');
      });

      it('should reopen circuit on failure in HALF_OPEN', async () => {
        // Open the circuit
        service.recordFailure();
        service.recordFailure();
        service.recordFailure();

        // Wait for HALF_OPEN
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Fail in HALF_OPEN
        service.recordFailure();

        expect(service.getCircuitBreakerStats().state).toBe('OPEN');
      });
    });

    describe('execute wrapper', () => {
      it('should execute function when circuit is closed', async () => {
        const fn = jest.fn().mockResolvedValue('success');

        const result = await service.execute(fn);

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalled();
      });

      it('should record success after successful execution', async () => {
        const fn = jest.fn().mockResolvedValue('success');

        await service.execute(fn);

        const stats = service.getCircuitBreakerStats();
        expect(stats.successCount).toBe(1);
      });

      it('should record failure and rethrow on error', async () => {
        const error = new Error('Test error');
        const fn = jest.fn().mockRejectedValue(error);

        await expect(service.execute(fn)).rejects.toThrow('Test error');

        const stats = service.getCircuitBreakerStats();
        expect(stats.failureCount).toBe(1);
      });

      it('should throw when circuit is open', async () => {
        // Open the circuit
        service.recordFailure();
        service.recordFailure();
        service.recordFailure();

        const fn = jest.fn().mockResolvedValue('success');

        await expect(service.execute(fn)).rejects.toThrow('Circuit breaker is OPEN');
        expect(fn).not.toHaveBeenCalled();
      });
    });

    describe('manual reset', () => {
      it('should reset circuit breaker manually', () => {
        // Open the circuit
        service.recordFailure();
        service.recordFailure();
        service.recordFailure();

        expect(service.getCircuitBreakerStats().state).toBe('OPEN');

        service.resetCircuitBreaker();

        const stats = service.getCircuitBreakerStats();
        expect(stats.state).toBe('CLOSED');
        expect(stats.failureCount).toBe(0);
        expect(stats.successCount).toBe(0);
      });
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration', () => {
    it('should prevent slot acquisition when circuit is open', async () => {
      // Open the circuit
      service.recordFailure();
      service.recordFailure();
      service.recordFailure();

      const slotId = await service.acquireUploadSlot();
      expect(slotId).toBeNull();
    });

    it('should update circuit breaker on slot release', async () => {
      const slotId = await service.acquireUploadSlot();

      // Release with success
      service.releaseUploadSlot(slotId!, true);

      const stats = service.getCircuitBreakerStats();
      expect(stats.successCount).toBe(1);
    });

    it('should update circuit breaker on failed slot release', async () => {
      const slotId = await service.acquireUploadSlot();

      // Release with failure
      service.releaseUploadSlot(slotId!, false);

      const stats = service.getCircuitBreakerStats();
      expect(stats.failureCount).toBe(1);
    });
  });

  // ==========================================================================
  // Cleanup Tests
  // ==========================================================================

  describe('Cleanup', () => {
    it('should clean up resources on shutdown', async () => {
      service.startMonitoring();
      await service.acquireUploadSlot();
      await service.acquireUploadSlot();

      service.shutdown();

      const status = service.getSlotStatus();
      expect(status.active).toBe(0);
    });
  });
});

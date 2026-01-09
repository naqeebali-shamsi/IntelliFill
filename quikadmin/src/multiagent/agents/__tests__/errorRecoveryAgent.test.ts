/**
 * Error Recovery Agent Tests
 *
 * Unit tests for the error recovery agent with retry and fallback strategies.
 */

import {
  recoverFromError,
  analyzeError,
  executeRecoveryAction,
  shouldAttemptRecovery,
  getRetryDelay,
  createErrorEntry,
  classifyError,
  isRetryable,
  getSeverity,
  calculateRetryDelay,
  MAX_RETRIES,
  ErrorCategory,
  ExtendedRecoveryAction,
} from '../errorRecoveryAgent';
import { DocumentState, createInitialState } from '../../types/state';

// Mock the piiSafeLogger
jest.mock('../../../utils/piiSafeLogger', () => ({
  piiSafeLogger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ErrorRecoveryAgent', () => {
  // Helper function to create a test document state
  function createTestState(): DocumentState {
    return createInitialState(
      'doc-123',
      'user-456',
      'job-789',
      '/path/to/file.pdf',
      'file.pdf',
      'application/pdf',
      1024
    );
  }

  // ========================================
  // ERROR CLASSIFICATION TESTS
  // ========================================
  describe('classifyError', () => {
    it('should classify network errors', () => {
      expect(classifyError(new Error('ENOTFOUND'))).toBe('network_error');
      expect(classifyError(new Error('ECONNREFUSED'))).toBe('network_error');
      expect(classifyError(new Error('ETIMEDOUT'))).toBe('network_error');
      expect(classifyError(new Error('Network error occurred'))).toBe('network_error');
    });

    it('should classify rate limit errors', () => {
      expect(classifyError(new Error('Rate limit exceeded'))).toBe('api_rate_limit');
      expect(classifyError(new Error('429 Too Many Requests'))).toBe('api_rate_limit');
      expect(classifyError(new Error('Too many requests'))).toBe('api_rate_limit');
    });

    it('should classify quota exceeded errors', () => {
      expect(classifyError(new Error('Quota exceeded'))).toBe('api_quota_exceeded');
      expect(classifyError(new Error('Usage limit reached'))).toBe('api_quota_exceeded');
    });

    it('should classify timeout errors', () => {
      expect(classifyError(new Error('Request timeout'))).toBe('timeout');
      expect(classifyError(new Error('Operation timed out'))).toBe('timeout');
    });

    it('should classify parse errors', () => {
      expect(classifyError(new Error('JSON parse error'))).toBe('parse_error');
      expect(classifyError(new Error('Syntax error'))).toBe('parse_error');
    });

    it('should classify invalid input errors', () => {
      expect(classifyError(new Error('Invalid input'))).toBe('invalid_input');
      expect(classifyError(new Error('Malformed data'))).toBe('invalid_input');
      expect(classifyError(new Error('Missing required field'))).toBe('invalid_input');
    });

    it('should classify model errors', () => {
      expect(classifyError(new Error('Model error'))).toBe('model_error');
      expect(classifyError(new Error('Inference failed'))).toBe('model_error');
    });

    it('should classify validation errors', () => {
      expect(classifyError(new Error('Validation failed'))).toBe('validation_error');
      expect(classifyError(new Error('Schema error'))).toBe('validation_error');
    });

    it('should classify unknown errors', () => {
      expect(classifyError(new Error('Some random error'))).toBe('unknown');
      expect(classifyError(new Error(''))).toBe('unknown');
    });
  });

  // ========================================
  // RETRYABLE CHECK TESTS
  // ========================================
  describe('isRetryable', () => {
    it('should mark network errors as retryable', () => {
      expect(isRetryable('network_error')).toBe(true);
    });

    it('should mark rate limit errors as retryable', () => {
      expect(isRetryable('api_rate_limit')).toBe(true);
    });

    it('should mark timeout errors as retryable', () => {
      expect(isRetryable('timeout')).toBe(true);
    });

    it('should mark parse errors as retryable', () => {
      expect(isRetryable('parse_error')).toBe(true);
    });

    it('should not mark quota exceeded as retryable', () => {
      expect(isRetryable('api_quota_exceeded')).toBe(false);
    });

    it('should not mark invalid input as retryable', () => {
      expect(isRetryable('invalid_input')).toBe(false);
    });

    it('should not mark model errors as retryable', () => {
      expect(isRetryable('model_error')).toBe(false);
    });

    it('should not mark unknown errors as retryable', () => {
      expect(isRetryable('unknown')).toBe(false);
    });
  });

  // ========================================
  // SEVERITY TESTS
  // ========================================
  describe('getSeverity', () => {
    it('should return correct severity for each category', () => {
      expect(getSeverity('network_error')).toBe('medium');
      expect(getSeverity('api_rate_limit')).toBe('medium');
      expect(getSeverity('api_quota_exceeded')).toBe('high');
      expect(getSeverity('timeout')).toBe('medium');
      expect(getSeverity('parse_error')).toBe('low');
      expect(getSeverity('invalid_input')).toBe('high');
      expect(getSeverity('model_error')).toBe('high');
      expect(getSeverity('validation_error')).toBe('low');
      expect(getSeverity('unknown')).toBe('high');
    });
  });

  // ========================================
  // RETRY DELAY CALCULATION TESTS
  // ========================================
  describe('calculateRetryDelay', () => {
    it('should return base delay for first retry', () => {
      const delay = calculateRetryDelay(0);
      expect(delay).toBe(1000); // Base delay
    });

    it('should use exponential backoff', () => {
      const delay0 = calculateRetryDelay(0);
      const delay1 = calculateRetryDelay(1);
      const delay2 = calculateRetryDelay(2);

      expect(delay1).toBe(delay0 * 2);
      expect(delay2).toBe(delay0 * 4);
    });

    it('should cap at maximum delay', () => {
      const delay = calculateRetryDelay(10); // Very high retry count
      expect(delay).toBeLessThanOrEqual(30000);
    });
  });

  // ========================================
  // SHOULD ATTEMPT RECOVERY TESTS
  // ========================================
  describe('shouldAttemptRecovery', () => {
    it('should allow recovery for retryable errors under max retries', () => {
      expect(shouldAttemptRecovery(0, 'network_error')).toBe(true);
      expect(shouldAttemptRecovery(1, 'timeout')).toBe(true);
      expect(shouldAttemptRecovery(2, 'api_rate_limit')).toBe(true);
    });

    it('should not allow recovery at max retries', () => {
      expect(shouldAttemptRecovery(MAX_RETRIES, 'network_error')).toBe(false);
      expect(shouldAttemptRecovery(MAX_RETRIES + 1, 'timeout')).toBe(false);
    });

    it('should not allow recovery for non-retryable errors', () => {
      expect(shouldAttemptRecovery(0, 'invalid_input')).toBe(false);
      expect(shouldAttemptRecovery(0, 'api_quota_exceeded')).toBe(false);
    });
  });

  // ========================================
  // GET RETRY DELAY TESTS
  // ========================================
  describe('getRetryDelay', () => {
    it('should return calculated delay', () => {
      expect(getRetryDelay(0)).toBe(calculateRetryDelay(0));
      expect(getRetryDelay(1)).toBe(calculateRetryDelay(1));
      expect(getRetryDelay(2)).toBe(calculateRetryDelay(2));
    });
  });

  // ========================================
  // CREATE ERROR ENTRY TESTS
  // ========================================
  describe('createErrorEntry', () => {
    it('should create error entry with correct fields', () => {
      const error = new Error('Test error');
      const entry = createErrorEntry('extractor', error);

      expect(entry.node).toBe('extractor');
      expect(entry.error).toBe('Test error');
      expect(entry.timestamp).toBeInstanceOf(Date);
      expect(entry.recoveryAction).toBeUndefined();
    });

    it('should include recovery action if provided', () => {
      const error = new Error('Test error');
      const recoveryAction = {
        type: 'retry' as const,
        targetAgent: 'extractor' as const,
        reason: 'Network error',
      };
      const entry = createErrorEntry('extractor', error, recoveryAction);

      expect(entry.recoveryAction).toEqual(recoveryAction);
    });
  });

  // ========================================
  // ANALYZE ERROR TESTS
  // ========================================
  describe('analyzeError', () => {
    it('should classify and provide recovery actions for network errors', () => {
      const state = createTestState();
      const error = new Error('ECONNREFUSED');

      const result = analyzeError(error, state, 0);

      expect(result.category).toBe('network_error');
      expect(result.retryable).toBe(true);
      expect(result.severity).toBe('medium');
      expect(result.suggestedActions.length).toBeGreaterThan(0);
      expect(result.suggestedActions[0].type).toBe('retry');
    });

    it('should provide fallback actions for rate limit errors', () => {
      const state = createTestState();
      const error = new Error('Rate limit exceeded');

      const result = analyzeError(error, state, 0);

      expect(result.category).toBe('api_rate_limit');
      expect(result.suggestedActions.some(a => a.type === 'retry')).toBe(true);
      expect(result.suggestedActions.some(a => a.type === 'fallback')).toBe(true);
    });

    it('should provide manual escalation for quota exceeded', () => {
      const state = createTestState();
      const error = new Error('Quota exceeded');

      const result = analyzeError(error, state, 0);

      expect(result.category).toBe('api_quota_exceeded');
      expect(result.retryable).toBe(false);
      expect(result.suggestedActions.some(a => a.type === 'manual')).toBe(true);
    });

    it('should mark as non-retryable after max retries', () => {
      const state = createTestState();
      const error = new Error('Network error');

      const result = analyzeError(error, state, MAX_RETRIES);

      expect(result.retryable).toBe(false);
    });

    it('should provide success probability for each action', () => {
      const state = createTestState();
      const error = new Error('Network error');

      const result = analyzeError(error, state, 0);

      for (const action of result.suggestedActions) {
        expect(action.successProbability).toBeGreaterThanOrEqual(0);
        expect(action.successProbability).toBeLessThanOrEqual(1);
      }
    });

    it('should decrease success probability with more retries', () => {
      const state = createTestState();
      const error = new Error('Network error');

      const result0 = analyzeError(error, state, 0);
      const result1 = analyzeError(error, state, 1);
      const result2 = analyzeError(error, state, 2);

      const retry0 = result0.suggestedActions.find(a => a.type === 'retry');
      const retry1 = result1.suggestedActions.find(a => a.type === 'retry');
      const retry2 = result2.suggestedActions.find(a => a.type === 'retry');

      if (retry0 && retry1 && retry2) {
        expect(retry1.successProbability).toBeLessThan(retry0.successProbability);
        expect(retry2.successProbability).toBeLessThan(retry1.successProbability);
      }
    });
  });

  // ========================================
  // RECOVER FROM ERROR TESTS
  // ========================================
  describe('recoverFromError', () => {
    it('should return retry action for retryable errors', async () => {
      const state = createTestState();
      const error = new Error('Network timeout');

      const action = await recoverFromError(error, state, 0);

      expect(action.type).toBe('retry');
      expect(action.reason).toContain('Network');
    });

    it('should return fallback action for non-retryable errors', async () => {
      const state = createTestState();
      const error = new Error('Quota exceeded');

      const action = await recoverFromError(error, state, 0);

      expect(['fallback', 'manual']).toContain(action.type);
    });

    it('should return manual action after max retries', async () => {
      const state = createTestState();
      state.processingControl.retryCount = MAX_RETRIES;
      const error = new Error('Network error');

      const action = await recoverFromError(error, state, MAX_RETRIES);

      // Should not suggest retry after max retries
      expect(['fallback', 'manual']).toContain(action.type);
    });

    it('should include parameters in recovery action', async () => {
      const state = createTestState();
      const error = new Error('Rate limit exceeded');

      const action = await recoverFromError(error, state, 0);

      // Rate limit retry should include delay parameter
      if (action.type === 'retry') {
        expect(action.parameters).toBeDefined();
        expect(action.parameters?.delayMs).toBeGreaterThan(0);
      }
    });
  });

  // ========================================
  // EXECUTE RECOVERY ACTION TESTS
  // ========================================
  describe('executeRecoveryAction', () => {
    it('should execute retry action', async () => {
      const state = createTestState();
      const action: ExtendedRecoveryAction = {
        type: 'retry',
        targetAgent: 'extractor',
        reason: 'Network error',
        successProbability: 0.7,
        estimatedTimeMs: 100,
        parameters: {
          delayMs: 100,
        },
      };

      const result = await executeRecoveryAction(action, state);

      expect(result.success).toBe(true);
      expect(result.updatedState?.processingControl?.retryCount).toBe(state.processingControl.retryCount + 1);
    });

    it('should execute fallback action', async () => {
      const state = createTestState();
      const action: ExtendedRecoveryAction = {
        type: 'fallback',
        targetAgent: 'extractor',
        reason: 'Use pattern extraction',
        successProbability: 0.5,
        estimatedTimeMs: 500,
        parameters: {
          usePatternOnly: true,
        },
      };

      const result = await executeRecoveryAction(action, state);

      expect(result.success).toBe(true);
      expect(result.updatedState?.extractionMetadata?.model).toBe('pattern-fallback');
    });

    it('should execute skip action', async () => {
      const state = createTestState();
      const action: ExtendedRecoveryAction = {
        type: 'skip',
        targetAgent: 'qa',
        reason: 'Skip with warning',
        successProbability: 0.8,
        estimatedTimeMs: 0,
        parameters: {
          addWarning: true,
          requireReview: true,
        },
      };

      const result = await executeRecoveryAction(action, state);

      expect(result.success).toBe(true);
      expect(result.updatedState?.qualityAssessment?.needsHumanReview).toBe(true);
    });

    it('should execute manual escalation action', async () => {
      const state = createTestState();
      const action: ExtendedRecoveryAction = {
        type: 'manual',
        targetAgent: 'orchestrator',
        reason: 'Requires human review',
        successProbability: 1.0,
        estimatedTimeMs: 0,
        parameters: {
          escalationReason: 'Test escalation',
        },
      };

      const result = await executeRecoveryAction(action, state);

      expect(result.success).toBe(true);
      expect(result.updatedState?.qualityAssessment?.needsHumanReview).toBe(true);
      expect(result.updatedState?.results?.needsReview).toBe(true);
    });
  });

  // ========================================
  // MAX RETRIES CONSTANT TEST
  // ========================================
  describe('MAX_RETRIES', () => {
    it('should be a reasonable value', () => {
      expect(MAX_RETRIES).toBeGreaterThanOrEqual(1);
      expect(MAX_RETRIES).toBeLessThanOrEqual(10);
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================
  describe('Edge Cases', () => {
    it('should handle empty error message', async () => {
      const state = createTestState();
      const error = new Error('');

      const action = await recoverFromError(error, state, 0);

      // Should still return some action
      expect(action).toBeDefined();
      expect(action.type).toBeDefined();
    });

    it('should handle null parameters in error', async () => {
      const state = createTestState();
      const error = new Error('Test');
      // @ts-expect-error Testing edge case
      error.name = null;

      const action = await recoverFromError(error, state, 0);

      expect(action).toBeDefined();
    });

    it('should handle very high retry count', async () => {
      const state = createTestState();
      state.processingControl.retryCount = 100;
      const error = new Error('Network error');

      const action = await recoverFromError(error, state, 100);

      // Should not crash and should suggest manual escalation
      expect(action).toBeDefined();
    });

    it('should handle multiple concurrent recoveries', async () => {
      const state = createTestState();
      const errors = [
        new Error('Network error'),
        new Error('Timeout'),
        new Error('Parse error'),
      ];

      const results = await Promise.all(
        errors.map(error => recoverFromError(error, state, 0))
      );

      expect(results).toHaveLength(3);
      results.forEach(action => {
        expect(action).toBeDefined();
        expect(action.type).toBeDefined();
      });
    });
  });
});

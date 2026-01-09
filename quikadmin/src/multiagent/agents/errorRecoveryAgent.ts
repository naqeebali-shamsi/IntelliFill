/**
 * Error Recovery Agent
 *
 * Handles errors and failures in the document processing pipeline.
 * Implements retry strategies, fallback mechanisms, and human escalation.
 *
 * Features:
 * - Retry strategies with exponential backoff
 * - Fallback to pattern extraction
 * - Classification-based recovery strategies
 * - Human escalation for unrecoverable errors
 * - Error tracking and reporting
 *
 * @module multiagent/agents/errorRecoveryAgent
 */

import { DocumentState, AgentName, RecoveryAction } from '../types/state';
import { piiSafeLogger as logger } from '../../utils/piiSafeLogger';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Extended recovery action with additional metadata
 */
export interface ExtendedRecoveryAction extends RecoveryAction {
  /** Estimated success probability (0-1) */
  successProbability: number;
  /** Estimated time for recovery (ms) */
  estimatedTimeMs: number;
  /** Additional context for the action */
  context?: Record<string, unknown>;
}

/**
 * Error classification result
 */
export interface ErrorClassification {
  /** Category of the error */
  category: ErrorCategory;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Suggested recovery actions in priority order */
  suggestedActions: ExtendedRecoveryAction[];
}

/**
 * Categories of errors that can occur
 */
export type ErrorCategory =
  | 'network_error'
  | 'api_rate_limit'
  | 'api_quota_exceeded'
  | 'invalid_input'
  | 'timeout'
  | 'parse_error'
  | 'model_error'
  | 'validation_error'
  | 'unknown';

/**
 * Recovery context providing information about the failure
 */
export interface RecoveryContext {
  /** Current workflow state */
  state: DocumentState;
  /** The error that occurred */
  error: Error;
  /** Number of retry attempts so far */
  retryCount: number;
  /** Agent that encountered the error */
  failedAgent: AgentName;
  /** Time of failure */
  failureTime: Date;
}

/**
 * Recovery result after attempting recovery
 */
export interface RecoveryResult {
  /** The chosen recovery action */
  action: ExtendedRecoveryAction;
  /** Whether recovery was successful */
  success: boolean;
  /** Updated state after recovery (if successful) */
  updatedState?: Partial<DocumentState>;
  /** Error message if recovery failed */
  errorMessage?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum retry attempts before escalation
 */
export const MAX_RETRIES = 3;

/**
 * Base delay for exponential backoff (ms)
 */
const BASE_RETRY_DELAY_MS = 1000;

/**
 * Maximum delay between retries (ms)
 */
const MAX_RETRY_DELAY_MS = 30000;

/**
 * Error patterns for classification
 */
const ERROR_PATTERNS: Array<{ pattern: RegExp; category: ErrorCategory }> = [
  { pattern: /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i, category: 'network_error' },
  { pattern: /rate\s*limit|429|too\s*many\s*requests/i, category: 'api_rate_limit' },
  { pattern: /quota|exceeded|usage\s*limit/i, category: 'api_quota_exceeded' },
  { pattern: /timeout|timed?\s*out/i, category: 'timeout' },
  { pattern: /parse|JSON|syntax/i, category: 'parse_error' },
  { pattern: /invalid|malformed|missing\s*required/i, category: 'invalid_input' },
  { pattern: /model|inference|prediction/i, category: 'model_error' },
  { pattern: /validation|schema|constraint/i, category: 'validation_error' },
];

// ============================================================================
// Error Classification Functions
// ============================================================================

/**
 * Classify an error based on its message and type
 */
function classifyError(error: Error): ErrorCategory {
  const message = error.message || '';
  const name = error.name || '';
  const combined = `${name}: ${message}`;

  for (const { pattern, category } of ERROR_PATTERNS) {
    if (pattern.test(combined)) {
      return category;
    }
  }

  return 'unknown';
}

/**
 * Determine if an error category is retryable
 */
function isRetryable(category: ErrorCategory): boolean {
  const retryableCategories: ErrorCategory[] = [
    'network_error',
    'api_rate_limit',
    'timeout',
    'parse_error',
  ];

  return retryableCategories.includes(category);
}

/**
 * Get severity level for an error category
 */
function getSeverity(category: ErrorCategory): 'low' | 'medium' | 'high' | 'critical' {
  const severityMap: Record<ErrorCategory, 'low' | 'medium' | 'high' | 'critical'> = {
    network_error: 'medium',
    api_rate_limit: 'medium',
    api_quota_exceeded: 'high',
    timeout: 'medium',
    parse_error: 'low',
    invalid_input: 'high',
    model_error: 'high',
    validation_error: 'low',
    unknown: 'high',
  };

  return severityMap[category];
}

/**
 * Calculate retry delay with exponential backoff
 */
function calculateRetryDelay(retryCount: number): number {
  const delay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCount);
  return Math.min(delay, MAX_RETRY_DELAY_MS);
}

// ============================================================================
// Recovery Strategy Functions
// ============================================================================

/**
 * Generate recovery actions for network errors
 */
function getNetworkErrorRecovery(
  context: RecoveryContext
): ExtendedRecoveryAction[] {
  const actions: ExtendedRecoveryAction[] = [];

  if (context.retryCount < MAX_RETRIES) {
    actions.push({
      type: 'retry',
      targetAgent: context.failedAgent,
      reason: 'Network error - retrying with backoff',
      successProbability: 0.7 - (context.retryCount * 0.15),
      estimatedTimeMs: calculateRetryDelay(context.retryCount),
      parameters: {
        delayMs: calculateRetryDelay(context.retryCount),
      },
    });
  }

  actions.push({
    type: 'fallback',
    targetAgent: 'extractor',
    reason: 'Use pattern-based extraction as fallback',
    successProbability: 0.5,
    estimatedTimeMs: 500,
    parameters: {
      usePatternOnly: true,
    },
  });

  return actions;
}

/**
 * Generate recovery actions for rate limit errors
 */
function getRateLimitRecovery(
  context: RecoveryContext
): ExtendedRecoveryAction[] {
  const actions: ExtendedRecoveryAction[] = [];

  // Wait and retry with longer delay
  if (context.retryCount < MAX_RETRIES) {
    const delay = calculateRetryDelay(context.retryCount) * 2; // Double delay for rate limits

    actions.push({
      type: 'retry',
      targetAgent: context.failedAgent,
      reason: 'Rate limited - waiting before retry',
      successProbability: 0.8,
      estimatedTimeMs: delay,
      parameters: {
        delayMs: delay,
      },
    });
  }

  // Fallback to pattern extraction
  actions.push({
    type: 'fallback',
    targetAgent: 'extractor',
    reason: 'Use pattern extraction to avoid API calls',
    successProbability: 0.5,
    estimatedTimeMs: 500,
    parameters: {
      usePatternOnly: true,
    },
  });

  return actions;
}

/**
 * Generate recovery actions for quota exceeded errors
 */
function getQuotaExceededRecovery(
  context: RecoveryContext
): ExtendedRecoveryAction[] {
  return [
    {
      type: 'fallback',
      targetAgent: 'extractor',
      reason: 'API quota exceeded - using pattern extraction',
      successProbability: 0.5,
      estimatedTimeMs: 500,
      parameters: {
        usePatternOnly: true,
      },
    },
    {
      type: 'manual',
      targetAgent: 'orchestrator',
      reason: 'Escalate to human review - API quota exhausted',
      successProbability: 1.0,
      estimatedTimeMs: 0,
      parameters: {
        escalationReason: 'API quota exceeded',
      },
    },
  ];
}

/**
 * Generate recovery actions for timeout errors
 */
function getTimeoutRecovery(
  context: RecoveryContext
): ExtendedRecoveryAction[] {
  const actions: ExtendedRecoveryAction[] = [];

  if (context.retryCount < MAX_RETRIES) {
    actions.push({
      type: 'retry',
      targetAgent: context.failedAgent,
      reason: 'Timeout - retrying with extended timeout',
      successProbability: 0.6,
      estimatedTimeMs: calculateRetryDelay(context.retryCount),
      parameters: {
        timeoutMs: 60000 * (context.retryCount + 1), // Increase timeout
      },
    });
  }

  // Fallback to simpler processing
  actions.push({
    type: 'fallback',
    targetAgent: 'extractor',
    reason: 'Use faster pattern extraction',
    successProbability: 0.5,
    estimatedTimeMs: 500,
    parameters: {
      usePatternOnly: true,
      maxTextLength: 2000, // Process less text
    },
  });

  return actions;
}

/**
 * Generate recovery actions for parse errors
 */
function getParseErrorRecovery(
  context: RecoveryContext
): ExtendedRecoveryAction[] {
  const actions: ExtendedRecoveryAction[] = [];

  if (context.retryCount < MAX_RETRIES) {
    actions.push({
      type: 'retry',
      targetAgent: context.failedAgent,
      reason: 'Parse error - retrying with cleaner prompts',
      successProbability: 0.5,
      estimatedTimeMs: calculateRetryDelay(context.retryCount),
      parameters: {
        strictJsonMode: true,
      },
    });
  }

  // Fallback to pattern extraction
  actions.push({
    type: 'fallback',
    targetAgent: 'extractor',
    reason: 'LLM response parsing failed - using patterns',
    successProbability: 0.6,
    estimatedTimeMs: 500,
    parameters: {
      usePatternOnly: true,
    },
  });

  return actions;
}

/**
 * Generate recovery actions for validation errors
 */
function getValidationErrorRecovery(
  context: RecoveryContext
): ExtendedRecoveryAction[] {
  return [
    {
      type: 'skip',
      targetAgent: 'qa',
      reason: 'Continue with warnings despite validation issues',
      successProbability: 0.8,
      estimatedTimeMs: 0,
      parameters: {
        addWarning: true,
        requireReview: true,
      },
    },
    {
      type: 'manual',
      targetAgent: 'orchestrator',
      reason: 'Escalate for human validation',
      successProbability: 1.0,
      estimatedTimeMs: 0,
      parameters: {
        escalationReason: 'Validation failures require human review',
      },
    },
  ];
}

/**
 * Generate recovery actions for invalid input
 */
function getInvalidInputRecovery(
  context: RecoveryContext
): ExtendedRecoveryAction[] {
  return [
    {
      type: 'manual',
      targetAgent: 'orchestrator',
      reason: 'Invalid input data - requires human review',
      successProbability: 1.0,
      estimatedTimeMs: 0,
      parameters: {
        escalationReason: 'Input data is invalid or corrupted',
      },
    },
  ];
}

/**
 * Generate recovery actions for model errors
 */
function getModelErrorRecovery(
  context: RecoveryContext
): ExtendedRecoveryAction[] {
  const actions: ExtendedRecoveryAction[] = [];

  if (context.retryCount < MAX_RETRIES) {
    actions.push({
      type: 'retry',
      targetAgent: context.failedAgent,
      reason: 'Model error - retrying',
      successProbability: 0.4,
      estimatedTimeMs: calculateRetryDelay(context.retryCount),
    });
  }

  // Fallback to pattern extraction
  actions.push({
    type: 'fallback',
    targetAgent: 'extractor',
    reason: 'Model failed - using pattern extraction',
    successProbability: 0.5,
    estimatedTimeMs: 500,
    parameters: {
      usePatternOnly: true,
    },
  });

  // Escalate if all else fails
  actions.push({
    type: 'manual',
    targetAgent: 'orchestrator',
    reason: 'Model consistently failing - escalate to human',
    successProbability: 1.0,
    estimatedTimeMs: 0,
    parameters: {
      escalationReason: 'AI model failures',
    },
  });

  return actions;
}

/**
 * Generate recovery actions for unknown errors
 */
function getUnknownErrorRecovery(
  context: RecoveryContext
): ExtendedRecoveryAction[] {
  const actions: ExtendedRecoveryAction[] = [];

  if (context.retryCount < 1) {
    actions.push({
      type: 'retry',
      targetAgent: context.failedAgent,
      reason: 'Unknown error - attempting single retry',
      successProbability: 0.3,
      estimatedTimeMs: calculateRetryDelay(0),
    });
  }

  actions.push({
    type: 'fallback',
    targetAgent: 'extractor',
    reason: 'Falling back to pattern extraction',
    successProbability: 0.4,
    estimatedTimeMs: 500,
    parameters: {
      usePatternOnly: true,
    },
  });

  actions.push({
    type: 'manual',
    targetAgent: 'orchestrator',
    reason: 'Unknown error requires human review',
    successProbability: 1.0,
    estimatedTimeMs: 0,
    parameters: {
      escalationReason: 'Unclassified error',
    },
  });

  return actions;
}

// ============================================================================
// Main Recovery Functions
// ============================================================================

/**
 * Analyze an error and determine recovery strategy
 */
export function analyzeError(
  error: Error,
  context: DocumentState,
  retryCount: number
): ErrorClassification {
  const category = classifyError(error);
  const retryable = isRetryable(category);
  const severity = getSeverity(category);

  // Determine the failed agent from current state
  const failedAgent = (context.processingControl.currentNode as AgentName) || 'orchestrator';

  const recoveryContext: RecoveryContext = {
    state: context,
    error,
    retryCount,
    failedAgent,
    failureTime: new Date(),
  };

  let suggestedActions: ExtendedRecoveryAction[];

  switch (category) {
    case 'network_error':
      suggestedActions = getNetworkErrorRecovery(recoveryContext);
      break;
    case 'api_rate_limit':
      suggestedActions = getRateLimitRecovery(recoveryContext);
      break;
    case 'api_quota_exceeded':
      suggestedActions = getQuotaExceededRecovery(recoveryContext);
      break;
    case 'timeout':
      suggestedActions = getTimeoutRecovery(recoveryContext);
      break;
    case 'parse_error':
      suggestedActions = getParseErrorRecovery(recoveryContext);
      break;
    case 'validation_error':
      suggestedActions = getValidationErrorRecovery(recoveryContext);
      break;
    case 'invalid_input':
      suggestedActions = getInvalidInputRecovery(recoveryContext);
      break;
    case 'model_error':
      suggestedActions = getModelErrorRecovery(recoveryContext);
      break;
    default:
      suggestedActions = getUnknownErrorRecovery(recoveryContext);
  }

  return {
    category,
    retryable: retryable && retryCount < MAX_RETRIES,
    severity,
    suggestedActions,
  };
}

/**
 * Attempt to recover from an error
 *
 * @param error - The error that occurred
 * @param context - Current workflow state
 * @param retryCount - Number of retry attempts so far
 * @returns RecoveryAction with the recommended recovery approach
 *
 * @example
 * ```typescript
 * const action = await recoverFromError(
 *   new Error('Network timeout'),
 *   workflowState,
 *   0
 * );
 * console.log(action.type); // 'retry'
 * console.log(action.reason); // 'Network error - retrying with backoff'
 * ```
 */
export async function recoverFromError(
  error: Error,
  context: DocumentState,
  retryCount: number
): Promise<RecoveryAction> {
  logger.info('Starting error recovery', {
    documentId: context.documentId,
    errorMessage: error.message,
    retryCount,
  });

  // Analyze the error
  const classification = analyzeError(error, context, retryCount);

  logger.info('Error classified', {
    documentId: context.documentId,
    category: classification.category,
    severity: classification.severity,
    retryable: classification.retryable,
    actionCount: classification.suggestedActions.length,
  });

  // Select the best recovery action (first in priority order)
  const selectedAction = classification.suggestedActions[0];

  if (!selectedAction) {
    // No recovery possible, escalate to manual
    logger.warn('No recovery action available, escalating to manual', {
      documentId: context.documentId,
    });

    return {
      type: 'manual',
      targetAgent: 'orchestrator',
      reason: 'No recovery strategy available',
      parameters: {
        originalError: error.message,
        category: classification.category,
      },
    };
  }

  logger.info('Recovery action selected', {
    documentId: context.documentId,
    actionType: selectedAction.type,
    targetAgent: selectedAction.targetAgent,
    successProbability: selectedAction.successProbability,
  });

  // Return the action for the workflow to execute
  return {
    type: selectedAction.type,
    targetAgent: selectedAction.targetAgent,
    reason: selectedAction.reason,
    parameters: selectedAction.parameters,
  };
}

/**
 * Execute a recovery action and return updated state
 */
export async function executeRecoveryAction(
  action: ExtendedRecoveryAction,
  context: DocumentState
): Promise<RecoveryResult> {
  logger.info('Executing recovery action', {
    documentId: context.documentId,
    actionType: action.type,
    targetAgent: action.targetAgent,
  });

  try {
    switch (action.type) {
      case 'retry': {
        // Wait for backoff delay if specified
        const delay = (action.parameters?.delayMs as number) || 0;
        if (delay > 0) {
          await sleep(delay);
        }

        return {
          action,
          success: true,
          updatedState: {
            processingControl: {
              ...context.processingControl,
              retryCount: context.processingControl.retryCount + 1,
              currentNode: action.targetAgent,
            },
          },
        };
      }

      case 'fallback': {
        return {
          action,
          success: true,
          updatedState: {
            processingControl: {
              ...context.processingControl,
              currentNode: action.targetAgent,
            },
            extractionMetadata: {
              ...context.extractionMetadata,
              model: 'pattern-fallback',
            },
          },
        };
      }

      case 'skip': {
        return {
          action,
          success: true,
          updatedState: {
            processingControl: {
              ...context.processingControl,
              completedNodes: [...context.processingControl.completedNodes, context.processingControl.currentNode],
              currentNode: 'finalize',
            },
            qualityAssessment: {
              ...context.qualityAssessment,
              needsHumanReview: true,
              suggestions: [
                ...context.qualityAssessment.suggestions,
                'Processing completed with skipped steps - review recommended',
              ],
            },
          },
        };
      }

      case 'manual': {
        return {
          action,
          success: true,
          updatedState: {
            processingControl: {
              ...context.processingControl,
              currentNode: 'finalize',
            },
            qualityAssessment: {
              ...context.qualityAssessment,
              isValid: false,
              needsHumanReview: true,
              suggestions: [
                ...context.qualityAssessment.suggestions,
                `Escalated for human review: ${action.reason}`,
              ],
            },
            results: {
              ...context.results,
              success: false,
              needsReview: true,
              reviewReasons: [
                ...(context.results.reviewReasons || []),
                action.reason,
              ],
            },
          },
        };
      }

      default:
        return {
          action,
          success: false,
          errorMessage: `Unknown recovery action type: ${action.type}`,
        };
    }
  } catch (error) {
    logger.error('Recovery action failed', {
      documentId: context.documentId,
      actionType: action.type,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      action,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Recovery action execution failed',
    };
  }
}

/**
 * Helper to sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if recovery should be attempted
 */
export function shouldAttemptRecovery(
  retryCount: number,
  errorCategory: ErrorCategory
): boolean {
  // Never retry more than MAX_RETRIES times
  if (retryCount >= MAX_RETRIES) {
    return false;
  }

  // Some categories are not retryable
  if (!isRetryable(errorCategory)) {
    return false;
  }

  return true;
}

/**
 * Get the delay before next retry
 */
export function getRetryDelay(retryCount: number): number {
  return calculateRetryDelay(retryCount);
}

/**
 * Create an error tracking entry for the state
 */
export function createErrorEntry(
  node: string,
  error: Error,
  recoveryAction?: RecoveryAction
): {
  node: string;
  error: string;
  timestamp: Date;
  recoveryAction?: RecoveryAction;
} {
  return {
    node,
    error: error.message,
    timestamp: new Date(),
    recoveryAction,
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  classifyError,
  isRetryable,
  getSeverity,
  calculateRetryDelay,
  ERROR_PATTERNS,
  BASE_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
};

export default recoverFromError;

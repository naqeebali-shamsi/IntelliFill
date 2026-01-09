/**
 * Multi-Agent Document Processing - Agents Module
 *
 * Exports all agent implementations for the document processing pipeline.
 *
 * @module multiagent/agents
 */

// Classifier Agent
export {
  classifyDocument,
  classifyWithPatterns,
  patternBasedClassify,
  normalizeCategory,
  VALID_CATEGORIES,
  CATEGORY_ALIASES,
  CLASSIFICATION_PATTERNS,
} from './classifierAgent';

export type { ClassificationResult } from './classifierAgent';

// Extractor Agent
export {
  extractDocumentData,
  extractWithPatterns as extractWithPatternsFallback,
  mergeExtractionResults,
  validateWithPattern,
  EXTRACTION_CONFIGS,
  EXTRACTION_PATTERNS,
  LOW_CONFIDENCE_THRESHOLD,
} from './extractorAgent';

export type { ExtractionResult } from './extractorAgent';

// Mapper Agent
export {
  mapExtractedFields,
  getCanonicalFieldName,
  isCanonicalField,
  getCanonicalFieldsForCategory,
  getAliasesForCategory,
  normalizeFieldName,
  calculateSemanticSimilarity,
  COMMON_ALIASES,
  PASSPORT_ALIASES,
  EMIRATES_ID_ALIASES,
  VISA_ALIASES,
  TRADE_LICENSE_ALIASES,
  BANK_STATEMENT_ALIASES,
  INVOICE_ALIASES,
  CONTRACT_ALIASES,
  LABOR_CARD_ALIASES,
  MAPPING_CONFIDENCE,
} from './mapperAgent';

export type { MappingResult, MappingDetail } from './mapperAgent';

// QA Agent
export {
  validateExtraction,
  getRequiredFields,
  hasAllRequiredFields,
  getLowConfidenceFields,
  calculateAverageConfidence,
  getRulesForCategory,
  parseDate,
  validateDateField,
  validateExpiryDate,
  validateAmountField,
  CONFIDENCE_THRESHOLDS,
  PASSPORT_RULES,
  EMIRATES_ID_RULES,
  VISA_RULES,
  TRADE_LICENSE_RULES,
  BANK_STATEMENT_RULES,
  INVOICE_RULES,
  CONTRACT_RULES,
  LABOR_CARD_RULES,
} from './qaAgent';

export type { QAResult, QAIssue, QAIssueType, QASummary } from './qaAgent';

// Error Recovery Agent
export {
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
  ERROR_PATTERNS,
  BASE_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
} from './errorRecoveryAgent';

export type {
  ExtendedRecoveryAction,
  ErrorClassification,
  ErrorCategory,
  RecoveryContext,
  RecoveryResult,
} from './errorRecoveryAgent';

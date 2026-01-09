/**
 * Multi-Agent Document Processing Pipeline
 *
 * This module provides LangGraph-based multi-agent document processing
 * to enhance OCR accuracy from 85-90% to 92-97%.
 *
 * Architecture:
 * - Orchestrator: Coordinates agent execution flow
 * - Classifier: Document type identification (Gemini 1.5 Flash)
 * - Extractor: Field extraction (Llama 3.2 8B)
 * - Mapper: Schema mapping (Mistral 7B)
 * - QA: Quality validation (Llama 3.2 8B)
 * - Error Recovery: Self-correction on failures
 *
 * Usage:
 * ```typescript
 * import { processDocument } from './multiagent';
 *
 * const result = await processDocument(
 *   documentId,
 *   userId,
 *   jobId,
 *   filePath,
 *   fileName,
 *   fileType,
 *   fileSize
 * );
 * ```
 */

// State types and utilities
export {
  DocumentState,
  DocumentCategory,
  AgentName,
  StepStatus,
  ConfidenceScore,
  ExtractedField,
  AgentExecution,
  QualityAssessment,
  QualityIssue,
  RecoveryAction,
  OCROptimization,
  createInitialState,
  updateState,
  addAgentExecution,
  addError,
  advanceToNode,
} from './types/state';

// Workflow
export {
  createDocumentProcessingGraph,
  processDocument,
  NODE_NAMES,
} from './workflow';

// Agents
export {
  classifyDocument,
  classifyWithPatterns,
  normalizeCategory,
  VALID_CATEGORIES,
  CATEGORY_ALIASES,
  ClassificationResult,
} from './agents/classifierAgent';

// Version info
export const PIPELINE_VERSION = '1.0.0';
export const SUPPORTED_MODELS = {
  classifier: ['gemini-1.5-flash', 'gemini-1.5-pro'],
  extractor: ['llama3.2:8b', 'llama3:8b'],
  mapper: ['mistral:7b', 'mistral:7b-instruct'],
  qa: ['llama3.2:8b', 'llama3:8b'],
};

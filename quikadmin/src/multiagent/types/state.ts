/**
 * LangGraph State Types for Multi-Agent Document Processing
 *
 * Defines the state interface used throughout the document processing pipeline.
 * State follows LangGraph's immutability patterns for checkpointing and recovery.
 */

/**
 * Document classification categories
 */
export type DocumentCategory =
  | 'PASSPORT'
  | 'EMIRATES_ID'
  | 'TRADE_LICENSE'
  | 'VISA'
  | 'LABOR_CARD'
  | 'ESTABLISHMENT_CARD'
  | 'MOA'
  | 'BANK_STATEMENT'
  | 'INVOICE'
  | 'CONTRACT'
  | 'ID_CARD'
  | 'UNKNOWN';

/**
 * Agent names in the pipeline
 */
export type AgentName =
  | 'classifier'
  | 'ocrOptimizer'
  | 'extractor'
  | 'mapper'
  | 'qa'
  | 'errorRecovery'
  | 'orchestrator';

/**
 * Processing status for individual steps
 */
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Confidence level for extracted data
 */
export interface ConfidenceScore {
  overall: number; // 0-100
  byField: Record<string, number>;
}

/**
 * Extracted field with metadata
 */
export interface ExtractedField {
  value: string | number | boolean | null;
  confidence: number; // 0-100
  source: 'ocr' | 'llm' | 'rule' | 'user';
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
    page: number;
  };
  rawText?: string;
}

/**
 * Agent execution record for history tracking
 */
export interface AgentExecution {
  agent: AgentName;
  startTime: Date;
  endTime?: Date;
  status: StepStatus;
  model?: string;
  tokenCount?: number;
  error?: string;
  retryCount: number;
}

/**
 * Quality assessment result from QA agent
 */
export interface QualityAssessment {
  isValid: boolean;
  overallScore: number; // 0-100
  issues: QualityIssue[];
  suggestions: string[];
  needsHumanReview: boolean;
}

/**
 * Individual quality issue
 */
export interface QualityIssue {
  field: string;
  type: 'missing' | 'invalid_format' | 'low_confidence' | 'inconsistent' | 'suspicious';
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestedValue?: string;
}

/**
 * Error recovery action
 */
export interface RecoveryAction {
  type: 'retry' | 'fallback' | 'skip' | 'manual';
  targetAgent: AgentName;
  reason: string;
  parameters?: Record<string, unknown>;
}

/**
 * OCR optimization parameters
 */
export interface OCROptimization {
  dpi: number;
  contrast: number;
  rotation: number;
  deskew: boolean;
  denoise: boolean;
  preprocessingApplied: string[];
}

/**
 * Main document state for the LangGraph workflow
 *
 * This state is passed through all nodes and checkpointed for recovery.
 * Uses LangGraph's annotation pattern for state management.
 */
export interface DocumentState {
  // === Document Identity ===
  documentId: string;
  userId: string;
  jobId: string;

  // === Input Data ===
  filePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;

  // === Classification ===
  classification: {
    category: DocumentCategory;
    confidence: number;
    alternativeCategories: Array<{ category: DocumentCategory; confidence: number }>;
    classifiedAt?: Date;
  };

  // === OCR Data ===
  ocrData: {
    rawText: string;
    textByPage: Record<number, string>;
    optimization: OCROptimization;
    processingTimeMs: number;
    engineUsed: 'tesseract' | 'gemini' | 'hybrid';
  };

  // === Extraction ===
  extractedFields: Record<string, ExtractedField>;
  extractionMetadata: {
    model: string;
    promptVersion: string;
    processingTimeMs: number;
    totalFields: number;
    highConfidenceFields: number;
    lowConfidenceFields: number;
  };

  // === Mapping ===
  mappedFields: Record<string, ExtractedField>;
  mappingMetadata: {
    model: string;
    schemaVersion: string;
    processingTimeMs: number;
    fieldsMatched: number;
    fieldsUnmapped: number;
  };

  // === Quality Assessment ===
  qualityAssessment: QualityAssessment;

  // === Processing Control ===
  processingControl: {
    currentNode: string;
    pendingNodes: string[];
    completedNodes: string[];
    retryCount: number;
    maxRetries: number;
    timeoutMs: number;
    startedAt: Date;
    lastUpdatedAt: Date;
  };

  // === Error Handling ===
  errors: Array<{
    node: string;
    error: string;
    timestamp: Date;
    recoveryAction?: RecoveryAction;
  }>;

  // === Agent History ===
  agentHistory: AgentExecution[];

  // === Final Results ===
  results: {
    success: boolean;
    finalData: Record<string, unknown>;
    confidence: ConfidenceScore;
    processingTimeMs: number;
    needsReview: boolean;
    reviewReasons: string[];
  };

  // === Metadata ===
  metadata: {
    pipelineVersion: string;
    createdAt: Date;
    updatedAt: Date;
    checkpointId?: string;
    parentCheckpointId?: string;
  };
}

/**
 * Initial state factory for creating new document processing jobs
 */
export function createInitialState(
  documentId: string,
  userId: string,
  jobId: string,
  filePath: string,
  fileName: string,
  fileType: string,
  fileSize: number
): DocumentState {
  const now = new Date();

  return {
    documentId,
    userId,
    jobId,
    filePath,
    fileName,
    fileType,
    fileSize,

    classification: {
      category: 'UNKNOWN',
      confidence: 0,
      alternativeCategories: [],
    },

    ocrData: {
      rawText: '',
      textByPage: {},
      optimization: {
        dpi: 300,
        contrast: 1.0,
        rotation: 0,
        deskew: false,
        denoise: false,
        preprocessingApplied: [],
      },
      processingTimeMs: 0,
      engineUsed: 'tesseract',
    },

    extractedFields: {},
    extractionMetadata: {
      model: '',
      promptVersion: '',
      processingTimeMs: 0,
      totalFields: 0,
      highConfidenceFields: 0,
      lowConfidenceFields: 0,
    },

    mappedFields: {},
    mappingMetadata: {
      model: '',
      schemaVersion: '',
      processingTimeMs: 0,
      fieldsMatched: 0,
      fieldsUnmapped: 0,
    },

    qualityAssessment: {
      isValid: false,
      overallScore: 0,
      issues: [],
      suggestions: [],
      needsHumanReview: true,
    },

    processingControl: {
      currentNode: 'start',
      pendingNodes: ['classifier', 'extractor', 'mapper', 'qa'],
      completedNodes: [],
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 300000, // 5 minutes
      startedAt: now,
      lastUpdatedAt: now,
    },

    errors: [],
    agentHistory: [],

    results: {
      success: false,
      finalData: {},
      confidence: { overall: 0, byField: {} },
      processingTimeMs: 0,
      needsReview: true,
      reviewReasons: [],
    },

    metadata: {
      pipelineVersion: '1.0.0',
      createdAt: now,
      updatedAt: now,
    },
  };
}

/**
 * State update helper that maintains immutability
 * Used for LangGraph state transitions
 */
export function updateState(
  state: DocumentState,
  updates: Partial<DocumentState>
): DocumentState {
  return {
    ...state,
    ...updates,
    metadata: {
      ...state.metadata,
      ...updates.metadata,
      updatedAt: new Date(),
    },
    processingControl: {
      ...state.processingControl,
      ...updates.processingControl,
      lastUpdatedAt: new Date(),
    },
  };
}

/**
 * Add an agent execution to history
 */
export function addAgentExecution(
  state: DocumentState,
  execution: AgentExecution
): DocumentState {
  return updateState(state, {
    agentHistory: [...state.agentHistory, execution],
  });
}

/**
 * Add an error to the state
 */
export function addError(
  state: DocumentState,
  node: string,
  error: string,
  recoveryAction?: RecoveryAction
): DocumentState {
  return updateState(state, {
    errors: [
      ...state.errors,
      {
        node,
        error,
        timestamp: new Date(),
        recoveryAction,
      },
    ],
  });
}

/**
 * Move to the next node in processing
 */
export function advanceToNode(state: DocumentState, nextNode: string): DocumentState {
  const currentNode = state.processingControl.currentNode;

  return updateState(state, {
    processingControl: {
      ...state.processingControl,
      currentNode: nextNode,
      completedNodes: [...state.processingControl.completedNodes, currentNode],
      pendingNodes: state.processingControl.pendingNodes.filter((n) => n !== nextNode),
    },
  });
}

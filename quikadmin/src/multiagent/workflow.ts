/**
 * LangGraph Document Processing Workflow
 *
 * Orchestrates the multi-agent document processing pipeline using LangGraph.
 * Implements the following flow:
 *
 *   start -> classifier -> extractor -> mapper -> qa -> [end | errorRecovery]
 *                                                           |
 *                                                           v
 *                                                    (retry loop)
 *
 * Features:
 * - Conditional routing based on QA results
 * - Error recovery with retry logic
 * - State checkpointing for resumability
 * - Parallel model fallback support
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import {
  DocumentState,
  createInitialState,
  updateState,
  addAgentExecution,
  addError,
  advanceToNode,
  AgentName,
} from './types/state';

// Agent imports
import { classifyDocument, ClassificationResult } from './agents/classifierAgent';
import { extractDocumentData } from './agents/extractorAgent';
import { mapExtractedFields } from './agents/mapperAgent';
import { validateExtraction } from './agents/qaAgent';
import { recoverFromError } from './agents/errorRecoveryAgent';
import type { ExtractedFieldResult } from '../types/extractedData';
import type { ExtractedField } from './types/state';

/**
 * Graph node names matching the processing stages
 */
export const NODE_NAMES = {
  CLASSIFY: 'classify',
  EXTRACT: 'extract',
  MAP: 'map',
  QA: 'qa',
  ERROR_RECOVER: 'errorRecover',
  FINALIZE: 'finalize',
} as const;

/**
 * Maximum retries for error recovery
 */
const MAX_RETRIES = 3;

/**
 * Classification node implementation
 * Uses the Gemini-powered classifier agent with pattern-based fallback
 */
async function classifyNode(
  state: DocumentState,
  config?: RunnableConfig
): Promise<Partial<DocumentState>> {
  logger.info('Classification node executing', { documentId: state.documentId });

  const startTime = Date.now();
  let classificationResult: ClassificationResult;
  let status: 'completed' | 'failed' = 'completed';
  let error: string | undefined;

  try {
    // Use the classifier agent with text from OCR data if available
    const text = state.ocrData?.rawText || '';

    // Note: Image classification would require base64 image data
    // For now, we classify based on text content
    classificationResult = await classifyDocument(text);

    logger.info('Classification successful', {
      documentId: state.documentId,
      documentType: classificationResult.documentType,
      confidence: classificationResult.confidence,
    });
  } catch (err) {
    status = 'failed';
    error = err instanceof Error ? err.message : 'Unknown classification error';

    logger.error('Classification failed', {
      documentId: state.documentId,
      error,
    });

    // Fallback to UNKNOWN on failure
    classificationResult = {
      documentType: 'UNKNOWN',
      confidence: 0,
      metadata: {},
    };
  }

  const execution = {
    agent: 'classifier' as AgentName,
    startTime: new Date(startTime),
    endTime: new Date(),
    status,
    model: 'gemini-2.5-flash',
    tokenCount: 0,
    retryCount: 0,
    error,
  };

  return {
    classification: {
      category: classificationResult.documentType,
      confidence: classificationResult.confidence,
      alternativeCategories:
        classificationResult.alternativeTypes?.map((alt) => ({
          category: alt.type,
          confidence: alt.confidence,
        })) || [],
      classifiedAt: new Date(),
    },
    agentHistory: [...state.agentHistory, execution],
    processingControl: {
      ...state.processingControl,
      currentNode: NODE_NAMES.EXTRACT,
      completedNodes: [...state.processingControl.completedNodes, NODE_NAMES.CLASSIFY],
    },
  };
}

/**
 * Placeholder node implementations
 * These will be replaced with actual agent implementations
 */

async function extractNode(
  state: DocumentState,
  config?: RunnableConfig
): Promise<Partial<DocumentState>> {
  logger.info('Extraction node executing', { documentId: state.documentId });

  const startTime = Date.now();

  try {
    const result = await extractDocumentData(
      state.ocrData?.rawText || '',
      state.classification.category,
      undefined, // imageBase64 - pass if available in state
      state.userId // userId for cache scoping (prevents cross-user cache leakage)
    );

    // Adapt ExtractionResult.fields (ExtractedFieldResult) -> Record<string, ExtractedField>
    const extractedFields: Record<string, ExtractedField> = {};
    for (const [key, efr] of Object.entries(result.fields)) {
      extractedFields[key] = {
        value: efr.value,
        confidence: efr.confidence,
        source: efr.source === 'pattern' ? 'rule' : efr.source === 'llm' ? 'llm' : 'ocr',
        rawText: efr.rawText,
      };
    }

    const fieldCount = Object.keys(extractedFields).length;
    const highConf = Object.values(extractedFields).filter((f) => f.confidence >= 80).length;

    const execution = {
      agent: 'extractor' as AgentName,
      startTime: new Date(startTime),
      endTime: new Date(),
      status: 'completed' as const,
      model: result.modelUsed,
      tokenCount: 0,
      retryCount: 0,
    };

    return {
      extractedFields,
      extractionMetadata: {
        model: result.modelUsed,
        promptVersion: '1.0.0',
        processingTimeMs: result.processingTime,
        totalFields: fieldCount,
        highConfidenceFields: highConf,
        lowConfidenceFields: fieldCount - highConf,
      },
      agentHistory: [...state.agentHistory, execution],
      processingControl: {
        ...state.processingControl,
        currentNode: NODE_NAMES.MAP,
        completedNodes: [...state.processingControl.completedNodes, NODE_NAMES.EXTRACT],
      },
    };
  } catch (error) {
    logger.error('Extraction failed', { documentId: state.documentId, error });
    return {
      errors: [
        ...state.errors,
        {
          node: NODE_NAMES.EXTRACT,
          error: (error as Error).message,
          timestamp: new Date(),
        },
      ],
      processingControl: {
        ...state.processingControl,
        currentNode: NODE_NAMES.ERROR_RECOVER,
      },
    };
  }
}

async function mapNode(
  state: DocumentState,
  config?: RunnableConfig
): Promise<Partial<DocumentState>> {
  logger.info('Mapping node executing', { documentId: state.documentId });

  const startTime = Date.now();

  try {
    // Convert state's ExtractedField -> ExtractedFieldResult for mapper agent
    const agentInput: Record<string, ExtractedFieldResult> = {};
    for (const [key, field] of Object.entries(state.extractedFields)) {
      agentInput[key] = {
        value: field.value,
        confidence: field.confidence,
        source: field.source === 'rule' ? 'pattern' : field.source === 'llm' ? 'llm' : 'ocr',
        rawText: field.rawText,
      };
    }

    const result = await mapExtractedFields(agentInput, state.classification.category);

    // Convert MappingResult -> Record<string, ExtractedField>
    // Use mappingDetails for full info (value, confidence, canonical name)
    const mappedFields: Record<string, ExtractedField> = {};
    for (const detail of result.mappingDetails) {
      if (detail.canonicalField) {
        const originalField = state.extractedFields[detail.originalField];
        mappedFields[detail.canonicalField] = {
          value: detail.value,
          confidence: detail.confidence,
          source: originalField?.source ?? 'llm',
          rawText: originalField?.rawText,
        };
      }
    }

    const execution = {
      agent: 'mapper' as AgentName,
      startTime: new Date(startTime),
      endTime: new Date(),
      status: 'completed' as const,
      model: 'rule-based',
      tokenCount: 0,
      retryCount: 0,
    };

    return {
      mappedFields,
      mappingMetadata: {
        model: 'rule-based',
        schemaVersion: '1.0.0',
        processingTimeMs: Date.now() - startTime,
        fieldsMatched: Object.keys(mappedFields).length,
        fieldsUnmapped: result.unmappedFields.length,
      },
      agentHistory: [...state.agentHistory, execution],
      processingControl: {
        ...state.processingControl,
        currentNode: NODE_NAMES.QA,
        completedNodes: [...state.processingControl.completedNodes, NODE_NAMES.MAP],
      },
    };
  } catch (error) {
    logger.error('Mapping failed', { documentId: state.documentId, error });
    return {
      mappedFields: state.extractedFields, // fallback: pass through unmapped
      errors: [
        ...state.errors,
        {
          node: NODE_NAMES.MAP,
          error: (error as Error).message,
          timestamp: new Date(),
        },
      ],
      processingControl: {
        ...state.processingControl,
        currentNode: NODE_NAMES.QA,
        completedNodes: [...state.processingControl.completedNodes, NODE_NAMES.MAP],
      },
    };
  }
}

async function qaNode(
  state: DocumentState,
  config?: RunnableConfig
): Promise<Partial<DocumentState>> {
  logger.info('QA node executing', { documentId: state.documentId });

  const startTime = Date.now();

  try {
    // Convert ExtractedField -> ExtractedFieldResult for QA agent
    const qaInput: Record<string, ExtractedFieldResult> = {};
    for (const [key, field] of Object.entries(state.mappedFields)) {
      qaInput[key] = {
        value: field.value,
        confidence: field.confidence,
        source: field.source === 'rule' ? 'pattern' : field.source === 'llm' ? 'llm' : 'ocr',
        rawText: field.rawText,
      };
    }

    const result = await validateExtraction(qaInput, state.classification.category);

    const execution = {
      agent: 'qa' as AgentName,
      startTime: new Date(startTime),
      endTime: new Date(),
      status: 'completed' as const,
      model: 'rule-based',
      tokenCount: 0,
      retryCount: 0,
    };

    // Adapt QAResult -> QualityAssessment
    // QAIssue.issueType -> QualityIssue.type mapping
    const issueTypeMap: Record<
      string,
      'missing' | 'invalid_format' | 'low_confidence' | 'inconsistent' | 'suspicious'
    > = {
      missing_required: 'missing',
      invalid_format: 'invalid_format',
      low_confidence: 'low_confidence',
      cross_field_mismatch: 'inconsistent',
      suspicious_value: 'suspicious',
      date_validation: 'invalid_format',
      length_validation: 'invalid_format',
      pattern_mismatch: 'invalid_format',
    };

    return {
      qualityAssessment: {
        isValid: result.passed,
        overallScore: result.score,
        issues: result.issues.map((i) => ({
          field: i.field,
          type: issueTypeMap[i.issueType] || 'invalid_format',
          severity: i.severity,
          message: i.message,
          suggestedValue: i.suggestedFix,
        })),
        suggestions: result.issues.filter((i) => i.suggestedFix).map((i) => i.suggestedFix!),
        needsHumanReview: result.requiresHumanReview,
      },
      agentHistory: [...state.agentHistory, execution],
      processingControl: {
        ...state.processingControl,
        currentNode: result.passed ? NODE_NAMES.FINALIZE : NODE_NAMES.ERROR_RECOVER,
        completedNodes: [...state.processingControl.completedNodes, NODE_NAMES.QA],
      },
    };
  } catch (error) {
    logger.error('QA validation failed', { documentId: state.documentId, error });

    // Record the failed execution in agent history (mirrors the success path)
    const failedExecution = {
      agent: 'qa' as AgentName,
      startTime: new Date(startTime),
      endTime: new Date(),
      status: 'failed' as const,
      model: 'rule-based',
      tokenCount: 0,
      retryCount: 0,
      error: (error as Error).message,
    };

    return {
      qualityAssessment: {
        isValid: false,
        overallScore: 0,
        issues: [
          {
            field: '_system',
            type: 'missing',
            severity: 'error',
            message: (error as Error).message,
          },
        ],
        suggestions: [],
        needsHumanReview: true,
      },
      agentHistory: [...state.agentHistory, failedExecution],
      processingControl: {
        ...state.processingControl,
        currentNode: NODE_NAMES.ERROR_RECOVER,
      },
    };
  }
}

async function errorRecoverNode(
  state: DocumentState,
  config?: RunnableConfig
): Promise<Partial<DocumentState>> {
  logger.info('Error recovery node executing', {
    documentId: state.documentId,
    retryCount: state.processingControl.retryCount,
  });

  const startTime = Date.now();

  try {
    const lastError = state.errors[state.errors.length - 1];
    const error = new Error(lastError?.error ?? 'Unknown error');

    const action = await recoverFromError(error, state, state.processingControl.retryCount);

    const execution = {
      agent: 'errorRecovery' as AgentName,
      startTime: new Date(startTime),
      endTime: new Date(),
      status: 'completed' as const,
      retryCount: state.processingControl.retryCount + 1,
    };

    const newRetryCount = state.processingControl.retryCount + 1;

    // Determine next node based on recovery action
    let nextNode: string;
    if (action.type === 'retry' && newRetryCount < MAX_RETRIES) {
      // Route to the target agent for retry
      const agentToNode: Record<string, string> = {
        extractor: NODE_NAMES.EXTRACT,
        mapper: NODE_NAMES.MAP,
        qa: NODE_NAMES.QA,
        classifier: NODE_NAMES.CLASSIFY,
      };
      nextNode = agentToNode[action.targetAgent] || NODE_NAMES.EXTRACT;
    } else if (action.type === 'skip' || action.type === 'manual') {
      nextNode = NODE_NAMES.FINALIZE;
    } else {
      // Fallback or exhausted retries
      nextNode = newRetryCount < MAX_RETRIES ? NODE_NAMES.EXTRACT : NODE_NAMES.FINALIZE;
    }

    return {
      agentHistory: [...state.agentHistory, execution],
      processingControl: {
        ...state.processingControl,
        retryCount: newRetryCount,
        currentNode: nextNode,
      },
      errors:
        action.type === 'manual'
          ? [
              ...state.errors,
              {
                node: NODE_NAMES.ERROR_RECOVER,
                error: `Escalated: ${action.reason}`,
                timestamp: new Date(),
              },
            ]
          : state.errors,
    };
  } catch (recoveryError) {
    logger.error('Error recovery itself failed', { documentId: state.documentId, recoveryError });
    return {
      processingControl: {
        ...state.processingControl,
        retryCount: state.processingControl.retryCount + 1,
        currentNode: NODE_NAMES.FINALIZE,
      },
      errors: [
        ...state.errors,
        {
          node: NODE_NAMES.ERROR_RECOVER,
          error: 'Recovery failed: ' + (recoveryError as Error).message,
          timestamp: new Date(),
        },
      ],
    };
  }
}

async function finalizeNode(
  state: DocumentState,
  config?: RunnableConfig
): Promise<Partial<DocumentState>> {
  logger.info('Finalize node executing', { documentId: state.documentId });

  const startTime = state.processingControl.startedAt;
  const endTime = new Date();
  const processingTimeMs = endTime.getTime() - startTime.getTime();

  const success = state.qualityAssessment.isValid && state.errors.length === 0;

  return {
    results: {
      success,
      finalData: state.mappedFields,
      confidence: {
        overall: state.qualityAssessment.overallScore,
        byField: Object.fromEntries(
          Object.entries(state.mappedFields).map(([k, v]) => [k, v.confidence])
        ),
      },
      processingTimeMs,
      needsReview: !success || state.qualityAssessment.needsHumanReview,
      reviewReasons: state.qualityAssessment.issues.map((i) => i.message),
    },
    processingControl: {
      ...state.processingControl,
      currentNode: 'end',
      completedNodes: [...state.processingControl.completedNodes, NODE_NAMES.FINALIZE],
    },
  };
}

/**
 * Conditional routing after QA node
 * Determines whether to proceed to finalize or error recovery
 */
function routeAfterQA(state: DocumentState): string {
  if (state.qualityAssessment.isValid) {
    logger.debug('QA passed, routing to finalize', { documentId: state.documentId });
    return NODE_NAMES.FINALIZE;
  }

  if (state.processingControl.retryCount >= MAX_RETRIES) {
    logger.warn('Max retries reached, routing to finalize', {
      documentId: state.documentId,
      retryCount: state.processingControl.retryCount,
    });
    return NODE_NAMES.FINALIZE;
  }

  logger.info('QA failed, routing to error recovery', {
    documentId: state.documentId,
    issues: state.qualityAssessment.issues.length,
  });
  return NODE_NAMES.ERROR_RECOVER;
}

/**
 * Conditional routing after error recovery
 * Determines whether to retry extraction or give up
 */
function routeAfterErrorRecovery(state: DocumentState): string {
  if (state.processingControl.retryCount >= MAX_RETRIES) {
    logger.warn('Max retries exceeded, finalizing with errors', {
      documentId: state.documentId,
    });
    return NODE_NAMES.FINALIZE;
  }

  // Route to the appropriate node based on where the error originated
  const currentNode = state.processingControl.currentNode;
  if (currentNode === NODE_NAMES.CLASSIFY) {
    logger.info('Retrying classification after error recovery', {
      documentId: state.documentId,
      retryCount: state.processingControl.retryCount,
    });
    return NODE_NAMES.CLASSIFY;
  }

  logger.info('Retrying extraction after error recovery', {
    documentId: state.documentId,
    retryCount: state.processingControl.retryCount,
  });
  return NODE_NAMES.EXTRACT;
}

/**
 * Create the document processing graph
 */
export function createDocumentProcessingGraph() {
  // Define the graph with DocumentState
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graph = new StateGraph<any>({
    channels: {
      documentId: { value: (x: string, y?: string) => y ?? x },
      userId: { value: (x: string, y?: string) => y ?? x },
      jobId: { value: (x: string, y?: string) => y ?? x },
      filePath: { value: (x: string, y?: string) => y ?? x },
      fileName: { value: (x: string, y?: string) => y ?? x },
      fileType: { value: (x: string, y?: string) => y ?? x },
      fileSize: { value: (x: number, y?: number) => y ?? x },
      classification: { value: (x: any, y?: any) => y ?? x },
      ocrData: { value: (x: any, y?: any) => y ?? x },
      extractedFields: { value: (x: any, y?: any) => y ?? x },
      extractionMetadata: { value: (x: any, y?: any) => y ?? x },
      mappedFields: { value: (x: any, y?: any) => y ?? x },
      mappingMetadata: { value: (x: any, y?: any) => y ?? x },
      qualityAssessment: { value: (x: any, y?: any) => y ?? x },
      processingControl: { value: (x: any, y?: any) => y ?? x },
      errors: { value: (x: any[], y?: any[]) => y ?? x },
      agentHistory: { value: (x: any[], y?: any[]) => y ?? x },
      results: { value: (x: any, y?: any) => y ?? x },
      metadata: { value: (x: any, y?: any) => y ?? x },
    },
  });

  // Add nodes
  graph.addNode(NODE_NAMES.CLASSIFY, classifyNode);
  graph.addNode(NODE_NAMES.EXTRACT, extractNode);
  graph.addNode(NODE_NAMES.MAP, mapNode);
  graph.addNode(NODE_NAMES.QA, qaNode);
  graph.addNode(NODE_NAMES.ERROR_RECOVER, errorRecoverNode);
  graph.addNode(NODE_NAMES.FINALIZE, finalizeNode);

  // Add edges - use type assertions for LangGraph's strict typing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (graph as any).addEdge(START, NODE_NAMES.CLASSIFY);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (graph as any).addEdge(NODE_NAMES.CLASSIFY, NODE_NAMES.EXTRACT);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (graph as any).addEdge(NODE_NAMES.EXTRACT, NODE_NAMES.MAP);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (graph as any).addEdge(NODE_NAMES.MAP, NODE_NAMES.QA);

  // Conditional edges
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (graph as any).addConditionalEdges(NODE_NAMES.QA, routeAfterQA, {
    [NODE_NAMES.FINALIZE]: NODE_NAMES.FINALIZE,
    [NODE_NAMES.ERROR_RECOVER]: NODE_NAMES.ERROR_RECOVER,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (graph as any).addConditionalEdges(NODE_NAMES.ERROR_RECOVER, routeAfterErrorRecovery, {
    [NODE_NAMES.FINALIZE]: NODE_NAMES.FINALIZE,
    [NODE_NAMES.EXTRACT]: NODE_NAMES.EXTRACT,
    [NODE_NAMES.CLASSIFY]: NODE_NAMES.CLASSIFY,
  });

  // Final edge to END
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (graph as any).addEdge(NODE_NAMES.FINALIZE, END);

  return graph.compile();
}

/**
 * Execute the document processing workflow
 */
export async function processDocument(
  documentId: string,
  userId: string,
  jobId: string,
  filePath: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  config?: RunnableConfig
): Promise<DocumentState> {
  logger.info('Starting document processing workflow', {
    documentId,
    fileName,
    fileType,
  });

  // Create initial state
  const initialState = createInitialState(
    documentId,
    userId,
    jobId,
    filePath,
    fileName,
    fileType,
    fileSize
  );

  // Create and run the graph
  const graph = createDocumentProcessingGraph();

  try {
    // Enforce a hard workflow timeout (5 minutes) to prevent runaway processing
    const workflowTimeoutMs = 300000; // 5 minutes
    const finalState = (await Promise.race([
      graph.invoke(initialState, config),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Workflow timeout exceeded: processing took longer than ${workflowTimeoutMs}ms`
              )
            ),
          workflowTimeoutMs
        )
      ),
    ])) as DocumentState;

    logger.info('Document processing completed', {
      documentId,
      success: finalState.results.success,
      confidence: finalState.results.confidence.overall,
      processingTimeMs: finalState.results.processingTimeMs,
    });

    return finalState;
  } catch (error) {
    logger.error('Document processing failed', {
      documentId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Return state with error
    return addError(
      initialState,
      'workflow',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

// Export for testing
export const __test__ = {
  classifyNode,
  extractNode,
  mapNode,
  qaNode,
  errorRecoverNode,
  finalizeNode,
  routeAfterQA,
  routeAfterErrorRecovery,
};

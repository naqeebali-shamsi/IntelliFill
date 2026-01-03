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

// Node imports will be added as agents are implemented
// import { classifyNode } from './nodes/classifier';
// import { extractNode } from './nodes/extractor';
// import { mapNode } from './nodes/mapper';
// import { qaNode } from './nodes/qa';
// import { errorRecoverNode } from './nodes/errorRecovery';

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
 * Placeholder node implementations
 * These will be replaced with actual agent implementations
 */

async function classifyNode(
  state: DocumentState,
  config?: RunnableConfig
): Promise<Partial<DocumentState>> {
  logger.info('Classification node executing', { documentId: state.documentId });

  const startTime = Date.now();

  // TODO: Implement actual classification with Phi-3
  // For now, return a placeholder result

  const execution = {
    agent: 'classifier' as AgentName,
    startTime: new Date(startTime),
    endTime: new Date(),
    status: 'completed' as const,
    model: 'phi3:mini',
    tokenCount: 0,
    retryCount: 0,
  };

  return {
    classification: {
      category: 'UNKNOWN',
      confidence: 0,
      alternativeCategories: [],
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

async function extractNode(
  state: DocumentState,
  config?: RunnableConfig
): Promise<Partial<DocumentState>> {
  logger.info('Extraction node executing', { documentId: state.documentId });

  const startTime = Date.now();

  // TODO: Implement actual extraction with Llama 8B
  // For now, return a placeholder result

  const execution = {
    agent: 'extractor' as AgentName,
    startTime: new Date(startTime),
    endTime: new Date(),
    status: 'completed' as const,
    model: 'llama3.2:8b',
    tokenCount: 0,
    retryCount: 0,
  };

  return {
    extractedFields: {},
    extractionMetadata: {
      model: 'llama3.2:8b',
      promptVersion: '1.0.0',
      processingTimeMs: Date.now() - startTime,
      totalFields: 0,
      highConfidenceFields: 0,
      lowConfidenceFields: 0,
    },
    agentHistory: [...state.agentHistory, execution],
    processingControl: {
      ...state.processingControl,
      currentNode: NODE_NAMES.MAP,
      completedNodes: [...state.processingControl.completedNodes, NODE_NAMES.EXTRACT],
    },
  };
}

async function mapNode(
  state: DocumentState,
  config?: RunnableConfig
): Promise<Partial<DocumentState>> {
  logger.info('Mapping node executing', { documentId: state.documentId });

  const startTime = Date.now();

  // TODO: Implement actual mapping with Mistral 7B
  // For now, return a placeholder result

  const execution = {
    agent: 'mapper' as AgentName,
    startTime: new Date(startTime),
    endTime: new Date(),
    status: 'completed' as const,
    model: 'mistral:7b',
    tokenCount: 0,
    retryCount: 0,
  };

  return {
    mappedFields: state.extractedFields,
    mappingMetadata: {
      model: 'mistral:7b',
      schemaVersion: '1.0.0',
      processingTimeMs: Date.now() - startTime,
      fieldsMatched: Object.keys(state.extractedFields).length,
      fieldsUnmapped: 0,
    },
    agentHistory: [...state.agentHistory, execution],
    processingControl: {
      ...state.processingControl,
      currentNode: NODE_NAMES.QA,
      completedNodes: [...state.processingControl.completedNodes, NODE_NAMES.MAP],
    },
  };
}

async function qaNode(
  state: DocumentState,
  config?: RunnableConfig
): Promise<Partial<DocumentState>> {
  logger.info('QA node executing', { documentId: state.documentId });

  const startTime = Date.now();

  // TODO: Implement actual QA with Llama 8B
  // For now, return a placeholder result

  const execution = {
    agent: 'qa' as AgentName,
    startTime: new Date(startTime),
    endTime: new Date(),
    status: 'completed' as const,
    model: 'llama3.2:8b',
    tokenCount: 0,
    retryCount: 0,
  };

  // Placeholder: assume validation passes
  const isValid = true;

  return {
    qualityAssessment: {
      isValid,
      overallScore: isValid ? 85 : 50,
      issues: [],
      suggestions: [],
      needsHumanReview: !isValid,
    },
    agentHistory: [...state.agentHistory, execution],
    processingControl: {
      ...state.processingControl,
      currentNode: isValid ? NODE_NAMES.FINALIZE : NODE_NAMES.ERROR_RECOVER,
      completedNodes: [...state.processingControl.completedNodes, NODE_NAMES.QA],
    },
  };
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

  // TODO: Implement actual error recovery logic
  // For now, just increment retry count

  const execution = {
    agent: 'errorRecovery' as AgentName,
    startTime: new Date(startTime),
    endTime: new Date(),
    status: 'completed' as const,
    retryCount: state.processingControl.retryCount + 1,
  };

  const newRetryCount = state.processingControl.retryCount + 1;
  const shouldRetry = newRetryCount < MAX_RETRIES;

  return {
    agentHistory: [...state.agentHistory, execution],
    processingControl: {
      ...state.processingControl,
      retryCount: newRetryCount,
      currentNode: shouldRetry ? NODE_NAMES.EXTRACT : NODE_NAMES.FINALIZE,
    },
    errors: shouldRetry
      ? state.errors
      : [
          ...state.errors,
          {
            node: NODE_NAMES.ERROR_RECOVER,
            error: 'Max retries exceeded',
            timestamp: new Date(),
          },
        ],
  };
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
  const graph = new StateGraph<DocumentState>({
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

  // Add edges
  graph.addEdge(START, NODE_NAMES.CLASSIFY);
  graph.addEdge(NODE_NAMES.CLASSIFY, NODE_NAMES.EXTRACT);
  graph.addEdge(NODE_NAMES.EXTRACT, NODE_NAMES.MAP);
  graph.addEdge(NODE_NAMES.MAP, NODE_NAMES.QA);

  // Conditional edges
  graph.addConditionalEdges(NODE_NAMES.QA, routeAfterQA, {
    [NODE_NAMES.FINALIZE]: NODE_NAMES.FINALIZE,
    [NODE_NAMES.ERROR_RECOVER]: NODE_NAMES.ERROR_RECOVER,
  });

  graph.addConditionalEdges(NODE_NAMES.ERROR_RECOVER, routeAfterErrorRecovery, {
    [NODE_NAMES.FINALIZE]: NODE_NAMES.FINALIZE,
    [NODE_NAMES.EXTRACT]: NODE_NAMES.EXTRACT,
  });

  // Final edge to END
  graph.addEdge(NODE_NAMES.FINALIZE, END);

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
    const finalState = await graph.invoke(initialState, config);

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

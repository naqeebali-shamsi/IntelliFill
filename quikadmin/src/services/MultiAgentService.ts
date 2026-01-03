/**
 * MultiAgentService - Thin Wrapper for Multi-Agent Document Processing
 *
 * Sanitizes input and delegates to the multiagent pipeline.
 * Follows KISS/YAGNI principles - no unnecessary abstractions.
 */

import {
  DocumentState,
  createInitialState,
  updateState,
  createDocumentProcessingGraph,
} from '../multiagent';
import { sanitizeLLMInput } from '../utils/sanitizeLLMInput';

/**
 * Input parameters for multi-agent document processing
 */
export interface MultiAgentProcessInput {
  documentId: string;
  userId: string;
  rawText: string;
  jobId?: string;
  filePath?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
}

/**
 * Result structure matching Document.multiAgentResult schema
 */
export interface MultiAgentProcessResult {
  success: boolean;
  finalData: Record<string, unknown>;
  confidence: {
    overall: number;
    byField: Record<string, number>;
  };
  processingTimeMs: number;
  needsReview: boolean;
  reviewReasons: string[];
  pipelineVersion?: string;
  classification?: {
    category: string;
    confidence: number;
  };
}

/**
 * MultiAgentService - Wraps the multi-agent pipeline with input sanitization
 */
export class MultiAgentService {
  /**
   * Process a document through the multi-agent pipeline.
   * Sanitizes input text before processing to prevent prompt injection.
   *
   * @param input - Document processing input with rawText
   * @returns Full DocumentState from the pipeline
   */
  async process(input: MultiAgentProcessInput): Promise<DocumentState> {
    // Sanitize raw text to prevent prompt injection
    const sanitizedText = sanitizeLLMInput(input.rawText);

    // Create initial state with defaults for optional fields
    const initialState = createInitialState(
      input.documentId,
      input.userId,
      input.jobId || `job-${Date.now()}`,
      input.filePath || '',
      input.fileName || 'document',
      input.fileType || 'application/octet-stream',
      input.fileSize || 0
    );

    // Pre-fill the OCR data with sanitized text (skips OCR extraction step)
    const stateWithText = updateState(initialState, {
      ocrData: {
        ...initialState.ocrData,
        rawText: sanitizedText,
        textByPage: { 1: sanitizedText },
        engineUsed: 'tesseract', // Mark as pre-extracted
      },
    });

    // Create and run the graph
    const graph = createDocumentProcessingGraph();
    const finalState = (await graph.invoke(stateWithText)) as DocumentState;

    return finalState;
  }

  /**
   * Process and return a simplified result suitable for storing in DB.
   * Use this when you only need the result, not the full state.
   *
   * @param input - Document processing input
   * @returns Simplified result for database storage
   */
  async processAndGetResult(input: MultiAgentProcessInput): Promise<MultiAgentProcessResult> {
    const state = await this.process(input);

    return {
      success: state.results.success,
      finalData: state.results.finalData,
      confidence: state.results.confidence,
      processingTimeMs: state.results.processingTimeMs,
      needsReview: state.results.needsReview,
      reviewReasons: state.results.reviewReasons,
      pipelineVersion: state.metadata.pipelineVersion,
      classification: {
        category: state.classification.category,
        confidence: state.classification.confidence,
      },
    };
  }
}

// Export singleton instance for convenience
export const multiAgentService = new MultiAgentService();

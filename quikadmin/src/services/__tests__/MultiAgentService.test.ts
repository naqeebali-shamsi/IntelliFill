/**
 * MultiAgentService Unit Tests
 *
 * Tests input sanitization, delegation to multiagent pipeline,
 * and result transformation.
 */

import { MultiAgentService, MultiAgentProcessInput } from '../MultiAgentService';
import * as multiagent from '../../multiagent';
import * as sanitizer from '../../utils/sanitizeLLMInput';

// Mock the multiagent module
jest.mock('../../multiagent', () => ({
  createInitialState: jest.fn(),
  updateState: jest.fn(),
  createDocumentProcessingGraph: jest.fn(),
}));

// Mock the sanitizer
jest.mock('../../utils/sanitizeLLMInput', () => ({
  sanitizeLLMInput: jest.fn(),
}));

describe('MultiAgentService', () => {
  let service: MultiAgentService;
  let mockGraph: { invoke: jest.Mock };
  let mockInitialState: multiagent.DocumentState;
  let mockFinalState: multiagent.DocumentState;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MultiAgentService();

    // Setup mock initial state
    mockInitialState = {
      documentId: 'doc-123',
      userId: 'user-456',
      jobId: 'job-789',
      filePath: '',
      fileName: 'document',
      fileType: 'application/octet-stream',
      fileSize: 0,
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
        pendingNodes: [],
        completedNodes: [],
        retryCount: 0,
        maxRetries: 3,
        timeoutMs: 300000,
        startedAt: new Date(),
        lastUpdatedAt: new Date(),
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as multiagent.DocumentState;

    // Setup mock final state (successful processing)
    mockFinalState = {
      ...mockInitialState,
      classification: {
        category: 'PASSPORT',
        confidence: 95,
        alternativeCategories: [],
      },
      results: {
        success: true,
        finalData: { firstName: 'John', lastName: 'Doe' },
        confidence: { overall: 92, byField: { firstName: 95, lastName: 90 } },
        processingTimeMs: 1500,
        needsReview: false,
        reviewReasons: [],
      },
    } as multiagent.DocumentState;

    // Setup mock graph
    mockGraph = { invoke: jest.fn().mockResolvedValue(mockFinalState) };

    // Configure mocks
    (multiagent.createInitialState as jest.Mock).mockReturnValue(mockInitialState);
    (multiagent.updateState as jest.Mock).mockImplementation((state, updates) => ({
      ...state,
      ...updates,
    }));
    (multiagent.createDocumentProcessingGraph as jest.Mock).mockReturnValue(mockGraph);
    (sanitizer.sanitizeLLMInput as jest.Mock).mockImplementation((text) => text);
  });

  describe('process', () => {
    it('should sanitize input text before processing', async () => {
      const input: MultiAgentProcessInput = {
        documentId: 'doc-123',
        userId: 'user-456',
        rawText: 'Test document {{injection}} content',
      };

      (sanitizer.sanitizeLLMInput as jest.Mock).mockReturnValue('Test document content');

      await service.process(input);

      expect(sanitizer.sanitizeLLMInput).toHaveBeenCalledWith('Test document {{injection}} content');
    });

    it('should create initial state with correct parameters', async () => {
      const input: MultiAgentProcessInput = {
        documentId: 'doc-123',
        userId: 'user-456',
        rawText: 'Test content',
        jobId: 'custom-job',
        fileName: 'passport.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      await service.process(input);

      expect(multiagent.createInitialState).toHaveBeenCalledWith(
        'doc-123',
        'user-456',
        'custom-job',
        '',
        'passport.pdf',
        'application/pdf',
        1024
      );
    });

    it('should use default values for optional parameters', async () => {
      const input: MultiAgentProcessInput = {
        documentId: 'doc-123',
        userId: 'user-456',
        rawText: 'Test content',
      };

      await service.process(input);

      expect(multiagent.createInitialState).toHaveBeenCalledWith(
        'doc-123',
        'user-456',
        expect.stringMatching(/^job-\d+$/), // Auto-generated job ID
        '',
        'document',
        'application/octet-stream',
        0
      );
    });

    it('should update state with sanitized rawText', async () => {
      const input: MultiAgentProcessInput = {
        documentId: 'doc-123',
        userId: 'user-456',
        rawText: 'Sanitized text',
      };

      (sanitizer.sanitizeLLMInput as jest.Mock).mockReturnValue('Sanitized text');

      await service.process(input);

      expect(multiagent.updateState).toHaveBeenCalledWith(
        mockInitialState,
        expect.objectContaining({
          ocrData: expect.objectContaining({
            rawText: 'Sanitized text',
            textByPage: { 1: 'Sanitized text' },
          }),
        })
      );
    });

    it('should invoke the graph with updated state', async () => {
      const input: MultiAgentProcessInput = {
        documentId: 'doc-123',
        userId: 'user-456',
        rawText: 'Test content',
      };

      await service.process(input);

      expect(multiagent.createDocumentProcessingGraph).toHaveBeenCalled();
      expect(mockGraph.invoke).toHaveBeenCalled();
    });

    it('should return the final state from the graph', async () => {
      const input: MultiAgentProcessInput = {
        documentId: 'doc-123',
        userId: 'user-456',
        rawText: 'Test content',
      };

      const result = await service.process(input);

      expect(result).toEqual(mockFinalState);
    });

    it('should propagate errors from the graph', async () => {
      const input: MultiAgentProcessInput = {
        documentId: 'doc-123',
        userId: 'user-456',
        rawText: 'Test content',
      };

      const error = new Error('Pipeline failed');
      mockGraph.invoke.mockRejectedValue(error);

      await expect(service.process(input)).rejects.toThrow('Pipeline failed');
    });
  });

  describe('processAndGetResult', () => {
    it('should return simplified result structure', async () => {
      const input: MultiAgentProcessInput = {
        documentId: 'doc-123',
        userId: 'user-456',
        rawText: 'Test content',
      };

      const result = await service.processAndGetResult(input);

      expect(result).toEqual({
        success: true,
        finalData: { firstName: 'John', lastName: 'Doe' },
        confidence: { overall: 92, byField: { firstName: 95, lastName: 90 } },
        processingTimeMs: 1500,
        needsReview: false,
        reviewReasons: [],
        pipelineVersion: '1.0.0',
        classification: {
          category: 'PASSPORT',
          confidence: 95,
        },
      });
    });

    it('should include classification data', async () => {
      const input: MultiAgentProcessInput = {
        documentId: 'doc-123',
        userId: 'user-456',
        rawText: 'Test content',
      };

      const result = await service.processAndGetResult(input);

      expect(result.classification).toEqual({
        category: 'PASSPORT',
        confidence: 95,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty rawText', async () => {
      const input: MultiAgentProcessInput = {
        documentId: 'doc-123',
        userId: 'user-456',
        rawText: '',
      };

      (sanitizer.sanitizeLLMInput as jest.Mock).mockReturnValue('');

      await service.process(input);

      expect(sanitizer.sanitizeLLMInput).toHaveBeenCalledWith('');
      expect(multiagent.updateState).toHaveBeenCalledWith(
        mockInitialState,
        expect.objectContaining({
          ocrData: expect.objectContaining({
            rawText: '',
          }),
        })
      );
    });

    it('should handle very long text (sanitization enforces max length)', async () => {
      const longText = 'x'.repeat(60000);
      const truncatedText = 'x'.repeat(50000);

      const input: MultiAgentProcessInput = {
        documentId: 'doc-123',
        userId: 'user-456',
        rawText: longText,
      };

      (sanitizer.sanitizeLLMInput as jest.Mock).mockReturnValue(truncatedText);

      await service.process(input);

      expect(sanitizer.sanitizeLLMInput).toHaveBeenCalledWith(longText);
    });
  });
});

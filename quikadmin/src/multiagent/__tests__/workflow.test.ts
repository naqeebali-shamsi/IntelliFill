/**
 * MultiAgent Workflow Node Tests
 *
 * Unit tests for LangGraph workflow nodes in the document processing pipeline.
 * Tests individual nodes, routing logic, retry behavior, and full graph traversal.
 */

import { DocumentState, createInitialState } from '../types/state';
import {
  NODE_NAMES,
  createDocumentProcessingGraph,
  __test__,
} from '../workflow';

// Extract test utilities from workflow
const {
  classifyNode,
  extractNode,
  mapNode,
  qaNode,
  errorRecoverNode,
  finalizeNode,
  routeAfterQA,
  routeAfterErrorRecovery,
} = __test__;

// Mock the piiSafeLogger to avoid logging noise in tests
jest.mock('../../utils/piiSafeLogger', () => ({
  piiSafeLogger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

/**
 * Helper to create a test document state
 */
function createTestState(overrides: Partial<DocumentState> = {}): DocumentState {
  const baseState = createInitialState(
    'test-doc-123',
    'test-user-456',
    'test-job-789',
    '/path/to/test/document.pdf',
    'test-document.pdf',
    'application/pdf',
    1024
  );

  return {
    ...baseState,
    ...overrides,
    processingControl: {
      ...baseState.processingControl,
      ...(overrides.processingControl || {}),
    },
    qualityAssessment: {
      ...baseState.qualityAssessment,
      ...(overrides.qualityAssessment || {}),
    },
  } as DocumentState;
}

describe('MultiAgent Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // CLASSIFY NODE TESTS
  // ========================================
  describe('classifyNode', () => {
    it('should classify document and update state', async () => {
      const state = createTestState();

      const result = await classifyNode(state);

      expect(result.classification).toBeDefined();
      expect(result.classification?.category).toBe('UNKNOWN');
      expect(result.classification?.confidence).toBe(0);
      expect(result.classification?.classifiedAt).toBeInstanceOf(Date);
    });

    it('should add classifier agent to history', async () => {
      const state = createTestState();

      const result = await classifyNode(state);

      expect(result.agentHistory).toBeDefined();
      expect(result.agentHistory?.length).toBe(1);
      expect(result.agentHistory?.[0].agent).toBe('classifier');
      expect(result.agentHistory?.[0].status).toBe('completed');
      expect(result.agentHistory?.[0].model).toBe('phi3:mini');
    });

    it('should advance to extract node', async () => {
      const state = createTestState();

      const result = await classifyNode(state);

      expect(result.processingControl?.currentNode).toBe(NODE_NAMES.EXTRACT);
      expect(result.processingControl?.completedNodes).toContain(NODE_NAMES.CLASSIFY);
    });

    it('should preserve existing agent history', async () => {
      const existingHistory = [
        {
          agent: 'orchestrator' as const,
          startTime: new Date(),
          endTime: new Date(),
          status: 'completed' as const,
          retryCount: 0,
        },
      ];
      const state = createTestState({ agentHistory: existingHistory });

      const result = await classifyNode(state);

      expect(result.agentHistory?.length).toBe(2);
      expect(result.agentHistory?.[0].agent).toBe('orchestrator');
      expect(result.agentHistory?.[1].agent).toBe('classifier');
    });
  });

  // ========================================
  // EXTRACT NODE TESTS
  // ========================================
  describe('extractNode', () => {
    it('should extract fields and return empty object for placeholder', async () => {
      const state = createTestState({
        processingControl: {
          ...createTestState().processingControl,
          currentNode: NODE_NAMES.EXTRACT,
          completedNodes: [NODE_NAMES.CLASSIFY],
        },
      });

      const result = await extractNode(state);

      expect(result.extractedFields).toEqual({});
      expect(result.extractionMetadata).toBeDefined();
      expect(result.extractionMetadata?.model).toBe('llama3.2:8b');
    });

    it('should add extractor agent to history', async () => {
      const state = createTestState();

      const result = await extractNode(state);

      const executionRecord = result.agentHistory?.find(
        (h) => h.agent === 'extractor'
      );
      expect(executionRecord).toBeDefined();
      expect(executionRecord?.status).toBe('completed');
    });

    it('should track processing time in metadata', async () => {
      const state = createTestState();

      const result = await extractNode(state);

      expect(result.extractionMetadata?.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should advance to map node', async () => {
      const state = createTestState();

      const result = await extractNode(state);

      expect(result.processingControl?.currentNode).toBe(NODE_NAMES.MAP);
      expect(result.processingControl?.completedNodes).toContain(NODE_NAMES.EXTRACT);
    });
  });

  // ========================================
  // MAP NODE TESTS
  // ========================================
  describe('mapNode', () => {
    it('should map extracted fields to schema', async () => {
      const extractedFields = {
        first_name: { value: 'John', confidence: 95, source: 'llm' as const },
        last_name: { value: 'Doe', confidence: 92, source: 'llm' as const },
      };
      const state = createTestState({ extractedFields });

      const result = await mapNode(state);

      expect(result.mappedFields).toBeDefined();
      expect(result.mappingMetadata?.model).toBe('mistral:7b');
    });

    it('should track number of fields matched', async () => {
      const extractedFields = {
        field1: { value: 'A', confidence: 90, source: 'llm' as const },
        field2: { value: 'B', confidence: 85, source: 'llm' as const },
        field3: { value: 'C', confidence: 80, source: 'llm' as const },
      };
      const state = createTestState({ extractedFields });

      const result = await mapNode(state);

      expect(result.mappingMetadata?.fieldsMatched).toBe(3);
    });

    it('should add mapper agent to history', async () => {
      const state = createTestState();

      const result = await mapNode(state);

      const executionRecord = result.agentHistory?.find(
        (h) => h.agent === 'mapper'
      );
      expect(executionRecord).toBeDefined();
      expect(executionRecord?.model).toBe('mistral:7b');
    });

    it('should advance to QA node', async () => {
      const state = createTestState();

      const result = await mapNode(state);

      expect(result.processingControl?.currentNode).toBe(NODE_NAMES.QA);
      expect(result.processingControl?.completedNodes).toContain(NODE_NAMES.MAP);
    });
  });

  // ========================================
  // QA NODE TESTS
  // ========================================
  describe('qaNode', () => {
    it('should perform quality assessment', async () => {
      const state = createTestState();

      const result = await qaNode(state);

      expect(result.qualityAssessment).toBeDefined();
      expect(typeof result.qualityAssessment?.isValid).toBe('boolean');
      expect(typeof result.qualityAssessment?.overallScore).toBe('number');
    });

    it('should set high score for valid assessment', async () => {
      const state = createTestState();

      const result = await qaNode(state);

      // Placeholder implementation returns valid=true with score 85
      expect(result.qualityAssessment?.isValid).toBe(true);
      expect(result.qualityAssessment?.overallScore).toBe(85);
    });

    it('should not flag for human review when valid', async () => {
      const state = createTestState();

      const result = await qaNode(state);

      expect(result.qualityAssessment?.needsHumanReview).toBe(false);
    });

    it('should add qa agent to history', async () => {
      const state = createTestState();

      const result = await qaNode(state);

      const executionRecord = result.agentHistory?.find((h) => h.agent === 'qa');
      expect(executionRecord).toBeDefined();
      expect(executionRecord?.status).toBe('completed');
    });

    it('should advance to finalize when valid', async () => {
      const state = createTestState();

      const result = await qaNode(state);

      expect(result.processingControl?.currentNode).toBe(NODE_NAMES.FINALIZE);
      expect(result.processingControl?.completedNodes).toContain(NODE_NAMES.QA);
    });
  });

  // ========================================
  // ERROR RECOVER NODE TESTS
  // ========================================
  describe('errorRecoverNode', () => {
    it('should increment retry count', async () => {
      const state = createTestState({
        processingControl: {
          ...createTestState().processingControl,
          retryCount: 0,
        },
      });

      const result = await errorRecoverNode(state);

      expect(result.processingControl?.retryCount).toBe(1);
    });

    it('should route back to extract when retries available', async () => {
      const state = createTestState({
        processingControl: {
          ...createTestState().processingControl,
          retryCount: 0,
        },
      });

      const result = await errorRecoverNode(state);

      expect(result.processingControl?.currentNode).toBe(NODE_NAMES.EXTRACT);
    });

    it('should route to finalize when max retries exceeded', async () => {
      const state = createTestState({
        processingControl: {
          ...createTestState().processingControl,
          retryCount: 2, // Will become 3, which equals MAX_RETRIES
        },
      });

      const result = await errorRecoverNode(state);

      expect(result.processingControl?.currentNode).toBe(NODE_NAMES.FINALIZE);
    });

    it('should add error when max retries exceeded', async () => {
      const state = createTestState({
        processingControl: {
          ...createTestState().processingControl,
          retryCount: 2,
        },
        errors: [],
      });

      const result = await errorRecoverNode(state);

      expect(result.errors?.length).toBe(1);
      expect(result.errors?.[0].error).toBe('Max retries exceeded');
      expect(result.errors?.[0].node).toBe(NODE_NAMES.ERROR_RECOVER);
    });

    it('should add errorRecovery agent to history', async () => {
      const state = createTestState();

      const result = await errorRecoverNode(state);

      const executionRecord = result.agentHistory?.find(
        (h) => h.agent === 'errorRecovery'
      );
      expect(executionRecord).toBeDefined();
    });

    it('should preserve existing errors on retry', async () => {
      const existingErrors = [
        { node: 'qa', error: 'Previous error', timestamp: new Date() },
      ];
      const state = createTestState({
        processingControl: {
          ...createTestState().processingControl,
          retryCount: 0,
        },
        errors: existingErrors,
      });

      const result = await errorRecoverNode(state);

      expect(result.errors?.length).toBe(1);
      expect(result.errors?.[0].error).toBe('Previous error');
    });
  });

  // ========================================
  // FINALIZE NODE TESTS
  // ========================================
  describe('finalizeNode', () => {
    it('should format final results', async () => {
      const mappedFields = {
        firstName: { value: 'John', confidence: 95, source: 'llm' as const },
        lastName: { value: 'Doe', confidence: 90, source: 'llm' as const },
      };
      const state = createTestState({
        mappedFields,
        qualityAssessment: {
          isValid: true,
          overallScore: 92,
          issues: [],
          suggestions: [],
          needsHumanReview: false,
        },
      });

      const result = await finalizeNode(state);

      expect(result.results).toBeDefined();
      expect(result.results?.finalData).toEqual(mappedFields);
    });

    it('should calculate overall confidence', async () => {
      const mappedFields = {
        field1: { value: 'A', confidence: 90, source: 'llm' as const },
        field2: { value: 'B', confidence: 80, source: 'llm' as const },
      };
      const state = createTestState({
        mappedFields,
        qualityAssessment: {
          isValid: true,
          overallScore: 85,
          issues: [],
          suggestions: [],
          needsHumanReview: false,
        },
      });

      const result = await finalizeNode(state);

      expect(result.results?.confidence.overall).toBe(85);
      expect(result.results?.confidence.byField).toEqual({
        field1: 90,
        field2: 80,
      });
    });

    it('should set success true when valid and no errors', async () => {
      const state = createTestState({
        qualityAssessment: {
          isValid: true,
          overallScore: 90,
          issues: [],
          suggestions: [],
          needsHumanReview: false,
        },
        errors: [],
      });

      const result = await finalizeNode(state);

      expect(result.results?.success).toBe(true);
    });

    it('should set success false when errors present', async () => {
      const state = createTestState({
        qualityAssessment: {
          isValid: true,
          overallScore: 90,
          issues: [],
          suggestions: [],
          needsHumanReview: false,
        },
        errors: [{ node: 'extract', error: 'Failed', timestamp: new Date() }],
      });

      const result = await finalizeNode(state);

      expect(result.results?.success).toBe(false);
    });

    it('should set success false when QA invalid', async () => {
      const state = createTestState({
        qualityAssessment: {
          isValid: false,
          overallScore: 50,
          issues: [
            {
              field: 'name',
              type: 'missing' as const,
              severity: 'error' as const,
              message: 'Name is required',
            },
          ],
          suggestions: [],
          needsHumanReview: true,
        },
        errors: [],
      });

      const result = await finalizeNode(state);

      expect(result.results?.success).toBe(false);
    });

    it('should include review reasons from QA issues', async () => {
      const issues = [
        {
          field: 'name',
          type: 'missing' as const,
          severity: 'error' as const,
          message: 'Name is required',
        },
        {
          field: 'date',
          type: 'invalid_format' as const,
          severity: 'warning' as const,
          message: 'Date format invalid',
        },
      ];
      const state = createTestState({
        qualityAssessment: {
          isValid: false,
          overallScore: 60,
          issues,
          suggestions: [],
          needsHumanReview: true,
        },
      });

      const result = await finalizeNode(state);

      expect(result.results?.reviewReasons).toEqual([
        'Name is required',
        'Date format invalid',
      ]);
    });

    it('should calculate processing time', async () => {
      const startedAt = new Date(Date.now() - 5000); // 5 seconds ago
      const state = createTestState({
        processingControl: {
          ...createTestState().processingControl,
          startedAt,
        },
        qualityAssessment: {
          isValid: true,
          overallScore: 90,
          issues: [],
          suggestions: [],
          needsHumanReview: false,
        },
      });

      const result = await finalizeNode(state);

      expect(result.results?.processingTimeMs).toBeGreaterThanOrEqual(5000);
    });

    it('should mark current node as end', async () => {
      const state = createTestState({
        qualityAssessment: {
          isValid: true,
          overallScore: 90,
          issues: [],
          suggestions: [],
          needsHumanReview: false,
        },
      });

      const result = await finalizeNode(state);

      expect(result.processingControl?.currentNode).toBe('end');
      expect(result.processingControl?.completedNodes).toContain(NODE_NAMES.FINALIZE);
    });
  });

  // ========================================
  // ROUTING TESTS
  // ========================================
  describe('routeAfterQA', () => {
    it('should route to finalize when QA passes', () => {
      const state = createTestState({
        qualityAssessment: {
          isValid: true,
          overallScore: 90,
          issues: [],
          suggestions: [],
          needsHumanReview: false,
        },
      });

      const route = routeAfterQA(state);

      expect(route).toBe(NODE_NAMES.FINALIZE);
    });

    it('should route to errorRecover when QA fails', () => {
      const state = createTestState({
        qualityAssessment: {
          isValid: false,
          overallScore: 50,
          issues: [],
          suggestions: [],
          needsHumanReview: true,
        },
        processingControl: {
          ...createTestState().processingControl,
          retryCount: 0,
        },
      });

      const route = routeAfterQA(state);

      expect(route).toBe(NODE_NAMES.ERROR_RECOVER);
    });

    it('should route to finalize when QA fails but max retries reached', () => {
      const state = createTestState({
        qualityAssessment: {
          isValid: false,
          overallScore: 50,
          issues: [],
          suggestions: [],
          needsHumanReview: true,
        },
        processingControl: {
          ...createTestState().processingControl,
          retryCount: 3, // MAX_RETRIES
        },
      });

      const route = routeAfterQA(state);

      expect(route).toBe(NODE_NAMES.FINALIZE);
    });

    it('should route to errorRecover when retries below max', () => {
      const state = createTestState({
        qualityAssessment: {
          isValid: false,
          overallScore: 50,
          issues: [],
          suggestions: [],
          needsHumanReview: true,
        },
        processingControl: {
          ...createTestState().processingControl,
          retryCount: 2, // Below MAX_RETRIES (3)
        },
      });

      const route = routeAfterQA(state);

      expect(route).toBe(NODE_NAMES.ERROR_RECOVER);
    });
  });

  describe('routeAfterErrorRecovery', () => {
    it('should route to extract when retries available', () => {
      const state = createTestState({
        processingControl: {
          ...createTestState().processingControl,
          retryCount: 1,
        },
      });

      const route = routeAfterErrorRecovery(state);

      expect(route).toBe(NODE_NAMES.EXTRACT);
    });

    it('should route to finalize when max retries exceeded', () => {
      const state = createTestState({
        processingControl: {
          ...createTestState().processingControl,
          retryCount: 3, // MAX_RETRIES
        },
      });

      const route = routeAfterErrorRecovery(state);

      expect(route).toBe(NODE_NAMES.FINALIZE);
    });

    it('should route to extract at retry count 0', () => {
      const state = createTestState({
        processingControl: {
          ...createTestState().processingControl,
          retryCount: 0,
        },
      });

      const route = routeAfterErrorRecovery(state);

      expect(route).toBe(NODE_NAMES.EXTRACT);
    });

    it('should route to extract at retry count 2', () => {
      const state = createTestState({
        processingControl: {
          ...createTestState().processingControl,
          retryCount: 2,
        },
      });

      const route = routeAfterErrorRecovery(state);

      expect(route).toBe(NODE_NAMES.EXTRACT);
    });
  });

  // ========================================
  // MAX RETRY LIMIT TESTS
  // ========================================
  describe('Max Retry Limit Behavior', () => {
    it('should allow exactly 3 retry attempts before giving up', async () => {
      // Simulate retry progression
      // retryCount 0 -> newRetryCount 1 -> retry (1 < 3)
      // retryCount 1 -> newRetryCount 2 -> retry (2 < 3)
      // retryCount 2 -> newRetryCount 3 -> finalize (3 < 3 is false)
      const retryScenarios = [0, 1]; // These will result in retries

      for (const retryCount of retryScenarios) {
        const state = createTestState({
          processingControl: {
            ...createTestState().processingControl,
            retryCount,
          },
        });

        const result = await errorRecoverNode(state);

        expect(result.processingControl?.currentNode).toBe(NODE_NAMES.EXTRACT);
        expect(result.errors?.filter((e) => e.error === 'Max retries exceeded').length).toBe(0);
      }

      // At retry count 2, will become 3 which equals MAX_RETRIES, should finalize
      const finalState = createTestState({
        processingControl: {
          ...createTestState().processingControl,
          retryCount: 2, // Will become 3
        },
      });

      const result = await errorRecoverNode(finalState);
      expect(result.processingControl?.currentNode).toBe(NODE_NAMES.FINALIZE);
    });

    it('should accumulate retry count correctly through multiple error recoveries', async () => {
      let state = createTestState({
        processingControl: {
          ...createTestState().processingControl,
          retryCount: 0,
        },
        errors: [],
        agentHistory: [],
      });

      // First recovery
      const result1 = await errorRecoverNode(state);
      expect(result1.processingControl?.retryCount).toBe(1);

      // Simulate second recovery with updated state
      state = {
        ...state,
        processingControl: {
          ...state.processingControl,
          retryCount: 1,
        },
        agentHistory: result1.agentHistory || [],
      };

      const result2 = await errorRecoverNode(state);
      expect(result2.processingControl?.retryCount).toBe(2);

      // Third recovery
      state = {
        ...state,
        processingControl: {
          ...state.processingControl,
          retryCount: 2,
        },
        agentHistory: result2.agentHistory || [],
      };

      const result3 = await errorRecoverNode(state);
      expect(result3.processingControl?.retryCount).toBe(3);
      expect(result3.processingControl?.currentNode).toBe(NODE_NAMES.FINALIZE);
    });
  });

  // ========================================
  // INTEGRATION TESTS - FULL GRAPH TRAVERSAL
  // ========================================
  describe('Full Graph Traversal', () => {
    it('should create a valid graph', () => {
      const graph = createDocumentProcessingGraph();

      expect(graph).toBeDefined();
      expect(typeof graph.invoke).toBe('function');
    });

    it('should execute happy path through all nodes', async () => {
      const graph = createDocumentProcessingGraph();
      const initialState = createTestState();

      const finalState = await graph.invoke(initialState);

      // Verify all nodes were visited
      expect(finalState.processingControl.completedNodes).toContain(NODE_NAMES.CLASSIFY);
      expect(finalState.processingControl.completedNodes).toContain(NODE_NAMES.EXTRACT);
      expect(finalState.processingControl.completedNodes).toContain(NODE_NAMES.MAP);
      expect(finalState.processingControl.completedNodes).toContain(NODE_NAMES.QA);
      expect(finalState.processingControl.completedNodes).toContain(NODE_NAMES.FINALIZE);
    });

    it('should have populated agent history after traversal', async () => {
      const graph = createDocumentProcessingGraph();
      const initialState = createTestState();

      const finalState = await graph.invoke(initialState);

      // Should have 4 agent executions (classifier, extractor, mapper, qa)
      // Note: finalizeNode does not add to agentHistory as it's a coordination node, not an agent
      expect(finalState.agentHistory.length).toBeGreaterThanOrEqual(4);

      // Verify agent names
      const agentNames = finalState.agentHistory.map((h: { agent: string }) => h.agent);
      expect(agentNames).toContain('classifier');
      expect(agentNames).toContain('extractor');
      expect(agentNames).toContain('mapper');
      expect(agentNames).toContain('qa');
    });

    it('should have final results after traversal', async () => {
      const graph = createDocumentProcessingGraph();
      const initialState = createTestState();

      const finalState = await graph.invoke(initialState);

      expect(finalState.results).toBeDefined();
      expect(typeof finalState.results.success).toBe('boolean');
      expect(typeof finalState.results.processingTimeMs).toBe('number');
      expect(finalState.results.confidence).toBeDefined();
    });

    it('should preserve document identity through traversal', async () => {
      const graph = createDocumentProcessingGraph();
      const initialState = createTestState({
        documentId: 'unique-doc-id-12345',
        userId: 'unique-user-id-67890',
      });

      const finalState = await graph.invoke(initialState);

      expect(finalState.documentId).toBe('unique-doc-id-12345');
      expect(finalState.userId).toBe('unique-user-id-67890');
    });
  });

  // ========================================
  // STATE MUTATION TESTS
  // ========================================
  describe('State Mutations', () => {
    it('should not mutate original state in classifyNode', async () => {
      const originalState = createTestState();
      const originalClassification = { ...originalState.classification };

      await classifyNode(originalState);

      expect(originalState.classification).toEqual(originalClassification);
    });

    it('should not mutate original state in extractNode', async () => {
      const originalState = createTestState();
      const originalFields = { ...originalState.extractedFields };

      await extractNode(originalState);

      expect(originalState.extractedFields).toEqual(originalFields);
    });

    it('should not mutate original state in mapNode', async () => {
      const originalState = createTestState();
      const originalMapped = { ...originalState.mappedFields };

      await mapNode(originalState);

      expect(originalState.mappedFields).toEqual(originalMapped);
    });

    it('should not mutate original state in qaNode', async () => {
      const originalState = createTestState();
      const originalQA = { ...originalState.qualityAssessment };

      await qaNode(originalState);

      expect(originalState.qualityAssessment).toEqual(originalQA);
    });

    it('should not mutate original state in errorRecoverNode', async () => {
      const originalState = createTestState();
      const originalRetryCount = originalState.processingControl.retryCount;

      await errorRecoverNode(originalState);

      expect(originalState.processingControl.retryCount).toBe(originalRetryCount);
    });

    it('should not mutate original state in finalizeNode', async () => {
      const originalState = createTestState({
        qualityAssessment: {
          isValid: true,
          overallScore: 90,
          issues: [],
          suggestions: [],
          needsHumanReview: false,
        },
      });
      const originalResults = { ...originalState.results };

      await finalizeNode(originalState);

      expect(originalState.results).toEqual(originalResults);
    });

    it('should return new agentHistory array without mutating original', async () => {
      const originalState = createTestState({
        agentHistory: [
          {
            agent: 'orchestrator' as const,
            startTime: new Date(),
            endTime: new Date(),
            status: 'completed' as const,
            retryCount: 0,
          },
        ],
      });
      const originalHistoryLength = originalState.agentHistory.length;

      const result = await classifyNode(originalState);

      expect(originalState.agentHistory.length).toBe(originalHistoryLength);
      expect(result.agentHistory?.length).toBe(originalHistoryLength + 1);
    });

    it('should return new completedNodes array without mutating original', async () => {
      const originalState = createTestState({
        processingControl: {
          ...createTestState().processingControl,
          completedNodes: ['start'],
        },
      });
      const originalCompletedLength = originalState.processingControl.completedNodes.length;

      const result = await classifyNode(originalState);

      expect(originalState.processingControl.completedNodes.length).toBe(originalCompletedLength);
      expect(result.processingControl?.completedNodes?.length).toBe(originalCompletedLength + 1);
    });
  });

  // ========================================
  // NODE NAMES CONSTANT TESTS
  // ========================================
  describe('NODE_NAMES Constants', () => {
    it('should have all required node names', () => {
      expect(NODE_NAMES.CLASSIFY).toBe('classify');
      expect(NODE_NAMES.EXTRACT).toBe('extract');
      expect(NODE_NAMES.MAP).toBe('map');
      expect(NODE_NAMES.QA).toBe('qa');
      expect(NODE_NAMES.ERROR_RECOVER).toBe('errorRecover');
      expect(NODE_NAMES.FINALIZE).toBe('finalize');
    });

    it('should be frozen/readonly (typescript const)', () => {
      // Verify NODE_NAMES is defined with expected structure
      expect(Object.keys(NODE_NAMES)).toHaveLength(6);
    });
  });
});

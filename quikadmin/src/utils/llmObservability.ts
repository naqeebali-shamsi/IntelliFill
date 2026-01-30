/**
 * LLM Observability - Phase 3.1
 *
 * Langfuse integration for LLM call tracing and monitoring.
 * Provides complete visibility into extraction pipeline performance.
 *
 * Features:
 * - Full trace capture (input/output/tokens/cost)
 * - Error tracking with context
 * - Performance metrics
 * - Prompt versioning support
 *
 * @module utils/llmObservability
 */

import { piiSafeLogger as logger } from './piiSafeLogger';
import { FEATURE_FLAGS, LANGFUSE_CONFIG } from '../config/featureFlags';
import { LLMProvider } from '../multiagent/llmClient';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Trace metadata for LLM calls
 */
export interface TraceMetadata {
  /** Unique trace ID */
  traceId?: string;
  /** User ID for attribution */
  userId?: string;
  /** Session ID for grouping */
  sessionId?: string;
  /** Document ID being processed */
  documentId?: string;
  /** Document category */
  documentCategory?: string;
  /** Custom tags */
  tags?: string[];
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Span data for individual operations
 */
export interface SpanData {
  /** Operation name */
  name: string;
  /** Input data (prompt, etc.) */
  input?: unknown;
  /** Output data (response) */
  output?: unknown;
  /** Model used */
  model?: string;
  /** Provider used */
  provider?: LLMProvider;
  /** Token usage */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  /** Cost in USD */
  cost?: number;
  /** Processing time in ms */
  durationMs?: number;
  /** Error if any */
  error?: Error | string;
  /** Level (DEBUG, INFO, WARNING, ERROR) */
  level?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Generation tracking data
 */
export interface GenerationData extends SpanData {
  /** Prompt template name/version */
  promptName?: string;
  /** Prompt template version */
  promptVersion?: string;
  /** Completion message */
  completionStartTime?: Date;
}

// ============================================================================
// Langfuse Client (Lazy Loaded)
// ============================================================================

let langfuseInstance: any = null;
let langfuseInitialized = false;
let langfuseInitError: Error | null = null;

/**
 * Initialize Langfuse client (lazy initialization)
 */
async function initLangfuse(): Promise<any> {
  if (!FEATURE_FLAGS.LANGFUSE) {
    return null;
  }

  if (langfuseInitialized) {
    if (langfuseInitError) throw langfuseInitError;
    return langfuseInstance;
  }

  langfuseInitialized = true;

  // Check configuration
  if (!LANGFUSE_CONFIG.PUBLIC_KEY || !LANGFUSE_CONFIG.SECRET_KEY) {
    langfuseInitError = new Error('Langfuse keys not configured');
    logger.warn('Langfuse observability disabled: missing API keys');
    return null;
  }

  try {
    // Lazy load Langfuse SDK
    const LangfuseModule = await import('langfuse');
    const Langfuse = LangfuseModule.Langfuse || LangfuseModule.default;

    langfuseInstance = new Langfuse({
      publicKey: LANGFUSE_CONFIG.PUBLIC_KEY,
      secretKey: LANGFUSE_CONFIG.SECRET_KEY,
      baseUrl: LANGFUSE_CONFIG.HOST,
    });

    logger.info('Langfuse observability initialized');
    return langfuseInstance;
  } catch (error) {
    langfuseInitError =
      error instanceof Error ? error : new Error('Langfuse init failed');
    logger.warn('Langfuse observability disabled: SDK not available', {
      error: langfuseInitError.message,
    });
    return null;
  }
}

// ============================================================================
// Trace Management
// ============================================================================

/**
 * Active traces map
 */
const activeTraces = new Map<string, any>();

/**
 * Start a new trace for document processing
 *
 * @param name - Trace name (e.g., "document_extraction")
 * @param metadata - Trace metadata
 * @returns Trace ID for ending the trace later
 */
export async function startTrace(
  name: string,
  metadata: TraceMetadata = {}
): Promise<string> {
  const traceId = metadata.traceId || generateTraceId();

  if (!FEATURE_FLAGS.LANGFUSE) {
    logger.debug(`Trace started (Langfuse disabled): ${name}`, { traceId });
    return traceId;
  }

  try {
    const langfuse = await initLangfuse();
    if (!langfuse) {
      return traceId;
    }

    // Apply sampling
    if (Math.random() > LANGFUSE_CONFIG.SAMPLE_RATE) {
      logger.debug(`Trace sampled out: ${name}`, { traceId });
      return traceId;
    }

    const trace = langfuse.trace({
      id: traceId,
      name,
      userId: metadata.userId,
      sessionId: metadata.sessionId,
      metadata: {
        documentId: metadata.documentId,
        documentCategory: metadata.documentCategory,
        ...metadata,
      },
      tags: metadata.tags,
    });

    activeTraces.set(traceId, trace);

    logger.debug(`Langfuse trace started: ${name}`, { traceId });
    return traceId;
  } catch (error) {
    logger.warn('Failed to start Langfuse trace', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return traceId;
  }
}

/**
 * End a trace
 *
 * @param traceId - Trace ID from startTrace
 * @param output - Final output/result
 */
export async function endTrace(
  traceId: string,
  output?: unknown
): Promise<void> {
  const trace = activeTraces.get(traceId);
  if (!trace) {
    logger.debug(`Trace not found (may be sampled out): ${traceId}`);
    return;
  }

  try {
    if (output) {
      trace.update({ output });
    }
    activeTraces.delete(traceId);

    // Flush to ensure data is sent
    const langfuse = await initLangfuse();
    if (langfuse) {
      await langfuse.flush();
    }

    logger.debug(`Langfuse trace ended: ${traceId}`);
  } catch (error) {
    logger.warn('Failed to end Langfuse trace', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

// ============================================================================
// Span Management
// ============================================================================

/**
 * Create a span within a trace
 *
 * @param traceId - Parent trace ID
 * @param data - Span data
 * @returns Span ID
 */
export async function createSpan(
  traceId: string,
  data: SpanData
): Promise<string> {
  const spanId = generateSpanId();

  if (!FEATURE_FLAGS.LANGFUSE) {
    logger.debug(`Span created (Langfuse disabled): ${data.name}`, { spanId });
    return spanId;
  }

  const trace = activeTraces.get(traceId);
  if (!trace) {
    return spanId;
  }

  try {
    const span = trace.span({
      name: data.name,
      input: data.input,
      output: data.output,
      metadata: {
        model: data.model,
        provider: data.provider,
        durationMs: data.durationMs,
        ...data.metadata,
      },
      level: data.level,
    });

    if (data.error) {
      span.update({
        level: 'ERROR',
        statusMessage: data.error instanceof Error ? data.error.message : data.error,
      });
    }

    span.end();
    return spanId;
  } catch (error) {
    logger.warn('Failed to create Langfuse span', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return spanId;
  }
}

/**
 * Record an LLM generation
 *
 * @param traceId - Parent trace ID
 * @param data - Generation data
 * @returns Generation ID
 */
export async function recordGeneration(
  traceId: string,
  data: GenerationData
): Promise<string> {
  const generationId = generateSpanId();

  if (!FEATURE_FLAGS.LANGFUSE) {
    logger.debug(`Generation recorded (Langfuse disabled): ${data.name}`, {
      generationId,
      model: data.model,
      tokens: data.usage?.totalTokens,
    });
    return generationId;
  }

  const trace = activeTraces.get(traceId);
  if (!trace) {
    return generationId;
  }

  try {
    const generation = trace.generation({
      name: data.name,
      model: data.model,
      input: data.input,
      output: data.output,
      usage: data.usage
        ? {
            input: data.usage.inputTokens,
            output: data.usage.outputTokens,
            total: data.usage.totalTokens,
          }
        : undefined,
      metadata: {
        provider: data.provider,
        cost: data.cost,
        durationMs: data.durationMs,
        promptName: data.promptName,
        promptVersion: data.promptVersion,
        ...data.metadata,
      },
      level: data.error ? 'ERROR' : data.level || 'INFO',
      statusMessage: data.error
        ? data.error instanceof Error
          ? data.error.message
          : data.error
        : undefined,
    });

    generation.end();
    return generationId;
  } catch (error) {
    logger.warn('Failed to record Langfuse generation', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return generationId;
  }
}

// ============================================================================
// Traced LLM Call Wrapper
// ============================================================================

/**
 * Wrap an LLM call with Langfuse tracing
 *
 * @param name - Operation name
 * @param fn - Async function to execute
 * @param metadata - Additional metadata
 * @returns Function result
 *
 * @example
 * ```typescript
 * const result = await tracedLLMCall(
 *   'extract_passport',
 *   async () => {
 *     return await geminiModel.generateContent(prompt);
 *   },
 *   { documentId: 'doc-123', documentCategory: 'PASSPORT' }
 * );
 * ```
 */
export async function tracedLLMCall<T>(
  name: string,
  fn: () => Promise<T>,
  metadata: TraceMetadata & {
    model?: string;
    provider?: LLMProvider;
    promptName?: string;
    promptVersion?: string;
    input?: unknown;
  } = {}
): Promise<T> {
  const startTime = Date.now();
  const traceId = await startTrace(name, metadata);

  try {
    const result = await fn();

    // Record the generation
    await recordGeneration(traceId, {
      name,
      model: metadata.model,
      provider: metadata.provider,
      input: metadata.input,
      output: result,
      durationMs: Date.now() - startTime,
      promptName: metadata.promptName,
      promptVersion: metadata.promptVersion,
      metadata,
    });

    await endTrace(traceId, result);
    return result;
  } catch (error) {
    // Record error
    await recordGeneration(traceId, {
      name,
      model: metadata.model,
      provider: metadata.provider,
      input: metadata.input,
      error: error instanceof Error ? error : String(error),
      durationMs: Date.now() - startTime,
      level: 'ERROR',
      metadata,
    });

    await endTrace(traceId);
    throw error;
  }
}

/**
 * Create a traced extraction pipeline
 *
 * @param documentId - Document being processed
 * @param category - Document category
 * @param userId - User ID
 * @returns Trace context for pipeline operations
 */
export async function createExtractionTrace(
  documentId: string,
  category: string,
  userId?: string
): Promise<{
  traceId: string;
  recordStep: (name: string, data: Partial<SpanData>) => Promise<string>;
  recordLLMCall: (data: GenerationData) => Promise<string>;
  end: (output?: unknown) => Promise<void>;
}> {
  const traceId = await startTrace('document_extraction', {
    documentId,
    documentCategory: category,
    userId,
    tags: ['extraction', category.toLowerCase()],
  });

  return {
    traceId,
    recordStep: (name: string, data: Partial<SpanData>) =>
      createSpan(traceId, { name, ...data }),
    recordLLMCall: (data: GenerationData) => recordGeneration(traceId, data),
    end: (output?: unknown) => endTrace(traceId, output),
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique trace ID
 */
function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique span ID
 */
function generateSpanId(): string {
  return `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Flush all pending Langfuse data
 * Call this before process exit
 */
export async function flushLangfuse(): Promise<void> {
  if (!FEATURE_FLAGS.LANGFUSE) return;

  try {
    const langfuse = await initLangfuse();
    if (langfuse) {
      await langfuse.flush();
      logger.debug('Langfuse data flushed');
    }
  } catch (error) {
    logger.warn('Failed to flush Langfuse data', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Shutdown Langfuse client
 * Call this on application shutdown
 */
export async function shutdownLangfuse(): Promise<void> {
  if (!FEATURE_FLAGS.LANGFUSE) return;

  try {
    const langfuse = await initLangfuse();
    if (langfuse) {
      await langfuse.shutdown();
      langfuseInstance = null;
      langfuseInitialized = false;
      logger.info('Langfuse client shutdown');
    }
  } catch (error) {
    logger.warn('Failed to shutdown Langfuse client', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

// ============================================================================
// Metrics Aggregation
// ============================================================================

/**
 * Local metrics storage (for when Langfuse is disabled)
 */
interface LocalMetrics {
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  totalDurationMs: number;
  errorCount: number;
  byProvider: Record<
    LLMProvider,
    {
      calls: number;
      tokens: number;
      cost: number;
      errors: number;
    }
  >;
  byModel: Record<
    string,
    {
      calls: number;
      tokens: number;
      cost: number;
    }
  >;
}

const localMetrics: LocalMetrics = {
  totalCalls: 0,
  totalTokens: 0,
  totalCost: 0,
  totalDurationMs: 0,
  errorCount: 0,
  byProvider: {
    gemini: { calls: 0, tokens: 0, cost: 0, errors: 0 },
    claude: { calls: 0, tokens: 0, cost: 0, errors: 0 },
    openai: { calls: 0, tokens: 0, cost: 0, errors: 0 },
  },
  byModel: {},
};

/**
 * Record local metrics (always runs, even if Langfuse is disabled)
 */
export function recordLocalMetrics(data: {
  provider: LLMProvider;
  model: string;
  tokens: number;
  cost: number;
  durationMs: number;
  error?: boolean;
}): void {
  localMetrics.totalCalls++;
  localMetrics.totalTokens += data.tokens;
  localMetrics.totalCost += data.cost;
  localMetrics.totalDurationMs += data.durationMs;

  if (data.error) {
    localMetrics.errorCount++;
    localMetrics.byProvider[data.provider].errors++;
  }

  localMetrics.byProvider[data.provider].calls++;
  localMetrics.byProvider[data.provider].tokens += data.tokens;
  localMetrics.byProvider[data.provider].cost += data.cost;

  if (!localMetrics.byModel[data.model]) {
    localMetrics.byModel[data.model] = { calls: 0, tokens: 0, cost: 0 };
  }
  localMetrics.byModel[data.model].calls++;
  localMetrics.byModel[data.model].tokens += data.tokens;
  localMetrics.byModel[data.model].cost += data.cost;
}

/**
 * Get aggregated local metrics
 */
export function getLocalMetrics(): LocalMetrics {
  return { ...localMetrics };
}

/**
 * Reset local metrics
 */
export function resetLocalMetrics(): void {
  localMetrics.totalCalls = 0;
  localMetrics.totalTokens = 0;
  localMetrics.totalCost = 0;
  localMetrics.totalDurationMs = 0;
  localMetrics.errorCount = 0;
  for (const provider of Object.keys(localMetrics.byProvider) as LLMProvider[]) {
    localMetrics.byProvider[provider] = { calls: 0, tokens: 0, cost: 0, errors: 0 };
  }
  localMetrics.byModel = {};
}

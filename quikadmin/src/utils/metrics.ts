import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { Request, Response } from 'express';

// Create a Registry
export const register = new Registry();

// Add default metrics
collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const processingJobsTotal = new Counter({
  name: 'processing_jobs_total',
  help: 'Total number of processing jobs',
  labelNames: ['type', 'status'],
  registers: [register],
});

export const processingDuration = new Histogram({
  name: 'processing_duration_seconds',
  help: 'Duration of document processing in seconds',
  labelNames: ['type'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [register],
});

export const queueSize = new Gauge({
  name: 'queue_size',
  help: 'Current size of processing queue',
  labelNames: ['queue_name', 'status'],
  registers: [register],
});

export const fieldMappingAccuracy = new Gauge({
  name: 'field_mapping_accuracy',
  help: 'Current field mapping accuracy percentage',
  registers: [register],
});

export const ocrProcessingTime = new Histogram({
  name: 'ocr_processing_time_seconds',
  help: 'Time taken for OCR processing',
  buckets: [1, 2, 5, 10, 20, 30, 60],
  registers: [register],
});

export const mlModelAccuracy = new Gauge({
  name: 'ml_model_accuracy',
  help: 'Current ML model accuracy',
  labelNames: ['model_name'],
  registers: [register],
});

export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

export const databaseConnectionPool = new Gauge({
  name: 'database_connection_pool_size',
  help: 'Database connection pool statistics',
  labelNames: ['status'],
  registers: [register],
});

export const redisOperations = new Counter({
  name: 'redis_operations_total',
  help: 'Total Redis operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

// ============================================================================
// LLM Metrics - Phase 3.3
// ============================================================================

/**
 * Total LLM API calls by provider and model
 */
export const llmCallsTotal = new Counter({
  name: 'llm_calls_total',
  help: 'Total number of LLM API calls',
  labelNames: ['provider', 'model', 'status', 'operation'],
  registers: [register],
});

/**
 * Total tokens used by provider and model
 */
export const llmTokensUsed = new Counter({
  name: 'llm_tokens_total',
  help: 'Total tokens used in LLM calls',
  labelNames: ['provider', 'model', 'type'],
  registers: [register],
});

/**
 * LLM cost in USD (micro-dollars for precision)
 */
export const llmCostMicroDollars = new Counter({
  name: 'llm_cost_microdollars_total',
  help: 'Total LLM cost in micro-dollars (divide by 1000000 for USD)',
  labelNames: ['provider', 'model'],
  registers: [register],
});

/**
 * LLM API latency histogram
 */
export const llmLatency = new Histogram({
  name: 'llm_latency_seconds',
  help: 'LLM API call latency in seconds',
  labelNames: ['provider', 'model', 'operation'],
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
  registers: [register],
});

/**
 * Extraction cache hits/misses
 */
export const extractionCacheHits = new Counter({
  name: 'extraction_cache_hits_total',
  help: 'Total extraction cache hits',
  labelNames: ['category'],
  registers: [register],
});

export const extractionCacheMisses = new Counter({
  name: 'extraction_cache_misses_total',
  help: 'Total extraction cache misses',
  labelNames: ['category'],
  registers: [register],
});

/**
 * Extraction accuracy gauge (per category)
 */
export const extractionAccuracy = new Gauge({
  name: 'extraction_accuracy_percent',
  help: 'Extraction accuracy percentage by category',
  labelNames: ['category'],
  registers: [register],
});

/**
 * Extraction confidence histogram
 */
export const extractionConfidence = new Histogram({
  name: 'extraction_confidence',
  help: 'Distribution of extraction confidence scores',
  labelNames: ['category', 'field_type'],
  buckets: [50, 60, 70, 80, 85, 90, 95, 100],
  registers: [register],
});

/**
 * Self-correction improvements
 */
export const selfCorrectionImprovements = new Counter({
  name: 'self_correction_improvements_total',
  help: 'Total fields improved by self-correction',
  labelNames: ['category'],
  registers: [register],
});

/**
 * VLM vs Tesseract usage
 */
export const ocrEngineUsage = new Counter({
  name: 'ocr_engine_usage_total',
  help: 'OCR engine usage by type',
  labelNames: ['engine', 'complexity'],
  registers: [register],
});

/**
 * Circuit breaker state
 */
export const circuitBreakerState = new Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open)',
  labelNames: ['provider'],
  registers: [register],
});

/**
 * Provider fallback counter
 */
export const providerFallbacks = new Counter({
  name: 'provider_fallbacks_total',
  help: 'Number of times fallback provider was used',
  labelNames: ['from_provider', 'to_provider', 'reason'],
  registers: [register],
});

// Middleware to track HTTP metrics
export const metricsMiddleware = (req: Request, res: Response, next: () => void) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    const method = req.method;
    const statusCode = res.statusCode.toString();

    httpRequestDuration.labels(method, route, statusCode).observe(duration);
    httpRequestTotal.labels(method, route, statusCode).inc();
  });

  next();
};

// Metrics endpoint handler
export const metricsHandler = async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error);
  }
};

// Helper functions to update metrics
export const recordProcessingJob = (type: string, status: string) => {
  processingJobsTotal.labels(type, status).inc();
};

export const recordProcessingDuration = (type: string, duration: number) => {
  processingDuration.labels(type).observe(duration);
};

export const updateQueueSize = (queueName: string, status: string, size: number) => {
  queueSize.labels(queueName, status).set(size);
};

export const updateFieldMappingAccuracy = (accuracy: number) => {
  fieldMappingAccuracy.set(accuracy);
};

export const recordOCRProcessing = (duration: number) => {
  ocrProcessingTime.observe(duration);
};

export const updateMLModelAccuracy = (modelName: string, accuracy: number) => {
  mlModelAccuracy.labels(modelName).set(accuracy);
};

export const updateActiveConnections = (count: number) => {
  activeConnections.set(count);
};

export const updateDatabasePool = (active: number, idle: number, waiting: number) => {
  databaseConnectionPool.labels('active').set(active);
  databaseConnectionPool.labels('idle').set(idle);
  databaseConnectionPool.labels('waiting').set(waiting);
};

export const recordRedisOperation = (operation: string, success: boolean) => {
  redisOperations.labels(operation, success ? 'success' : 'failure').inc();
};

// ============================================================================
// LLM Metrics Helper Functions - Phase 3.3
// ============================================================================

/**
 * Record an LLM API call
 */
export const recordLLMCall = (
  provider: string,
  model: string,
  operation: string,
  success: boolean,
  durationSeconds: number,
  inputTokens: number,
  outputTokens: number,
  costUsd: number
) => {
  // Record call
  llmCallsTotal.labels(provider, model, success ? 'success' : 'failure', operation).inc();

  // Record tokens
  llmTokensUsed.labels(provider, model, 'input').inc(inputTokens);
  llmTokensUsed.labels(provider, model, 'output').inc(outputTokens);
  llmTokensUsed.labels(provider, model, 'total').inc(inputTokens + outputTokens);

  // Record cost (convert to micro-dollars for precision)
  llmCostMicroDollars.labels(provider, model).inc(Math.round(costUsd * 1000000));

  // Record latency
  llmLatency.labels(provider, model, operation).observe(durationSeconds);
};

/**
 * Record extraction cache hit
 */
export const recordCacheHit = (category: string) => {
  extractionCacheHits.labels(category).inc();
};

/**
 * Record extraction cache miss
 */
export const recordCacheMiss = (category: string) => {
  extractionCacheMisses.labels(category).inc();
};

/**
 * Update extraction accuracy for a category
 */
export const updateExtractionAccuracy = (category: string, accuracy: number) => {
  extractionAccuracy.labels(category).set(accuracy);
};

/**
 * Record extraction confidence scores
 */
export const recordExtractionConfidence = (
  category: string,
  fieldType: string,
  confidence: number
) => {
  extractionConfidence.labels(category, fieldType).observe(confidence);
};

/**
 * Record self-correction improvement
 */
export const recordSelfCorrectionImprovement = (category: string, fieldsImproved: number) => {
  selfCorrectionImprovements.labels(category).inc(fieldsImproved);
};

/**
 * Record OCR engine usage
 */
export const recordOCREngineUsage = (
  engine: 'tesseract' | 'vlm' | 'hybrid',
  complexity: 'simple' | 'complex'
) => {
  ocrEngineUsage.labels(engine, complexity).inc();
};

/**
 * Update circuit breaker state
 */
export const updateCircuitBreakerState = (provider: string, isOpen: boolean) => {
  circuitBreakerState.labels(provider).set(isOpen ? 1 : 0);
};

/**
 * Record provider fallback
 */
export const recordProviderFallback = (
  fromProvider: string,
  toProvider: string,
  reason: string
) => {
  providerFallbacks.labels(fromProvider, toProvider, reason).inc();
};

/**
 * Get LLM metrics summary for dashboard/logging
 */
export const getLLMMetricsSummary = async (): Promise<{
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  callsByProvider: Record<string, number>;
  avgLatencyMs: number;
}> => {
  // Note: This is a simplified summary. In production, you'd query
  // the actual metric values from the registry.
  return {
    totalCalls: 0, // Would need to query llmCallsTotal
    totalTokens: 0, // Would need to query llmTokensUsed
    totalCostUsd: 0, // Would need to query llmCostMicroDollars
    callsByProvider: {},
    avgLatencyMs: 0,
  };
};

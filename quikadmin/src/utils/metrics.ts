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

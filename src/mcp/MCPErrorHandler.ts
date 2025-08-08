import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';

export enum MCPErrorType {
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TRANSFORMATION_ERROR = 'TRANSFORMATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  SERVER_ERROR = 'SERVER_ERROR',
  CLIENT_ERROR = 'CLIENT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface MCPError extends Error {
  type: MCPErrorType;
  code?: string;
  statusCode?: number;
  details?: any;
  retryable?: boolean;
  retryAfter?: number;
  timestamp: Date;
  context?: Record<string, any>;
}

export interface ErrorRecoveryStrategy {
  type: MCPErrorType;
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: MCPError, attemptNumber: number) => boolean;
  recover?: (error: MCPError) => Promise<any>;
}

export interface CircuitBreakerConfig {
  name: string;
  threshold: number;
  timeout: number;
  resetTimeout: number;
  monitoringPeriod?: number;
  halfOpenRequests?: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: Date;
  private nextAttempt?: Date;
  private halfOpenTests = 0;
  private config: CircuitBreakerConfig;
  private logger: Logger;

  constructor(config: CircuitBreakerConfig) {
    super();
    this.config = config;
    this.logger = createLogger(`CircuitBreaker:${config.name}`);
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.canAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenTests = 0;
        this.logger.info('Circuit breaker entering half-open state');
        this.emit('state:change', { state: CircuitState.HALF_OPEN });
      } else {
        const error = this.createCircuitOpenError();
        this.emit('rejected', error);
        throw error;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      this.halfOpenTests++;
      
      if (this.halfOpenTests >= (this.config.halfOpenRequests || 3)) {
        this.state = CircuitState.CLOSED;
        this.successes = 0;
        this.logger.info('Circuit breaker closed after successful tests');
        this.emit('state:change', { state: CircuitState.CLOSED });
      }
    }
    
    this.emit('success');
  }

  private onFailure(error: any): void {
    this.failures++;
    this.lastFailureTime = new Date();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = new Date(Date.now() + this.config.resetTimeout);
      this.logger.warn('Circuit breaker reopened due to failure in half-open state');
      this.emit('state:change', { state: CircuitState.OPEN });
    } else if (this.failures >= this.config.threshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = new Date(Date.now() + this.config.resetTimeout);
      this.logger.error(`Circuit breaker opened after ${this.failures} failures`);
      this.emit('state:change', { state: CircuitState.OPEN });
    }
    
    this.emit('failure', error);
  }

  private canAttemptReset(): boolean {
    return this.nextAttempt ? new Date() >= this.nextAttempt : false;
  }

  private createCircuitOpenError(): MCPError {
    const error = new Error(`Circuit breaker is open for ${this.config.name}`) as MCPError;
    error.type = MCPErrorType.CIRCUIT_BREAKER_OPEN;
    error.retryable = true;
    error.retryAfter = this.nextAttempt ? this.nextAttempt.getTime() - Date.now() : this.config.resetTimeout;
    error.timestamp = new Date();
    error.context = {
      circuitName: this.config.name,
      failures: this.failures,
      lastFailure: this.lastFailureTime,
      nextAttempt: this.nextAttempt
    };
    return error;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.halfOpenTests = 0;
    this.lastFailureTime = undefined;
    this.nextAttempt = undefined;
    this.logger.info('Circuit breaker manually reset');
    this.emit('reset');
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailure?: Date;
    nextAttempt?: Date;
  } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailureTime,
      nextAttempt: this.nextAttempt
    };
  }
}

export class MCPErrorHandler extends EventEmitter {
  private strategies: Map<MCPErrorType, ErrorRecoveryStrategy> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private errorHistory: MCPError[] = [];
  private maxHistorySize = 1000;
  private logger: Logger;

  constructor() {
    super();
    this.logger = createLogger('MCPErrorHandler');
    this.registerDefaultStrategies();
  }

  private registerDefaultStrategies(): void {
    // Connection errors - retry with exponential backoff
    this.registerStrategy({
      type: MCPErrorType.CONNECTION_ERROR,
      maxRetries: 5,
      retryDelay: 1000,
      backoffMultiplier: 2,
      shouldRetry: (error, attempt) => attempt <= 5 && error.retryable !== false
    });

    // Authentication errors - retry once after refresh
    this.registerStrategy({
      type: MCPErrorType.AUTHENTICATION_ERROR,
      maxRetries: 1,
      retryDelay: 0,
      recover: async (error) => {
        this.logger.info('Attempting to refresh authentication');
        // Implement auth refresh logic
        this.emit('auth:refresh:required', error);
      }
    });

    // Rate limit errors - respect retry-after header
    this.registerStrategy({
      type: MCPErrorType.RATE_LIMIT_ERROR,
      maxRetries: 3,
      retryDelay: 1000,
      shouldRetry: (error) => {
        if (error.retryAfter) {
          return Date.now() >= error.retryAfter;
        }
        return true;
      }
    });

    // Timeout errors - retry with increased timeout
    this.registerStrategy({
      type: MCPErrorType.TIMEOUT_ERROR,
      maxRetries: 2,
      retryDelay: 500,
      backoffMultiplier: 1.5
    });

    // Server errors - retry with backoff
    this.registerStrategy({
      type: MCPErrorType.SERVER_ERROR,
      maxRetries: 3,
      retryDelay: 2000,
      backoffMultiplier: 2,
      shouldRetry: (error) => {
        // Don't retry on 501 (Not Implemented) or 505 (HTTP Version Not Supported)
        return error.statusCode !== 501 && error.statusCode !== 505;
      }
    });

    // Client errors - no retry by default
    this.registerStrategy({
      type: MCPErrorType.CLIENT_ERROR,
      maxRetries: 0,
      retryDelay: 0,
      shouldRetry: () => false
    });
  }

  registerStrategy(strategy: ErrorRecoveryStrategy): void {
    this.strategies.set(strategy.type, strategy);
    this.logger.debug(`Registered error recovery strategy for ${strategy.type}`);
  }

  createCircuitBreaker(config: CircuitBreakerConfig): CircuitBreaker {
    const breaker = new CircuitBreaker(config);
    
    breaker.on('state:change', ({ state }) => {
      this.logger.info(`Circuit breaker ${config.name} changed state to ${state}`);
      this.emit('circuit:state:change', { name: config.name, state });
    });

    this.circuitBreakers.set(config.name, breaker);
    return breaker;
  }

  getCircuitBreaker(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  async handleError(error: any, context?: Record<string, any>): Promise<MCPError> {
    const mcpError = this.normalizeError(error, context);
    
    this.recordError(mcpError);
    this.emit('error:handled', mcpError);
    
    const strategy = this.strategies.get(mcpError.type);
    
    if (strategy?.recover) {
      try {
        await strategy.recover(mcpError);
      } catch (recoveryError) {
        this.logger.error('Error recovery failed', recoveryError);
      }
    }
    
    return mcpError;
  }

  private normalizeError(error: any, context?: Record<string, any>): MCPError {
    if (this.isMCPError(error)) {
      error.context = { ...error.context, ...context };
      return error;
    }

    const mcpError = new Error(error.message || 'Unknown error') as MCPError;
    mcpError.type = this.determineErrorType(error);
    mcpError.timestamp = new Date();
    mcpError.context = context;
    
    if (error.response) {
      mcpError.statusCode = error.response.status;
      mcpError.details = error.response.data;
      
      // Check for rate limit headers
      if (error.response.headers?.['retry-after']) {
        mcpError.retryAfter = Date.now() + (parseInt(error.response.headers['retry-after']) * 1000);
      }
    }
    
    if (error.code) {
      mcpError.code = error.code;
    }
    
    // Determine if error is retryable
    mcpError.retryable = this.isRetryable(mcpError);
    
    return mcpError;
  }

  private determineErrorType(error: any): MCPErrorType {
    // Network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ENETUNREACH') {
      return MCPErrorType.CONNECTION_ERROR;
    }
    
    // Timeout
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return MCPErrorType.TIMEOUT_ERROR;
    }
    
    // HTTP status codes
    if (error.response?.status) {
      const status = error.response.status;
      
      if (status === 401 || status === 403) {
        return MCPErrorType.AUTHENTICATION_ERROR;
      }
      
      if (status === 429) {
        return MCPErrorType.RATE_LIMIT_ERROR;
      }
      
      if (status === 404) {
        return MCPErrorType.RESOURCE_NOT_FOUND;
      }
      
      if (status >= 400 && status < 500) {
        return MCPErrorType.CLIENT_ERROR;
      }
      
      if (status >= 500) {
        return MCPErrorType.SERVER_ERROR;
      }
    }
    
    // Validation errors
    if (error.name === 'ValidationError' || error.type === 'validation') {
      return MCPErrorType.VALIDATION_ERROR;
    }
    
    return MCPErrorType.UNKNOWN_ERROR;
  }

  private isRetryable(error: MCPError): boolean {
    switch (error.type) {
      case MCPErrorType.CONNECTION_ERROR:
      case MCPErrorType.TIMEOUT_ERROR:
      case MCPErrorType.RATE_LIMIT_ERROR:
      case MCPErrorType.SERVER_ERROR:
        return true;
      
      case MCPErrorType.CLIENT_ERROR:
        // Some client errors are retryable
        return error.statusCode === 408 || // Request Timeout
               error.statusCode === 409 || // Conflict
               error.statusCode === 423;   // Locked
      
      default:
        return false;
    }
  }

  private isMCPError(error: any): error is MCPError {
    return error.type && Object.values(MCPErrorType).includes(error.type);
  }

  private recordError(error: MCPError): void {
    this.errorHistory.push(error);
    
    // Maintain history size limit
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
  }

  async executeWithRetry<T>(
    fn: () => Promise<T>,
    errorType?: MCPErrorType,
    maxRetries?: number
  ): Promise<T> {
    let lastError: any;
    const strategy = errorType ? this.strategies.get(errorType) : undefined;
    const retries = maxRetries ?? strategy?.maxRetries ?? 3;
    
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const mcpError = await this.handleError(error, { attempt });
        
        if (attempt <= retries) {
          const shouldRetry = strategy?.shouldRetry 
            ? strategy.shouldRetry(mcpError, attempt)
            : mcpError.retryable;
          
          if (!shouldRetry) {
            throw mcpError;
          }
          
          const delay = this.calculateRetryDelay(strategy, attempt);
          
          this.logger.info(`Retrying after error (attempt ${attempt}/${retries})`, {
            errorType: mcpError.type,
            delay
          });
          
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  private calculateRetryDelay(strategy?: ErrorRecoveryStrategy, attempt: number = 1): number {
    if (!strategy) return 1000;
    
    const baseDelay = strategy.retryDelay;
    const multiplier = strategy.backoffMultiplier ?? 1;
    
    return baseDelay * Math.pow(multiplier, attempt - 1);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getErrorStats(): {
    total: number;
    byType: Record<MCPErrorType, number>;
    recent: MCPError[];
  } {
    const byType: Record<MCPErrorType, number> = {} as any;
    
    for (const errorType of Object.values(MCPErrorType)) {
      byType[errorType] = 0;
    }
    
    for (const error of this.errorHistory) {
      byType[error.type]++;
    }
    
    return {
      total: this.errorHistory.length,
      byType,
      recent: this.errorHistory.slice(-10)
    };
  }

  clearHistory(): void {
    this.errorHistory = [];
    this.logger.info('Error history cleared');
  }
}
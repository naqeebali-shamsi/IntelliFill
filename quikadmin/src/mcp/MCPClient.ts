import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';

export interface MCPClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  auth?: {
    type: 'bearer' | 'basic' | 'oauth2' | 'apikey';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    apiKeyHeader?: string;
  };
  retry?: {
    maxAttempts: number;
    delay: number;
    backoffMultiplier?: number;
  };
  rateLimit?: {
    maxRequestsPerSecond: number;
    burst?: number;
  };
}

export interface MCPRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  data?: any;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  timeout?: number;
}

export interface MCPResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
  duration: number;
  requestId?: string;
}

export class MCPClient extends EventEmitter {
  private axiosInstance: AxiosInstance;
  private config: MCPClientConfig;
  private logger: Logger;
  private requestQueue: Array<() => Promise<any>> = [];
  private activeRequests = 0;
  private maxConcurrentRequests = 10;
  private rateLimitTokens: number;
  private lastTokenRefill: number = Date.now();

  constructor(config: MCPClientConfig) {
    super();
    this.config = config;
    this.logger = createLogger('MCPClient');
    this.rateLimitTokens = config.rateLimit?.burst || config.rateLimit?.maxRequestsPerSecond || 10;

    this.axiosInstance = this.createAxiosInstance();
    this.setupInterceptors();
  }

  private createAxiosInstance(): AxiosInstance {
    const axiosConfig: AxiosRequestConfig = {
      baseURL: this.config.baseURL,
      timeout: this.config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
    };

    // Configure authentication
    if (this.config.auth) {
      switch (this.config.auth.type) {
        case 'bearer':
          axiosConfig.headers!['Authorization'] = `Bearer ${this.config.auth.token}`;
          break;
        case 'basic': {
          const basicAuth = Buffer.from(
            `${this.config.auth.username}:${this.config.auth.password}`
          ).toString('base64');
          axiosConfig.headers!['Authorization'] = `Basic ${basicAuth}`;
          break;
        }
        case 'apikey': {
          const headerName = this.config.auth.apiKeyHeader || 'X-API-Key';
          axiosConfig.headers![headerName] = this.config.auth.apiKey!;
          break;
        }
        case 'oauth2':
          // OAuth2 implementation would go here
          break;
      }
    }

    return axios.create(axiosConfig);
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const requestId = this.generateRequestId();
        config.headers['X-Request-ID'] = requestId;

        this.logger.debug('MCP request', {
          method: config.method,
          url: config.url,
          requestId,
        });

        this.emit('request:start', {
          method: config.method,
          url: config.url,
          requestId,
        });

        return config;
      },
      (error) => {
        this.logger.error('MCP request error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const requestId = response.config.headers['X-Request-ID'];

        this.logger.debug('MCP response', {
          status: response.status,
          requestId,
        });

        this.emit('response:success', {
          status: response.status,
          requestId,
        });

        return response;
      },
      async (error) => {
        const requestId = error.config?.headers?.['X-Request-ID'];

        this.logger.error('MCP response error', {
          status: error.response?.status,
          message: error.message,
          requestId,
        });

        // Retry logic
        if (this.shouldRetry(error)) {
          return this.retryRequest(error.config);
        }

        this.emit('response:error', {
          status: error.response?.status,
          message: error.message,
          requestId,
        });

        return Promise.reject(error);
      }
    );
  }

  private shouldRetry(error: any): boolean {
    if (!this.config.retry || !error.config) {
      return false;
    }

    const retryCount = error.config._retryCount || 0;
    if (retryCount >= this.config.retry.maxAttempts) {
      return false;
    }

    // Retry on network errors or 5xx status codes
    const isNetworkError = !error.response;
    const isServerError = error.response?.status >= 500;

    return isNetworkError || isServerError;
  }

  private async retryRequest(config: any): Promise<any> {
    config._retryCount = (config._retryCount || 0) + 1;

    const delay = this.calculateRetryDelay(config._retryCount);

    this.logger.info(`Retrying request (attempt ${config._retryCount})`, {
      url: config.url,
      delay,
    });

    await this.sleep(delay);

    return this.axiosInstance.request(config);
  }

  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = this.config.retry?.delay || 1000;
    const multiplier = this.config.retry?.backoffMultiplier || 2;

    return baseDelay * Math.pow(multiplier, retryCount - 1);
  }

  private async enforceRateLimit(): Promise<void> {
    if (!this.config.rateLimit) {
      return;
    }

    // Refill tokens based on time elapsed
    const now = Date.now();
    const timeSinceRefill = now - this.lastTokenRefill;
    const tokensToAdd = (timeSinceRefill / 1000) * this.config.rateLimit.maxRequestsPerSecond;

    this.rateLimitTokens = Math.min(
      this.rateLimitTokens + tokensToAdd,
      this.config.rateLimit.burst || this.config.rateLimit.maxRequestsPerSecond
    );

    this.lastTokenRefill = now;

    // Wait if no tokens available
    if (this.rateLimitTokens < 1) {
      const waitTime =
        ((1 - this.rateLimitTokens) * 1000) / this.config.rateLimit.maxRequestsPerSecond;
      await this.sleep(waitTime);
      return this.enforceRateLimit();
    }

    this.rateLimitTokens--;
  }

  async request<T = any>(request: MCPRequest): Promise<MCPResponse<T>> {
    await this.enforceRateLimit();

    const startTime = Date.now();

    try {
      const response = await this.axiosInstance.request({
        method: request.method,
        url: request.path,
        data: request.data,
        headers: request.headers,
        params: request.params,
        timeout: request.timeout,
      });

      const duration = Date.now() - startTime;

      return {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>,
        duration,
        requestId: response.config.headers['X-Request-ID'],
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      if (error.response) {
        return {
          data: error.response.data,
          status: error.response.status,
          headers: error.response.headers,
          duration,
          requestId: error.config?.headers?.['X-Request-ID'],
        };
      }

      throw error;
    }
  }

  async get<T = any>(path: string, params?: Record<string, any>): Promise<MCPResponse<T>> {
    return this.request<T>({
      method: 'GET',
      path,
      params,
    });
  }

  async post<T = any>(path: string, data?: any): Promise<MCPResponse<T>> {
    return this.request<T>({
      method: 'POST',
      path,
      data,
    });
  }

  async put<T = any>(path: string, data?: any): Promise<MCPResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      path,
      data,
    });
  }

  async delete<T = any>(path: string): Promise<MCPResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      path,
    });
  }

  async patch<T = any>(path: string, data?: any): Promise<MCPResponse<T>> {
    return this.request<T>({
      method: 'PATCH',
      path,
      data,
    });
  }

  private generateRequestId(): string {
    return `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  updateAuth(auth: MCPClientConfig['auth']): void {
    this.config.auth = auth;
    this.axiosInstance = this.createAxiosInstance();
    this.setupInterceptors();
  }

  getMetrics(): {
    activeRequests: number;
    queuedRequests: number;
    rateLimitTokens: number;
  } {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      rateLimitTokens: this.rateLimitTokens,
    };
  }
}

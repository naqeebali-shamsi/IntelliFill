/**
 * Mock Helper for External Services
 *
 * Intercepts and mocks network calls to:
 * - OCR service
 * - R2/S3 storage
 * - Supabase auth email callbacks
 * - Other external services
 *
 * Uses Playwright's page.route() for network interception.
 */

import { Page, Route, Request } from '@playwright/test';

/**
 * OCR mock response data
 */
export interface OcrMockData {
  extractedFields: Record<string, string>;
  confidence: number;
  pages: number;
  rawText?: string;
}

/**
 * Default OCR mock response
 */
export const DEFAULT_OCR_RESPONSE: OcrMockData = {
  extractedFields: {
    'Passport No': 'AB1234567',
    'Full Name': 'John Test Doe',
    'Date of Birth': '1990-01-15',
    'Nationality': 'United States',
    'Issue Date': '2020-05-10',
    'Expiry Date': '2030-05-09',
    'Place of Birth': 'New York',
    'Gender': 'Male',
  },
  confidence: 0.95,
  pages: 1,
  rawText: 'PASSPORT\nAB1234567\nJohn Test Doe\n...',
};

/**
 * Storage upload mock response
 */
export interface StorageUploadMockResponse {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

/**
 * Mock configuration options
 */
export interface MockConfig {
  delay?: number;        // Artificial delay in ms
  statusCode?: number;   // HTTP status code
  failAfter?: number;    // Fail after N requests
}

/**
 * Mock Helper class for intercepting network requests
 */
export class MockHelper {
  private page: Page;
  private activeRoutes: string[] = [];
  private requestCounts: Map<string, number> = new Map();

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Mock OCR service responses
   */
  async mockOcrService(
    mockData: OcrMockData = DEFAULT_OCR_RESPONSE,
    config: MockConfig = {}
  ): Promise<void> {
    const routePattern = '**/api/ocr/**';
    this.activeRoutes.push(routePattern);

    await this.page.route(routePattern, async (route: Route) => {
      const requestCount = this.incrementRequestCount(routePattern);

      // Check if we should fail after N requests
      if (config.failAfter && requestCount > config.failAfter) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'OCR service unavailable' }),
        });
        return;
      }

      // Add artificial delay if specified
      if (config.delay) {
        await this.sleep(config.delay);
      }

      const statusCode = config.statusCode || 200;

      if (statusCode >= 400) {
        await route.fulfill({
          status: statusCode,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'OCR processing failed' }),
        });
        return;
      }

      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockData,
        }),
      });
    });
  }

  /**
   * Mock R2/S3 storage upload
   */
  async mockStorageUpload(
    response: StorageUploadMockResponse = { success: true, url: 'https://mock-storage.example.com/test-file' },
    config: MockConfig = {}
  ): Promise<void> {
    // Mock R2 upload endpoints
    const patterns = [
      '**/r2.cloudflarestorage.com/**',
      '**/storage.googleapis.com/**',
      '**/s3.amazonaws.com/**',
      '**/api/upload/**',
      '**/api/documents/upload**',
    ];

    for (const pattern of patterns) {
      this.activeRoutes.push(pattern);

      await this.page.route(pattern, async (route: Route, request: Request) => {
        // Only intercept PUT/POST requests (actual uploads)
        if (!['PUT', 'POST'].includes(request.method())) {
          await route.continue();
          return;
        }

        const requestCount = this.incrementRequestCount(pattern);

        if (config.failAfter && requestCount > config.failAfter) {
          await route.fulfill({
            status: 507,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Insufficient storage' }),
          });
          return;
        }

        if (config.delay) {
          await this.sleep(config.delay);
        }

        const statusCode = config.statusCode || 200;

        if (!response.success || statusCode >= 400) {
          await route.fulfill({
            status: statusCode || 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: response.error || 'Upload failed' }),
          });
          return;
        }

        await route.fulfill({
          status: statusCode,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            url: response.url || `https://mock-storage.example.com/${Date.now()}`,
            key: response.key || `uploads/${Date.now()}/test-file`,
          }),
        });
      });
    }
  }

  /**
   * Mock storage failure (507 Insufficient Storage)
   */
  async mockStorageFailure(errorMessage: string = 'Storage full'): Promise<void> {
    await this.mockStorageUpload(
      { success: false, error: errorMessage },
      { statusCode: 507 }
    );
  }

  /**
   * Mock Supabase auth email callbacks
   */
  async mockSupabaseAuthEmail(): Promise<void> {
    const patterns = [
      '**/auth/v1/verify**',
      '**/auth/v1/recover**',
      '**/auth/v1/magiclink**',
    ];

    for (const pattern of patterns) {
      this.activeRoutes.push(pattern);

      await this.page.route(pattern, async (route: Route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Email verified',
          }),
        });
      });
    }
  }

  /**
   * Mock email confirmation by directly calling the confirm endpoint
   */
  async mockEmailConfirmation(token?: string): Promise<void> {
    const confirmPattern = '**/auth/v1/verify**';
    this.activeRoutes.push(confirmPattern);

    await this.page.route(confirmPattern, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          user: {
            id: 'mock-user-id',
            email: 'test@example.com',
            email_confirmed_at: new Date().toISOString(),
          },
        }),
      });
    });
  }

  /**
   * Mock API response with custom delay
   */
  async mockApiDelay(
    urlPattern: string,
    delayMs: number,
    options?: {
      response?: unknown;
      statusCode?: number;
    }
  ): Promise<void> {
    this.activeRoutes.push(urlPattern);

    await this.page.route(urlPattern, async (route: Route) => {
      await this.sleep(delayMs);

      if (options?.response) {
        await route.fulfill({
          status: options.statusCode || 200,
          contentType: 'application/json',
          body: JSON.stringify(options.response),
        });
      } else {
        await route.continue();
      }
    });
  }

  /**
   * Mock API error response
   */
  async mockApiError(
    urlPattern: string,
    statusCode: number,
    errorMessage: string = 'Internal Server Error'
  ): Promise<void> {
    this.activeRoutes.push(urlPattern);

    await this.page.route(urlPattern, async (route: Route) => {
      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({ error: errorMessage }),
      });
    });
  }

  /**
   * Mock Redis/queue service failure
   */
  async mockQueueServiceFailure(): Promise<void> {
    const queuePatterns = [
      '**/api/queue/**',
      '**/api/process/**',
      '**/api/jobs/**',
    ];

    for (const pattern of queuePatterns) {
      await this.mockApiError(pattern, 503, 'Queue service unavailable');
    }
  }

  /**
   * Mock network timeout
   */
  async mockNetworkTimeout(urlPattern: string, timeoutMs: number = 30000): Promise<void> {
    this.activeRoutes.push(urlPattern);

    await this.page.route(urlPattern, async (route: Route) => {
      // Never fulfill - let it timeout
      await this.sleep(timeoutMs);
      await route.abort('timedout');
    });
  }

  /**
   * Mock CORS error (block request from different origin)
   */
  async mockCorsError(urlPattern: string): Promise<void> {
    this.activeRoutes.push(urlPattern);

    await this.page.route(urlPattern, async (route: Route) => {
      await route.fulfill({
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          // Intentionally missing CORS headers
        },
        body: JSON.stringify({ error: 'CORS error' }),
      });
    });
  }

  /**
   * Intercept and log requests (for debugging)
   */
  async interceptAndLog(urlPattern: string): Promise<void> {
    this.activeRoutes.push(urlPattern);

    await this.page.route(urlPattern, async (route: Route, request: Request) => {
      console.log(`[Mock] ${request.method()} ${request.url()}`);
      console.log(`  Headers: ${JSON.stringify(request.headers())}`);

      const postData = request.postData();
      if (postData) {
        console.log(`  Body: ${postData.substring(0, 500)}`);
      }

      await route.continue();
    });
  }

  /**
   * Clear all active mocks
   */
  async clearMocks(): Promise<void> {
    for (const pattern of this.activeRoutes) {
      await this.page.unroute(pattern);
    }
    this.activeRoutes = [];
    this.requestCounts.clear();
  }

  /**
   * Get request count for a pattern
   */
  getRequestCount(pattern: string): number {
    return this.requestCounts.get(pattern) || 0;
  }

  /**
   * Reset request counts
   */
  resetRequestCounts(): void {
    this.requestCounts.clear();
  }

  /**
   * Wait for a specific number of requests to a pattern
   */
  async waitForRequests(
    urlPattern: string,
    count: number,
    timeoutMs: number = 10000
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (this.getRequestCount(urlPattern) >= count) {
        return;
      }
      await this.sleep(100);
    }

    throw new Error(`Timeout waiting for ${count} requests to ${urlPattern}`);
  }

  /**
   * Increment request count for a pattern
   */
  private incrementRequestCount(pattern: string): number {
    const count = (this.requestCounts.get(pattern) || 0) + 1;
    this.requestCounts.set(pattern, count);
    return count;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a mock helper instance for a page
 */
export function createMockHelper(page: Page): MockHelper {
  return new MockHelper(page);
}

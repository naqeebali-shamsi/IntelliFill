/**
 * API Helper for E2E Test Setup and Teardown
 *
 * Provides direct interaction with the backend API for:
 * - Creating/deleting test users
 * - Uploading documents directly
 * - Managing test data lifecycle
 *
 * Uses the 'test-e2e-{uuid}' prefix convention for test data.
 */

import { APIRequestContext, request } from '@playwright/test';
import { testConfig } from '../../playwright.config';

// Test data prefix for easy identification and cleanup
export const TEST_PREFIX = 'test-e2e';

/**
 * Generate a unique test identifier
 */
export function generateTestId(): string {
  return `${TEST_PREFIX}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Generate a test email
 */
export function generateTestEmail(suffix?: string): string {
  const id = suffix || generateTestId().split('-').pop();
  return `${TEST_PREFIX}-${id}@test.intellifill.local`;
}

/**
 * API response types
 */
export interface TestUser {
  id: string;
  email: string;
  name: string;
  organizationId?: string;
  role?: string;
}

export interface TestDocument {
  id: string;
  name: string;
  status: string;
  organizationId: string;
}

export interface TestOrganization {
  id: string;
  name: string;
  slug: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * API Helper class for test setup and teardown
 */
export class ApiHelper {
  private apiContext: APIRequestContext | null = null;
  private readonly baseUrl: string;
  private authTokens: AuthTokens | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || testConfig.apiURL;
  }

  /**
   * Initialize the API context
   */
  async init(): Promise<void> {
    if (!this.apiContext) {
      this.apiContext = await request.newContext({
        baseURL: this.baseUrl,
        extraHTTPHeaders: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
    }
  }

  /**
   * Dispose the API context
   */
  async dispose(): Promise<void> {
    if (this.apiContext) {
      await this.apiContext.dispose();
      this.apiContext = null;
    }
  }

  /**
   * Set authentication tokens for subsequent requests
   */
  setAuth(tokens: AuthTokens): void {
    this.authTokens = tokens;
  }

  /**
   * Clear authentication tokens
   */
  clearAuth(): void {
    this.authTokens = null;
  }

  /**
   * Get request headers with optional auth
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (this.authTokens?.accessToken) {
      headers['Authorization'] = `Bearer ${this.authTokens.accessToken}`;
    }

    return headers;
  }

  /**
   * Create a test user via the API
   */
  async createTestUser(options?: {
    email?: string;
    password?: string;
    name?: string;
  }): Promise<TestUser & { password: string; tokens: AuthTokens }> {
    await this.init();

    const testId = generateTestId();
    const email = options?.email || generateTestEmail();
    const password = options?.password || `TestPass123!${testId.slice(-4)}`;
    const name = options?.name || `Test User ${testId.slice(-6)}`;

    const response = await this.apiContext!.post('/auth/v2/register', {
      headers: this.getHeaders(),
      data: {
        email,
        password,
        name,
        acceptTerms: true,
      },
    });

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Failed to create test user: ${response.status()} - ${error}`);
    }

    const data = await response.json();

    return {
      id: data.user?.id || data.id,
      email,
      password,
      name,
      organizationId: data.user?.organizationId || data.organizationId,
      role: data.user?.role || data.role,
      tokens: {
        accessToken: data.accessToken || data.access_token,
        refreshToken: data.refreshToken || data.refresh_token,
      },
    };
  }

  /**
   * Login as an existing user
   */
  async login(email: string, password: string): Promise<AuthTokens> {
    await this.init();

    const response = await this.apiContext!.post('/auth/v2/login', {
      headers: this.getHeaders(),
      data: { email, password },
    });

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Failed to login: ${response.status()} - ${error}`);
    }

    const data = await response.json();
    const tokens: AuthTokens = {
      accessToken: data.accessToken || data.access_token,
      refreshToken: data.refreshToken || data.refresh_token,
    };

    this.setAuth(tokens);
    return tokens;
  }

  /**
   * Delete a test user (requires admin or self)
   */
  async deleteTestUser(userId: string): Promise<void> {
    await this.init();

    const response = await this.apiContext!.delete(`/users/${userId}`, {
      headers: this.getHeaders(),
    });

    // Accept 200, 204, or 404 (already deleted)
    if (!response.ok() && response.status() !== 404) {
      const error = await response.text();
      throw new Error(`Failed to delete test user: ${response.status()} - ${error}`);
    }
  }

  /**
   * Upload a document directly via API
   */
  async uploadDocDirectly(
    filePath: string,
    options?: {
      organizationId?: string;
      name?: string;
    }
  ): Promise<TestDocument> {
    await this.init();

    const fs = await import('fs');
    const path = await import('path');

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = options?.name || path.basename(filePath);

    const response = await this.apiContext!.post('/documents', {
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'multipart/form-data',
      },
      multipart: {
        file: {
          name: fileName,
          mimeType: this.getMimeType(fileName),
          buffer: fileBuffer,
        },
        ...(options?.organizationId && { organizationId: options.organizationId }),
      },
    });

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Failed to upload document: ${response.status()} - ${error}`);
    }

    const data = await response.json();
    return {
      id: data.id || data.document?.id,
      name: data.name || data.document?.name || fileName,
      status: data.status || data.document?.status || 'pending',
      organizationId: data.organizationId || data.document?.organizationId,
    };
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    await this.init();

    const response = await this.apiContext!.delete(`/documents/${documentId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok() && response.status() !== 404) {
      const error = await response.text();
      throw new Error(`Failed to delete document: ${response.status()} - ${error}`);
    }
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<TestDocument | null> {
    await this.init();

    const response = await this.apiContext!.get(`/documents/${documentId}`, {
      headers: this.getHeaders(),
    });

    if (response.status() === 404) {
      return null;
    }

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Failed to get document: ${response.status()} - ${error}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      name: data.name,
      status: data.status,
      organizationId: data.organizationId,
    };
  }

  /**
   * Wait for document to reach a specific status
   */
  async waitForDocumentStatus(
    documentId: string,
    targetStatus: string,
    timeoutMs: number = testConfig.timeouts.ocrProcessing
  ): Promise<TestDocument> {
    const startTime = Date.now();
    const pollInterval = 1000;

    while (Date.now() - startTime < timeoutMs) {
      const doc = await this.getDocument(documentId);

      if (!doc) {
        throw new Error(`Document ${documentId} not found`);
      }

      if (doc.status === targetStatus) {
        return doc;
      }

      if (doc.status === 'error' || doc.status === 'failed') {
        throw new Error(`Document ${documentId} reached error status: ${doc.status}`);
      }

      await this.sleep(pollInterval);
    }

    throw new Error(`Timeout waiting for document ${documentId} to reach status ${targetStatus}`);
  }

  /**
   * Create an organization
   */
  async createOrganization(name?: string): Promise<TestOrganization> {
    await this.init();

    const testId = generateTestId();
    const orgName = name || `Test Org ${testId.slice(-6)}`;

    const response = await this.apiContext!.post('/organizations', {
      headers: this.getHeaders(),
      data: {
        name: orgName,
        slug: `${TEST_PREFIX}-${testId.slice(-8)}`,
      },
    });

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Failed to create organization: ${response.status()} - ${error}`);
    }

    const data = await response.json();
    return {
      id: data.id || data.organization?.id,
      name: data.name || data.organization?.name,
      slug: data.slug || data.organization?.slug,
    };
  }

  /**
   * Delete an organization
   */
  async deleteOrganization(organizationId: string): Promise<void> {
    await this.init();

    const response = await this.apiContext!.delete(`/organizations/${organizationId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok() && response.status() !== 404) {
      const error = await response.text();
      throw new Error(`Failed to delete organization: ${response.status()} - ${error}`);
    }
  }

  /**
   * Check API health
   */
  async checkHealth(): Promise<{ status: string; version?: string; database?: string }> {
    await this.init();

    const response = await this.apiContext!.get('/health', {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok()) {
      throw new Error(`Health check failed: ${response.status()}`);
    }

    return await response.json();
  }

  /**
   * Cleanup all test data created with the test prefix
   */
  async cleanupTestData(): Promise<void> {
    // This would typically call a cleanup endpoint or iterate through test data
    // For now, this is a placeholder that individual tests can use to cleanup
    console.log('Cleanup test data called - implement based on your backend API');
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      json: 'application/json',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance for convenience
let defaultApiHelper: ApiHelper | null = null;

export function getApiHelper(): ApiHelper {
  if (!defaultApiHelper) {
    defaultApiHelper = new ApiHelper();
  }
  return defaultApiHelper;
}

export async function disposeApiHelper(): Promise<void> {
  if (defaultApiHelper) {
    await defaultApiHelper.dispose();
    defaultApiHelper = null;
  }
}

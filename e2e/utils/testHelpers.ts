/**
 * Test Helpers - Utility functions for E2E tests
 *
 * Provides reusable functions for:
 * - Authentication
 * - API calls
 * - Data generation
 * - File handling
 */

import { Page, APIRequestContext, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Test Data Types
// ============================================================================

export interface TestUser {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface TestDocument {
  name: string;
  path: string;
  mimeType: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ============================================================================
// Test Users
// ============================================================================

export const TEST_USERS = {
  admin: {
    email: 'admin@test.intellifill.com',
    password: 'TestAdmin123!',
    firstName: 'Admin',
    lastName: 'User',
  },
  standard: {
    email: 'user@test.intellifill.com',
    password: 'TestUser123!',
    firstName: 'Test',
    lastName: 'User',
  },
  newUser: {
    email: `newuser_${Date.now()}@test.intellifill.com`,
    password: 'NewUser123!',
    firstName: 'New',
    lastName: 'User',
  },
} as const;

// ============================================================================
// API Helpers
// ============================================================================

const API_BASE = process.env.API_URL || 'http://backend-test:3002/api';

/**
 * Login via API and return tokens
 */
export async function apiLogin(
  request: APIRequestContext,
  user: TestUser
): Promise<AuthTokens> {
  const response = await request.post(`${API_BASE}/auth/v2/login`, {
    data: {
      email: user.email,
      password: user.password,
    },
  });

  expect(response.ok()).toBeTruthy();
  const data = await response.json();

  return {
    accessToken: data.accessToken || data.token,
    refreshToken: data.refreshToken,
  };
}

/**
 * Register new user via API
 */
export async function apiRegister(
  request: APIRequestContext,
  user: TestUser
): Promise<AuthTokens> {
  const response = await request.post(`${API_BASE}/auth/v2/register`, {
    data: {
      email: user.email,
      password: user.password,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });

  expect(response.ok()).toBeTruthy();
  const data = await response.json();

  return {
    accessToken: data.accessToken || data.token,
    refreshToken: data.refreshToken,
  };
}

/**
 * Make authenticated API request
 */
export async function apiRequest(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  endpoint: string,
  token: string,
  data?: Record<string, unknown>
): Promise<unknown> {
  const options: Record<string, unknown> = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  if (data) {
    options.data = data;
  }

  let response;
  switch (method) {
    case 'GET':
      response = await request.get(`${API_BASE}${endpoint}`, options);
      break;
    case 'POST':
      response = await request.post(`${API_BASE}${endpoint}`, options);
      break;
    case 'PUT':
      response = await request.put(`${API_BASE}${endpoint}`, options);
      break;
    case 'DELETE':
      response = await request.delete(`${API_BASE}${endpoint}`, options);
      break;
    case 'PATCH':
      response = await request.patch(`${API_BASE}${endpoint}`, options);
      break;
  }

  return response.json();
}

// ============================================================================
// Browser Storage Helpers
// ============================================================================

/**
 * Set authentication state in browser
 */
export async function setAuthState(page: Page, tokens: AuthTokens): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem('accessToken', t.accessToken);
    localStorage.setItem('refreshToken', t.refreshToken);
  }, tokens);
}

/**
 * Clear authentication state
 */
export async function clearAuthState(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.clear();
  });
}

/**
 * Get stored token from browser
 */
export async function getStoredToken(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem('accessToken'));
}

// ============================================================================
// File Helpers
// ============================================================================

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

/**
 * Get path to test fixture file
 */
export function getFixturePath(filename: string): string {
  return path.join(FIXTURES_DIR, filename);
}

/**
 * Create temporary test file
 */
export function createTempFile(
  filename: string,
  content: string | Buffer
): string {
  const tempDir = path.join(FIXTURES_DIR, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

/**
 * Clean up temporary files
 */
export function cleanupTempFiles(): void {
  const tempDir = path.join(FIXTURES_DIR, 'temp');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
}

// ============================================================================
// Data Generators
// ============================================================================

/**
 * Generate random email
 */
export function generateEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test_${timestamp}_${random}@test.intellifill.com`;
}

/**
 * Generate random string
 */
export function generateRandomString(length = 10): string {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
}

/**
 * Generate test document name
 */
export function generateDocumentName(): string {
  return `test_doc_${Date.now()}.pdf`;
}

/**
 * Generate test template data
 */
export function generateTemplateData(): Record<string, unknown> {
  return {
    name: `Test Template ${Date.now()}`,
    description: 'Auto-generated test template',
    fields: [
      { name: 'firstName', type: 'text', required: true },
      { name: 'lastName', type: 'text', required: true },
      { name: 'email', type: 'email', required: true },
    ],
  };
}

// ============================================================================
// Wait Helpers
// ============================================================================

/**
 * Wait for specified milliseconds
 */
export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      await wait(delayMs * Math.pow(2, i));
    }
  }

  throw lastError;
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert API response is successful
 */
export function assertAPISuccess(response: { ok: () => boolean; status: () => number }): void {
  expect(response.ok()).toBeTruthy();
  expect(response.status()).toBeLessThan(400);
}

/**
 * Assert element count
 */
export async function assertElementCount(
  page: Page,
  selector: string,
  expectedCount: number
): Promise<void> {
  const elements = page.locator(selector);
  await expect(elements).toHaveCount(expectedCount);
}

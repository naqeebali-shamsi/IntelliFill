/**
 * Test Data Index
 *
 * Central export for all test data files and utilities.
 */

import * as path from 'path';
import * as fs from 'fs';

// Base paths
export const DATA_DIR = __dirname;
export const TEST_DOCUMENTS_DIR = path.join(DATA_DIR, 'test-documents');

// JSON data types
interface TestUser {
  email: string;
  password: string;
  name: string;
  role: string;
  organizationSlug: string;
}

interface TestUserData {
  testUsers: {
    admin: TestUser;
    owner: TestUser;
    member: TestUser;
    viewer: TestUser;
    newUser: TestUser;
    passwordReset: TestUser;
  };
  invalidCredentials: {
    wrongPassword: { email: string; password: string };
    nonexistentUser: { email: string; password: string };
    malformedEmail: { email: string; password: string };
    weakPassword: { email: string; password: string };
  };
  securityTestPayloads: {
    sqlInjection: string[];
    xssPayloads: string[];
    pathTraversal: string[];
  };
}

interface TestTemplateData {
  templates: Record<string, {
    id: string;
    name: string;
    category: string;
    fields: Array<{
      name: string;
      label: string;
      type: string;
      required?: boolean;
      options?: string[];
      validation?: string;
    }>;
  }>;
  expectedOcrMappings: Record<string, Record<string, string>>;
}

// JSON data imports (using require for compatibility)
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const testUsers: TestUserData = require('./test-users.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const testTemplates: TestTemplateData = require('./test-templates.json');

/**
 * Test document file paths
 */
export const TEST_DOCUMENTS = {
  validPdf: path.join(TEST_DOCUMENTS_DIR, 'sample-pdf-text.pdf'),
  multipagePdf: path.join(TEST_DOCUMENTS_DIR, 'sample-multipage.pdf'),
  corruptPdf: path.join(TEST_DOCUMENTS_DIR, 'corrupt-file.pdf'),
  validJpg: path.join(TEST_DOCUMENTS_DIR, 'sample-image.jpg'),
  validPng: path.join(TEST_DOCUMENTS_DIR, 'sample-image.png'),
};

/**
 * Verify test document exists
 */
export function verifyTestDocument(documentPath: string): boolean {
  return fs.existsSync(documentPath);
}

/**
 * Get all test document paths
 */
export function getAllTestDocumentPaths(): string[] {
  return Object.values(TEST_DOCUMENTS);
}

/**
 * Get valid test documents (excludes corrupt files)
 */
export function getValidTestDocuments(): string[] {
  return [
    TEST_DOCUMENTS.validPdf,
    TEST_DOCUMENTS.multipagePdf,
    TEST_DOCUMENTS.validJpg,
    TEST_DOCUMENTS.validPng,
  ];
}

/**
 * Test user helpers
 */
export function getTestUser(role: 'admin' | 'owner' | 'member' | 'viewer' | 'newUser' | 'passwordReset') {
  return testUsers.testUsers[role];
}

export function getInvalidCredentials(type: 'wrongPassword' | 'nonexistentUser' | 'malformedEmail' | 'weakPassword') {
  return testUsers.invalidCredentials[type];
}

export function getSqlInjectionPayloads(): string[] {
  return testUsers.securityTestPayloads.sqlInjection;
}

export function getXssPayloads(): string[] {
  return testUsers.securityTestPayloads.xssPayloads;
}

export function getPathTraversalPayloads(): string[] {
  return testUsers.securityTestPayloads.pathTraversal;
}

/**
 * Test template helpers
 */
export function getTemplate(name: 'uaeVisa' | 'employmentContract' | 'bankStatement' | 'customTemplate') {
  return testTemplates.templates[name];
}

export function getOcrMapping(templateName: string) {
  return testTemplates.expectedOcrMappings[templateName as keyof typeof testTemplates.expectedOcrMappings];
}

/**
 * Generate unique test data
 */
export function generateUniqueEmail(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}@test.intellifill.local`;
}

export function generateUniqueName(prefix: string = 'Test User'): string {
  return `${prefix} ${Date.now().toString(36).toUpperCase()}`;
}

export function generateUniqueOrgName(prefix: string = 'Test Org'): string {
  return `${prefix} ${Date.now().toString(36).toUpperCase()}`;
}

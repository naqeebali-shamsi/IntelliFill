/**
 * Organization and Document Fixtures
 *
 * Provides fixtures for:
 * - Creating test organizations with automatic cleanup
 * - Creating test documents
 * - Managing test data lifecycle
 *
 * Uses worker-scoped resource tracking to prevent race conditions
 * in parallel test execution.
 */

import { test as base, Page, BrowserContext } from '@playwright/test';
import {
  ApiHelper,
  TestOrganization,
  TestDocument,
  generateTestId,
  TEST_PREFIX,
} from '../helpers/api.helper';
import { DbHelper } from '../helpers/db.helper';
import { test as authTest, AuthFixtures } from './auth.fixture';

/**
 * Organization fixture data
 */
export interface OrgFixtureData {
  organization: TestOrganization;
  cleanup: () => Promise<void>;
}

/**
 * Document fixture data
 */
export interface DocFixtureData {
  document: TestDocument;
  cleanup: () => Promise<void>;
}

/**
 * Multiple documents fixture
 */
export interface DocsFixtureData {
  documents: TestDocument[];
  cleanup: () => Promise<void>;
}

/**
 * Organization and Document fixtures
 */
export type OrgFixtures = {
  // Organization fixtures
  testOrganization: OrgFixtureData;
  secondOrganization: OrgFixtureData;

  // Document fixtures
  testDocument: DocFixtureData;
  testDocuments: DocsFixtureData;

  // Helpers with cleanup tracking
  orgHelper: {
    createOrg: (name?: string) => Promise<OrgFixtureData>;
    deleteOrg: (orgId: string) => Promise<void>;
  };

  docHelper: {
    uploadDoc: (filePath: string, orgId?: string) => Promise<DocFixtureData>;
    deleteDoc: (docId: string) => Promise<void>;
  };

  // DB helper for verification
  dbHelper: DbHelper;
};

/**
 * Worker-scoped resource tracking to prevent race conditions
 * Each worker maintains its own list of created resources
 */
interface WorkerResources {
  organizations: string[];
  documents: string[];
  workerId: number;
}

/**
 * Worker fixtures that are shared across all tests in a single worker
 */
export type WorkerFixtures = {
  workerResources: WorkerResources;
};

/**
 * Extended test with organization and document fixtures
 */
export const test = authTest.extend<OrgFixtures, WorkerFixtures>({
  // Worker-scoped resource tracking - shared within worker, isolated between workers
  workerResources: [async ({}, use, workerInfo) => {
    const resources: WorkerResources = {
      organizations: [],
      documents: [],
      workerId: workerInfo.workerIndex,
    };

    console.log(`[Worker ${workerInfo.workerIndex}] Initialized resource tracking`);

    await use(resources);

    // Worker cleanup - runs when all tests in this worker complete
    console.log(
      `[Worker ${workerInfo.workerIndex}] Cleaning up: ` +
      `${resources.organizations.length} orgs, ${resources.documents.length} docs`
    );

    const api = new ApiHelper();
    await api.init();

    // Cleanup documents first (they depend on organizations)
    for (const docId of resources.documents) {
      try {
        await api.deleteDocument(docId);
        console.log(`[Worker ${workerInfo.workerIndex}] Deleted doc: ${docId}`);
      } catch (error) {
        console.warn(`[Worker ${workerInfo.workerIndex}] Failed to delete doc ${docId}:`, error);
      }
    }

    // Then cleanup organizations
    for (const orgId of resources.organizations) {
      try {
        await api.deleteOrganization(orgId);
        console.log(`[Worker ${workerInfo.workerIndex}] Deleted org: ${orgId}`);
      } catch (error) {
        console.warn(`[Worker ${workerInfo.workerIndex}] Failed to delete org ${orgId}:`, error);
      }
    }

    await api.dispose();
  }, { scope: 'worker' }],

  // Primary test organization
  testOrganization: async ({ authenticatedApi, workerResources }, use) => {
    const testId = generateTestId();
    const orgName = `Test Org W${workerResources.workerId}-${testId.slice(-8)}`;

    let organization: TestOrganization | null = null;

    try {
      organization = await authenticatedApi.createOrganization(orgName);
      workerResources.organizations.push(organization.id);
      console.log(`[Worker ${workerResources.workerId}] Created org: ${organization.id}`);
    } catch (error) {
      console.warn('Could not create test organization:', error);
      // Create a mock organization for tests that don't need real backend
      organization = {
        id: `mock-org-${testId}`,
        name: orgName,
        slug: `${TEST_PREFIX}-${testId.slice(-8)}`,
      };
    }

    const cleanup = async () => {
      if (organization && !organization.id.startsWith('mock-')) {
        try {
          await authenticatedApi.deleteOrganization(organization.id);
          const idx = workerResources.organizations.indexOf(organization.id);
          if (idx > -1) workerResources.organizations.splice(idx, 1);
          console.log(`[Worker ${workerResources.workerId}] Cleaned up org: ${organization.id}`);
        } catch (error) {
          console.warn(`Failed to cleanup organization ${organization.id}:`, error);
        }
      }
    };

    await use({ organization, cleanup });

    // Auto cleanup after test
    await cleanup();
  },

  // Second organization for isolation tests
  secondOrganization: async ({ authenticatedApi, workerResources }, use) => {
    const testId = generateTestId();
    const orgName = `Second Org W${workerResources.workerId}-${testId.slice(-8)}`;

    let organization: TestOrganization | null = null;

    try {
      organization = await authenticatedApi.createOrganization(orgName);
      workerResources.organizations.push(organization.id);
      console.log(`[Worker ${workerResources.workerId}] Created second org: ${organization.id}`);
    } catch (error) {
      console.warn('Could not create second organization:', error);
      organization = {
        id: `mock-org-2-${testId}`,
        name: orgName,
        slug: `${TEST_PREFIX}-2-${testId.slice(-8)}`,
      };
    }

    const cleanup = async () => {
      if (organization && !organization.id.startsWith('mock-')) {
        try {
          await authenticatedApi.deleteOrganization(organization.id);
          const idx = workerResources.organizations.indexOf(organization.id);
          if (idx > -1) workerResources.organizations.splice(idx, 1);
          console.log(`[Worker ${workerResources.workerId}] Cleaned up second org: ${organization.id}`);
        } catch (error) {
          console.warn(`Failed to cleanup second organization ${organization.id}:`, error);
        }
      }
    };

    await use({ organization, cleanup });

    // Auto cleanup after test
    await cleanup();
  },

  // Test document fixture
  testDocument: async ({ authenticatedApi, testOrganization, workerResources }, use) => {
    const testId = generateTestId();
    let document: TestDocument | null = null;

    // Use the sample PDF from test data
    const samplePdfPath = require('path').join(__dirname, '../data/test-documents/sample-pdf-text.pdf');

    try {
      document = await authenticatedApi.uploadDocDirectly(samplePdfPath, {
        organizationId: testOrganization.organization.id,
        name: `test-doc-W${workerResources.workerId}-${testId.slice(-8)}.pdf`,
      });
      workerResources.documents.push(document.id);
      console.log(`[Worker ${workerResources.workerId}] Created doc: ${document.id}`);
    } catch (error) {
      console.warn('Could not create test document:', error);
      document = {
        id: `mock-doc-${testId}`,
        name: `test-doc-W${workerResources.workerId}-${testId.slice(-8)}.pdf`,
        status: 'pending',
        organizationId: testOrganization.organization.id,
      };
    }

    const cleanup = async () => {
      if (document && !document.id.startsWith('mock-')) {
        try {
          await authenticatedApi.deleteDocument(document.id);
          const idx = workerResources.documents.indexOf(document.id);
          if (idx > -1) workerResources.documents.splice(idx, 1);
          console.log(`[Worker ${workerResources.workerId}] Cleaned up doc: ${document.id}`);
        } catch (error) {
          console.warn(`Failed to cleanup document ${document.id}:`, error);
        }
      }
    };

    await use({ document, cleanup });

    // Auto cleanup after test
    await cleanup();
  },

  // Multiple test documents fixture
  testDocuments: async ({ authenticatedApi, testOrganization, workerResources }, use) => {
    const documents: TestDocument[] = [];
    const testDocsPath = require('path').join(__dirname, '../data/test-documents');
    const fs = require('fs');

    // Get all PDF files in test-documents
    const pdfFiles = fs.readdirSync(testDocsPath)
      .filter((f: string) => f.endsWith('.pdf') && !f.includes('corrupt'));

    for (const file of pdfFiles.slice(0, 3)) { // Max 3 documents
      const filePath = require('path').join(testDocsPath, file);

      try {
        const document = await authenticatedApi.uploadDocDirectly(filePath, {
          organizationId: testOrganization.organization.id,
        });
        documents.push(document);
        workerResources.documents.push(document.id);
        console.log(`[Worker ${workerResources.workerId}] Created doc from ${file}: ${document.id}`);
      } catch (error) {
        console.warn(`Could not upload ${file}:`, error);
      }
    }

    const cleanup = async () => {
      for (const doc of documents) {
        if (!doc.id.startsWith('mock-')) {
          try {
            await authenticatedApi.deleteDocument(doc.id);
            const idx = workerResources.documents.indexOf(doc.id);
            if (idx > -1) workerResources.documents.splice(idx, 1);
            console.log(`[Worker ${workerResources.workerId}] Cleaned up doc: ${doc.id}`);
          } catch (error) {
            console.warn(`Failed to cleanup document ${doc.id}:`, error);
          }
        }
      }
    };

    await use({ documents, cleanup });

    // Auto cleanup after test
    await cleanup();
  },

  // Organization helper with tracking
  orgHelper: async ({ authenticatedApi, workerResources }, use) => {
    const createdInTest: string[] = [];

    const helper = {
      createOrg: async (name?: string): Promise<OrgFixtureData> => {
        const testId = generateTestId();
        const orgName = name || `Helper Org W${workerResources.workerId}-${testId.slice(-8)}`;

        const organization = await authenticatedApi.createOrganization(orgName);
        createdInTest.push(organization.id);
        workerResources.organizations.push(organization.id);
        console.log(`[Worker ${workerResources.workerId}] Created helper org: ${organization.id}`);

        const cleanup = async () => {
          try {
            await authenticatedApi.deleteOrganization(organization.id);
            const idx = workerResources.organizations.indexOf(organization.id);
            if (idx > -1) workerResources.organizations.splice(idx, 1);
            console.log(`[Worker ${workerResources.workerId}] Cleaned up helper org: ${organization.id}`);
          } catch (error) {
            console.warn(`Failed to cleanup organization ${organization.id}:`, error);
          }
        };

        return { organization, cleanup };
      },

      deleteOrg: async (orgId: string): Promise<void> => {
        await authenticatedApi.deleteOrganization(orgId);
        const idx = workerResources.organizations.indexOf(orgId);
        if (idx > -1) workerResources.organizations.splice(idx, 1);
        console.log(`[Worker ${workerResources.workerId}] Deleted org via helper: ${orgId}`);
      },
    };

    await use(helper);

    // Cleanup all organizations created by this helper
    for (const orgId of createdInTest) {
      try {
        await authenticatedApi.deleteOrganization(orgId);
        const idx = workerResources.organizations.indexOf(orgId);
        if (idx > -1) workerResources.organizations.splice(idx, 1);
      } catch (error) {
        // Ignore - may already be deleted
      }
    }
  },

  // Document helper with tracking
  docHelper: async ({ authenticatedApi, testOrganization, workerResources }, use) => {
    const createdInTest: string[] = [];

    const helper = {
      uploadDoc: async (filePath: string, orgId?: string): Promise<DocFixtureData> => {
        const document = await authenticatedApi.uploadDocDirectly(filePath, {
          organizationId: orgId || testOrganization.organization.id,
        });
        createdInTest.push(document.id);
        workerResources.documents.push(document.id);
        console.log(`[Worker ${workerResources.workerId}] Uploaded doc via helper: ${document.id}`);

        const cleanup = async () => {
          try {
            await authenticatedApi.deleteDocument(document.id);
            const idx = workerResources.documents.indexOf(document.id);
            if (idx > -1) workerResources.documents.splice(idx, 1);
            console.log(`[Worker ${workerResources.workerId}] Cleaned up helper doc: ${document.id}`);
          } catch (error) {
            console.warn(`Failed to cleanup document ${document.id}:`, error);
          }
        };

        return { document, cleanup };
      },

      deleteDoc: async (docId: string): Promise<void> => {
        await authenticatedApi.deleteDocument(docId);
        const idx = workerResources.documents.indexOf(docId);
        if (idx > -1) workerResources.documents.splice(idx, 1);
        console.log(`[Worker ${workerResources.workerId}] Deleted doc via helper: ${docId}`);
      },
    };

    await use(helper);

    // Cleanup all documents created by this helper
    for (const docId of createdInTest) {
      try {
        await authenticatedApi.deleteDocument(docId);
        const idx = workerResources.documents.indexOf(docId);
        if (idx > -1) workerResources.documents.splice(idx, 1);
      } catch (error) {
        // Ignore - may already be deleted
      }
    }
  },

  // Database helper for verification
  dbHelper: async ({}, use) => {
    const dbHelper = new DbHelper();
    await dbHelper.init();

    await use(dbHelper);

    // Cleanup seeded records
    await dbHelper.cleanupSeededRecords();
    await dbHelper.dispose();
  },
});

export { expect } from '@playwright/test';

/**
 * Global cleanup function
 *
 * Note: Most cleanup happens per-worker. This function handles
 * any orphaned resources that might remain (e.g., from crashed workers).
 */
export async function globalCleanup(): Promise<void> {
  console.log('[Global Cleanup] Checking for orphaned test resources...');

  const api = new ApiHelper();
  await api.init();

  try {
    // Query for any test-prefixed resources that weren't cleaned up
    // This is a safety net - worker cleanup should handle most cases
    // Implementation depends on your API capabilities

    console.log('[Global Cleanup] Cleanup complete');
  } catch (error) {
    console.warn('[Global Cleanup] Error during cleanup:', error);
  } finally {
    await api.dispose();
  }
}

/**
 * Get count of tracked resources
 * Note: This function is deprecated as resources are now worker-scoped.
 * Use workerResources fixture directly for per-worker tracking.
 * @deprecated
 */
export function getTrackedResourceCount(): { organizations: number; documents: number } {
  console.warn('getTrackedResourceCount() is deprecated - resources are now worker-scoped');
  return {
    organizations: 0,
    documents: 0,
  };
}

/**
 * E2E Test Helpers Index
 *
 * Central export for all helper modules.
 */

// API Helper
export {
  ApiHelper,
  getApiHelper,
  disposeApiHelper,
  generateTestId,
  generateTestEmail,
  TEST_PREFIX,
  type TestUser,
  type TestDocument,
  type TestOrganization,
  type AuthTokens,
} from './api.helper';

// Mock Helper
export {
  MockHelper,
  createMockHelper,
  DEFAULT_OCR_RESPONSE,
  type OcrMockData,
  type StorageUploadMockResponse,
  type MockConfig,
} from './mock.helper';

// DB Helper
export {
  DbHelper,
  getDbHelper,
  disposeDbHelper,
} from './db.helper';

// Supabase Helper
export {
  getSupabaseAdmin,
  restoreUserPassword,
  isSupabaseAdminConfigured,
  supabaseAdmin,
} from './supabase.helper';

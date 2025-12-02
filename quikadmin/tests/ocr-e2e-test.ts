/**
 * End-to-End OCR Test Suite
 * 
 * Tests OCR processing scenarios using sample files from sample-pdfs directory:
 * - PDF document upload and OCR processing
 * - JPEG image upload and OCR processing
 * - Document status polling
 * - Error scenarios
 * - Document reprocessing
 * - Document download
 */

import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import FormData from 'form-data';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3002';
const SAMPLE_PDFS_DIR = path.join(__dirname, '../../sample-pdfs');

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];
let authToken: string | null = null;
let testUserId: string | null = null;

// Helper to create authenticated API client
function createApiClient(token?: string): AxiosInstance {
  return axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    validateStatus: () => true,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

// Helper to log test results
function logTest(name: string, passed: boolean, error?: string, details?: any) {
  results.push({ name, passed, error, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (error) console.log(`   Error: ${error}`);
  if (details) console.log(`   Details:`, JSON.stringify(details, null, 2));
}

// Helper to authenticate and get token
async function authenticate(): Promise<boolean> {
  try {
    // Try to login with test user
    const api = createApiClient();
    const loginResponse = await api.post('/api/auth/v2/login', {
      email: 'newuser@test.com',
      password: 'Admin123!',
    });

    if (loginResponse.status === 200 && loginResponse.data.success) {
      authToken = loginResponse.data.data.tokens.accessToken;
      testUserId = loginResponse.data.data.user.id;
      logTest('Authentication', true, undefined, { userId: testUserId });
      return true;
    } else {
      // Try to register a new test user
      const registerResponse = await api.post('/api/auth/v2/register', {
        email: `ocr-test-${Date.now()}@test.com`,
        password: 'Test123!',
        fullName: 'OCR Test User',
      });

      if (registerResponse.status === 201 && registerResponse.data.success) {
        authToken = registerResponse.data.data.tokens.accessToken;
        testUserId = registerResponse.data.data.user.id;
        logTest('Authentication (via registration)', true, undefined, { userId: testUserId });
        return true;
      } else {
        logTest('Authentication', false, 'Failed to authenticate', registerResponse.data);
        return false;
      }
    }
  } catch (error: any) {
    logTest('Authentication', false, error.message);
    return false;
  }
}

// Helper to wait for document processing
async function waitForDocumentProcessing(
  api: AxiosInstance,
  documentId: string,
  maxWaitTime: number = 60000,
  pollInterval: number = 2000
): Promise<{ status: string; confidence?: number } | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await api.get(`/api/documents/${documentId}`);
      
      if (response.status === 200 && response.data.success) {
        const document = response.data.document;
        
        if (document.status === 'COMPLETED' || document.status === 'FAILED') {
          return {
            status: document.status,
            confidence: document.confidence,
          };
        }
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      // Continue polling on error
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  return null;
}

/**
 * Test 1: Upload PDF Document via /api/process/single (requires form)
 */
async function testUploadPDFDocument() {
  try {
    // Note: Using ejari.pdf as the document because passport-sample.pdf is actually a PNG image
    const pdfPath = path.join(SAMPLE_PDFS_DIR, 'ejari.pdf');
    const formPath = path.join(SAMPLE_PDFS_DIR, 'passport-sample-form.pdf');
    
    // Check if files exist
    let pdfExists = false;
    let formExists = false;
    
    try {
      await fs.access(pdfPath);
      pdfExists = true;
    } catch {
      logTest('Upload PDF Document', false, `Sample PDF not found: ${pdfPath}`);
      return null;
    }

    try {
      await fs.access(formPath);
      formExists = true;
    } catch {
      logTest('Upload PDF Document', false, `Form PDF not found: ${formPath}`);
      return null;
    }

    const api = createApiClient(authToken!);
    const formData = new FormData();

    formData.append('document', await fs.readFile(pdfPath), {
      filename: 'ejari.pdf',
      contentType: 'application/pdf',
    });

    formData.append('form', await fs.readFile(formPath), {
      filename: 'passport-sample-form.pdf',
      contentType: 'application/pdf',
    });

    const response = await api.post('/api/process/single', formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    if (response.status === 200 && response.data.success) {
      logTest('Upload PDF Document', true, undefined, {
        documentId: response.data.data.documentId,
        confidence: response.data.data.confidence,
        processingTime: response.data.data.processingTime,
      });
      return response.data.data.documentId;
    } else {
      logTest('Upload PDF Document', false, `Expected 200, got ${response.status}`, response.data);
      return null;
    }
  } catch (error: any) {
    logTest('Upload PDF Document', false, error.message);
    return null;
  }
}

/**
 * Test 2: Upload JPEG Image Document with Form (required by /api/process/single)
 */
async function testUploadJPEGImage() {
  try {
    const imagePath = path.join(SAMPLE_PDFS_DIR, 'emirated-id-sample.jpeg');
    const formPath = path.join(SAMPLE_PDFS_DIR, 'passport-sample-form.pdf');

    // Check if image file exists
    try {
      await fs.access(imagePath);
    } catch {
      logTest('Upload JPEG Image', false, `Sample file not found: ${imagePath}`);
      return null;
    }

    // Check if form file exists (required by /api/process/single)
    try {
      await fs.access(formPath);
    } catch {
      logTest('Upload JPEG Image', false, `Form PDF not found: ${formPath}`);
      return null;
    }

    const api = createApiClient(authToken!);
    const formData = new FormData();

    // Add the image as document
    formData.append('document', await fs.readFile(imagePath), {
      filename: 'emirated-id-sample.jpeg',
      contentType: 'image/jpeg',
    });

    // Add the required form file
    formData.append('form', await fs.readFile(formPath), {
      filename: 'passport-sample-form.pdf',
      contentType: 'application/pdf',
    });

    const response = await api.post('/api/process/single', formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    if (response.status === 200 && response.data.success) {
      logTest('Upload JPEG Image', true, undefined, {
        documentId: response.data.data.documentId,
      });
      return response.data.data.documentId;
    } else {
      logTest('Upload JPEG Image', false, `Expected 200, got ${response.status}`, response.data);
      return null;
    }
  } catch (error: any) {
    logTest('Upload JPEG Image', false, error.message);
    return null;
  }
}

/**
 * Test 3: Get Document Status
 */
async function testGetDocumentStatus(documentId: string | null) {
  if (!documentId) {
    logTest('Get Document Status', false, 'No document ID available');
    return false;
  }

  try {
    const api = createApiClient(authToken!);
    const response = await api.get(`/api/documents/${documentId}`);

    if (response.status === 200 && response.data.success) {
      const document = response.data.document;
      logTest('Get Document Status', true, undefined, {
        status: document.status,
        confidence: document.confidence,
        fileName: document.fileName,
      });
      return true;
    } else {
      logTest('Get Document Status', false, `Expected 200, got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    logTest('Get Document Status', false, error.message);
    return false;
  }
}

/**
 * Test 4: Poll Document Status Until Complete
 */
async function testPollDocumentStatus(documentId: string | null) {
  if (!documentId) {
    logTest('Poll Document Status', false, 'No document ID available');
    return false;
  }

  try {
    const api = createApiClient(authToken!);
    const result = await waitForDocumentProcessing(api, documentId, 120000); // 2 minutes max

    if (result && result.status === 'COMPLETED') {
      logTest('Poll Document Status', true, undefined, {
        status: result.status,
        confidence: result.confidence,
      });
      return true;
    } else if (result && result.status === 'FAILED') {
      logTest('Poll Document Status', false, 'Document processing failed', result);
      return false;
    } else {
      logTest('Poll Document Status', false, 'Document processing timeout');
      return false;
    }
  } catch (error: any) {
    logTest('Poll Document Status', false, error.message);
    return false;
  }
}

/**
 * Test 5: List All Documents
 */
async function testListDocuments() {
  try {
    const api = createApiClient(authToken!);
    const response = await api.get('/api/documents');

    if (response.status === 200 && response.data.success) {
      logTest('List Documents', true, undefined, {
        count: response.data.documents?.length || 0,
      });
      return true;
    } else {
      logTest('List Documents', false, `Expected 200, got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    logTest('List Documents', false, error.message);
    return false;
  }
}

/**
 * Test 6: Get Document Extracted Data
 */
async function testGetDocumentData(documentId: string | null) {
  if (!documentId) {
    logTest('Get Document Data', false, 'No document ID available');
    return false;
  }

  try {
    const api = createApiClient(authToken!);
    const response = await api.get(`/api/documents/${documentId}/data`);

    if (response.status === 200 && response.data.success) {
      logTest('Get Document Data', true, undefined, {
        hasData: !!response.data.data,
        fileName: response.data.fileName,
      });
      return true;
    } else if (response.status === 400 && response.data.error?.includes('not completed')) {
      logTest('Get Document Data', false, 'Document processing not completed yet', response.data);
      return false;
    } else {
      logTest('Get Document Data', false, `Expected 200, got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    logTest('Get Document Data', false, error.message);
    return false;
  }
}

/**
 * Test 7: Reprocess Document
 */
async function testReprocessDocument(documentId: string | null) {
  if (!documentId) {
    logTest('Reprocess Document', false, 'No document ID available');
    return false;
  }

  try {
    const api = createApiClient(authToken!);
    const response = await api.post(`/api/documents/${documentId}/reprocess`);

    if (response.status === 200 && response.data.success) {
      logTest('Reprocess Document', true, undefined, {
        jobId: response.data.jobId,
        statusUrl: response.data.statusUrl,
      });
      return true;
    } else {
      logTest('Reprocess Document', false, `Expected 200, got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    logTest('Reprocess Document', false, error.message);
    return false;
  }
}

/**
 * Test 8: Upload Invalid File Type
 */
async function testUploadInvalidFileType() {
  try {
    const api = createApiClient(authToken!);
    const formData = new FormData();
    
    // Create a dummy text file
    formData.append('document', Buffer.from('This is not a valid PDF'), {
      filename: 'invalid.txt',
      contentType: 'text/plain',
    });

    const response = await api.post('/api/process/single', formData, {
      headers: formData.getHeaders(),
    });

    if (response.status === 400) {
      logTest('Upload Invalid File Type', true);
      return true;
    } else {
      logTest('Upload Invalid File Type', false, `Expected 400, got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    logTest('Upload Invalid File Type', false, error.message);
    return false;
  }
}

/**
 * Test 9: Upload Without Authentication
 */
async function testUploadWithoutAuth() {
  try {
    const api = createApiClient(); // No token
    const formData = new FormData();

    // Use ejari.pdf instead of passport-sample.pdf (which is actually a PNG)
    const pdfPath = path.join(SAMPLE_PDFS_DIR, 'ejari.pdf');
    try {
      formData.append('document', await fs.readFile(pdfPath), {
        filename: 'ejari.pdf',
        contentType: 'application/pdf',
      });
    } catch {
      logTest('Upload Without Auth', false, 'Sample file not found');
      return false;
    }

    const response = await api.post('/api/process/single', formData, {
      headers: formData.getHeaders(),
    });

    if (response.status === 401) {
      logTest('Upload Without Auth', true);
      return true;
    } else {
      logTest('Upload Without Auth', false, `Expected 401, got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    logTest('Upload Without Auth', false, error.message);
    return false;
  }
}

/**
 * Test 10: Get Document Status Without Auth
 */
async function testGetStatusWithoutAuth() {
  try {
    const api = createApiClient(); // No token
    const response = await api.get('/api/documents/test-id');

    if (response.status === 401) {
      logTest('Get Status Without Auth', true);
      return true;
    } else {
      logTest('Get Status Without Auth', false, `Expected 401, got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    logTest('Get Status Without Auth', false, error.message);
    return false;
  }
}

/**
 * Test 11: Upload Large File (should fail)
 */
async function testUploadLargeFile() {
  try {
    const api = createApiClient(authToken!);
    const formData = new FormData();
    
    // Create a file larger than 10MB
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
    formData.append('document', largeBuffer, {
      filename: 'large-file.pdf',
      contentType: 'application/pdf',
    });

    const response = await api.post('/api/process/single', formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    if (response.status === 413 || response.status === 400) {
      logTest('Upload Large File', true);
      return true;
    } else {
      logTest('Upload Large File', false, `Expected 413 or 400, got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    // Network errors for large files are acceptable
    if (error.message.includes('maxContentLength') || error.message.includes('413')) {
      logTest('Upload Large File', true);
      return true;
    }
    logTest('Upload Large File', false, error.message);
    return false;
  }
}

/**
 * Test 12: Delete Document
 */
async function testDeleteDocument(documentId: string | null) {
  if (!documentId) {
    logTest('Delete Document', false, 'No document ID available');
    return false;
  }

  try {
    const api = createApiClient(authToken!);
    const response = await api.delete(`/api/documents/${documentId}`);

    if (response.status === 200 && response.data.success) {
      logTest('Delete Document', true);
      return true;
    } else {
      logTest('Delete Document', false, `Expected 200, got ${response.status}`, response.data);
      return false;
    }
  } catch (error: any) {
    logTest('Delete Document', false, error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🧪 Starting End-to-End OCR Tests\n');
  console.log('='.repeat(60));
  
  // Authenticate first
  console.log('\n🔐 Authentication');
  console.log('-'.repeat(60));
  const authenticated = await authenticate();
  if (!authenticated) {
    console.log('\n❌ Authentication failed. Cannot proceed with tests.');
    process.exit(1);
  }

  // Upload tests
  console.log('\n📤 Upload Tests');
  console.log('-'.repeat(60));
  const pdfDocumentId = await testUploadPDFDocument();
  const jpegDocumentId = await testUploadJPEGImage();
  
  // Document status tests
  console.log('\n📊 Document Status Tests');
  console.log('-'.repeat(60));
  await testGetDocumentStatus(pdfDocumentId);
  await testListDocuments();
  
  // Processing tests
  console.log('\n⚙️ Processing Tests');
  console.log('-'.repeat(60));
  if (pdfDocumentId) {
    await testPollDocumentStatus(pdfDocumentId);
    await testGetDocumentData(pdfDocumentId);
  }
  
  // Reprocessing tests
  console.log('\n🔄 Reprocessing Tests');
  console.log('-'.repeat(60));
  if (pdfDocumentId) {
    await testReprocessDocument(pdfDocumentId);
  }
  
  // Error scenario tests
  console.log('\n❌ Error Scenario Tests');
  console.log('-'.repeat(60));
  await testUploadInvalidFileType();
  await testUploadWithoutAuth();
  await testGetStatusWithoutAuth();
  await testUploadLargeFile();
  
  // Cleanup tests
  console.log('\n🧹 Cleanup Tests');
  console.log('-'.repeat(60));
  if (pdfDocumentId) {
    await testDeleteDocument(pdfDocumentId);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary');
  console.log('-'.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}`);
      if (r.error) console.log(`     Error: ${r.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

export { runAllTests };


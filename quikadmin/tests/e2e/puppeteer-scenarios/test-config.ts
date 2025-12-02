/**
 * Puppeteer Test Configuration for IntelliFill
 * Uses Puppeteer MCP for browser automation
 */

export const TEST_CONFIG = {
  // Application URLs
  urls: {
    base: process.env.TEST_URL || 'http://localhost:3001',
    api: process.env.API_URL || 'http://localhost:3000/api',
  },

  // Test User Credentials
  users: {
    admin: {
      email: 'admin@intellifill.test',
      password: 'AdminPass123!',
      role: 'admin'
    },
    standard: {
      email: 'user@intellifill.test',
      password: 'UserPass123!',
      role: 'user'
    },
    newUser: {
      email: 'newuser@intellifill.test',
      password: 'NewUser123!',
      firstName: 'Test',
      lastName: 'User'
    }
  },

  // Browser Configuration
  browser: {
    debugPort: 9222,
    headless: process.env.HEADLESS !== 'false',
    slowMo: parseInt(process.env.SLOW_MO || '0'),
    defaultTimeout: 30000
  },

  // Test Data Paths
  testData: {
    samplePDF: './tests/fixtures/sample-invoice.pdf',
    sampleForm: './tests/fixtures/tax-form.pdf',
    largeFile: './tests/fixtures/large-document.pdf',
    invalidFile: './tests/fixtures/invalid.txt'
  },

  // Selectors
  selectors: {
    // Auth selectors
    auth: {
      emailInput: 'input[name="email"]',
      passwordInput: 'input[name="password"]',
      loginButton: 'button[type="submit"]',
      signupLink: 'a[href="/signup"]',
      logoutButton: 'button[data-testid="logout"]',
      userMenu: '[data-testid="user-menu"]'
    },
    
    // Navigation selectors
    nav: {
      dashboard: 'a[href="/dashboard"]',
      upload: 'a[href="/upload"]',
      history: 'a[href="/history"]',
      templates: 'a[href="/templates"]',
      settings: 'a[href="/settings"]'
    },
    
    // Upload selectors
    upload: {
      dropzone: '[data-testid="file-dropzone"]',
      fileInput: 'input[type="file"]',
      uploadButton: 'button[data-testid="upload-btn"]',
      progressBar: '[role="progressbar"]',
      successMessage: '[data-testid="upload-success"]',
      errorMessage: '[data-testid="upload-error"]'
    },
    
    // Document selectors
    document: {
      documentList: '[data-testid="document-list"]',
      documentRow: '[data-testid="document-row"]',
      viewButton: 'button[data-testid="view-doc"]',
      downloadButton: 'button[data-testid="download-doc"]',
      deleteButton: 'button[data-testid="delete-doc"]',
      statusBadge: '[data-testid="status-badge"]'
    },
    
    // Form selectors
    form: {
      fieldInput: 'input[data-field]',
      selectField: 'select[data-field]',
      checkboxField: 'input[type="checkbox"][data-field]',
      submitButton: 'button[data-testid="submit-form"]',
      validationError: '[data-testid="field-error"]'
    }
  },

  // Wait times (ms)
  waits: {
    short: 1000,
    medium: 3000,
    long: 5000,
    upload: 10000
  },

  // Test messages
  messages: {
    loginSuccess: 'Successfully logged in',
    uploadSuccess: 'Document uploaded successfully',
    processingComplete: 'Processing completed',
    formFilled: 'Form filled successfully',
    documentDeleted: 'Document deleted',
    errorGeneric: 'An error occurred'
  }
};

// Export type definitions
export type TestUser = typeof TEST_CONFIG.users.admin;
export type Selectors = typeof TEST_CONFIG.selectors;
export type TestUrls = typeof TEST_CONFIG.urls;
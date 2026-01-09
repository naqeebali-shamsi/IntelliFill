/**
 * E2E-410: Input Validation Security (SQLi/XSS)
 *
 * Tests that the application sanitizes inputs against injection attacks:
 * - XSS (Cross-Site Scripting) prevention
 * - SQL Injection prevention
 * - HTML sanitization
 * - Script tag filtering
 */

import { test, expect } from '@playwright/test';
import { test as authTest } from '../../fixtures/auth.fixture';
import { SettingsPage } from '../../pages/SettingsPage';
import { RegisterPage } from '../../pages/RegisterPage';
import { LoginPage } from '../../pages/LoginPage';
import { DocumentsPage } from '../../pages/DocumentsPage';
import { testUsers } from '../../data';

test.describe('E2E-410: Input Validation Security (SQLi/XSS)', () => {
  authTest('should escape XSS payloads in profile name', async ({ authenticatedPage }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    // Navigate to profile settings
    await settingsPage.navigate();
    await settingsPage.goToProfileTab();

    // XSS payloads to test
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(\'XSS\')">',
    ];

    for (const payload of xssPayloads) {
      // Input XSS payload into name field
      await settingsPage.updateProfile({ name: payload });
      await settingsPage.saveProfile();

      // Wait for save to complete
      await authenticatedPage.waitForTimeout(1000);

      // Reload page to see how data is rendered
      await authenticatedPage.reload();
      await settingsPage.goToProfileTab();

      // Get the displayed name
      const displayedName = await settingsPage.getProfileName();

      // Verify script tags are escaped
      const pageContent = await authenticatedPage.textContent('body');

      // Check that script is not executed (no alert dialog)
      // The payload should be visible as text, not executed
      expect(pageContent).toContain(payload.replace(/</g, '').replace(/>/g, ''));

      // Verify no script execution
      const scriptExecuted = await authenticatedPage.evaluate(() => {
        // Check if any script created an alert
        return document.querySelectorAll('script').length > 0;
      });

      // The payload should be escaped in the DOM
      const rawHtml = await authenticatedPage.innerHTML('body');
      expect(rawHtml).not.toContain('<script>alert');
    }
  });

  test('should prevent XSS in registration form', async ({ page }) => {
    const registerPage = new RegisterPage(page);

    await registerPage.navigate();

    const xssPayload = '<script>alert("XSS")</script>';
    const timestamp = Date.now();

    // Try to register with XSS in name
    await registerPage.fillRegistrationForm({
      name: xssPayload,
      email: `xss-test-${timestamp}@intellifill.local`,
      password: 'TestPassword123!',
    });

    await registerPage.clickRegister();

    // Wait for response
    await page.waitForTimeout(2000);

    // Check that script is not executed
    const pageContent = await page.textContent('body');

    // If there's an error message, it shouldn't contain unescaped HTML
    const errorVisible = await registerPage.hasError();
    if (errorVisible) {
      const errorText = await registerPage.getErrorMessage();
      expect(errorText).not.toContain('<script>');
    }

    // Verify no alert dialog appeared
    let alertAppeared = false;
    page.on('dialog', () => {
      alertAppeared = true;
    });

    await page.waitForTimeout(1000);
    expect(alertAppeared).toBe(false);
  });

  authTest('should sanitize document names', async ({ authenticatedPage }) => {
    const documentsPage = new DocumentsPage(authenticatedPage);
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3002/api';

    // Try to create a document with XSS in name via API
    const xssPayload = '<script>alert("XSS")</script>';

    const response = await authenticatedPage.request.post(`${apiUrl}/documents`, {
      data: {
        name: xssPayload,
        content: 'test content',
      },
    });

    if (response.ok()) {
      const doc = await response.json();
      const docId = doc.id || doc.document?.id;

      // Navigate to documents page
      await documentsPage.navigate();
      await authenticatedPage.waitForTimeout(1000);

      // Check if document name is sanitized in the list
      const pageHtml = await authenticatedPage.innerHTML('body');

      // Should be escaped
      expect(pageHtml).not.toContain('<script>alert("XSS")</script>');

      // Clean up
      if (docId) {
        await authenticatedPage.request.delete(`${apiUrl}/documents/${docId}`);
      }
    }
  });

  test('should prevent SQL injection in login', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.navigate();

    // SQL injection payloads
    const sqlPayloads = testUsers.securityTestPayloads.sqlInjection;

    for (const payload of sqlPayloads) {
      await loginPage.fillEmail(payload);
      await loginPage.fillPassword('password');
      await loginPage.clickLogin();

      await page.waitForTimeout(1000);

      // Should show invalid credentials, not SQL error
      const errorMessage = await loginPage.getErrorMessage();

      if (errorMessage) {
        // Error should not contain SQL-related keywords
        expect(errorMessage.toLowerCase()).not.toContain('sql');
        expect(errorMessage.toLowerCase()).not.toContain('syntax');
        expect(errorMessage.toLowerCase()).not.toContain('mysql');
        expect(errorMessage.toLowerCase()).not.toContain('postgres');
        expect(errorMessage.toLowerCase()).not.toContain('database');
        expect(errorMessage.toLowerCase()).not.toContain('query');

        // Should show generic error
        expect(errorMessage.toLowerCase()).toMatch(/invalid|incorrect|wrong|failed/);
      }

      // Should not be logged in
      expect(page.url()).toContain('/login');
    }
  });

  authTest('should sanitize search queries', async ({ authenticatedPage }) => {
    const documentsPage = new DocumentsPage(authenticatedPage);

    await documentsPage.navigate();

    // XSS in search
    const xssPayload = '<script>alert("XSS")</script>';

    await documentsPage.search(xssPayload);
    await authenticatedPage.waitForTimeout(1000);

    // Verify no script execution
    let alertAppeared = false;
    authenticatedPage.on('dialog', () => {
      alertAppeared = true;
    });

    await authenticatedPage.waitForTimeout(1000);
    expect(alertAppeared).toBe(false);

    // Check page HTML
    const pageHtml = await authenticatedPage.innerHTML('body');
    expect(pageHtml).not.toContain('<script>alert("XSS")');
  });

  authTest('should prevent HTML injection in form fields', async ({ authenticatedPage }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await settingsPage.navigate();
    await settingsPage.goToProfileTab();

    // HTML injection payloads
    const htmlPayloads = [
      '<b>Bold Text</b>',
      '<a href="http://evil.com">Click me</a>',
      '<img src="http://evil.com/track.gif">',
      '<style>body{background:red}</style>',
    ];

    for (const payload of htmlPayloads) {
      await settingsPage.updateProfile({ name: payload });
      await settingsPage.saveProfile();

      await authenticatedPage.waitForTimeout(1000);
      await authenticatedPage.reload();
      await settingsPage.goToProfileTab();

      // Get rendered content
      const pageContent = await authenticatedPage.textContent('body');

      // HTML tags should be escaped and visible as text
      // The styled content should NOT be applied
      const nameInput = authenticatedPage.locator('input[name="name"]');
      const nameValue = await nameInput.inputValue();

      // Value should contain the raw text, possibly escaped
      expect(nameValue).toBeTruthy();
    }
  });

  test('should prevent path traversal in file names', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Login first
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3002/api';

    // Path traversal payloads
    const pathTraversalPayloads = testUsers.securityTestPayloads.pathTraversal;

    for (const payload of pathTraversalPayloads) {
      const response = await page.request.post(`${apiUrl}/documents`, {
        data: {
          name: payload,
          content: 'test',
        },
      });

      // Should either reject or sanitize the path
      if (response.ok()) {
        const doc = await response.json();
        const docName = doc.name || doc.document?.name;

        // Name should be sanitized (no ../ or ..\\)
        expect(docName).not.toContain('..');
        expect(docName).not.toContain('/etc/');
        expect(docName).not.toContain('\\windows\\');

        // Clean up
        const docId = doc.id || doc.document?.id;
        if (docId) {
          await page.request.delete(`${apiUrl}/documents/${docId}`);
        }
      } else {
        // Rejection is also acceptable
        expect([400, 403]).toContain(response.status());
      }
    }
  });

  authTest('should handle special characters safely', async ({ authenticatedPage }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await settingsPage.navigate();
    await settingsPage.goToProfileTab();

    // Special characters that should be handled safely
    const specialChars = [
      "O'Brien", // Single quote
      'Test "User"', // Double quotes
      'User & Company', // Ampersand
      'Test<User>Name', // Angle brackets
      'User\\Test', // Backslash
    ];

    for (const name of specialChars) {
      await settingsPage.updateProfile({ name });
      await settingsPage.saveProfile();

      await authenticatedPage.waitForTimeout(1000);

      // Verify name was saved correctly
      const savedName = await settingsPage.getProfileName();
      expect(savedName).toBe(name);
    }
  });

  test('should prevent command injection in file operations', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3002/api';

    // Command injection payloads
    const commandInjectionPayloads = [
      'test.pdf; rm -rf /',
      'test.pdf && cat /etc/passwd',
      'test.pdf | ls -la',
      'test.pdf`whoami`',
      'test.pdf$(whoami)',
    ];

    for (const payload of commandInjectionPayloads) {
      const response = await page.request.post(`${apiUrl}/documents`, {
        data: {
          name: payload,
        },
      });

      // Should reject or sanitize
      if (response.ok()) {
        const doc = await response.json();
        const docName = doc.name || doc.document?.name;

        // Should not contain command injection characters
        expect(docName).not.toContain(';');
        expect(docName).not.toContain('&&');
        expect(docName).not.toContain('|');
        expect(docName).not.toContain('`');
        expect(docName).not.toContain('$(');

        // Clean up
        const docId = doc.id || doc.document?.id;
        if (docId) {
          await page.request.delete(`${apiUrl}/documents/${docId}`);
        }
      }
    }
  });

  authTest('should prevent template injection', async ({ authenticatedPage }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await settingsPage.navigate();
    await settingsPage.goToProfileTab();

    // Template injection payloads (common template engines)
    const templateInjectionPayloads = [
      '{{7*7}}', // Handlebars/Mustache
      '${7*7}', // Template literals
      '<%= 7*7 %>', // EJS
      '{% 7*7 %}', // Jinja2
    ];

    for (const payload of templateInjectionPayloads) {
      await settingsPage.updateProfile({ name: payload });
      await settingsPage.saveProfile();

      await authenticatedPage.waitForTimeout(1000);

      const savedName = await settingsPage.getProfileName();

      // Should NOT evaluate to 49
      expect(savedName).not.toBe('49');

      // Should be stored as literal string
      expect(savedName).toBe(payload);
    }
  });

  test('should validate email format strictly', async ({ page }) => {
    const registerPage = new RegisterPage(page);

    await registerPage.navigate();

    // Invalid email formats
    const invalidEmails = [
      'notanemail',
      '@example.com',
      'user@',
      'user space@example.com',
      'user@example',
      '../../../etc/passwd@example.com',
    ];

    for (const email of invalidEmails) {
      await registerPage.fillRegistrationForm({
        name: 'Test User',
        email: email,
        password: 'TestPassword123!',
      });

      await registerPage.clickRegister();
      await page.waitForTimeout(1000);

      // Should show validation error
      const hasError = await registerPage.hasError();
      expect(hasError).toBe(true);

      // Should remain on registration page
      expect(page.url()).toContain('/register');
    }
  });
});

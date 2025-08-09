/**
 * Authentication Test Scenarios
 * Tests user registration, login, logout, and session management
 */

import { PuppeteerTestHelpers as Helper } from './test-helpers';
import { TEST_CONFIG } from './test-config';

describe('Authentication Test Suite', () => {
  
  beforeAll(async () => {
    // Connect to browser before running tests
    await Helper.connectToBrowser();
  });

  beforeEach(async () => {
    // Clear browser data before each test
    await Helper.clearBrowserData();
    await Helper.navigateToPage(TEST_CONFIG.urls.base);
  });

  describe('User Registration', () => {
    test('Should successfully register a new user', async () => {
      // Navigate to signup page
      await Helper.clickElement(TEST_CONFIG.selectors.auth.signupLink);
      
      // Fill registration form
      await Helper.fillField('input[name="firstName"]', TEST_CONFIG.users.newUser.firstName);
      await Helper.fillField('input[name="lastName"]', TEST_CONFIG.users.newUser.lastName);
      await Helper.fillField('input[name="email"]', TEST_CONFIG.users.newUser.email);
      await Helper.fillField('input[name="password"]', TEST_CONFIG.users.newUser.password);
      await Helper.fillField('input[name="confirmPassword"]', TEST_CONFIG.users.newUser.password);
      
      // Submit form
      await Helper.clickElement('button[type="submit"]', true);
      
      // Verify successful registration
      await Helper.waitForElement(TEST_CONFIG.selectors.nav.dashboard);
      const dashboardExists = await Helper.elementExists(TEST_CONFIG.selectors.nav.dashboard);
      expect(dashboardExists).toBe(true);
      
      // Take screenshot for evidence
      await Helper.takeScreenshot('registration-success');
    });

    test('Should show error for duplicate email', async () => {
      await Helper.clickElement(TEST_CONFIG.selectors.auth.signupLink);
      
      // Try to register with existing email
      await Helper.fillField('input[name="firstName"]', 'Duplicate');
      await Helper.fillField('input[name="lastName"]', 'User');
      await Helper.fillField('input[name="email"]', TEST_CONFIG.users.standard.email);
      await Helper.fillField('input[name="password"]', 'Password123!');
      await Helper.fillField('input[name="confirmPassword"]', 'Password123!');
      
      await Helper.clickElement('button[type="submit"]');
      
      // Check for error message
      await Helper.waitForText('Email already exists');
      await Helper.takeScreenshot('duplicate-email-error');
    });

    test('Should validate password requirements', async () => {
      await Helper.clickElement(TEST_CONFIG.selectors.auth.signupLink);
      
      // Try weak password
      await Helper.fillField('input[name="password"]', 'weak');
      await Helper.fillField('input[name="email"]', 'test@example.com');
      
      // Check for validation message
      const validationError = await Helper.waitForElement('[data-testid="password-error"]');
      expect(validationError).toBeTruthy();
      
      await Helper.takeScreenshot('password-validation');
    });
  });

  describe('User Login', () => {
    test('Should successfully login with valid credentials', async () => {
      await Helper.navigateToPage(`${TEST_CONFIG.urls.base}/login`);
      
      // Login with standard user
      await Helper.fillField(TEST_CONFIG.selectors.auth.emailInput, TEST_CONFIG.users.standard.email);
      await Helper.fillField(TEST_CONFIG.selectors.auth.passwordInput, TEST_CONFIG.users.standard.password);
      await Helper.clickElement(TEST_CONFIG.selectors.auth.loginButton, true);
      
      // Verify successful login
      await Helper.waitForElement(TEST_CONFIG.selectors.nav.dashboard);
      const userMenuExists = await Helper.elementExists(TEST_CONFIG.selectors.auth.userMenu);
      expect(userMenuExists).toBe(true);
      
      await Helper.takeScreenshot('login-success');
    });

    test('Should show error for invalid credentials', async () => {
      await Helper.navigateToPage(`${TEST_CONFIG.urls.base}/login`);
      
      // Try invalid credentials
      await Helper.fillField(TEST_CONFIG.selectors.auth.emailInput, 'invalid@email.com');
      await Helper.fillField(TEST_CONFIG.selectors.auth.passwordInput, 'wrongpassword');
      await Helper.clickElement(TEST_CONFIG.selectors.auth.loginButton);
      
      // Check for error message
      await Helper.waitForText('Invalid email or password');
      await Helper.takeScreenshot('login-error');
    });

    test('Should handle empty form submission', async () => {
      await Helper.navigateToPage(`${TEST_CONFIG.urls.base}/login`);
      
      // Try to submit empty form
      await Helper.clickElement(TEST_CONFIG.selectors.auth.loginButton);
      
      // Check for validation errors
      const emailError = await Helper.elementExists('[data-testid="email-error"]');
      const passwordError = await Helper.elementExists('[data-testid="password-error"]');
      
      expect(emailError).toBe(true);
      expect(passwordError).toBe(true);
      
      await Helper.takeScreenshot('login-validation');
    });

    test('Should remember user with "Remember Me" option', async () => {
      await Helper.navigateToPage(`${TEST_CONFIG.urls.base}/login`);
      
      // Login with remember me checked
      await Helper.fillField(TEST_CONFIG.selectors.auth.emailInput, TEST_CONFIG.users.standard.email);
      await Helper.fillField(TEST_CONFIG.selectors.auth.passwordInput, TEST_CONFIG.users.standard.password);
      await Helper.clickElement('input[name="rememberMe"]');
      await Helper.clickElement(TEST_CONFIG.selectors.auth.loginButton, true);
      
      // Verify login
      await Helper.waitForElement(TEST_CONFIG.selectors.nav.dashboard);
      
      // Close and reopen browser (simulate)
      await Helper.navigateToPage(TEST_CONFIG.urls.base);
      
      // Should still be logged in
      const userMenuExists = await Helper.elementExists(TEST_CONFIG.selectors.auth.userMenu);
      expect(userMenuExists).toBe(true);
    });
  });

  describe('User Logout', () => {
    test('Should successfully logout', async () => {
      // First login
      await Helper.login(TEST_CONFIG.users.standard.email, TEST_CONFIG.users.standard.password);
      
      // Then logout
      await Helper.logout();
      
      // Verify logout
      await Helper.waitForElement(TEST_CONFIG.selectors.auth.loginButton);
      const loginButtonExists = await Helper.elementExists(TEST_CONFIG.selectors.auth.loginButton);
      expect(loginButtonExists).toBe(true);
      
      await Helper.takeScreenshot('logout-success');
    });

    test('Should clear session on logout', async () => {
      // Login
      await Helper.login(TEST_CONFIG.users.standard.email, TEST_CONFIG.users.standard.password);
      
      // Navigate to protected page
      await Helper.navigateToPage(`${TEST_CONFIG.urls.base}/dashboard`);
      let dashboardAccessible = await Helper.elementExists(TEST_CONFIG.selectors.nav.dashboard);
      expect(dashboardAccessible).toBe(true);
      
      // Logout
      await Helper.logout();
      
      // Try to access protected page
      await Helper.navigateToPage(`${TEST_CONFIG.urls.base}/dashboard`);
      
      // Should be redirected to login
      await Helper.waitForElement(TEST_CONFIG.selectors.auth.loginButton);
      const onLoginPage = await Helper.elementExists(TEST_CONFIG.selectors.auth.loginButton);
      expect(onLoginPage).toBe(true);
    });
  });

  describe('Password Reset', () => {
    test('Should send password reset email', async () => {
      await Helper.navigateToPage(`${TEST_CONFIG.urls.base}/login`);
      
      // Click forgot password link
      await Helper.clickElement('a[href="/forgot-password"]');
      
      // Enter email
      await Helper.fillField('input[name="email"]', TEST_CONFIG.users.standard.email);
      await Helper.clickElement('button[type="submit"]');
      
      // Check for success message
      await Helper.waitForText('Password reset email sent');
      await Helper.takeScreenshot('password-reset-sent');
    });

    test('Should show error for non-existent email', async () => {
      await Helper.navigateToPage(`${TEST_CONFIG.urls.base}/forgot-password`);
      
      // Enter non-existent email
      await Helper.fillField('input[name="email"]', 'nonexistent@example.com');
      await Helper.clickElement('button[type="submit"]');
      
      // Check for error message
      await Helper.waitForText('Email not found');
      await Helper.takeScreenshot('password-reset-error');
    });
  });

  describe('Session Management', () => {
    test('Should timeout inactive sessions', async () => {
      // Login
      await Helper.login(TEST_CONFIG.users.standard.email, TEST_CONFIG.users.standard.password);
      
      // Wait for session timeout (simulate with shorter time for testing)
      await Helper.wait(5000);
      
      // Try to perform action
      await Helper.clickElement(TEST_CONFIG.selectors.nav.upload);
      
      // Should be redirected to login
      await Helper.waitForText('Session expired. Please login again.');
      await Helper.takeScreenshot('session-timeout');
    });

    test('Should refresh token before expiry', async () => {
      // Login
      await Helper.login(TEST_CONFIG.users.standard.email, TEST_CONFIG.users.standard.password);
      
      // Perform actions periodically
      for (let i = 0; i < 3; i++) {
        await Helper.wait(2000);
        await Helper.clickElement(TEST_CONFIG.selectors.nav.dashboard);
      }
      
      // Should still be logged in
      const userMenuExists = await Helper.elementExists(TEST_CONFIG.selectors.auth.userMenu);
      expect(userMenuExists).toBe(true);
    });
  });

  describe('Role-Based Access', () => {
    test('Admin should access admin panel', async () => {
      // Login as admin
      await Helper.login(TEST_CONFIG.users.admin.email, TEST_CONFIG.users.admin.password);
      
      // Navigate to admin panel
      await Helper.navigateToPage(`${TEST_CONFIG.urls.base}/admin`);
      
      // Should see admin dashboard
      await Helper.waitForElement('[data-testid="admin-dashboard"]');
      const adminDashboard = await Helper.elementExists('[data-testid="admin-dashboard"]');
      expect(adminDashboard).toBe(true);
      
      await Helper.takeScreenshot('admin-access');
    });

    test('Standard user should not access admin panel', async () => {
      // Login as standard user
      await Helper.login(TEST_CONFIG.users.standard.email, TEST_CONFIG.users.standard.password);
      
      // Try to navigate to admin panel
      await Helper.navigateToPage(`${TEST_CONFIG.urls.base}/admin`);
      
      // Should see access denied or be redirected
      await Helper.waitForText('Access denied');
      await Helper.takeScreenshot('admin-access-denied');
    });
  });
});
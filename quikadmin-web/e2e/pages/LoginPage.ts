/**
 * Login Page Object Model
 *
 * Encapsulates all login page interactions:
 * - Email/password input
 * - Login submission
 * - Error handling
 * - Forgot password link
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Login credentials interface
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Login Page Object Model
 */
export class LoginPage extends BasePage {
  // Page URL
  readonly path = '/login';

  // Selectors
  readonly selectors = {
    // Form elements
    emailInput: '[data-testid="email-input"], input[type="email"], input[name="email"]',
    passwordInput: '[data-testid="password-input"], input[type="password"], input[name="password"]',
    submitButton: '[data-testid="login-button"], button[type="submit"]',

    // Links
    forgotPasswordLink: '[data-testid="forgot-password"], a:has-text("Forgot password")',
    registerLink: '[data-testid="register-link"], a:has-text("Sign up"), a:has-text("Register"), a:has-text("Create account")',

    // Error messages
    errorMessage: '[data-testid="error-message"], [role="alert"], .error-message',
    fieldError: '[data-testid="field-error"], .field-error, [aria-invalid="true"] ~ span',

    // Loading state
    loadingIndicator: '[data-testid="loading"], button[disabled]',

    // OAuth buttons (discovered from GoogleAuthButton.tsx which uses data-testid)
    googleSignInButton: '[data-testid="google-login-button"], button:has-text("Google")',
    githubSignInButton: '[data-testid="github-login-button"], button:has-text("GitHub")',
    azureSignInButton: '[data-testid="azure-login-button"], button:has-text("Microsoft")',
    appleSignInButton: '[data-testid="apple-login-button"], button:has-text("Apple")',

    // OAuth divider (the "or" separator between form and social login)
    oauthDivider: '[data-testid="oauth-divider"], .divider, :text("or")',
  };

  constructor(page: Page) {
    super(page);
  }

  // ========== Element Locators ==========

  get emailInput(): Locator {
    return this.page.locator(this.selectors.emailInput);
  }

  get passwordInput(): Locator {
    return this.page.locator(this.selectors.passwordInput);
  }

  get submitButton(): Locator {
    return this.page.locator(this.selectors.submitButton);
  }

  get forgotPasswordLink(): Locator {
    return this.page.locator(this.selectors.forgotPasswordLink);
  }

  get registerLink(): Locator {
    return this.page.locator(this.selectors.registerLink);
  }

  get errorMessage(): Locator {
    return this.page.locator(this.selectors.errorMessage);
  }

  get googleSignInButton(): Locator {
    return this.page.locator(this.selectors.googleSignInButton);
  }

  get githubSignInButton(): Locator {
    return this.page.locator(this.selectors.githubSignInButton);
  }

  get azureSignInButton(): Locator {
    return this.page.locator(this.selectors.azureSignInButton);
  }

  get appleSignInButton(): Locator {
    return this.page.locator(this.selectors.appleSignInButton);
  }

  // ========== Navigation ==========

  /**
   * Navigate to login page
   */
  async navigate(): Promise<void> {
    await this.goto(this.path);
  }

  /**
   * Navigate to forgot password page
   */
  async goToForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
    await this.waitForNavigation();
  }

  /**
   * Navigate to registration page
   */
  async goToRegister(): Promise<void> {
    await this.registerLink.click();
    await this.waitForNavigation();
  }

  // ========== OAuth Methods ==========

  /**
   * Click Google Sign In button
   */
  async clickGoogleSignIn(): Promise<void> {
    await this.googleSignInButton.click();
  }

  /**
   * Click GitHub Sign In button
   */
  async clickGithubSignIn(): Promise<void> {
    await this.githubSignInButton.click();
  }

  /**
   * Click Azure/Microsoft Sign In button
   */
  async clickAzureSignIn(): Promise<void> {
    await this.azureSignInButton.click();
  }

  /**
   * Click Apple Sign In button
   */
  async clickAppleSignIn(): Promise<void> {
    await this.appleSignInButton.click();
  }

  /**
   * Check if OAuth buttons are visible
   */
  async hasOAuthButtons(): Promise<boolean> {
    // At least Google should be visible if OAuth is enabled
    return await this.googleSignInButton.isVisible();
  }

  /**
   * Assert Google Sign In button is visible
   */
  async assertGoogleSignInVisible(): Promise<void> {
    await expect(this.googleSignInButton).toBeVisible();
  }

  // ========== Form Interactions ==========

  /**
   * Fill email field
   */
  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  /**
   * Fill password field
   */
  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  /**
   * Fill login form with credentials
   */
  async fillLoginForm(credentials: LoginCredentials): Promise<void> {
    await this.fillEmail(credentials.email);
    await this.fillPassword(credentials.password);
  }

  /**
   * Click login button
   */
  async clickLogin(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Perform complete login action
   */
  async login(credentials: LoginCredentials): Promise<void> {
    await this.fillLoginForm(credentials);
    await this.clickLogin();
  }

  /**
   * Login and wait for success (dashboard navigation)
   */
  async loginAndWaitForSuccess(credentials: LoginCredentials): Promise<void> {
    await this.login(credentials);
    await this.waitForNavigation();
    // Wait for redirect to dashboard or home
    await expect(this.page).not.toHaveURL(/\/login/);
  }

  /**
   * Login and expect error
   */
  async loginAndExpectError(credentials: LoginCredentials): Promise<string> {
    await this.login(credentials);
    await expect(this.errorMessage).toBeVisible();
    return (await this.errorMessage.textContent()) || '';
  }

  // ========== Validation ==========

  /**
   * Check if login form is displayed
   */
  async isLoginFormVisible(): Promise<boolean> {
    return await this.emailInput.isVisible() &&
           await this.passwordInput.isVisible() &&
           await this.submitButton.isVisible();
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return await this.errorMessage.textContent();
    }
    return null;
  }

  /**
   * Check if error message is displayed
   */
  async hasError(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }

  /**
   * Get field-specific error message
   */
  async getFieldError(fieldName: 'email' | 'password'): Promise<string | null> {
    const field = fieldName === 'email' ? this.emailInput : this.passwordInput;
    const errorSelector = `${this.selectors.fieldError}`;
    const fieldError = field.locator('..').locator(errorSelector);

    if (await fieldError.isVisible()) {
      return await fieldError.textContent();
    }
    return null;
  }

  /**
   * Check if form is loading
   */
  async isLoading(): Promise<boolean> {
    return await this.submitButton.isDisabled();
  }

  // ========== Assertions ==========

  /**
   * Assert login form is visible
   */
  async assertFormVisible(): Promise<void> {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /**
   * Assert login error is displayed
   */
  async assertErrorDisplayed(expectedMessage?: string | RegExp): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (expectedMessage) {
      await expect(this.errorMessage).toHaveText(expectedMessage);
    }
  }

  /**
   * Assert user is redirected after login
   */
  async assertRedirectedToDashboard(): Promise<void> {
    await expect(this.page).toHaveURL(/\/(dashboard|home|$)/);
  }

  /**
   * Assert email field has validation error
   */
  async assertEmailError(): Promise<void> {
    await expect(this.emailInput).toHaveAttribute('aria-invalid', 'true');
  }

  /**
   * Assert password field has validation error
   */
  async assertPasswordError(): Promise<void> {
    await expect(this.passwordInput).toHaveAttribute('aria-invalid', 'true');
  }

  // ========== Security Testing ==========

  /**
   * Attempt login with SQL injection payload
   */
  async testSqlInjection(payload: string): Promise<void> {
    await this.fillEmail(payload);
    await this.fillPassword('password');
    await this.clickLogin();
  }

  /**
   * Attempt login with XSS payload
   */
  async testXssPayload(payload: string): Promise<void> {
    await this.fillEmail(payload);
    await this.fillPassword('password');
    await this.clickLogin();
  }

  /**
   * Verify no script execution occurred
   */
  async verifyNoScriptExecution(): Promise<boolean> {
    // Check if any alert dialog appeared (XSS indicator)
    const dialogPromise = this.page.waitForEvent('dialog', { timeout: 1000 })
      .then(() => true)
      .catch(() => false);

    return !(await dialogPromise);
  }

  /**
   * Check that error message doesn't contain sensitive info
   */
  async assertNoSensitiveInfoInError(): Promise<void> {
    const errorText = await this.getErrorMessage();
    if (errorText) {
      // Should not contain stack traces or SQL errors
      expect(errorText.toLowerCase()).not.toContain('stack');
      expect(errorText.toLowerCase()).not.toContain('sql');
      expect(errorText.toLowerCase()).not.toContain('exception');
      expect(errorText.toLowerCase()).not.toContain('error at');
    }
  }
}

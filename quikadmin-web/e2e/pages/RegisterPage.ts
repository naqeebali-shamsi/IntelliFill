/**
 * Register Page Object Model
 *
 * Encapsulates all registration page interactions:
 * - Form filling
 * - Validation
 * - Terms acceptance
 * - Registration submission
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Registration data interface
 */
export interface RegistrationData {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
  acceptTerms?: boolean;
  organizationName?: string;
}

/**
 * Register Page Object Model
 */
export class RegisterPage extends BasePage {
  // Page URL
  readonly path = '/register';

  // Selectors
  readonly selectors = {
    // Form inputs
    nameInput: '[data-testid="name-input"], input[name="name"], input[placeholder*="name" i]',
    emailInput: '[data-testid="email-input"], input[type="email"], input[name="email"]',
    passwordInput: '[data-testid="password-input"], input[type="password"][name="password"], input[placeholder*="password" i]:not([name="confirmPassword"])',
    confirmPasswordInput: '[data-testid="confirm-password-input"], input[name="confirmPassword"], input[placeholder*="confirm" i]',
    organizationInput: '[data-testid="organization-input"], input[name="organization"], input[name="organizationName"]',

    // Checkboxes
    termsCheckbox: '[data-testid="terms-checkbox"], input[type="checkbox"][name="acceptTerms"], input[type="checkbox"][name="terms"]',

    // Buttons
    submitButton: '[data-testid="register-button"], button[type="submit"]',

    // Links
    loginLink: '[data-testid="login-link"], a:has-text("Sign in"), a:has-text("Login"), a:has-text("Already have")',
    termsLink: 'a:has-text("Terms"), a:has-text("terms of service")',
    privacyLink: 'a:has-text("Privacy"), a:has-text("privacy policy")',

    // Messages
    errorMessage: '[data-testid="error-message"], [role="alert"], .error-message',
    successMessage: '[data-testid="success-message"], .success-message',
    fieldError: '[data-testid="field-error"], .field-error, .text-red-500, [aria-invalid="true"] ~ span',

    // Password strength
    passwordStrength: '[data-testid="password-strength"], .password-strength',

    // OAuth buttons (for social sign up)
    googleSignUpButton: '[data-testid="google-register-button"], [data-testid="google-signup-button"], button:has-text("Google")',
    githubSignUpButton: '[data-testid="github-register-button"], [data-testid="github-signup-button"], button:has-text("GitHub")',
    azureSignUpButton: '[data-testid="azure-register-button"], [data-testid="azure-signup-button"], button:has-text("Microsoft")',
    appleSignUpButton: '[data-testid="apple-register-button"], [data-testid="apple-signup-button"], button:has-text("Apple")',

    // OAuth divider
    oauthDivider: '[data-testid="oauth-divider"], .divider, :text("or")',
  };

  constructor(page: Page) {
    super(page);
  }

  // ========== Element Locators ==========

  get nameInput(): Locator {
    return this.page.locator(this.selectors.nameInput);
  }

  get emailInput(): Locator {
    return this.page.locator(this.selectors.emailInput);
  }

  get passwordInput(): Locator {
    return this.page.locator(this.selectors.passwordInput).first();
  }

  get confirmPasswordInput(): Locator {
    return this.page.locator(this.selectors.confirmPasswordInput);
  }

  get organizationInput(): Locator {
    return this.page.locator(this.selectors.organizationInput);
  }

  get termsCheckbox(): Locator {
    return this.page.locator(this.selectors.termsCheckbox);
  }

  get submitButton(): Locator {
    return this.page.locator(this.selectors.submitButton);
  }

  get loginLink(): Locator {
    return this.page.locator(this.selectors.loginLink);
  }

  get errorMessage(): Locator {
    return this.page.locator(this.selectors.errorMessage);
  }

  get successMessage(): Locator {
    return this.page.locator(this.selectors.successMessage);
  }

  get googleSignUpButton(): Locator {
    return this.page.locator(this.selectors.googleSignUpButton);
  }

  get githubSignUpButton(): Locator {
    return this.page.locator(this.selectors.githubSignUpButton);
  }

  get azureSignUpButton(): Locator {
    return this.page.locator(this.selectors.azureSignUpButton);
  }

  get appleSignUpButton(): Locator {
    return this.page.locator(this.selectors.appleSignUpButton);
  }

  // ========== Navigation ==========

  /**
   * Navigate to registration page
   */
  async navigate(): Promise<void> {
    await this.goto(this.path);
  }

  /**
   * Navigate to login page
   */
  async goToLogin(): Promise<void> {
    await this.loginLink.click();
    await this.waitForNavigation();
  }

  // ========== Form Interactions ==========

  /**
   * Fill name field
   */
  async fillName(name: string): Promise<void> {
    await this.nameInput.fill(name);
  }

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
   * Fill confirm password field
   */
  async fillConfirmPassword(password: string): Promise<void> {
    const confirmInput = this.confirmPasswordInput;
    if (await confirmInput.isVisible()) {
      await confirmInput.fill(password);
    }
  }

  /**
   * Fill organization name field
   */
  async fillOrganization(name: string): Promise<void> {
    const orgInput = this.organizationInput;
    if (await orgInput.isVisible()) {
      await orgInput.fill(name);
    }
  }

  /**
   * Accept terms and conditions
   */
  async acceptTerms(): Promise<void> {
    const checkbox = this.termsCheckbox;
    if (await checkbox.isVisible()) {
      await checkbox.check();
    }
  }

  /**
   * Fill complete registration form
   */
  async fillRegistrationForm(data: RegistrationData): Promise<void> {
    await this.fillName(data.name);
    await this.fillEmail(data.email);
    await this.fillPassword(data.password);

    if (data.confirmPassword) {
      await this.fillConfirmPassword(data.confirmPassword);
    } else {
      await this.fillConfirmPassword(data.password);
    }

    if (data.organizationName) {
      await this.fillOrganization(data.organizationName);
    }

    if (data.acceptTerms !== false) {
      await this.acceptTerms();
    }
  }

  /**
   * Click register button
   */
  async clickRegister(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Perform complete registration
   */
  async register(data: RegistrationData): Promise<void> {
    await this.fillRegistrationForm(data);
    await this.clickRegister();
  }

  /**
   * Register and wait for success
   */
  async registerAndWaitForSuccess(data: RegistrationData): Promise<void> {
    await this.register(data);
    await this.waitForNavigation();
    // Should redirect away from register page
    await expect(this.page).not.toHaveURL(/\/register/);
  }

  /**
   * Register and expect error
   */
  async registerAndExpectError(data: RegistrationData): Promise<string> {
    await this.register(data);
    await expect(this.errorMessage).toBeVisible();
    return (await this.errorMessage.textContent()) || '';
  }

  // ========== OAuth Methods ==========

  /**
   * Click Google Sign Up button
   */
  async clickGoogleSignUp(): Promise<void> {
    await this.googleSignUpButton.click();
  }

  /**
   * Click GitHub Sign Up button
   */
  async clickGithubSignUp(): Promise<void> {
    await this.githubSignUpButton.click();
  }

  /**
   * Click Azure/Microsoft Sign Up button
   */
  async clickAzureSignUp(): Promise<void> {
    await this.azureSignUpButton.click();
  }

  /**
   * Click Apple Sign Up button
   */
  async clickAppleSignUp(): Promise<void> {
    await this.appleSignUpButton.click();
  }

  /**
   * Check if OAuth buttons are visible
   */
  async hasOAuthButtons(): Promise<boolean> {
    return await this.googleSignUpButton.isVisible();
  }

  /**
   * Assert Google Sign Up button is visible
   */
  async assertGoogleSignUpVisible(): Promise<void> {
    await expect(this.googleSignUpButton).toBeVisible();
  }

  // ========== Validation ==========

  /**
   * Check if registration form is displayed
   */
  async isFormVisible(): Promise<boolean> {
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
   * Check if error is displayed
   */
  async hasError(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }

  /**
   * Get all field errors
   */
  async getFieldErrors(): Promise<string[]> {
    const errors: string[] = [];
    const errorElements = this.page.locator(this.selectors.fieldError);
    const count = await errorElements.count();

    for (let i = 0; i < count; i++) {
      const text = await errorElements.nth(i).textContent();
      if (text) errors.push(text.trim());
    }

    return errors;
  }

  /**
   * Check if form is loading
   */
  async isLoading(): Promise<boolean> {
    return await this.submitButton.isDisabled();
  }

  /**
   * Get password strength indicator
   */
  async getPasswordStrength(): Promise<string | null> {
    const strength = this.page.locator(this.selectors.passwordStrength);
    if (await strength.isVisible()) {
      return await strength.textContent();
    }
    return null;
  }

  // ========== Assertions ==========

  /**
   * Assert form is visible
   */
  async assertFormVisible(): Promise<void> {
    await expect(this.nameInput).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /**
   * Assert error is displayed
   */
  async assertErrorDisplayed(expectedMessage?: string | RegExp): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (expectedMessage) {
      await expect(this.errorMessage).toHaveText(expectedMessage);
    }
  }

  /**
   * Assert successful registration redirect
   */
  async assertRedirectedAfterRegistration(): Promise<void> {
    // Could redirect to verification page, onboarding, or dashboard
    await expect(this.page).toHaveURL(/\/(verify|onboarding|dashboard|profile)/);
  }

  /**
   * Assert email already exists error
   */
  async assertEmailExistsError(): Promise<void> {
    await expect(this.errorMessage).toContainText(/already exists|already registered|email in use/i);
  }

  /**
   * Assert password requirements error
   */
  async assertPasswordRequirementsError(): Promise<void> {
    await expect(this.errorMessage).toContainText(/password|weak|strong|characters|number|uppercase/i);
  }

  /**
   * Assert terms must be accepted
   */
  async assertTermsRequired(): Promise<void> {
    await expect(this.errorMessage).toContainText(/terms|accept|agree/i);
  }

  // ========== Security Testing ==========

  /**
   * Test registration with XSS payload in name
   */
  async testXssInName(payload: string): Promise<void> {
    await this.register({
      name: payload,
      email: 'test@example.com',
      password: 'TestPass123!',
    });
  }

  /**
   * Verify payload is escaped in response
   */
  async verifyPayloadEscaped(payload: string): Promise<boolean> {
    // Check if the payload appears as text (escaped) not as HTML
    const pageContent = await this.page.content();

    // If it contains script tag as text, it's escaped
    // If it executed, we'd see an alert
    return pageContent.includes('&lt;script&gt;') ||
           !pageContent.includes('<script>alert');
  }
}

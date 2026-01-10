/**
 * Settings Page Object Model
 *
 * Encapsulates settings page interactions:
 * - Profile settings
 * - Account settings
 * - Organization settings
 * - Security settings
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Profile update data
 */
export interface ProfileData {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  avatar?: string;
}

/**
 * Settings Page Object Model
 */
export class SettingsPage extends BasePage {
  // Page URL
  readonly path = '/settings';

  // Selectors
  readonly selectors = {
    // Page structure
    pageTitle: 'h1:has-text("Settings"), [data-testid="settings-title"]',
    settingsTabs: '[data-testid="settings-tabs"], [role="tablist"]',

    // Tab items
    profileTab:
      '[data-testid="profile-tab"], button:has-text("Profile"), [role="tab"]:has-text("Profile")',
    accountTab:
      '[data-testid="account-tab"], button:has-text("Account"), [role="tab"]:has-text("Account")',
    organizationTab:
      '[data-testid="organization-tab"], button:has-text("Organization"), [role="tab"]:has-text("Organization")',
    securityTab:
      '[data-testid="security-tab"], button:has-text("Security"), [role="tab"]:has-text("Security")',
    billingTab:
      '[data-testid="billing-tab"], button:has-text("Billing"), [role="tab"]:has-text("Billing")',

    // Profile form
    nameInput: '[data-testid="name-input"], input[name="name"]',
    emailInput: '[data-testid="email-input"], input[name="email"]',
    phoneInput: '[data-testid="phone-input"], input[name="phone"]',
    companyInput: '[data-testid="company-input"], input[name="company"]',
    avatarInput: 'input[type="file"][accept*="image"]',
    avatarPreview: '[data-testid="avatar-preview"], .avatar-preview, img.avatar',

    // Security settings
    currentPasswordInput: 'input[name="currentPassword"]',
    newPasswordInput: 'input[name="newPassword"]',
    confirmPasswordInput: 'input[name="confirmPassword"]',
    changePasswordButton: 'button:has-text("Change Password")',
    enable2FAButton: 'button:has-text("Enable 2FA"), button:has-text("Two-Factor")',
    logoutAllButton: 'button:has-text("Logout All"), button:has-text("all devices")',

    // Organization settings - data-testid selectors
    createOrgButton: '[data-testid="create-org-button"]',
    orgNameInput: '[data-testid="org-name-input"]',
    createOrgSubmit: '[data-testid="create-org-submit"]',
    orgEditButton: '[data-testid="org-edit-button"]',
    orgSaveButton: '[data-testid="org-save-button"]',
    orgCancelButton: '[data-testid="org-cancel-button"]',
    deleteOrgButton: '[data-testid="delete-org-button"]',
    deleteOrgDialog: '[data-testid="delete-org-dialog"]',
    deleteOrgConfirm: '[data-testid="delete-org-confirm"]',
    deleteOrgCancel: '[data-testid="delete-org-cancel"]',
    orgNameError: '[data-testid="org-name-error"]',
    orgAddressInput: 'input[name="address"], textarea[name="address"]',

    // Member management - data-testid selectors
    inviteMemberButton: '[data-testid="invite-member-button"]',
    inviteEmailInput: '[data-testid="invite-email-input"]',
    inviteRoleSelect: '[data-testid="invite-role-select"]',
    inviteSubmitButton: '[data-testid="invite-submit-button"]',
    inviteSuccessMessage: '[data-testid="invite-success-message"]',
    inviteErrorMessage: '[data-testid="invite-error-message"]',
    membersList: '[data-testid="members-list"]',
    memberRow: '[data-testid="member-row"]',
    // Legacy fallback selectors for backwards compatibility
    addMemberButton:
      '[data-testid="invite-member-button"], button:has-text("Add Member"), button:has-text("Invite")',

    // Theme settings
    themeSelect: '[data-testid="theme-select"], select[name="theme"]',
    darkModeToggle: '[data-testid="dark-mode-toggle"], input[name="darkMode"]',

    // Action buttons
    saveButton: 'button:has-text("Save"), button[type="submit"]',
    cancelButton: 'button:has-text("Cancel")',
    deleteAccountButton: 'button:has-text("Delete Account")',

    // Messages
    successMessage: '[data-testid="success-message"], .success-message, [role="status"]',
    errorMessage: '[data-testid="error-message"], .error-message, [role="alert"]',
  };

  constructor(page: Page) {
    super(page);
  }

  // ========== Element Locators ==========

  get pageTitle(): Locator {
    return this.page.locator(this.selectors.pageTitle);
  }

  get profileTab(): Locator {
    return this.page.locator(this.selectors.profileTab);
  }

  get accountTab(): Locator {
    return this.page.locator(this.selectors.accountTab);
  }

  get organizationTab(): Locator {
    return this.page.locator(this.selectors.organizationTab);
  }

  get securityTab(): Locator {
    return this.page.locator(this.selectors.securityTab);
  }

  get saveButton(): Locator {
    return this.page.locator(this.selectors.saveButton);
  }

  // ========== Navigation ==========

  private static readonly TAB_TRANSITION_DELAY = 300;

  /**
   * Navigate to settings page
   */
  async navigate(): Promise<void> {
    await this.goto(this.path);
  }

  /**
   * Click a tab and wait for transition
   */
  private async clickTab(tab: Locator): Promise<void> {
    await tab.click();
    await this.page.waitForTimeout(SettingsPage.TAB_TRANSITION_DELAY);
  }

  /**
   * Navigate to profile tab
   */
  async goToProfileTab(): Promise<void> {
    await this.clickTab(this.profileTab);
  }

  /**
   * Navigate to account tab
   */
  async goToAccountTab(): Promise<void> {
    await this.clickTab(this.accountTab);
  }

  /**
   * Navigate to organization tab
   */
  async goToOrganizationTab(): Promise<void> {
    await this.clickTab(this.organizationTab);
  }

  /**
   * Navigate to security tab
   */
  async goToSecurityTab(): Promise<void> {
    await this.clickTab(this.securityTab);
  }

  /**
   * Navigate to billing tab
   */
  async goToBillingTab(): Promise<void> {
    const billingTab = this.page.locator(this.selectors.billingTab);
    if (await billingTab.isVisible()) {
      await this.clickTab(billingTab);
    }
  }

  // ========== Profile Operations ==========

  /**
   * Update profile information
   */
  async updateProfile(data: ProfileData): Promise<void> {
    if (data.name) {
      await this.page.locator(this.selectors.nameInput).fill(data.name);
    }
    if (data.email) {
      await this.page.locator(this.selectors.emailInput).fill(data.email);
    }
    if (data.phone) {
      await this.page.locator(this.selectors.phoneInput).fill(data.phone);
    }
    if (data.company) {
      await this.page.locator(this.selectors.companyInput).fill(data.company);
    }
    if (data.avatar) {
      await this.page.locator(this.selectors.avatarInput).setInputFiles(data.avatar);
    }
  }

  /**
   * Save profile changes
   */
  async saveProfile(): Promise<void> {
    await this.saveButton.click();
    await this.waitForToast(/saved|updated/i);
  }

  /**
   * Update profile and save
   */
  async updateAndSaveProfile(data: ProfileData): Promise<void> {
    await this.goToProfileTab();
    await this.updateProfile(data);
    await this.saveProfile();
  }

  /**
   * Get current profile name
   */
  async getProfileName(): Promise<string> {
    const input = this.page.locator(this.selectors.nameInput);
    return await input.inputValue();
  }

  /**
   * Get avatar image source
   */
  async getAvatarSrc(): Promise<string | null> {
    const avatar = this.page.locator(this.selectors.avatarPreview);
    return await avatar.getAttribute('src');
  }

  // ========== Security Operations ==========

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.goToSecurityTab();

    await this.page.locator(this.selectors.currentPasswordInput).fill(currentPassword);
    await this.page.locator(this.selectors.newPasswordInput).fill(newPassword);
    await this.page.locator(this.selectors.confirmPasswordInput).fill(newPassword);

    await this.page.locator(this.selectors.changePasswordButton).click();
    await this.waitForToast(/password.*changed|updated/i);
  }

  /**
   * Logout from all devices
   */
  async logoutAllDevices(): Promise<void> {
    await this.goToSecurityTab();
    await this.page.locator(this.selectors.logoutAllButton).click();

    // Confirm if dialog appears
    const confirmButton = this.page.locator('button:has-text("Confirm")');
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }
  }

  // ========== Organization Operations ==========

  /**
   * Update organization name
   */
  async updateOrganizationName(name: string): Promise<void> {
    await this.goToOrganizationTab();
    await this.page.locator(this.selectors.orgNameInput).fill(name);
  }

  /**
   * Update organization address
   */
  async updateOrganizationAddress(address: string): Promise<void> {
    await this.goToOrganizationTab();
    await this.page.locator(this.selectors.orgAddressInput).fill(address);
  }

  /**
   * Get member count using data-testid selector
   */
  async getMemberCount(): Promise<number> {
    await this.goToOrganizationTab();
    const members = this.page.locator(this.selectors.memberRow);
    return await members.count();
  }

  /**
   * Get member role selector for a specific user
   * @param userId - The user ID to get the role selector for
   * @returns CSS selector string for the member's role element
   */
  getMemberRoleSelector(userId: string): string {
    return `[data-testid="member-role-${userId}"]`;
  }

  /**
   * Get member role for a specific user
   * @param userId - The user ID to get the role for
   */
  async getMemberRole(userId: string): Promise<string | null> {
    const roleElement = this.page.locator(this.getMemberRoleSelector(userId));
    if (await roleElement.isVisible()) {
      return await roleElement.textContent();
    }
    return null;
  }

  /**
   * Click add member button
   */
  async clickAddMember(): Promise<void> {
    await this.goToOrganizationTab();
    await this.page.locator(this.selectors.addMemberButton).click();
    await this.waitForModal();
  }

  /**
   * Click invite member button (data-testid version)
   */
  async clickInviteMember(): Promise<void> {
    await this.goToOrganizationTab();
    await this.page.locator(this.selectors.inviteMemberButton).click();
    await this.waitForModal();
  }

  /**
   * Fill invite member form
   * @param email - Email to invite
   * @param role - Role to assign (optional)
   */
  async fillInviteMemberForm(email: string, role?: string): Promise<void> {
    await this.page.locator(this.selectors.inviteEmailInput).fill(email);
    if (role) {
      await this.page.locator(this.selectors.inviteRoleSelect).selectOption(role);
    }
  }

  /**
   * Submit invite member form
   */
  async submitInviteMember(): Promise<void> {
    await this.page.locator(this.selectors.inviteSubmitButton).click();
  }

  /**
   * Complete invite member flow
   * @param email - Email to invite
   * @param role - Role to assign (optional)
   */
  async inviteMember(email: string, role?: string): Promise<void> {
    await this.clickInviteMember();
    await this.fillInviteMemberForm(email, role);
    await this.submitInviteMember();
  }

  /**
   * Create organization
   * @param name - Organization name
   */
  async createOrganization(name: string): Promise<void> {
    await this.goToOrganizationTab();
    await this.page.locator(this.selectors.createOrgButton).click();
    await this.page.locator(this.selectors.orgNameInput).fill(name);
    await this.page.locator(this.selectors.createOrgSubmit).click();
  }

  /**
   * Delete organization with confirmation
   */
  async deleteOrganization(): Promise<void> {
    await this.goToOrganizationTab();
    await this.page.locator(this.selectors.deleteOrgButton).click();
    // Wait for confirmation dialog
    await expect(this.page.locator(this.selectors.deleteOrgDialog)).toBeVisible();
    await this.page.locator(this.selectors.deleteOrgConfirm).click();
  }

  /**
   * Cancel organization deletion
   */
  async cancelDeleteOrganization(): Promise<void> {
    await this.goToOrganizationTab();
    await this.page.locator(this.selectors.deleteOrgButton).click();
    // Wait for confirmation dialog
    await expect(this.page.locator(this.selectors.deleteOrgDialog)).toBeVisible();
    await this.page.locator(this.selectors.deleteOrgCancel).click();
  }

  // ========== Theme Operations ==========

  /**
   * Set theme
   */
  async setTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    const themeSelect = this.page.locator(this.selectors.themeSelect);
    if (await themeSelect.isVisible()) {
      await themeSelect.selectOption(theme);
    } else {
      const darkModeToggle = this.page.locator(this.selectors.darkModeToggle);
      if (await darkModeToggle.isVisible()) {
        if (theme === 'dark') {
          await darkModeToggle.check();
        } else {
          await darkModeToggle.uncheck();
        }
      }
    }
    await this.saveProfile();
  }

  /**
   * Get current theme
   */
  async getCurrentTheme(): Promise<string> {
    // Check body class for theme
    const bodyClass = await this.page.evaluate(() => document.body.className);
    if (bodyClass.includes('dark')) return 'dark';
    if (bodyClass.includes('light')) return 'light';

    // Check localStorage
    const theme = await this.page.evaluate(() => localStorage.getItem('theme'));
    return theme || 'system';
  }

  // ========== Assertions ==========

  /**
   * Assert page is loaded
   */
  async assertLoaded(): Promise<void> {
    await expect(this.pageTitle).toBeVisible();
  }

  /**
   * Assert on profile tab
   */
  async assertOnProfileTab(): Promise<void> {
    await expect(this.page.locator(this.selectors.nameInput)).toBeVisible();
  }

  /**
   * Assert save was successful
   */
  async assertSaveSuccessful(): Promise<void> {
    await expect(this.page.locator(this.selectors.successMessage)).toBeVisible();
  }

  /**
   * Assert profile name matches
   */
  async assertProfileName(expectedName: string): Promise<void> {
    const name = await this.getProfileName();
    expect(name).toBe(expectedName);
  }

  /**
   * Assert avatar is updated
   */
  async assertAvatarUpdated(): Promise<void> {
    const src = await this.getAvatarSrc();
    expect(src).toBeTruthy();
    expect(src).not.toContain('default');
  }

  /**
   * Assert theme is applied
   */
  async assertThemeApplied(theme: 'dark' | 'light'): Promise<void> {
    const currentTheme = await this.getCurrentTheme();
    expect(currentTheme).toBe(theme);

    // Also check if body has correct class
    const bodyClass = await this.page.evaluate(() => document.body.className);
    expect(bodyClass).toContain(theme);
  }

  /**
   * Assert billing tab is visible (admin only)
   */
  async assertBillingTabVisible(): Promise<void> {
    await expect(this.page.locator(this.selectors.billingTab)).toBeVisible();
  }

  /**
   * Assert billing tab is not visible
   */
  async assertBillingTabNotVisible(): Promise<void> {
    await expect(this.page.locator(this.selectors.billingTab)).not.toBeVisible();
  }

  /**
   * Assert add member button is visible
   */
  async assertAddMemberVisible(): Promise<void> {
    await this.goToOrganizationTab();
    await expect(this.page.locator(this.selectors.addMemberButton)).toBeVisible();
  }

  /**
   * Assert add member button is not visible
   */
  async assertAddMemberNotVisible(): Promise<void> {
    await this.goToOrganizationTab();
    await expect(this.page.locator(this.selectors.addMemberButton)).not.toBeVisible();
  }

  /**
   * Assert invite member button is visible (data-testid version)
   */
  async assertInviteMemberVisible(): Promise<void> {
    await this.goToOrganizationTab();
    await expect(this.page.locator(this.selectors.inviteMemberButton)).toBeVisible();
  }

  /**
   * Assert invite member button is not visible
   */
  async assertInviteMemberNotVisible(): Promise<void> {
    await this.goToOrganizationTab();
    await expect(this.page.locator(this.selectors.inviteMemberButton)).not.toBeVisible();
  }

  /**
   * Assert delete organization button is visible
   */
  async assertDeleteOrgVisible(): Promise<void> {
    await this.goToOrganizationTab();
    await expect(this.page.locator(this.selectors.deleteOrgButton)).toBeVisible();
  }

  /**
   * Assert delete organization button is not visible
   */
  async assertDeleteOrgNotVisible(): Promise<void> {
    await this.goToOrganizationTab();
    await expect(this.page.locator(this.selectors.deleteOrgButton)).not.toBeVisible();
  }

  /**
   * Assert invite success message is visible
   */
  async assertInviteSuccess(): Promise<void> {
    await expect(this.page.locator(this.selectors.inviteSuccessMessage)).toBeVisible();
  }

  /**
   * Assert invite error message is visible
   */
  async assertInviteError(): Promise<void> {
    await expect(this.page.locator(this.selectors.inviteErrorMessage)).toBeVisible();
  }

  /**
   * Assert organization name error is visible
   */
  async assertOrgNameError(): Promise<void> {
    await expect(this.page.locator(this.selectors.orgNameError)).toBeVisible();
  }

  /**
   * Assert members list is visible
   */
  async assertMembersListVisible(): Promise<void> {
    await this.goToOrganizationTab();
    await expect(this.page.locator(this.selectors.membersList)).toBeVisible();
  }

  /**
   * Assert member count equals expected value
   * @param expectedCount - Expected number of members
   */
  async assertMemberCount(expectedCount: number): Promise<void> {
    const count = await this.getMemberCount();
    expect(count).toBe(expectedCount);
  }

  /**
   * Assert organization deletion dialog is visible
   */
  async assertDeleteOrgDialogVisible(): Promise<void> {
    await expect(this.page.locator(this.selectors.deleteOrgDialog)).toBeVisible();
  }

  /**
   * Assert organization deletion dialog is not visible
   */
  async assertDeleteOrgDialogNotVisible(): Promise<void> {
    await expect(this.page.locator(this.selectors.deleteOrgDialog)).not.toBeVisible();
  }
}

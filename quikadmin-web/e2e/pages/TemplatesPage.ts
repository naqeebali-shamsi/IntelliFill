/**
 * Templates Page Object Model
 *
 * Encapsulates template management interactions:
 * - Template selection
 * - Auto-fill triggering
 * - Template CRUD operations
 * - Field management
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Template field data
 */
export interface TemplateField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  required?: boolean;
  options?: string[];
}

/**
 * Template data
 */
export interface TemplateData {
  name: string;
  category?: string;
  fields?: TemplateField[];
}

/**
 * Templates Page Object Model
 */
export class TemplatesPage extends BasePage {
  // Page URL
  readonly path = '/templates';

  // Selectors
  readonly selectors = {
    // Page structure
    pageTitle: 'h1:has-text("Templates"), [data-testid="templates-title"]',
    templateGrid: '[data-testid="template-grid"], .template-grid',

    // Template cards
    templateCard: '[data-testid="template-card"], .template-card',
    templateName: '[data-testid="template-name"], .template-name',
    templateCategory: '[data-testid="template-category"], .template-category',
    templateActions: '[data-testid="template-actions"], .template-actions',

    // Action buttons
    createButton: 'button:has-text("Create"), button:has-text("New Template")',
    editButton: 'button:has-text("Edit"), [data-testid="edit-button"]',
    deleteButton: 'button:has-text("Delete"), [data-testid="delete-button"]',
    duplicateButton: 'button:has-text("Duplicate"), [data-testid="duplicate-button"]',
    useTemplateButton: 'button:has-text("Use"), button:has-text("Apply")',

    // Template editor
    templateEditor: '[data-testid="template-editor"], .template-editor',
    templateNameInput: 'input[name="templateName"], [data-testid="template-name-input"]',
    templateCategoryInput: 'input[name="category"], select[name="category"]',
    addFieldButton: 'button:has-text("Add Field")',
    fieldRow: '[data-testid="field-row"], .field-row',
    fieldNameInput: 'input[name="fieldName"]',
    fieldLabelInput: 'input[name="fieldLabel"]',
    fieldTypeSelect: 'select[name="fieldType"]',
    fieldRequiredCheckbox: 'input[name="required"]',
    saveTemplateButton: 'button:has-text("Save Template")',

    // Auto-fill
    documentSelect: '[data-testid="document-select"], select[name="document"]',
    autoFillButton: 'button:has-text("Auto-Fill"), button:has-text("Fill")',
    fillPreview: '[data-testid="fill-preview"], .fill-preview',
    fieldInput: '[data-testid="field-input"], .field-input input',

    // Search and filter
    searchInput: 'input[placeholder*="Search"]',
    categoryFilter: 'select[name="category"]',

    // Messages
    successMessage: '[data-testid="success-message"], [role="status"]',
    errorMessage: '[data-testid="error-message"], [role="alert"]',

    // Modal
    confirmModal: '[role="dialog"]:has-text("Confirm")',
    confirmButton: 'button:has-text("Confirm"), button:has-text("Yes")',
    cancelButton: 'button:has-text("Cancel"), button:has-text("No")',
  };

  constructor(page: Page) {
    super(page);
  }

  // ========== Element Locators ==========

  get pageTitle(): Locator {
    return this.page.locator(this.selectors.pageTitle);
  }

  get templateCards(): Locator {
    return this.page.locator(this.selectors.templateCard);
  }

  get createButton(): Locator {
    return this.page.locator(this.selectors.createButton);
  }

  get templateEditor(): Locator {
    return this.page.locator(this.selectors.templateEditor);
  }

  // ========== Navigation ==========

  /**
   * Navigate to templates page
   */
  async navigate(): Promise<void> {
    await this.goto(this.path);
  }

  // ========== Template Selection ==========

  /**
   * Select a template by name
   */
  async selectTemplate(name: string): Promise<void> {
    const card = this.templateCards.filter({ hasText: name });
    await card.click();
  }

  /**
   * Get template card by name
   */
  getTemplateCard(name: string): Locator {
    return this.templateCards.filter({ hasText: name });
  }

  /**
   * Get all template names
   */
  async getTemplateNames(): Promise<string[]> {
    const names: string[] = [];
    const cards = this.templateCards;
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      const name = await cards.nth(i).locator(this.selectors.templateName).textContent();
      if (name) names.push(name.trim());
    }

    return names;
  }

  /**
   * Get template count
   */
  async getTemplateCount(): Promise<number> {
    return await this.templateCards.count();
  }

  // ========== Template CRUD ==========

  /**
   * Create new template
   */
  async createTemplate(data: TemplateData): Promise<void> {
    await this.createButton.click();
    await expect(this.templateEditor).toBeVisible();

    await this.page.locator(this.selectors.templateNameInput).fill(data.name);

    if (data.category) {
      const categoryInput = this.page.locator(this.selectors.templateCategoryInput);
      if (await categoryInput.getAttribute('type') === 'select') {
        await categoryInput.selectOption(data.category);
      } else {
        await categoryInput.fill(data.category);
      }
    }

    if (data.fields) {
      for (const field of data.fields) {
        await this.addField(field);
      }
    }
  }

  /**
   * Add a field to template
   */
  async addField(field: TemplateField): Promise<void> {
    await this.page.locator(this.selectors.addFieldButton).click();

    const fieldRows = this.page.locator(this.selectors.fieldRow);
    const lastRow = fieldRows.last();

    await lastRow.locator(this.selectors.fieldNameInput).fill(field.name);
    await lastRow.locator(this.selectors.fieldLabelInput).fill(field.label);
    await lastRow.locator(this.selectors.fieldTypeSelect).selectOption(field.type);

    if (field.required) {
      await lastRow.locator(this.selectors.fieldRequiredCheckbox).check();
    }
  }

  /**
   * Save template
   */
  async saveTemplate(): Promise<void> {
    await this.page.locator(this.selectors.saveTemplateButton).click();
    await this.waitForToast(/saved|created/i);
  }

  /**
   * Edit template
   */
  async editTemplate(name: string): Promise<void> {
    const card = this.getTemplateCard(name);
    await card.locator(this.selectors.editButton).click();
    await expect(this.templateEditor).toBeVisible();
  }

  /**
   * Delete template
   */
  async deleteTemplate(name: string): Promise<void> {
    const card = this.getTemplateCard(name);
    await card.locator(this.selectors.deleteButton).click();

    const confirmButton = this.page.locator(this.selectors.confirmButton);
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    await this.waitForToast(/deleted/i);
  }

  /**
   * Duplicate template
   */
  async duplicateTemplate(name: string): Promise<void> {
    const card = this.getTemplateCard(name);
    await card.locator(this.selectors.duplicateButton).click();
    await this.waitForToast(/duplicated|copied/i);
  }

  // ========== Auto-Fill Operations ==========

  /**
   * Trigger auto-fill for a document
   */
  async triggerAutoFill(documentName: string): Promise<void> {
    const documentSelect = this.page.locator(this.selectors.documentSelect);
    await documentSelect.selectOption({ label: documentName });
    await this.page.locator(this.selectors.autoFillButton).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get auto-filled field value
   */
  async getFieldValue(fieldName: string): Promise<string> {
    const fieldInput = this.page.locator(`[data-field="${fieldName}"] input, input[name="${fieldName}"]`);
    return await fieldInput.inputValue();
  }

  /**
   * Set field value manually
   */
  async setFieldValue(fieldName: string, value: string): Promise<void> {
    const fieldInput = this.page.locator(`[data-field="${fieldName}"] input, input[name="${fieldName}"]`);
    await fieldInput.fill(value);
  }

  /**
   * Save filled form
   */
  async saveFilled(): Promise<void> {
    await this.page.locator('button:has-text("Save")').click();
    await this.waitForToast(/saved/i);
  }

  // ========== Search and Filter ==========

  /**
   * Search templates
   */
  async search(query: string): Promise<void> {
    await this.page.locator(this.selectors.searchInput).fill(query);
    await this.page.waitForTimeout(500);
  }

  /**
   * Filter by category
   */
  async filterByCategory(category: string): Promise<void> {
    await this.page.locator(this.selectors.categoryFilter).selectOption(category);
  }

  // ========== Assertions ==========

  /**
   * Assert page is loaded
   */
  async assertLoaded(): Promise<void> {
    await expect(this.pageTitle).toBeVisible();
  }

  /**
   * Assert template exists
   */
  async assertTemplateExists(name: string): Promise<void> {
    const card = this.getTemplateCard(name);
    await expect(card).toBeVisible();
  }

  /**
   * Assert template does not exist
   */
  async assertTemplateNotExists(name: string): Promise<void> {
    const card = this.getTemplateCard(name);
    await expect(card).not.toBeVisible();
  }

  /**
   * Assert field value matches
   */
  async assertFieldValue(fieldName: string, expectedValue: string): Promise<void> {
    const value = await this.getFieldValue(fieldName);
    expect(value).toBe(expectedValue);
  }

  /**
   * Assert field is auto-filled
   */
  async assertFieldAutoFilled(fieldName: string): Promise<void> {
    const value = await this.getFieldValue(fieldName);
    expect(value).toBeTruthy();
    expect(value.length).toBeGreaterThan(0);
  }

  /**
   * Assert template count
   */
  async assertTemplateCount(count: number): Promise<void> {
    await expect(this.templateCards).toHaveCount(count);
  }

  /**
   * Assert editor is visible
   */
  async assertEditorVisible(): Promise<void> {
    await expect(this.templateEditor).toBeVisible();
  }

  /**
   * Assert auto-fill preview is visible
   */
  async assertFillPreviewVisible(): Promise<void> {
    await expect(this.page.locator(this.selectors.fillPreview)).toBeVisible();
  }

  /**
   * Assert save was successful
   */
  async assertSaveSuccessful(): Promise<void> {
    await expect(this.page.locator(this.selectors.successMessage)).toBeVisible();
  }
}

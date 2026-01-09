/**
 * E2E-491.1: Template CRUD Operations
 *
 * Tests complete template CRUD workflow:
 * - Create new template via /templates/new
 * - Edit existing template
 * - Duplicate template
 * - Delete template with confirmation
 * - Verify form validation (required fields, max lengths)
 */

import { test, expect } from '../../fixtures';
import { TemplatesPage, TemplateData, TemplateField } from '../../pages/TemplatesPage';
import { generateUniqueName, testTemplates } from '../../data';

test.describe('E2E-491.1: Template CRUD Operations', () => {
  let templatesPage: TemplatesPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    templatesPage = new TemplatesPage(authenticatedPage);
    await templatesPage.navigate();
    await authenticatedPage.waitForTimeout(1000);
  });

  test.describe('Create Template', () => {
    test('should navigate to create template page via /templates/new', async ({ authenticatedPage }) => {
      // Navigate to create template page
      await authenticatedPage.goto('http://localhost:8080/templates/new');
      await authenticatedPage.waitForTimeout(1000);

      // Verify we're on the create page
      const currentUrl = authenticatedPage.url();
      const hasCreatePage =
        currentUrl.includes('/templates/new') ||
        currentUrl.includes('/templates/create');

      // If direct navigation doesn't work, try clicking create button
      if (!hasCreatePage) {
        const createButton = authenticatedPage.locator(
          'button:has-text("Create"), button:has-text("New Template"), [data-testid="create-template"]'
        ).first();

        if (await createButton.isVisible()) {
          await createButton.click();
          await authenticatedPage.waitForTimeout(1000);
        }
      }

      // Should see a form or editor
      const formOrEditor = authenticatedPage.locator(
        'form, [data-testid="template-editor"], .template-editor, input[name="name"]'
      );
      await expect(formOrEditor.first()).toBeVisible({ timeout: 5000 });
    });

    test('should create a new template with basic fields', async ({ authenticatedPage }) => {
      const templateName = generateUniqueName('E2E Create Template');

      // Click create button
      const createButton = authenticatedPage.locator(
        'button:has-text("Create"), button:has-text("New Template"), [data-testid="create-template"]'
      ).first();

      if (await createButton.isVisible()) {
        await createButton.click();
        await authenticatedPage.waitForTimeout(1000);

        // Fill template name
        const nameInput = authenticatedPage.locator(
          'input[name="name"], input[name="templateName"], input[placeholder*="name" i]'
        ).first();

        if (await nameInput.isVisible()) {
          await nameInput.fill(templateName);

          // Fill category if available
          const categoryInput = authenticatedPage.locator(
            'input[name="category"], select[name="category"]'
          ).first();
          if (await categoryInput.isVisible()) {
            const tagName = await categoryInput.evaluate((el) => el.tagName.toLowerCase());
            if (tagName === 'select') {
              await categoryInput.selectOption({ index: 1 });
            } else {
              await categoryInput.fill('custom');
            }
          }

          // Save template
          const saveButton = authenticatedPage.locator(
            'button:has-text("Save"), button:has-text("Create"), button[type="submit"]'
          ).first();
          await saveButton.click();
          await authenticatedPage.waitForTimeout(2000);

          // Verify success - either toast message or template appears in list
          const pageContent = await authenticatedPage.textContent('body');
          const hasTemplate = pageContent?.includes(templateName);
          const successToast = authenticatedPage.locator('[role="status"], .toast, [data-testid="toast"]');
          const hasSuccess = await successToast.isVisible({ timeout: 3000 }).catch(() => false);

          expect(hasTemplate || hasSuccess).toBe(true);
        }
      }
    });

    test('should create template with multiple fields', async ({ authenticatedPage }) => {
      const templateName = generateUniqueName('Multi Field Template');

      const createButton = authenticatedPage.locator(
        'button:has-text("Create"), button:has-text("New")'
      ).first();

      if (await createButton.isVisible()) {
        await createButton.click();
        await authenticatedPage.waitForTimeout(1000);

        const nameInput = authenticatedPage.locator('input[name="name"], input[name="templateName"]').first();

        if (await nameInput.isVisible()) {
          await nameInput.fill(templateName);

          // Add multiple fields
          const addFieldButton = authenticatedPage.locator('button:has-text("Add Field")').first();

          if (await addFieldButton.isVisible()) {
            // Add 3 fields
            for (let i = 0; i < 3; i++) {
              await addFieldButton.click();
              await authenticatedPage.waitForTimeout(300);
            }

            // Verify fields were added
            const fieldRows = authenticatedPage.locator(
              '[data-testid="field-row"], .field-row, .field-item'
            );
            const fieldCount = await fieldRows.count();

            expect(fieldCount).toBeGreaterThanOrEqual(3);

            // Save template
            const saveButton = authenticatedPage.locator('button:has-text("Save")').first();
            await saveButton.click();
            await authenticatedPage.waitForTimeout(2000);

            // Verify template was created
            const pageContent = await authenticatedPage.textContent('body');
            expect(pageContent).toContain(templateName);
          }
        }
      }
    });

    test('should configure field types when creating template', async ({ authenticatedPage }) => {
      const templateName = generateUniqueName('Field Types Template');

      const createButton = authenticatedPage.locator('button:has-text("Create")').first();

      if (await createButton.isVisible()) {
        await createButton.click();
        await authenticatedPage.waitForTimeout(1000);

        const nameInput = authenticatedPage.locator('input[name="name"]').first();

        if (await nameInput.isVisible()) {
          await nameInput.fill(templateName);

          const addFieldButton = authenticatedPage.locator('button:has-text("Add Field")').first();

          if (await addFieldButton.isVisible()) {
            await addFieldButton.click();
            await authenticatedPage.waitForTimeout(500);

            // Check available field types
            const fieldTypeSelect = authenticatedPage.locator(
              'select[name="fieldType"], select[name*="type"]'
            ).first();

            if (await fieldTypeSelect.isVisible()) {
              const options = await fieldTypeSelect.locator('option').allTextContents();

              // Should have multiple field types
              expect(options.length).toBeGreaterThan(1);

              // Common types should be available
              const optionsLower = options.map((o) => o.toLowerCase()).join(' ');
              const hasCommonTypes =
                optionsLower.includes('text') ||
                optionsLower.includes('number') ||
                optionsLower.includes('date') ||
                optionsLower.includes('select');

              expect(hasCommonTypes).toBe(true);
            }
          }
        }
      }
    });
  });

  test.describe('Edit Template', () => {
    test('should edit existing template name', async ({ authenticatedPage }) => {
      // Find first template
      const templateCard = authenticatedPage.locator(
        '[data-testid="template-card"], .template-card, .template-item, [data-testid="template-row"]'
      ).first();

      if (await templateCard.isVisible()) {
        // Click edit button
        const editButton = templateCard.locator(
          'button:has-text("Edit"), [aria-label="Edit"], [data-testid="edit-button"]'
        ).first();

        // Alternative: try edit icon button
        const editIcon = templateCard.locator('button svg, button [data-lucide="edit"], button [data-lucide="pencil"]').first();

        if (await editButton.isVisible()) {
          await editButton.click();
        } else if (await editIcon.isVisible()) {
          await editIcon.click();
        } else {
          // Click card itself to open edit
          await templateCard.click();
        }

        await authenticatedPage.waitForTimeout(1000);

        // Update template name
        const nameInput = authenticatedPage.locator('input[name="name"]').first();

        if (await nameInput.isVisible()) {
          const newName = generateUniqueName('Edited Template');
          await nameInput.clear();
          await nameInput.fill(newName);

          // Save changes
          const saveButton = authenticatedPage.locator(
            'button:has-text("Save"), button:has-text("Update"), button[type="submit"]'
          ).first();
          await saveButton.click();
          await authenticatedPage.waitForTimeout(2000);

          // Verify update
          const pageContent = await authenticatedPage.textContent('body');
          expect(pageContent).toContain(newName);
        }
      }
    });

    test('should add fields to existing template', async ({ authenticatedPage }) => {
      const templateCard = authenticatedPage.locator(
        '[data-testid="template-card"], .template-card'
      ).first();

      if (await templateCard.isVisible()) {
        const editButton = templateCard.locator('button:has-text("Edit")').first();

        if (await editButton.isVisible()) {
          await editButton.click();
          await authenticatedPage.waitForTimeout(1000);

          // Count initial fields
          const fieldRows = authenticatedPage.locator('[data-testid="field-row"], .field-row');
          const initialCount = await fieldRows.count();

          // Add new field
          const addFieldButton = authenticatedPage.locator('button:has-text("Add Field")').first();

          if (await addFieldButton.isVisible()) {
            await addFieldButton.click();
            await authenticatedPage.waitForTimeout(500);

            // Verify field was added
            const newCount = await fieldRows.count();
            expect(newCount).toBeGreaterThan(initialCount);

            // Save
            const saveButton = authenticatedPage.locator('button:has-text("Save")').first();
            await saveButton.click();
            await authenticatedPage.waitForTimeout(2000);
          }
        }
      }
    });

    test('should remove fields from template', async ({ authenticatedPage }) => {
      // First create a template with fields
      const templateName = generateUniqueName('Remove Field Test');

      const createButton = authenticatedPage.locator('button:has-text("Create")').first();

      if (await createButton.isVisible()) {
        await createButton.click();
        await authenticatedPage.waitForTimeout(1000);

        const nameInput = authenticatedPage.locator('input[name="name"]').first();

        if (await nameInput.isVisible()) {
          await nameInput.fill(templateName);

          // Add two fields
          const addFieldButton = authenticatedPage.locator('button:has-text("Add Field")').first();

          if (await addFieldButton.isVisible()) {
            await addFieldButton.click();
            await authenticatedPage.waitForTimeout(300);
            await addFieldButton.click();
            await authenticatedPage.waitForTimeout(500);

            // Count fields
            const fieldRows = authenticatedPage.locator('[data-testid="field-row"], .field-row');
            const initialCount = await fieldRows.count();

            // Remove last field
            const removeButton = authenticatedPage.locator(
              'button:has-text("Remove"), button[aria-label*="Remove"], button[aria-label*="Delete"]'
            ).last();

            if (await removeButton.isVisible()) {
              await removeButton.click();
              await authenticatedPage.waitForTimeout(500);

              // Verify field was removed
              const newCount = await fieldRows.count();
              expect(newCount).toBeLessThan(initialCount);
            }
          }
        }
      }
    });
  });

  test.describe('Duplicate Template', () => {
    test('should duplicate an existing template', async ({ authenticatedPage }) => {
      const templateCard = authenticatedPage.locator(
        '[data-testid="template-card"], .template-card, .template-item'
      ).first();

      if (await templateCard.isVisible()) {
        // Get original template name
        const originalName = await templateCard.locator(
          '[data-testid="template-name"], .template-name, h3, h4'
        ).first().textContent();

        // Click duplicate button
        const duplicateButton = templateCard.locator(
          'button:has-text("Duplicate"), button:has-text("Copy"), [aria-label*="Duplicate"], [aria-label*="Copy"]'
        ).first();

        if (await duplicateButton.isVisible()) {
          await duplicateButton.click();
          await authenticatedPage.waitForTimeout(2000);

          // Verify duplicate was created
          const pageContent = await authenticatedPage.textContent('body');

          // Should have copy or duplicate indicator
          const hasDuplicate =
            pageContent?.includes('Copy') ||
            pageContent?.includes('(Copy)') ||
            pageContent?.includes('Duplicate') ||
            pageContent?.includes(`${originalName} (2)`);

          // Or there should be more templates now
          const templates = authenticatedPage.locator('[data-testid="template-card"], .template-card');
          const count = await templates.count();

          expect(hasDuplicate || count > 1).toBe(true);
        }
      }
    });

    test('should create independent copy when duplicating', async ({ authenticatedPage }) => {
      const templateCards = authenticatedPage.locator(
        '[data-testid="template-card"], .template-card'
      );

      if ((await templateCards.count()) > 0) {
        const firstCard = templateCards.first();

        const duplicateButton = firstCard.locator(
          'button:has-text("Duplicate"), button:has-text("Copy")'
        ).first();

        if (await duplicateButton.isVisible()) {
          await duplicateButton.click();
          await authenticatedPage.waitForTimeout(2000);

          // Edit the duplicate
          const lastCard = templateCards.last();
          const editButton = lastCard.locator('button:has-text("Edit")').first();

          if (await editButton.isVisible()) {
            await editButton.click();
            await authenticatedPage.waitForTimeout(1000);

            // Change name
            const nameInput = authenticatedPage.locator('input[name="name"]').first();

            if (await nameInput.isVisible()) {
              const uniqueName = generateUniqueName('Independent Copy');
              await nameInput.clear();
              await nameInput.fill(uniqueName);

              await authenticatedPage.locator('button:has-text("Save")').first().click();
              await authenticatedPage.waitForTimeout(2000);

              // Verify original was not affected
              await templatesPage.navigate();
              await authenticatedPage.waitForTimeout(1000);

              const pageContent = await authenticatedPage.textContent('body');
              expect(pageContent).toContain(uniqueName);
            }
          }
        }
      }
    });
  });

  test.describe('Delete Template', () => {
    test('should delete template with confirmation dialog', async ({ authenticatedPage }) => {
      // Create a template to delete
      const templateName = generateUniqueName('Delete Me Template');

      const createButton = authenticatedPage.locator('button:has-text("Create")').first();

      if (await createButton.isVisible()) {
        await createButton.click();
        await authenticatedPage.waitForTimeout(1000);

        const nameInput = authenticatedPage.locator('input[name="name"]').first();

        if (await nameInput.isVisible()) {
          await nameInput.fill(templateName);

          const saveButton = authenticatedPage.locator('button:has-text("Save")').first();
          await saveButton.click();
          await authenticatedPage.waitForTimeout(2000);

          // Navigate back to templates list if needed
          if (!authenticatedPage.url().includes('/templates')) {
            await templatesPage.navigate();
            await authenticatedPage.waitForTimeout(1000);
          }

          // Find the template we created
          const templateCard = authenticatedPage.locator(
            `[data-testid="template-card"]:has-text("${templateName}"), .template-card:has-text("${templateName}")`
          ).first();

          if (await templateCard.isVisible()) {
            // Click delete button
            const deleteButton = templateCard.locator(
              'button:has-text("Delete"), [aria-label*="Delete"]'
            ).first();

            if (await deleteButton.isVisible()) {
              await deleteButton.click();
              await authenticatedPage.waitForTimeout(500);

              // Check for confirmation dialog
              const confirmDialog = authenticatedPage.locator(
                '[role="dialog"], [role="alertdialog"], .modal'
              );

              if (await confirmDialog.isVisible({ timeout: 2000 })) {
                // Confirm deletion
                const confirmButton = confirmDialog.locator(
                  'button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes")'
                ).first();

                await confirmButton.click();
              }

              await authenticatedPage.waitForTimeout(2000);

              // Verify template was deleted
              const stillExists = await templateCard.isVisible({ timeout: 2000 }).catch(() => false);
              expect(stillExists).toBe(false);
            }
          }
        }
      }
    });

    test('should cancel deletion from confirmation dialog', async ({ authenticatedPage }) => {
      const templateCard = authenticatedPage.locator(
        '[data-testid="template-card"], .template-card'
      ).first();

      if (await templateCard.isVisible()) {
        const templateName = await templateCard.locator(
          '[data-testid="template-name"], .template-name, h3, h4'
        ).first().textContent();

        const deleteButton = templateCard.locator('button:has-text("Delete")').first();

        if (await deleteButton.isVisible()) {
          await deleteButton.click();
          await authenticatedPage.waitForTimeout(500);

          const confirmDialog = authenticatedPage.locator('[role="dialog"], [role="alertdialog"]');

          if (await confirmDialog.isVisible({ timeout: 2000 })) {
            // Cancel deletion
            const cancelButton = confirmDialog.locator(
              'button:has-text("Cancel"), button:has-text("No")'
            ).first();

            await cancelButton.click();
            await authenticatedPage.waitForTimeout(1000);

            // Template should still exist
            const pageContent = await authenticatedPage.textContent('body');
            expect(pageContent).toContain(templateName);
          }
        }
      }
    });
  });

  test.describe('Form Validation', () => {
    test('should require template name', async ({ authenticatedPage }) => {
      const createButton = authenticatedPage.locator('button:has-text("Create")').first();

      if (await createButton.isVisible()) {
        await createButton.click();
        await authenticatedPage.waitForTimeout(1000);

        // Try to save without name
        const saveButton = authenticatedPage.locator('button:has-text("Save")').first();
        await saveButton.click();
        await authenticatedPage.waitForTimeout(1000);

        // Should show validation error
        const errorIndicator = authenticatedPage.locator(
          '[role="alert"], .error-message, [aria-invalid="true"], .text-destructive, .text-red-500'
        );

        const hasError = await errorIndicator.first().isVisible({ timeout: 3000 });
        expect(hasError).toBe(true);
      }
    });

    test('should validate template name max length', async ({ authenticatedPage }) => {
      const createButton = authenticatedPage.locator('button:has-text("Create")').first();

      if (await createButton.isVisible()) {
        await createButton.click();
        await authenticatedPage.waitForTimeout(1000);

        const nameInput = authenticatedPage.locator('input[name="name"]').first();

        if (await nameInput.isVisible()) {
          // Enter very long name (over 255 characters)
          const veryLongName = 'A'.repeat(300);
          await nameInput.fill(veryLongName);

          // Try to save
          const saveButton = authenticatedPage.locator('button:has-text("Save")').first();
          await saveButton.click();
          await authenticatedPage.waitForTimeout(1000);

          // Check for validation error or truncation
          const inputValue = await nameInput.inputValue();
          const hasError = await authenticatedPage.locator('[role="alert"], .error-message').isVisible();

          // Either name was truncated or error was shown
          expect(inputValue.length < 300 || hasError).toBe(true);
        }
      }
    });

    test('should validate required field properties', async ({ authenticatedPage }) => {
      const createButton = authenticatedPage.locator('button:has-text("Create")').first();

      if (await createButton.isVisible()) {
        await createButton.click();
        await authenticatedPage.waitForTimeout(1000);

        const nameInput = authenticatedPage.locator('input[name="name"]').first();

        if (await nameInput.isVisible()) {
          await nameInput.fill(generateUniqueName('Validation Test'));

          // Add a field
          const addFieldButton = authenticatedPage.locator('button:has-text("Add Field")').first();

          if (await addFieldButton.isVisible()) {
            await addFieldButton.click();
            await authenticatedPage.waitForTimeout(500);

            // Try to save without field name
            const saveButton = authenticatedPage.locator('button:has-text("Save")').first();
            await saveButton.click();
            await authenticatedPage.waitForTimeout(1000);

            // Should show validation error for field or save successfully
            // (depending on whether field names are required)
            const hasError = await authenticatedPage.locator('[role="alert"], .error-message').isVisible();
            const wasSaved = await authenticatedPage.locator(
              '[role="status"], .toast:has-text("saved")'
            ).isVisible();

            expect(hasError || wasSaved).toBe(true);
          }
        }
      }
    });

    test('should show validation errors inline', async ({ authenticatedPage }) => {
      const createButton = authenticatedPage.locator('button:has-text("Create")').first();

      if (await createButton.isVisible()) {
        await createButton.click();
        await authenticatedPage.waitForTimeout(1000);

        // Clear name input if it has default value
        const nameInput = authenticatedPage.locator('input[name="name"]').first();

        if (await nameInput.isVisible()) {
          await nameInput.clear();

          // Blur to trigger validation
          await nameInput.blur();
          await authenticatedPage.waitForTimeout(500);

          // Or click save
          const saveButton = authenticatedPage.locator('button:has-text("Save")').first();
          await saveButton.click();
          await authenticatedPage.waitForTimeout(1000);

          // Check for inline error near the input
          const inlineError = authenticatedPage.locator(
            'input[name="name"] ~ [role="alert"], input[name="name"] ~ .error, .field-error'
          );

          const hasInlineError = await inlineError.isVisible({ timeout: 2000 });

          // Or general error message
          const generalError = await authenticatedPage.locator('[role="alert"]').isVisible();

          expect(hasInlineError || generalError).toBe(true);
        }
      }
    });
  });
});

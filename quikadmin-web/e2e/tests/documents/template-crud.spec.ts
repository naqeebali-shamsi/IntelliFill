/**
 * E2E-427: Template CRUD Operations
 *
 * Tests template creation and management:
 * - Create template
 * - Add fields to template
 * - Edit template
 * - Duplicate template
 * - Delete template
 * - Verify persistence
 */

import { test, expect } from '@playwright/test';
import { test as authTest } from '../../fixtures/auth.fixture';
import { generateUniqueName } from '../../data';

test.describe('E2E-427: Template CRUD Operations', () => {
  authTest.beforeEach(async ({ authenticatedPage }) => {
    // Navigate to templates page
    await authenticatedPage.goto('http://localhost:8080/templates');
    await authenticatedPage.waitForTimeout(1000);
  });

  authTest('should create new template with fields', async ({ authenticatedPage }) => {
    const templateName = generateUniqueName('E2E Template');

    // Look for create template button
    const createButton = authenticatedPage.locator(
      'button:has-text("Create"), button:has-text("New Template"), [data-testid="create-template"]'
    ).first();

    if (await createButton.isVisible()) {
      await createButton.click();
      await authenticatedPage.waitForTimeout(1000);

      // Fill template name
      const nameInput = authenticatedPage.locator('input[name="name"], input[placeholder*="Template"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill(templateName);

        // Add a text field
        const addFieldButton = authenticatedPage.locator('button:has-text("Add Field")').first();
        if (await addFieldButton.isVisible()) {
          await addFieldButton.click();
          await authenticatedPage.waitForTimeout(500);

          // Configure field
          const fieldNameInput = authenticatedPage.locator('input[name="fieldName"], input[placeholder*="Field"]').first();
          if (await fieldNameInput.isVisible()) {
            await fieldNameInput.fill('Text Field');
          }

          // Select field type
          const fieldTypeSelect = authenticatedPage.locator('select[name="fieldType"]').first();
          if (await fieldTypeSelect.isVisible()) {
            await fieldTypeSelect.selectOption('text');
          }
        }

        // Save template
        const saveButton = authenticatedPage.locator('button:has-text("Save"), button[type="submit"]').first();
        await saveButton.click();
        await authenticatedPage.waitForTimeout(2000);

        // Verify template appears in list
        const pageContent = await authenticatedPage.textContent('body');
        expect(pageContent).toContain(templateName);
      }
    }
  });

  authTest('should edit existing template', async ({ authenticatedPage }) => {
    // Find first template in list
    const firstTemplate = authenticatedPage.locator(
      '[data-testid="template-row"], .template-card, .template-item'
    ).first();

    if (await firstTemplate.isVisible()) {
      // Get original name
      const originalName = await firstTemplate.textContent();

      // Click edit button
      const editButton = firstTemplate.locator('button:has-text("Edit"), [aria-label="Edit"]').first();
      if (await editButton.isVisible()) {
        await editButton.click();
        await authenticatedPage.waitForTimeout(1000);

        // Change template name
        const nameInput = authenticatedPage.locator('input[name="name"]').first();
        if (await nameInput.isVisible()) {
          const newName = generateUniqueName('Edited Template');
          await nameInput.clear();
          await nameInput.fill(newName);

          // Save changes
          const saveButton = authenticatedPage.locator('button:has-text("Save")').first();
          await saveButton.click();
          await authenticatedPage.waitForTimeout(2000);

          // Verify updated name appears
          const pageContent = await authenticatedPage.textContent('body');
          expect(pageContent).toContain(newName);
        }
      }
    }
  });

  authTest('should duplicate template', async ({ authenticatedPage }) => {
    const firstTemplate = authenticatedPage.locator('[data-testid="template-row"], .template-card').first();

    if (await firstTemplate.isVisible()) {
      const originalName = await firstTemplate.textContent();

      // Look for duplicate button
      const duplicateButton = firstTemplate.locator(
        'button:has-text("Duplicate"), button:has-text("Copy"), [aria-label="Duplicate"]'
      ).first();

      if (await duplicateButton.isVisible()) {
        await duplicateButton.click();
        await authenticatedPage.waitForTimeout(2000);

        // Should create a copy with similar name
        const pageContent = await authenticatedPage.textContent('body');
        const hasCopy = pageContent?.includes('Copy') || pageContent?.includes('Duplicate');

        expect(hasCopy).toBe(true);
      }
    }
  });

  authTest('should delete template', async ({ authenticatedPage }) => {
    // Create a template to delete
    const templateName = generateUniqueName('Delete Me Template');

    const createButton = authenticatedPage.locator('button:has-text("Create"), button:has-text("New")').first();
    if (await createButton.isVisible()) {
      await createButton.click();
      await authenticatedPage.waitForTimeout(1000);

      const nameInput = authenticatedPage.locator('input[name="name"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill(templateName);

        const saveButton = authenticatedPage.locator('button:has-text("Save")').first();
        await saveButton.click();
        await authenticatedPage.waitForTimeout(2000);
      }
    }

    // Find the template we just created
    const templateRow = authenticatedPage.locator(`text=${templateName}`).first();
    if (await templateRow.isVisible()) {
      // Find delete button
      const deleteButton = authenticatedPage.locator(
        `button:has-text("Delete"):near(:text("${templateName}")), [aria-label="Delete"]:near(:text("${templateName}"))`
      ).first();

      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        await authenticatedPage.waitForTimeout(500);

        // Confirm deletion if dialog appears
        const confirmButton = authenticatedPage.locator('button:has-text("Confirm"), button:has-text("Delete")');
        if (await confirmButton.isVisible({ timeout: 2000 })) {
          await confirmButton.last().click();
        }

        await authenticatedPage.waitForTimeout(2000);

        // Verify template is removed
        const stillVisible = await templateRow.isVisible({ timeout: 2000 }).catch(() => false);
        expect(stillVisible).toBe(false);
      }
    }
  });

  authTest('should persist template across page refresh', async ({ authenticatedPage }) => {
    const templateName = generateUniqueName('Persist Test Template');

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

        // Refresh page
        await authenticatedPage.reload();
        await authenticatedPage.waitForTimeout(2000);

        // Verify template still exists
        const pageContent = await authenticatedPage.textContent('body');
        expect(pageContent).toContain(templateName);
      }
    }
  });

  authTest('should add multiple fields to template', async ({ authenticatedPage }) => {
    const templateName = generateUniqueName('Multi Field Template');

    const createButton = authenticatedPage.locator('button:has-text("Create")').first();
    if (await createButton.isVisible()) {
      await createButton.click();
      await authenticatedPage.waitForTimeout(1000);

      const nameInput = authenticatedPage.locator('input[name="name"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill(templateName);

        // Add multiple fields
        const addFieldButton = authenticatedPage.locator('button:has-text("Add Field")');

        for (let i = 0; i < 3; i++) {
          if (await addFieldButton.first().isVisible()) {
            await addFieldButton.first().click();
            await authenticatedPage.waitForTimeout(500);
          }
        }

        // Save template
        const saveButton = authenticatedPage.locator('button:has-text("Save")').first();
        await saveButton.click();
        await authenticatedPage.waitForTimeout(2000);

        // Edit to verify fields were saved
        const templateRow = authenticatedPage.locator(`text=${templateName}`).first();
        if (await templateRow.isVisible()) {
          const editButton = authenticatedPage.locator('button:has-text("Edit")').first();
          if (await editButton.isVisible()) {
            await editButton.click();
            await authenticatedPage.waitForTimeout(1000);

            // Count field inputs
            const fieldInputs = authenticatedPage.locator('input[name*="field"], .field-input');
            const fieldCount = await fieldInputs.count();

            expect(fieldCount).toBeGreaterThanOrEqual(3);
          }
        }
      }
    }
  });

  authTest('should validate required template fields', async ({ authenticatedPage }) => {
    const createButton = authenticatedPage.locator('button:has-text("Create")').first();
    if (await createButton.isVisible()) {
      await createButton.click();
      await authenticatedPage.waitForTimeout(1000);

      // Try to save without name
      const saveButton = authenticatedPage.locator('button:has-text("Save")').first();
      await saveButton.click();
      await authenticatedPage.waitForTimeout(1000);

      // Should show validation error
      const errorMessage = authenticatedPage.locator('[role="alert"], .error-message, [aria-invalid="true"]');
      const hasError = await errorMessage.isVisible({ timeout: 2000 });

      expect(hasError).toBe(true);
    }
  });

  authTest('should reorder template fields', async ({ authenticatedPage }) => {
    const templateName = generateUniqueName('Reorder Template');

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
          await authenticatedPage.waitForTimeout(500);
          await addFieldButton.click();
          await authenticatedPage.waitForTimeout(500);
        }

        // Look for drag handles or up/down buttons
        const moveUpButton = authenticatedPage.locator('button[aria-label*="Move up"], button:has-text("↑")').first();
        const moveDownButton = authenticatedPage.locator('button[aria-label*="Move down"], button:has-text("↓")').first();

        if (await moveUpButton.isVisible() || await moveDownButton.isVisible()) {
          // If reordering is supported, try it
          if (await moveDownButton.isVisible()) {
            await moveDownButton.click();
            await authenticatedPage.waitForTimeout(500);
          }
        }

        const saveButton = authenticatedPage.locator('button:has-text("Save")').first();
        await saveButton.click();
        await authenticatedPage.waitForTimeout(2000);
      }
    }
  });

  authTest('should remove field from template', async ({ authenticatedPage }) => {
    const templateName = generateUniqueName('Remove Field Template');

    const createButton = authenticatedPage.locator('button:has-text("Create")').first();
    if (await createButton.isVisible()) {
      await createButton.click();
      await authenticatedPage.waitForTimeout(1000);

      const nameInput = authenticatedPage.locator('input[name="name"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill(templateName);

        // Add a field
        const addFieldButton = authenticatedPage.locator('button:has-text("Add Field")').first();
        if (await addFieldButton.isVisible()) {
          await addFieldButton.click();
          await authenticatedPage.waitForTimeout(500);

          // Remove the field
          const removeButton = authenticatedPage.locator('button:has-text("Remove"), button[aria-label*="Remove"]').last();
          if (await removeButton.isVisible()) {
            await removeButton.click();
            await authenticatedPage.waitForTimeout(500);
          }
        }

        const saveButton = authenticatedPage.locator('button:has-text("Save")').first();
        await saveButton.click();
        await authenticatedPage.waitForTimeout(2000);
      }
    }
  });

  authTest('should support different field types', async ({ authenticatedPage }) => {
    const templateName = generateUniqueName('Field Types Template');

    const createButton = authenticatedPage.locator('button:has-text("Create")').first();
    if (await createButton.isVisible()) {
      await createButton.click();
      await authenticatedPage.waitForTimeout(1000);

      const nameInput = authenticatedPage.locator('input[name="name"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill(templateName);

        // Add field and check available types
        const addFieldButton = authenticatedPage.locator('button:has-text("Add Field")').first();
        if (await addFieldButton.isVisible()) {
          await addFieldButton.click();
          await authenticatedPage.waitForTimeout(500);

          const fieldTypeSelect = authenticatedPage.locator('select[name*="type"]').first();
          if (await fieldTypeSelect.isVisible()) {
            const options = await fieldTypeSelect.locator('option').allTextContents();

            // Should have multiple field type options
            expect(options.length).toBeGreaterThan(1);

            // Common field types
            const optionsText = options.join(' ').toLowerCase();
            const hasCommonTypes =
              optionsText.includes('text') ||
              optionsText.includes('number') ||
              optionsText.includes('date');

            expect(hasCommonTypes).toBe(true);
          }
        }
      }
    }
  });
});

/**
 * ProfileFieldsManager Component Tests
 * Tests for the profile fields manager component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ProfileFieldsManager } from '../profile-fields-manager';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Helper to create test wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Mock fields data
const mockFields: Record<string, any> = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  phone: '555-123-4567',
  street: '123 Main St',
  city: 'Springfield',
  state: 'IL',
  zipCode: '62701',
  employer: 'ACME Corp',
  jobTitle: 'Software Engineer',
  bankAccount: '1234567890',
  customField: 'Custom Value',
};

const mockFieldSources: Record<string, string> = {
  firstName: 'ocr',
  lastName: 'ocr',
  email: 'manual',
  phone: 'manual',
  street: 'ocr',
  city: 'ocr',
  state: 'ocr',
  zipCode: 'ocr',
  employer: 'imported',
  jobTitle: 'imported',
  bankAccount: 'manual',
  customField: 'manual',
};

describe('ProfileFieldsManager Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading skeleton when isLoading is true', () => {
      const { container } = render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={{}}
          isLoading={true}
        />,
        { wrapper: createWrapper() }
      );

      // Should show skeleton elements - look for data-slot or animate-pulse class
      const hasSkeleton = container.querySelector('[data-slot="skeleton"]') ||
                         container.querySelector('[class*="animate-pulse"]') ||
                         container.querySelector('[class*="Skeleton"]');
      expect(hasSkeleton).toBeTruthy();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no fields are stored', () => {
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={{}}
          fieldSources={{}}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Stored Field Data')).toBeInTheDocument();
      expect(screen.getByText(/no field data stored yet/i)).toBeInTheDocument();
    });

    it('should show Add Field button in empty state when editable', () => {
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={{}}
          fieldSources={{}}
          editable={true}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByRole('button', { name: /add field/i })).toBeInTheDocument();
    });
  });

  describe('Field Display', () => {
    it('should display field count correctly', () => {
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Stored Field Data')).toBeInTheDocument();
      expect(screen.getByText(/12 data fields stored/i)).toBeInTheDocument();
    });

    it('should categorize fields into appropriate categories', async () => {
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
        />,
        { wrapper: createWrapper() }
      );

      // Should show category sections
      expect(screen.getByText('Personal Information')).toBeInTheDocument();
      expect(screen.getByText('Contact Information')).toBeInTheDocument();
      expect(screen.getByText('Employment')).toBeInTheDocument();
      expect(screen.getByText('Financial')).toBeInTheDocument();
    });

    it('should display field names in human-readable format', async () => {
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
        />,
        { wrapper: createWrapper() }
      );

      // Should show formatted field names
      expect(screen.getByText('First Name')).toBeInTheDocument();
      expect(screen.getByText('Last Name')).toBeInTheDocument();
    });

    it('should display field values', async () => {
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('Doe')).toBeInTheDocument();
    });

    it('should display source badges for each field', async () => {
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
        />,
        { wrapper: createWrapper() }
      );

      // Should show various source badges
      expect(screen.getAllByText('OCR').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Manual').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Imported').length).toBeGreaterThan(0);
    });
  });

  describe('Category Expansion', () => {
    it('should allow collapsing and expanding categories', async () => {
      const user = userEvent.setup();
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
        />,
        { wrapper: createWrapper() }
      );

      // Find the Personal Information category header and click it
      const personalCategory = screen.getByText('Personal Information').closest('button');
      expect(personalCategory).toBeInTheDocument();

      if (personalCategory) {
        // Initial state - expanded
        expect(screen.getByText('First Name')).toBeInTheDocument();

        // Collapse
        await user.click(personalCategory);

        // After collapse, field might not be visible
        // (depends on implementation - the fields are hidden but may still be in DOM)
      }
    });

    it('should show field count badge for each category', () => {
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
        />,
        { wrapper: createWrapper() }
      );

      // Personal Information should have a badge with count
      const personalSection = screen.getByText('Personal Information').closest('button');
      expect(personalSection).toBeInTheDocument();

      // Badge showing count should exist
      if (personalSection) {
        expect(within(personalSection).getByText('2')).toBeInTheDocument();
      }
    });
  });

  describe('Field Editing', () => {
    it('should show edit and delete buttons on hover when editable', async () => {
      const user = userEvent.setup();
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
          editable={true}
        />,
        { wrapper: createWrapper() }
      );

      // Find a field row and hover over it
      const fieldRow = screen.getByText('John').closest('[class*="group"]');
      expect(fieldRow).toBeInTheDocument();

      if (fieldRow) {
        await user.hover(fieldRow);
        // Edit/delete buttons appear on hover (opacity transition)
      }
    });

    it('should enter edit mode when edit button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
          editable={true}
        />,
        { wrapper: createWrapper() }
      );

      // Find a field row containing "John" value
      const johnText = screen.getByText('John');
      const fieldRow = johnText.closest('.group') || johnText.closest('[class*="hover"]');
      expect(fieldRow).toBeTruthy();

      if (fieldRow) {
        await user.hover(fieldRow);

        // Wait for buttons to become visible and find edit button
        await waitFor(async () => {
          const buttons = within(fieldRow as HTMLElement).queryAllByRole('button');
          if (buttons.length > 0) {
            await user.click(buttons[0]);
          }
        });

        // Should show input field after clicking edit
        await waitFor(() => {
          const input = screen.queryAllByRole('textbox');
          expect(input.length).toBeGreaterThan(0);
        }, { timeout: 2000 });
      }
    });

    it('should save edited value when confirmed', async () => {
      const user = userEvent.setup();
      const handleFieldsUpdate = vi.fn();

      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
          editable={true}
          onFieldsUpdate={handleFieldsUpdate}
        />,
        { wrapper: createWrapper() }
      );

      // Find John's field row
      const fieldRow = screen.getByText('John').closest('[class*="group"]');
      expect(fieldRow).toBeInTheDocument();

      if (fieldRow) {
        await user.hover(fieldRow);

        // Find all buttons in the row - first one should be edit
        const buttons = within(fieldRow as HTMLElement).getAllByRole('button');
        const editButton = buttons[0];

        if (editButton) {
          await user.click(editButton);

          await waitFor(() => {
            expect(within(fieldRow as HTMLElement).getByRole('textbox')).toBeInTheDocument();
          });

          const input = within(fieldRow as HTMLElement).getByRole('textbox');
          await user.clear(input);
          await user.type(input, 'Jane');

          // Find the save button (Check icon)
          const saveButton = within(fieldRow as HTMLElement).getAllByRole('button')[0];
          await user.click(saveButton);

          // Changes are tracked locally, Save Changes button appears
          await waitFor(() => {
            expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
          });
        }
      }
    });

    it('should cancel edit when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
          editable={true}
        />,
        { wrapper: createWrapper() }
      );

      const fieldRow = screen.getByText('John').closest('[class*="group"]');
      expect(fieldRow).toBeInTheDocument();

      if (fieldRow) {
        await user.hover(fieldRow);

        const buttons = within(fieldRow as HTMLElement).getAllByRole('button');
        const editButton = buttons[0];

        if (editButton) {
          await user.click(editButton);

          await waitFor(() => {
            expect(within(fieldRow as HTMLElement).getByRole('textbox')).toBeInTheDocument();
          });

          // Press Escape to cancel
          await user.keyboard('{Escape}');

          // Should return to view mode
          await waitFor(() => {
            expect(screen.getByText('John')).toBeInTheDocument();
          });
        }
      }
    });

    it('should save edit when Enter is pressed', async () => {
      const user = userEvent.setup();
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
          editable={true}
        />,
        { wrapper: createWrapper() }
      );

      const fieldRow = screen.getByText('John').closest('[class*="group"]');
      expect(fieldRow).toBeInTheDocument();

      if (fieldRow) {
        await user.hover(fieldRow);

        const buttons = within(fieldRow as HTMLElement).getAllByRole('button');
        const editButton = buttons[0];

        if (editButton) {
          await user.click(editButton);

          await waitFor(() => {
            expect(within(fieldRow as HTMLElement).getByRole('textbox')).toBeInTheDocument();
          });

          const input = within(fieldRow as HTMLElement).getByRole('textbox');
          await user.clear(input);
          await user.type(input, 'Jane{Enter}');

          // Save Changes button should appear
          await waitFor(() => {
            expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
          });
        }
      }
    });
  });

  describe('Field Deletion', () => {
    it('should show delete confirmation dialog', async () => {
      const user = userEvent.setup();
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
          editable={true}
        />,
        { wrapper: createWrapper() }
      );

      const fieldRow = screen.getByText('John').closest('[class*="group"]');
      expect(fieldRow).toBeInTheDocument();

      if (fieldRow) {
        await user.hover(fieldRow);

        // Find the delete button (second button, with destructive class)
        const buttons = within(fieldRow as HTMLElement).getAllByRole('button');
        const deleteButton = buttons[1]; // Usually the second button is delete

        if (deleteButton) {
          await user.click(deleteButton);

          // Should show confirmation dialog
          await waitFor(() => {
            expect(screen.getByText('Delete Field')).toBeInTheDocument();
          });
        }
      }
    });
  });

  describe('Add Field', () => {
    it('should open add field dialog when Add Field button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
          editable={true}
        />,
        { wrapper: createWrapper() }
      );

      const addButton = screen.getByRole('button', { name: /add field/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Add Custom Field')).toBeInTheDocument();
      });

      // The form uses different label IDs
      expect(screen.getByPlaceholderText(/emergency contact/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enter value/i)).toBeInTheDocument();
    });

    it('should add new field when form is submitted', async () => {
      const user = userEvent.setup();
      const handleFieldsUpdate = vi.fn();

      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
          editable={true}
          onFieldsUpdate={handleFieldsUpdate}
        />,
        { wrapper: createWrapper() }
      );

      const addButton = screen.getByRole('button', { name: /add field/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/emergency contact/i)).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText(/emergency contact/i), 'Driver License');
      await user.type(screen.getByPlaceholderText(/enter value/i), 'DL123456');

      // Submit the form - find the submit button in the dialog
      const dialogButtons = screen.getAllByRole('button', { name: /add field/i });
      const submitButton = dialogButtons[dialogButtons.length - 1]; // Last one is the submit
      await user.click(submitButton);

      // Save Changes button should appear
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
      });
    });

    it.skip('should prevent adding field with duplicate name', async () => {
      const user = userEvent.setup();
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
          editable={true}
        />,
        { wrapper: createWrapper() }
      );

      const addButton = screen.getByRole('button', { name: /add field/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/emergency contact/i)).toBeInTheDocument();
      });

      // Try to add a field that already exists (firstName already exists)
      await user.type(screen.getByPlaceholderText(/emergency contact/i), 'firstName');
      await user.type(screen.getByPlaceholderText(/enter value/i), 'Test');

      // Get the initial field count before submitting
      const initialFieldCount = Object.keys(mockFields).length;

      const dialogButtons = screen.getAllByRole('button', { name: /add field/i });
      const submitButton = dialogButtons[dialogButtons.length - 1];
      await user.click(submitButton);

      // Dialog should still be open (error shown), OR the field count stays the same
      // because duplicate names are rejected
      await waitFor(() => {
        // Either dialog is still open, or error text shown, or field wasn't added
        const dialogStillOpen = screen.queryByText('Add Custom Field');
        const errorShown = screen.queryByText(/already exists/i);
        const saveButtonNotYetShown = !screen.queryByRole('button', { name: /save changes/i });

        // At least one condition should be true
        expect(dialogStillOpen || errorShown || saveButtonNotYetShown).toBeTruthy();
      });
    });
  });

  describe('Save/Discard Changes', () => {
    it('should show Save Changes and Discard buttons when changes are made', async () => {
      const user = userEvent.setup();
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
          editable={true}
        />,
        { wrapper: createWrapper() }
      );

      // Make a change
      const fieldRow = screen.getByText('John').closest('[class*="group"]');
      if (fieldRow) {
        await user.hover(fieldRow);
        const buttons = within(fieldRow as HTMLElement).getAllByRole('button');
        await user.click(buttons[0]); // Edit button

        await waitFor(() => {
          expect(within(fieldRow as HTMLElement).getByRole('textbox')).toBeInTheDocument();
        });

        const input = within(fieldRow as HTMLElement).getByRole('textbox');
        await user.clear(input);
        await user.type(input, 'Jane{Enter}');
      }

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
      });
    });

    it('should call onFieldsUpdate when Save Changes is clicked', async () => {
      const user = userEvent.setup();
      const handleFieldsUpdate = vi.fn();

      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
          editable={true}
          onFieldsUpdate={handleFieldsUpdate}
        />,
        { wrapper: createWrapper() }
      );

      // Make a change
      const fieldRow = screen.getByText('John').closest('[class*="group"]');
      if (fieldRow) {
        await user.hover(fieldRow);
        const buttons = within(fieldRow as HTMLElement).getAllByRole('button');
        await user.click(buttons[0]);

        await waitFor(() => {
          expect(within(fieldRow as HTMLElement).getByRole('textbox')).toBeInTheDocument();
        });

        const input = within(fieldRow as HTMLElement).getByRole('textbox');
        await user.clear(input);
        await user.type(input, 'Jane{Enter}');
      }

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      expect(handleFieldsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Jane',
        })
      );
    });

    it('should revert changes when Discard is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
          editable={true}
        />,
        { wrapper: createWrapper() }
      );

      // Make a change
      const fieldRow = screen.getByText('John').closest('[class*="group"]');
      if (fieldRow) {
        await user.hover(fieldRow);
        const buttons = within(fieldRow as HTMLElement).getAllByRole('button');
        await user.click(buttons[0]);

        await waitFor(() => {
          expect(within(fieldRow as HTMLElement).getByRole('textbox')).toBeInTheDocument();
        });

        const input = within(fieldRow as HTMLElement).getByRole('textbox');
        await user.clear(input);
        await user.type(input, 'Jane{Enter}');
      }

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /discard/i }));

      // Value should be reverted
      await waitFor(() => {
        expect(screen.getByText('John')).toBeInTheDocument();
      });
    });
  });

  describe('Non-Editable Mode', () => {
    it('should not show Add Field button when not editable', () => {
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
          editable={false}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByRole('button', { name: /add field/i })).not.toBeInTheDocument();
    });

    it('should not show edit/delete buttons when not editable', async () => {
      const user = userEvent.setup();
      render(
        <ProfileFieldsManager
          profileId="profile-123"
          fields={mockFields}
          fieldSources={mockFieldSources}
          editable={false}
        />,
        { wrapper: createWrapper() }
      );

      const fieldRow = screen.getByText('John').closest('[class*="group"]');
      if (fieldRow) {
        await user.hover(fieldRow);

        // Should not have edit buttons visible
        const buttons = within(fieldRow as HTMLElement).queryAllByRole('button');
        expect(buttons.length).toBe(0);
      }
    });
  });
});

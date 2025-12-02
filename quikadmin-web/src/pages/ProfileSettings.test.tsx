import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import ProfileSettings from './ProfileSettings';
import * as profileService from '@/services/userProfileService';

// Mock the profile service
vi.mock('@/services/userProfileService', () => ({
  getProfile: vi.fn(),
  updateProfileField: vi.fn(),
  deleteProfileField: vi.fn(),
  refreshProfile: vi.fn(),
  deleteProfile: vi.fn(),
}));

// Mock toast
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
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

// Mock profile data
const mockProfile = {
  userId: 'user-123',
  fields: [
    {
      key: 'first_name',
      values: ['John'],
      sourceCount: 2,
      confidence: 95.5,
      lastUpdated: '2024-01-15T10:00:00Z',
    },
    {
      key: 'last_name',
      values: ['Doe'],
      sourceCount: 2,
      confidence: 95.5,
      lastUpdated: '2024-01-15T10:00:00Z',
    },
    {
      key: 'email',
      values: ['john.doe@example.com'],
      sourceCount: 3,
      confidence: 98.2,
      lastUpdated: '2024-01-15T12:00:00Z',
    },
    {
      key: 'phone',
      values: ['555-123-4567'],
      sourceCount: 1,
      confidence: 85.0,
      lastUpdated: '2024-01-15T11:00:00Z',
    },
    {
      key: 'street',
      values: ['123 Main St'],
      sourceCount: 2,
      confidence: 90.0,
      lastUpdated: '2024-01-15T10:30:00Z',
    },
    {
      key: 'city',
      values: ['Springfield'],
      sourceCount: 2,
      confidence: 90.0,
      lastUpdated: '2024-01-15T10:30:00Z',
    },
    {
      key: 'custom_field',
      values: ['Custom Value'],
      sourceCount: 1,
      confidence: 100.0,
      lastUpdated: '2024-01-15T13:00:00Z',
    },
  ],
  lastAggregated: '2024-01-15T13:00:00Z',
  documentCount: 5,
};

describe('ProfileSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Loading State', () => {
    it('should show loading skeleton while fetching profile', () => {
      vi.mocked(profileService.getProfile).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { container } = render(<ProfileSettings />, { wrapper: createWrapper() });

      // Loading state shows skeletons
      const skeletons = container.querySelectorAll('[data-slot="skeleton"], .animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Error State', () => {
    it('should show error message when profile fetch fails', async () => {
      vi.mocked(profileService.getProfile).mockRejectedValue(
        new Error('Failed to fetch profile')
      );

      render(<ProfileSettings />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Error state shows alert with error title
        expect(screen.getByRole('alert')).toBeInTheDocument();
      }, { timeout: 3000 });

      expect(screen.getByText(/error loading profile/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it.skip('should retry fetch when Try Again button is clicked', async () => {
      const user = userEvent.setup();
      // Set up a fresh mock that tracks calls
      let callCount = 0;
      vi.mocked(profileService.getProfile).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Failed to fetch profile'));
        }
        return Promise.resolve(mockProfile);
      });

      render(<ProfileSettings />, { wrapper: createWrapper() });

      // Wait for error state to appear
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify error message is shown
      expect(screen.getByText(/error loading profile/i)).toBeInTheDocument();

      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      await user.click(tryAgainButton);

      // Wait for profile to load after retry
      await waitFor(() => {
        expect(screen.getByText('Total Fields')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify the mock was called twice
      expect(callCount).toBe(2);
    });
  });

  describe('Empty State', () => {
    it('should show empty state when profile has no fields', async () => {
      vi.mocked(profileService.getProfile).mockResolvedValue({
        userId: 'user-123',
        fields: [],
        lastAggregated: '2024-01-15T13:00:00Z',
        documentCount: 0,
      });

      render(<ProfileSettings />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Empty state shows "No Profile Data" heading
        expect(screen.getByText(/no profile data/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      expect(screen.getByText(/your profile is empty/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh profile/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add field/i })).toBeInTheDocument();
    });
  });

  describe('Profile Display', () => {
    beforeEach(() => {
      vi.mocked(profileService.getProfile).mockResolvedValue(mockProfile);
    });

    it('should display profile statistics', async () => {
      render(<ProfileSettings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Total Fields')).toBeInTheDocument();
        expect(screen.getByText('7')).toBeInTheDocument(); // 7 fields in mock
        expect(screen.getByText(/Extracted from 5 documents/i)).toBeInTheDocument();
      });

      expect(screen.getByText('Last Updated')).toBeInTheDocument();
      expect(screen.getByText('Average Confidence')).toBeInTheDocument();
    });

    it('should categorize fields into tabs', async () => {
      render(<ProfileSettings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /personal \(2\)/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /contact \(2\)/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /address \(2\)/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /custom \(1\)/i })).toBeInTheDocument();
      });
    });

    it('should display fields in correct categories', async () => {
      const user = userEvent.setup();
      render(<ProfileSettings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('First Name')).toBeInTheDocument();
      });

      // Check Personal tab
      expect(screen.getByText('First Name')).toBeInTheDocument();
      expect(screen.getByText('Last Name')).toBeInTheDocument();

      // Switch to Contact tab
      const contactTab = screen.getByRole('tab', { name: /contact/i });
      await user.click(contactTab);

      await waitFor(() => {
        expect(screen.getByText('Email')).toBeInTheDocument();
        expect(screen.getByText('Phone')).toBeInTheDocument();
      });

      // Switch to Address tab
      const addressTab = screen.getByRole('tab', { name: /address/i });
      await user.click(addressTab);

      await waitFor(() => {
        expect(screen.getByText('Street')).toBeInTheDocument();
        expect(screen.getByText('City')).toBeInTheDocument();
      });

      // Switch to Custom tab
      const customTab = screen.getByRole('tab', { name: /custom/i });
      await user.click(customTab);

      await waitFor(() => {
        expect(screen.getByText('Custom Field')).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      vi.mocked(profileService.getProfile).mockResolvedValue(mockProfile);
    });

    it('should filter fields based on search query', async () => {
      const user = userEvent.setup();
      render(<ProfileSettings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('First Name')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search fields...');
      await user.type(searchInput, 'email');

      // After searching, only email field should be visible in contact tab
      const contactTab = screen.getByRole('tab', { name: /contact/i });
      await user.click(contactTab);

      await waitFor(() => {
        expect(screen.getByText('Email')).toBeInTheDocument();
        expect(screen.queryByText('Phone')).not.toBeInTheDocument();
      });
    });
  });

  describe('Field Operations', () => {
    beforeEach(() => {
      vi.mocked(profileService.getProfile).mockResolvedValue(mockProfile);
    });

    it('should update field value', async () => {
      const user = userEvent.setup();
      vi.mocked(profileService.updateProfileField).mockResolvedValue({
        ...mockProfile,
        fields: mockProfile.fields.map((f) =>
          f.key === 'first_name' ? { ...f, values: ['Jane'] } : f
        ),
      });

      render(<ProfileSettings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('John')).toBeInTheDocument();
      });

      // Find the first field editor and click edit button
      const firstNameField = screen.getByText('John').closest('.group');
      expect(firstNameField).toBeInTheDocument();

      // Hover to show edit button
      if (firstNameField) {
        await user.hover(firstNameField);
        const editButton = within(firstNameField as HTMLElement).getByTitle('Edit field');
        await user.click(editButton);

        // Find input and change value
        const input = within(firstNameField as HTMLElement).getByRole('textbox');
        await user.clear(input);
        await user.type(input, 'Jane');

        // Save changes
        const saveButton = within(firstNameField as HTMLElement).getByTitle('Save changes');
        await user.click(saveButton);

        await waitFor(() => {
          expect(profileService.updateProfileField).toHaveBeenCalledWith('first_name', 'Jane');
        });
      }
    });

    it('should validate field before saving', async () => {
      const user = userEvent.setup();
      render(<ProfileSettings />, { wrapper: createWrapper() });

      // Wait for profile to load - check for tabs
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /contact/i })).toBeInTheDocument();
      });

      // Switch to contact tab first
      const contactTab = screen.getByRole('tab', { name: /contact/i });
      await user.click(contactTab);

      // Now wait for email to appear in contact tab
      await waitFor(() => {
        expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      });

      // Find email field and edit with invalid value
      const emailField = screen.getByText('john.doe@example.com').closest('.group');
      if (emailField) {
        await user.hover(emailField);
        const editButton = within(emailField as HTMLElement).getByTitle('Edit field');
        await user.click(editButton);

        const input = within(emailField as HTMLElement).getByRole('textbox');
        await user.clear(input);
        await user.type(input, 'invalid-email');

        const saveButton = within(emailField as HTMLElement).getByTitle('Save changes');
        await user.click(saveButton);

        // Should show validation error
        await waitFor(() => {
          expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
        });

        // Should not call API
        expect(profileService.updateProfileField).not.toHaveBeenCalled();
      }
    });

    it('should delete field with confirmation', async () => {
      const user = userEvent.setup();
      vi.mocked(profileService.deleteProfileField).mockResolvedValue({
        ...mockProfile,
        fields: mockProfile.fields.filter((f) => f.key !== 'custom_field'),
      });

      render(<ProfileSettings />, { wrapper: createWrapper() });

      // Wait for profile to load
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /custom/i })).toBeInTheDocument();
      });

      // Switch to custom tab
      const customTab = screen.getByRole('tab', { name: /custom/i });
      await user.click(customTab);

      await waitFor(() => {
        expect(screen.getByText('Custom Field')).toBeInTheDocument();
      });

      const customField = screen.getByText('Custom Field').closest('.group');
      if (customField) {
        await user.hover(customField);
        const deleteButton = within(customField as HTMLElement).getByTitle('Delete field');
        await user.click(deleteButton);

        // Confirm deletion in dialog
        const confirmButton = await screen.findByRole('button', { name: /delete/i });
        await user.click(confirmButton);

        await waitFor(() => {
          expect(profileService.deleteProfileField).toHaveBeenCalledWith('custom_field');
        });
      }
    });
  });

  describe('Add Custom Field', () => {
    beforeEach(() => {
      vi.mocked(profileService.getProfile).mockResolvedValue(mockProfile);
    });

    it('should open add field dialog', async () => {
      const user = userEvent.setup();
      render(<ProfileSettings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add field/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add field/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Add Custom Field')).toBeInTheDocument();
        expect(screen.getByLabelText('Field Name')).toBeInTheDocument();
        expect(screen.getByLabelText('Field Value')).toBeInTheDocument();
      });
    });

    it('should add custom field successfully', async () => {
      const user = userEvent.setup();
      vi.mocked(profileService.updateProfileField).mockResolvedValue({
        ...mockProfile,
        fields: [
          ...mockProfile.fields,
          {
            key: 'driver_license',
            values: ['DL123456'],
            sourceCount: 1,
            confidence: 100,
            lastUpdated: '2024-01-15T14:00:00Z',
          },
        ],
      });

      render(<ProfileSettings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add field/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add field/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Field Name')).toBeInTheDocument();
      });

      const fieldNameInput = screen.getByLabelText('Field Name');
      const fieldValueInput = screen.getByLabelText('Field Value');

      await user.type(fieldNameInput, 'Driver License');
      await user.type(fieldValueInput, 'DL123456');

      const submitButton = screen.getByRole('button', { name: /add field/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(profileService.updateProfileField).toHaveBeenCalledWith(
          'driver_license',
          'DL123456'
        );
      });
    });

    it('should validate custom field inputs', async () => {
      const user = userEvent.setup();
      render(<ProfileSettings />, { wrapper: createWrapper() });

      // Wait for profile to load first
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add field/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add field/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Field Name')).toBeInTheDocument();
      });

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: /add field/i });
      await user.click(submitButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/field name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/field value is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Refresh Profile', () => {
    beforeEach(() => {
      vi.mocked(profileService.getProfile).mockResolvedValue(mockProfile);
    });

    it('should refresh profile data', async () => {
      const user = userEvent.setup();
      vi.mocked(profileService.refreshProfile).mockResolvedValue(mockProfile);

      render(<ProfileSettings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(profileService.refreshProfile).toHaveBeenCalled();
      });
    });
  });

  describe('Delete Profile', () => {
    beforeEach(() => {
      vi.mocked(profileService.getProfile).mockResolvedValue(mockProfile);
    });

    it('should delete entire profile with confirmation', async () => {
      const user = userEvent.setup();
      vi.mocked(profileService.deleteProfile).mockResolvedValue();

      render(<ProfileSettings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Danger Zone')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete entire profile/i });
      await user.click(deleteButton);

      // Confirm deletion
      const confirmButton = await screen.findByRole('button', { name: /yes, delete profile/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(profileService.deleteProfile).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      vi.mocked(profileService.getProfile).mockResolvedValue(mockProfile);
    });

    it('should have proper ARIA labels and roles', async () => {
      render(<ProfileSettings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Profile Settings');
      });

      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tab')).toHaveLength(4);
      // Search input is present with placeholder
      expect(screen.getByPlaceholderText('Search fields...')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<ProfileSettings />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /personal/i })).toBeInTheDocument();
      });

      // Tab navigation
      const personalTab = screen.getByRole('tab', { name: /personal/i });
      personalTab.focus();
      expect(personalTab).toHaveFocus();

      // Arrow key navigation between tabs
      await user.keyboard('{ArrowRight}');
      const contactTab = screen.getByRole('tab', { name: /contact/i });
      expect(contactTab).toHaveFocus();
    });
  });
});

/**
 * SimpleFillForm Integration Tests
 * Tests for the complete flow from profile selection to form filling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import SimpleFillForm from '../SimpleFillForm';
import api, { validateForm } from '@/services/api';
import { profilesService } from '@/services/profilesService';
import type { Profile } from '@/types/profile';

// Mock API module
vi.mock('@/services/api', async () => {
  const actual = await vi.importActual('@/services/api');
  return {
    ...actual,
    default: {
      get: vi.fn(),
      post: vi.fn(),
    },
    validateForm: vi.fn(),
  };
});

// Mock profiles service
vi.mock('@/services/profilesService', () => ({
  profilesService: {
    list: vi.fn(),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

// Mock data
const mockPersonalProfile: Profile = {
  id: 'profile-1',
  userId: 'user-123',
  name: 'Personal',
  type: 'PERSONAL',
  status: 'ACTIVE',
  notes: null,
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-20T14:30:00Z',
};

const mockBusinessProfile: Profile = {
  id: 'profile-2',
  userId: 'user-123',
  name: 'ACME Corp',
  type: 'BUSINESS',
  status: 'ACTIVE',
  notes: 'Business profile',
  createdAt: '2024-02-01T09:00:00Z',
  updatedAt: '2024-02-15T11:00:00Z',
};

const mockProfiles = [mockPersonalProfile, mockBusinessProfile];

const mockProfilesResponse = {
  success: true,
  data: {
    profiles: mockProfiles,
    pagination: {
      total: 2,
      limit: 50,
      offset: 0,
      hasMore: false,
    },
  },
};

const mockUserDataResponse = {
  success: true,
  data: {
    fields: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '555-123-4567',
      ssn: '123-45-6789',
    },
    metadata: {},
  },
  fieldSources: {
    firstName: [{ documentId: 'doc-1', fileName: 'passport.pdf', confidence: 0.95 }],
    lastName: [{ documentId: 'doc-1', fileName: 'passport.pdf', confidence: 0.95 }],
    email: [{ documentId: 'doc-2', fileName: 'bank_statement.pdf', confidence: 0.90 }],
    phone: [{ documentId: 'doc-2', fileName: 'bank_statement.pdf', confidence: 0.85 }],
    ssn: [{ documentId: 'doc-1', fileName: 'passport.pdf', confidence: 0.92 }],
  },
  sources: [
    { documentId: 'doc-1', fileName: 'passport.pdf', fileType: 'pdf', fields: ['firstName', 'lastName', 'ssn'], confidence: 0.94 },
    { documentId: 'doc-2', fileName: 'bank_statement.pdf', fileType: 'pdf', fields: ['email', 'phone'], confidence: 0.88 },
  ],
  documentCount: 2,
};

const mockEmptyUserDataResponse = {
  success: true,
  data: { fields: {}, metadata: {} },
  fieldSources: {},
  sources: [],
  documentCount: 0,
};

const mockFormValidationResponse = {
  isValid: true,
  fields: ['first_name', 'last_name', 'email', 'phone_number', 'ssn'],
  fieldTypes: {
    first_name: 'text',
    last_name: 'text',
    email: 'text',
    phone_number: 'text',
    ssn: 'text',
  },
};

const mockFillFormResponse = {
  documentId: 'filled-doc-123',
  downloadUrl: 'https://example.com/download/filled-doc-123',
  confidence: 0.92,
  filledFields: 5,
  warnings: [],
};

describe('SimpleFillForm Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    vi.mocked(profilesService.list).mockResolvedValue(mockProfilesResponse);
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/users/me/data') {
        return Promise.resolve({ data: mockUserDataResponse });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
    vi.mocked(api.post).mockResolvedValue({ data: mockFillFormResponse });
    vi.mocked(validateForm).mockResolvedValue(mockFormValidationResponse);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Profile Selection Integration', () => {
    it('should display profile selector at the top of the page', async () => {
      render(<SimpleFillForm />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Profile selector should be visible
        expect(screen.getAllByText('Personal').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should auto-select first profile on load', async () => {
      render(<SimpleFillForm />, { wrapper: createWrapper() });

      await waitFor(() => {
        // First profile should be auto-selected
        expect(screen.getAllByText('Personal').length).toBeGreaterThanOrEqual(1);
      });

      // The "Using profile" text should appear
      await waitFor(() => {
        expect(screen.getByText('Using profile')).toBeInTheDocument();
      });
    });

    it('should disable form upload until profile is selected', async () => {
      // Return no profiles initially to test the state
      vi.mocked(profilesService.list).mockResolvedValue({
        ...mockProfilesResponse,
        data: { profiles: [], pagination: { total: 0, limit: 50, offset: 0, hasMore: false } },
      });

      render(<SimpleFillForm />, { wrapper: createWrapper() });

      await waitFor(() => {
        const fileInput = screen.getByLabelText(/blank form/i);
        expect(fileInput).toBeDisabled();
      });
    });

    it('should show user data status when profile is selected', async () => {
      render(<SimpleFillForm />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Should show the ready message
        expect(screen.getByText(/ready to fill forms/i)).toBeInTheDocument();
      });

      // Should show document count
      expect(screen.getByText(/2 processed document/i)).toBeInTheDocument();
    });

    it('should reset form state when profile is changed', async () => {
      const user = userEvent.setup();
      render(<SimpleFillForm />, { wrapper: createWrapper() });

      // Wait for initial load and profile selection
      await waitFor(() => {
        expect(screen.getAllByText('Personal').length).toBeGreaterThanOrEqual(1);
      });

      // Change profile
      const changeButton = screen.getByRole('button', { name: /change/i });
      await user.click(changeButton);

      await waitFor(() => {
        expect(screen.getByText('ACME Corp')).toBeInTheDocument();
      });

      await user.click(screen.getByText('ACME Corp'));

      // Form should be reset (still on upload step)
      await waitFor(() => {
        expect(screen.getByText('1. Upload Form')).toBeInTheDocument();
      });
    });
  });

  describe('Form Upload Integration', () => {
    it('should enable form upload after profile selection and data load', async () => {
      render(<SimpleFillForm />, { wrapper: createWrapper() });

      await waitFor(() => {
        const fileInput = screen.getByLabelText(/blank form/i);
        expect(fileInput).not.toBeDisabled();
      });
    });

    it('should show warning when user has no documents', async () => {
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === '/users/me/data') {
          return Promise.resolve({ data: mockEmptyUserDataResponse });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(<SimpleFillForm />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText(/no documents found/i)).toBeInTheDocument();
      });
    });

    it('should show selected profile name in status banner', async () => {
      render(<SimpleFillForm />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText(/using profile "personal"/i)).toBeInTheDocument();
      });
    });
  });

  describe('Complete Form Fill Flow', () => {
    it('should complete the full flow: select profile -> upload form -> fill', async () => {
      const user = userEvent.setup();
      render(<SimpleFillForm />, { wrapper: createWrapper() });

      // Step 1: Profile should be auto-selected
      await waitFor(() => {
        expect(screen.getByText('Using profile')).toBeInTheDocument();
      });

      // Step 2: Upload a form
      const file = new File(['fake pdf content'], 'test_form.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByLabelText(/blank form/i);

      await user.upload(fileInput, file);

      // Should validate the form
      await waitFor(() => {
        expect(validateForm).toHaveBeenCalledWith(file);
      });

      // Should move to mapping step
      await waitFor(() => {
        expect(screen.getByText('Auto-Fill Preview')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Step 3: Click Fill Form
      const fillButton = screen.getByRole('button', { name: /fill form/i });
      await user.click(fillButton);

      // Should call the API
      await waitFor(() => {
        expect(api.post).toHaveBeenCalled();
      });

      // Should show success
      await waitFor(() => {
        expect(screen.getByText('Form Filled Successfully')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should show download button
      expect(screen.getByRole('link', { name: /download filled form/i })).toBeInTheDocument();
    });

    it('should show profile-specific description in mapping step', async () => {
      const user = userEvent.setup();
      render(<SimpleFillForm />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Using profile')).toBeInTheDocument();
      });

      const file = new File(['fake pdf content'], 'test_form.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByLabelText(/blank form/i);
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('Auto-Fill Preview')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should show profile name in description
      expect(screen.getByText(/for "personal"/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should show error when form validation fails', async () => {
      const user = userEvent.setup();
      vi.mocked(validateForm).mockRejectedValue({
        response: { data: { error: 'Invalid PDF format' } },
      });

      render(<SimpleFillForm />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByLabelText(/blank form/i)).not.toBeDisabled();
      });

      const file = new File(['fake pdf content'], 'test_form.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByLabelText(/blank form/i);
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(validateForm).toHaveBeenCalled();
      });
    });

    it('should show error when form filling fails', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockRejectedValue({
        response: { data: { error: 'Form filling failed' } },
      });

      render(<SimpleFillForm />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByLabelText(/blank form/i)).not.toBeDisabled();
      });

      const file = new File(['fake pdf content'], 'test_form.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByLabelText(/blank form/i);
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('Auto-Fill Preview')).toBeInTheDocument();
      }, { timeout: 5000 });

      const fillButton = screen.getByRole('button', { name: /fill form/i });
      await user.click(fillButton);

      // Should return to map step on error
      await waitFor(() => {
        expect(screen.queryByText('Form Filled Successfully')).not.toBeInTheDocument();
      });
    });
  });

  describe('Profile and Data Context', () => {
    it('should show data source count in mapping preview', async () => {
      const user = userEvent.setup();
      render(<SimpleFillForm />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByLabelText(/blank form/i)).not.toBeDisabled();
      });

      const file = new File(['fake pdf content'], 'test_form.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByLabelText(/blank form/i);
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('Auto-Fill Preview')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should show document sources
      expect(screen.getByText('Data Sources')).toBeInTheDocument();
    });

    it('should show Fill Another button after successful fill', async () => {
      const user = userEvent.setup();
      render(<SimpleFillForm />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByLabelText(/blank form/i)).not.toBeDisabled();
      });

      const file = new File(['fake pdf content'], 'test_form.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByLabelText(/blank form/i);
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('Auto-Fill Preview')).toBeInTheDocument();
      }, { timeout: 5000 });

      const fillButton = screen.getByRole('button', { name: /fill form/i });
      await user.click(fillButton);

      await waitFor(() => {
        expect(screen.getByText('Form Filled Successfully')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByRole('button', { name: /fill another/i })).toBeInTheDocument();
    });

    it('should reset form but keep profile when Fill Another is clicked', async () => {
      const user = userEvent.setup();
      render(<SimpleFillForm />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByLabelText(/blank form/i)).not.toBeDisabled();
      });

      const file = new File(['fake pdf content'], 'test_form.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByLabelText(/blank form/i);
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('Auto-Fill Preview')).toBeInTheDocument();
      }, { timeout: 5000 });

      const fillButton = screen.getByRole('button', { name: /fill form/i });
      await user.click(fillButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /fill another/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      await user.click(screen.getByRole('button', { name: /fill another/i }));

      // Should return to upload step
      await waitFor(() => {
        expect(screen.getByText('1. Upload Form')).toBeInTheDocument();
      });

      // Profile should still be selected
      expect(screen.getByText('Using profile')).toBeInTheDocument();
    });
  });
});

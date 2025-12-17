/**
 * ProfileDetail Page Tests
 * Comprehensive tests for the ProfileDetail page component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, MemoryRouter } from 'react-router-dom';
import ProfileDetail from '../ProfileDetail';
import { profilesService } from '@/services/profilesService';
import type { ProfileWithData } from '@/types/profile';

// Mock the profiles service
vi.mock('@/services/profilesService', () => ({
  profilesService: {
    getWithData: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
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

// Helper to create test wrapper with route params
const createWrapper = (profileId: string = 'profile-123') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/profiles/${profileId}`]}>
        <Routes>
          <Route path="/profiles/:id" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

// Mock profile data
const mockProfile: ProfileWithData = {
  id: 'profile-123',
  userId: 'user-123',
  name: 'John Doe Personal',
  type: 'PERSONAL',
  status: 'ACTIVE',
  notes: 'This is my personal profile for tax forms',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-20T14:30:00Z',
  profileData: {
    id: 'profile-data-123',
    profileId: 'profile-123',
    data: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '555-123-4567',
      street: '123 Main St',
      city: 'Springfield',
    },
    fieldSources: {
      firstName: 'ocr',
      lastName: 'ocr',
      email: 'manual',
      phone: 'manual',
      street: 'ocr',
      city: 'ocr',
    },
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z',
  },
};

const mockBusinessProfile: ProfileWithData = {
  id: 'profile-456',
  userId: 'user-123',
  name: 'ACME Corp',
  type: 'BUSINESS',
  status: 'ACTIVE',
  notes: 'Business profile for company documents',
  createdAt: '2024-02-01T09:00:00Z',
  updatedAt: '2024-02-15T11:00:00Z',
  profileData: {
    id: 'profile-data-456',
    profileId: 'profile-456',
    data: {
      companyName: 'ACME Corporation',
      ein: '12-3456789',
    },
    fieldSources: {
      companyName: 'manual',
      ein: 'ocr',
    },
    createdAt: '2024-02-01T09:00:00Z',
    updatedAt: '2024-02-15T11:00:00Z',
  },
};

const mockArchivedProfile: ProfileWithData = {
  ...mockProfile,
  id: 'profile-archived',
  status: 'ARCHIVED',
};

describe('ProfileDetail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Loading State', () => {
    it('should show loading skeleton while fetching profile', () => {
      vi.mocked(profilesService.getWithData).mockImplementation(
        () => new Promise(() => {}) // Never resolves to keep loading state
      );

      render(<ProfileDetail />, { wrapper: createWrapper() });

      // Should show loading state in page header (multiple Loading... texts may appear)
      expect(screen.getAllByText('Loading...').length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });
  });

  describe('Error State / Not Found', () => {
    it('should show not-found state when profile fetch fails', async () => {
      vi.mocked(profilesService.getWithData).mockRejectedValue(
        new Error('Profile not found')
      );

      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Profile Not Found')).toBeInTheDocument();
      });

      expect(screen.getByText(/profile you're looking for doesn't exist/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back to profiles/i })).toBeInTheDocument();
    });

    it('should navigate back when "Back to Profiles" button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(profilesService.getWithData).mockRejectedValue(
        new Error('Profile not found')
      );

      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to profiles/i })).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /back to profiles/i });
      await user.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/profiles');
    });
  });

  describe('Profile Display', () => {
    beforeEach(() => {
      vi.mocked(profilesService.getWithData).mockResolvedValue(mockProfile);
    });

    it('should display profile name and type', async () => {
      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Name appears in both the page header and profile icon section
        expect(screen.getAllByText('John Doe Personal').length).toBeGreaterThanOrEqual(1);
      });

      // Should show Personal profile type
      expect(screen.getAllByText(/personal/i).length).toBeGreaterThan(0);
    });

    it('should display profile information section', async () => {
      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Profile Information')).toBeInTheDocument();
      });

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
    });

    it('should display profile notes when available', async () => {
      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Notes')).toBeInTheDocument();
      });

      expect(screen.getByText('This is my personal profile for tax forms')).toBeInTheDocument();
    });

    it('should display active status badge for active profiles', async () => {
      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('ACTIVE')).toBeInTheDocument();
      });
    });

    it('should display business profile with correct icon', async () => {
      vi.mocked(profilesService.getWithData).mockResolvedValue(mockBusinessProfile);

      render(<ProfileDetail />, { wrapper: createWrapper('profile-456') });

      await waitFor(() => {
        // Name appears in multiple places
        expect(screen.getAllByText('ACME Corp').length).toBeGreaterThanOrEqual(1);
      });

      // Should show Business profile type
      expect(screen.getAllByText(/business/i).length).toBeGreaterThan(0);
    });

    it('should display archived badge for archived profiles', async () => {
      vi.mocked(profilesService.getWithData).mockResolvedValue(mockArchivedProfile);

      render(<ProfileDetail />, { wrapper: createWrapper('profile-archived') });

      await waitFor(() => {
        // Should have multiple 'Archived' badges
        expect(screen.getAllByText('Archived').length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      vi.mocked(profilesService.getWithData).mockResolvedValue(mockProfile);
    });

    it('should navigate back when Back button is clicked', async () => {
      const user = userEvent.setup();
      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getAllByText('John Doe Personal').length).toBeGreaterThanOrEqual(1);
      });

      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/profiles');
    });
  });

  describe('Edit Mode', () => {
    beforeEach(() => {
      vi.mocked(profilesService.getWithData).mockResolvedValue(mockProfile);
    });

    it('should toggle edit mode when Edit button is clicked', async () => {
      const user = userEvent.setup();
      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Should show edit form
      await waitFor(() => {
        expect(screen.getByText('Edit Profile Information')).toBeInTheDocument();
      });

      // Should show Cancel button instead of Edit
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should cancel edit mode when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      // Cancel edit mode
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Should return to view mode
      await waitFor(() => {
        expect(screen.getByText('Profile Information')).toBeInTheDocument();
      });
    });

    it('should show form fields in edit mode', async () => {
      const user = userEvent.setup();
      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      });

      // Form should have name input with current value
      const nameInput = screen.getByLabelText(/name/i);
      expect(nameInput).toHaveValue('John Doe Personal');
    });

    it('should save profile changes when form is submitted', async () => {
      const user = userEvent.setup();
      vi.mocked(profilesService.update).mockResolvedValue({
        ...mockProfile,
        name: 'Updated Profile Name',
      });

      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      });

      // Update the name
      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Profile Name');

      // Submit form
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(profilesService.update).toHaveBeenCalledWith('profile-123', expect.objectContaining({
          name: 'Updated Profile Name',
        }));
      });
    });

    it('should validate name field (required)', async () => {
      const user = userEvent.setup();
      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      });

      // Clear the name field
      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);

      // Submit form
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/profile name is required/i)).toBeInTheDocument();
      });

      // Should not call update
      expect(profilesService.update).not.toHaveBeenCalled();
    });
  });

  describe('Archive/Restore Functionality', () => {
    it('should archive profile when Archive button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(profilesService.getWithData).mockResolvedValue(mockProfile);
      vi.mocked(profilesService.archive).mockResolvedValue(mockArchivedProfile);

      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /archive/i })).toBeInTheDocument();
      });

      const archiveButton = screen.getByRole('button', { name: /archive/i });
      await user.click(archiveButton);

      await waitFor(() => {
        expect(profilesService.archive).toHaveBeenCalledWith('profile-123');
      });
    });

    it('should restore profile when Restore button is clicked on archived profile', async () => {
      const user = userEvent.setup();
      vi.mocked(profilesService.getWithData).mockResolvedValue(mockArchivedProfile);
      vi.mocked(profilesService.restore).mockResolvedValue(mockProfile);

      render(<ProfileDetail />, { wrapper: createWrapper('profile-archived') });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument();
      });

      const restoreButton = screen.getByRole('button', { name: /restore/i });
      await user.click(restoreButton);

      await waitFor(() => {
        expect(profilesService.restore).toHaveBeenCalledWith('profile-archived');
      });
    });
  });

  describe('Delete Functionality', () => {
    beforeEach(() => {
      vi.mocked(profilesService.getWithData).mockResolvedValue(mockProfile);
    });

    it('should show delete confirmation dialog', async () => {
      const user = userEvent.setup();
      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Should show confirmation dialog
      await waitFor(() => {
        expect(screen.getByText('Delete Profile')).toBeInTheDocument();
      });

      expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
    });

    it('should delete profile when confirmed', async () => {
      const user = userEvent.setup();
      vi.mocked(profilesService.delete).mockResolvedValue(undefined);

      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      });

      // Open delete dialog
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      // Find the confirm Delete button in the dialog
      const dialog = screen.getByRole('alertdialog');
      const confirmButton = within(dialog).getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(profilesService.delete).toHaveBeenCalledWith('profile-123');
      });

      // Should navigate to profiles page after deletion
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/profiles');
      });
    });

    it('should cancel delete when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      });

      // Open delete dialog
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      // Cancel deletion
      const dialog = screen.getByRole('alertdialog');
      const cancelButton = within(dialog).getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Should not delete
      expect(profilesService.delete).not.toHaveBeenCalled();
    });
  });

  describe('Stored Fields Section', () => {
    beforeEach(() => {
      vi.mocked(profilesService.getWithData).mockResolvedValue(mockProfile);
    });

    it('should display stored field data section', async () => {
      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Stored Field Data')).toBeInTheDocument();
      });
    });

    it('should show field count in description', async () => {
      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText(/6 data fields? stored/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Fill History Section', () => {
    beforeEach(() => {
      vi.mocked(profilesService.getWithData).mockResolvedValue(mockProfile);
    });

    it('should display form fill history section', async () => {
      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Form Fill History')).toBeInTheDocument();
      });
    });
  });

  describe('Breadcrumb Navigation', () => {
    beforeEach(() => {
      vi.mocked(profilesService.getWithData).mockResolvedValue(mockProfile);
    });

    it('should display correct breadcrumbs', async () => {
      render(<ProfileDetail />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      expect(screen.getByText('Profiles')).toBeInTheDocument();
    });
  });
});

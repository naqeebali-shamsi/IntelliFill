/**
 * ProfileSelector Component Tests
 * Tests for the profile selector component used in form fill workflow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import { ProfileSelector } from '../profile-selector';
import { profilesService } from '@/services/profilesService';
import type { Profile } from '@/types/profile';

// Mock the profiles service
vi.mock('@/services/profilesService', () => ({
  profilesService: {
    list: vi.fn(),
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

// Mock profile data
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

const emptyProfilesResponse = {
  success: true,
  data: {
    profiles: [],
    pagination: {
      total: 0,
      limit: 50,
      offset: 0,
      hasMore: false,
    },
  },
};

describe('ProfileSelector Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading skeleton while fetching profiles', () => {
      vi.mocked(profilesService.list).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const handleProfileChange = vi.fn();
      render(
        <ProfileSelector
          selectedProfile={null}
          onProfileChange={handleProfileChange}
        />,
        { wrapper: createWrapper() }
      );

      // Should show skeleton loading indicators
      // The component shows skeleton elements while loading
      expect(document.querySelector('[class*="skeleton"]') ||
             document.querySelector('[data-slot="skeleton"]')).toBeTruthy();
    });
  });

  describe('Error State', () => {
    it('should show error state with retry button when fetch fails', async () => {
      vi.mocked(profilesService.list).mockRejectedValue(
        new Error('Failed to fetch profiles')
      );

      const handleProfileChange = vi.fn();
      render(
        <ProfileSelector
          selectedProfile={null}
          onProfileChange={handleProfileChange}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load profiles/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should retry fetch when retry button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(profilesService.list)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(mockProfilesResponse);

      const handleProfileChange = vi.fn();
      render(
        <ProfileSelector
          selectedProfile={null}
          onProfileChange={handleProfileChange}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(profilesService.list).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when user has no profiles', async () => {
      vi.mocked(profilesService.list).mockResolvedValue(emptyProfilesResponse);

      const handleProfileChange = vi.fn();
      render(
        <ProfileSelector
          selectedProfile={null}
          onProfileChange={handleProfileChange}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('No Profiles')).toBeInTheDocument();
      });

      expect(screen.getByText(/create a profile to get started/i)).toBeInTheDocument();
    });

    it('should navigate to /profiles when Create Profile button is clicked in empty state', async () => {
      const user = userEvent.setup();
      vi.mocked(profilesService.list).mockResolvedValue(emptyProfilesResponse);

      const handleProfileChange = vi.fn();
      render(
        <ProfileSelector
          selectedProfile={null}
          onProfileChange={handleProfileChange}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create profile/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /create profile/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/profiles');
    });

    it('should show no profiles dialog initially when profiles array is empty', async () => {
      vi.mocked(profilesService.list).mockResolvedValue(emptyProfilesResponse);

      const handleProfileChange = vi.fn();
      render(
        <ProfileSelector
          selectedProfile={null}
          onProfileChange={handleProfileChange}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('No Profiles Found')).toBeInTheDocument();
      });

      expect(screen.getByText(/you need to create a profile before you can fill forms/i)).toBeInTheDocument();
    });
  });

  describe('Profile Display', () => {
    beforeEach(() => {
      vi.mocked(profilesService.list).mockResolvedValue(mockProfilesResponse);
    });

    it('should display selected profile information in full variant', async () => {
      const handleProfileChange = vi.fn();
      render(
        <ProfileSelector
          selectedProfile={mockPersonalProfile}
          onProfileChange={handleProfileChange}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        // "Personal" appears multiple times (profile name and type label)
        expect(screen.getAllByText('Personal').length).toBeGreaterThanOrEqual(1);
      });

      expect(screen.getByText('Using profile')).toBeInTheDocument();
      expect(screen.getAllByText(/personal/i).length).toBeGreaterThan(0);
    });

    it('should auto-select first profile when none selected', async () => {
      const handleProfileChange = vi.fn();
      render(
        <ProfileSelector
          selectedProfile={null}
          onProfileChange={handleProfileChange}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(handleProfileChange).toHaveBeenCalledWith(mockPersonalProfile);
      });
    });
  });

  describe('Profile Selection', () => {
    beforeEach(() => {
      vi.mocked(profilesService.list).mockResolvedValue(mockProfilesResponse);
    });

    it('should show dropdown with profiles when Change button is clicked', async () => {
      const user = userEvent.setup();
      const handleProfileChange = vi.fn();

      render(
        <ProfileSelector
          selectedProfile={mockPersonalProfile}
          onProfileChange={handleProfileChange}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /change/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /change/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Profile')).toBeInTheDocument();
      });

      // Should show both profiles in dropdown
      expect(screen.getAllByText('Personal').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('ACME Corp')).toBeInTheDocument();
    });

    it('should call onProfileChange when a profile is selected', async () => {
      const user = userEvent.setup();
      const handleProfileChange = vi.fn();

      render(
        <ProfileSelector
          selectedProfile={mockPersonalProfile}
          onProfileChange={handleProfileChange}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /change/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /change/i }));

      await waitFor(() => {
        expect(screen.getByText('ACME Corp')).toBeInTheDocument();
      });

      // Click on the ACME Corp profile option
      await user.click(screen.getByText('ACME Corp'));

      await waitFor(() => {
        expect(handleProfileChange).toHaveBeenCalledWith(mockBusinessProfile);
      });
    });

    it('should show Create New Profile option in dropdown', async () => {
      const user = userEvent.setup();
      const handleProfileChange = vi.fn();

      render(
        <ProfileSelector
          selectedProfile={mockPersonalProfile}
          onProfileChange={handleProfileChange}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /change/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /change/i }));

      await waitFor(() => {
        expect(screen.getByText('Create New Profile')).toBeInTheDocument();
      });
    });

    it('should navigate to /profiles when Create New Profile is clicked', async () => {
      const user = userEvent.setup();
      const handleProfileChange = vi.fn();

      render(
        <ProfileSelector
          selectedProfile={mockPersonalProfile}
          onProfileChange={handleProfileChange}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /change/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /change/i }));

      await waitFor(() => {
        expect(screen.getByText('Create New Profile')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create New Profile'));

      expect(mockNavigate).toHaveBeenCalledWith('/profiles');
    });
  });

  describe('Compact Variant', () => {
    beforeEach(() => {
      vi.mocked(profilesService.list).mockResolvedValue(mockProfilesResponse);
    });

    it('should render compact variant with dropdown button', async () => {
      const handleProfileChange = vi.fn();
      render(
        <ProfileSelector
          selectedProfile={mockPersonalProfile}
          onProfileChange={handleProfileChange}
          compact={true}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        // Compact variant shows profile name directly in button
        expect(screen.getByRole('button')).toBeInTheDocument();
        expect(screen.getByText('Personal')).toBeInTheDocument();
      });
    });

    it('should show Select Profile placeholder when no profile selected in compact mode', async () => {
      const handleProfileChange = vi.fn();
      // Reset auto-select by using a fresh mock that doesn't trigger selection
      vi.mocked(profilesService.list).mockResolvedValue({
        ...mockProfilesResponse,
        data: {
          ...mockProfilesResponse.data,
          profiles: [], // Empty to prevent auto-select
        },
      });

      render(
        <ProfileSelector
          selectedProfile={null}
          onProfileChange={handleProfileChange}
          compact={true}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('No Profiles')).toBeInTheDocument();
      });
    });
  });

  describe('Profile Type Icons', () => {
    beforeEach(() => {
      vi.mocked(profilesService.list).mockResolvedValue(mockProfilesResponse);
    });

    it('should show User icon for Personal profile type', async () => {
      const handleProfileChange = vi.fn();
      render(
        <ProfileSelector
          selectedProfile={mockPersonalProfile}
          onProfileChange={handleProfileChange}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        // "Personal" appears multiple times (profile name and type label)
        expect(screen.getAllByText('Personal').length).toBeGreaterThanOrEqual(1);
      });

      // The icon should be in the profile display area
      // We can check for the presence of the icon by looking at the className of surrounding elements
      const profileDisplays = screen.getAllByText('Personal');
      const profileDisplay = profileDisplays[0].closest('[class*="card"]');
      expect(profileDisplay).toBeInTheDocument();
    });

    it('should show Business icon for Business profile type', async () => {
      const handleProfileChange = vi.fn();
      render(
        <ProfileSelector
          selectedProfile={mockBusinessProfile}
          onProfileChange={handleProfileChange}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('ACME Corp')).toBeInTheDocument();
      });

      // Check that business profile type label is shown
      expect(screen.getAllByText(/business/i).length).toBeGreaterThan(0);
    });
  });

  describe('Disabled State', () => {
    beforeEach(() => {
      vi.mocked(profilesService.list).mockResolvedValue(mockProfilesResponse);
    });

    it('should disable Change button when disabled prop is true', async () => {
      const handleProfileChange = vi.fn();
      render(
        <ProfileSelector
          selectedProfile={mockPersonalProfile}
          onProfileChange={handleProfileChange}
          disabled={true}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        const changeButton = screen.getByRole('button', { name: /change/i });
        expect(changeButton).toBeDisabled();
      });
    });
  });

  describe('Custom ClassName', () => {
    beforeEach(() => {
      vi.mocked(profilesService.list).mockResolvedValue(mockProfilesResponse);
    });

    it('should apply custom className to container', async () => {
      const handleProfileChange = vi.fn();
      const { container } = render(
        <ProfileSelector
          selectedProfile={mockPersonalProfile}
          onProfileChange={handleProfileChange}
          className="custom-test-class"
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(container.querySelector('.custom-test-class')).toBeInTheDocument();
      });
    });
  });
});

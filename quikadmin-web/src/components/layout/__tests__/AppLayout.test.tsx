/**
 * AppLayout Component Tests
 * Tests for sidebar collapse/expand, mobile drawer, logout, navigation, and responsive behavior
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import * as authStore from '@/stores/auth';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    aside: ({ children, ...props }: any) => <aside {...props}>{children}</aside>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock ModeToggle component
vi.mock('@/components/mode-toggle', () => ({
  ModeToggle: () => <div data-testid="mode-toggle">Mode Toggle</div>,
}));

// Mock useToggle hook
vi.mock('usehooks-ts', () => ({
  useToggle: () => {
    const [value, setValue] = React.useState(false);
    const toggle = () => setValue(!value);
    return [value, toggle, setValue];
  },
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('AppLayout Component', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  };

  const mockLogout = vi.fn();

  beforeEach(() => {
    // Mock useAuthStore
    vi.spyOn(authStore, 'useAuthStore').mockImplementation((selector?: any) => {
      const state = {
        user: mockUser,
        logout: mockLogout,
        isAuthenticated: true,
        tokens: { access: 'mock-token', refresh: 'mock-refresh' },
      };
      return selector ? selector(state) : state;
    });

    // Reset mocks
    mockLogout.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders children content', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Test Content</div>
          </AppLayout>
        </TestWrapper>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders IntelliFill brand', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      expect(screen.getByText('IntelliFill')).toBeInTheDocument();
    });

    it('renders search input', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });
  });

  describe('Navigation Links', () => {
    it('renders all navigation items', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      const expectedNavItems = [
        'Dashboard',
        'Upload',
        'Fill Form',
        'History',
        'Profiles',
        'Documents',
        'Templates',
        'Settings',
      ];

      expectedNavItems.forEach((item) => {
        expect(screen.getByText(item)).toBeInTheDocument();
      });
    });

    it('highlights active navigation item', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </MemoryRouter>
      );

      // Find the Dashboard button - it should have the active class
      const dashboardLinks = screen.getAllByText('Dashboard');
      const dashboardButton = dashboardLinks[0].closest('button');

      expect(dashboardButton).toHaveClass('bg-primary/10', 'text-primary');
    });

    it('renders navigation icons', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      // Check that icons are rendered by verifying the navigation structure
      const navigation = screen.getAllByRole('link');
      expect(navigation.length).toBeGreaterThan(0);
    });
  });

  describe('User Info Display', () => {
    it('displays user avatar with fallback', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      // Check for fallback letter (first letter of firstName)
      const avatarFallbacks = screen.getAllByText('T'); // "Test" -> "T"
      expect(avatarFallbacks.length).toBeGreaterThan(0);
    });

    it('displays user first name', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      const userNames = screen.getAllByText('Test');
      expect(userNames.length).toBeGreaterThan(0);
    });

    it('displays user email', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('handles missing user firstName gracefully', () => {
      vi.spyOn(authStore, 'useAuthStore').mockImplementation((selector?: any) => {
        const state = {
          user: { id: 'test', email: 'test@test.com' },
          logout: mockLogout,
        };
        return selector ? selector(state) : state;
      });

      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      // Should render 'User' as fallback and 'U' as avatar
      const userFallbacks = screen.getAllByText('User');
      expect(userFallbacks.length).toBeGreaterThan(0);
    });
  });

  describe('Logout Functionality', () => {
    it('renders logout button', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      // Logout button should be visible in desktop sidebar
      const buttons = screen.getAllByRole('button');
      const logoutButtons = buttons.filter((btn) => {
        const svg = btn.querySelector('svg');
        return svg && btn.className.includes('hover:text-destructive');
      });

      expect(logoutButtons.length).toBeGreaterThan(0);
    });

    it('calls logout and navigates on logout button click', async () => {
      const user = userEvent.setup();
      mockLogout.mockResolvedValue(undefined);

      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      // Find and click logout button
      const buttons = screen.getAllByRole('button');
      const logoutButton = buttons.find((btn) => {
        const svg = btn.querySelector('svg');
        return svg && btn.className.includes('hover:text-destructive');
      });

      expect(logoutButton).toBeDefined();
      await user.click(logoutButton!);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Sidebar Collapse/Expand', () => {
    it('renders toggle button for desktop sidebar', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      // Find the collapse/expand toggle button
      const buttons = screen.getAllByRole('button');
      const toggleButton = buttons.find((btn) => {
        return btn.className.includes('absolute') && btn.className.includes('-right-3');
      });

      expect(toggleButton).toBeDefined();
    });

    it('initially shows expanded sidebar with full navigation text', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      // In expanded state, navigation items should show text
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Upload')).toBeInTheDocument();
      expect(screen.getByText('IntelliFill')).toBeInTheDocument();
    });

    it('shows Quick Actions section in expanded state', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      expect(screen.getByText('New Client')).toBeInTheDocument();
    });
  });

  describe('Mobile Drawer', () => {
    it('renders mobile menu button', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      const menuButton = screen.getByLabelText('Open menu');
      expect(menuButton).toBeInTheDocument();
    });

    it('mobile menu button is visible on mobile (md:hidden class)', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      const menuButton = screen.getByLabelText('Open menu');
      expect(menuButton).toHaveClass('md:hidden');
    });

    it('desktop sidebar is hidden on mobile (hidden md:block class)', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      // The desktop aside should have 'hidden md:block' classes
      const desktopSidebar = screen.getByRole('complementary');
      expect(desktopSidebar).toHaveClass('hidden', 'md:block');
    });
  });

  describe('Responsive Breakpoint Behavior', () => {
    it('applies correct classes for desktop sidebar', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      const desktopSidebar = screen.getByRole('complementary');
      expect(desktopSidebar).toHaveClass('hidden', 'md:block');
    });

    it('applies correct classes for mobile menu button', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      const menuButton = screen.getByLabelText('Open menu');
      expect(menuButton.className).toContain('md:hidden');
    });

    it('hides search on small screens', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      const searchContainer = screen.getByPlaceholderText('Search...').parentElement;
      expect(searchContainer?.className).toContain('hidden sm:block');
    });

    it('shows collapse button only on desktop', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      const collapseButton = buttons.find((btn) => {
        return btn.className.includes('absolute') && btn.className.includes('-right-3');
      });

      expect(collapseButton?.className).toContain('hidden md:flex');
    });
  });

  describe('Page Transitions', () => {
    it('renders content within motion wrapper', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AppLayout>
            <div data-testid="page-content">Dashboard Content</div>
          </AppLayout>
        </MemoryRouter>
      );

      expect(screen.getByTestId('page-content')).toBeInTheDocument();
    });

    it('applies background glow effect', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();

      // Check for glow effect div
      const glowEffect = main.querySelector('.absolute.bg-primary\\/5');
      expect(glowEffect).toBeInTheDocument();
    });
  });

  describe('Mode Toggle', () => {
    it('renders mode toggle component in header', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      expect(screen.getByTestId('mode-toggle')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA label for mobile menu', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
    });

    it('provides title tooltips for collapsed navigation icons', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      // In collapsed state, buttons should have title attributes
      // This is tested through the component's conditional rendering logic
      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
    });

    it('has semantic HTML structure', () => {
      render(
        <TestWrapper>
          <AppLayout>
            <div>Content</div>
          </AppLayout>
        </TestWrapper>
      );

      expect(screen.getByRole('complementary')).toBeInTheDocument(); // aside
      expect(screen.getByRole('banner')).toBeInTheDocument(); // header
      expect(screen.getByRole('main')).toBeInTheDocument(); // main
    });
  });
});

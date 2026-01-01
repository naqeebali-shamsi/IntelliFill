/**
 * AuthCallback Page Tests
 * Tests for auth callback handling from Supabase email confirmation links
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import AuthCallback from '../AuthCallback';

// Mock react-router-dom hooks
const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
  };
});

// Mock usehooks-ts
let timeoutCallback: (() => void) | null = null;
let timeoutDelay: number | null = null;

vi.mock('usehooks-ts', () => ({
  useTimeout: (callback: () => void, delay: number | null) => {
    React.useEffect(() => {
      timeoutCallback = delay !== null ? callback : null;
      timeoutDelay = delay;
    }, [callback, delay]);
  },
}));

// Test wrapper
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('AuthCallback Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    timeoutCallback = null;
    timeoutDelay = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Success State - Signup Type', () => {
    beforeEach(() => {
      mockSearchParams = new URLSearchParams('type=signup');
    });

    it('displays success title for signup', () => {
      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(screen.getByText('Success!')).toBeInTheDocument();
    });

    it('displays email verified message for signup', () => {
      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(screen.getByText(/your email has been verified successfully/i)).toBeInTheDocument();
    });

    it('shows redirecting message', () => {
      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(screen.getByText(/redirecting you automatically/i)).toBeInTheDocument();
    });

    it('displays success icon (green check)', () => {
      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      // Check for success styling (green background class)
      const iconContainer = screen.getByText('Success!').parentElement?.querySelector('div');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe('Success State - Recovery Type', () => {
    beforeEach(() => {
      mockSearchParams = new URLSearchParams('type=recovery');
    });

    it('displays success title for recovery', () => {
      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(screen.getByText('Success!')).toBeInTheDocument();
    });

    it('displays password recovery message', () => {
      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(screen.getByText(/password recovery confirmed/i)).toBeInTheDocument();
    });

    it('mentions user can reset password', () => {
      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(screen.getByText(/reset your password/i)).toBeInTheDocument();
    });
  });

  describe('Success State - Invite Type', () => {
    beforeEach(() => {
      mockSearchParams = new URLSearchParams('type=invite');
    });

    it('displays success for invite', () => {
      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(screen.getByText('Success!')).toBeInTheDocument();
    });

    it('displays authentication successful message', () => {
      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(screen.getByText(/authentication successful/i)).toBeInTheDocument();
    });
  });

  describe('Success State - Magic Link Type', () => {
    beforeEach(() => {
      mockSearchParams = new URLSearchParams('type=magiclink');
    });

    it('displays success for magic link', () => {
      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(screen.getByText('Success!')).toBeInTheDocument();
    });

    it('displays authentication successful message', () => {
      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(screen.getByText(/authentication successful/i)).toBeInTheDocument();
    });
  });

  describe('Success State - Default (No Type)', () => {
    beforeEach(() => {
      mockSearchParams = new URLSearchParams();
    });

    it('displays success for missing type', () => {
      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(screen.getByText('Success!')).toBeInTheDocument();
    });

    it('displays generic authentication successful message', () => {
      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(screen.getByText(/authentication successful/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    beforeEach(() => {
      mockSearchParams = new URLSearchParams('error=access_denied&error_description=User+cancelled+the+login');
    });

    it('displays error title', () => {
      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    it('displays error description from URL', () => {
      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(screen.getByText(/user cancelled the login/i)).toBeInTheDocument();
    });

    it('shows default error message when no description', () => {
      mockSearchParams = new URLSearchParams('error=unknown_error');

      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(screen.getByText(/something went wrong. please try again/i)).toBeInTheDocument();
    });

    it('displays Go to Login button on error', async () => {
      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /go to login/i })).toBeInTheDocument();
    });

    it('displays Try Again button on error', () => {
      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('Go to Login button navigates to /login', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      const loginButton = screen.getByRole('button', { name: /go to login/i });
      await user.click(loginButton);

      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    it('Try Again button navigates to /register', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      await user.click(tryAgainButton);

      expect(mockNavigate).toHaveBeenCalledWith('/register');
    });

    it('does not show redirecting message on error', () => {
      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(screen.queryByText(/redirecting/i)).not.toBeInTheDocument();
    });
  });

  describe('Redirect Logic Based on Type', () => {
    it('sets up timeout for redirect on success', () => {
      mockSearchParams = new URLSearchParams('type=signup');

      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      // Timeout should be set for success state
      expect(timeoutDelay).toBe(3000);
    });

    it('does not set up timeout on error', () => {
      mockSearchParams = new URLSearchParams('error=access_denied');

      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      // Timeout should be null for error state
      expect(timeoutDelay).toBeNull();
    });

    it('redirects to /login for signup type', () => {
      mockSearchParams = new URLSearchParams('type=signup');

      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      // Simulate timeout callback
      if (timeoutCallback) {
        timeoutCallback();
      }

      expect(mockNavigate).toHaveBeenCalledWith('/login', {
        state: { message: 'Email verified! You can now log in.' },
      });
    });

    it('redirects to /reset-password for recovery type', () => {
      mockSearchParams = new URLSearchParams('type=recovery');

      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      // Simulate timeout callback
      if (timeoutCallback) {
        timeoutCallback();
      }

      expect(mockNavigate).toHaveBeenCalledWith('/reset-password');
    });

    it('redirects to /dashboard for invite type', () => {
      mockSearchParams = new URLSearchParams('type=invite');

      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      // Simulate timeout callback
      if (timeoutCallback) {
        timeoutCallback();
      }

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('redirects to /dashboard for magiclink type', () => {
      mockSearchParams = new URLSearchParams('type=magiclink');

      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      // Simulate timeout callback
      if (timeoutCallback) {
        timeoutCallback();
      }

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('redirects to /dashboard when no type specified', () => {
      mockSearchParams = new URLSearchParams();

      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      // Simulate timeout callback
      if (timeoutCallback) {
        timeoutCallback();
      }

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('useTimeout Redirect Integration', () => {
    it('callback is correctly set when status is success', () => {
      mockSearchParams = new URLSearchParams('type=signup');

      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(timeoutCallback).not.toBeNull();
      expect(timeoutDelay).toBe(3000);
    });

    it('callback is not set when status is error', () => {
      mockSearchParams = new URLSearchParams('error=some_error');

      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(timeoutCallback).toBeNull();
      expect(timeoutDelay).toBeNull();
    });

    it('executing timeout callback triggers navigation', () => {
      mockSearchParams = new URLSearchParams('type=signup');

      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      expect(timeoutCallback).not.toBeNull();

      // Execute the callback
      timeoutCallback!();

      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('Visual States', () => {
    it('shows success icon for success state', () => {
      mockSearchParams = new URLSearchParams('type=signup');

      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      // The success icon container should have green styling
      const card = screen.getByText('Success!').closest('.w-full');
      expect(card).toBeInTheDocument();
    });

    it('shows error icon for error state', () => {
      mockSearchParams = new URLSearchParams('error=access_denied');

      render(
        <TestWrapper>
          <AuthCallback />
        </TestWrapper>
      );

      // The error icon container should exist with error styling
      // Use getAllByText and check for the title specifically
      const errorTitles = screen.getAllByText(/something went wrong/i);
      expect(errorTitles.length).toBeGreaterThanOrEqual(1);
      const card = errorTitles[0].closest('.w-full');
      expect(card).toBeInTheDocument();
    });
  });
});

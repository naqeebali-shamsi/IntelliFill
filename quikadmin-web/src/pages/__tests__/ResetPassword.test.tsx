/**
 * ResetPassword Page Tests
 * Tests for password reset functionality including validation, token verification, and form submission
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ResetPassword from '../ResetPassword';

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

// Mock the auth store
const mockVerifyResetToken = vi.fn();
const mockResetPassword = vi.fn();

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    verifyResetToken: mockVerifyResetToken,
    resetPassword: mockResetPassword,
  }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock usehooks-ts
let timeoutCallback: (() => void) | null = null;
vi.mock('usehooks-ts', () => ({
  useToggle: (initial: boolean = false) => {
    const [value, setValue] = React.useState(initial);
    return [value, () => setValue((v) => !v), setValue];
  },
  useTimeout: (callback: () => void, delay: number | null) => {
    React.useEffect(() => {
      if (delay !== null && callback) {
        timeoutCallback = callback;
      } else {
        timeoutCallback = null;
      }
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

const TestWrapper = ({ children, initialEntries = ['/reset-password'] }: {
  children: React.ReactNode;
  initialEntries?: string[];
}) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('ResetPassword Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams('token=valid-token&email=test@example.com');
    mockVerifyResetToken.mockResolvedValue({ success: true });
    timeoutCallback = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Token Verification on Mount', () => {
    it('validates token on mount and shows form when valid', async () => {
      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockVerifyResetToken).toHaveBeenCalledWith('valid-token');
      });

      // Form should be visible - use placeholder text to avoid label conflicts
      expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/confirm new password/i)).toBeInTheDocument();
    });

    it('shows invalid token error when token is missing', async () => {
      mockSearchParams = new URLSearchParams();

      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/request new reset link/i)).toBeInTheDocument();
    });

    it('shows invalid token error when token verification fails', async () => {
      mockVerifyResetToken.mockRejectedValue(new Error('Token expired'));

      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument();
      });
    });

    it('displays email in description when provided', async () => {
      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/resetting password for test@example.com/i)).toBeInTheDocument();
      });
    });
  });

  describe('Password Validation', () => {
    it('shows error when password is less than 8 characters', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText(/enter new password/i);
      await user.type(passwordInput, 'short');

      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });

    it('shows error when password has no uppercase letter', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText(/enter new password/i);
      await user.type(passwordInput, 'password123!');

      expect(screen.getByText(/uppercase letter/i)).toBeInTheDocument();
    });

    it('shows error when password has no lowercase letter', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText(/enter new password/i);
      await user.type(passwordInput, 'PASSWORD123!');

      expect(screen.getByText(/lowercase letter/i)).toBeInTheDocument();
    });

    it('shows error when password has no number', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText(/enter new password/i);
      await user.type(passwordInput, 'Password!@#');

      expect(screen.getByText(/one number/i)).toBeInTheDocument();
    });

    it('shows error when password has no special character', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText(/enter new password/i);
      await user.type(passwordInput, 'Password123');

      expect(screen.getByText(/special character/i)).toBeInTheDocument();
    });

    it('clears validation errors when password meets all requirements', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText(/enter new password/i);
      await user.type(passwordInput, 'ValidPass123!');

      // No validation errors should be shown
      expect(screen.queryByText(/at least 8 characters/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/uppercase letter/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/lowercase letter/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/one number/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/special character/i)).not.toBeInTheDocument();
    });
  });

  describe('Password Mismatch', () => {
    it('shows error when passwords do not match', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText(/enter new password/i);
      const confirmInput = screen.getByPlaceholderText(/confirm new password/i);

      await user.type(passwordInput, 'ValidPass123!');
      await user.type(confirmInput, 'DifferentPass123!');

      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });

    it('disables submit button when passwords do not match', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText(/enter new password/i);
      const confirmInput = screen.getByPlaceholderText(/confirm new password/i);
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'ValidPass123!');
      await user.type(confirmInput, 'DifferentPass123!');

      expect(submitButton).toBeDisabled();
    });
  });

  describe('Form Submission', () => {
    it('submits form with matching valid passwords', async () => {
      const user = userEvent.setup();
      mockResetPassword.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText(/enter new password/i);
      const confirmInput = screen.getByPlaceholderText(/confirm new password/i);
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'ValidPass123!');
      await user.type(confirmInput, 'ValidPass123!');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith('valid-token', 'ValidPass123!');
      });
    });

    it('shows error alert when form submission fails', async () => {
      const user = userEvent.setup();
      mockResetPassword.mockRejectedValue(new Error('Reset failed'));

      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText(/enter new password/i);
      const confirmInput = screen.getByPlaceholderText(/confirm new password/i);
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'ValidPass123!');
      await user.type(confirmInput, 'ValidPass123!');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/reset failed|failed to reset/i)).toBeInTheDocument();
      });
    });

    it('shows error when submitting mismatched passwords', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText(/enter new password/i);
      const confirmInput = screen.getByPlaceholderText(/confirm new password/i);

      await user.type(passwordInput, 'ValidPass123!');
      await user.type(confirmInput, 'DifferentPass123!');

      // Try to submit via form
      const form = passwordInput.closest('form');
      if (form) {
        fireEvent.submit(form);
      }

      // Button should be disabled so no submission
      expect(mockResetPassword).not.toHaveBeenCalled();
    });
  });

  describe('Success State', () => {
    it('shows success message after successful reset', async () => {
      const user = userEvent.setup();
      mockResetPassword.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText(/enter new password/i);
      const confirmInput = screen.getByPlaceholderText(/confirm new password/i);
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'ValidPass123!');
      await user.type(confirmInput, 'ValidPass123!');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password reset successful/i)).toBeInTheDocument();
      });
    });

    it('shows redirect message in success state', async () => {
      const user = userEvent.setup();
      mockResetPassword.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText(/enter new password/i);
      const confirmInput = screen.getByPlaceholderText(/confirm new password/i);
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'ValidPass123!');
      await user.type(confirmInput, 'ValidPass123!');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/redirecting to login/i)).toBeInTheDocument();
      });
    });

    it('provides continue to login button in success state', async () => {
      const user = userEvent.setup();
      mockResetPassword.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText(/enter new password/i);
      const confirmInput = screen.getByPlaceholderText(/confirm new password/i);
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'ValidPass123!');
      await user.type(confirmInput, 'ValidPass123!');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /continue to login/i })).toBeInTheDocument();
      });
    });
  });

  describe('useTimeout Redirect Integration', () => {
    it('triggers navigate to /login after success', async () => {
      const user = userEvent.setup();
      mockResetPassword.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText(/enter new password/i);
      const confirmInput = screen.getByPlaceholderText(/confirm new password/i);
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'ValidPass123!');
      await user.type(confirmInput, 'ValidPass123!');
      await user.click(submitButton);

      // Wait for success state
      await waitFor(() => {
        expect(screen.getByText(/password reset successful/i)).toBeInTheDocument();
      });

      // Simulate the timeout callback
      if (timeoutCallback) {
        timeoutCallback();
      }

      expect(mockNavigate).toHaveBeenCalledWith('/login', {
        state: { message: 'Password reset successful. Please log in with your new password.' },
      });
    });
  });

  describe('Password Visibility Toggle', () => {
    it('toggles password visibility', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText(/enter new password/i);
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Find the toggle button (eye icon button)
      const toggleButtons = screen.getAllByRole('button');
      const passwordToggle = toggleButtons.find(
        (btn) => btn.closest('div')?.contains(passwordInput)
      );

      if (passwordToggle) {
        await user.click(passwordToggle);
        expect(passwordInput).toHaveAttribute('type', 'text');
      }
    });
  });

  describe('Navigation Links', () => {
    it('has link back to login page', async () => {
      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /back to login/i })).toBeInTheDocument();
      });
    });

    it('invalid token state has link to request new reset', async () => {
      mockSearchParams = new URLSearchParams();

      render(
        <TestWrapper>
          <ResetPassword />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /request new reset link/i })).toBeInTheDocument();
      });
    });
  });
});

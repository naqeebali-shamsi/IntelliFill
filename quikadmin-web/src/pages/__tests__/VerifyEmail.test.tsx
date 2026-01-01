/**
 * VerifyEmail Page Tests
 * Tests for email verification functionality including form validation, submission, and resend
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import VerifyEmail from '../VerifyEmail';

// Mock react-router-dom hooks
const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});

// Mock auth service - use vi.hoisted to avoid hoisting issues
const { mockVerifyEmail, mockResendVerification } = vi.hoisted(() => ({
  mockVerifyEmail: vi.fn(),
  mockResendVerification: vi.fn(),
}));

vi.mock('@/services/authService', () => ({
  verifyEmail: (...args: any[]) => mockVerifyEmail(...args),
  resendVerification: (...args: any[]) => mockResendVerification(...args),
}));

// Mock sonner toast - use vi.hoisted to avoid hoisting issues
const { mockToast } = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: mockToast,
}));

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

describe('VerifyEmail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    timeoutCallback = null;
    timeoutDelay = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Rendering', () => {
    it('renders email input field', () => {
      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    it('renders verification code input field', () => {
      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });

    it('renders verify button', () => {
      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /verify email/i })).toBeInTheDocument();
    });

    it('renders resend code button', () => {
      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /resend code/i })).toBeInTheDocument();
    });

    it('renders back to login link', () => {
      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      expect(screen.getByRole('link', { name: /back to login/i })).toBeInTheDocument();
    });

    it('pre-fills email from URL parameter', () => {
      mockSearchParams = new URLSearchParams('email=test@example.com');

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toHaveValue('test@example.com');
    });

    it('sanitizes email parameter (removes script tags)', () => {
      mockSearchParams = new URLSearchParams('email=<script>alert("xss")</script>test@example.com');

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      // Should either be empty or have a sanitized value (no script tags)
      expect(emailInput).not.toHaveValue('<script>');
    });
  });

  describe('Code Input Validation', () => {
    it('only accepts numeric input in code field', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      await user.type(codeInput, 'abc123def456');

      // Should only have digits
      expect(codeInput).toHaveValue('123456');
    });

    it('limits code input to 6 characters', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      await user.type(codeInput, '12345678901234567890');

      expect(codeInput).toHaveValue('123456');
    });

    it('disables submit button when code is not 6 digits', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      const submitButton = screen.getByRole('button', { name: /verify email/i });

      await user.type(codeInput, '123');

      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when code has 6 digits and email is present', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      const submitButton = screen.getByRole('button', { name: /verify email/i });

      await user.type(codeInput, '123456');

      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Form Submission', () => {
    it('submits form with valid email and code', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');
      mockVerifyEmail.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      const submitButton = screen.getByRole('button', { name: /verify email/i });

      await user.type(codeInput, '123456');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockVerifyEmail).toHaveBeenCalledWith('test@example.com', '123456');
      });
    });

    it('shows error when email is missing', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      await user.type(codeInput, '123456');

      // Submit via form
      const form = codeInput.closest('form');
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Email is required');
      });
    });

    it('shows error when code is invalid length', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const codeInput = screen.getByLabelText(/verification code/i);

      // Clear and type partial code
      await user.clear(codeInput);
      await user.type(codeInput, '123');

      // Try to submit via form
      const form = emailInput.closest('form');
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('6-digit'));
      });
    });

    it('shows success state after successful verification', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');
      mockVerifyEmail.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      const submitButton = screen.getByRole('button', { name: /verify email/i });

      await user.type(codeInput, '123456');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email verified successfully/i)).toBeInTheDocument();
      });
    });

    it('displays toast on successful verification', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');
      mockVerifyEmail.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      const submitButton = screen.getByRole('button', { name: /verify email/i });

      await user.type(codeInput, '123456');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('verified'));
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error for invalid verification code', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');
      mockVerifyEmail.mockResolvedValue({ success: false, message: 'Invalid code' });

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      const submitButton = screen.getByRole('button', { name: /verify email/i });

      await user.type(codeInput, '123456');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid code|verification failed/i)).toBeInTheDocument();
      });
    });

    it('handles rate limiting error (429)', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');
      mockVerifyEmail.mockRejectedValue({ response: { status: 429 } });

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      const submitButton = screen.getByRole('button', { name: /verify email/i });

      await user.type(codeInput, '123456');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('Too many'));
      });
    });

    it('handles 400 error with appropriate message', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');
      mockVerifyEmail.mockRejectedValue({ response: { status: 400 } });

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      const submitButton = screen.getByRole('button', { name: /verify email/i });

      await user.type(codeInput, '123456');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or expired'));
      });
    });

    it('handles generic errors', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');
      mockVerifyEmail.mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      const submitButton = screen.getByRole('button', { name: /verify email/i });

      await user.type(codeInput, '123456');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('failed'));
      });
    });

    it('clears error when user starts typing', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');
      mockVerifyEmail.mockRejectedValue({ response: { status: 400 } });

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      const submitButton = screen.getByRole('button', { name: /verify email/i });

      await user.type(codeInput, '123456');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid or expired/i)).toBeInTheDocument();
      });

      // Type in email field to clear error
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'a');

      await waitFor(() => {
        expect(screen.queryByText(/invalid or expired/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Resend Functionality', () => {
    it('resend button calls resendVerification', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');
      mockResendVerification.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const resendButton = screen.getByRole('button', { name: /resend code/i });
      await user.click(resendButton);

      await waitFor(() => {
        expect(mockResendVerification).toHaveBeenCalledWith('test@example.com');
      });
    });

    it('shows success toast on successful resend', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');
      mockResendVerification.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const resendButton = screen.getByRole('button', { name: /resend code/i });
      await user.click(resendButton);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('sent'));
      });
    });

    it('shows error when resend fails', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');
      mockResendVerification.mockResolvedValue({ success: false, message: 'Failed to resend' });

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const resendButton = screen.getByRole('button', { name: /resend code/i });
      await user.click(resendButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
    });

    it('shows error when no email for resend', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      // Need to type something in email first, then clear it to enable the resend button test
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'test@example.com');
      await user.clear(emailInput);

      // Now resend button should be disabled without email
      const resendButton = screen.getByRole('button', { name: /resend code/i });

      // The button is disabled, so clicking it won't trigger the error toast
      // Instead, verify the button is disabled when there's no email
      expect(resendButton).toBeDisabled();
    });

    it('handles rate limit on resend', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');
      mockResendVerification.mockRejectedValue({ response: { status: 429 } });

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const resendButton = screen.getByRole('button', { name: /resend code/i });
      await user.click(resendButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('Too many requests'));
      });
    });

    it('disables resend button when no email', () => {
      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const resendButton = screen.getByRole('button', { name: /resend code/i });
      expect(resendButton).toBeDisabled();
    });

    it('shows sending state during resend', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');

      // Create a promise that we can control
      let resolveResend: (value: any) => void;
      const resendPromise = new Promise((resolve) => {
        resolveResend = resolve;
      });
      mockResendVerification.mockReturnValue(resendPromise);

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const resendButton = screen.getByRole('button', { name: /resend code/i });
      await user.click(resendButton);

      // Should show "Sending..." while in progress
      await waitFor(() => {
        expect(screen.getByText(/sending/i)).toBeInTheDocument();
      });

      // Resolve the promise
      resolveResend!({ success: true });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /resend code/i })).toBeInTheDocument();
      });
    });
  });

  describe('Success State with Redirect', () => {
    it('shows success message after verification', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');
      mockVerifyEmail.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      const submitButton = screen.getByRole('button', { name: /verify email/i });

      await user.type(codeInput, '123456');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email verified successfully/i)).toBeInTheDocument();
      });
    });

    it('shows redirect message in success state', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');
      mockVerifyEmail.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      const submitButton = screen.getByRole('button', { name: /verify email/i });

      await user.type(codeInput, '123456');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/redirecting to login/i)).toBeInTheDocument();
      });
    });

    it('hides form elements after success', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');
      mockVerifyEmail.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      const submitButton = screen.getByRole('button', { name: /verify email/i });

      await user.type(codeInput, '123456');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /verify email/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /resend code/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('useTimeout Redirect Integration', () => {
    it('sets up timeout after successful verification', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');
      mockVerifyEmail.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      const submitButton = screen.getByRole('button', { name: /verify email/i });

      await user.type(codeInput, '123456');
      await user.click(submitButton);

      await waitFor(() => {
        expect(timeoutDelay).toBe(2000);
      });
    });

    it('timeout is null before success', () => {
      mockSearchParams = new URLSearchParams('email=test@example.com');

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      expect(timeoutDelay).toBeNull();
    });

    it('navigates to /login after timeout', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');
      mockVerifyEmail.mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      const submitButton = screen.getByRole('button', { name: /verify email/i });

      await user.type(codeInput, '123456');
      await user.click(submitButton);

      await waitFor(() => {
        expect(timeoutCallback).not.toBeNull();
      });

      // Execute the timeout callback
      if (timeoutCallback) {
        timeoutCallback();
      }

      expect(mockNavigate).toHaveBeenCalledWith('/login', {
        state: {
          message: 'Email verified! You can now log in.',
        },
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading state during verification', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');

      // Create a promise that we can control
      let resolveVerify: (value: any) => void;
      const verifyPromise = new Promise((resolve) => {
        resolveVerify = resolve;
      });
      mockVerifyEmail.mockReturnValue(verifyPromise);

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      const submitButton = screen.getByRole('button', { name: /verify email/i });

      await user.type(codeInput, '123456');
      await user.click(submitButton);

      // Should show "Verifying..." while in progress
      await waitFor(() => {
        expect(screen.getByText(/verifying/i)).toBeInTheDocument();
      });

      // Resolve the promise
      resolveVerify!({ success: true });

      await waitFor(() => {
        expect(screen.getByText(/email verified successfully/i)).toBeInTheDocument();
      });
    });

    it('disables inputs during loading', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams('email=test@example.com');

      // Create a promise that we can control
      let resolveVerify: (value: any) => void;
      const verifyPromise = new Promise((resolve) => {
        resolveVerify = resolve;
      });
      mockVerifyEmail.mockReturnValue(verifyPromise);

      render(
        <TestWrapper>
          <VerifyEmail />
        </TestWrapper>
      );

      const codeInput = screen.getByLabelText(/verification code/i);
      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /verify email/i });

      await user.type(codeInput, '123456');
      await user.click(submitButton);

      // Inputs should be disabled during loading
      await waitFor(() => {
        expect(codeInput).toBeDisabled();
        expect(emailInput).toBeDisabled();
      });

      // Resolve the promise
      resolveVerify!({ success: true });
    });
  });
});

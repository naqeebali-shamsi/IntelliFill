/**
 * Phase 1 Component Tests - ErrorBoundary Component
 * Tests for ErrorBoundary fallback UI and error reporting
 */

import React from 'react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary, { ErrorBoundaryState } from '@/components/ErrorBoundary';

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary Component', () => {
  // Suppress console.error for error boundary tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  describe('Normal Rendering', () => {
    it('renders children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      );
      expect(screen.getByText(/test content/i)).toBeInTheDocument();
    });

    it('does not show error UI when no error', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      );
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays error UI when error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    it('displays error message', () => {
      render(
        <ErrorBoundary showDetails>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      // Error message should be in the error details section
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    it('shows try again button', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      const button = screen.getByRole('button', { name: /try again/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Custom Fallback', () => {
    it('renders custom fallback when provided', () => {
      const CustomFallback = ({ resetError }: ErrorBoundaryState) => (
        <div>Custom error message</div>
      );

      render(
        <ErrorBoundary fallback={CustomFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      expect(screen.getByText(/custom error message/i)).toBeInTheDocument();
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });
  });

  describe('Reset Functionality', () => {
    it('calls onReset when try again is clicked', async () => {
      const handleReset = vi.fn();
      const user = userEvent.setup();

      const CustomFallback = ({ resetError }: ErrorBoundaryState) => (
        <div>
          <button
            onClick={() => {
              handleReset();
              resetError();
            }}
          >
            Try Again
          </button>
        </div>
      );

      render(
        <ErrorBoundary fallback={CustomFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const button = screen.getByRole('button', { name: /try again/i });
      await user.click(button);

      expect(handleReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Details', () => {
    it('shows error details in development mode', () => {
      render(
        <ErrorBoundary showDetails>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
      // Error details should be present when showDetails is true
      // Check for the "Error Details" heading which indicates dev mode
      expect(screen.getByText(/error details/i)).toBeInTheDocument();
      // Verify error message is shown - use getAllByText since it appears in multiple places
      const errorMessages = screen.getAllByText(/test error/i);
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Error Callback', () => {
    it('calls onError callback when error is caught', () => {
      const handleError = vi.fn();

      render(
        <ErrorBoundary onError={handleError}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(handleError).toHaveBeenCalledTimes(1);
      expect(handleError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test error' }),
        expect.objectContaining({ componentStack: expect.any(String) })
      );
    });

    it('does not call onError when no error occurs', () => {
      const handleError = vi.fn();

      render(
        <ErrorBoundary onError={handleError}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(handleError).not.toHaveBeenCalled();
    });
  });
});

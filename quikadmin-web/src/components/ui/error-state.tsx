/**
 * ErrorState Component
 *
 * A reusable component for displaying user-friendly error states
 * with retry functionality and navigation options.
 *
 * @module components/ui/error-state
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const errorStateVariants = cva(
  'flex flex-col items-center justify-center text-center',
  {
    variants: {
      size: {
        sm: 'p-4 gap-3',
        md: 'p-8 gap-4',
        lg: 'p-12 gap-6',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export interface ErrorStateProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof errorStateVariants> {
  /**
   * Custom icon component (defaults to AlertCircle)
   */
  icon?: LucideIcon;
  /**
   * Icon className for custom styling
   */
  iconClassName?: string;
  /**
   * Main error title
   */
  title?: string;
  /**
   * Detailed error message (user-friendly, no stack traces)
   */
  message?: string;
  /**
   * Callback function for retry action
   */
  onRetry?: () => void;
  /**
   * Custom label for retry button
   */
  retryLabel?: string;
  /**
   * Show home/back navigation button
   */
  showHomeButton?: boolean;
  /**
   * Custom label for home button
   */
  homeLabel?: string;
  /**
   * Callback for home button (defaults to navigating to /)
   */
  onHome?: () => void;
}

/**
 * ErrorState component for displaying user-friendly error messages.
 *
 * @example
 * // Basic error state with retry
 * <ErrorState
 *   title="Something went wrong"
 *   message="We couldn't load the documents. Please try again."
 *   onRetry={() => refetch()}
 * />
 *
 * @example
 * // Error with custom retry label
 * <ErrorState
 *   title="Connection Error"
 *   message="Unable to connect to the server."
 *   onRetry={handleRetry}
 *   retryLabel="Reconnect"
 * />
 *
 * @example
 * // Error with home button
 * <ErrorState
 *   title="Page Not Found"
 *   message="The page you're looking for doesn't exist."
 *   showHomeButton
 *   onHome={() => navigate('/')}
 * />
 *
 * @example
 * // Full featured error state
 * <ErrorState
 *   title="Failed to Load"
 *   message="Something went wrong while loading your data."
 *   onRetry={refetch}
 *   retryLabel="Try Again"
 *   showHomeButton
 *   homeLabel="Go to Dashboard"
 *   size="lg"
 * />
 */
function ErrorState({
  icon: Icon = AlertCircle,
  iconClassName,
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  retryLabel = 'Try Again',
  showHomeButton = false,
  homeLabel = 'Go Home',
  onHome,
  size,
  className,
  ...props
}: ErrorStateProps) {
  const handleHome = () => {
    if (onHome) {
      onHome();
    } else if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  return (
    <div
      data-testid="error-state"
      data-slot="error-state"
      role="alert"
      aria-live="assertive"
      className={cn(errorStateVariants({ size }), className)}
      {...props}
    >
      {/* Error Icon */}
      <div
        className={cn(
          'rounded-full bg-destructive/10 p-4',
          size === 'sm' && 'p-3',
          size === 'lg' && 'p-6'
        )}
        aria-hidden="true"
      >
        <Icon
          className={cn(
            'text-destructive',
            size === 'sm' && 'h-6 w-6',
            size === 'md' && 'h-10 w-10',
            size === 'lg' && 'h-12 w-12',
            iconClassName
          )}
        />
      </div>

      {/* Error Content */}
      <div className="space-y-2">
        <h3
          data-testid="error-title"
          className={cn(
            'font-semibold text-foreground',
            size === 'sm' && 'text-base',
            size === 'md' && 'text-lg',
            size === 'lg' && 'text-xl'
          )}
        >
          {title}
        </h3>

        {message && (
          <p
            data-testid="error-message"
            className={cn(
              'text-muted-foreground max-w-md mx-auto',
              size === 'sm' && 'text-xs',
              size === 'md' && 'text-sm',
              size === 'lg' && 'text-base'
            )}
          >
            {message}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      {(onRetry || showHomeButton) && (
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          {onRetry && (
            <Button
              data-testid="error-retry-button"
              onClick={onRetry}
              variant="default"
              size={size === 'sm' ? 'sm' : 'default'}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {retryLabel}
            </Button>
          )}

          {showHomeButton && (
            <Button
              data-testid="error-home-button"
              onClick={handleHome}
              variant="outline"
              size={size === 'sm' ? 'sm' : 'default'}
            >
              <Home className="mr-2 h-4 w-4" />
              {homeLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ErrorStateSimple component for minimal error displays.
 */
export interface ErrorStateSimpleProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Error message to display
   */
  message: string;
  /**
   * Optional icon
   */
  icon?: LucideIcon;
  /**
   * Optional retry callback
   */
  onRetry?: () => void;
}

/**
 * ErrorStateSimple component for inline/minimal error states.
 *
 * @example
 * <ErrorStateSimple
 *   message="Failed to load items"
 *   onRetry={() => refetch()}
 * />
 */
function ErrorStateSimple({
  message,
  icon: Icon = AlertCircle,
  onRetry,
  className,
  ...props
}: ErrorStateSimpleProps) {
  return (
    <div
      data-testid="error-state"
      data-slot="error-state-simple"
      role="alert"
      aria-live="assertive"
      className={cn(
        'flex flex-col items-center justify-center p-6 text-center gap-3',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 text-destructive">
        <Icon className="h-5 w-5" aria-hidden="true" />
        <p data-testid="error-message" className="text-sm font-medium">
          {message}
        </p>
      </div>
      {onRetry && (
        <Button
          data-testid="error-retry-button"
          onClick={onRetry}
          variant="ghost"
          size="sm"
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          Retry
        </Button>
      )}
    </div>
  );
}

export { ErrorState, ErrorStateSimple, errorStateVariants };

/**
 * LoadingState Component
 *
 * A unified component for all loading states across the application.
 * Provides three variants: skeleton, spinner, and overlay.
 *
 * @module components/ui/loading-state
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const loadingStateVariants = cva('flex items-center justify-center', {
  variants: {
    variant: {
      skeleton: 'animate-pulse bg-muted rounded',
      spinner: 'text-muted-foreground',
      overlay: 'fixed inset-0 bg-background/80 backdrop-blur-sm z-50',
    },
    size: {
      sm: '',
      md: '',
      lg: '',
    },
  },
  compoundVariants: [
    // Skeleton sizes
    {
      variant: 'skeleton',
      size: 'sm',
      className: 'h-4',
    },
    {
      variant: 'skeleton',
      size: 'md',
      className: 'h-8',
    },
    {
      variant: 'skeleton',
      size: 'lg',
      className: 'h-12',
    },
    // Spinner sizes
    {
      variant: 'spinner',
      size: 'sm',
      className: 'h-4 w-4',
    },
    {
      variant: 'spinner',
      size: 'md',
      className: 'h-8 w-8',
    },
    {
      variant: 'spinner',
      size: 'lg',
      className: 'h-12 w-12',
    },
  ],
  defaultVariants: {
    variant: 'spinner',
    size: 'md',
  },
});

export interface LoadingStateProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof loadingStateVariants> {
  /**
   * Accessible label for screen readers
   */
  'aria-label'?: string;
  /**
   * Optional loading message to display
   */
  message?: string;
  /**
   * Number of skeleton lines (only for skeleton variant)
   */
  lines?: number;
  /**
   * Custom width for skeleton variant
   */
  width?: string;
}

/**
 * LoadingState component for displaying loading indicators.
 *
 * @example
 * // Spinner variant (default)
 * <LoadingState aria-label="Loading data" />
 *
 * @example
 * // Spinner with message
 * <LoadingState message="Loading documents..." />
 *
 * @example
 * // Skeleton variant for content placeholders
 * <LoadingState variant="skeleton" lines={3} />
 *
 * @example
 * // Overlay variant for full-page loading
 * <LoadingState variant="overlay" message="Processing..." />
 */
export function LoadingState({
  variant = 'spinner',
  size = 'md',
  'aria-label': ariaLabel,
  message,
  lines = 1,
  width,
  className,
  ...props
}: LoadingStateProps) {
  // Skeleton variant - render multiple lines
  if (variant === 'skeleton') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={ariaLabel || 'Loading'}
        className={cn('space-y-2 w-full', className)}
        {...props}
      >
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(loadingStateVariants({ variant, size }), 'w-full')}
            style={{ width: width || (index === lines - 1 ? '70%' : '100%') }}
          />
        ))}
        <span className="sr-only">{message || 'Loading content'}</span>
      </div>
    );
  }

  // Overlay variant - full-screen loading
  if (variant === 'overlay') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={ariaLabel || 'Loading'}
        className={cn(loadingStateVariants({ variant }), className)}
        {...props}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          {message && (
            <p className="text-sm font-medium text-foreground" aria-live="polite">
              {message}
            </p>
          )}
          <span className="sr-only">{message || 'Loading'}</span>
        </div>
      </div>
    );
  }

  // Spinner variant - default
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={ariaLabel || 'Loading'}
      className={cn(
        'flex items-center justify-center gap-3',
        variant === 'spinner' && 'flex-col',
        className
      )}
      {...props}
    >
      <Loader2
        className={cn(loadingStateVariants({ variant, size }), 'animate-spin')}
        aria-hidden="true"
      />
      {message && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {message}
        </p>
      )}
      <span className="sr-only">{message || 'Loading'}</span>
    </div>
  );
}

/**
 * LoadingStateSkeleton - Convenience component for skeleton loading
 *
 * @example
 * <LoadingStateSkeleton lines={5} />
 */
export function LoadingStateSkeleton({ lines = 3, ...props }: Omit<LoadingStateProps, 'variant'>) {
  return <LoadingState variant="skeleton" lines={lines} {...props} />;
}

/**
 * LoadingStateSpinner - Convenience component for spinner loading
 *
 * @example
 * <LoadingStateSpinner message="Loading..." />
 */
export function LoadingStateSpinner({ ...props }: Omit<LoadingStateProps, 'variant'>) {
  return <LoadingState variant="spinner" {...props} />;
}

/**
 * LoadingStateOverlay - Convenience component for overlay loading
 *
 * @example
 * <LoadingStateOverlay message="Processing document..." />
 */
export function LoadingStateOverlay({ ...props }: Omit<LoadingStateProps, 'variant'>) {
  return <LoadingState variant="overlay" {...props} />;
}

export { loadingStateVariants };

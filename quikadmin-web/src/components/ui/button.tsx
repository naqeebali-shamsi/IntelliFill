import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Spinner } from './spinner';

/**
 * Button variants using OKLCH-based semantic token system.
 * Interactive states use tokens from theme.css for consistent UX.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // Primary - Brand teal with interactive states
        default:
          'bg-[var(--interactive-primary-default)] text-primary-foreground shadow-[var(--shadow-xs)] hover:bg-[var(--interactive-primary-hover)] active:bg-[var(--interactive-primary-active)] focus-visible:ring-[var(--interactive-primary-focus-ring)] disabled:bg-[var(--interactive-primary-disabled)] disabled:text-[var(--interactive-primary-disabled-text)]',
        // Destructive - Error/danger actions
        destructive:
          'bg-error text-white shadow-[var(--shadow-xs)] hover:bg-[var(--feedback-error-dark)] active:opacity-90 focus-visible:ring-error/30 dark:focus-visible:ring-error/50 disabled:opacity-50',
        // Outline - Border with subtle background hover
        outline:
          'border border-[var(--border-default)] bg-background shadow-[var(--shadow-xs)] hover:bg-[var(--interactive-outline-hover-bg)] hover:border-[var(--border-input-hover)] dark:bg-[var(--surface-1)] dark:border-[var(--border-input)] dark:hover:bg-[var(--surface-1-hover)] disabled:opacity-50',
        // Secondary - Muted slate background
        secondary:
          'bg-[var(--interactive-secondary-default)] text-[var(--interactive-secondary-text)] shadow-[var(--shadow-xs)] hover:bg-[var(--interactive-secondary-hover)] active:bg-[var(--interactive-secondary-active)] focus-visible:ring-[var(--interactive-secondary-focus-ring)] disabled:bg-[var(--interactive-secondary-disabled)] disabled:text-[var(--interactive-secondary-text-disabled)]',
        // Ghost - No background until hover
        ghost:
          'hover:bg-[var(--interactive-ghost-hover)] active:bg-[var(--interactive-ghost-active)] hover:text-accent-foreground disabled:opacity-50',
        // Link - Text only with underline
        link: 'text-[var(--text-link)] underline-offset-4 hover:underline hover:text-[var(--text-link-hover)] disabled:opacity-50',
        // Success - Positive action feedback
        success:
          'bg-success text-white shadow-[var(--shadow-xs)] hover:bg-[var(--feedback-success-dark)] active:opacity-90 focus-visible:ring-success/30 disabled:opacity-50',
        // Warning - Caution/attention actions
        warning:
          'bg-warning text-warning-foreground shadow-[var(--shadow-xs)] hover:bg-[var(--feedback-warning-dark)] active:opacity-90 focus-visible:ring-warning/30 disabled:opacity-50',
        // Info - Informational actions
        info: 'bg-info text-white shadow-[var(--shadow-xs)] hover:bg-[var(--feedback-info-dark)] active:opacity-90 focus-visible:ring-info/30 disabled:opacity-50',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  /**
   * Render as a child component (e.g., Link)
   */
  asChild?: boolean;
  /**
   * Show loading spinner and disable button
   */
  loading?: boolean;
  /**
   * Optional loading label for accessibility
   */
  loadingLabel?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingLabel,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';

    // Determine spinner variant based on button variant
    const getSpinnerVariant = (): 'default' | 'secondary' | 'muted' | 'destructive' => {
      if (variant === 'destructive') return 'destructive';
      if (variant === 'secondary' || variant === 'outline') return 'secondary';
      if (variant === 'ghost' || variant === 'link') return 'muted';
      // Success, warning, info, default use default white spinner
      return 'default';
    };

    // Determine spinner size based on button size
    const getSpinnerSize = (): 'sm' | 'md' | 'lg' => {
      if (size === 'sm' || size === 'icon') return 'sm';
      if (size === 'lg') return 'md';
      return 'sm';
    };

    const isDisabled = disabled || loading;

    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={isDisabled}
        aria-busy={loading}
        aria-label={loading && loadingLabel ? loadingLabel : undefined}
        {...props}
      >
        {loading ? (
          <>
            <Spinner
              size={getSpinnerSize()}
              variant={getSpinnerVariant()}
              className="shrink-0"
              label={loadingLabel}
            />
            {children && <span className="opacity-0">{children}</span>}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };

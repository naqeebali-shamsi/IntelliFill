'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion, AnimatePresence } from 'framer-motion';

import { cn } from '@/lib/utils';

/**
 * SleekBadge - Refined pill badges with optional status dot
 * Inspired by the testimonial carousel's company badge design.
 *
 * Features:
 * - Pill shape with thin border
 * - Optional animated status dot
 * - Monospace font for technical labels
 * - Works on both light and dark backgrounds
 */
const sleekBadgeVariants = cva(
  'inline-flex items-center gap-2 font-mono text-xs border rounded-full transition-colors',
  {
    variants: {
      variant: {
        // Default with subtle border
        default: 'border-sleek-line-default text-sleek-text-default bg-transparent',
        // Subtle with lighter border
        subtle: 'border-sleek-line-subtle text-sleek-text-muted bg-transparent',
        // Active state with brand color
        active: 'border-sleek-dot-active/50 text-sleek-dot-active bg-sleek-dot-active/10',
        // Filled background
        filled: 'border-sleek-line-subtle bg-sleek-line-subtle text-sleek-text-emphasis',
      },
      size: {
        sm: 'px-2 py-0.5 text-[10px]',
        default: 'px-3 py-1',
        lg: 'px-4 py-1.5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface SleekBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof sleekBadgeVariants> {
  /**
   * Show a status dot before the content
   */
  showDot?: boolean;
  /**
   * Animate the dot (pulsing)
   */
  dotPulse?: boolean;
  /**
   * Dot color variant
   */
  dotVariant?: 'default' | 'active' | 'success' | 'warning' | 'error';
}

const dotColors = {
  default: 'bg-sleek-dot',
  active: 'bg-sleek-dot-active',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
};

const SleekBadge = React.forwardRef<HTMLSpanElement, SleekBadgeProps>(
  (
    {
      className,
      variant,
      size,
      showDot = false,
      dotPulse = false,
      dotVariant = 'default',
      children,
      ...props
    },
    ref
  ) => {
    return (
      <span ref={ref} className={cn(sleekBadgeVariants({ variant, size, className }))} {...props}>
        {showDot && (
          <span className="relative flex size-1.5">
            {dotPulse && (
              <motion.span
                className={cn(
                  'absolute inline-flex size-full rounded-full opacity-75',
                  dotColors[dotVariant]
                )}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.75, 0, 0.75],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            )}
            <span
              className={cn('relative inline-flex size-1.5 rounded-full', dotColors[dotVariant])}
            />
          </span>
        )}
        {children}
      </span>
    );
  }
);
SleekBadge.displayName = 'SleekBadge';

/**
 * AnimatedSleekBadge - Badge with entrance/exit animations
 * Useful for dynamic content like status changes.
 */
export interface AnimatedSleekBadgeProps extends SleekBadgeProps {
  /**
   * Unique key for animation
   */
  animationKey?: string | number;
}

const AnimatedSleekBadge = React.forwardRef<HTMLSpanElement, AnimatedSleekBadgeProps>(
  ({ animationKey, ...props }, ref) => {
    return (
      <AnimatePresence mode="wait">
        <motion.span
          key={animationKey}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.4 }}
        >
          <SleekBadge ref={ref} {...props} />
        </motion.span>
      </AnimatePresence>
    );
  }
);
AnimatedSleekBadge.displayName = 'AnimatedSleekBadge';

/**
 * SleekLabel - Vertical text label like "Testimonials" in the carousel
 */
export interface SleekLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Orientation of the label
   */
  orientation?: 'horizontal' | 'vertical';
}

const SleekLabel = React.forwardRef<HTMLSpanElement, SleekLabelProps>(
  ({ className, orientation = 'horizontal', children, style, ...props }, ref) => {
    const isVertical = orientation === 'vertical';

    return (
      <span
        ref={ref}
        className={cn(
          'text-xs font-mono text-sleek-text-muted tracking-widest uppercase',
          className
        )}
        style={{
          ...style,
          ...(isVertical && {
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
          }),
        }}
        {...props}
      >
        {children}
      </span>
    );
  }
);
SleekLabel.displayName = 'SleekLabel';

export { SleekBadge, sleekBadgeVariants, AnimatedSleekBadge, SleekLabel };

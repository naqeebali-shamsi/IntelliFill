'use client';

import * as React from 'react';
import { motion, type Variants } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * AccentLine - Animated decorative lines
 * Inspired by the testimonial carousel's accent elements.
 *
 * Features:
 * - Horizontal/vertical orientation
 * - Optional entrance animation (scaleX/scaleY)
 * - Progress variant with animated fill
 * - Uses sleek tokens for theming
 */
const accentLineVariants = cva('', {
  variants: {
    variant: {
      // Simple static line
      default: 'bg-sleek-line-default',
      // Subtle line
      subtle: 'bg-sleek-line-subtle',
      // Emphasized line
      emphasis: 'bg-sleek-line-emphasis',
      // Active/brand colored
      active: 'bg-sleek-dot-active',
    },
    orientation: {
      horizontal: 'h-px',
      vertical: 'w-px',
    },
    size: {
      sm: '',
      default: '',
      lg: '',
    },
  },
  compoundVariants: [
    // Horizontal sizes
    { orientation: 'horizontal', size: 'sm', className: 'w-4' },
    { orientation: 'horizontal', size: 'default', className: 'w-6' },
    { orientation: 'horizontal', size: 'lg', className: 'w-10' },
    // Vertical sizes
    { orientation: 'vertical', size: 'sm', className: 'h-12' },
    { orientation: 'vertical', size: 'default', className: 'h-24' },
    { orientation: 'vertical', size: 'lg', className: 'h-32' },
  ],
  defaultVariants: {
    variant: 'default',
    orientation: 'horizontal',
    size: 'default',
  },
});

export interface AccentLineProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof accentLineVariants> {
  /**
   * Animate the line entrance
   */
  animate?: boolean;
  /**
   * Animation delay in seconds
   */
  delay?: number;
  /**
   * Animation duration in seconds
   */
  duration?: number;
}

const AccentLine = React.forwardRef<HTMLDivElement, AccentLineProps>(
  (
    {
      className,
      variant,
      orientation,
      size,
      animate: shouldAnimate = false,
      delay = 0,
      duration = 0.6,
      style,
      id,
      'aria-label': ariaLabel,
      'aria-hidden': ariaHidden,
      ...props
    },
    ref
  ) => {
    const isHorizontal = orientation !== 'vertical';

    // Animation variants
    const lineVariants: Variants = {
      hidden: {
        scaleX: isHorizontal ? 0 : 1,
        scaleY: isHorizontal ? 1 : 0,
      },
      visible: {
        scaleX: 1,
        scaleY: 1,
      },
    };

    const commonProps = {
      id,
      'aria-label': ariaLabel,
      'aria-hidden': ariaHidden,
    };

    if (!shouldAnimate) {
      return (
        <div
          ref={ref}
          className={cn(accentLineVariants({ variant, orientation, size, className }))}
          style={style}
          {...commonProps}
        />
      );
    }

    return (
      <motion.div
        ref={ref}
        className={cn(accentLineVariants({ variant, orientation, size, className }))}
        style={{
          ...style,
          originX: 0,
          originY: 0,
        }}
        variants={lineVariants}
        initial="hidden"
        animate="visible"
        transition={{
          duration,
          delay,
          ease: [0.22, 1, 0.36, 1], // Custom ease matching testimonial
        }}
        {...commonProps}
      />
    );
  }
);
AccentLine.displayName = 'AccentLine';

/**
 * ProgressLine - Vertical or horizontal progress indicator
 * Shows progress as a filled portion of a track.
 */
export interface ProgressLineProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Progress value (0-100)
   */
  progress: number;
  /**
   * Line orientation
   */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Whether to animate progress changes
   */
  animate?: boolean;
  /**
   * Track color variant
   */
  trackVariant?: 'default' | 'subtle';
  /**
   * Fill color variant
   */
  fillVariant?: 'default' | 'active';
}

const ProgressLine = React.forwardRef<HTMLDivElement, ProgressLineProps>(
  (
    {
      className,
      progress,
      orientation = 'vertical',
      animate: shouldAnimate = true,
      trackVariant = 'subtle',
      fillVariant = 'active',
      style,
      id,
      ...props
    },
    ref
  ) => {
    const isVertical = orientation === 'vertical';
    const clampedProgress = Math.min(100, Math.max(0, progress));

    const trackClasses = cn(
      'relative overflow-hidden',
      isVertical ? 'w-px h-24' : 'h-px w-24',
      trackVariant === 'subtle' ? 'bg-sleek-line-subtle' : 'bg-sleek-line-default',
      className
    );

    const fillClasses = cn(
      'absolute',
      isVertical ? 'top-0 left-0 w-full' : 'top-0 left-0 h-full',
      fillVariant === 'active' ? 'bg-sleek-dot-active' : 'bg-sleek-line-emphasis'
    );

    const fillStyle: React.CSSProperties = {
      ...(isVertical ? { height: `${clampedProgress}%` } : { width: `${clampedProgress}%` }),
    };

    // Framer Motion animate target (not CSSProperties)
    const animateTarget = isVertical
      ? { height: `${clampedProgress}%` }
      : { width: `${clampedProgress}%` };

    return (
      <div ref={ref} className={trackClasses} style={style} id={id}>
        {shouldAnimate ? (
          <motion.div
            className={fillClasses}
            initial={isVertical ? { height: 0 } : { width: 0 }}
            animate={animateTarget}
            transition={{
              duration: 0.5,
              ease: [0.22, 1, 0.36, 1],
            }}
          />
        ) : (
          <div className={fillClasses} style={fillStyle} />
        )}
      </div>
    );
  }
);
ProgressLine.displayName = 'ProgressLine';

/**
 * SeparatorLine - Subtle border/divider element
 */
export interface SeparatorLineProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Line orientation
   */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Line variant
   */
  variant?: 'default' | 'subtle';
}

const SeparatorLine = React.forwardRef<HTMLDivElement, SeparatorLineProps>(
  ({ className, orientation = 'horizontal', variant = 'subtle', ...props }, ref) => {
    const isVertical = orientation === 'vertical';

    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation={orientation}
        className={cn(
          isVertical
            ? 'border-r border-sleek-line-subtle h-full'
            : 'border-t border-sleek-line-subtle w-full',
          variant === 'default' &&
            (isVertical ? 'border-sleek-line-default' : 'border-sleek-line-default'),
          className
        )}
        {...props}
      />
    );
  }
);
SeparatorLine.displayName = 'SeparatorLine';

export { AccentLine, accentLineVariants, ProgressLine, SeparatorLine };

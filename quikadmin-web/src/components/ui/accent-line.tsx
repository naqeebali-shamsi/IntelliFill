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

export { AccentLine, accentLineVariants };

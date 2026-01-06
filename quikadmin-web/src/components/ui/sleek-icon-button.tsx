'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

/**
 * SleekIconButton - Refined circular icon buttons with subtle borders
 * Inspired by the testimonial carousel's navigation design.
 *
 * Features:
 * - Thin borders with opacity-based hover states
 * - Press animation (scale 0.95)
 * - Works on both light and dark backgrounds
 * - Monochrome design using sleek tokens
 */
const sleekIconButtonVariants = cva(
  'group relative inline-flex items-center justify-center overflow-hidden transition-colors disabled:pointer-events-none disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
  {
    variants: {
      variant: {
        // Default circular with border
        default:
          'rounded-full border border-sleek-line-default hover:border-sleek-line-hover bg-transparent',
        // Square variant
        square:
          'rounded-md border border-sleek-line-default hover:border-sleek-line-hover bg-transparent',
        // Ghost - no border until hover
        ghost:
          'rounded-full border border-transparent hover:border-sleek-line-subtle bg-transparent hover:bg-sleek-line-subtle',
        // Filled - subtle background
        filled:
          'rounded-full border border-sleek-line-subtle bg-sleek-line-subtle hover:bg-sleek-line-default',
      },
      size: {
        sm: 'size-8',
        default: 'size-10',
        lg: 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface SleekIconButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof sleekIconButtonVariants> {
  /**
   * The icon to display
   */
  children: React.ReactNode;
  /**
   * Accessible label for the button
   */
  'aria-label': string;
}

const SleekIconButton = React.forwardRef<HTMLButtonElement, SleekIconButtonProps>(
  (
    {
      className,
      variant,
      size,
      children,
      type = 'button',
      onClick,
      disabled,
      id,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        type={type}
        id={id}
        disabled={disabled}
        onClick={onClick}
        aria-label={ariaLabel}
        className={cn(sleekIconButtonVariants({ variant, size, className }))}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.1 }}
      >
        {/* Icon container with hover color transition */}
        <span className="relative z-10 text-sleek-text-default group-hover:text-sleek-text-emphasis transition-colors [&_svg]:size-4 [&_svg]:stroke-[1.5]">
          {children}
        </span>
      </motion.button>
    );
  }
);
SleekIconButton.displayName = 'SleekIconButton';

/**
 * Pre-styled arrow icons matching the testimonial design
 */
const ChevronLeftIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 12L6 8L10 4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronRightIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M6 4L10 8L6 12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronUpIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 10L8 6L12 10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronDownIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 6L8 10L12 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export {
  SleekIconButton,
  sleekIconButtonVariants,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
};

'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * SleekTooltip - Animated tooltip with smooth positioning
 * Adapted from the bottom-menu animated tooltip pattern.
 *
 * Features:
 * - Smooth entrance/exit animations
 * - Glass morphism background
 * - Automatic positioning relative to trigger
 * - Uses sleek design tokens
 */

const springConfig = {
  duration: 0.3,
  ease: 'easeInOut' as const,
};

const sleekTooltipVariants = cva(
  'absolute z-50 pointer-events-none inline-flex justify-center items-center overflow-hidden',
  {
    variants: {
      variant: {
        // Default sleek style
        default: cn(
          'bg-surface-3/95 backdrop-blur-md',
          'border border-sleek-line-default',
          'shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_4px_12px_-2px_rgba(0,0,0,0.1)]',
          'dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_4px_12px_-2px_rgba(0,0,0,0.3)]'
        ),
        // More prominent style
        elevated: cn(
          'bg-surface-3/98 backdrop-blur-lg',
          'border border-sleek-line-emphasis',
          'shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_8px_16px_-4px_rgba(0,0,0,0.15)]',
          'dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_8px_16px_-4px_rgba(0,0,0,0.4)]'
        ),
        // Minimal style
        subtle: cn('bg-surface-2/90 backdrop-blur-sm', 'border border-sleek-line-subtle'),
      },
      size: {
        sm: 'h-6 px-2 rounded-md text-[11px]',
        default: 'h-7 px-3 rounded-lg text-[13px]',
        lg: 'h-8 px-4 rounded-lg text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface SleekTooltipProps extends VariantProps<typeof sleekTooltipVariants> {
  /**
   * The content to display in the tooltip
   */
  content: React.ReactNode;
  /**
   * Whether the tooltip is visible
   */
  open: boolean;
  /**
   * Position relative to trigger
   */
  position?: 'top' | 'bottom';
  /**
   * Additional class names
   */
  className?: string;
  /**
   * Offset from the trigger element in pixels
   */
  offset?: number;
}

/**
 * SleekTooltipContent - The tooltip content with animations
 */
export const SleekTooltipContent = React.forwardRef<HTMLDivElement, SleekTooltipProps>(
  ({ content, open, position = 'top', variant, size, className, offset = 8 }, ref) => {
    const isTop = position === 'top';
    const positionClass = isTop ? `-top-[${31 + offset}px]` : `top-full mt-2`;

    return (
      <AnimatePresence>
        {open && (
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: isTop ? 5 : -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: isTop ? 5 : -5 }}
            transition={springConfig}
            className={cn(
              sleekTooltipVariants({ variant, size }),
              isTop ? 'bottom-full mb-2' : 'top-full mt-2',
              'left-1/2 -translate-x-1/2',
              className
            )}
          >
            <span className="font-medium leading-tight whitespace-nowrap text-text-body">
              {content}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);
SleekTooltipContent.displayName = 'SleekTooltipContent';

/**
 * SleekTooltipTrigger - Wrapper component for tooltip triggers
 */
export interface SleekTooltipTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const SleekTooltipTrigger = React.forwardRef<HTMLDivElement, SleekTooltipTriggerProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('relative inline-flex', className)} {...props}>
        {children}
      </div>
    );
  }
);
SleekTooltipTrigger.displayName = 'SleekTooltipTrigger';

/**
 * useSleekTooltip - Hook for managing tooltip state
 */
export function useSleekTooltip(delay = 0) {
  const [open, setOpen] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

  const handleMouseEnter = React.useCallback(() => {
    if (delay > 0) {
      timeoutRef.current = setTimeout(() => setOpen(true), delay);
    } else {
      setOpen(true);
    }
  }, [delay]);

  const handleMouseLeave = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setOpen(false);
  }, []);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    open,
    setOpen,
    triggerProps: {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onFocus: handleMouseEnter,
      onBlur: handleMouseLeave,
    },
  };
}

/**
 * SleekTooltip - Complete tooltip component combining trigger and content
 */
export interface SleekTooltipCompleteProps
  extends Omit<SleekTooltipProps, 'open'>, VariantProps<typeof sleekTooltipVariants> {
  /**
   * The trigger element
   */
  children: React.ReactNode;
  /**
   * Delay before showing tooltip (ms)
   */
  delayMs?: number;
}

export const SleekTooltip = React.forwardRef<HTMLDivElement, SleekTooltipCompleteProps>(
  ({ children, content, position, variant, size, className, delayMs = 0 }, ref) => {
    const { open, triggerProps } = useSleekTooltip(delayMs);

    return (
      <SleekTooltipTrigger ref={ref} {...triggerProps}>
        {children}
        <SleekTooltipContent
          content={content}
          open={open}
          position={position}
          variant={variant}
          size={size}
          className={className}
        />
      </SleekTooltipTrigger>
    );
  }
);
SleekTooltip.displayName = 'SleekTooltip';

/**
 * SleekIconBar - A horizontal bar of icon buttons with animated tooltips
 * Adapted from the MenuBar pattern.
 */
export interface SleekIconBarItem {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

export interface SleekIconBarProps extends React.HTMLAttributes<HTMLDivElement> {
  items: SleekIconBarItem[];
  /**
   * Variant for the bar container
   */
  barVariant?: 'default' | 'ghost';
}

export const SleekIconBar = React.forwardRef<HTMLDivElement, SleekIconBarProps>(
  ({ items, className, barVariant = 'default', ...props }, ref) => {
    const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
    const barRef = React.useRef<HTMLDivElement>(null);
    const [tooltipLeft, setTooltipLeft] = React.useState(0);

    React.useEffect(() => {
      if (activeIndex !== null && barRef.current) {
        const button = barRef.current.children[activeIndex] as HTMLElement;
        if (button) {
          const barRect = barRef.current.getBoundingClientRect();
          const buttonRect = button.getBoundingClientRect();
          const center = buttonRect.left - barRect.left + buttonRect.width / 2;
          setTooltipLeft(center);
        }
      }
    }, [activeIndex]);

    const barClasses = cn(
      'relative h-10 px-1.5 inline-flex justify-center items-center gap-1 overflow-visible',
      barVariant === 'default' && [
        'rounded-full bg-surface-3/95 backdrop-blur-md',
        'border border-sleek-line-default',
        'shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_4px_12px_-2px_rgba(0,0,0,0.1)]',
        'dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_4px_12px_-2px_rgba(0,0,0,0.3)]',
      ],
      barVariant === 'ghost' && 'rounded-full gap-0.5',
      className
    );

    return (
      <div ref={ref} className="relative" {...props}>
        {/* Animated tooltip */}
        <AnimatePresence>
          {activeIndex !== null && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={springConfig}
              className="absolute -top-[38px] left-0 right-0 flex justify-center pointer-events-none z-50"
            >
              <motion.div
                className={cn(
                  'h-7 px-3 rounded-lg inline-flex justify-center items-center overflow-hidden',
                  'bg-surface-3/95 backdrop-blur-md',
                  'border border-sleek-line-default',
                  'shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_4px_8px_-2px_rgba(0,0,0,0.1)]',
                  'dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_4px_8px_-2px_rgba(0,0,0,0.2)]'
                )}
                style={{ position: 'absolute', left: tooltipLeft, transform: 'translateX(-50%)' }}
                animate={{ left: tooltipLeft }}
                transition={springConfig}
              >
                <span className="text-[13px] font-medium leading-tight whitespace-nowrap text-text-body">
                  {items[activeIndex].label}
                </span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Icon buttons */}
        <div ref={barRef} className={barClasses}>
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              className={cn(
                'size-8 rounded-full flex justify-center items-center transition-colors',
                'text-sleek-text-default hover:text-sleek-text-emphasis',
                'hover:bg-sleek-line-subtle',
                '[&_svg]:size-[18px] [&_svg]:stroke-[1.5]'
              )}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={item.onClick}
            >
              {item.icon}
              <span className="sr-only">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
);
SleekIconBar.displayName = 'SleekIconBar';

export { sleekTooltipVariants };

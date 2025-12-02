import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const skeletonVariants = cva(
  "animate-pulse rounded-md bg-muted",
  {
    variants: {
      variant: {
        rectangular: "",
        circular: "rounded-full",
        text: "rounded-sm",
      },
      animation: {
        pulse: "animate-pulse",
        wave: "animate-shimmer",
        none: "",
      },
    },
    defaultVariants: {
      variant: "rectangular",
      animation: "pulse",
    },
  }
)

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  /**
   * Width of the skeleton. Can be a string (e.g., "100px", "50%") or number (px).
   */
  width?: string | number
  /**
   * Height of the skeleton. Can be a string (e.g., "100px", "50%") or number (px).
   */
  height?: string | number
}

/**
 * Skeleton component for loading states.
 *
 * @example
 * // Basic skeleton
 * <Skeleton className="h-4 w-[250px]" />
 *
 * @example
 * // Circular skeleton (avatar)
 * <Skeleton variant="circular" className="h-12 w-12" />
 *
 * @example
 * // Text skeleton
 * <Skeleton variant="text" className="h-4 w-full" />
 *
 * @example
 * // Custom dimensions
 * <Skeleton width={200} height={100} />
 */
function Skeleton({
  className,
  variant,
  animation,
  width,
  height,
  style,
  ...props
}: SkeletonProps) {
  const inlineStyles = {
    ...style,
    ...(width !== undefined && {
      width: typeof width === "number" ? `${width}px` : width,
    }),
    ...(height !== undefined && {
      height: typeof height === "number" ? `${height}px` : height,
    }),
  }

  return (
    <div
      data-slot="skeleton"
      className={cn(skeletonVariants({ variant, animation }), className)}
      style={inlineStyles}
      role="status"
      aria-label="Loading..."
      aria-live="polite"
      {...props}
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}

/**
 * SkeletonText component for loading text content.
 * Creates multiple skeleton lines with optional last line width.
 */
export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Number of skeleton lines to render
   */
  lines?: number
  /**
   * Width of the last line (useful for natural-looking text skeletons)
   */
  lastLineWidth?: string
}

/**
 * SkeletonText component for loading multi-line text content.
 *
 * @example
 * <SkeletonText lines={3} lastLineWidth="60%" />
 */
function SkeletonText({
  lines = 3,
  lastLineWidth = "80%",
  className,
  ...props
}: SkeletonTextProps) {
  return (
    <div
      data-slot="skeleton-text"
      className={cn("space-y-2", className)}
      role="status"
      aria-label="Loading text..."
      {...props}
    >
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          variant="text"
          className={cn("h-4", index === lines - 1 && "w-4/5")}
          style={index === lines - 1 ? { width: lastLineWidth } : undefined}
        />
      ))}
      <span className="sr-only">Loading text...</span>
    </div>
  )
}

export { Skeleton, SkeletonText, skeletonVariants }

/**
 * Lazy Render Component
 *
 * Wrapper component for lazy rendering grid items using IntersectionObserver.
 * Only renders children when the element becomes visible in the viewport.
 *
 * @module components/ui/lazy-render
 */

import * as React from "react"
import { useIntersectionObserver } from "@/hooks"
import { cn } from "@/lib/utils"
import { Skeleton } from "./skeleton"

interface LazyRenderProps {
  children: React.ReactNode
  /** Placeholder while not visible (default: Skeleton) */
  placeholder?: React.ReactNode
  /** Height for placeholder to prevent layout shift */
  placeholderHeight?: number | string
  /** Class for placeholder container */
  placeholderClassName?: string
  /** Root margin for early loading (default: "200px 0px") */
  rootMargin?: string
  /** IntersectionObserver threshold (default: 0) */
  threshold?: number
  /** Wrapper element className */
  className?: string
}

/**
 * LazyRender - Only renders children when visible in viewport
 *
 * @example
 * ```tsx
 * <LazyRender placeholderHeight={180}>
 *   <DocumentCard document={doc} />
 * </LazyRender>
 * ```
 */
export function LazyRender({
  children,
  placeholder,
  placeholderHeight = "auto",
  placeholderClassName,
  rootMargin = "200px 0px",
  threshold = 0,
  className,
}: LazyRenderProps) {
  const [hasBeenVisible, setHasBeenVisible] = React.useState(false)
  const { isIntersecting, ref } = useIntersectionObserver({
    rootMargin,
    threshold,
    freezeOnceVisible: true,
  })

  // Once visible, always render (freeze behavior)
  React.useEffect(() => {
    if (isIntersecting && !hasBeenVisible) {
      setHasBeenVisible(true)
    }
  }, [isIntersecting, hasBeenVisible])

  const shouldRender = hasBeenVisible || isIntersecting

  const defaultPlaceholder = (
    <Skeleton
      className={cn("w-full", placeholderClassName)}
      style={{
        height: typeof placeholderHeight === "number" ? `${placeholderHeight}px` : placeholderHeight,
      }}
    />
  )

  return (
    <div ref={ref} className={className}>
      {shouldRender ? children : (placeholder ?? defaultPlaceholder)}
    </div>
  )
}

export default LazyRender

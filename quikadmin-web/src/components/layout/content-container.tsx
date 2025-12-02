import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const contentContainerVariants = cva(
  "mx-auto w-full px-4 sm:px-6 lg:px-8",
  {
    variants: {
      maxWidth: {
        sm: "max-w-screen-sm", // 640px
        md: "max-w-screen-md", // 768px
        lg: "max-w-screen-lg", // 1024px
        xl: "max-w-screen-xl", // 1280px
        "2xl": "max-w-screen-2xl", // 1536px
        full: "max-w-full",
      },
      padding: {
        none: "p-0",
        sm: "py-4",
        md: "py-6",
        lg: "py-8",
        xl: "py-12",
      },
    },
    defaultVariants: {
      maxWidth: "2xl",
      padding: "md",
    },
  }
)

export interface ContentContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof contentContainerVariants> {
  /**
   * Content to render inside the container
   */
  children: React.ReactNode
  /**
   * Whether to render as a semantic main element
   */
  asMain?: boolean
}

/**
 * ContentContainer component for consistent content width and spacing.
 *
 * @example
 * // Default container (2xl width, medium padding)
 * <ContentContainer>
 *   <PageContent />
 * </ContentContainer>
 *
 * @example
 * // As main element with custom width
 * <ContentContainer asMain maxWidth="lg">
 *   <PageContent />
 * </ContentContainer>
 *
 * @example
 * // Full width with no padding
 * <ContentContainer maxWidth="full" padding="none">
 *   <FullWidthContent />
 * </ContentContainer>
 */
function ContentContainer({
  maxWidth,
  padding,
  asMain = false,
  className,
  children,
  ...props
}: ContentContainerProps) {
  const Component = asMain ? "main" : "div"

  return (
    <Component
      data-slot="content-container"
      className={cn(contentContainerVariants({ maxWidth, padding }), className)}
      {...props}
    >
      {children}
    </Component>
  )
}

/**
 * ContentSection component for sections within a container.
 */
export interface ContentSectionProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Content to render inside the section
   */
  children: React.ReactNode
  /**
   * Optional section title
   */
  title?: string
  /**
   * Optional section description
   */
  description?: string
}

/**
 * ContentSection component for semantic content sections.
 *
 * @example
 * <ContentContainer>
 *   <ContentSection title="Overview" description="Project statistics">
 *     <Stats />
 *   </ContentSection>
 *   <ContentSection title="Recent Activity">
 *     <ActivityFeed />
 *   </ContentSection>
 * </ContentContainer>
 */
function ContentSection({
  title,
  description,
  children,
  className,
  ...props
}: ContentSectionProps) {
  return (
    <section
      data-slot="content-section"
      className={cn("space-y-4", className)}
      {...props}
    >
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          )}
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  )
}

export { ContentContainer, ContentSection, contentContainerVariants }

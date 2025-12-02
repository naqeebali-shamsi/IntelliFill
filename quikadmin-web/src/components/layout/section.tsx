import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card"

const sectionVariants = cva(
  "space-y-4",
  {
    variants: {
      variant: {
        default: "",
        card: "",
        ghost: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface SectionProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof sectionVariants> {
  /**
   * Section title
   */
  title?: string
  /**
   * Optional description text
   */
  description?: string
  /**
   * Optional action buttons or elements
   */
  actions?: React.ReactNode
  /**
   * Content to render inside the section
   */
  children: React.ReactNode
}

/**
 * Section component for organizing content with consistent styling.
 *
 * @example
 * // Default section with title
 * <Section title="Overview" description="Project statistics">
 *   <Stats />
 * </Section>
 *
 * @example
 * // Card variant with actions
 * <Section
 *   variant="card"
 *   title="Recent Documents"
 *   actions={<Button variant="ghost" size="sm">View All</Button>}
 * >
 *   <DocumentList />
 * </Section>
 *
 * @example
 * // Ghost variant (no background)
 * <Section variant="ghost" title="Activity Feed">
 *   <ActivityList />
 * </Section>
 */
function Section({
  variant,
  title,
  description,
  actions,
  children,
  className,
  ...props
}: SectionProps) {
  // Card variant uses Card component
  if (variant === "card") {
    return (
      <Card className={cn(className)} {...props}>
        {(title || description || actions) && (
          <CardHeader>
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
            {actions && <CardAction>{actions}</CardAction>}
          </CardHeader>
        )}
        <CardContent>{children}</CardContent>
      </Card>
    )
  }

  // Default and ghost variants
  return (
    <section
      data-slot="section"
      className={cn(sectionVariants({ variant }), className)}
      {...props}
    >
      {(title || description || actions) && (
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            {title && (
              <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            )}
            {description && (
              <p className="text-muted-foreground text-sm">{description}</p>
            )}
          </div>

          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      )}

      <div>{children}</div>
    </section>
  )
}

/**
 * SectionDivider component for visual separation between sections.
 */
export interface SectionDividerProps extends React.HTMLAttributes<HTMLHRElement> {
  /**
   * Optional text label for the divider
   */
  label?: string
}

/**
 * SectionDivider component for separating sections.
 *
 * @example
 * <Section title="Profile">...</Section>
 * <SectionDivider />
 * <Section title="Settings">...</Section>
 *
 * @example
 * // With label
 * <SectionDivider label="Or" />
 */
function SectionDivider({
  label,
  className,
  ...props
}: SectionDividerProps) {
  if (label) {
    return (
      <div
        data-slot="section-divider-with-label"
        className={cn("relative my-8", className)}
        role="separator"
        {...props}
      >
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {label}
          </span>
        </div>
      </div>
    )
  }

  return (
    <hr
      data-slot="section-divider"
      className={cn("my-8 border-border", className)}
      role="separator"
      {...props}
    />
  )
}

/**
 * SectionGrid component for responsive grid layouts within sections.
 */
export interface SectionGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Number of columns (responsive)
   */
  cols?: {
    default?: 1 | 2 | 3 | 4 | 5 | 6
    sm?: 1 | 2 | 3 | 4 | 5 | 6
    md?: 1 | 2 | 3 | 4 | 5 | 6
    lg?: 1 | 2 | 3 | 4 | 5 | 6
    xl?: 1 | 2 | 3 | 4 | 5 | 6
  }
  /**
   * Gap size between grid items
   */
  gap?: "sm" | "md" | "lg" | "xl"
  /**
   * Content to render in the grid
   */
  children: React.ReactNode
}

/**
 * SectionGrid component for responsive grid layouts.
 *
 * @example
 * <SectionGrid cols={{ default: 1, md: 2, lg: 3 }} gap="md">
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 *   <Card>Item 3</Card>
 * </SectionGrid>
 */
function SectionGrid({
  cols = { default: 1, md: 2, lg: 3 },
  gap = "md",
  children,
  className,
  ...props
}: SectionGridProps) {
  const colsClass = [
    cols.default && `grid-cols-${cols.default}`,
    cols.sm && `sm:grid-cols-${cols.sm}`,
    cols.md && `md:grid-cols-${cols.md}`,
    cols.lg && `lg:grid-cols-${cols.lg}`,
    cols.xl && `xl:grid-cols-${cols.xl}`,
  ].filter(Boolean).join(" ")

  const gapClass = {
    sm: "gap-2",
    md: "gap-4",
    lg: "gap-6",
    xl: "gap-8",
  }[gap]

  return (
    <div
      data-slot="section-grid"
      className={cn("grid", colsClass, gapClass, className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Section, SectionDivider, SectionGrid, sectionVariants }

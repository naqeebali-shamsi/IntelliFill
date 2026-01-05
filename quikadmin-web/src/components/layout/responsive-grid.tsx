import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const gridVariants = cva('grid', {
  variants: {
    cols: {
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4',
      5: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
      6: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
    },
    gap: {
      none: 'gap-0',
      sm: 'gap-2',
      md: 'gap-4',
      lg: 'gap-6',
      xl: 'gap-8',
    },
    preset: {
      stats: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
      cards: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6',
      sidebar: 'grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8',
      twoColumn: 'grid-cols-1 lg:grid-cols-2 gap-6',
    },
  },
  defaultVariants: {
    cols: 3,
    gap: 'md',
  },
});

export interface ResponsiveGridProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof gridVariants> {
  /**
   * Grid items to render
   */
  children: React.ReactNode;
}

/**
 * ResponsiveGrid component for dashboard layouts with responsive columns.
 *
 * @example
 * // Default 3-column grid
 * <ResponsiveGrid>
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 *   <Card>Item 3</Card>
 * </ResponsiveGrid>
 *
 * @example
 * // 4-column grid with large gap
 * <ResponsiveGrid cols={4} gap="lg">
 *   {items.map(item => <Card key={item.id}>{item.content}</Card>)}
 * </ResponsiveGrid>
 *
 * @example
 * // 2-column grid for mobile-first layout
 * <ResponsiveGrid cols={2} gap="sm">
 *   <Card>Card 1</Card>
 *   <Card>Card 2</Card>
 * </ResponsiveGrid>
 *
 * @example
 * // Stats preset (4 columns on desktop)
 * <ResponsiveGrid preset="stats">
 *   <StatCard label="Users" value="1,234" />
 *   <StatCard label="Revenue" value="$45K" />
 *   <StatCard label="Growth" value="+12%" />
 *   <StatCard label="Active" value="567" />
 * </ResponsiveGrid>
 *
 * @example
 * // Cards preset with override
 * <ResponsiveGrid preset="cards" className="gap-8">
 *   <ProductCard />
 *   <ProductCard />
 * </ResponsiveGrid>
 */
function ResponsiveGrid({ cols, gap, preset, className, children, ...props }: ResponsiveGridProps) {
  return (
    <div
      data-slot="responsive-grid"
      className={cn(
        gridVariants({
          cols: preset ? undefined : cols,
          gap: preset ? undefined : gap,
          preset,
        }),
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * GridItem component for grid items with consistent styling.
 */
export interface GridItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Grid item content
   */
  children: React.ReactNode;
  /**
   * Span across multiple columns (1-12)
   */
  colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  /**
   * Span across multiple rows (1-12)
   */
  rowSpan?: 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * GridItem component for grid items with span support.
 *
 * @example
 * <ResponsiveGrid cols={4}>
 *   <GridItem colSpan={2}>Wide item</GridItem>
 *   <GridItem>Regular item</GridItem>
 *   <GridItem>Regular item</GridItem>
 * </ResponsiveGrid>
 */
function GridItem({ colSpan, rowSpan, className, children, ...props }: GridItemProps) {
  const spanClasses = React.useMemo(() => {
    const classes: string[] = [];
    if (colSpan) {
      classes.push(`col-span-${colSpan}`);
    }
    if (rowSpan) {
      classes.push(`row-span-${rowSpan}`);
    }
    return classes;
  }, [colSpan, rowSpan]);

  return (
    <div data-slot="grid-item" className={cn(spanClasses, className)} {...props}>
      {children}
    </div>
  );
}

export { ResponsiveGrid, GridItem, gridVariants };

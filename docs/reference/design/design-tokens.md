# Design Tokens & Layout Primitives

This document defines the standardized design tokens and layout primitives used throughout the IntelliFill frontend application. These patterns ensure visual consistency and reduce code duplication.

---

## Table of Contents

1. [Spacing Scale](#spacing-scale)
2. [Container Widths](#container-widths)
3. [Z-Index Hierarchy](#z-index-hierarchy)
4. [Layout Primitives](#layout-primitives)
   - [ResponsiveGrid](#responsivegrid)
   - [PageHeader](#pageheader)
   - [StatCard](#statcard)
5. [Animation System](#animation-system)
6. [Usage Guidelines](#usage-guidelines)

---

## Spacing Scale

Tailwind's default spacing scale with our common patterns:

| Token                 | Value         | Usage                               |
| --------------------- | ------------- | ----------------------------------- |
| `gap-2` / `p-2`       | 0.5rem (8px)  | Compact spacing, inline elements    |
| `gap-4` / `p-4`       | 1rem (16px)   | Standard card padding, list items   |
| `gap-6` / `p-6`       | 1.5rem (24px) | Section spacing, card content       |
| `gap-8` / `space-y-8` | 2rem (32px)   | Major section breaks, page sections |
| `pb-6`                | 1.5rem (24px) | PageHeader bottom padding           |

### Common Patterns

```tsx
// Card padding
<div className="p-4">        // Compact cards
<div className="p-6">        // Standard cards (StatCard, panels)

// Section spacing
<div className="space-y-6">  // Within sections
<div className="space-y-8">  // Between major sections

// Grid gaps
<ResponsiveGrid gap="md">    // gap-4 (standard)
<ResponsiveGrid gap="lg">    // gap-6 (relaxed)
```

---

## Container Widths

### Page Content Width

All page content uses `max-w-7xl mx-auto` for consistent width:

```tsx
// Standard page container
<div className="max-w-7xl mx-auto space-y-6">
  <PageHeader ... />
  <ResponsiveGrid preset="stats">...</ResponsiveGrid>
  {/* Page content */}
</div>
```

| Token       | Value          | Usage                   |
| ----------- | -------------- | ----------------------- |
| `max-w-7xl` | 80rem (1280px) | Page content containers |
| `max-w-md`  | 28rem (448px)  | Forms, dialogs          |
| `max-w-lg`  | 32rem (512px)  | Medium modals           |
| `max-w-2xl` | 42rem (672px)  | Large modals            |

### Sidebar Layouts

For pages with sidebars, use the `sidebar` preset:

```tsx
<ResponsiveGrid preset="sidebar">
  <div>{/* Main content (2fr) */}</div>
  <div>{/* Sidebar (1fr) */}</div>
</ResponsiveGrid>
```

---

## Z-Index Hierarchy

Standardized z-index values for layering:

| Layer            | Z-Index   | Usage                            |
| ---------------- | --------- | -------------------------------- |
| Base content     | `z-0`     | Default page content             |
| Elevated content | `z-10`    | Sticky filters, floating headers |
| Dropdowns        | `z-20`    | Select menus, popovers           |
| Sticky elements  | `z-30`    | Sticky navigation, filter bars   |
| Fixed navigation | `z-40`    | Sidebar, app header              |
| Overlays         | `z-50`    | Modal backdrops, drawer overlays |
| Modals           | `z-[60]`  | Dialog content                   |
| Toasts           | `z-[100]` | Toast notifications (sonner)     |

### Usage Examples

```tsx
// Sticky filter bar
<div className="sticky top-20 z-10">
  <FilterBar />
</div>

// Modal overlay
<div className="fixed inset-0 z-50 bg-black/50">
  <div className="z-[60]">
    <DialogContent />
  </div>
</div>
```

---

## Layout Primitives

### ResponsiveGrid

Location: `@/components/layout/responsive-grid`

A responsive grid component with mobile-first breakpoints and semantic presets.

#### Props

| Prop        | Type                                             | Default | Description                                  |
| ----------- | ------------------------------------------------ | ------- | -------------------------------------------- |
| `cols`      | `1-6`                                            | `3`     | Number of columns (ignored if preset is set) |
| `gap`       | `'none' \| 'sm' \| 'md' \| 'lg' \| 'xl'`         | `'md'`  | Gap between items                            |
| `preset`    | `'stats' \| 'cards' \| 'sidebar' \| 'twoColumn'` | -       | Predefined layout pattern                    |
| `className` | `string`                                         | -       | Additional CSS classes                       |

#### Presets

| Preset      | Classes                                                          | Use Case                      |
| ----------- | ---------------------------------------------------------------- | ----------------------------- |
| `stats`     | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`                | 4 stat cards at top of pages  |
| `cards`     | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6` | Document/template card grids  |
| `sidebar`   | `grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8`                       | Main content + sidebar layout |
| `twoColumn` | `grid-cols-1 lg:grid-cols-2 gap-6`                               | Two-column equal split        |

#### Examples

```tsx
import { ResponsiveGrid } from '@/components/layout/responsive-grid';

// Stats layout (4 cards)
<ResponsiveGrid preset="stats">
  <StatCard title="Total" value={100} icon={FileText} />
  <StatCard title="Completed" value={85} icon={CheckCircle} variant="success" />
  <StatCard title="Processing" value={10} icon={Clock} variant="warning" />
  <StatCard title="Failed" value={5} icon={XCircle} variant="error" />
</ResponsiveGrid>

// Document cards grid
<ResponsiveGrid preset="cards">
  {documents.map(doc => <DocumentCard key={doc.id} {...doc} />)}
</ResponsiveGrid>

// Custom column count
<ResponsiveGrid cols={2} gap="lg">
  <Card>Left</Card>
  <Card>Right</Card>
</ResponsiveGrid>
```

---

### PageHeader

Location: `@/components/layout/page-header`

Consistent page headers with breadcrumbs, title, description, and action buttons.

#### Props

| Prop          | Type                                      | Required | Description            |
| ------------- | ----------------------------------------- | -------- | ---------------------- |
| `title`       | `string`                                  | Yes      | Page title (h1)        |
| `description` | `string`                                  | No       | Subtitle text          |
| `breadcrumbs` | `Array<{ label: string; href?: string }>` | No       | Navigation breadcrumbs |
| `actions`     | `ReactNode`                               | No       | Action buttons         |
| `className`   | `string`                                  | No       | Additional CSS classes |

#### Examples

```tsx
import { PageHeader } from '@/components/layout/page-header';

// Basic header
<PageHeader
  title="Documents"
  description="Manage your uploaded documents"
/>

// With breadcrumbs
<PageHeader
  title="Document Details"
  description="View and edit document information"
  breadcrumbs={[
    { label: 'Home', href: '/' },
    { label: 'Documents', href: '/documents' },
    { label: 'Details' }  // No href = current page
  ]}
/>

// With actions
<PageHeader
  title="Processing History"
  description="Track the status of your processing jobs"
  breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'History' }]}
  actions={
    <Button onClick={handleRefresh} variant="outline" size="sm">
      <RefreshCw className="mr-2 h-4 w-4" />
      Refresh
    </Button>
  }
/>
```

---

### StatCard

Location: `@/components/features/stat-card`

Unified statistics card with variants, loading state, and entrance animations.

#### Props

| Prop             | Type                                             | Default     | Description              |
| ---------------- | ------------------------------------------------ | ----------- | ------------------------ |
| `title`          | `string`                                         | Required    | Stat label               |
| `value`          | `string \| number`                               | Required    | Main value display       |
| `description`    | `string`                                         | -           | Optional subtitle        |
| `icon`           | `LucideIcon`                                     | Required    | Icon component           |
| `variant`        | `'default' \| 'success' \| 'warning' \| 'error'` | `'default'` | Color theme              |
| `loading`        | `boolean`                                        | `false`     | Show skeleton loader     |
| `animationDelay` | `number`                                         | `0`         | Stagger delay in seconds |
| `data-testid`    | `string`                                         | -           | Test identifier          |

#### Variants

| Variant   | Icon Color       | Background       | Use Case                         |
| --------- | ---------------- | ---------------- | -------------------------------- |
| `default` | Primary (indigo) | `primary/10`     | Total counts, neutral stats      |
| `success` | Emerald          | `emerald-500/10` | Completed, success rates         |
| `warning` | Amber            | `amber-500/10`   | Pending, processing, in-progress |
| `error`   | Red              | `red-500/10`     | Failed, errors, action needed    |

#### Examples

```tsx
import { StatCard } from '@/components/features/stat-card';
import { FileText, CheckCircle, Clock, XCircle } from 'lucide-react';

// Basic stat
<StatCard
  title="Total Documents"
  value={42}
  description="Uploaded this month"
  icon={FileText}
/>

// Success variant
<StatCard
  title="Completed"
  value={38}
  description="95% success rate"
  icon={CheckCircle}
  variant="success"
/>

// With loading state
<StatCard
  title="Processing"
  value={stats?.processing || 0}
  icon={Clock}
  variant="warning"
  loading={isLoading}
/>

// With animation delay (for staggered grids)
<StatCard
  title="Failed"
  value={2}
  icon={XCircle}
  variant="error"
  animationDelay={0.3}
/>

// With test ID
<StatCard
  title="Total"
  value={100}
  icon={FileText}
  data-testid="stat-card-total"
/>
```

---

## Animation System

Location: `@/lib/animations`

Centralized Framer Motion variants for consistent animations.

### Container Variants

| Variant                | Stagger | Use Case                   |
| ---------------------- | ------- | -------------------------- |
| `staggerContainer`     | 0.1s    | Standard lists, cards      |
| `staggerContainerFast` | 0.05s   | Large lists, dense content |
| `staggerContainerSlow` | 0.2s    | Hero sections, emphasis    |

### Item Variants

| Variant          | Animation         | Use Case                   |
| ---------------- | ----------------- | -------------------------- |
| `fadeInUp`       | Fade + 20px up    | Cards, content blocks      |
| `fadeInUpSubtle` | Fade + 10px up    | Table rows, list items     |
| `slideInLeft`    | Fade + 20px left  | Sidebar content            |
| `slideInRight`   | Fade + 20px right | Right-side content         |
| `scaleIn`        | Fade + 95% scale  | Modals, important elements |

### Transitions

| Transition               | Properties                  | Use Case               |
| ------------------------ | --------------------------- | ---------------------- |
| `transitions.spring`     | stiffness: 260, damping: 20 | Natural, smooth motion |
| `transitions.springFast` | stiffness: 400, damping: 25 | Snappy interactions    |
| `transitions.easeOut`    | duration: 0.3s              | Smooth deceleration    |
| `transitions.quick`      | duration: 0.2s              | Subtle changes         |

### Usage Example

```tsx
import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp, transitions } from '@/lib/animations';

// List with staggered children
<motion.div
  variants={staggerContainer}
  initial="hidden"
  animate="show"
>
  {items.map(item => (
    <motion.div key={item.id} variants={fadeInUp}>
      <Card>{item.content}</Card>
    </motion.div>
  ))}
</motion.div>

// Single element with custom transition
<motion.div
  variants={scaleIn}
  initial="hidden"
  animate="show"
  transition={transitions.springFast}
>
  <Modal />
</motion.div>
```

---

## Usage Guidelines

### Page Structure Template

```tsx
export default function ExamplePage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <PageHeader
        title="Page Title"
        description="Page description"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Current' }]}
        actions={<Button>Action</Button>}
      />

      {/* Stats Section */}
      <ResponsiveGrid preset="stats">
        <StatCard title="Stat 1" value={100} icon={Icon1} />
        <StatCard title="Stat 2" value={200} icon={Icon2} variant="success" />
        <StatCard title="Stat 3" value={50} icon={Icon3} variant="warning" />
        <StatCard title="Stat 4" value={10} icon={Icon4} variant="error" />
      </ResponsiveGrid>

      {/* Main Content */}
      <ResponsiveGrid preset="cards">
        {items.map((item) => (
          <ItemCard key={item.id} {...item} />
        ))}
      </ResponsiveGrid>
    </div>
  );
}
```

### Do's and Don'ts

#### Do

- Use `ResponsiveGrid` presets for common layouts
- Use `StatCard` for all statistics displays
- Use `PageHeader` for all page titles
- Import animations from `@/lib/animations`
- Add `data-testid` to StatCards for testing

#### Don't

- Don't create inline grid classes when a preset exists
- Don't duplicate StatCard styling in pages
- Don't hardcode z-index values - use the hierarchy
- Don't skip loading states for async data
- Don't use raw Tailwind grids for standard layouts

### Migration Checklist

When updating a page to use layout primitives:

1. [ ] Replace page title with `<PageHeader />`
2. [ ] Replace stats grid with `<ResponsiveGrid preset="stats">`
3. [ ] Replace inline StatCard components with unified `<StatCard />`
4. [ ] Replace card grids with `<ResponsiveGrid preset="cards">`
5. [ ] Add `data-testid` props to StatCards
6. [ ] Ensure page uses `max-w-7xl mx-auto` wrapper
7. [ ] Replace local animation definitions with `@/lib/animations`

---

## Related Documentation

- [Design System](./design-system.md) - Colors, typography, components
- [Frontend CLAUDE.md](../../../quikadmin-web/CLAUDE.md) - Frontend patterns
- [Component Library](./components/) - UI component docs

---

**Last Updated**: 2026-01-05

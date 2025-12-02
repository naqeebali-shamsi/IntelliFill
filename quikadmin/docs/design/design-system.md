# QuikAdmin Design System

**Version:** 1.0.0
**Last Updated:** 2025-10-26
**Status:** Active

## Overview

The QuikAdmin Design System provides a comprehensive set of design tokens, components, and guidelines to ensure a consistent, accessible, and delightful user experience across the entire application.

### Philosophy

- **Consistency First**: Unified visual language across all interfaces
- **Accessibility Always**: WCAG 2.1 AA compliance minimum
- **Performance Matters**: Optimized for speed and smooth interactions
- **Developer Experience**: Easy to use, hard to misuse
- **Dark Mode Native**: Both light and dark themes are first-class citizens

### Technology Stack

- **Framework**: React 18.2 with TypeScript 5.2
- **Styling**: TailwindCSS 4.0-beta with custom design tokens
- **Components**: Shadcn/UI (Radix UI primitives)
- **Icons**: Lucide React
- **State**: Zustand
- **Variants**: class-variance-authority (cva)
- **Data Visualization**: Recharts (charts)
- **Animations**: Framer Motion (transitions, animations)
- **Notifications**: Sonner (toast notifications)

---

## Design Tokens

Design tokens are the foundational building blocks of our design system. All components use these tokens to ensure consistency.

### Color Palette

Our color system is built on HSL (Hue, Saturation, Lightness) values for better theming and manipulation.

#### Light Mode Colors

```css
--background: 0 0% 100%;           /* Pure white */
--foreground: 224 71.4% 4.1%;      /* Nearly black text */
--card: 0 0% 100%;                 /* White cards */
--card-foreground: 224 71.4% 4.1%; /* Card text */
--primary: 220.9 39.3% 11%;        /* Dark blue-gray */
--primary-foreground: 210 20% 98%; /* White text on primary */
--secondary: 220 14.3% 95.9%;      /* Light gray */
--secondary-foreground: 220.9 39.3% 11%; /* Dark text on secondary */
--muted: 220 14.3% 95.9%;          /* Muted gray */
--muted-foreground: 220 8.9% 46.1%; /* Muted text */
--accent: 220 14.3% 95.9%;         /* Light accent */
--accent-foreground: 220.9 39.3% 11%; /* Dark text on accent */
--destructive: 0 84.2% 60.2%;      /* Red for errors */
--destructive-foreground: 210 20% 98%; /* White text on red */
--border: 220 13% 91%;             /* Light border */
--input: 220 13% 91%;              /* Input border */
--ring: 224 71.4% 4.1%;            /* Focus ring */
```

#### Dark Mode Colors

```css
--background: 224 71.4% 4.1%;      /* Dark blue-gray background */
--foreground: 210 20% 98%;         /* White text */
--card: 224 71.4% 4.1%;            /* Dark cards */
--card-foreground: 210 20% 98%;    /* White card text */
--primary: 210 20% 98%;            /* White primary */
--primary-foreground: 220.9 39.3% 11%; /* Dark text on primary */
--secondary: 215 27.9% 16.9%;      /* Dark gray */
--secondary-foreground: 210 20% 98%; /* White text on secondary */
--muted: 215 27.9% 16.9%;          /* Dark muted */
--muted-foreground: 217.9 10.6% 64.9%; /* Muted text */
--accent: 215 27.9% 16.9%;         /* Dark accent */
--accent-foreground: 210 20% 98%;  /* White text on accent */
--destructive: 0 62.8% 30.6%;      /* Darker red */
--destructive-foreground: 210 20% 98%; /* White text on red */
--border: 215 27.9% 16.9%;         /* Dark border */
--input: 215 27.9% 16.9%;          /* Dark input border */
--ring: 216 12.2% 83.9%;           /* Light focus ring */
```

#### Semantic Colors (Using Tailwind Defaults)

For status indicators and badges, we use Tailwind's default color palette:

- **Success**: `bg-green-500` / `text-green-500` (Completed, Success)
- **Warning**: `bg-yellow-500` / `text-yellow-500` (Warnings, Pending review)
- **Info**: `bg-blue-500` / `text-blue-500` (Information, Processing)
- **Error**: `bg-red-500` / `text-red-500` (Errors, Failed)
- **Neutral**: `bg-gray-500` / `text-gray-500` (Pending, Idle)

### Typography

#### Font Stack

```css
font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto",
             "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans",
             "Helvetica Neue", sans-serif;
```

**Primary**: Inter (Google Font, included in index.html)
**Monospace**: `source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace`

#### Type Scale

| Element | Size | Weight | Line Height | Usage |
|---------|------|--------|-------------|-------|
| **Display** | `text-4xl` (2.25rem) | 700 | 1.1 | Hero headings |
| **H1** | `text-3xl` (1.875rem) | 600 | 1.2 | Page titles |
| **H2** | `text-2xl` (1.5rem) | 600 | 1.3 | Section headings |
| **H3** | `text-xl` (1.25rem) | 600 | 1.4 | Subsection headings |
| **H4** | `text-lg` (1.125rem) | 600 | 1.4 | Card titles |
| **Body** | `text-base` (1rem) | 400 | 1.5 | Default text |
| **Small** | `text-sm` (0.875rem) | 400 | 1.5 | Captions, labels |
| **XSmall** | `text-xs` (0.75rem) | 400 | 1.5 | Badges, timestamps |

#### Font Weights

- **Regular**: 400 (body text)
- **Medium**: 500 (emphasis)
- **Semibold**: 600 (headings)
- **Bold**: 700 (display, strong emphasis)

### Spacing System

Tailwind's spacing scale based on 0.25rem (4px) increments:

```
0: 0px
0.5: 2px    (0.125rem)
1: 4px      (0.25rem)
1.5: 6px    (0.375rem)
2: 8px      (0.5rem)
3: 12px     (0.75rem)
4: 16px     (1rem)
5: 20px     (1.25rem)
6: 24px     (1.5rem)
8: 32px     (2rem)
10: 40px    (2.5rem)
12: 48px    (3rem)
16: 64px    (4rem)
20: 80px    (5rem)
24: 96px    (6rem)
```

**Common Usage:**
- **Tight spacing**: `gap-2` (8px) - Between related elements
- **Default spacing**: `gap-4` (16px) - Standard component spacing
- **Section spacing**: `gap-6` (24px) - Between sections
- **Large spacing**: `gap-8` (32px) - Major layout divisions

### Border Radius

```css
--radius: 0.5rem; /* 8px base radius */
```

- **Small**: `rounded-sm` (4px) - Badges, small buttons
- **Default**: `rounded-md` (6px) - Buttons, inputs
- **Large**: `rounded-lg` (8px) - Cards, modals
- **XLarge**: `rounded-xl` (12px) - Large cards, containers
- **Full**: `rounded-full` - Pills, avatars

### Shadows

- **XSmall**: `shadow-xs` - Subtle elevation (buttons)
- **Small**: `shadow-sm` - Cards, dropdowns
- **Medium**: `shadow-md` - Floating elements
- **Large**: `shadow-lg` - Modals, popovers
- **XLarge**: `shadow-xl` - Major overlays

### Breakpoints

Tailwind's default responsive breakpoints:

```
sm: 640px   - Mobile landscape, small tablets
md: 768px   - Tablets
lg: 1024px  - Small desktops
xl: 1280px  - Desktops
2xl: 1536px - Large desktops
```

---

## Component Guidelines

### Button Component

#### Variants

```tsx
<Button variant="default">Primary Action</Button>
<Button variant="secondary">Secondary Action</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline Button</Button>
<Button variant="ghost">Ghost Button</Button>
<Button variant="link">Link Button</Button>
```

#### Sizes

```tsx
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><IconName /></Button>
```

#### Usage Guidelines

- **Default (Primary)**: Primary actions, submit buttons
- **Secondary**: Alternative actions, cancel buttons
- **Destructive**: Delete, remove, dangerous actions
- **Outline**: Secondary actions with more emphasis than ghost
- **Ghost**: Tertiary actions, toolbar buttons
- **Link**: In-text actions, navigation

### Card Component

Cards are the primary container for grouped content.

```tsx
<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Optional description</CardDescription>
    <CardAction>
      <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
    </CardAction>
  </CardHeader>
  <CardContent>
    Main content here
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Form Controls

#### Input

```tsx
<Label htmlFor="email">Email</Label>
<Input
  id="email"
  type="email"
  placeholder="you@example.com"
  aria-describedby="email-error"
/>
```

#### Select

```tsx
<Select>
  <SelectTrigger>
    <SelectValue placeholder="Choose an option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1">Option 1</SelectItem>
    <SelectItem value="2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

### Feedback Components

#### Alert

```tsx
<Alert variant="default">
  <InfoIcon className="h-4 w-4" />
  <AlertTitle>Information</AlertTitle>
  <AlertDescription>
    This is an informational message.
  </AlertDescription>
</Alert>

<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>
    Something went wrong.
  </AlertDescription>
</Alert>
```

#### Toast (Sonner)

```tsx
import { toast } from 'sonner'

// Success toast
toast.success('Document uploaded successfully')

// Error toast
toast.error('Failed to upload document')

// Info toast
toast.info('Processing document...')

// Warning toast
toast.warning('File size exceeds recommended limit')
```

### Navigation Components

#### Tabs

```tsx
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="details">Details</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">
    Overview content
  </TabsContent>
  <TabsContent value="details">
    Details content
  </TabsContent>
</Tabs>
```

#### Breadcrumbs

```tsx
<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/">Home</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbLink href="/documents">Documents</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>Current Page</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

---

## Accessibility Standards

Our design system adheres to WCAG 2.1 Level AA standards.

### Keyboard Navigation

All interactive elements must be keyboard accessible:

- **Tab**: Move focus forward
- **Shift + Tab**: Move focus backward
- **Enter/Space**: Activate buttons, links
- **Escape**: Close modals, dropdowns, popovers
- **Arrow Keys**: Navigate lists, menus, tabs

### Focus Management

- Visible focus indicators on all interactive elements (ring-2 ring-ring)
- Logical tab order following visual layout
- Focus trap in modals and dialogs
- Focus return after closing modals

### ARIA Attributes

Essential ARIA attributes to use:

```tsx
// Role for custom components
<div role="alert">Error message</div>
<div role="status">Loading...</div>
<div role="progressbar" aria-valuenow={50} aria-valuemin={0} aria-valuemax={100} />

// Labels for icon buttons
<Button aria-label="Close dialog">
  <X className="h-4 w-4" />
</Button>

// Descriptions for form errors
<Input aria-describedby="email-error" />
<span id="email-error" className="text-sm text-destructive">
  Invalid email address
</span>

// Live regions for dynamic content
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>

// Disabled state
<Button disabled aria-disabled="true">
  Disabled Button
</Button>
```

### Color Contrast

All text must meet contrast ratios:

- **Normal text**: Minimum 4.5:1
- **Large text** (18px+ or 14px+ bold): Minimum 3:1
- **UI components**: Minimum 3:1

Status should never be conveyed by color alone. Always include:
- Icons for visual distinction
- Text labels for clarity
- ARIA attributes for screen readers

### Screen Reader Support

- Use semantic HTML (`<button>`, `<nav>`, `<main>`, `<header>`)
- Provide meaningful alt text for images
- Use `.sr-only` class for screen-reader-only content
- Maintain proper heading hierarchy (h1 → h2 → h3)
- Use descriptive link text (avoid "click here")

### Touch Targets

Minimum touch target size: **44x44px** (iOS HIG, Android Material Design)

```tsx
// Good: Adequate touch target
<Button size="default">Click Me</Button> // 36px height + padding

// Better: Icon button with proper size
<Button size="icon" className="h-10 w-10">
  <Menu className="h-4 w-4" />
</Button>
```

---

## Component Composition Patterns

### Compound Components

Many components use the compound component pattern for flexibility:

```tsx
// Card composition
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardAction><Button /></CardAction>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>

// Alert composition
<Alert>
  <AlertIcon />
  <AlertTitle>Title</AlertTitle>
  <AlertDescription>Description</AlertDescription>
</Alert>
```

### Slot Pattern

Components use Radix's Slot pattern for polymorphic behavior:

```tsx
// Button renders as a Link
<Button asChild>
  <Link to="/dashboard">Dashboard</Link>
</Button>
```

### Variant Pattern (CVA)

Use class-variance-authority for consistent variant management:

```tsx
const buttonVariants = cva(
  "base-classes",
  {
    variants: {
      variant: {
        default: "variant-classes",
        secondary: "variant-classes",
      },
      size: {
        default: "size-classes",
        sm: "size-classes",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

---

## Responsive Design

### Mobile-First Approach

Always design for mobile first, then enhance for larger screens:

```tsx
<div className="
  flex flex-col gap-4        // Mobile: vertical stack
  md:flex-row md:gap-6       // Tablet: horizontal layout
  lg:gap-8                   // Desktop: larger spacing
">
  <div className="w-full md:w-1/3">Sidebar</div>
  <div className="w-full md:w-2/3">Content</div>
</div>
```

### Common Responsive Patterns

```tsx
// Hide on mobile, show on desktop
<div className="hidden md:block">Desktop only</div>

// Show on mobile, hide on desktop
<div className="block md:hidden">Mobile only</div>

// Responsive text size
<h1 className="text-2xl md:text-3xl lg:text-4xl">
  Responsive Heading
</h1>

// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => <Card key={item.id}>{item.content}</Card>)}
</div>
```

---

## Theme Switching

### Using the Theme Provider

The `ThemeProvider` manages light/dark mode preferences:

```tsx
import { useTheme } from '@/components/theme-provider'

function MyComponent() {
  const { theme, setTheme } = useTheme()

  return (
    <Button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Toggle Theme
    </Button>
  )
}
```

### Theme-Aware Styling

Use theme tokens instead of hardcoded colors:

```tsx
// Good: Uses theme tokens
<div className="bg-background text-foreground border-border">
  Content
</div>

// Avoid: Hardcoded colors break in dark mode
<div className="bg-white text-black border-gray-200">
  Content
</div>
```

---

## Code Examples

### Loading States

```tsx
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'

// Skeleton for content loading
<Card>
  <CardHeader>
    <Skeleton className="h-4 w-[200px]" />
  </CardHeader>
  <CardContent>
    <Skeleton className="h-20 w-full" />
  </CardContent>
</Card>

// Spinner for processing
<div className="flex items-center justify-center p-8">
  <Spinner size="lg" label="Processing..." />
</div>
```

### Empty States

```tsx
import { EmptyState } from '@/components/ui/empty-state'
import { FileText } from 'lucide-react'

<EmptyState
  icon={FileText}
  title="No documents found"
  description="Upload your first document to get started"
  action={{
    label: "Upload Document",
    onClick: () => navigate('/upload')
  }}
/>
```

### Error Handling

```tsx
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>
    Failed to upload document. Please try again.
  </AlertDescription>
</Alert>
```

---

## Animations & Transitions

### Framer Motion Usage

Use Framer Motion for smooth, performant animations:

```tsx
import { motion } from 'framer-motion'

// Fade in animation
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.2 }}
>
  Content
</motion.div>

// Slide animation
<motion.div
  initial={{ x: -20, opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  exit={{ x: 20, opacity: 0 }}
  transition={{ duration: 0.3 }}
>
  Content
</motion.div>

// Dialog/Modal animations
<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.95 }}
  transition={{ duration: 0.2 }}
>
  Dialog Content
</motion.div>
```

### Animation Principles

- **Duration**: 0.2-0.3s for most UI transitions
- **Easing**: Use `ease-out` for entering, `ease-in` for exiting
- **Performance**: Use `transform` and `opacity` for GPU acceleration
- **Accessibility**: Respect `prefers-reduced-motion`:

```tsx
const shouldReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

<motion.div
  animate={shouldReduceMotion ? {} : { opacity: 1 }}
  transition={shouldReduceMotion ? {} : { duration: 0.2 }}
>
```

## Data Visualization

### Recharts Usage

Use Recharts for all chart components:

```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const data = [
  { name: 'Jan', value: 400 },
  { name: 'Feb', value: 300 },
]

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
    <XAxis dataKey="name" className="text-muted-foreground" />
    <YAxis className="text-muted-foreground" />
    <Tooltip 
      contentStyle={{ 
        backgroundColor: 'hsl(var(--popover))',
        borderColor: 'hsl(var(--border))'
      }}
    />
    <Legend />
    <Line 
      type="monotone" 
      dataKey="value" 
      stroke="hsl(var(--primary))" 
      strokeWidth={2}
    />
  </LineChart>
</ResponsiveContainer>
```

### Chart Styling Guidelines

- Use theme colors: `hsl(var(--primary))` for primary data
- Use semantic colors for status: green (success), red (error), yellow (warning)
- Ensure contrast ratios meet WCAG AA standards
- Use ResponsiveContainer for all charts
- Style tooltips and legends to match design system

## Best Practices

### Component Development

1. **TypeScript First**: All components must be fully typed, no `any`
2. **Composition Over Configuration**: Prefer compound components
3. **Accessibility Always**: Include ARIA attributes from the start
4. **Responsive by Default**: Mobile-first responsive design
5. **Dark Mode Compatible**: Test in both light and dark themes
6. **Performance Optimized**: Use React.memo() for expensive components
7. **Error Boundaries**: Wrap risky components in error boundaries
8. **Loading States**: Always provide loading feedback
9. **Empty States**: Handle empty data gracefully
10. **Edge Cases**: Test null, undefined, empty arrays
11. **Library-First**: Use proven libraries (Recharts, Framer Motion) instead of custom implementations

### Styling Best Practices

1. **Use Design Tokens**: Always use theme colors (bg-background, text-foreground)
2. **Consistent Spacing**: Use spacing scale (gap-4, p-6, m-8)
3. **Avoid Inline Styles**: Use Tailwind classes
4. **Group Related Classes**: Responsive modifiers together
5. **Use cn() Utility**: For conditional className merging

### Performance Best Practices

1. **Lazy Load Routes**: Use React.lazy() for route components
2. **Virtualize Long Lists**: Use `@tanstack/react-virtual` for 100+ items
3. **Optimize Images**: Use native `loading="lazy"` and appropriate sizes/formats
4. **Debounce Input**: Use existing `useDebounce` hook from `@/hooks/useDebounce`
5. **Memoize Expensive Calculations**: Use useMemo() appropriately
6. **Use Library Animations**: Framer Motion is GPU-accelerated, prefer over CSS animations
7. **Chart Performance**: Use Recharts ResponsiveContainer and memoize chart data

---

## Resources

### Internal Documentation

- **[Component Library](../web/src/components/README.md)**: Full component API reference
- **[Theming Guide](./502-theming.md)**: Advanced theme customization
- **[Accessibility Checklist](./503-accessibility.md)**: Comprehensive a11y testing

### External Resources

- **[Tailwind CSS](https://tailwindcss.com/docs)**: Utility-first CSS framework
- **[Radix UI](https://www.radix-ui.com/primitives)**: Accessible component primitives
- **[Shadcn/UI](https://ui.shadcn.com/)**: Component library built on Radix UI
- **[Lucide Icons](https://lucide.dev/)**: Icon library
- **[Recharts](https://recharts.org/)**: React charting library
- **[Framer Motion](https://www.framer.com/motion/)**: Animation library for React
- **[Sonner](https://sonner.emilkowal.ski/)**: Toast notification library
- **[WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/)**: Accessibility guidelines

---

## Changelog

### Version 1.1.0 (2025-01-27)

- Added Framer Motion animation guidelines
- Added Recharts data visualization guidelines
- Updated library-first approach documentation
- Enhanced performance best practices
- Added animation accessibility considerations

### Version 1.0.0 (2025-10-26)

- Initial design system documentation
- Comprehensive design tokens
- Component guidelines
- Accessibility standards
- Code examples and best practices

---

**Maintained by**: Frontend Team
**Questions?**: Create an issue or contact the design system team

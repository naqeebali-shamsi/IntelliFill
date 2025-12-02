---
title: "Design System"
description: "IntelliFill design system with TailwindCSS 4.0 and Shadcn/UI"
category: design
tags: [design-system, tailwind, shadcn, accessibility, ui]
lastUpdated: 2025-01-11
relatedDocs:
  - design/components/
---

# IntelliFill Design System

**Version:** 2.0.0
**Last Updated:** 2025-01-11
**Status:** Active
**Application:** QuikAdmin (IntelliFill Admin Interface)

## Overview

The IntelliFill Design System provides a comprehensive set of design tokens, components, and guidelines to ensure a consistent, accessible, and delightful user experience across the entire QuikAdmin application. This system consolidates all design specifications, implementation patterns, and accessibility standards into a single authoritative source.

## Design Philosophy

Our design system is built on five core principles that guide every design decision:

### Core Principles

1. **Clarity**: Clear visual hierarchy and purposeful design
2. **Consistency**: Unified visual language across all interfaces
3. **Accessibility**: WCAG 2.1 AA compliance minimum, inclusive design for all users
4. **Performance**: Optimized for speed, smooth interactions, and efficient resource usage
5. **Scalability**: Extensible component system with reusable, composable patterns

### Development Philosophy

- **Accessibility First**: WCAG 2.1 AA compliance is not optional
- **Progressive Enhancement**: Works on all devices and network conditions
- **Developer Experience**: Easy to use, hard to misuse
- **Dark Mode Native**: Both light and dark themes are first-class citizens
- **User Centric**: Intuitive workflows and clear feedback
- **Performance Matters**: Fast loading and smooth interactions

## Technology Stack

Our design system is built on modern, battle-tested technologies:

- **Framework**: React 18.2 with TypeScript 5.2
- **Styling**: TailwindCSS 4.0-beta with custom design tokens
- **Components**: Shadcn/UI (Radix UI primitives)
- **Icons**: Lucide React
- **State Management**: Zustand
- **Variants**: class-variance-authority (cva)
- **Data Visualization**: Recharts (charts and graphs)
- **Animations**: Framer Motion (transitions, micro-interactions)
- **Notifications**: Sonner (toast notifications)
- **Forms**: React Hook Form with Zod validation

---

## Design Tokens

Design tokens are the foundational building blocks of our design system. All components use these tokens to ensure consistency across the application.

### Color System

Our color system is built on HSL (Hue, Saturation, Lightness) values for better theming and manipulation. Colors are organized into semantic categories for consistent usage.

#### Light Mode Colors

```css
--background: 0 0% 100%;           /* Pure white #ffffff */
--foreground: 224 71.4% 4.1%;      /* Nearly black text #020817 */
--card: 0 0% 100%;                 /* White cards #ffffff */
--card-foreground: 224 71.4% 4.1%; /* Card text #020817 */
--popover: 0 0% 100%;              /* White popover #ffffff */
--popover-foreground: 224 71.4% 4.1%; /* Popover text #020817 */
--primary: 220.9 39.3% 11%;        /* Dark blue-gray #0f172a */
--primary-foreground: 210 20% 98%; /* White text on primary #f8fafc */
--secondary: 220 14.3% 95.9%;      /* Light gray #f1f5f9 */
--secondary-foreground: 220.9 39.3% 11%; /* Dark text on secondary #0f172a */
--muted: 220 14.3% 95.9%;          /* Muted gray #f1f5f9 */
--muted-foreground: 220 8.9% 46.1%; /* Muted text #64748b */
--accent: 220 14.3% 95.9%;         /* Light accent #f1f5f9 */
--accent-foreground: 220.9 39.3% 11%; /* Dark text on accent #0f172a */
--destructive: 0 84.2% 60.2%;      /* Red for errors #ef4444 */
--destructive-foreground: 210 20% 98%; /* White text on red #f8fafc */
--border: 220 13% 91%;             /* Light border #e2e8f0 */
--input: 220 13% 91%;              /* Input border #e2e8f0 */
--ring: 224 71.4% 4.1%;            /* Focus ring #020817 */
```

#### Dark Mode Colors

```css
--background: 224 71.4% 4.1%;      /* Dark blue-gray background #020817 */
--foreground: 210 20% 98%;         /* White text #f8fafc */
--card: 224 71.4% 4.1%;            /* Dark cards #020817 */
--card-foreground: 210 20% 98%;    /* White card text #f8fafc */
--popover: 222.2 84% 4.9%;         /* Dark popover #0a0a0a */
--popover-foreground: 210 40% 98%; /* White popover text #fafafa */
--primary: 210 20% 98%;            /* White primary #f8fafc */
--primary-foreground: 220.9 39.3% 11%; /* Dark text on primary #0f172a */
--secondary: 215 27.9% 16.9%;      /* Dark gray #1e293b */
--secondary-foreground: 210 20% 98%; /* White text on secondary #f8fafc */
--muted: 215 27.9% 16.9%;          /* Dark muted #1e293b */
--muted-foreground: 217.9 10.6% 64.9%; /* Muted text #94a3b8 */
--accent: 215 27.9% 16.9%;         /* Dark accent #1e293b */
--accent-foreground: 210 20% 98%;  /* White text on accent #f8fafc */
--destructive: 0 62.8% 30.6%;      /* Darker red #991b1b */
--destructive-foreground: 210 20% 98%; /* White text on red #f8fafc */
--border: 215 27.9% 16.9%;         /* Dark border #1e293b */
--input: 215 27.9% 16.9%;          /* Dark input border #1e293b */
--ring: 216 12.2% 83.9%;           /* Light focus ring #cbd5e1 */
```

#### Semantic Colors (Status Indicators)

For status indicators, badges, and alerts, we use Tailwind's default color palette:

| Status | Color | Usage | Example |
|--------|-------|-------|---------|
| **Success** | Green-500 | Completed, Success states | `bg-green-500 text-green-500` |
| **Warning** | Yellow-500 | Warnings, Pending review | `bg-yellow-500 text-yellow-500` |
| **Info** | Blue-500 | Information, Processing | `bg-blue-500 text-blue-500` |
| **Error** | Red-500 | Errors, Failed states | `bg-red-500 text-red-500` |
| **Neutral** | Gray-500 | Pending, Idle states | `bg-gray-500 text-gray-500` |

**Important**: Status should never be conveyed by color alone. Always include:
- Icons for visual distinction
- Text labels for clarity
- ARIA attributes for screen readers

#### Extended Color Palette

For advanced use cases, our extended palette provides additional color options:

```typescript
// Primary Palette (Blue-based)
primary: {
  50: '#f0f9ff',   // Light blue wash
  100: '#e0f2fe',  // Very light blue
  200: '#bae6fd',  // Light blue
  300: '#7dd3fc',  // Medium light blue
  400: '#38bdf8',  // Medium blue
  500: '#0ea5e9',  // Primary blue (main brand color)
  600: '#0284c7',  // Darker blue
  700: '#0369a1',  // Dark blue
  800: '#075985',  // Very dark blue
  900: '#0c4a6e',  // Darkest blue
  950: '#082f49'   // Almost black blue
}

// Neutral/Gray Palette
neutral: {
  50: '#fafafa',   // Almost white
  100: '#f4f4f5',  // Very light gray
  200: '#e4e4e7',  // Light gray
  300: '#d4d4d8',  // Medium light gray
  400: '#a1a1aa',  // Medium gray
  500: '#71717a',  // Base gray
  600: '#52525b',  // Dark gray
  700: '#3f3f46',  // Darker gray
  800: '#27272a',  // Very dark gray
  900: '#18181b',  // Almost black
  950: '#09090b'   // Pure black
}
```

### Typography

#### Font Stack

```css
font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto",
             "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans",
             "Helvetica Neue", sans-serif;
```

**Primary Font**: Inter (Google Font, included in index.html)
**Monospace Font**: `source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace`

#### Type Scale

| Element | Size | Weight | Line Height | Usage |
|---------|------|--------|-------------|-------|
| **Display** | `text-4xl` (2.25rem / 36px) | 700 | 1.1 | Hero headings, page heroes |
| **H1** | `text-3xl` (1.875rem / 30px) | 600 | 1.2 | Page titles, main headings |
| **H2** | `text-2xl` (1.5rem / 24px) | 600 | 1.3 | Section headings |
| **H3** | `text-xl` (1.25rem / 20px) | 600 | 1.4 | Subsection headings |
| **H4** | `text-lg` (1.125rem / 18px) | 600 | 1.4 | Card titles, minor headings |
| **Body** | `text-base` (1rem / 16px) | 400 | 1.5 | Default body text |
| **Small** | `text-sm` (0.875rem / 14px) | 400 | 1.5 | Captions, labels, helper text |
| **XSmall** | `text-xs` (0.75rem / 12px) | 400 | 1.5 | Badges, timestamps, metadata |

#### Font Weights

- **Regular (400)**: Body text, default content
- **Medium (500)**: Emphasis, subtle highlighting
- **Semibold (600)**: Headings, important labels
- **Bold (700)**: Display text, strong emphasis

### Spacing System

Tailwind's spacing scale based on 0.25rem (4px) increments:

```
0: 0px
0.5: 2px    (0.125rem)
1: 4px      (0.25rem)
1.5: 6px    (0.375rem)
2: 8px      (0.5rem)
2.5: 10px   (0.625rem)
3: 12px     (0.75rem)
3.5: 14px   (0.875rem)
4: 16px     (1rem)
5: 20px     (1.25rem)
6: 24px     (1.5rem)
7: 28px     (1.75rem)
8: 32px     (2rem)
9: 36px     (2.25rem)
10: 40px    (2.5rem)
11: 44px    (2.75rem)
12: 48px    (3rem)
14: 56px    (3.5rem)
16: 64px    (4rem)
20: 80px    (5rem)
24: 96px    (6rem)
```

**Common Usage Patterns:**
- **Tight spacing**: `gap-2` (8px) - Between related elements
- **Default spacing**: `gap-4` (16px) - Standard component spacing
- **Section spacing**: `gap-6` (24px) - Between sections
- **Large spacing**: `gap-8` (32px) - Major layout divisions

### Border Radius

```css
--radius: 0.5rem; /* 8px base radius */
```

- **None**: `rounded-none` (0px) - Sharp edges
- **Small**: `rounded-sm` (2px / 4px) - Badges, small buttons
- **Default**: `rounded` (4px) - Default rounding
- **Medium**: `rounded-md` (6px) - Buttons, inputs
- **Large**: `rounded-lg` (8px) - Cards, modals
- **XLarge**: `rounded-xl` (12px) - Large cards, containers
- **2XLarge**: `rounded-2xl` (16px) - Hero sections
- **3XLarge**: `rounded-3xl` (24px) - Major containers
- **Full**: `rounded-full` - Pills, avatars, circles

### Shadows

Elevation system using box shadows:

```typescript
boxShadow: {
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  default: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)'
}
```

**Usage Guidelines:**
- **XSmall/Small**: Subtle elevation (buttons, inputs)
- **Default**: Cards, dropdowns
- **Medium**: Floating elements, tooltips
- **Large**: Modals, popovers, overlays
- **XLarge**: Major overlays, drawers
- **2XLarge**: Full-screen overlays

### Breakpoints

Tailwind's default responsive breakpoints (mobile-first):

```typescript
screens: {
  sm: '640px',   // Mobile landscape, small tablets
  md: '768px',   // Tablets
  lg: '1024px',  // Small desktops, laptops
  xl: '1280px',  // Desktops
  '2xl': '1536px' // Large desktops, wide monitors
}
```

---

## Component Guidelines

### Button Component

Buttons are the primary way users take actions in the application.

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

- **Default (Primary)**: Primary actions, submit buttons, main CTAs
- **Secondary**: Alternative actions, cancel buttons
- **Destructive**: Delete, remove, dangerous actions (require confirmation)
- **Outline**: Secondary actions with more emphasis than ghost
- **Ghost**: Tertiary actions, toolbar buttons, inline actions
- **Link**: In-text actions, navigation links

#### Accessibility

```tsx
// Icon-only buttons need aria-label
<Button aria-label="Close dialog" size="icon">
  <X className="h-4 w-4" />
</Button>

// Loading state
<Button disabled aria-disabled="true" aria-describedby="loading-status">
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Saving...
</Button>
```

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
<div className="space-y-2">
  <Label htmlFor="email">Email Address</Label>
  <Input
    id="email"
    type="email"
    placeholder="you@example.com"
    aria-describedby="email-error"
    aria-invalid={hasError ? 'true' : 'false'}
  />
  {hasError && (
    <p id="email-error" role="alert" className="text-sm text-destructive">
      Invalid email address
    </p>
  )}
</div>
```

#### Select

```tsx
<Select>
  <SelectTrigger aria-label="Choose an option">
    <SelectValue placeholder="Choose an option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1">Option 1</SelectItem>
    <SelectItem value="2">Option 2</SelectItem>
    <SelectItem value="3">Option 3</SelectItem>
  </SelectContent>
</Select>
```

#### Checkbox and Radio

```tsx
// Checkbox
<div className="flex items-center space-x-2">
  <Checkbox id="terms" />
  <Label htmlFor="terms">Accept terms and conditions</Label>
</div>

// Radio Group
<RadioGroup defaultValue="option1">
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option1" id="option1" />
    <Label htmlFor="option1">Option 1</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option2" id="option2" />
    <Label htmlFor="option2">Option 2</Label>
  </div>
</RadioGroup>
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
    Something went wrong. Please try again.
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

// Custom toast
toast('Custom message', {
  description: 'Additional details here',
  action: {
    label: 'Undo',
    onClick: () => console.log('Undo')
  }
})
```

### Navigation Components

#### Tabs

```tsx
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">
    Overview content
  </TabsContent>
  <TabsContent value="details">
    Details content
  </TabsContent>
  <TabsContent value="settings">
    Settings content
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

Our design system adheres to WCAG 2.1 Level AA standards across all components and patterns.

### Keyboard Navigation

All interactive elements must be keyboard accessible:

| Action | Keys | Description |
|--------|------|-------------|
| **Navigate Forward** | `Tab` | Move focus to next interactive element |
| **Navigate Backward** | `Shift + Tab` | Move focus to previous interactive element |
| **Activate** | `Enter` or `Space` | Activate buttons, links, checkboxes |
| **Close** | `Escape` | Close modals, dropdowns, popovers |
| **Navigate Lists** | `Arrow Keys` | Navigate through lists, menus, tabs |
| **Select** | `Space` | Select checkboxes, toggle switches |

### Focus Management

#### Visible Focus Indicators

All interactive elements must have visible focus indicators that meet WCAG contrast requirements:

```tsx
// Default focus ring (2px solid)
<Button className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
  Click Me
</Button>

// Custom focus styling
<Input className="focus-visible:ring-2 focus-visible:ring-primary" />
```

#### Focus Order and Trapping

- **Logical tab order**: Focus follows visual layout and reading order
- **Focus trap in modals**: Keep focus within modal until closed
- **Focus return**: Return focus to trigger element after closing modal
- **Skip links**: Provide skip-to-content links for keyboard users

### ARIA Attributes

Essential ARIA attributes for accessibility:

```tsx
// Role for custom components
<div role="alert">Error message</div>
<div role="status">Loading...</div>
<div role="progressbar" aria-valuenow={50} aria-valuemin={0} aria-valuemax={100} />

// Labels for icon buttons
<Button aria-label="Close dialog" size="icon">
  <X className="h-4 w-4" />
</Button>

// Descriptions for form errors
<Input aria-describedby="email-error" aria-invalid={hasError} />
<span id="email-error" className="text-sm text-destructive">
  Invalid email address
</span>

// Live regions for dynamic content
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>

// Expanded state for collapsible elements
<Button aria-expanded={isOpen} aria-controls="menu">
  Menu
</Button>
```

### Color Contrast

All text and UI components must meet minimum contrast ratios:

- **Normal text** (< 18px): Minimum 4.5:1 contrast ratio
- **Large text** (18px+ or 14px+ bold): Minimum 3:1 contrast ratio
- **UI components**: Minimum 3:1 contrast ratio for borders, icons, controls

**Testing**: Use browser DevTools or online tools to verify contrast ratios.

### Screen Reader Support

- **Semantic HTML**: Use proper HTML elements (`<button>`, `<nav>`, `<main>`, `<header>`)
- **Alt text**: Provide meaningful alt text for all images
- **Screen reader only content**: Use `.sr-only` class for hidden but accessible content
- **Heading hierarchy**: Maintain proper heading structure (h1 → h2 → h3)
- **Descriptive links**: Use descriptive link text (avoid "click here")

```css
/* Screen reader only utility */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

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

## TailwindCSS 4.0 Configuration

### Tailwind Config

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
}

export default config
```

### CSS Variables

```css
/* globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 199 89% 48%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 84% 4.9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 199 89% 48%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 199 89% 48%;
    --primary-foreground: 222.2 84% 4.9%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 199 89% 48%;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
  }
}
```

---

## Shadcn/UI Integration

### Installation

```bash
# Install Shadcn/UI CLI
npx shadcn-ui@latest init

# Add individual components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add select
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add toast
```

### Component Customization

All Shadcn/UI components can be customized via the `components/ui` directory. Components use the class-variance-authority (cva) pattern for variant management:

```tsx
// components/ui/button.tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
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

## Component Composition Patterns

### Compound Components

Many components use the compound component pattern for flexibility:

```tsx
// Card composition
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
    <CardAction><Button /></CardAction>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer actions</CardFooter>
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

// Button renders as an anchor
<Button asChild>
  <a href="https://example.com">External Link</a>
</Button>
```

### Variant Pattern (CVA)

Use class-variance-authority for consistent variant management across custom components.

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

// Responsive padding
<div className="p-4 md:p-6 lg:p-8">
  Content with responsive padding
</div>
```

---

## Dark Mode Support

### Theme Provider

The `ThemeProvider` manages light/dark mode preferences:

```tsx
import { useTheme } from '@/components/theme-provider'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      {theme === 'dark' ? <Sun /> : <Moon />}
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

### System Preference Detection

```tsx
// ThemeProvider automatically detects system preference
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
  ? 'dark'
  : 'light'
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
  Content
</motion.div>
```

### Motion Sensitivity

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## Data Visualization

### Recharts Usage

Use Recharts for all chart components:

```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const data = [
  { name: 'Jan', value: 400 },
  { name: 'Feb', value: 300 },
  { name: 'Mar', value: 600 },
]

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
    <XAxis dataKey="name" className="text-muted-foreground" />
    <YAxis className="text-muted-foreground" />
    <Tooltip
      contentStyle={{
        backgroundColor: 'hsl(var(--popover))',
        borderColor: 'hsl(var(--border))',
        color: 'hsl(var(--popover-foreground))'
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

---

## Loading States

### Skeleton Components

```tsx
import { Skeleton } from '@/components/ui/skeleton'

// Skeleton for content loading
<Card>
  <CardHeader>
    <Skeleton className="h-4 w-[200px]" />
  </CardHeader>
  <CardContent>
    <Skeleton className="h-20 w-full" />
  </CardContent>
</Card>
```

### Spinner Components

```tsx
import { Spinner } from '@/components/ui/spinner'

// Spinner for processing
<div className="flex items-center justify-center p-8">
  <Spinner size="lg" label="Processing..." />
</div>
```

---

## Empty States

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

---

## Error Handling

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

## Component Reference

For detailed component specifications and examples, see:

- **[Component Library](design/components/)**: Individual component documentation
- **[Form Components](design/components/forms.md)**: Form controls and patterns
- **[Data Display](design/components/data-display.md)**: Tables, cards, lists
- **[Navigation](design/components/navigation.md)**: Menus, breadcrumbs, tabs

---

## Resources

### Internal Documentation

- **[Component Library](../web/src/components/README.md)**: Full component API reference
- **[Accessibility Testing](./accessibility-testing.md)**: Comprehensive a11y testing guide

### External Resources

- **[Tailwind CSS](https://tailwindcss.com/docs)**: Utility-first CSS framework
- **[Radix UI](https://www.radix-ui.com/primitives)**: Accessible component primitives
- **[Shadcn/UI](https://ui.shadcn.com/)**: Component library built on Radix UI
- **[Lucide Icons](https://lucide.dev/)**: Icon library
- **[Recharts](https://recharts.org/)**: React charting library
- **[Framer Motion](https://www.framer.com/motion/)**: Animation library for React
- **[Sonner](https://sonner.emilkowal.ski/)**: Toast notification library
- **[WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/)**: Accessibility guidelines
- **[ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)**: ARIA patterns and widgets

---

## Changelog

### Version 2.0.0 (2025-01-11)

**Major Consolidation**
- Consolidated 5 separate design system documents into single authoritative source
- Merged design philosophy, principles, tokens, implementation guide, and accessibility guidelines
- Added comprehensive TailwindCSS 4.0 configuration
- Enhanced component documentation with accessibility examples
- Added Framer Motion animation guidelines
- Added Recharts data visualization guidelines

**Source Documents Consolidated:**
- `docs/500-frontend/501-design-system.md` (21KB)
- `ui-design/docs/design-system.md` (7.6KB)
- `ui-design/docs/implementation-guide.md` (21KB)
- `ui-design/docs/accessibility-guidelines.md` (14KB)
- `ui-design/docs/component-showcase.md` (7.8KB)

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

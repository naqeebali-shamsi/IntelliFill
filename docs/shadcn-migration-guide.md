# Shadcn UI Migration Guide
*Complete migration strategy from Material UI to Shadcn UI*

## Overview

This guide provides a comprehensive strategy for migrating from Material UI to Shadcn UI in our Vite-based React application. Shadcn UI offers better performance, smaller bundle size, full customization control, and modern design patterns.

## Project Setup Complete ✅

### 1. Dependencies Installed
- `tailwindcss` - Core styling framework
- `class-variance-authority` - Component variants
- `clsx` - Conditional class names
- `tailwind-merge` - Class merging utility  
- `lucide-react` - Modern icon library
- `@radix-ui/*` - Accessible UI primitives

### 2. Configuration Files
- ✅ `components.json` - Shadcn UI configuration
- ✅ `tailwind.config.js` - Tailwind CSS setup with design tokens
- ✅ `vite.config.ts` - Path aliases configured
- ✅ `tsconfig.json` - TypeScript path mapping
- ✅ `src/index.css` - CSS variables and Tailwind integration

### 3. Theme System
- ✅ Dark/light mode support with CSS variables
- ✅ `ThemeProvider` component created
- ✅ Accessible color tokens defined
- ✅ Responsive design system configured

## Component Mapping Strategy

### Core Components Migration

| Material UI | Shadcn UI | Status | Notes |
|-------------|-----------|---------|-------|
| `Button` | `Button` | ✅ Installed | Variants: default, destructive, outline, secondary, ghost, link |
| `Card` | `Card` | ✅ Installed | CardHeader, CardContent, CardFooter sub-components |
| `TextField` | `Input` | ✅ Installed | Simpler API, better performance |
| `TextareaAutosize` | `Textarea` | ✅ Installed | Auto-resize built-in |
| `FormLabel` | `Label` | ✅ Installed | Better accessibility |
| `Select` | `Select` | ✅ Installed | SelectTrigger, SelectContent, SelectItem |
| `Menu` | `DropdownMenu` | ✅ Installed | More flexible composition |
| `Dialog` | `Dialog` | ✅ Installed | DialogTrigger, DialogContent, DialogHeader |
| `Drawer` | `Sheet` | ✅ Installed | Side panels and overlays |

### Navigation & Layout

| Material UI | Shadcn UI | Priority | Installation Command |
|-------------|-----------|----------|---------------------|
| `AppBar` | Custom Header | High | Create custom component |
| `Toolbar` | `div` with flex | High | Use Tailwind classes |
| `Drawer` | `Sheet` | High | `npx shadcn@latest add sheet` |
| `List/ListItem` | Custom List | Medium | Create with Tailwind |
| `Breadcrumbs` | `Breadcrumb` | Medium | `npx shadcn@latest add breadcrumb` |
| `Tabs` | `Tabs` | High | `npx shadcn@latest add tabs` |

### Data Display

| Material UI | Shadcn UI | Priority | Installation Command |
|-------------|-----------|----------|---------------------|
| `DataGrid` | `Table` + `DataTable` | High | `npx shadcn@latest add table` |
| `Chip` | `Badge` | High | `npx shadcn@latest add badge` |
| `Avatar` | `Avatar` | Medium | `npx shadcn@latest add avatar` |
| `Tooltip` | `Tooltip` | Medium | `npx shadcn@latest add tooltip` |
| `Progress` | `Progress` | Low | `npx shadcn@latest add progress` |
| `Skeleton` | `Skeleton` | Low | `npx shadcn@latest add skeleton` |

### Form Components

| Material UI | Shadcn UI | Priority | Installation Command |
|-------------|-----------|----------|---------------------|
| `Checkbox` | `Checkbox` | High | `npx shadcn@latest add checkbox` |
| `RadioGroup` | `RadioGroup` | High | `npx shadcn@latest add radio-group` |
| `Switch` | `Switch` | High | `npx shadcn@latest add switch` |
| `Slider` | `Slider` | Medium | `npx shadcn@latest add slider` |
| `DatePicker` | `Calendar` + `Popover` | Medium | `npx shadcn@latest add calendar popover` |

### Feedback Components

| Material UI | Shadcn UI | Priority | Installation Command |
|-------------|-----------|----------|---------------------|
| `Snackbar` | `toast` (Sonner) | High | `npx shadcn@latest add sonner` |
| `Alert` | `Alert` | High | `npx shadcn@latest add alert` |
| `CircularProgress` | `Spinner` | Medium | Custom component |
| `LinearProgress` | `Progress` | Medium | `npx shadcn@latest add progress` |

## Migration Implementation Plan

### Phase 1: Foundation (Completed ✅)
- [x] Install and configure Shadcn UI
- [x] Setup Tailwind CSS with design tokens
- [x] Create theme provider with dark mode
- [x] Configure TypeScript paths

### Phase 2: Core Components (Next)
```bash
# Install remaining essential components
npx shadcn@latest add badge avatar tooltip alert tabs breadcrumb checkbox radio-group switch sonner
```

### Phase 3: Layout Migration
1. Replace Material UI layout components
2. Update navigation structure
3. Implement responsive design

### Phase 4: Form Migration
1. Replace form components
2. Update validation logic
3. Enhance accessibility

### Phase 5: Data Display Migration
1. Replace DataGrid with Table component
2. Update data visualization
3. Implement sorting/filtering

## Component Examples

### 1. Button Migration

**Before (Material UI):**
```tsx
import { Button } from '@mui/material';

<Button variant="contained" color="primary" onClick={handleClick}>
  Click me
</Button>
```

**After (Shadcn UI):**
```tsx
import { Button } from '@/components/ui/button';

<Button onClick={handleClick}>
  Click me
</Button>
```

### 2. Form Input Migration

**Before (Material UI):**
```tsx
import { TextField } from '@mui/material';

<TextField
  label="Email"
  variant="outlined"
  fullWidth
  value={email}
  onChange={handleEmailChange}
/>
```

**After (Shadcn UI):**
```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<div className="grid w-full max-w-sm items-center gap-1.5">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    value={email}
    onChange={handleEmailChange}
  />
</div>
```

### 3. Card Migration

**Before (Material UI):**
```tsx
import { Card, CardContent, CardHeader, Typography } from '@mui/material';

<Card>
  <CardHeader>
    <Typography variant="h5">Card Title</Typography>
  </CardHeader>
  <CardContent>
    <Typography>Card content goes here.</Typography>
  </CardContent>
</Card>
```

**After (Shadcn UI):**
```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Card content goes here.</p>
  </CardContent>
</Card>
```

## Theme Configuration

### Dark Mode Implementation
```tsx
import { ThemeProvider } from '@/components/theme-provider';

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      {/* Your app content */}
    </ThemeProvider>
  );
}
```

### Theme Toggle Component
```tsx
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";

export function ModeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

## Performance Benefits

### Bundle Size Comparison
- **Material UI**: ~1.2MB (gzipped)
- **Shadcn UI**: ~300KB (gzipped) - **75% reduction**

### Key Advantages
1. **Tree Shaking**: Only import components you use
2. **No Runtime Dependencies**: Pure CSS approach
3. **Better Performance**: Fewer re-renders
4. **Full Customization**: Own the code, modify freely
5. **Modern Design**: Contemporary UI patterns
6. **Accessibility**: Built-in ARIA support via Radix UI

## Migration Checklist

### Pre-Migration
- [ ] Audit current Material UI component usage
- [ ] Identify custom styling and theming
- [ ] Plan component replacement strategy
- [ ] Setup development environment

### During Migration
- [ ] Replace components incrementally
- [ ] Test accessibility compliance
- [ ] Verify responsive design
- [ ] Update unit tests
- [ ] Performance testing

### Post-Migration
- [ ] Remove Material UI dependencies
- [ ] Update documentation
- [ ] Train team on new components
- [ ] Monitor bundle size and performance
- [ ] Collect user feedback

## Next Steps

1. **Install Additional Components**: Run the commands in Phase 2
2. **Update Layout Component**: Replace Material UI layout with Shadcn UI
3. **Migrate Forms**: Start with the most frequently used forms
4. **Test Accessibility**: Ensure WCAG compliance
5. **Performance Audit**: Measure improvements

## Resources

- [Shadcn UI Documentation](https://ui.shadcn.com)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [Radix UI Documentation](https://radix-ui.com)
- [Component Examples Repository](https://github.com/shadcn-ui/ui)

---

*Migration prepared for PDF Filler Tool - Enhancing user experience with modern, performant UI components*
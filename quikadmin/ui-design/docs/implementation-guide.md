# UI Implementation Guide - PDF Filler Application

## Quick Start

### Installation
```bash
# Install required dependencies
npm install @shadcn/ui lucide-react class-variance-authority clsx tailwind-merge
npm install -D tailwindcss @tailwindcss/forms @tailwindcss/typography
npm install framer-motion # For advanced animations
npm install react-hook-form @hookform/resolvers/zod zod # For forms
npm install @radix-ui/react-* # Core Radix primitives
```

### Setup Tailwind Configuration
```typescript
// tailwind.config.js
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

## Component Usage Examples

### 1. Dashboard Implementation
```tsx
// pages/dashboard.tsx
import React from 'react'
import { Dashboard } from '@/components/dashboard'
import { ResponsiveLayout } from '@/layouts/responsive-layout'
import { ToastProvider } from '@/components/notifications-and-states'

export default function DashboardPage() {
  return (
    <ToastProvider>
      <ResponsiveLayout>
        <Dashboard />
      </ResponsiveLayout>
    </ToastProvider>
  )
}
```

### 2. File Upload Integration
```tsx
// components/upload-page.tsx
import React from 'react'
import { FileUpload } from '@/components/file-upload'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/notifications-and-states'

export const UploadPage: React.FC = () => {
  const { showToast } = useToast()
  
  const handleFilesSelected = (files: File[]) => {
    showToast({
      type: 'success',
      title: `${files.length} file(s) selected`,
      description: 'Files are ready for processing'
    })
  }
  
  const handleFileRemoved = (fileId: string) => {
    showToast({
      type: 'info',
      title: 'File removed',
      description: 'File has been removed from upload queue'
    })
  }
  
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Upload PDF Files</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUpload
              maxFiles={5}
              maxFileSize={10 * 1024 * 1024} // 10MB
              acceptedTypes={['.pdf', '.png', '.jpg', '.jpeg']}
              onFilesSelected={handleFilesSelected}
              onFileRemoved={handleFileRemoved}
              multiple={true}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

### 3. Data Table Usage
```tsx
// components/files-page.tsx
import React from 'react'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Eye, Edit, Trash2 } from 'lucide-react'

interface FileRecord {
  id: string
  filename: string
  status: 'completed' | 'processing' | 'failed' | 'pending'
  uploadDate: string
  fileSize: number
  processedBy: string
}

export const FilesPage: React.FC = () => {
  const columns = [
    {
      key: 'filename' as keyof FileRecord,
      label: 'File Name',
      sortable: true,
      filterable: true,
      render: (item: FileRecord) => (
        <div className="font-medium">{item.filename}</div>
      )
    },
    {
      key: 'status' as keyof FileRecord,
      label: 'Status',
      sortable: true,
      render: (item: FileRecord) => (
        <StatusBadge status={item.status} />
      )
    },
    // ... more columns
  ]
  
  const actions = [
    {
      label: 'View',
      icon: <Eye className="h-4 w-4" />,
      onClick: (item: FileRecord) => {
        // Handle view action
      }
    },
    {
      label: 'Edit',
      icon: <Edit className="h-4 w-4" />,
      onClick: (item: FileRecord) => {
        // Handle edit action
      }
    },
    {
      label: 'Delete',
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (item: FileRecord) => {
        // Handle delete action
      },
      variant: 'destructive' as const
    }
  ]
  
  return (
    <div className="container mx-auto py-8">
      <DataTable
        data={files}
        columns={columns}
        actions={actions}
        searchable={true}
        selectable={true}
        pageSize={10}
      />
    </div>
  )
}
```

### 4. Form Implementation
```tsx
// components/settings-form.tsx
import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { AccessibleForm } from '@/components/accessible-forms'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/notifications-and-states'

const settingsSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  notifications: z.boolean(),
  theme: z.enum(['light', 'dark', 'system'])
})

type SettingsFormData = z.infer<typeof settingsSchema>

export const SettingsForm: React.FC = () => {
  const { showToast } = useToast()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema)
  })
  
  const onSubmit = async (data: SettingsFormData) => {
    try {
      // API call to save settings
      await saveSettings(data)
      
      showToast({
        type: 'success',
        title: 'Settings saved',
        description: 'Your preferences have been updated successfully'
      })
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Save failed',
        description: 'Could not save settings. Please try again.'
      })
    }
  }
  
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          label="First Name"
          required
          error={errors.firstName?.message}
        >
          <Input
            {...register('firstName')}
            placeholder="Enter your first name"
          />
        </FormField>
        
        <FormField
          label="Last Name"
          required
          error={errors.lastName?.message}
        >
          <Input
            {...register('lastName')}
            placeholder="Enter your last name"
          />
        </FormField>
      </div>
      
      <FormField
        label="Email Address"
        required
        error={errors.email?.message}
      >
        <Input
          {...register('email')}
          type="email"
          placeholder="your.email@example.com"
        />
      </FormField>
      
      <div className="flex items-center space-x-2">
        <Checkbox
          {...register('notifications')}
          id="notifications"
        />
        <Label htmlFor="notifications">
          Receive email notifications
        </Label>
      </div>
      
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          'Save Settings'
        )}
      </Button>
    </form>
  )
}
```

## Theme Implementation

### Dark Mode Setup
```tsx
// context/theme-context.tsx
import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'dark' | 'light'
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('light')

  useEffect(() => {
    const root = window.document.documentElement
    
    const getSystemTheme = (): 'dark' | 'light' => {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    
    const applyTheme = (newTheme: Theme) => {
      const resolved = newTheme === 'system' ? getSystemTheme() : newTheme
      
      root.classList.remove('light', 'dark')
      root.classList.add(resolved)
      setResolvedTheme(resolved)
    }
    
    // Load saved theme or default to system
    const savedTheme = localStorage.getItem('theme') as Theme || 'system'
    setTheme(savedTheme)
    applyTheme(savedTheme)
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      setTheme(newTheme)
      localStorage.setItem('theme', newTheme)
      
      const root = window.document.documentElement
      const resolved = newTheme === 'system' 
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : newTheme
      
      root.classList.remove('light', 'dark')
      root.classList.add(resolved)
      setResolvedTheme(resolved)
    },
    resolvedTheme
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
```

### CSS Variables Setup
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

## Responsive Breakpoints

### Breakpoint Strategy
```typescript
// utils/responsive.ts
export const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px' // Extra large
}

export const useBreakpoint = () => {
  const [breakpoint, setBreakpoint] = useState<keyof typeof breakpoints>('lg')
  
  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth
      if (width < 640) setBreakpoint('sm')
      else if (width < 768) setBreakpoint('md')
      else if (width < 1024) setBreakpoint('lg')
      else if (width < 1280) setBreakpoint('xl')
      else setBreakpoint('2xl')
    }
    
    updateBreakpoint()
    window.addEventListener('resize', updateBreakpoint)
    return () => window.removeEventListener('resize', updateBreakpoint)
  }, [])
  
  return breakpoint
}
```

### Container Components
```tsx
// components/layout/container.tsx
import React from 'react'
import { cn } from '@/lib/utils'

interface ContainerProps {
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string
  padding?: boolean
}

export const Container: React.FC<ContainerProps> = ({
  children,
  size = 'lg',
  className,
  padding = true
}) => {
  const sizeClasses = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl',
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    full: 'max-w-full'
  }
  
  return (
    <div
      className={cn(
        'mx-auto',
        sizeClasses[size],
        padding && 'px-4 sm:px-6 lg:px-8',
        className
      )}
    >
      {children}
    </div>
  )
}
```

## Performance Optimization

### Code Splitting
```tsx
// utils/lazy-loading.tsx
import React, { Suspense } from 'react'
import { LoadingCard } from '@/components/notifications-and-states'

// Lazy load heavy components
export const LazyDashboard = React.lazy(() => import('@/components/dashboard'))
export const LazyDataTable = React.lazy(() => import('@/components/data-table'))
export const LazyFileUpload = React.lazy(() => import('@/components/file-upload'))

// Wrapper for lazy components
export const LazyComponent: React.FC<{
  children: React.ReactNode
  fallback?: React.ReactNode
}> = ({ children, fallback = <LoadingCard lines={5} /> }) => {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  )
}
```

### Image Optimization
```tsx
// components/optimized-image.tsx
import React from 'react'
import Image from 'next/image'

interface OptimizedImageProps {
  src: string
  alt: string
  width: number
  height: number
  className?: string
  priority?: boolean
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  placeholder = 'empty',
  blurDataURL
}) => {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      placeholder={placeholder}
      blurDataURL={blurDataURL}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    />
  )
}
```

## Testing Setup

### Component Testing
```typescript
// __tests__/dashboard.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Dashboard } from '@/components/dashboard'
import { ToastProvider } from '@/components/notifications-and-states'

expect.extend(toHaveNoViolations)

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ToastProvider>
      {component}
    </ToastProvider>
  )
}

describe('Dashboard Component', () => {
  test('renders dashboard with correct heading', () => {
    renderWithProviders(<Dashboard />)
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument()
  })
  
  test('displays metric cards', () => {
    renderWithProviders(<Dashboard />)
    expect(screen.getByText(/total forms processed/i)).toBeInTheDocument()
    expect(screen.getByText(/active templates/i)).toBeInTheDocument()
  })
  
  test('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<Dashboard />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
  
  test('handles upload button click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Dashboard />)
    
    const uploadButton = screen.getByRole('button', { name: /upload pdf/i })
    await user.click(uploadButton)
    
    // Assert expected behavior
  })
})
```

### Visual Regression Testing
```typescript
// __tests__/visual.test.tsx
import { render } from '@testing-library/react'
import { Dashboard } from '@/components/dashboard'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

expect.extend({ toMatchImageSnapshot })

describe('Visual Regression Tests', () => {
  test('Dashboard matches snapshot', () => {
    const { container } = render(<Dashboard />)
    expect(container.firstChild).toMatchImageSnapshot({
      threshold: 0.2,
      thresholdType: 'percent'
    })
  })
})
```

## Build and Deployment

### Build Configuration
```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['example.com'],
    formats: ['image/webp', 'image/avif'],
  },
  experimental: {
    optimizeCss: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  webpack: (config) => {
    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    }
    return config
  },
}

module.exports = nextConfig
```

### Environment Configuration
```bash
# .env.local
NEXT_PUBLIC_APP_NAME="PDF Filler"
NEXT_PUBLIC_API_URL="https://api.example.com"
NEXT_PUBLIC_ANALYTICS_ID="GA_MEASUREMENT_ID"

# .env.production
NODE_ENV=production
NEXT_PUBLIC_APP_ENV=production
```

## Maintenance and Updates

### Component Versioning
```typescript
// CHANGELOG.md format
## [1.2.0] - 2024-01-15

### Added
- New FileUpload component with drag-and-drop
- Dark mode support for all components
- Accessibility improvements

### Changed
- Updated Button component styling
- Improved DataTable performance

### Fixed
- Fixed focus management in Modal component
- Resolved mobile responsiveness issues

### Breaking Changes
- Renamed `size` prop to `variant` in Badge component
```

This implementation guide provides a comprehensive foundation for building the PDF Filler application with modern, accessible, and performant UI components.
/**
 * Vitest test setup file
 * Configures testing environment and global test utilities
 */

import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from 'react-query'
import { BrowserRouter } from 'react-router-dom'
import React from 'react'

// Mock toast/sonner - prevent React rendering issues in tests
// This MUST be done before any imports that use sonner
vi.mock('sonner', () => {
  const mockToast = {
    success: vi.fn(() => 'mock-toast-id'),
    error: vi.fn(() => 'mock-toast-id'),
    warning: vi.fn(() => 'mock-toast-id'),
    info: vi.fn(() => 'mock-toast-id'),
    loading: vi.fn(() => 'mock-toast-id'),
    promise: vi.fn(() => 'mock-toast-id'),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
  }
  
  return {
    toast: mockToast,
    default: mockToast,
    Toaster: () => null, // Mock Toaster component to prevent rendering
  }
})

// Mock toast from lib - must match the actual implementation
vi.mock('@/lib/toast', () => {
  const mockToast = {
    success: vi.fn(() => 'mock-toast-id'),
    error: vi.fn(() => 'mock-toast-id'),
    warning: vi.fn(() => 'mock-toast-id'),
    info: vi.fn(() => 'mock-toast-id'),
    loading: vi.fn(() => 'mock-toast-id'),
    promise: vi.fn(() => 'mock-toast-id'),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
  }
  
  return {
    toast: mockToast,
    default: mockToast,
  }
})

// Mock @radix-ui/react-slider for tests
vi.mock('@radix-ui/react-slider', () => ({
  Root: ({ children, value, onValueChange, min, max, step, className, ...props }: any) => (
    React.createElement('div', { 'data-testid': 'slider-root', className, ...props },
      React.createElement('input', {
        type: 'range',
        value: value?.[0] || 0,
        onChange: (e: any) => onValueChange?.([Number(e.target.value)]),
        min,
        max,
        step,
      }),
      children
    )
  ),
  Track: ({ children, className }: any) => React.createElement('div', { 'data-testid': 'slider-track', className }, children),
  Range: ({ className }: any) => React.createElement('div', { 'data-testid': 'slider-range', className }),
  Thumb: ({ className }: any) => React.createElement('div', { 'data-testid': 'slider-thumb', className }),
}))

// Mock @radix-ui/react-switch for tests
vi.mock('@radix-ui/react-switch', () => ({
  Root: ({ checked, onCheckedChange, className, ...props }: any) => (
    React.createElement('button', {
      role: 'switch',
      'aria-checked': checked || false,
      'data-state': checked ? 'checked' : 'unchecked',
      onClick: () => onCheckedChange?.(!checked),
      className,
      ...props,
    })
  ),
  Thumb: ({ className }: any) => React.createElement('span', { 'data-testid': 'switch-thumb', className }),
}))

afterEach(() => {
  cleanup()
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any

global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
} as any

// Mock PointerCapture API for jsdom compatibility with Radix UI
if (typeof Element !== 'undefined' && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function() {
    return false
  }
  Element.prototype.setPointerCapture = function() {}
  Element.prototype.releasePointerCapture = function() {}
}

// Mock scrollIntoView for jsdom compatibility
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function() {}
}

// Ensure document.body exists for DOM operations
if (typeof document !== 'undefined') {
  // Create document structure if it doesn't exist
  if (!document.documentElement) {
    const html = document.createElement('html')
    document.appendChild(html)
  }
  
  if (!document.body) {
    const body = document.createElement('body')
    document.documentElement.appendChild(body)
  }
  
  // Ensure there's a root element for React portals (some libraries need this)
  if (!document.getElementById('root') && !document.getElementById('__next')) {
    const root = document.createElement('div')
    root.id = 'root'
    document.body.appendChild(root)
  }
  
  // Ensure there's a container for testing-library
  if (!document.getElementById('test-container')) {
    const container = document.createElement('div')
    container.id = 'test-container'
    document.body.appendChild(container)
  }
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient()
  
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient()
  const { render } = require('@testing-library/react')
  
  const { rerender, ...result } = render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </QueryClientProvider>
  )
  
  return {
    ...result,
    rerender: (ui: React.ReactElement) =>
      rerender(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            {ui}
          </BrowserRouter>
        </QueryClientProvider>
      ),
  }
}

export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'

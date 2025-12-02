/**
 * Phase 1 Component Tests - Spinner Component
 * Tests for Spinner variants, sizes, and accessibility
 */

import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Spinner } from '@/components/ui/spinner'

describe('Spinner Component', () => {
  describe('Basic Rendering', () => {
    it('renders spinner', () => {
      render(<Spinner />)
      const spinner = screen.getByRole('status')
      expect(spinner).toBeInTheDocument()
    })

    it('has proper accessibility attributes', () => {
      render(<Spinner />)
      const spinner = screen.getByRole('status')
      expect(spinner).toHaveAttribute('aria-live', 'polite')
      expect(spinner).toHaveAttribute('aria-label', 'Loading...')
    })

    it('renders label text when provided', () => {
      render(<Spinner label="Loading content" />)
      const spinner = screen.getByRole('status')
      expect(spinner).toHaveAttribute('aria-label', 'Loading content')
      expect(screen.getByText(/loading content/i)).toBeInTheDocument()
    })
  })

  describe('Sizes', () => {
    it('renders small size', () => {
      const { container } = render(<Spinner size="sm" />)
      const spinnerElement = container.querySelector('[data-slot="spinner"] > div')
      expect(spinnerElement).toHaveClass('h-4', 'w-4')
    })

    it('renders medium size', () => {
      const { container } = render(<Spinner size="md" />)
      const spinnerElement = container.querySelector('[data-slot="spinner"] > div')
      expect(spinnerElement).toHaveClass('h-6', 'w-6')
    })

    it('renders large size', () => {
      const { container } = render(<Spinner size="lg" />)
      const spinnerElement = container.querySelector('[data-slot="spinner"] > div')
      expect(spinnerElement).toHaveClass('h-8', 'w-8')
    })

    it('renders default size', () => {
      const { container } = render(<Spinner />)
      // Default size is "md" which is h-6 w-6
      const spinnerElement = container.querySelector('[data-slot="spinner"] > div')
      expect(spinnerElement).toHaveClass('h-6', 'w-6')
    })
  })

  describe('Variants', () => {
    it('renders default variant', () => {
      render(<Spinner />)
      const spinner = screen.getByRole('status')
      expect(spinner).toBeInTheDocument()
    })

    it('renders secondary variant', () => {
      const { container } = render(<Spinner variant="secondary" />)
      const spinnerElement = container.querySelector('[data-slot="spinner"] > div')
      expect(spinnerElement).toHaveClass('text-secondary-foreground')
    })

    it('renders muted variant', () => {
      const { container } = render(<Spinner variant="muted" />)
      const spinnerElement = container.querySelector('[data-slot="spinner"] > div')
      expect(spinnerElement).toHaveClass('text-muted-foreground')
    })

    it('renders destructive variant', () => {
      const { container } = render(<Spinner variant="destructive" />)
      const spinnerElement = container.querySelector('[data-slot="spinner"] > div')
      expect(spinnerElement).toHaveClass('text-destructive')
    })
  })

  describe('Accessibility', () => {
    it('has status role', () => {
      render(<Spinner />)
      const spinner = screen.getByRole('status')
      expect(spinner).toBeInTheDocument()
    })

    it('has aria-live attribute', () => {
      render(<Spinner />)
      const spinner = screen.getByRole('status')
      expect(spinner).toHaveAttribute('aria-live', 'polite')
    })

    it('has aria-label', () => {
      render(<Spinner />)
      const spinner = screen.getByRole('status')
      expect(spinner).toHaveAttribute('aria-label', 'Loading...')
    })

    it('has custom aria-label when label provided', () => {
      render(<Spinner label="Processing..." />)
      const spinner = screen.getByRole('status')
      expect(spinner).toHaveAttribute('aria-label', 'Processing...')
    })
  })
})

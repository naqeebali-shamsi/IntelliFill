/**
 * Phase 1 Component Tests - Skeleton Component
 * Tests for Skeleton loading states
 */

import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Skeleton } from '@/components/ui/skeleton'

describe('Skeleton Component', () => {
  describe('Basic Rendering', () => {
    it('renders skeleton', () => {
      render(<Skeleton />)
      const skeleton = screen.getByRole('status', { hidden: true })
      expect(skeleton).toBeInTheDocument()
    })

    it('renders with custom className', () => {
      render(<Skeleton className="custom-class" />)
      const skeleton = screen.getByRole('status', { hidden: true })
      expect(skeleton).toHaveClass('custom-class')
    })

    it('renders with width and height', () => {
      render(<Skeleton className="w-10 h-10" />)
      const skeleton = screen.getByRole('status', { hidden: true })
      expect(skeleton).toHaveClass('w-10', 'h-10')
    })
  })

  describe('Variants', () => {
    it('renders default variant', () => {
      render(<Skeleton />)
      const skeleton = screen.getByRole('status', { hidden: true })
      expect(skeleton).toBeInTheDocument()
    })

    it('renders text variant', () => {
      render(<Skeleton variant="text" />)
      const skeleton = screen.getByRole('status', { hidden: true })
      expect(skeleton).toBeInTheDocument()
    })

    it('renders circular variant', () => {
      render(<Skeleton variant="circular" />)
      const skeleton = screen.getByRole('status', { hidden: true })
      expect(skeleton).toHaveClass('rounded-full')
    })
  })

  describe('Accessibility', () => {
    it('has status role', () => {
      render(<Skeleton />)
      const skeleton = screen.getByRole('status', { hidden: true })
      expect(skeleton).toBeInTheDocument()
    })

    it('has aria-label', () => {
      render(<Skeleton />)
      const skeleton = screen.getByRole('status', { hidden: true })
      expect(skeleton).toHaveAttribute('aria-label', 'Loading...')
    })
  })
})

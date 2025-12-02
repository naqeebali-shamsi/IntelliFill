/**
 * Phase 1 Component Tests - Progress Component
 * Tests for Progress with indeterminate state, labels, and variants
 */

import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Progress } from '@/components/ui/progress'

describe('Progress Component', () => {
  describe('Basic Rendering', () => {
    it('renders progress bar', () => {
      render(<Progress value={50} />)
      const progress = screen.getByRole('progressbar')
      expect(progress).toBeInTheDocument()
    })

    it('renders with correct value', () => {
      render(<Progress value={75} />)
      const progress = screen.getByRole('progressbar')
      expect(progress).toHaveAttribute('aria-valuenow', '75')
      expect(progress).toHaveAttribute('aria-valuemin', '0')
      expect(progress).toHaveAttribute('aria-valuemax', '100')
    })

    it('clamps value to 0-100 range', () => {
      render(<Progress value={150} />)
      const progress = screen.getByRole('progressbar')
      expect(progress).toHaveAttribute('aria-valuenow', '100')
    })

    it('clamps negative value to 0', () => {
      render(<Progress value={-10} />)
      const progress = screen.getByRole('progressbar')
      expect(progress).toHaveAttribute('aria-valuenow', '0')
    })
  })

  describe('Indeterminate State', () => {
    it('renders indeterminate progress', () => {
      render(<Progress indeterminate />)
      const progress = screen.getByRole('progressbar')
      expect(progress).toBeInTheDocument()
      expect(progress).toHaveAttribute('aria-label', 'Loading...')
    })

    it('does not show percentage when indeterminate', () => {
      render(<Progress indeterminate showPercentage />)
      const percentage = screen.queryByText(/%/)
      expect(percentage).not.toBeInTheDocument()
    })

    it('has undefined aria-valuenow when indeterminate', () => {
      render(<Progress indeterminate />)
      const progress = screen.getByRole('progressbar')
      expect(progress).not.toHaveAttribute('aria-valuenow')
    })

    it('shows indeterminate animation class', () => {
      render(<Progress indeterminate />)
      const indicator = document.querySelector('[data-slot="progress-indicator"]')
      expect(indicator).toHaveClass('animate-progress-indeterminate')
    })
  })

  describe('Labels', () => {
    it('renders label when provided', () => {
      render(<Progress value={50} label="Upload Progress" />)
      expect(screen.getByText(/upload progress/i)).toBeInTheDocument()
    })

    it('renders percentage when showPercentage is true', () => {
      render(<Progress value={50} showPercentage />)
      expect(screen.getByText(/50%/i)).toBeInTheDocument()
    })

    it('does not show percentage when indeterminate', () => {
      render(<Progress indeterminate showPercentage />)
      const percentage = screen.queryByText(/%/)
      expect(percentage).not.toBeInTheDocument()
    })

    it('formats percentage correctly', () => {
      render(<Progress value={75.5} showPercentage />)
      expect(screen.getByText(/76%/i)).toBeInTheDocument()
    })
  })

  describe('Variants', () => {
    it('renders default variant', () => {
      render(<Progress value={50} />)
      const progress = screen.getByRole('progressbar')
      expect(progress).toBeInTheDocument()
    })

    it('renders success variant', () => {
      const { container } = render(<Progress value={50} variant="success" />)
      const indicator = container.querySelector('[data-slot="progress-indicator"]')
      expect(indicator).toHaveClass('bg-green-500')
    })

    it('renders warning variant', () => {
      const { container } = render(<Progress value={50} variant="warning" />)
      const indicator = container.querySelector('[data-slot="progress-indicator"]')
      expect(indicator).toHaveClass('bg-yellow-500')
    })

    it('renders error variant', () => {
      const { container } = render(<Progress value={50} variant="error" />)
      const indicator = container.querySelector('[data-slot="progress-indicator"]')
      expect(indicator).toHaveClass('bg-red-500')
    })
  })

  describe('Accessibility', () => {
    it('has proper progressbar role', () => {
      render(<Progress value={50} />)
      const progress = screen.getByRole('progressbar')
      expect(progress).toBeInTheDocument()
    })

    it('has aria-label when label is provided', () => {
      render(<Progress value={50} label="Upload Progress" />)
      const progress = screen.getByRole('progressbar')
      expect(progress).toHaveAttribute('aria-label', 'Upload Progress')
    })

    it('has default aria-label when indeterminate', () => {
      render(<Progress indeterminate />)
      const progress = screen.getByRole('progressbar')
      expect(progress).toHaveAttribute('aria-label', 'Loading...')
    })

    it('has aria-valuenow when value is provided', () => {
      render(<Progress value={50} />)
      const progress = screen.getByRole('progressbar')
      expect(progress).toHaveAttribute('aria-valuenow', '50')
      expect(progress).toHaveAttribute('aria-valuemin', '0')
      expect(progress).toHaveAttribute('aria-valuemax', '100')
    })
  })
})

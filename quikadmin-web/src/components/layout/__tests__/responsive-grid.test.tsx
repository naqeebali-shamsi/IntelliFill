/**
 * Phase 1 Component Tests - ResponsiveGrid Component
 * Tests for responsive grid layouts
 */

import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResponsiveGrid } from '@/components/layout/responsive-grid'

describe('ResponsiveGrid Component', () => {
  describe('Basic Rendering', () => {
    it('renders grid container', () => {
      render(
        <ResponsiveGrid cols={2}>
          <div>Item 1</div>
          <div>Item 2</div>
        </ResponsiveGrid>
      )
      expect(screen.getByText(/item 1/i)).toBeInTheDocument()
      expect(screen.getByText(/item 2/i)).toBeInTheDocument()
    })

    it('applies column classes', () => {
      const { container } = render(
        <ResponsiveGrid cols={3}>
          <div>Item</div>
        </ResponsiveGrid>
      )
      const grid = container.querySelector('[data-slot="responsive-grid"]')
      expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3')
    })

    it('applies gap classes', () => {
      const { container } = render(
        <ResponsiveGrid cols={2} gap="lg">
          <div>Item</div>
        </ResponsiveGrid>
      )
      const grid = container.querySelector('[data-slot="responsive-grid"]')
      expect(grid).toHaveClass('gap-6')
    })
  })

  describe('Responsive Columns', () => {
    it('applies responsive column classes', () => {
      const { container } = render(
        <ResponsiveGrid cols={2}>
          <div>Item</div>
        </ResponsiveGrid>
      )
      const grid = container.querySelector('[data-slot="responsive-grid"]')
      expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2')
    })
  })
})

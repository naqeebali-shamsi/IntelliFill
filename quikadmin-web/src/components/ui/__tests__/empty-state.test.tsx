/**
 * Phase 1 Component Tests - EmptyState Component
 * Tests for EmptyState with illustrations and actions
 */

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyState, EmptyStateSimple } from '@/components/ui/empty-state'
import { FileText } from 'lucide-react'

describe('EmptyState Component', () => {
  describe('Basic Rendering', () => {
    it('renders title', () => {
      render(<EmptyState title="No documents" />)
      expect(screen.getByText(/no documents/i)).toBeInTheDocument()
    })

    it('renders description', () => {
      render(
        <EmptyState
          title="No documents"
          description="You haven't uploaded any documents yet"
        />
      )
      expect(screen.getByText(/you haven't uploaded/i)).toBeInTheDocument()
    })

    it('renders icon when provided', () => {
      render(<EmptyState title="Empty" icon={FileText} />)
      // Icon is rendered as SVG, check for the icon container
      const iconContainer = screen.getByText(/empty/i).closest('[data-slot="empty-state"]')?.querySelector('svg')
      expect(iconContainer).toBeInTheDocument()
    })
  })

  describe('Action Button', () => {
    it('renders action button when provided', () => {
      render(
        <EmptyState
          title="Empty"
          action={{
            label: 'Upload File',
            onClick: () => {},
          }}
        />
      )
      const button = screen.getByRole('button', { name: /upload file/i })
      expect(button).toBeInTheDocument()
    })

    it('calls onClick when action button is clicked', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      render(
        <EmptyState
          title="Empty"
          action={{
            label: 'Upload',
            onClick: handleClick,
          }}
        />
      )
      
      const button = screen.getByRole('button', { name: /upload/i })
      await user.click(button)
      
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('renders action with icon', () => {
      render(
        <EmptyState
          title="Empty"
          action={{
            label: 'Upload',
            onClick: () => {},
            icon: FileText,
          }}
        />
      )
      const button = screen.getByRole('button', { name: /upload/i })
      expect(button).toBeInTheDocument()
    })
  })

  describe('Variants', () => {
    it('renders default size', () => {
      render(<EmptyState title="Empty" />)
      const container = screen.getByText(/empty/i).closest('[data-slot="empty-state"]')
      expect(container).toBeInTheDocument()
    })

    it('renders small size', () => {
      render(<EmptyState title="Empty" size="sm" />)
      const container = screen.getByText(/empty/i).closest('[data-slot="empty-state"]')
      expect(container).toHaveClass('p-4')
    })

    it('renders large size', () => {
      render(<EmptyState title="Empty" size="lg" />)
      const container = screen.getByText(/empty/i).closest('[data-slot="empty-state"]')
      expect(container).toHaveClass('p-12')
    })
  })

  describe('Accessibility', () => {
    it('has proper semantic structure', () => {
      render(<EmptyState title="No items" description="Description" />)
      const heading = screen.getByRole('heading', { name: /no items/i })
      expect(heading).toBeInTheDocument()
    })

    it('has accessible action button', () => {
      render(
        <EmptyState
          title="Empty"
          action={{
            label: 'Add Item',
            onClick: () => {},
          }}
        />
      )
      const button = screen.getByRole('button', { name: /add item/i })
      expect(button).toBeInTheDocument()
    })
  })

  describe('Test ID Support', () => {
    it('applies data-testid to the root element', () => {
      render(<EmptyState title="Empty" data-testid="my-empty-state" />)
      const element = screen.getByTestId('my-empty-state')
      expect(element).toBeInTheDocument()
      expect(element).toHaveAttribute('data-slot', 'empty-state')
    })

    it('works without data-testid prop', () => {
      render(<EmptyState title="Empty" />)
      const container = screen.getByText(/empty/i).closest('[data-slot="empty-state"]')
      expect(container).toBeInTheDocument()
      expect(container).not.toHaveAttribute('data-testid')
    })
  })
})

describe('EmptyStateSimple Component', () => {
  it('renders message', () => {
    render(<EmptyStateSimple message="No items to display" />)
    expect(screen.getByText(/no items to display/i)).toBeInTheDocument()
  })

  it('renders icon when provided', () => {
    render(<EmptyStateSimple message="No items" icon={FileText} />)
    const container = screen.getByText(/no items/i).closest('[data-slot="empty-state-simple"]')
    expect(container?.querySelector('svg')).toBeInTheDocument()
  })

  it('applies data-testid to the root element', () => {
    render(<EmptyStateSimple message="No items" data-testid="simple-empty-state" />)
    const element = screen.getByTestId('simple-empty-state')
    expect(element).toBeInTheDocument()
    expect(element).toHaveAttribute('data-slot', 'empty-state-simple')
  })

  it('works without data-testid prop', () => {
    render(<EmptyStateSimple message="No items" />)
    const container = screen.getByText(/no items/i).closest('[data-slot="empty-state-simple"]')
    expect(container).toBeInTheDocument()
    expect(container).not.toHaveAttribute('data-testid')
  })
})

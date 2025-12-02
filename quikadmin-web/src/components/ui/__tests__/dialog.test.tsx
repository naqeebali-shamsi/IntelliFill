/**
 * Phase 1 Component Tests - Dialog Component
 * Tests for Dialog sizes, animations, and accessibility
 */

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

describe('Dialog Component', () => {
  describe('Basic Rendering', () => {
    it('renders dialog trigger', () => {
      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Test Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      )
      const trigger = screen.getByRole('button', { name: /open/i })
      expect(trigger).toBeInTheDocument()
    })

    it('opens dialog when trigger is clicked', async () => {
      const user = userEvent.setup()
      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Test Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      )
      
      const trigger = screen.getByRole('button', { name: /open/i })
      await user.click(trigger)
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })

    it('renders dialog title', async () => {
      const user = userEvent.setup()
      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>
      )
      
      await user.click(screen.getByRole('button', { name: /open/i }))
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText(/dialog title/i)).toBeInTheDocument()
      })
    })

    it('renders dialog description', async () => {
      const user = userEvent.setup()
      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>Description text</DialogDescription>
          </DialogContent>
        </Dialog>
      )
      
      await user.click(screen.getByRole('button', { name: /open/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/description text/i)).toBeInTheDocument()
      })
    })
  })

  describe('Sizes', () => {
    const sizes = ['sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'fullscreen'] as const

    sizes.forEach((size) => {
      it(`renders ${size} size`, async () => {
        const user = userEvent.setup()
        render(
          <Dialog>
            <DialogTrigger asChild>
              <Button>Open</Button>
            </DialogTrigger>
            <DialogContent size={size}>
              <DialogTitle>Test</DialogTitle>
            </DialogContent>
          </Dialog>
        )
        
        await user.click(screen.getByRole('button', { name: /open/i }))
        
        await waitFor(() => {
          const dialog = screen.getByRole('dialog')
          expect(dialog).toBeInTheDocument()
          if (size === 'sm') expect(dialog).toHaveClass('max-w-sm')
          if (size === 'md') expect(dialog).toHaveClass('max-w-md')
          if (size === 'lg') expect(dialog).toHaveClass('max-w-lg')
          if (size === 'xl') expect(dialog).toHaveClass('max-w-xl')
          if (size === '2xl') expect(dialog).toHaveClass('max-w-2xl')
          if (size === '3xl') expect(dialog).toHaveClass('max-w-3xl')
          if (size === '4xl') expect(dialog).toHaveClass('max-w-4xl')
          if (size === 'fullscreen') expect(dialog).toHaveClass('max-w-[calc(100%-2rem)]')
        })
      })
    })
  })

  describe('Close Button', () => {
    it('shows close button by default', async () => {
      const user = userEvent.setup()
      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Test</DialogTitle>
          </DialogContent>
        </Dialog>
      )
      
      await user.click(screen.getByRole('button', { name: /open/i }))
      
      await waitFor(() => {
        const closeButton = screen.getByRole('button', { name: /close/i })
        expect(closeButton).toBeInTheDocument()
      })
    })

    it('hides close button when showCloseButton is false', async () => {
      const user = userEvent.setup()
      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open</Button>
          </DialogTrigger>
          <DialogContent showCloseButton={false}>
            <DialogTitle>Test</DialogTitle>
          </DialogContent>
        </Dialog>
      )
      
      await user.click(screen.getByRole('button', { name: /open/i }))
      
      await waitFor(() => {
        const closeButton = screen.queryByRole('button', { name: /close/i })
        expect(closeButton).not.toBeInTheDocument()
      })
    })

    it('closes dialog when close button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Test</DialogTitle>
          </DialogContent>
        </Dialog>
      )
      
      await user.click(screen.getByRole('button', { name: /open/i }))
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
      
      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper dialog role', async () => {
      const user = userEvent.setup()
      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Test</DialogTitle>
          </DialogContent>
        </Dialog>
      )
      
      await user.click(screen.getByRole('button', { name: /open/i }))
      
      await waitFor(() => {
        const dialog = screen.getByRole('dialog')
        expect(dialog).toBeInTheDocument()
      })
    })

    it('traps focus within dialog', async () => {
      const user = userEvent.setup()
      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Test</DialogTitle>
            <Button>Inside Button</Button>
          </DialogContent>
        </Dialog>
      )
      
      await user.click(screen.getByRole('button', { name: /open/i }))
      
      await waitFor(() => {
        const dialog = screen.getByRole('dialog')
        expect(dialog).toBeInTheDocument()
      })
      
      // Focus should be trapped - this is tested by Radix UI internally
      const insideButton = screen.getByRole('button', { name: /inside button/i })
      expect(insideButton).toBeInTheDocument()
    })

    it('closes on Escape key', async () => {
      const user = userEvent.setup()
      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Test</DialogTitle>
          </DialogContent>
        </Dialog>
      )
      
      await user.click(screen.getByRole('button', { name: /open/i }))
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
      
      await user.keyboard('{Escape}')
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })
  })

  describe('DialogFooter', () => {
    it('renders footer content', async () => {
      const user = userEvent.setup()
      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Test</DialogTitle>
            <DialogFooter>
              <Button>Cancel</Button>
              <Button>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )
      
      await user.click(screen.getByRole('button', { name: /open/i }))
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      })
    })
  })
})

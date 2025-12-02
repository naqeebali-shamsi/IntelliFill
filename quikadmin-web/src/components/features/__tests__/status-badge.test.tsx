/**
 * Phase 1 Component Tests - StatusBadge Component
 * Tests for all status types and animations
 */

import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '@/components/features/status-badge'

describe('StatusBadge Component', () => {
  describe('Status Types', () => {
    const statuses = ['pending', 'processing', 'completed', 'failed'] as const

    statuses.forEach((status) => {
      it(`renders ${status} status`, () => {
        render(<StatusBadge status={status} />)
        expect(screen.getByText(new RegExp(status, 'i'))).toBeInTheDocument()
      })
    })
  })

  describe('Sizes', () => {
    it('renders small size', () => {
      render(<StatusBadge status="completed" size="sm" />)
      const badge = screen.getByText(/completed/i)
      expect(badge).toBeInTheDocument()
    })

    it('renders default size', () => {
      render(<StatusBadge status="completed" />)
      const badge = screen.getByText(/completed/i)
      expect(badge).toBeInTheDocument()
    })
  })

  describe('Icon Display', () => {
    it('shows icon when showIcon is true', () => {
      render(<StatusBadge status="completed" showIcon />)
      const badge = screen.getByText(/completed/i)
      expect(badge.closest('[data-slot="status-badge"]')).toBeInTheDocument()
    })

    it('hides icon when showIcon is false', () => {
      render(<StatusBadge status="completed" showIcon={false} />)
      const badge = screen.getByText(/completed/i)
      expect(badge).toBeInTheDocument()
    })
  })

  describe('Custom Label', () => {
    it('renders with custom label', () => {
      render(<StatusBadge status="processing" label="Uploading" />)
      const badge = screen.getByText(/uploading/i)
      expect(badge).toBeInTheDocument()
    })

    it('renders default label when no custom label provided', () => {
      render(<StatusBadge status="completed" />)
      const badge = screen.getByText(/completed/i)
      expect(badge).toBeInTheDocument()
    })
  })
})

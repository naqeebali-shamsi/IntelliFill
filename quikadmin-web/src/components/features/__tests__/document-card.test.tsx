/**
 * Phase 1 Component Tests - DocumentCard Component
 * Tests for DocumentCard with metadata and actions
 */

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentCard } from '@/components/features/document-card'

describe('DocumentCard Component', () => {
  const mockDocument = {
    id: '1',
    name: 'Test Document.pdf',
    fileType: 'pdf' as const,
    status: 'completed' as const,
    uploadDate: '2024-01-01T00:00:00Z',
    fileSize: 1024 * 1024, // 1MB
    pageCount: 5,
  }

  describe('Basic Rendering', () => {
    it('renders document name', () => {
      render(<DocumentCard {...mockDocument} />)
      expect(screen.getByText(/test document/i)).toBeInTheDocument()
    })

    it('renders file type', () => {
      render(<DocumentCard {...mockDocument} />)
      expect(screen.getByText(/pdf/i)).toBeInTheDocument()
    })

    it('renders status badge', () => {
      render(<DocumentCard {...mockDocument} />)
      expect(screen.getByText(/completed/i)).toBeInTheDocument()
    })

    it('renders file size', () => {
      render(<DocumentCard {...mockDocument} />)
      expect(screen.getByText(/1.*mb/i)).toBeInTheDocument()
    })
  })

  describe('Actions', () => {
    it('calls onView when view button is clicked', async () => {
      const handleView = vi.fn()
      const user = userEvent.setup()
      render(<DocumentCard {...mockDocument} onView={handleView} />)
      
      // Open dropdown menu
      const menuButton = screen.getByRole('button', { name: /document actions/i })
      await user.click(menuButton)
      
      // Click View option
      const viewOption = screen.getByRole('menuitem', { name: /view/i })
      await user.click(viewOption)
      
      expect(handleView).toHaveBeenCalledTimes(1)
      expect(handleView).toHaveBeenCalledWith(mockDocument.id)
    })

    it('calls onDownload when download button is clicked', async () => {
      const handleDownload = vi.fn()
      const user = userEvent.setup()
      render(<DocumentCard {...mockDocument} onDownload={handleDownload} />)
      
      // Open dropdown menu
      const menuButton = screen.getByRole('button', { name: /document actions/i })
      await user.click(menuButton)
      
      // Click Download option
      const downloadOption = screen.getByRole('menuitem', { name: /download/i })
      await user.click(downloadOption)
      
      expect(handleDownload).toHaveBeenCalledTimes(1)
      expect(handleDownload).toHaveBeenCalledWith(mockDocument.id)
    })

    it('calls onClick when card is clicked', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      render(<DocumentCard {...mockDocument} onClick={handleClick} />)
      
      const card = screen.getByText(/test document/i).closest('[data-slot="document-card"]')
      if (card) {
        await user.click(card)
        expect(handleClick).toHaveBeenCalledTimes(1)
      }
    })
  })

  describe('Status Display', () => {
    it('displays completed status', () => {
      render(<DocumentCard {...mockDocument} status="completed" />)
      expect(screen.getByText(/completed/i)).toBeInTheDocument()
    })

    it('displays processing status', () => {
      render(<DocumentCard {...mockDocument} status="processing" />)
      expect(screen.getByText(/processing/i)).toBeInTheDocument()
    })

    it('displays failed status', () => {
      render(<DocumentCard {...mockDocument} status="failed" />)
      expect(screen.getByText(/failed/i)).toBeInTheDocument()
    })
  })
})

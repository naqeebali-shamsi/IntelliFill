/**
 * Phase 2 Upload Tests - ProcessingStatus Component
 * Tests for processing status display, retry, and cancellation
 */

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProcessingStatus } from '@/components/features/processing-status'

describe('ProcessingStatus Component', () => {
  describe('Status Display', () => {
    it('renders pending status', () => {
      render(<ProcessingStatus status="pending" />)
      expect(screen.getByText(/pending/i)).toBeInTheDocument()
    })

    it('renders processing status', () => {
      render(<ProcessingStatus status="processing" progress={50} />)
      // StatusBadge shows "Processing" text
      const processingTexts = screen.getAllByText(/processing/i)
      expect(processingTexts.length).toBeGreaterThan(0)
    })

    it('renders completed status', () => {
      render(<ProcessingStatus status="completed" progress={100} />)
      expect(screen.getByText(/completed/i)).toBeInTheDocument()
    })

    it('renders failed status', () => {
      render(<ProcessingStatus status="failed" error="Processing failed" />)
      // StatusBadge shows "Failed" text
      const failedTexts = screen.getAllByText(/failed/i)
      expect(failedTexts.length).toBeGreaterThan(0)
      // Error message appears in alert description - may appear multiple times
      const errorTexts = screen.getAllByText(/processing failed/i)
      expect(errorTexts.length).toBeGreaterThan(0)
    })
  })

  describe('Progress Display', () => {
    it('shows progress bar when processing', () => {
      render(<ProcessingStatus status="processing" progress={50} />)
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toBeInTheDocument()
      expect(progressBar).toHaveAttribute('aria-valuenow', '50')
    })

    it('shows indeterminate progress when pending', () => {
      render(<ProcessingStatus status="pending" progress={0} />)
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toBeInTheDocument()
      // Indeterminate progress should not have aria-valuenow or have undefined
      expect(progressBar).not.toHaveAttribute('aria-valuenow')
    })

    it('does not show progress when completed', () => {
      render(<ProcessingStatus status="completed" progress={100} />)
      const progressBar = screen.queryByRole('progressbar')
      expect(progressBar).not.toBeInTheDocument()
    })
  })

  describe('Retry Functionality', () => {
    it('shows retry button when failed', () => {
      render(
        <ProcessingStatus
          status="failed"
          error="Error"
          onRetry={() => {}}
        />
      )
      const retryButton = screen.getByRole('button', { name: /retry/i })
      expect(retryButton).toBeInTheDocument()
    })

    it('calls onRetry when retry button is clicked', async () => {
      const handleRetry = vi.fn()
      const user = userEvent.setup()
      render(
        <ProcessingStatus
          status="failed"
          error="Error"
          onRetry={handleRetry}
        />
      )
      
      const retryButton = screen.getByRole('button', { name: /retry/i })
      await user.click(retryButton)
      
      expect(handleRetry).toHaveBeenCalledTimes(1)
    })

    it('does not show retry button when not failed', () => {
      render(<ProcessingStatus status="processing" progress={50} />)
      const retryButton = screen.queryByRole('button', { name: /retry/i })
      expect(retryButton).not.toBeInTheDocument()
    })
  })

  describe('Cancel Functionality', () => {
    it('shows cancel button when processing', () => {
      render(
        <ProcessingStatus
          status="processing"
          progress={50}
          onCancel={() => {}}
        />
      )
      const cancelButton = screen.getByRole('button', { name: /cancel processing/i })
      expect(cancelButton).toBeInTheDocument()
    })

    it('calls onCancel when cancel button is clicked', async () => {
      const handleCancel = vi.fn()
      const user = userEvent.setup()
      render(
        <ProcessingStatus
          status="processing"
          progress={50}
          onCancel={handleCancel}
        />
      )
      
      const cancelButton = screen.getByRole('button', { name: /cancel processing/i })
      await user.click(cancelButton)
      
      expect(handleCancel).toHaveBeenCalledTimes(1)
    })

    it('does not show cancel button when completed', () => {
      render(<ProcessingStatus status="completed" progress={100} />)
      const cancelButton = screen.queryByRole('button', { name: /cancel/i })
      expect(cancelButton).not.toBeInTheDocument()
    })
  })

  describe('Metadata Display', () => {
    it('shows metadata when showDetails is true', () => {
      render(
        <ProcessingStatus
          status="completed"
          progress={100}
          showDetails
          metadata={{
            confidence: 0.95,
            processingTime: 2.3,
            pageCount: 5,
            extractedFields: 12,
          }}
        />
      )
      // Metadata values may appear multiple times, check for existence
      const confidenceTexts = screen.getAllByText(/95%/i)
      expect(confidenceTexts.length).toBeGreaterThan(0)
      const timeTexts = screen.getAllByText(/2\.3s/i)
      expect(timeTexts.length).toBeGreaterThan(0)
      // Page count and extracted fields may match other numbers, use more specific queries
      expect(screen.getByText(/pages/i)).toBeInTheDocument()
      expect(screen.getByText(/fields extracted/i)).toBeInTheDocument()
    })

    it('hides metadata when showDetails is false', () => {
      render(
        <ProcessingStatus
          status="completed"
          progress={100}
          metadata={{
            confidence: 0.95,
          }}
        />
      )
      expect(screen.queryByText(/95%/i)).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper status indicators', () => {
      render(<ProcessingStatus status="processing" progress={50} />)
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '50')
    })

    it('has accessible retry button', () => {
      render(
        <ProcessingStatus
          status="failed"
          error="Error"
          onRetry={() => {}}
        />
      )
      const retryButton = screen.getByRole('button', { name: /retry processing/i })
      expect(retryButton).toBeInTheDocument()
    })
  })
})

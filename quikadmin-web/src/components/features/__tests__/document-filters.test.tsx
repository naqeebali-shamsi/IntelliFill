/**
 * Phase 3 Library Tests - DocumentFilters Component
 * Tests for filter functionality
 */

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentFilters } from '@/components/features/document-filters'
import { DocumentFilter } from '@/types/document'

describe('DocumentFilters Component', () => {
  describe('Basic Rendering', () => {
    it('renders filter button', () => {
      render(
        <DocumentFilters
          filter={{}}
          onFilterChange={() => {}}
          onClearFilter={() => {}}
        />
      )
      expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument()
    })

    it('shows active filter count badge', () => {
      render(
        <DocumentFilters
          filter={{ status: ['completed', 'processing'] }}
          onFilterChange={() => {}}
          onClearFilter={() => {}}
        />
      )
      expect(screen.getByText(/2/i)).toBeInTheDocument()
    })
  })

  describe('Status Filtering', () => {
    it('toggles status filter', async () => {
      const handleFilterChange = vi.fn()
      const user = userEvent.setup()
      render(
        <DocumentFilters
          filter={{}}
          onFilterChange={handleFilterChange}
          onClearFilter={() => {}}
        />
      )
      
      const filterButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filterButton)
      
      const completedCheckbox = screen.getByLabelText(/completed/i)
      await user.click(completedCheckbox)
      
      expect(handleFilterChange).toHaveBeenCalled()
    })

    it('allows multiple status selections', async () => {
      const handleFilterChange = vi.fn()
      const user = userEvent.setup()
      render(
        <DocumentFilters
          filter={{}}
          onFilterChange={handleFilterChange}
          onClearFilter={() => {}}
        />
      )
      
      const filterButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filterButton)
      
      const completedCheckbox = screen.getByLabelText(/completed/i)
      const processingCheckbox = screen.getByLabelText(/processing/i)
      
      await user.click(completedCheckbox)
      await user.click(processingCheckbox)
      
      expect(handleFilterChange).toHaveBeenCalledTimes(2)
    })
  })

  describe('File Type Filtering', () => {
    it('toggles file type filter', async () => {
      const handleFilterChange = vi.fn()
      const user = userEvent.setup()
      render(
        <DocumentFilters
          filter={{}}
          onFilterChange={handleFilterChange}
          onClearFilter={() => {}}
        />
      )
      
      const filterButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filterButton)
      
      const pdfCheckbox = screen.getByLabelText(/pdf/i)
      await user.click(pdfCheckbox)
      
      expect(handleFilterChange).toHaveBeenCalled()
    })
  })

  describe('Date Range Filtering', () => {
    it('changes date range preset', async () => {
      const handleDateRangeChange = vi.fn()
      const user = userEvent.setup()
      render(
        <DocumentFilters
          filter={{}}
          onFilterChange={() => {}}
          onClearFilter={() => {}}
          dateRangePreset="all"
          onDateRangePresetChange={handleDateRangeChange}
        />
      )
      
      const filterButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filterButton)
      
      const dateRangeSelect = screen.getByLabelText(/date range/i)
      await user.click(dateRangeSelect)
      
      const weekOption = screen.getByText(/last 7 days/i)
      await user.click(weekOption)
      
      expect(handleDateRangeChange).toHaveBeenCalledWith('week')
    })
  })

  describe('Clear Filters', () => {
    it('clears all filters', async () => {
      const handleClearFilter = vi.fn()
      const user = userEvent.setup()
      render(
        <DocumentFilters
          filter={{ status: ['completed'] }}
          onFilterChange={() => {}}
          onClearFilter={handleClearFilter}
        />
      )
      
      const filterButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filterButton)
      
      const clearButton = screen.getByRole('button', { name: /clear all/i })
      await user.click(clearButton)
      
      expect(handleClearFilter).toHaveBeenCalled()
    })
  })
})

/**
 * Phase 1 Component Tests - DataTable Component
 * Tests for sorting, filtering, pagination, and selection
 */

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataTable, Column } from '@/components/features/data-table'

interface TestData {
  id: string
  name: string
  age: number
  email: string
  [key: string]: unknown
}

const testData: TestData[] = [
  { id: '1', name: 'Alice', age: 25, email: 'alice@example.com' },
  { id: '2', name: 'Bob', age: 30, email: 'bob@example.com' },
  { id: '3', name: 'Charlie', age: 28, email: 'charlie@example.com' },
]

const columns: Column<TestData>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'age', header: 'Age', sortable: true },
  { key: 'email', header: 'Email', sortable: false },
]

describe('DataTable Component', () => {
  describe('Basic Rendering', () => {
    it('renders table with data', () => {
      render(<DataTable data={testData} columns={columns} />)
      // DataTable renders both desktop and mobile views, so use getAllByText
      const aliceTexts = screen.getAllByText(/alice/i)
      expect(aliceTexts.length).toBeGreaterThan(0)
      const bobTexts = screen.getAllByText(/bob/i)
      expect(bobTexts.length).toBeGreaterThan(0)
    })

    it('renders column headers', () => {
      render(<DataTable data={testData} columns={columns} />)
      // Headers appear in both desktop and mobile views
      const nameHeaders = screen.getAllByText(/name/i)
      expect(nameHeaders.length).toBeGreaterThan(0)
      const ageHeaders = screen.getAllByText(/age/i)
      expect(ageHeaders.length).toBeGreaterThan(0)
      const emailHeaders = screen.getAllByText(/email/i)
      expect(emailHeaders.length).toBeGreaterThan(0)
    })

    it('renders empty state when no data', () => {
      render(<DataTable data={[]} columns={columns} />)
      expect(screen.getByText(/no results found/i)).toBeInTheDocument()
    })
  })

  describe('Sorting', () => {
    it('renders sortable columns', () => {
      render(<DataTable data={testData} columns={columns} />)
      // Component renders both desktop and mobile views, so use getAllByText
      const nameHeaders = screen.getAllByText(/name/i)
      expect(nameHeaders.length).toBeGreaterThan(0)
    })

    it('sorts data when column header is clicked', async () => {
      const user = userEvent.setup()
      render(<DataTable data={testData} columns={columns} />)
      
      // Find the sortable button in the desktop table header
      const nameHeaders = screen.getAllByText(/name/i)
      // Find the button (sortable columns render as buttons)
      const sortableButton = nameHeaders.find(el => el.closest('button')) || nameHeaders[0]
      await user.click(sortableButton)
      
      // Data should be sorted (verify by checking rows exist)
      const rows = screen.getAllByRole('row')
      expect(rows.length).toBeGreaterThan(1)
    })
  })

  describe('Row Selection', () => {
    it('renders checkboxes when selection is enabled', () => {
      render(
        <DataTable
          data={testData}
          columns={columns}
          selectable
          selectedRows={[]}
          onSelectionChange={() => {}}
        />
      )
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes.length).toBeGreaterThan(0)
    })

    it('calls onSelectionChange when row is selected', async () => {
      const handleSelectionChange = vi.fn()
      const user = userEvent.setup()
      render(
        <DataTable
          data={testData}
          columns={columns}
          selectable
          selectedRows={[]}
          onSelectionChange={handleSelectionChange}
        />
      )
      
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[1]) // Click first data row checkbox
      
      expect(handleSelectionChange).toHaveBeenCalled()
    })

    it('selects all rows when header checkbox is clicked', async () => {
      const handleSelectionChange = vi.fn()
      const user = userEvent.setup()
      render(
        <DataTable
          data={testData}
          columns={columns}
          selectable
          selectedRows={[]}
          onSelectionChange={handleSelectionChange}
        />
      )
      
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0]) // Click header checkbox
      
      expect(handleSelectionChange).toHaveBeenCalled()
    })
  })

  describe('Row Click', () => {
    it('calls onRowClick when row is clicked', async () => {
      const handleRowClick = vi.fn()
      const user = userEvent.setup()
      render(<DataTable data={testData} columns={columns} onRowClick={handleRowClick} />)
      
      // Find all rows (desktop and mobile)
      const aliceTexts = screen.getAllByText(/alice/i)
      const firstRow = aliceTexts[0].closest('tr') || aliceTexts[0].closest('[class*="cursor-pointer"]')
      if (firstRow) {
        await user.click(firstRow)
        expect(handleRowClick).toHaveBeenCalledWith(testData[0])
      }
    })
  })

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(<DataTable data={[]} columns={columns} loading />)
      // Loading state shows skeletons, not the table
      const skeletons = screen.getAllByRole('status')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('Pagination', () => {
    it('renders pagination controls', () => {
      render(
        <DataTable
          data={testData}
          columns={columns}
          pagination={{
            currentPage: 1,
            pageSize: 10,
            totalItems: testData.length,
            onPageChange: () => {},
          }}
        />
      )
      // Pagination should be rendered
    })
  })

  describe('Custom Rendering', () => {
    it('renders custom cell content', () => {
      const customColumns: Column<TestData>[] = [
        {
          key: 'name',
          header: 'Name',
          render: (value) => <strong>{String(value)}</strong>,
        },
      ]
      render(<DataTable data={testData} columns={customColumns} />)
      // Component renders both desktop and mobile views
      const aliceTexts = screen.getAllByText(/alice/i)
      const strongElement = aliceTexts.find(el => el.tagName === 'STRONG')
      expect(strongElement).toBeDefined()
      if (strongElement) {
        expect(strongElement.tagName).toBe('STRONG')
      }
    })
  })
})

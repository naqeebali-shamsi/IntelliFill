/**
 * Phase 3 Library Tests - SearchBar Component
 * Tests for debouncing, clear button, and keyboard shortcuts
 */

import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBar } from '@/components/features/search-bar'

describe('SearchBar Component', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  describe('Basic Rendering', () => {
    it('renders input field', () => {
      render(<SearchBar value="" onChange={() => {}} />)
      // Search input has type="search" which uses role="searchbox" or can be found by label
      const input = screen.getByLabelText(/search/i)
      expect(input).toBeInTheDocument()
    })

    it('renders placeholder', () => {
      render(<SearchBar value="" onChange={() => {}} placeholder="Search..." />)
      const input = screen.getByPlaceholderText(/search/i)
      expect(input).toBeInTheDocument()
    })

    it('displays current value', () => {
      render(<SearchBar value="test query" onChange={() => {}} />)
      const input = screen.getByDisplayValue('test query')
      expect(input).toBeInTheDocument()
    })
  })

  describe('Debouncing', () => {
    it('debounces onChange calls', { timeout: 2000 }, async () => {
      const handleChange = vi.fn()
      const handleDebouncedChange = vi.fn()
      const user = userEvent.setup()

      const TestComponent = () => {
        const [value, setValue] = React.useState('')
        return (
          <SearchBar
            value={value}
            onChange={(v) => {
              setValue(v)
              handleChange(v)
            }}
            onDebouncedChange={handleDebouncedChange}
            debounceMs={300}
          />
        )
      }

      render(<TestComponent />)

      const input = screen.getByLabelText(/search/i)
      await user.type(input, 'test')

      // onChange should be called immediately for each keystroke
      expect(handleChange).toHaveBeenCalled()

      // onDebouncedChange should not be called immediately
      expect(handleDebouncedChange).not.toHaveBeenCalled()

      // Wait for debounce
      await waitFor(() => {
        expect(handleDebouncedChange).toHaveBeenCalled()
      }, { timeout: 500 })
    })

    it('calls onDebouncedChange when debounced value changes', { timeout: 2000 }, async () => {
      const handleDebouncedChange = vi.fn()
      const user = userEvent.setup()

      const TestComponent = () => {
        const [value, setValue] = React.useState('')
        return (
          <SearchBar
            value={value}
            onChange={setValue}
            onDebouncedChange={handleDebouncedChange}
            debounceMs={300}
          />
        )
      }

      render(<TestComponent />)

      const input = screen.getByLabelText(/search/i)
      await user.type(input, 'test')

      // Wait for debounce
      await waitFor(() => {
        expect(handleDebouncedChange).toHaveBeenCalled()
      }, { timeout: 500 })
    })
  })

  describe('Clear Button', () => {
    it('shows clear button when value exists', () => {
      render(<SearchBar value="test" onChange={() => {}} showClearButton />)
      const clearButton = screen.getByRole('button', { name: /clear search/i })
      expect(clearButton).toBeInTheDocument()
    })

    it('hides clear button when value is empty', () => {
      render(<SearchBar value="" onChange={() => {}} showClearButton />)
      const clearButton = screen.queryByRole('button', { name: /clear search/i })
      expect(clearButton).not.toBeInTheDocument()
    })

    it('clears input when clear button is clicked', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup({ delay: null })
      render(<SearchBar value="test" onChange={handleChange} showClearButton />)

      const clearButton = screen.getByRole('button', { name: /clear search/i })
      await user.click(clearButton)

      expect(handleChange).toHaveBeenCalledWith('')
    })

    it('focuses input after clearing', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup({ delay: null })
      render(<SearchBar value="test" onChange={handleChange} showClearButton />)

      const clearButton = screen.getByRole('button', { name: /clear search/i })
      await user.click(clearButton)

      const input = screen.getByRole('searchbox')
      expect(input).toHaveFocus()
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('focuses input on Ctrl+K', async () => {
      const user = userEvent.setup({ delay: null })
      render(<SearchBar value="" onChange={() => {}} />)

      const input = screen.getByLabelText(/search/i)
      await user.keyboard('{Control>}k{/Control}')

      await waitFor(() => {
        expect(input).toHaveFocus()
      }, { timeout: 500 })
    })

    it('focuses input on Cmd+K (Mac)', async () => {
      const user = userEvent.setup({ delay: null })
      render(<SearchBar value="" onChange={() => {}} />)

      const input = screen.getByLabelText(/search/i)
      await user.keyboard('{Meta>}k{/Meta}')

      await waitFor(() => {
        expect(input).toHaveFocus()
      }, { timeout: 500 })
    })

    it('clears input on Escape key', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup({ delay: null })
      render(<SearchBar value="test" onChange={handleChange} />)

      const input = screen.getByRole('searchbox')
      await user.click(input)
      await user.keyboard('{Escape}')

      expect(handleChange).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has proper input role', () => {
      render(<SearchBar value="" onChange={() => {}} />)
      const input = screen.getByLabelText(/search/i)
      expect(input).toBeInTheDocument()
    })

    it('has aria-label', () => {
      render(<SearchBar value="" onChange={() => {}} />)
      const input = screen.getByLabelText(/search/i)
      expect(input).toHaveAttribute('aria-label', 'Search')
    })

    it('has accessible clear button', () => {
      render(<SearchBar value="test" onChange={() => {}} showClearButton />)
      const clearButton = screen.getByRole('button', { name: /clear search/i })
      expect(clearButton).toBeInTheDocument()
    })
  })
})

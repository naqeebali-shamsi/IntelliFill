/**
 * Phase 1 Component Tests - Input Component
 * Tests for Input with icons, clear button, validation states
 */

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

describe('Input Component', () => {
  describe('Basic Rendering', () => {
    it('renders input element', () => {
      render(<Input placeholder="Enter text" />)
      const input = screen.getByPlaceholderText(/enter text/i)
      expect(input).toBeInTheDocument()
      expect(input.tagName).toBe('INPUT')
    })

    it('accepts value prop', () => {
      render(<Input value="test value" onChange={() => {}} />)
      const input = screen.getByDisplayValue('test value')
      expect(input).toHaveValue('test value')
    })

    it('accepts placeholder', () => {
      render(<Input placeholder="Search..." />)
      const input = screen.getByPlaceholderText(/search/i)
      expect(input).toBeInTheDocument()
    })

    it('accepts disabled prop', () => {
      render(<Input disabled />)
      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
    })

    it('accepts type prop', () => {
      render(<Input type="email" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'email')
    })
  })

  describe('Clear Button', () => {
    it('shows clear button when showClearButton is true and value exists', () => {
      render(<Input value="test" showClearButton onChange={() => {}} />)
      const clearButton = screen.getByRole('button', { name: /clear input/i })
      expect(clearButton).toBeInTheDocument()
    })

    it('hides clear button when value is empty', () => {
      render(<Input value="" showClearButton onChange={() => {}} />)
      const clearButton = screen.queryByRole('button', { name: /clear input/i })
      expect(clearButton).not.toBeInTheDocument()
    })

    it('hides clear button when disabled', () => {
      render(<Input value="test" showClearButton disabled onChange={() => {}} />)
      const clearButton = screen.queryByRole('button', { name: /clear input/i })
      expect(clearButton).not.toBeInTheDocument()
    })

    it('clears input when clear button is clicked', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()
      render(<Input value="test" showClearButton onChange={handleChange} />)
      
      const clearButton = screen.getByRole('button', { name: /clear input/i })
      await user.click(clearButton)
      
      expect(handleChange).toHaveBeenCalled()
      const event = handleChange.mock.calls[0][0]
      expect(event.target.value).toBe('')
    })

    it('calls onClear callback when provided', async () => {
      const handleClear = vi.fn()
      const user = userEvent.setup()
      render(<Input value="test" showClearButton onClear={handleClear} onChange={() => {}} />)
      
      const clearButton = screen.getByRole('button', { name: /clear input/i })
      await user.click(clearButton)
      
      expect(handleClear).toHaveBeenCalledTimes(1)
    })
  })

  describe('Icons', () => {
    it('renders left icon', () => {
      render(<Input leftIcon={<Search data-testid="left-icon" />} />)
      const icon = screen.getByTestId('left-icon')
      expect(icon).toBeInTheDocument()
    })

    it('renders right icon', () => {
      render(<Input rightIcon={<Search data-testid="right-icon" />} />)
      const icon = screen.getByTestId('right-icon')
      expect(icon).toBeInTheDocument()
    })

    it('adjusts padding when left icon is present', () => {
      render(<Input leftIcon={<Search />} />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('pl-9')
    })

    it('adjusts padding when right icon or clear button is present', () => {
      render(<Input value="test" showClearButton onChange={() => {}} />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('pr-9')
    })
  })

  describe('Controlled vs Uncontrolled', () => {
    it('handles controlled input', () => {
      const handleChange = vi.fn()
      render(<Input value="controlled" onChange={handleChange} />)
      const input = screen.getByDisplayValue('controlled')
      
      expect(input).toHaveValue('controlled')
    })

    it('handles uncontrolled input', async () => {
      const user = userEvent.setup()
      render(<Input defaultValue="uncontrolled" />)
      const input = screen.getByDisplayValue('uncontrolled') as HTMLInputElement
      
      await user.clear(input)
      await user.type(input, 'new value')
      
      expect(input).toHaveValue('new value')
    })

    it('calls onChange when value changes', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()
      render(<Input onChange={handleChange} />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'test')
      
      expect(handleChange).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has proper input role', () => {
      render(<Input />)
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
    })

    it('supports aria-label', () => {
      render(<Input aria-label="Search input" />)
      const input = screen.getByLabelText(/search input/i)
      expect(input).toBeInTheDocument()
    })

    it('supports aria-describedby', () => {
      render(
        <div>
          <Input aria-describedby="help-text" />
          <span id="help-text">Help text</span>
        </div>
      )
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-describedby', 'help-text')
    })

    it('supports aria-invalid', () => {
      render(<Input aria-invalid="true" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })
  })
})

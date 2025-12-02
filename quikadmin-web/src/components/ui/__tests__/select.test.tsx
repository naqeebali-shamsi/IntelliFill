/**
 * Phase 1 Component Tests - Select Component
 * Tests for Select dropdown functionality
 */

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

describe('Select Component', () => {
  describe('Basic Rendering', () => {
    it('renders select trigger', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      )
      expect(screen.getByText(/select option/i)).toBeInTheDocument()
    })

    it('renders placeholder', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Choose..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      )
      expect(screen.getByText(/choose/i)).toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    it('opens dropdown when clicked', async () => {
      const user = userEvent.setup()
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>
      )
      
      const trigger = screen.getByRole('combobox')
      await user.click(trigger)
      
      // Options should be visible
      expect(screen.getByText(/option 1/i)).toBeInTheDocument()
      expect(screen.getByText(/option 2/i)).toBeInTheDocument()
    })

    it('selects option when clicked', async () => {
      const user = userEvent.setup()
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      )
      
      const trigger = screen.getByRole('combobox')
      await user.click(trigger)
      
      const option = screen.getByText(/option 1/i)
      await user.click(option)
      
      // Select should close
    })
  })

  describe('Accessibility', () => {
    it('has proper combobox role', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      )
      const trigger = screen.getByRole('combobox')
      expect(trigger).toBeInTheDocument()
    })

    it('supports aria-label', () => {
      render(
        <Select>
          <SelectTrigger aria-label="Select option">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      )
      const trigger = screen.getByLabelText(/select option/i)
      expect(trigger).toBeInTheDocument()
    })
  })
})

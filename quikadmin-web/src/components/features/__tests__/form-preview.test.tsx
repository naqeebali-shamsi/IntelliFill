/**
 * Phase 4 Component Tests - FormPreview Component
 * Tests for form preview display, field values, confidence scores, and warnings
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormPreview } from '@/components/features/form-preview'
import type { FormField, FieldMapping } from '@/types/formFilling'

describe('FormPreview Component', () => {
  const mockFormFields: FormField[] = [
    { name: 'firstName', type: 'text', required: true },
    { name: 'lastName', type: 'text', required: true },
    { name: 'email', type: 'email', required: false },
  ]

  const mockMappings: FieldMapping[] = [
    { formField: 'firstName', documentField: 'first_name', confidence: 95 },
    { formField: 'lastName', documentField: 'last_name', confidence: 90 },
    { formField: 'email', documentField: null, confidence: 0 },
  ]

  const mockDocumentData = {
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
  }

  const mockOnDownload = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window.open
    window.open = vi.fn()
  })

  describe('Basic Rendering', () => {
    it('renders form preview title', () => {
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
        />
      )
      expect(screen.getByText(/form preview/i)).toBeInTheDocument()
    })

    it('renders field mapping table', () => {
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
        />
      )
      expect(screen.getByText(/form field/i)).toBeInTheDocument()
      expect(screen.getByText(/mapped to/i)).toBeInTheDocument()
      const valueHeaders = screen.getAllByText(/value/i)
      expect(valueHeaders.length).toBeGreaterThan(0)
      const confidenceHeaders = screen.getAllByText(/confidence/i)
      expect(confidenceHeaders.length).toBeGreaterThan(0)
    })

    it('renders all form fields', () => {
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
        />
      )
      expect(screen.getByText('firstName')).toBeInTheDocument()
      expect(screen.getByText('lastName')).toBeInTheDocument()
      expect(screen.getByText('email')).toBeInTheDocument()
    })
  })

  describe('Field Values Display', () => {
    it('displays mapped field values', () => {
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
        />
      )
      expect(screen.getByText('John')).toBeInTheDocument()
      expect(screen.getByText('Doe')).toBeInTheDocument()
    })

    it('displays unmapped placeholder for unmapped fields', () => {
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
        />
      )
      // Email field is unmapped - should show "—"
      const emailRow = screen.getByText('email').closest('tr')
      expect(emailRow).toBeInTheDocument()
    })

    it('displays document field names', () => {
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
        />
      )
      expect(screen.getByText('first_name')).toBeInTheDocument()
      expect(screen.getByText('last_name')).toBeInTheDocument()
    })
  })

  describe('Confidence Scores', () => {
    it('displays confidence badges for mapped fields', () => {
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
        />
      )
      expect(screen.getByText('95%')).toBeInTheDocument()
      expect(screen.getByText('90%')).toBeInTheDocument()
    })

    it('shows overall confidence when provided', () => {
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
          confidence={0.92}
        />
      )
      expect(screen.getByText(/92%/i)).toBeInTheDocument()
    })
  })

  describe('Statistics Display', () => {
    it('displays completion percentage', () => {
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
          totalFields={3}
          filledFields={2}
        />
      )
      const percentageTexts = screen.getAllByText(/67%/i)
      expect(percentageTexts.length).toBeGreaterThan(0)
    })

    it('displays mapped fields count', () => {
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
          filledFields={2}
          totalFields={3}
        />
      )
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('of 3')).toBeInTheDocument()
    })

    it('shows complete badge when 100% filled', () => {
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
          totalFields={2}
          filledFields={2}
        />
      )
      expect(screen.getByText(/complete/i)).toBeInTheDocument()
    })
  })

  describe('Warnings Display', () => {
    it('displays warnings when provided', () => {
      const warnings = ['Field email is unmapped', 'Low confidence for lastName']
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
          warnings={warnings}
        />
      )
      expect(screen.getByText(/warnings/i)).toBeInTheDocument()
      expect(screen.getByText(/field email is unmapped/i)).toBeInTheDocument()
      expect(screen.getByText(/low confidence for lastname/i)).toBeInTheDocument()
    })

    it('does not display warnings section when no warnings', () => {
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
        />
      )
      expect(screen.queryByText(/warnings/i)).not.toBeInTheDocument()
    })
  })

  describe('Preview PDF Button', () => {
    it('renders preview button when downloadUrl is provided', () => {
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
          downloadUrl="https://example.com/form.pdf"
        />
      )
      expect(screen.getByRole('button', { name: /preview pdf/i })).toBeInTheDocument()
    })

    it('opens PDF in new tab when preview button is clicked', async () => {
      const user = userEvent.setup()
      const downloadUrl = 'https://example.com/form.pdf'
      
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
          downloadUrl={downloadUrl}
        />
      )
      
      const previewButton = screen.getByRole('button', { name: /preview pdf/i })
      await user.click(previewButton)
      
      expect(window.open).toHaveBeenCalledWith(downloadUrl, '_blank')
    })

    it('does not render preview button when downloadUrl is missing', () => {
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
        />
      )
      expect(screen.queryByRole('button', { name: /preview pdf/i })).not.toBeInTheDocument()
    })
  })

  describe('Download Button', () => {
    it('renders download button', () => {
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
        />
      )
      expect(screen.getByRole('button', { name: /download pdf/i })).toBeInTheDocument()
    })

    it('calls onDownload when download button is clicked', async () => {
      const user = userEvent.setup()
      
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
          downloadUrl="https://example.com/form.pdf"
        />
      )
      
      const downloadButton = screen.getByRole('button', { name: /download pdf/i })
      await user.click(downloadButton)
      
      expect(mockOnDownload).toHaveBeenCalledTimes(1)
    })

    it('disables download button when downloadUrl is missing', () => {
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
        />
      )
      const downloadButton = screen.getByRole('button', { name: /download pdf/i })
      expect(downloadButton).toBeDisabled()
    })
  })

  describe('Required Fields', () => {
    it('shows required badge for required fields', () => {
      render(
        <FormPreview
          formFields={mockFormFields}
          mappings={mockMappings}
          documentData={mockDocumentData}
          onDownload={mockOnDownload}
        />
      )
      const firstNameRow = screen.getByText('firstName').closest('tr')
      expect(firstNameRow).toBeInTheDocument()
      const requiredBadges = screen.getAllByText(/required/i)
      expect(requiredBadges.length).toBeGreaterThan(0)
    })
  })
})


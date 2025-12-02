/**
 * Phase 4 Page Tests - Templates Page
 * Tests for template browsing, creation, deletion, and navigation
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from 'react-query'
import { BrowserRouter } from 'react-router-dom'
import Templates from '@/pages/Templates'
import { getTemplates, createTemplate, deleteTemplate } from '@/services/formService'
import type { MappingTemplate } from '@/types/formFilling'

// Mock formService
vi.mock('@/services/formService', () => ({
  getTemplates: vi.fn(),
  getPublicTemplates: vi.fn().mockResolvedValue([]),
  createTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}))

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock react-router-dom navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('Templates Page', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
    mockNavigate.mockClear()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  )

  const mockTemplates: MappingTemplate[] = [
    {
      id: 'tpl-1',
      name: 'Invoice Template',
      description: 'Standard invoice template',
      mappings: { invoiceNumber: 'invoice_number', amount: 'total' },
      createdAt: '2024-01-15T00:00:00Z',
    },
    {
      id: 'tpl-2',
      name: 'Tax Form',
      description: 'Tax form template',
      mappings: { ssn: 'social_security_number' },
      createdAt: '2024-01-10T00:00:00Z',
    },
  ]

  describe('Basic Rendering', () => {
    it('renders page title', () => {
      vi.mocked(getTemplates).mockResolvedValue([])
      render(<Templates />, { wrapper })
      const templatesTexts = screen.getAllByText(/templates/i)
      expect(templatesTexts.length).toBeGreaterThan(0)
    })
  })

  describe('Template List', () => {
    it('displays templates when loaded', async () => {
      vi.mocked(getTemplates).mockResolvedValue(mockTemplates)
      render(<Templates />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Invoice Template')).toBeInTheDocument()
        expect(screen.getByText('Tax Form')).toBeInTheDocument()
      })
    })

    it('displays empty state when no templates', async () => {
      vi.mocked(getTemplates).mockResolvedValue([])
      render(<Templates />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText(/no templates yet/i)).toBeInTheDocument()
      })
    })
  })

  describe('Create Template', () => {
    it('opens create dialog when new template button is clicked', async () => {
      vi.mocked(getTemplates).mockResolvedValue([])
      const user = userEvent.setup()
      render(<Templates />, { wrapper })

      const newButton = screen.getByRole('button', { name: /new template/i })
      await user.click(newButton)

      expect(screen.getByText(/create new template/i)).toBeInTheDocument()
    })

    it('creates template with valid data', async () => {
      vi.mocked(getTemplates).mockResolvedValue([])
      vi.mocked(createTemplate).mockResolvedValue({
        id: 'tpl-new',
        name: 'New Template',
        mappings: {},
        createdAt: '2024-01-01T00:00:00Z',
      })

      const user = userEvent.setup()
      render(<Templates />, { wrapper })

      const newButton = screen.getByRole('button', { name: /new template/i })
      await user.click(newButton)

      const nameInput = screen.getByLabelText(/template name/i)
      await user.type(nameInput, 'New Template')

      const createButton = screen.getByRole('button', { name: /create template/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(createTemplate).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Template',
            mappings: {},
          })
        )
      })
    })
  })

  describe('Use Template', () => {
    it('navigates to fill-form page when use template is clicked', async () => {
      vi.mocked(getTemplates).mockResolvedValue(mockTemplates)
      const user = userEvent.setup()
      render(<Templates />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Invoice Template')).toBeInTheDocument()
      })

      const useButtons = screen.getAllByRole('button', { name: /use/i })
      await user.click(useButtons[0])

      expect(mockNavigate).toHaveBeenCalledWith('/fill-form', {
        state: { templateId: 'tpl-1' },
      })
    })
  })
})

/**
 * Phase 4 Service Tests - FormService
 * Tests for form validation, data extraction, form filling, and template management APIs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as formService from '@/services/formService'
import api from '@/services/api'
import type { MappingTemplate } from '@/types/formFilling'

// Mock the API module
vi.mock('@/services/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('FormService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateForm', () => {
    it('validates form and returns field definitions', async () => {
      const mockFile = new File(['content'], 'form.pdf', { type: 'application/pdf' })
      const mockResponse = {
        data: {
          data: {
            fields: ['firstName', 'lastName', 'email'],
            fieldTypes: {
              firstName: 'text',
              lastName: 'text',
              email: 'email',
            },
          },
        },
      }

      vi.mocked(api.post).mockResolvedValue(mockResponse as any)

      const result = await formService.validateForm(mockFile)

      expect(result.fields).toEqual(['firstName', 'lastName', 'email'])
      expect(result.fieldTypes).toEqual({
        firstName: 'text',
        lastName: 'text',
        email: 'email',
      })
      expect(api.post).toHaveBeenCalledWith(
        '/validate/form',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      )
    })

    it('handles validation errors', async () => {
      const mockFile = new File(['content'], 'form.pdf', { type: 'application/pdf' })
      vi.mocked(api.post).mockRejectedValue(new Error('Invalid form'))

      await expect(formService.validateForm(mockFile)).rejects.toThrow('Invalid form')
    })
  })

  describe('extractData', () => {
    it('extracts data from document', async () => {
      const mockFile = new File(['content'], 'doc.pdf', { type: 'application/pdf' })
      const mockResponse = {
        data: {
          data: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
          },
        },
      }

      vi.mocked(api.post).mockResolvedValue(mockResponse as any)

      const result = await formService.extractData(mockFile)

      expect(result).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      })
      expect(api.post).toHaveBeenCalledWith(
        '/extract',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      )
    })
  })

  describe('fillFormWithUserData', () => {
    it('fills form with user data and mappings', async () => {
      const mockFormFile = new File(['content'], 'form.pdf', { type: 'application/pdf' })
      const mockRequest = {
        formFile: mockFormFile,
        mappings: { firstName: 'first_name', lastName: 'last_name' },
        userData: { first_name: 'John', last_name: 'Doe' },
      }
      const mockResponse = {
        data: {
          documentId: 'doc-123',
          downloadUrl: 'https://example.com/form.pdf',
          confidence: 0.95,
          filledFields: 2,
          totalFields: 3,
        },
      }

      vi.mocked(api.post).mockResolvedValue(mockResponse as any)

      const result = await formService.fillFormWithUserData(mockRequest)

      expect(result).toEqual(mockResponse.data)
      expect(api.post).toHaveBeenCalledWith(
        '/users/me/fill-form',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      )
    })

    it('handles fill errors', async () => {
      const mockFormFile = new File(['content'], 'form.pdf', { type: 'application/pdf' })
      vi.mocked(api.post).mockRejectedValue(new Error('Fill failed'))

      await expect(
        formService.fillFormWithUserData({ formFile: mockFormFile })
      ).rejects.toThrow('Fill failed')
    })
  })

  describe('fillFormWithDocument', () => {
    it('fills form using specific document', async () => {
      const mockFormFile = new File(['content'], 'form.pdf', { type: 'application/pdf' })
      const mockMappings = { firstName: 'first_name' }
      const mockResponse = {
        data: {
          documentId: 'doc-123',
          downloadUrl: 'https://example.com/form.pdf',
          confidence: 0.9,
          filledFields: 1,
          totalFields: 2,
        },
      }

      vi.mocked(api.post).mockResolvedValue(mockResponse as any)

      const result = await formService.fillFormWithDocument('doc-123', mockFormFile, mockMappings)

      expect(result).toEqual(mockResponse.data)
      expect(api.post).toHaveBeenCalledWith(
        '/documents/doc-123/fill',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      )
    })
  })

  describe('Template Management', () => {
    const mockTemplate: MappingTemplate = {
      id: 'tpl-123',
      name: 'Test Template',
      description: 'Test description',
      mappings: { firstName: 'first_name', lastName: 'last_name' },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    }

    describe('getTemplates', () => {
      it('fetches all templates', async () => {
        const mockResponse = {
          data: [
            {
              id: 'tpl-123',
              name: 'Test Template',
              description: 'Test description',
              mappings: { firstName: 'first_name' },
              createdAt: '2024-01-01T00:00:00Z',
            },
          ],
        }

        vi.mocked(api.get).mockResolvedValue(mockResponse as any)

        const result = await formService.getTemplates()

        expect(result).toHaveLength(1)
        expect(result[0].name).toBe('Test Template')
        expect(api.get).toHaveBeenCalledWith('/templates')
      })

      it('handles alternate API response formats', async () => {
        const mockResponse = {
          data: [
            {
              templateId: 'tpl-123',
              name: 'Test Template',
              mappings: {},
              created_at: '2024-01-01T00:00:00Z',
            },
          ],
        }

        vi.mocked(api.get).mockResolvedValue(mockResponse as any)

        const result = await formService.getTemplates()

        expect(result[0].id).toBe('tpl-123')
        expect(result[0].createdAt).toBe('2024-01-01T00:00:00Z')
      })
    })

    describe('getTemplate', () => {
      it('fetches a specific template', async () => {
        const mockResponse = {
          data: {
            id: 'tpl-123',
            name: 'Test Template',
            description: 'Test description',
            mappings: { firstName: 'first_name' },
            createdAt: '2024-01-01T00:00:00Z',
          },
        }

        vi.mocked(api.get).mockResolvedValue(mockResponse as any)

        const result = await formService.getTemplate('tpl-123')

        expect(result.id).toBe('tpl-123')
        expect(result.name).toBe('Test Template')
        expect(api.get).toHaveBeenCalledWith('/templates/tpl-123')
      })
    })

    describe('createTemplate', () => {
      it('creates a new template', async () => {
        const newTemplate = {
          name: 'New Template',
          description: 'New description',
          mappings: { firstName: 'first_name' },
        }
        const mockResponse = {
          data: {
            data: {
              id: 'tpl-456',
              ...newTemplate,
              createdAt: '2024-01-01T00:00:00Z',
            },
          },
        }

        vi.mocked(api.post).mockResolvedValue(mockResponse as any)

        const result = await formService.createTemplate(newTemplate)

        expect(result.id).toBe('tpl-456')
        expect(result.name).toBe('New Template')
        expect(api.post).toHaveBeenCalledWith('/templates', {
          name: newTemplate.name,
          description: newTemplate.description,
          mappings: newTemplate.mappings,
        })
      })

      it('handles creation errors', async () => {
        const newTemplate = {
          name: 'New Template',
          mappings: {},
        }
        vi.mocked(api.post).mockRejectedValue(new Error('Creation failed'))

        await expect(formService.createTemplate(newTemplate)).rejects.toThrow('Creation failed')
      })
    })

    describe('updateTemplate', () => {
      it('updates an existing template', async () => {
        const updates = {
          name: 'Updated Template',
          mappings: { firstName: 'first_name', lastName: 'last_name' },
        }

        vi.mocked(api.put).mockResolvedValue({} as any)

        await formService.updateTemplate('tpl-123', updates)

        expect(api.put).toHaveBeenCalledWith('/templates/tpl-123', {
          name: updates.name,
          description: undefined,
          mappings: updates.mappings,
        })
      })
    })

    describe('deleteTemplate', () => {
      it('deletes a template', async () => {
        vi.mocked(api.delete).mockResolvedValue({} as any)

        await formService.deleteTemplate('tpl-123')

        expect(api.delete).toHaveBeenCalledWith('/templates/tpl-123')
      })

      it('handles deletion errors', async () => {
        vi.mocked(api.delete).mockRejectedValue(new Error('Deletion failed'))

        await expect(formService.deleteTemplate('tpl-123')).rejects.toThrow('Deletion failed')
      })
    })
  })
})


/**
 * Phase 4 Store Tests - TemplateStore
 * Tests for template state management, CRUD operations, and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTemplateStore } from '@/stores/templateStore'
import * as formService from '@/services/formService'
import type { MappingTemplate } from '@/types/formFilling'

// Mock formService
vi.mock('@/services/formService', () => ({
  getTemplates: vi.fn(),
  getTemplate: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}))

describe('TemplateStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useTemplateStore.getState().clearTemplates()
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('has correct initial state', () => {
      const state = useTemplateStore.getState()
      expect(state.templates).toEqual([])
      expect(state.currentTemplate).toBeNull()
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('loadTemplates', () => {
    it('loads templates successfully', async () => {
      const mockTemplates: MappingTemplate[] = [
        {
          id: 'tpl-1',
          name: 'Template 1',
          mappings: {},
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'tpl-2',
          name: 'Template 2',
          mappings: {},
          createdAt: '2024-01-02T00:00:00Z',
        },
      ]

      vi.mocked(formService.getTemplates).mockResolvedValue(mockTemplates)

      await useTemplateStore.getState().loadTemplates()

      const state = useTemplateStore.getState()
      expect(state.templates).toEqual(mockTemplates)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('handles loading errors', async () => {
      vi.mocked(formService.getTemplates).mockRejectedValue(new Error('Failed to load'))

      await useTemplateStore.getState().loadTemplates()

      const state = useTemplateStore.getState()
      expect(state.templates).toEqual([])
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe('Failed to load')
    })

    it('sets loading state during fetch', async () => {
      let resolvePromise: (value: MappingTemplate[]) => void
      const promise = new Promise<MappingTemplate[]>((resolve) => {
        resolvePromise = resolve
      })

      vi.mocked(formService.getTemplates).mockReturnValue(promise as any)

      const loadPromise = useTemplateStore.getState().loadTemplates()

      // Check loading state
      expect(useTemplateStore.getState().isLoading).toBe(true)

      resolvePromise!([])
      await loadPromise

      expect(useTemplateStore.getState().isLoading).toBe(false)
    })
  })

  describe('loadTemplate', () => {
    it('loads a specific template', async () => {
      const mockTemplate: MappingTemplate = {
        id: 'tpl-123',
        name: 'Test Template',
        mappings: {},
        createdAt: '2024-01-01T00:00:00Z',
      }

      vi.mocked(formService.getTemplate).mockResolvedValue(mockTemplate)

      await useTemplateStore.getState().loadTemplate('tpl-123')

      const state = useTemplateStore.getState()
      expect(state.currentTemplate).toEqual(mockTemplate)
      expect(state.isLoading).toBe(false)
    })

    it('updates template in list if it exists', async () => {
      const existingTemplate: MappingTemplate = {
        id: 'tpl-123',
        name: 'Old Name',
        mappings: {},
        createdAt: '2024-01-01T00:00:00Z',
      }

      useTemplateStore.setState({ templates: [existingTemplate] })

      const updatedTemplate: MappingTemplate = {
        ...existingTemplate,
        name: 'New Name',
      }

      vi.mocked(formService.getTemplate).mockResolvedValue(updatedTemplate)

      await useTemplateStore.getState().loadTemplate('tpl-123')

      const state = useTemplateStore.getState()
      expect(state.templates[0].name).toBe('New Name')
      expect(state.currentTemplate?.name).toBe('New Name')
    })
  })

  describe('createTemplate', () => {
    it('creates a new template', async () => {
      const newTemplate = {
        name: 'New Template',
        description: 'Description',
        mappings: { firstName: 'first_name' },
      }

      const createdTemplate: MappingTemplate = {
        id: 'tpl-456',
        ...newTemplate,
        createdAt: '2024-01-01T00:00:00Z',
      }

      vi.mocked(formService.createTemplate).mockResolvedValue(createdTemplate)

      const result = await useTemplateStore.getState().createTemplate(newTemplate)

      const state = useTemplateStore.getState()
      expect(state.templates).toContainEqual(createdTemplate)
      expect(state.currentTemplate).toEqual(createdTemplate)
      expect(result).toEqual(createdTemplate)
    })

    it('handles creation errors', async () => {
      const newTemplate = {
        name: 'New Template',
        mappings: {},
      }

      vi.mocked(formService.createTemplate).mockRejectedValue(new Error('Creation failed'))

      await expect(
        useTemplateStore.getState().createTemplate(newTemplate)
      ).rejects.toThrow('Creation failed')

      const state = useTemplateStore.getState()
      expect(state.templates).toEqual([])
      expect(state.error).toBe('Creation failed')
    })
  })

  describe('updateTemplate', () => {
    it('updates an existing template', async () => {
      const existingTemplate: MappingTemplate = {
        id: 'tpl-123',
        name: 'Old Name',
        mappings: {},
        createdAt: '2024-01-01T00:00:00Z',
      }

      useTemplateStore.setState({ templates: [existingTemplate] })

      const updates = {
        name: 'New Name',
        mappings: { firstName: 'first_name' },
      }

      vi.mocked(formService.updateTemplate).mockResolvedValue(undefined)

      await useTemplateStore.getState().updateTemplate('tpl-123', updates)

      const state = useTemplateStore.getState()
      expect(state.templates[0].name).toBe('New Name')
      expect(state.templates[0].mappings).toEqual(updates.mappings)
      expect(state.templates[0].updatedAt).toBeDefined()
    })

    it('updates current template if it matches', async () => {
      const template: MappingTemplate = {
        id: 'tpl-123',
        name: 'Template',
        mappings: {},
        createdAt: '2024-01-01T00:00:00Z',
      }

      useTemplateStore.setState({
        templates: [template],
        currentTemplate: template,
      })

      vi.mocked(formService.updateTemplate).mockResolvedValue(undefined)

      await useTemplateStore.getState().updateTemplate('tpl-123', { name: 'Updated' })

      const state = useTemplateStore.getState()
      expect(state.currentTemplate?.name).toBe('Updated')
    })
  })

  describe('deleteTemplate', () => {
    it('deletes a template', async () => {
      const template: MappingTemplate = {
        id: 'tpl-123',
        name: 'Template',
        mappings: {},
        createdAt: '2024-01-01T00:00:00Z',
      }

      useTemplateStore.setState({ templates: [template] })

      vi.mocked(formService.deleteTemplate).mockResolvedValue(undefined)

      await useTemplateStore.getState().deleteTemplate('tpl-123')

      const state = useTemplateStore.getState()
      expect(state.templates).toEqual([])
    })

    it('clears current template if it matches deleted template', async () => {
      const template: MappingTemplate = {
        id: 'tpl-123',
        name: 'Template',
        mappings: {},
        createdAt: '2024-01-01T00:00:00Z',
      }

      useTemplateStore.setState({
        templates: [template],
        currentTemplate: template,
      })

      vi.mocked(formService.deleteTemplate).mockResolvedValue(undefined)

      await useTemplateStore.getState().deleteTemplate('tpl-123')

      const state = useTemplateStore.getState()
      expect(state.currentTemplate).toBeNull()
    })
  })

  describe('setCurrentTemplate', () => {
    it('sets the current template', () => {
      const template: MappingTemplate = {
        id: 'tpl-123',
        name: 'Template',
        mappings: {},
        createdAt: '2024-01-01T00:00:00Z',
      }

      useTemplateStore.getState().setCurrentTemplate(template)

      expect(useTemplateStore.getState().currentTemplate).toEqual(template)
    })

    it('clears current template when set to null', () => {
      const template: MappingTemplate = {
        id: 'tpl-123',
        name: 'Template',
        mappings: {},
        createdAt: '2024-01-01T00:00:00Z',
      }

      useTemplateStore.setState({ currentTemplate: template })
      useTemplateStore.getState().setCurrentTemplate(null)

      expect(useTemplateStore.getState().currentTemplate).toBeNull()
    })
  })

  describe('clearError', () => {
    it('clears error state', () => {
      useTemplateStore.setState({ error: 'Test error' })
      useTemplateStore.getState().clearError()

      expect(useTemplateStore.getState().error).toBeNull()
    })
  })

  describe('clearTemplates', () => {
    it('clears all templates and state', () => {
      const template: MappingTemplate = {
        id: 'tpl-123',
        name: 'Template',
        mappings: {},
        createdAt: '2024-01-01T00:00:00Z',
      }

      useTemplateStore.setState({
        templates: [template],
        currentTemplate: template,
        error: 'Some error',
      })

      useTemplateStore.getState().clearTemplates()

      const state = useTemplateStore.getState()
      expect(state.templates).toEqual([])
      expect(state.currentTemplate).toBeNull()
      expect(state.error).toBeNull()
    })
  })
})


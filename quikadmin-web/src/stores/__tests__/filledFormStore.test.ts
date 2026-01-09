/**
 * Filled Form Store Tests
 *
 * Task 490: Integration tests for filled forms Zustand store
 * Tests for state management, CRUD operations, and caching
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFilledFormStore } from '@/stores/filledFormStore';
import { filledFormService } from '@/services/filledFormService';

// Mock the filled form service
vi.mock('@/services/filledFormService', () => ({
  filledFormService: {
    list: vi.fn(),
    generate: vi.fn(),
    get: vi.fn(),
    triggerDownload: vi.fn(),
    delete: vi.fn(),
    regenerate: vi.fn(),
  },
}));

describe('FilledFormStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state before each test
    useFilledFormStore.setState({
      filledForms: [],
      currentFilledForm: null,
      pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
      isLoading: false,
      isGenerating: false,
      error: null,
      lastGeneratedForm: null,
    });
  });

  describe('Initial State', () => {
    it('has correct initial state', () => {
      const state = useFilledFormStore.getState();

      expect(state.filledForms).toEqual([]);
      expect(state.currentFilledForm).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.isGenerating).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastGeneratedForm).toBeNull();
    });
  });

  describe('loadFilledForms', () => {
    it('loads filled forms successfully', async () => {
      const mockForms = [
        {
          id: 'filled-1',
          clientId: 'client-1',
          clientName: 'Client 1',
          templateId: 'tpl-1',
          templateName: 'Template 1',
          fileUrl: '/path/to/file.pdf',
          downloadUrl: '/api/filled-forms/filled-1/download',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(filledFormService.list).mockResolvedValue({
        success: true,
        data: {
          filledForms: mockForms,
          pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
        },
      });

      await useFilledFormStore.getState().loadFilledForms();

      const state = useFilledFormStore.getState();
      expect(state.filledForms).toEqual(mockForms);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('handles load errors', async () => {
      vi.mocked(filledFormService.list).mockRejectedValue(new Error('Network error'));

      await useFilledFormStore.getState().loadFilledForms();

      const state = useFilledFormStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
    });

    it('sets loading state during fetch', async () => {
      vi.mocked(filledFormService.list).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const promise = useFilledFormStore.getState().loadFilledForms();

      // Check loading state immediately
      expect(useFilledFormStore.getState().isLoading).toBe(true);

      await promise;
    });
  });

  describe('generateFilledForm', () => {
    it('generates and adds form to list', async () => {
      const mockGeneratedForm = {
        id: 'filled-new',
        clientId: 'client-1',
        clientName: 'Client 1',
        templateId: 'tpl-1',
        templateName: 'Template 1',
        fileUrl: '/path/to/new.pdf',
        downloadUrl: '/api/filled-forms/filled-new/download',
        createdAt: '2024-01-01T00:00:00Z',
        filledFieldsCount: 45,
        unmappedFieldsCount: 5,
        warnings: [],
      };

      vi.mocked(filledFormService.generate).mockResolvedValue({
        success: true,
        message: 'Form generated',
        data: { filledForm: mockGeneratedForm },
      });

      const result = await useFilledFormStore.getState().generateFilledForm({
        templateId: 'tpl-1',
        clientId: 'client-1',
      });

      const state = useFilledFormStore.getState();
      expect(result.id).toBe('filled-new');
      expect(state.filledForms[0].id).toBe('filled-new');
      expect(state.lastGeneratedForm).toEqual(mockGeneratedForm);
      expect(state.isGenerating).toBe(false);
    });

    it('handles generation errors', async () => {
      vi.mocked(filledFormService.generate).mockRejectedValue({
        response: { data: { error: 'No field mappings' } },
      });

      await expect(
        useFilledFormStore.getState().generateFilledForm({
          templateId: 'tpl-1',
          clientId: 'client-1',
        })
      ).rejects.toBeDefined();

      const state = useFilledFormStore.getState();
      expect(state.error).toBe('No field mappings');
      expect(state.isGenerating).toBe(false);
    });
  });

  describe('deleteFilledForm', () => {
    it('removes form from list', async () => {
      // Setup initial state with forms
      useFilledFormStore.setState({
        filledForms: [
          {
            id: 'filled-1',
            clientId: 'client-1',
            clientName: 'Client 1',
            templateId: 'tpl-1',
            templateName: 'Template 1',
            fileUrl: '/path/to/file.pdf',
            downloadUrl: '/api/filled-forms/filled-1/download',
            createdAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'filled-2',
            clientId: 'client-2',
            clientName: 'Client 2',
            templateId: 'tpl-2',
            templateName: 'Template 2',
            fileUrl: '/path/to/file2.pdf',
            downloadUrl: '/api/filled-forms/filled-2/download',
            createdAt: '2024-01-02T00:00:00Z',
          },
        ],
        pagination: { total: 2, limit: 20, offset: 0, hasMore: false },
      });

      vi.mocked(filledFormService.delete).mockResolvedValue({
        success: true,
        message: 'Deleted',
      });

      await useFilledFormStore.getState().deleteFilledForm('filled-1');

      const state = useFilledFormStore.getState();
      expect(state.filledForms).toHaveLength(1);
      expect(state.filledForms[0].id).toBe('filled-2');
      expect(state.pagination.total).toBe(1);
    });

    it('clears currentFilledForm if deleted', async () => {
      const form = {
        id: 'filled-1',
        clientId: 'client-1',
        clientName: 'Client 1',
        templateId: 'tpl-1',
        templateName: 'Template 1',
        fileUrl: '/path/to/file.pdf',
        downloadUrl: '/api/filled-forms/filled-1/download',
        createdAt: '2024-01-01T00:00:00Z',
      };

      useFilledFormStore.setState({
        filledForms: [form],
        currentFilledForm: form,
        pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
      });

      vi.mocked(filledFormService.delete).mockResolvedValue({
        success: true,
        message: 'Deleted',
      });

      await useFilledFormStore.getState().deleteFilledForm('filled-1');

      const state = useFilledFormStore.getState();
      expect(state.currentFilledForm).toBeNull();
    });
  });

  describe('setCurrentFilledForm', () => {
    it('sets the current filled form', () => {
      const form = {
        id: 'filled-1',
        clientId: 'client-1',
        clientName: 'Client 1',
        templateId: 'tpl-1',
        templateName: 'Template 1',
        fileUrl: '/path/to/file.pdf',
        downloadUrl: '/api/filled-forms/filled-1/download',
        createdAt: '2024-01-01T00:00:00Z',
      };

      useFilledFormStore.getState().setCurrentFilledForm(form);

      expect(useFilledFormStore.getState().currentFilledForm).toEqual(form);
    });

    it('clears the current filled form when passed null', () => {
      useFilledFormStore.setState({
        currentFilledForm: {
          id: 'filled-1',
          clientId: 'client-1',
          clientName: 'Client 1',
          templateId: 'tpl-1',
          templateName: 'Template 1',
          fileUrl: '/path/to/file.pdf',
          downloadUrl: '/api/filled-forms/filled-1/download',
          createdAt: '2024-01-01T00:00:00Z',
        },
      });

      useFilledFormStore.getState().setCurrentFilledForm(null);

      expect(useFilledFormStore.getState().currentFilledForm).toBeNull();
    });
  });

  describe('clearLastGeneratedForm', () => {
    it('clears the last generated form', () => {
      useFilledFormStore.setState({
        lastGeneratedForm: {
          id: 'filled-1',
          clientId: 'client-1',
          clientName: 'Client 1',
          templateId: 'tpl-1',
          templateName: 'Template 1',
          fileUrl: '/path/to/file.pdf',
          downloadUrl: '/api/filled-forms/filled-1/download',
          createdAt: '2024-01-01T00:00:00Z',
          filledFieldsCount: 45,
          unmappedFieldsCount: 5,
          warnings: [],
        },
      });

      useFilledFormStore.getState().clearLastGeneratedForm();

      expect(useFilledFormStore.getState().lastGeneratedForm).toBeNull();
    });
  });

  describe('clearError', () => {
    it('clears the error state', () => {
      useFilledFormStore.setState({ error: 'Some error' });

      useFilledFormStore.getState().clearError();

      expect(useFilledFormStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets store to initial state', () => {
      // Set some state
      useFilledFormStore.setState({
        filledForms: [
          {
            id: 'filled-1',
            clientId: 'client-1',
            clientName: 'Client 1',
            templateId: 'tpl-1',
            templateName: 'Template 1',
            fileUrl: '/path/to/file.pdf',
            downloadUrl: '/api/filled-forms/filled-1/download',
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
        currentFilledForm: {
          id: 'filled-1',
          clientId: 'client-1',
          clientName: 'Client 1',
          templateId: 'tpl-1',
          templateName: 'Template 1',
          fileUrl: '/path/to/file.pdf',
          downloadUrl: '/api/filled-forms/filled-1/download',
          createdAt: '2024-01-01T00:00:00Z',
        },
        error: 'Some error',
        isLoading: true,
      });

      useFilledFormStore.getState().reset();

      const state = useFilledFormStore.getState();
      expect(state.filledForms).toEqual([]);
      expect(state.currentFilledForm).toBeNull();
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('loadMoreFilledForms', () => {
    it('loads more forms when hasMore is true', async () => {
      const existingForms = [
        {
          id: 'filled-1',
          clientId: 'client-1',
          clientName: 'Client 1',
          templateId: 'tpl-1',
          templateName: 'Template 1',
          fileUrl: '/path/to/file1.pdf',
          downloadUrl: '/api/filled-forms/filled-1/download',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];

      const newForms = [
        {
          id: 'filled-2',
          clientId: 'client-2',
          clientName: 'Client 2',
          templateId: 'tpl-2',
          templateName: 'Template 2',
          fileUrl: '/path/to/file2.pdf',
          downloadUrl: '/api/filled-forms/filled-2/download',
          createdAt: '2024-01-02T00:00:00Z',
        },
      ];

      useFilledFormStore.setState({
        filledForms: existingForms,
        pagination: { total: 2, limit: 1, offset: 0, hasMore: true },
      });

      vi.mocked(filledFormService.list).mockResolvedValue({
        success: true,
        data: {
          filledForms: newForms,
          pagination: { total: 2, limit: 1, offset: 1, hasMore: false },
        },
      });

      await useFilledFormStore.getState().loadMoreFilledForms();

      const state = useFilledFormStore.getState();
      expect(state.filledForms).toHaveLength(2);
      expect(state.filledForms[1].id).toBe('filled-2');
    });

    it('does not load when hasMore is false', async () => {
      useFilledFormStore.setState({
        filledForms: [],
        pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
      });

      await useFilledFormStore.getState().loadMoreFilledForms();

      expect(filledFormService.list).not.toHaveBeenCalled();
    });

    it('does not load when already loading', async () => {
      useFilledFormStore.setState({
        filledForms: [],
        pagination: { total: 2, limit: 1, offset: 0, hasMore: true },
        isLoading: true,
      });

      await useFilledFormStore.getState().loadMoreFilledForms();

      expect(filledFormService.list).not.toHaveBeenCalled();
    });
  });
});

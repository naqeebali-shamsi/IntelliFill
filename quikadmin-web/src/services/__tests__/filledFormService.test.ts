/**
 * Filled Form Service Tests
 *
 * Task 490: Integration tests for filled forms workflow
 * Tests for form generation, listing, downloading, and ad-hoc saving APIs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/services/api';
import {
  generateFilledForm,
  previewFilledForm,
  listFilledForms,
  getFilledForm,
  downloadFilledForm,
  deleteFilledForm,
  regenerateFilledForm,
  saveAdhocFilledForm,
  filledFormService,
} from '@/services/filledFormService';

// Mock the API module
vi.mock('@/services/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('FilledFormService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateFilledForm', () => {
    it('generates a filled form from template and client', async () => {
      const mockRequest = {
        templateId: 'tpl-123',
        clientId: 'client-456',
        overrideData: { firstName: 'Override Name' },
      };

      const mockResponse = {
        data: {
          success: true,
          message: 'Form generated successfully',
          data: {
            filledForm: {
              id: 'filled-789',
              clientId: 'client-456',
              clientName: 'John Doe',
              templateId: 'tpl-123',
              templateName: 'DS-160 Visa',
              fileUrl: '/outputs/filled.pdf',
              downloadUrl: '/api/filled-forms/filled-789/download',
              filledFieldsCount: 45,
              unmappedFieldsCount: 5,
              warnings: [],
              createdAt: '2024-01-01T00:00:00Z',
            },
          },
        },
      };

      vi.mocked(api.post).mockResolvedValue(mockResponse as any);

      const result = await generateFilledForm(mockRequest);

      expect(result.success).toBe(true);
      expect(result.data.filledForm.id).toBe('filled-789');
      expect(api.post).toHaveBeenCalledWith('/filled-forms/generate', mockRequest);
    });

    it('handles validation errors', async () => {
      const mockRequest = {
        templateId: 'invalid',
        clientId: 'client-456',
      };

      vi.mocked(api.post).mockRejectedValue({
        response: {
          data: {
            error: 'Validation failed',
            details: { templateId: ['Invalid template ID'] },
          },
        },
      });

      await expect(generateFilledForm(mockRequest)).rejects.toMatchObject({
        response: {
          data: {
            error: 'Validation failed',
          },
        },
      });
    });
  });

  describe('previewFilledForm', () => {
    it('returns preview of form filling without saving', async () => {
      const mockRequest = {
        templateId: 'tpl-123',
        clientId: 'client-456',
      };

      const mockResponse = {
        data: {
          success: true,
          data: {
            template: { id: 'tpl-123', name: 'DS-160', totalFields: 50 },
            client: { id: 'client-456', name: 'John Doe' },
            preview: [
              { formField: 'firstName', profileField: 'first_name', value: 'John', status: 'filled' },
              { formField: 'middleName', profileField: null, value: null, status: 'unmapped' },
            ],
            summary: {
              filledCount: 45,
              unmappedCount: 3,
              missingDataCount: 2,
              completionPercentage: 90,
            },
          },
        },
      };

      vi.mocked(api.post).mockResolvedValue(mockResponse as any);

      const result = await previewFilledForm(mockRequest);

      expect(result.success).toBe(true);
      expect(result.data.summary.completionPercentage).toBe(90);
      expect(api.post).toHaveBeenCalledWith('/filled-forms/preview', mockRequest);
    });
  });

  describe('listFilledForms', () => {
    it('lists all filled forms', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
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
            pagination: {
              total: 10,
              limit: 20,
              offset: 0,
              hasMore: false,
            },
          },
        },
      };

      vi.mocked(api.get).mockResolvedValue(mockResponse as any);

      const result = await listFilledForms();

      expect(result.data.filledForms).toHaveLength(1);
      expect(result.data.pagination.total).toBe(10);
      expect(api.get).toHaveBeenCalledWith('/filled-forms', { params: undefined });
    });

    it('filters by clientId', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            filledForms: [],
            pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
          },
        },
      };

      vi.mocked(api.get).mockResolvedValue(mockResponse as any);

      await listFilledForms({ clientId: 'client-123' });

      expect(api.get).toHaveBeenCalledWith('/filled-forms', {
        params: { clientId: 'client-123' },
      });
    });

    it('filters by templateId', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            filledForms: [],
            pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
          },
        },
      };

      vi.mocked(api.get).mockResolvedValue(mockResponse as any);

      await listFilledForms({ templateId: 'tpl-456' });

      expect(api.get).toHaveBeenCalledWith('/filled-forms', {
        params: { templateId: 'tpl-456' },
      });
    });

    it('supports pagination', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            filledForms: [],
            pagination: { total: 50, limit: 10, offset: 20, hasMore: true },
          },
        },
      };

      vi.mocked(api.get).mockResolvedValue(mockResponse as any);

      await listFilledForms({ limit: 10, offset: 20 });

      expect(api.get).toHaveBeenCalledWith('/filled-forms', {
        params: { limit: 10, offset: 20 },
      });
    });
  });

  describe('getFilledForm', () => {
    it('fetches a single filled form by ID', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            filledForm: {
              id: 'filled-123',
              clientId: 'client-456',
              clientName: 'John Doe',
              clientType: 'INDIVIDUAL',
              templateId: 'tpl-789',
              templateName: 'DS-160',
              templateCategory: 'VISA',
              fileUrl: '/path/to/file.pdf',
              downloadUrl: '/api/filled-forms/filled-123/download',
              dataSnapshot: { firstName: 'John', lastName: 'Doe' },
              createdAt: '2024-01-01T00:00:00Z',
            },
          },
        },
      };

      vi.mocked(api.get).mockResolvedValue(mockResponse as any);

      const result = await getFilledForm('filled-123');

      expect(result.data.filledForm.id).toBe('filled-123');
      expect(api.get).toHaveBeenCalledWith('/filled-forms/filled-123');
    });

    it('handles not found error', async () => {
      vi.mocked(api.get).mockRejectedValue({
        response: { status: 404, data: { error: 'Filled form not found' } },
      });

      await expect(getFilledForm('invalid-id')).rejects.toMatchObject({
        response: { status: 404 },
      });
    });
  });

  describe('downloadFilledForm', () => {
    it('downloads a filled form as blob', async () => {
      const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' });
      vi.mocked(api.get).mockResolvedValue({ data: mockBlob } as any);

      const result = await downloadFilledForm('filled-123');

      expect(result).toBeInstanceOf(Blob);
      expect(api.get).toHaveBeenCalledWith('/filled-forms/filled-123/download', {
        responseType: 'blob',
      });
    });
  });

  describe('deleteFilledForm', () => {
    it('deletes a filled form', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Filled form deleted successfully',
        },
      };

      vi.mocked(api.delete).mockResolvedValue(mockResponse as any);

      const result = await deleteFilledForm('filled-123');

      expect(result.success).toBe(true);
      expect(api.delete).toHaveBeenCalledWith('/filled-forms/filled-123');
    });

    it('handles deletion errors', async () => {
      vi.mocked(api.delete).mockRejectedValue(new Error('Deletion failed'));

      await expect(deleteFilledForm('filled-123')).rejects.toThrow('Deletion failed');
    });
  });

  describe('regenerateFilledForm', () => {
    it('regenerates a filled form with current profile data', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Form regenerated successfully',
          data: {
            filledForm: {
              id: 'filled-123',
              fileUrl: '/new/path/to/file.pdf',
              downloadUrl: '/api/filled-forms/filled-123/download',
              filledFieldsCount: 48,
              warnings: ['Some field updated'],
              createdAt: '2024-01-02T00:00:00Z',
            },
          },
        },
      };

      vi.mocked(api.post).mockResolvedValue(mockResponse as any);

      const result = await regenerateFilledForm('filled-123');

      expect(result.success).toBe(true);
      expect(result.data.filledForm.filledFieldsCount).toBe(48);
      expect(api.post).toHaveBeenCalledWith('/filled-forms/filled-123/regenerate');
    });
  });

  describe('saveAdhocFilledForm', () => {
    it('saves an ad-hoc filled form to history', async () => {
      const mockRequest = {
        documentId: 'doc-123',
        clientId: 'client-456',
        formName: 'Custom Form',
        confidence: 0.95,
        filledFields: 40,
        totalFields: 45,
        dataSnapshot: { firstName: 'John' },
      };

      const mockResponse = {
        data: {
          success: true,
          message: 'Form saved to history',
          data: {
            id: 'adhoc-789',
            clientId: 'client-456',
            clientName: 'John Doe',
            formName: 'Custom Form',
            confidence: 0.95,
            filledFields: 40,
            totalFields: 45,
            downloadUrl: '/api/documents/doc-123/download',
            createdAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      vi.mocked(api.post).mockResolvedValue(mockResponse as any);

      const result = await saveAdhocFilledForm(mockRequest);

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('adhoc-789');
      expect(api.post).toHaveBeenCalledWith('/filled-forms/save-adhoc', mockRequest);
    });

    it('validates required fields', async () => {
      vi.mocked(api.post).mockRejectedValue({
        response: {
          data: {
            error: 'Validation failed',
            details: { formName: ['Form name is required'] },
          },
        },
      });

      await expect(
        saveAdhocFilledForm({
          documentId: 'doc-123',
          clientId: 'client-456',
          formName: '',
          confidence: 0.95,
          filledFields: 40,
          totalFields: 45,
        })
      ).rejects.toMatchObject({
        response: {
          data: {
            error: 'Validation failed',
          },
        },
      });
    });
  });

  describe('filledFormService object', () => {
    it('exports all methods', () => {
      expect(filledFormService.generate).toBe(generateFilledForm);
      expect(filledFormService.preview).toBe(previewFilledForm);
      expect(filledFormService.list).toBe(listFilledForms);
      expect(filledFormService.get).toBe(getFilledForm);
      expect(filledFormService.download).toBe(downloadFilledForm);
      expect(filledFormService.delete).toBe(deleteFilledForm);
      expect(filledFormService.regenerate).toBe(regenerateFilledForm);
      expect(filledFormService.saveAdhoc).toBe(saveAdhocFilledForm);
    });
  });
});

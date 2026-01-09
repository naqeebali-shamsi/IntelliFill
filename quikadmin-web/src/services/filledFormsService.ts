/**
 * Filled Forms Service
 *
 * API client for filled forms operations including listing,
 * viewing details, downloading, and deleting filled forms.
 */

import api from './api';

// =================== TYPES ===================

export interface FilledForm {
  id: string;
  clientId: string;
  clientName: string;
  templateId: string;
  templateName: string;
  templateCategory?: string;
  fileUrl: string;
  downloadUrl: string;
  createdAt: string;
}

export interface FilledFormDetail extends FilledForm {
  clientType?: string;
  dataSnapshot?: Record<string, unknown>;
}

export interface FilledFormListParams {
  clientId?: string;
  templateId?: string;
  limit?: number;
  offset?: number;
}

export interface FilledFormListResponse {
  success: boolean;
  data: {
    filledForms: FilledForm[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}

export interface FilledFormDetailResponse {
  success: boolean;
  data: {
    filledForm: FilledFormDetail;
  };
}

export interface GenerateFormParams {
  templateId: string;
  clientId: string;
  overrideData?: Record<string, unknown>;
}

export interface GenerateFormResponse {
  success: boolean;
  message: string;
  data: {
    filledForm: {
      id: string;
      clientId: string;
      clientName: string;
      templateId: string;
      templateName: string;
      fileUrl: string;
      downloadUrl: string;
      filledFieldsCount: number;
      unmappedFieldsCount: number;
      warnings: string[];
      createdAt: string;
    };
  };
}

// =================== SERVICE ===================

export const filledFormsService = {
  /**
   * Get list of filled forms with optional filtering and pagination
   */
  getFilledForms: async (params?: FilledFormListParams): Promise<FilledFormListResponse> => {
    const response = await api.get<FilledFormListResponse>('/filled-forms', { params });
    return response.data;
  },

  /**
   * Get a single filled form by ID
   */
  getFilledForm: async (id: string): Promise<FilledFormDetailResponse> => {
    const response = await api.get<FilledFormDetailResponse>(`/filled-forms/${id}`);
    return response.data;
  },

  /**
   * Download a filled form PDF
   */
  downloadFilledForm: async (id: string): Promise<Blob> => {
    const response = await api.get(`/filled-forms/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Delete a filled form
   */
  deleteFilledForm: async (id: string): Promise<void> => {
    await api.delete(`/filled-forms/${id}`);
  },

  /**
   * Generate a new filled form
   */
  generateFilledForm: async (params: GenerateFormParams): Promise<GenerateFormResponse> => {
    const response = await api.post<GenerateFormResponse>('/filled-forms/generate', params);
    return response.data;
  },

  /**
   * Regenerate an existing filled form with current profile data
   */
  regenerateFilledForm: async (id: string): Promise<GenerateFormResponse> => {
    const response = await api.post<GenerateFormResponse>(`/filled-forms/${id}/regenerate`);
    return response.data;
  },
};

export default filledFormsService;

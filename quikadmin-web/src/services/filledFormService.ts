/**
 * Filled Form Service
 *
 * Centralized service for filled forms API calls.
 * Handles form generation, history retrieval, and downloads.
 *
 * Task 490: Integrate Form Filling with Filled Forms API
 */

import api from './api';

// =================== TYPES ===================

export interface FilledForm {
  id: string;
  clientId: string;
  clientName: string;
  clientType?: string;
  templateId: string;
  templateName: string;
  templateCategory?: string;
  fileUrl: string;
  downloadUrl: string;
  dataSnapshot?: Record<string, unknown>;
  createdAt: string;
}

export interface GenerateFilledFormRequest {
  templateId: string;
  clientId: string;
  overrideData?: Record<string, unknown>;
}

export interface GenerateFilledFormResponse {
  success: boolean;
  message: string;
  data: {
    filledForm: FilledForm & {
      filledFieldsCount: number;
      unmappedFieldsCount: number;
      warnings: string[];
    };
  };
}

export interface ListFilledFormsParams {
  clientId?: string;
  templateId?: string;
  limit?: number;
  offset?: number;
}

export interface ListFilledFormsResponse {
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

export interface PreviewFormResponse {
  success: boolean;
  data: {
    template: {
      id: string;
      name: string;
      totalFields: number;
    };
    client: {
      id: string;
      name: string;
    };
    preview: Array<{
      formField: string;
      profileField: string | null;
      value: unknown;
      status: 'filled' | 'unmapped' | 'missing_data';
    }>;
    summary: {
      filledCount: number;
      unmappedCount: number;
      missingDataCount: number;
      completionPercentage: number;
    };
  };
}

// =================== API METHODS ===================

/**
 * Generate a filled PDF form from a template and client profile
 */
export async function generateFilledForm(
  request: GenerateFilledFormRequest
): Promise<GenerateFilledFormResponse> {
  const response = await api.post('/filled-forms/generate', request);
  return response.data;
}

/**
 * Preview form filling without saving (dry run)
 */
export async function previewFilledForm(
  request: GenerateFilledFormRequest
): Promise<PreviewFormResponse> {
  const response = await api.post('/filled-forms/preview', request);
  return response.data;
}

/**
 * List filled forms with optional filtering
 */
export async function listFilledForms(
  params?: ListFilledFormsParams
): Promise<ListFilledFormsResponse> {
  const response = await api.get('/filled-forms', { params });
  return response.data;
}

/**
 * Get a single filled form by ID
 */
export async function getFilledForm(id: string): Promise<{
  success: boolean;
  data: { filledForm: FilledForm };
}> {
  const response = await api.get(`/filled-forms/${id}`);
  return response.data;
}

/**
 * Download a filled form PDF
 * Returns a blob for client-side download
 */
export async function downloadFilledForm(id: string): Promise<Blob> {
  const response = await api.get(`/filled-forms/${id}/download`, {
    responseType: 'blob',
  });
  return response.data;
}

/**
 * Helper to trigger browser download for a filled form
 */
export async function triggerFilledFormDownload(
  id: string,
  filename?: string
): Promise<void> {
  const blob = await downloadFilledForm(id);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `filled-form-${id}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Delete a filled form
 */
export async function deleteFilledForm(id: string): Promise<{
  success: boolean;
  message: string;
}> {
  const response = await api.delete(`/filled-forms/${id}`);
  return response.data;
}

/**
 * Regenerate a filled form with current profile data
 */
export async function regenerateFilledForm(id: string): Promise<{
  success: boolean;
  message: string;
  data: {
    filledForm: {
      id: string;
      fileUrl: string;
      downloadUrl: string;
      filledFieldsCount: number;
      warnings: string[];
      createdAt: string;
    };
  };
}> {
  const response = await api.post(`/filled-forms/${id}/regenerate`);
  return response.data;
}

// =================== AD-HOC FORM SAVING ===================

export interface SaveAdhocFormRequest {
  documentId: string;
  clientId: string;
  formName: string;
  confidence: number;
  filledFields: number;
  totalFields: number;
  dataSnapshot?: Record<string, unknown>;
}

export interface SaveAdhocFormResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    clientId: string;
    clientName: string;
    formName: string;
    confidence: number;
    filledFields: number;
    totalFields: number;
    downloadUrl: string;
    createdAt: string;
  };
}

/**
 * Save an ad-hoc filled form to history
 * Used by SimpleFillForm workflow which uses ad-hoc form uploads
 */
export async function saveAdhocFilledForm(
  request: SaveAdhocFormRequest
): Promise<SaveAdhocFormResponse> {
  const response = await api.post('/filled-forms/save-adhoc', request);
  return response.data;
}

// =================== CONVENIENCE EXPORTS ===================

export const filledFormService = {
  generate: generateFilledForm,
  preview: previewFilledForm,
  list: listFilledForms,
  get: getFilledForm,
  download: downloadFilledForm,
  triggerDownload: triggerFilledFormDownload,
  delete: deleteFilledForm,
  regenerate: regenerateFilledForm,
  saveAdhoc: saveAdhocFilledForm,
};

export default filledFormService;

/**
 * Form Service
 * 
 * Centralized service for form filling and template management API calls.
 * Consolidates all form-related endpoints from api.ts
 */

import api from './api';
import type { MappingTemplate } from '@/types/formFilling';

export interface FormValidationResult {
  fields: string[];
  fieldTypes: Record<string, string>;
}

export interface ExtractDataResult {
  [key: string]: any;
}

export interface FillFormRequest {
  formFile: File;
  mappings?: Record<string, string>;
  userData?: Record<string, any>;
}

export interface FillFormResponse {
  documentId: string;
  downloadUrl: string;
  confidence: number;
  filledFields: number;
  totalFields: number;
  warnings?: string[];
}

/**
 * Validate a PDF form and extract field definitions
 */
export async function validateForm(formFile: File): Promise<FormValidationResult> {
  const formData = new FormData();
  formData.append('form', formFile);

  const response = await api.post('/validate/form', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.data;
}

/**
 * Extract data from a document file
 */
export async function extractData(documentFile: File): Promise<ExtractDataResult> {
  const formData = new FormData();
  formData.append('document', documentFile);

  const response = await api.post('/extract', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.data;
}

/**
 * Fill a form using user's aggregated data
 */
export async function fillFormWithUserData(
  request: FillFormRequest
): Promise<FillFormResponse> {
  const formData = new FormData();
  formData.append('form', request.formFile);

  if (request.mappings) {
    formData.append('mappings', JSON.stringify(request.mappings));
  }

  if (request.userData) {
    formData.append('userData', JSON.stringify(request.userData));
  }

  const response = await api.post('/users/me/fill-form', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

/**
 * Fill a form using a specific document
 */
export async function fillFormWithDocument(
  documentId: string,
  formFile: File,
  mappings?: Record<string, string>
): Promise<FillFormResponse> {
  const formData = new FormData();
  formData.append('form', formFile);

  if (mappings) {
    formData.append('mappings', JSON.stringify(mappings));
  }

  const response = await api.post(`/documents/${documentId}/fill`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

/**
 * Simple form fill (legacy endpoint)
 */
export async function simpleFill(
  sourceFile: File,
  targetFile: File
): Promise<FillFormResponse> {
  const formData = new FormData();
  formData.append('documents', sourceFile);
  formData.append('form', targetFile);

  const response = await api.post('/simple-fill', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

/**
 * Template Management
 */

/**
 * Get all templates
 */
export async function getTemplates(): Promise<MappingTemplate[]> {
  const response = await api.get('/templates');
  return response.data.map((template: any) => ({
    id: template.id || template.templateId,
    name: template.name,
    description: template.description,
    mappings: template.mappings || {},
    createdAt: template.createdAt || template.created_at,
    updatedAt: template.updatedAt || template.updated_at,
  }));
}

/**
 * Get a specific template by ID
 */
export async function getTemplate(templateId: string): Promise<MappingTemplate> {
  const response = await api.get(`/templates/${templateId}`);
  const template = response.data;

  return {
    id: template.id || template.templateId,
    name: template.name,
    description: template.description,
    mappings: template.mappings || {},
    createdAt: template.createdAt || template.created_at,
    updatedAt: template.updatedAt || template.updated_at,
  };
}

/**
 * Create a new template
 */
export async function createTemplate(
  template: Omit<MappingTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<MappingTemplate> {
  const response = await api.post('/templates', {
    name: template.name,
    description: template.description,
    mappings: template.mappings,
  });

  const created = response.data.data || response.data;
  return {
    id: created.id || created.templateId,
    name: created.name,
    description: created.description,
    mappings: created.mappings || {},
    createdAt: created.createdAt || created.created_at || new Date().toISOString(),
    updatedAt: created.updatedAt || created.updated_at,
  };
}

/**
 * Update an existing template
 */
export async function updateTemplate(
  templateId: string,
  template: Partial<Omit<MappingTemplate, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  await api.put(`/templates/${templateId}`, {
    name: template.name,
    description: template.description,
    mappings: template.mappings,
  });
}

/**
 * Delete a template
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  await api.delete(`/templates/${templateId}`);
}

/**
 * Get public templates from marketplace
 */
export async function getPublicTemplates(): Promise<MappingTemplate[]> {
  const response = await api.get('/templates/public');
  return response.data.templates.map((template: any) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    formType: template.formType,
    usageCount: template.usageCount,
    author: template.author,
    createdAt: template.createdAt,
  }));
}

/**
 * Detect form type from field names
 */
export async function detectFormType(fieldNames: string[]): Promise<{
  formType: string;
  confidence: number;
  matchedPatterns: string[];
}> {
  const response = await api.post('/templates/detect', { fieldNames });
  return response.data.detection;
}

/**
 * Match templates based on field names
 */
export async function matchTemplates(fieldNames: string[]): Promise<Array<{
  template: MappingTemplate;
  similarity: number;
  matchedFields: string[];
  matchedFieldCount: number;
}>> {
  const response = await api.post('/templates/match', { fieldNames });
  return response.data.matches;
}

/**
 * Increment template usage count
 */
export async function useTemplate(templateId: string): Promise<void> {
  await api.post(`/templates/${templateId}/use`);
}

/**
 * Duplicate a template
 * Creates a new template with the same field mappings
 * Returns the duplicated template with name "{original} (Copy)"
 */
export async function duplicateTemplate(templateId: string): Promise<MappingTemplate> {
  const response = await api.post(`/templates/${templateId}/duplicate`);
  const template = response.data.template;

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    formType: template.formType,
    usageCount: template.usageCount || 0,
    mappings: template.fieldMappings?.reduce((acc: Record<string, string>, mapping: any) => {
      if (mapping.sourceField && mapping.targetField) {
        acc[mapping.targetField] = mapping.sourceField;
      }
      return acc;
    }, {}) || {},
    fieldMappings: template.fieldMappings,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

/**
 * Get user's favorite template IDs (stored in localStorage for now)
 */
export function getFavoriteTemplateIds(): string[] {
  const stored = localStorage.getItem('favorite-templates');
  return stored ? JSON.parse(stored) : [];
}

/**
 * Toggle template favorite status
 * @returns true if now favorited, false if unfavorited
 */
export function toggleTemplateFavorite(templateId: string): boolean {
  const favorites = getFavoriteTemplateIds();
  const index = favorites.indexOf(templateId);
  if (index === -1) {
    favorites.push(templateId);
  } else {
    favorites.splice(index, 1);
  }
  localStorage.setItem('favorite-templates', JSON.stringify(favorites));
  return index === -1; // returns true if now favorited
}

/**
 * Check if template is favorited
 */
export function isTemplateFavorited(templateId: string): boolean {
  return getFavoriteTemplateIds().includes(templateId);
}

// Export everything for convenience
export const formService = {
  validateForm,
  extractData,
  fillFormWithUserData,
  fillFormWithDocument,
  simpleFill,
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  getPublicTemplates,
  detectFormType,
  matchTemplates,
  useTemplate,
  getFavoriteTemplateIds,
  toggleTemplateFavorite,
  isTemplateFavorited,
};


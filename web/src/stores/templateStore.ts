/**
 * Template Store - Manages form templates, fields, validation rules, and template operations
 */

import { create } from 'zustand';
import { Template, TemplateField, ValidationRule, TemplateUsage } from './types';
import { createMiddleware } from './middleware';
import api, { getTemplates, createTemplate, deleteTemplate } from '@/services/api';

// =================== STORE INTERFACES ===================

interface TemplateState {
  // Template data
  templates: Template[];
  categories: string[];
  
  // Current selection
  selectedTemplate: Template | null;
  selectedTemplateId: string | null;
  
  // Template editor
  editorTemplate: Partial<Template> | null;
  editorFields: TemplateField[];
  editorRules: ValidationRule[];
  isEditing: boolean;
  editingTemplateId: string | null;
  
  // Field editor
  selectedField: TemplateField | null;
  fieldBeingEdited: Partial<TemplateField> | null;
  
  // Validation and preview
  validationErrors: Record<string, string[]>;
  previewData: Record<string, any>;
  isValidating: boolean;
  
  // Filters and search
  filters: {
    category: string | null;
    isActive: boolean | null;
    searchQuery: string;
    tags: string[];
  };
  
  // Sorting and pagination
  sorting: {
    field: 'name' | 'createdAt' | 'updatedAt' | 'usage.totalJobs' | 'usage.successRate';
    direction: 'asc' | 'desc';
  };
  
  // UI states
  isLoading: boolean;
  isSaving: boolean;
  lastError: string | null;
  
  // Import/Export
  importInProgress: boolean;
  exportFormat: 'json' | 'csv' | 'xml';
  
  // Template usage analytics
  usageStats: {
    totalTemplates: number;
    activeTemplates: number;
    mostUsed: Template | null;
    leastUsed: Template | null;
    averageFields: number;
  };
}

interface TemplateActions {
  // Template CRUD operations
  loadTemplates: () => Promise<void>;
  createTemplate: (template: Partial<Template>) => Promise<string>;
  updateTemplate: (id: string, updates: Partial<Template>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  duplicateTemplate: (id: string, newName?: string) => Promise<string>;
  
  // Template selection
  selectTemplate: (id: string | null) => void;
  setSelectedTemplate: (template: Template | null) => void;
  
  // Template editor
  startEditing: (templateId?: string) => void;
  stopEditing: () => void;
  updateEditorTemplate: (updates: Partial<Template>) => void;
  saveEditorTemplate: () => Promise<void>;
  resetEditor: () => void;
  
  // Field management
  addField: (field: Partial<TemplateField>) => void;
  updateField: (fieldId: string, updates: Partial<TemplateField>) => void;
  removeField: (fieldId: string) => void;
  reorderFields: (fromIndex: number, toIndex: number) => void;
  duplicateField: (fieldId: string) => void;
  
  // Field editor
  selectField: (field: TemplateField | null) => void;
  startEditingField: (field?: TemplateField) => void;
  updateFieldBeingEdited: (updates: Partial<TemplateField>) => void;
  saveFieldBeingEdited: () => void;
  cancelFieldEditing: () => void;
  
  // Validation rules
  addValidationRule: (rule: Partial<ValidationRule>) => void;
  updateValidationRule: (ruleId: string, updates: Partial<ValidationRule>) => void;
  removeValidationRule: (ruleId: string) => void;
  
  // Template validation and preview
  validateTemplate: (template?: Partial<Template>) => Promise<Record<string, string[]>>;
  previewTemplate: (sampleData: Record<string, any>) => void;
  clearPreview: () => void;
  
  // Filters and search
  setCategoryFilter: (category: string | null) => void;
  setActiveFilter: (isActive: boolean | null) => void;
  setSearchQuery: (query: string) => void;
  setTagsFilter: (tags: string[]) => void;
  clearFilters: () => void;
  
  // Sorting
  setSorting: (field: TemplateState['sorting']['field'], direction: 'asc' | 'desc') => void;
  
  // Import/Export
  importTemplates: (file: File, format: 'json' | 'csv') => Promise<void>;
  exportTemplates: (templateIds: string[], format: 'json' | 'csv' | 'xml') => Promise<Blob>;
  exportTemplate: (templateId: string, format: 'json' | 'xml') => Promise<Blob>;
  
  // Bulk operations
  bulkActivateTemplates: (templateIds: string[]) => Promise<void>;
  bulkDeactivateTemplates: (templateIds: string[]) => Promise<void>;
  bulkDeleteTemplates: (templateIds: string[]) => Promise<void>;
  bulkUpdateCategory: (templateIds: string[], category: string) => Promise<void>;
  
  // Analytics and usage
  refreshUsageStats: () => Promise<void>;
  getTemplateUsage: (templateId: string) => TemplateUsage | null;
  
  // Utility actions
  refreshAll: () => Promise<void>;
  setError: (error: string | null) => void;
  clearError: () => void;
}

// =================== HELPER FUNCTIONS ===================

const generateFieldId = () => `field_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
const generateRuleId = () => `rule_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

const createDefaultField = (): TemplateField => ({
  id: generateFieldId(),
  name: '',
  type: 'text',
  label: '',
  required: false,
  order: 0,
});

const createDefaultRule = (): ValidationRule => ({
  id: generateRuleId(),
  name: '',
  condition: '',
  message: '',
  severity: 'error',
});

const validateTemplateStructure = (template: Partial<Template>): Record<string, string[]> => {
  const errors: Record<string, string[]> = {};
  
  if (!template.name?.trim()) {
    errors.name = ['Template name is required'];
  }
  
  if (!template.category?.trim()) {
    errors.category = ['Category is required'];
  }
  
  if (!template.fields || template.fields.length === 0) {
    errors.fields = ['At least one field is required'];
  } else {
    // Validate each field
    template.fields.forEach((field, index) => {
      const fieldErrors: string[] = [];
      
      if (!field.name?.trim()) {
        fieldErrors.push('Field name is required');
      }
      
      if (!field.label?.trim()) {
        fieldErrors.push('Field label is required');
      }
      
      if (field.validation?.pattern) {
        try {
          new RegExp(field.validation.pattern);
        } catch {
          fieldErrors.push('Invalid regex pattern');
        }
      }
      
      if (fieldErrors.length > 0) {
        errors[`field_${index}`] = fieldErrors;
      }
    });
  }
  
  return errors;
};

// =================== INITIAL STATE ===================

const initialState: TemplateState = {
  templates: [],
  categories: [],
  selectedTemplate: null,
  selectedTemplateId: null,
  editorTemplate: null,
  editorFields: [],
  editorRules: [],
  isEditing: false,
  editingTemplateId: null,
  selectedField: null,
  fieldBeingEdited: null,
  validationErrors: {},
  previewData: {},
  isValidating: false,
  filters: {
    category: null,
    isActive: null,
    searchQuery: '',
    tags: [],
  },
  sorting: {
    field: 'updatedAt',
    direction: 'desc',
  },
  isLoading: false,
  isSaving: false,
  lastError: null,
  importInProgress: false,
  exportFormat: 'json',
  usageStats: {
    totalTemplates: 0,
    activeTemplates: 0,
    mostUsed: null,
    leastUsed: null,
    averageFields: 0,
  },
};

// =================== STORE IMPLEMENTATION ===================

type TemplateStore = TemplateState & TemplateActions;

export const useTemplateStore = create<TemplateStore>()(
  createMiddleware(
    {
      persist: true,
      persistName: 'intellifill-templates',
      persistOptions: {
        partialize: (state) => ({
          selectedTemplateId: state.selectedTemplateId,
          filters: state.filters,
          sorting: state.sorting,
          exportFormat: state.exportFormat,
        }),
        version: 1,
      },
      devtools: true,
      devtoolsName: 'IntelliFill Template Store',
      logger: process.env.NODE_ENV === 'development',
      performance: true,
      performanceId: 'template-store',
      errorBoundary: true,
      immer: true,
      subscribeWithSelector: true,
      undoRedo: true,
      undoRedoSize: 20,
    },
    (set, get) => ({
      ...initialState,

      // =================== TEMPLATE CRUD OPERATIONS ===================

      loadTemplates: async () => {
        set((draft) => {
          draft.isLoading = true;
          draft.lastError = null;
        });

        try {
          const templates = await getTemplates();
          const categories = [...new Set(templates.map(t => t.category))].filter(Boolean);
          
          set((draft) => {
            draft.templates = templates;
            draft.categories = categories;
            
            // Update usage stats
            draft.usageStats.totalTemplates = templates.length;
            draft.usageStats.activeTemplates = templates.filter(t => t.isActive).length;
            
            if (templates.length > 0) {
              const sortedByUsage = templates.sort((a, b) => b.usage.totalJobs - a.usage.totalJobs);
              draft.usageStats.mostUsed = sortedByUsage[0];
              draft.usageStats.leastUsed = sortedByUsage[sortedByUsage.length - 1];
              draft.usageStats.averageFields = templates.reduce((sum, t) => sum + t.fields.length, 0) / templates.length;
            }
          });
        } catch (error: any) {
          set((draft) => {
            draft.lastError = error.message;
          });
        } finally {
          set((draft) => {
            draft.isLoading = false;
          });
        }
      },

      createTemplate: async (template: Partial<Template>) => {
        set((draft) => {
          draft.isSaving = true;
          draft.lastError = null;
        });

        try {
          const newTemplate: Template = {
            id: '',
            name: template.name || 'New Template',
            description: template.description || '',
            category: template.category || 'General',
            fields: template.fields || [],
            rules: template.rules || [],
            isActive: template.isActive ?? true,
            isDefault: template.isDefault ?? false,
            usage: {
              totalJobs: 0,
              successRate: 0,
              averageProcessingTime: 0,
              popularFields: [],
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'current-user', // Get from auth store
            version: 1,
            tags: template.tags || [],
          };

          const response = await createTemplate(newTemplate);
          const savedTemplate = response.data || { ...newTemplate, id: response.id || Date.now().toString() };

          set((draft) => {
            draft.templates.unshift(savedTemplate);
            
            // Update categories if new category
            if (!draft.categories.includes(savedTemplate.category)) {
              draft.categories.push(savedTemplate.category);
            }
          });

          return savedTemplate.id;
        } catch (error: any) {
          set((draft) => {
            draft.lastError = error.message;
          });
          throw error;
        } finally {
          set((draft) => {
            draft.isSaving = false;
          });
        }
      },

      updateTemplate: async (id: string, updates: Partial<Template>) => {
        set((draft) => {
          draft.isSaving = true;
          draft.lastError = null;
        });

        try {
          await api.put(`/templates/${id}`, updates);

          set((draft) => {
            const template = draft.templates.find(t => t.id === id);
            if (template) {
              Object.assign(template, updates, {
                updatedAt: new Date().toISOString(),
                version: template.version + 1,
              });
            }
          });
        } catch (error: any) {
          set((draft) => {
            draft.lastError = error.message;
          });
          throw error;
        } finally {
          set((draft) => {
            draft.isSaving = false;
          });
        }
      },

      deleteTemplate: async (id: string) => {
        try {
          await deleteTemplate(id);
          
          set((draft) => {
            draft.templates = draft.templates.filter(t => t.id !== id);
            
            if (draft.selectedTemplateId === id) {
              draft.selectedTemplate = null;
              draft.selectedTemplateId = null;
            }
          });
        } catch (error: any) {
          set((draft) => {
            draft.lastError = error.message;
          });
          throw error;
        }
      },

      duplicateTemplate: async (id: string, newName?: string) => {
        const template = get().templates.find(t => t.id === id);
        if (!template) throw new Error('Template not found');

        const duplicatedTemplate = {
          ...template,
          name: newName || `${template.name} (Copy)`,
          isDefault: false,
          fields: template.fields.map(field => ({
            ...field,
            id: generateFieldId(),
          })),
          rules: template.rules.map(rule => ({
            ...rule,
            id: generateRuleId(),
          })),
        };

        return await get().createTemplate(duplicatedTemplate);
      },

      // =================== TEMPLATE SELECTION ===================

      selectTemplate: (id: string | null) => {
        set((draft) => {
          draft.selectedTemplateId = id;
          draft.selectedTemplate = id ? draft.templates.find(t => t.id === id) || null : null;
        });
      },

      setSelectedTemplate: (template: Template | null) => {
        set((draft) => {
          draft.selectedTemplate = template;
          draft.selectedTemplateId = template?.id || null;
        });
      },

      // =================== TEMPLATE EDITOR ===================

      startEditing: (templateId?: string) => {
        set((draft) => {
          draft.isEditing = true;
          draft.editingTemplateId = templateId || null;
          
          if (templateId) {
            const template = draft.templates.find(t => t.id === templateId);
            if (template) {
              draft.editorTemplate = { ...template };
              draft.editorFields = [...template.fields];
              draft.editorRules = [...template.rules];
            }
          } else {
            // Creating new template
            draft.editorTemplate = {
              name: '',
              description: '',
              category: '',
              isActive: true,
              isDefault: false,
              tags: [],
            };
            draft.editorFields = [];
            draft.editorRules = [];
          }
          
          draft.validationErrors = {};
        });
      },

      stopEditing: () => {
        set((draft) => {
          draft.isEditing = false;
          draft.editingTemplateId = null;
          draft.editorTemplate = null;
          draft.editorFields = [];
          draft.editorRules = [];
          draft.validationErrors = {};
          draft.selectedField = null;
          draft.fieldBeingEdited = null;
        });
      },

      updateEditorTemplate: (updates: Partial<Template>) => {
        set((draft) => {
          if (draft.editorTemplate) {
            Object.assign(draft.editorTemplate, updates);
          }
        });
      },

      saveEditorTemplate: async () => {
        const { editorTemplate, editorFields, editorRules, editingTemplateId } = get();
        
        if (!editorTemplate) return;

        const templateToSave = {
          ...editorTemplate,
          fields: editorFields,
          rules: editorRules,
        };

        // Validate before saving
        const errors = validateTemplateStructure(templateToSave);
        if (Object.keys(errors).length > 0) {
          set((draft) => {
            draft.validationErrors = errors;
          });
          throw new Error('Template validation failed');
        }

        try {
          if (editingTemplateId) {
            await get().updateTemplate(editingTemplateId, templateToSave);
          } else {
            await get().createTemplate(templateToSave);
          }
          
          get().stopEditing();
        } catch (error) {
          throw error;
        }
      },

      resetEditor: () => {
        const { editingTemplateId } = get();
        
        set((draft) => {
          if (editingTemplateId) {
            const template = draft.templates.find(t => t.id === editingTemplateId);
            if (template) {
              draft.editorTemplate = { ...template };
              draft.editorFields = [...template.fields];
              draft.editorRules = [...template.rules];
            }
          } else {
            draft.editorTemplate = {
              name: '',
              description: '',
              category: '',
              isActive: true,
              isDefault: false,
              tags: [],
            };
            draft.editorFields = [];
            draft.editorRules = [];
          }
          
          draft.validationErrors = {};
        });
      },

      // =================== FIELD MANAGEMENT ===================

      addField: (field: Partial<TemplateField>) => {
        set((draft) => {
          const newField: TemplateField = {
            ...createDefaultField(),
            ...field,
            order: draft.editorFields.length,
          };
          
          draft.editorFields.push(newField);
        });
      },

      updateField: (fieldId: string, updates: Partial<TemplateField>) => {
        set((draft) => {
          const field = draft.editorFields.find(f => f.id === fieldId);
          if (field) {
            Object.assign(field, updates);
          }
        });
      },

      removeField: (fieldId: string) => {
        set((draft) => {
          draft.editorFields = draft.editorFields.filter(f => f.id !== fieldId);
          
          // Update order for remaining fields
          draft.editorFields.forEach((field, index) => {
            field.order = index;
          });
          
          if (draft.selectedField?.id === fieldId) {
            draft.selectedField = null;
          }
        });
      },

      reorderFields: (fromIndex: number, toIndex: number) => {
        set((draft) => {
          const [removed] = draft.editorFields.splice(fromIndex, 1);
          draft.editorFields.splice(toIndex, 0, removed);
          
          // Update order for all fields
          draft.editorFields.forEach((field, index) => {
            field.order = index;
          });
        });
      },

      duplicateField: (fieldId: string) => {
        const field = get().editorFields.find(f => f.id === fieldId);
        if (field) {
          get().addField({
            ...field,
            name: `${field.name}_copy`,
            label: `${field.label} (Copy)`,
          });
        }
      },

      // =================== FIELD EDITOR ===================

      selectField: (field: TemplateField | null) => {
        set((draft) => {
          draft.selectedField = field;
        });
      },

      startEditingField: (field?: TemplateField) => {
        set((draft) => {
          draft.fieldBeingEdited = field ? { ...field } : createDefaultField();
        });
      },

      updateFieldBeingEdited: (updates: Partial<TemplateField>) => {
        set((draft) => {
          if (draft.fieldBeingEdited) {
            Object.assign(draft.fieldBeingEdited, updates);
          }
        });
      },

      saveFieldBeingEdited: () => {
        const { fieldBeingEdited } = get();
        if (!fieldBeingEdited) return;

        set((draft) => {
          if (fieldBeingEdited.id && draft.editorFields.some(f => f.id === fieldBeingEdited.id)) {
            // Update existing field
            const field = draft.editorFields.find(f => f.id === fieldBeingEdited.id);
            if (field) {
              Object.assign(field, fieldBeingEdited);
            }
          } else {
            // Add new field
            const newField: TemplateField = {
              ...createDefaultField(),
              ...fieldBeingEdited,
              order: draft.editorFields.length,
            };
            draft.editorFields.push(newField);
          }
          
          draft.fieldBeingEdited = null;
        });
      },

      cancelFieldEditing: () => {
        set((draft) => {
          draft.fieldBeingEdited = null;
        });
      },

      // =================== VALIDATION RULES ===================

      addValidationRule: (rule: Partial<ValidationRule>) => {
        set((draft) => {
          const newRule: ValidationRule = {
            ...createDefaultRule(),
            ...rule,
          };
          
          draft.editorRules.push(newRule);
        });
      },

      updateValidationRule: (ruleId: string, updates: Partial<ValidationRule>) => {
        set((draft) => {
          const rule = draft.editorRules.find(r => r.id === ruleId);
          if (rule) {
            Object.assign(rule, updates);
          }
        });
      },

      removeValidationRule: (ruleId: string) => {
        set((draft) => {
          draft.editorRules = draft.editorRules.filter(r => r.id !== ruleId);
        });
      },

      // =================== VALIDATION AND PREVIEW ===================

      validateTemplate: async (template?: Partial<Template>) => {
        const templateToValidate = template || {
          ...get().editorTemplate,
          fields: get().editorFields,
          rules: get().editorRules,
        };

        set((draft) => {
          draft.isValidating = true;
        });

        const errors = validateTemplateStructure(templateToValidate);

        set((draft) => {
          draft.validationErrors = errors;
          draft.isValidating = false;
        });

        return errors;
      },

      previewTemplate: (sampleData: Record<string, any>) => {
        set((draft) => {
          draft.previewData = sampleData;
        });
      },

      clearPreview: () => {
        set((draft) => {
          draft.previewData = {};
        });
      },

      // =================== FILTERS AND SEARCH ===================

      setCategoryFilter: (category: string | null) => {
        set((draft) => {
          draft.filters.category = category;
        });
      },

      setActiveFilter: (isActive: boolean | null) => {
        set((draft) => {
          draft.filters.isActive = isActive;
        });
      },

      setSearchQuery: (query: string) => {
        set((draft) => {
          draft.filters.searchQuery = query;
        });
      },

      setTagsFilter: (tags: string[]) => {
        set((draft) => {
          draft.filters.tags = tags;
        });
      },

      clearFilters: () => {
        set((draft) => {
          draft.filters = {
            category: null,
            isActive: null,
            searchQuery: '',
            tags: [],
          };
        });
      },

      // =================== SORTING ===================

      setSorting: (field: TemplateState['sorting']['field'], direction: 'asc' | 'desc') => {
        set((draft) => {
          draft.sorting = { field, direction };
        });
      },

      // =================== IMPORT/EXPORT ===================

      importTemplates: async (file: File, format: 'json' | 'csv') => {
        set((draft) => {
          draft.importInProgress = true;
          draft.lastError = null;
        });

        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('format', format);

          const response = await api.post('/templates/import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          const importedTemplates = response.data.data.templates || [];
          
          set((draft) => {
            draft.templates.push(...importedTemplates);
          });
        } catch (error: any) {
          set((draft) => {
            draft.lastError = error.message;
          });
          throw error;
        } finally {
          set((draft) => {
            draft.importInProgress = false;
          });
        }
      },

      exportTemplates: async (templateIds: string[], format: 'json' | 'csv' | 'xml') => {
        const response = await api.post('/templates/export', {
          templateIds,
          format,
        }, {
          responseType: 'blob',
        });

        return new Blob([response.data], {
          type: format === 'json' ? 'application/json' : 
               format === 'csv' ? 'text/csv' : 'application/xml',
        });
      },

      exportTemplate: async (templateId: string, format: 'json' | 'xml') => {
        const template = get().templates.find(t => t.id === templateId);
        if (!template) throw new Error('Template not found');

        let data: string;
        let mimeType: string;

        if (format === 'json') {
          data = JSON.stringify(template, null, 2);
          mimeType = 'application/json';
        } else {
          // XML format
          data = templateToXML(template);
          mimeType = 'application/xml';
        }

        return new Blob([data], { type: mimeType });
      },

      // =================== BULK OPERATIONS ===================

      bulkActivateTemplates: async (templateIds: string[]) => {
        try {
          await api.post('/templates/bulk/activate', { templateIds });
          
          set((draft) => {
            templateIds.forEach(id => {
              const template = draft.templates.find(t => t.id === id);
              if (template) {
                template.isActive = true;
                template.updatedAt = new Date().toISOString();
              }
            });
          });
        } catch (error: any) {
          set((draft) => {
            draft.lastError = error.message;
          });
          throw error;
        }
      },

      bulkDeactivateTemplates: async (templateIds: string[]) => {
        try {
          await api.post('/templates/bulk/deactivate', { templateIds });
          
          set((draft) => {
            templateIds.forEach(id => {
              const template = draft.templates.find(t => t.id === id);
              if (template) {
                template.isActive = false;
                template.updatedAt = new Date().toISOString();
              }
            });
          });
        } catch (error: any) {
          set((draft) => {
            draft.lastError = error.message;
          });
          throw error;
        }
      },

      bulkDeleteTemplates: async (templateIds: string[]) => {
        try {
          await api.post('/templates/bulk/delete', { templateIds });
          
          set((draft) => {
            draft.templates = draft.templates.filter(t => !templateIds.includes(t.id));
          });
        } catch (error: any) {
          set((draft) => {
            draft.lastError = error.message;
          });
          throw error;
        }
      },

      bulkUpdateCategory: async (templateIds: string[], category: string) => {
        try {
          await api.post('/templates/bulk/category', { templateIds, category });
          
          set((draft) => {
            templateIds.forEach(id => {
              const template = draft.templates.find(t => t.id === id);
              if (template) {
                template.category = category;
                template.updatedAt = new Date().toISOString();
              }
            });
            
            // Update categories list
            if (!draft.categories.includes(category)) {
              draft.categories.push(category);
            }
          });
        } catch (error: any) {
          set((draft) => {
            draft.lastError = error.message;
          });
          throw error;
        }
      },

      // =================== ANALYTICS AND USAGE ===================

      refreshUsageStats: async () => {
        try {
          const response = await api.get('/templates/analytics');
          const stats = response.data.data;
          
          set((draft) => {
            draft.usageStats = stats;
          });
        } catch (error: any) {
          set((draft) => {
            draft.lastError = error.message;
          });
        }
      },

      getTemplateUsage: (templateId: string) => {
        const template = get().templates.find(t => t.id === templateId);
        return template?.usage || null;
      },

      // =================== UTILITY ACTIONS ===================

      refreshAll: async () => {
        await Promise.all([
          get().loadTemplates(),
          get().refreshUsageStats(),
        ]);
      },

      setError: (error: string | null) => {
        set((draft) => {
          draft.lastError = error;
        });
      },

      clearError: () => {
        set((draft) => {
          draft.lastError = null;
        });
      },
    })
  )
);

// =================== HELPER FUNCTIONS ===================

function templateToXML(template: Template): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<template>
  <id>${template.id}</id>
  <name><![CDATA[${template.name}]]></name>
  <description><![CDATA[${template.description || ''}]]></description>
  <category>${template.category}</category>
  <isActive>${template.isActive}</isActive>
  <fields>
    ${template.fields.map(field => `
    <field>
      <id>${field.id}</id>
      <name>${field.name}</name>
      <type>${field.type}</type>
      <label><![CDATA[${field.label}]]></label>
      <required>${field.required}</required>
      <order>${field.order}</order>
    </field>`).join('')}
  </fields>
  <rules>
    ${template.rules.map(rule => `
    <rule>
      <id>${rule.id}</id>
      <name><![CDATA[${rule.name}]]></name>
      <condition><![CDATA[${rule.condition}]]></condition>
      <message><![CDATA[${rule.message}]]></message>
      <severity>${rule.severity}</severity>
    </rule>`).join('')}
  </rules>
</template>`;
}

// =================== SELECTORS ===================

export const templateSelectors = {
  allTemplates: (state: TemplateStore) => state.templates,
  activeTemplates: (state: TemplateStore) => state.templates.filter(t => t.isActive),
  filteredTemplates: (state: TemplateStore) => {
    let filtered = state.templates;
    
    if (state.filters.category) {
      filtered = filtered.filter(t => t.category === state.filters.category);
    }
    
    if (state.filters.isActive !== null) {
      filtered = filtered.filter(t => t.isActive === state.filters.isActive);
    }
    
    if (state.filters.searchQuery) {
      const query = state.filters.searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query)
      );
    }
    
    if (state.filters.tags.length > 0) {
      filtered = filtered.filter(t => 
        state.filters.tags.some(tag => t.tags.includes(tag))
      );
    }
    
    return filtered;
  },
  sortedTemplates: (state: TemplateStore) => {
    const filtered = templateSelectors.filteredTemplates(state);
    const { field, direction } = state.sorting;
    
    return filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (field) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          aValue = new Date(a.updatedAt).getTime();
          bValue = new Date(b.updatedAt).getTime();
          break;
        case 'usage.totalJobs':
          aValue = a.usage.totalJobs;
          bValue = b.usage.totalJobs;
          break;
        case 'usage.successRate':
          aValue = a.usage.successRate;
          bValue = b.usage.successRate;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  },
  templateById: (id: string) => (state: TemplateStore) => {
    return state.templates.find(t => t.id === id) || null;
  },
  categoryCounts: (state: TemplateStore) => {
    const counts: Record<string, number> = {};
    state.templates.forEach(template => {
      counts[template.category] = (counts[template.category] || 0) + 1;
    });
    return counts;
  },
  isEditing: (state: TemplateStore) => state.isEditing,
  hasUnsavedChanges: (state: TemplateStore) => {
    if (!state.isEditing || !state.editingTemplateId) return false;
    
    const original = state.templates.find(t => t.id === state.editingTemplateId);
    if (!original) return true; // New template
    
    return JSON.stringify(original) !== JSON.stringify({
      ...state.editorTemplate,
      fields: state.editorFields,
      rules: state.editorRules,
    });
  },
};

// =================== HOOKS FOR SPECIFIC USE CASES ===================

export const useTemplates = () => useTemplateStore((state) => ({
  templates: templateSelectors.sortedTemplates(state),
  loading: state.isLoading,
  error: state.lastError,
  load: state.loadTemplates,
  create: state.createTemplate,
  update: state.updateTemplate,
  delete: state.deleteTemplate,
}));

export const useTemplateEditor = () => useTemplateStore((state) => ({
  isEditing: state.isEditing,
  template: state.editorTemplate,
  fields: state.editorFields,
  rules: state.editorRules,
  validationErrors: state.validationErrors,
  hasUnsavedChanges: templateSelectors.hasUnsavedChanges(state),
  startEditing: state.startEditing,
  stopEditing: state.stopEditing,
  save: state.saveEditorTemplate,
  reset: state.resetEditor,
  updateTemplate: state.updateEditorTemplate,
  addField: state.addField,
  updateField: state.updateField,
  removeField: state.removeField,
}));

export const useTemplateFilters = () => useTemplateStore((state) => ({
  filters: state.filters,
  categories: state.categories,
  setCategory: state.setCategoryFilter,
  setActive: state.setActiveFilter,
  setSearch: state.setSearchQuery,
  setTags: state.setTagsFilter,
  clear: state.clearFilters,
}));

// =================== EXPORT TYPES ===================

export type { TemplateState, TemplateActions };
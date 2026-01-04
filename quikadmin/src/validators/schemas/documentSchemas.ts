import Joi from 'joi';
import { uuidSchema, safeStringSchema } from './common';

// Document upload schema (Task 281: Uses common schemas)
export const documentUploadSchema = Joi.object({
  documentType: Joi.string().valid('pdf', 'docx', 'csv', 'image').optional(),
  metadata: Joi.object({
    title: safeStringSchema.max(255).optional(),
    description: safeStringSchema.max(1000).optional(),
    tags: Joi.array().items(safeStringSchema.max(50)).max(10).optional(),
  }).optional(),
});

// Document processing schema (Task 281: Uses common schemas)
export const documentProcessSchema = Joi.object({
  documentId: uuidSchema.required().messages({
    'any.required': 'Document ID is required',
  }),
  targetFormId: uuidSchema.optional(),
  options: Joi.object({
    extractTables: Joi.boolean().default(false),
    ocrEnabled: Joi.boolean().default(true),
    language: Joi.string().valid('eng', 'spa', 'fra', 'deu').default('eng'),
    confidenceThreshold: Joi.number().min(0).max(1).default(0.85),
  }).optional(),
});

// Field mapping schema (Task 281: Uses common schemas)
export const fieldMappingSchema = Joi.object({
  sourceFields: Joi.array()
    .items(
      Joi.object({
        name: safeStringSchema.max(100).required(),
        value: Joi.any().required(),
        type: safeStringSchema.max(50).optional(),
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one source field is required',
      'any.required': 'Source fields are required',
    }),
  targetFormId: uuidSchema.required().messages({
    'any.required': 'Target form ID is required',
  }),
  mappingStrategy: Joi.string().valid('auto', 'manual', 'ml-assisted').default('auto'),
});

// Form fill schema (Task 281: Uses common schemas)
export const formFillSchema = Joi.object({
  formId: uuidSchema.required().messages({
    'any.required': 'Form ID is required',
  }),
  mappedData: Joi.object().pattern(Joi.string(), Joi.any()).required().messages({
    'any.required': 'Mapped data is required',
  }),
  options: Joi.object({
    validateBeforeFill: Joi.boolean().default(true),
    preserveExisting: Joi.boolean().default(false),
    outputFormat: Joi.string().valid('pdf', 'json').default('pdf'),
  }).optional(),
});

// Batch processing schema (Task 281: Uses common schemas)
export const batchProcessSchema = Joi.object({
  documentIds: Joi.array().items(uuidSchema).min(1).max(100).required().messages({
    'array.min': 'At least one document is required',
    'array.max': 'Maximum 100 documents per batch',
    'any.required': 'Document IDs are required',
  }),
  targetFormId: uuidSchema.optional(),
  options: Joi.object({
    parallel: Joi.boolean().default(true),
    stopOnError: Joi.boolean().default(false),
    notificationWebhook: Joi.string().uri().optional(),
  }).optional(),
});

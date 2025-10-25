import Joi from 'joi';

// Document upload schema
export const documentUploadSchema = Joi.object({
  documentType: Joi.string()
    .valid('pdf', 'docx', 'csv', 'image')
    .optional(),
  metadata: Joi.object({
    title: Joi.string().max(255).optional(),
    description: Joi.string().max(1000).optional(),
    tags: Joi.array().items(Joi.string()).max(10).optional()
  }).optional()
});

// Document processing schema
export const documentProcessSchema = Joi.object({
  documentId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid document ID format',
      'any.required': 'Document ID is required'
    }),
  targetFormId: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': 'Invalid form ID format'
    }),
  options: Joi.object({
    extractTables: Joi.boolean().default(false),
    ocrEnabled: Joi.boolean().default(true),
    language: Joi.string().valid('eng', 'spa', 'fra', 'deu').default('eng'),
    confidenceThreshold: Joi.number().min(0).max(1).default(0.85)
  }).optional()
});

// Field mapping schema
export const fieldMappingSchema = Joi.object({
  sourceFields: Joi.array()
    .items(Joi.object({
      name: Joi.string().required(),
      value: Joi.any().required(),
      type: Joi.string().optional()
    }))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one source field is required',
      'any.required': 'Source fields are required'
    }),
  targetFormId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid form ID format',
      'any.required': 'Target form ID is required'
    }),
  mappingStrategy: Joi.string()
    .valid('auto', 'manual', 'ml-assisted')
    .default('auto')
});

// Form fill schema
export const formFillSchema = Joi.object({
  formId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid form ID format',
      'any.required': 'Form ID is required'
    }),
  mappedData: Joi.object()
    .pattern(
      Joi.string(),
      Joi.any()
    )
    .required()
    .messages({
      'any.required': 'Mapped data is required'
    }),
  options: Joi.object({
    validateBeforeFill: Joi.boolean().default(true),
    preserveExisting: Joi.boolean().default(false),
    outputFormat: Joi.string().valid('pdf', 'json').default('pdf')
  }).optional()
});

// Batch processing schema
export const batchProcessSchema = Joi.object({
  documentIds: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one document is required',
      'array.max': 'Maximum 100 documents per batch',
      'any.required': 'Document IDs are required'
    }),
  targetFormId: Joi.string()
    .uuid()
    .optional(),
  options: Joi.object({
    parallel: Joi.boolean().default(true),
    stopOnError: Joi.boolean().default(false),
    notificationWebhook: Joi.string().uri().optional()
  }).optional()
});
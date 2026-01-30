/**
 * Extraction Response Schemas - Phase 1.2
 *
 * Zod schemas for Gemini Structured Outputs API.
 * Guarantees 100% JSON compliance, eliminating parse failures.
 *
 * @module multiagent/schemas/extractionResponseSchemas
 */

import { z } from 'zod';
import { DocumentCategory } from '../types/state';

// ============================================================================
// Base Schema Components
// ============================================================================

/**
 * Base schema for an extracted field with confidence
 */
export const ExtractedFieldSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).describe(
    'The extracted value from the document'
  ),
  confidence: z
    .number()
    .min(0)
    .max(100)
    .describe('Confidence score from 0-100 indicating extraction reliability'),
  rawText: z
    .string()
    .optional()
    .describe('The original text that was matched, for verification'),
});

/**
 * Schema for an optional field (can be null or missing)
 */
const optionalField = () =>
  z
    .object({
      value: z.union([z.string(), z.null()]),
      confidence: z.number().min(0).max(100),
      rawText: z.string().optional(),
    })
    .optional();

/**
 * Schema for a required string field
 */
const requiredStringField = () =>
  z.object({
    value: z.string().describe('Extracted string value'),
    confidence: z.number().min(0).max(100),
    rawText: z.string().optional(),
  });

/**
 * Schema for a date field
 */
const dateField = () =>
  z.object({
    value: z
      .string()
      .nullable()
      .describe('Date value in format YYYY-MM-DD or DD/MM/YYYY'),
    confidence: z.number().min(0).max(100),
    rawText: z.string().optional(),
  });

// ============================================================================
// Category-Specific Schemas
// ============================================================================

/**
 * Passport extraction schema
 */
export const PassportExtractionSchema = z.object({
  full_name: requiredStringField().describe('Full name as shown on passport'),
  surname: optionalField().describe('Family name / Surname'),
  given_names: optionalField().describe('Given names / First name(s)'),
  passport_number: z
    .object({
      value: z.string().describe('Passport number (6-9 alphanumeric characters)'),
      confidence: z.number().min(0).max(100),
      rawText: z.string().optional(),
    })
    .describe('Passport document number'),
  nationality: requiredStringField().describe('Nationality / Citizenship'),
  date_of_birth: dateField().describe('Date of birth'),
  place_of_birth: optionalField().describe('Place of birth'),
  date_of_issue: dateField().optional().describe('Date of issue'),
  date_of_expiry: dateField().describe('Date of expiry / Expiration date'),
  issuing_authority: optionalField().describe('Issuing authority / Country'),
  sex: z
    .object({
      value: z.enum(['M', 'F', 'm', 'f']).nullable(),
      confidence: z.number().min(0).max(100),
      rawText: z.string().optional(),
    })
    .optional()
    .describe('Sex / Gender'),
  mrz_line1: optionalField().describe('Machine Readable Zone line 1'),
  mrz_line2: optionalField().describe('Machine Readable Zone line 2'),
});

/**
 * Emirates ID extraction schema
 */
export const EmiratesIdExtractionSchema = z.object({
  full_name: requiredStringField().describe('Full name in English'),
  full_name_arabic: optionalField().describe('Full name in Arabic'),
  emirates_id: z
    .object({
      value: z.string().describe('Emirates ID number (format: 784-YYYY-XXXXXXX-X)'),
      confidence: z.number().min(0).max(100),
      rawText: z.string().optional(),
    })
    .describe('Emirates ID number'),
  nationality: requiredStringField().describe('Nationality'),
  date_of_birth: dateField().describe('Date of birth'),
  date_of_expiry: dateField().describe('Card expiry date'),
  sex: z
    .object({
      value: z.enum(['M', 'F', 'm', 'f']).nullable(),
      confidence: z.number().min(0).max(100),
      rawText: z.string().optional(),
    })
    .optional()
    .describe('Sex / Gender'),
  card_number: optionalField().describe('Card number if different from Emirates ID'),
});

/**
 * Visa extraction schema
 */
export const VisaExtractionSchema = z.object({
  full_name: requiredStringField().describe('Visa holder full name'),
  visa_number: requiredStringField().describe('Visa number'),
  visa_type: requiredStringField().describe(
    'Type of visa (Employment, Tourist, Residence, etc.)'
  ),
  nationality: optionalField().describe('Nationality of visa holder'),
  passport_number: optionalField().describe('Passport number'),
  date_of_issue: dateField().optional().describe('Visa issue date'),
  date_of_expiry: dateField().describe('Visa expiry date'),
  sponsor: optionalField().describe('Sponsor name / Company'),
  uid: optionalField().describe('Unified ID Number'),
  file_number: optionalField().describe('File number'),
  place_of_issue: optionalField().describe('Place of issue'),
  profession: optionalField().describe('Profession / Occupation'),
});

/**
 * Trade License extraction schema
 */
export const TradeLicenseExtractionSchema = z.object({
  license_number: requiredStringField().describe('Trade license number'),
  company_name: requiredStringField().describe('Company/Business name'),
  company_name_arabic: optionalField().describe('Company name in Arabic'),
  license_type: optionalField().describe('Type of license'),
  activities: optionalField().describe('Business activities'),
  date_of_issue: dateField().optional().describe('License issue date'),
  date_of_expiry: dateField().describe('License expiry date'),
  legal_form: optionalField().describe('Legal form (LLC, Sole Proprietor, etc.)'),
  address: optionalField().describe('Business address'),
  issuing_authority: optionalField().describe(
    'Issuing authority (DED, Free Zone, etc.)'
  ),
});

/**
 * Labor Card extraction schema
 */
export const LaborCardExtractionSchema = z.object({
  full_name: requiredStringField().describe('Employee full name'),
  card_number: requiredStringField().describe('Labor card number'),
  person_code: optionalField().describe('Person code'),
  nationality: optionalField().describe('Nationality'),
  occupation: requiredStringField().describe('Occupation / Job title'),
  employer: requiredStringField().describe('Employer name'),
  date_of_issue: dateField().optional().describe('Card issue date'),
  date_of_expiry: dateField().describe('Card expiry date'),
});

/**
 * Bank Statement extraction schema
 */
export const BankStatementExtractionSchema = z.object({
  account_holder: requiredStringField().describe('Account holder name'),
  account_number: requiredStringField().describe('Account number'),
  iban: optionalField().describe('IBAN'),
  bank_name: requiredStringField().describe('Bank name'),
  statement_period: optionalField().describe('Statement period'),
  opening_balance: optionalField().describe('Opening balance'),
  closing_balance: optionalField().describe('Closing balance'),
  currency: optionalField().describe('Currency'),
  branch: optionalField().describe('Branch name'),
});

/**
 * ID Card (Driver's License, etc.) extraction schema
 */
export const IdCardExtractionSchema = z.object({
  full_name: requiredStringField().describe('Full name on the card'),
  surname: optionalField().describe('Family name / Surname / Last name'),
  given_names: optionalField().describe('Given names / First name(s)'),
  license_number: requiredStringField().describe('License or ID number'),
  date_of_birth: dateField().describe('Date of birth'),
  date_of_expiry: dateField().describe('Expiry date'),
  date_of_issue: dateField().optional().describe('Issue date'),
  sex: z
    .object({
      value: z.enum(['M', 'F', 'm', 'f']).nullable(),
      confidence: z.number().min(0).max(100),
      rawText: z.string().optional(),
    })
    .optional()
    .describe('Sex / Gender'),
  height: optionalField().describe('Height'),
  address: optionalField().describe('Address on the card'),
  city: optionalField().describe('City'),
  province: optionalField().describe('Province / State'),
  postal_code: optionalField().describe('Postal / Zip code'),
  license_class: optionalField().describe('License class'),
  restrictions: optionalField().describe('Restrictions / Conditions'),
  issuing_authority: optionalField().describe('Issuing authority or jurisdiction'),
});

/**
 * Invoice extraction schema
 */
export const InvoiceExtractionSchema = z.object({
  invoice_number: requiredStringField().describe('Invoice number'),
  vendor_name: requiredStringField().describe('Vendor/Company name'),
  customer_name: optionalField().describe('Customer/Bill to name'),
  invoice_date: dateField().describe('Invoice date'),
  due_date: dateField().optional().describe('Due date'),
  total_amount: requiredStringField().describe('Total amount'),
  tax_amount: optionalField().describe('Tax/VAT amount'),
  currency: optionalField().describe('Currency'),
  account_number: optionalField().describe('Account/Customer number'),
});

/**
 * Contract extraction schema
 */
export const ContractExtractionSchema = z.object({
  contract_type: optionalField().describe('Type of contract'),
  party1_name: requiredStringField().describe('First party name'),
  party2_name: requiredStringField().describe('Second party name'),
  contract_date: dateField().optional().describe('Contract date'),
  start_date: dateField().optional().describe('Start date'),
  end_date: dateField().optional().describe('End date'),
  contract_value: optionalField().describe('Contract value/Amount'),
  property_address: optionalField().describe('Property address (for tenancy)'),
});

/**
 * Generic/Unknown document extraction schema
 */
export const GenericExtractionSchema = z.record(
  z.string(),
  z.object({
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    confidence: z.number().min(0).max(100),
    rawText: z.string().optional(),
  })
);

// ============================================================================
// Schema Registry
// ============================================================================

/**
 * Map of document categories to their Zod schemas
 */
export const EXTRACTION_SCHEMAS: Record<DocumentCategory, z.ZodType<any>> = {
  PASSPORT: PassportExtractionSchema,
  EMIRATES_ID: EmiratesIdExtractionSchema,
  VISA: VisaExtractionSchema,
  TRADE_LICENSE: TradeLicenseExtractionSchema,
  LABOR_CARD: LaborCardExtractionSchema,
  BANK_STATEMENT: BankStatementExtractionSchema,
  ID_CARD: IdCardExtractionSchema,
  INVOICE: InvoiceExtractionSchema,
  CONTRACT: ContractExtractionSchema,
  ESTABLISHMENT_CARD: GenericExtractionSchema,
  MOA: GenericExtractionSchema,
  UNKNOWN: GenericExtractionSchema,
};

/**
 * Get the extraction schema for a document category
 */
export function getExtractionSchema(category: DocumentCategory): z.ZodType<any> {
  return EXTRACTION_SCHEMAS[category] || GenericExtractionSchema;
}

// ============================================================================
// JSON Schema Conversion for Gemini
// ============================================================================

/**
 * Convert a Zod schema to JSON Schema format for Gemini API
 *
 * Note: This is a simplified converter. For production, consider using
 * the 'zod-to-json-schema' package for complete conversion.
 */
export function zodToGeminiSchema(zodSchema: z.ZodType<any>): object {
  // For now, we use a simplified approach
  // The Gemini API is flexible with JSON schemas
  const shape = (zodSchema as any)._def?.shape?.();

  if (!shape) {
    // Handle record types (generic schema)
    return {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          value: {
            type: ['string', 'number', 'boolean', 'null'],
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 100,
          },
          rawText: {
            type: 'string',
          },
        },
        required: ['value', 'confidence'],
      },
    };
  }

  const properties: Record<string, object> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const fieldDef = (value as any)._def;

    // Check if field is optional
    const isOptional = fieldDef?.typeName === 'ZodOptional';

    // Build property schema
    properties[key] = {
      type: 'object',
      properties: {
        value: {
          type: ['string', 'number', 'boolean', 'null'],
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 100,
        },
        rawText: {
          type: 'string',
        },
      },
      required: ['value', 'confidence'],
    };

    if (!isOptional) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    required,
  };
}

/**
 * Get Gemini-compatible JSON schema for a document category
 */
export function getGeminiSchema(category: DocumentCategory): object {
  const zodSchema = getExtractionSchema(category);
  return zodToGeminiSchema(zodSchema);
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate extracted data against category schema
 *
 * @param data - Extracted data to validate
 * @param category - Document category
 * @returns Validated data or throws ZodError
 */
export function validateExtraction(
  data: unknown,
  category: DocumentCategory
): z.infer<typeof GenericExtractionSchema> {
  const schema = getExtractionSchema(category);
  return schema.parse(data);
}

/**
 * Safe validation that returns result or error
 */
export function safeValidateExtraction(
  data: unknown,
  category: DocumentCategory
): {
  success: boolean;
  data?: z.infer<typeof GenericExtractionSchema>;
  error?: z.ZodError;
} {
  const schema = getExtractionSchema(category);
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, error: result.error };
}

// ============================================================================
// Type Exports
// ============================================================================

export type PassportExtraction = z.infer<typeof PassportExtractionSchema>;
export type EmiratesIdExtraction = z.infer<typeof EmiratesIdExtractionSchema>;
export type VisaExtraction = z.infer<typeof VisaExtractionSchema>;
export type TradeLicenseExtraction = z.infer<typeof TradeLicenseExtractionSchema>;
export type LaborCardExtraction = z.infer<typeof LaborCardExtractionSchema>;
export type BankStatementExtraction = z.infer<typeof BankStatementExtractionSchema>;
export type IdCardExtraction = z.infer<typeof IdCardExtractionSchema>;
export type InvoiceExtraction = z.infer<typeof InvoiceExtractionSchema>;
export type ContractExtraction = z.infer<typeof ContractExtractionSchema>;
export type GenericExtraction = z.infer<typeof GenericExtractionSchema>;

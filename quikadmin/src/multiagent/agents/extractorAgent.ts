/**
 * Document Data Extractor Agent
 *
 * Uses Gemini API to extract structured data from documents in the multiagent pipeline.
 * Supports category-specific extraction prompts with per-field confidence scoring.
 *
 * Features:
 * - Category-specific extraction prompts (PASSPORT, EMIRATES_ID, VISA, etc.)
 * - Per-field confidence scoring using ExtractedFieldResult format
 * - Pattern-based fallback when Gemini fails
 * - Retry with exponential backoff for resilience
 * - Merging of LLM and pattern results (higher confidence wins)
 *
 * @module multiagent/agents/extractorAgent
 */

import { GoogleGenerativeAI, GenerativeModel, Part } from '@google/generative-ai';
import { z, ZodError } from 'zod';
import { DocumentCategory } from '../types/state';
import { piiSafeLogger as logger } from '../../utils/piiSafeLogger';
import { ExtractedFieldResult, ExtractedDataWithConfidence } from '../../types/extractedData';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Result from the extractor agent
 */
export interface ExtractionResult {
  /** Extracted fields with per-field confidence */
  fields: Record<string, ExtractedFieldResult>;
  /** Document category used for extraction */
  documentCategory: DocumentCategory;
  /** Raw OCR text that was processed */
  rawText: string;
  /** Processing time in milliseconds */
  processingTime: number;
  /** Model used for extraction */
  modelUsed: string;
}

/**
 * Expected field definition for a document category
 */
interface ExpectedField {
  name: string;
  description: string;
  required: boolean;
  pattern?: RegExp;
  aliases?: string[];
}

/**
 * Category-specific extraction configuration
 */
interface CategoryExtractionConfig {
  fields: ExpectedField[];
  prompt: string;
}

/**
 * Gemini extraction response structure
 */
interface GeminiExtractionResponse {
  [fieldName: string]: {
    value: string | number | boolean | null;
    confidence?: number;
    rawText?: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Model to use for extraction
 */
const EXTRACTION_MODEL = 'gemini-1.5-flash';

/**
 * Maximum retry attempts for Gemini API calls
 */
const MAX_RETRIES = 3;

/**
 * Base delay for exponential backoff (ms)
 */
const BASE_RETRY_DELAY_MS = 1000;

/**
 * Maximum text length to send to Gemini
 */
const MAX_TEXT_LENGTH = 8000;

/**
 * Confidence threshold for pattern validation boost
 */
const PATTERN_VALIDATION_BOOST = 10;

/**
 * Low confidence threshold for flagging fields for review
 */
const LOW_CONFIDENCE_THRESHOLD = 70;

/**
 * Timeout for Gemini API calls (30 seconds)
 */
const GEMINI_TIMEOUT_MS = 30000;

/**
 * Maximum concurrent Gemini API calls (rate limiting)
 */
const MAX_CONCURRENT_GEMINI_CALLS = 5;

// ============================================================================
// Category-Specific Extraction Configurations
// ============================================================================

/**
 * Extraction configurations per document category
 */
const EXTRACTION_CONFIGS: Partial<Record<DocumentCategory, CategoryExtractionConfig>> = {
  PASSPORT: {
    fields: [
      { name: 'full_name', description: 'Full name as shown on passport', required: true },
      {
        name: 'surname',
        description: 'Family name / Surname',
        required: false,
        aliases: ['family_name', 'last_name'],
      },
      {
        name: 'given_names',
        description: 'Given names / First name(s)',
        required: false,
        aliases: ['first_name', 'first_names'],
      },
      {
        name: 'passport_number',
        description: 'Passport number',
        required: true,
        pattern: /^[A-Z]{0,2}[0-9]{6,9}$/i,
        aliases: ['passport_no', 'document_number'],
      },
      {
        name: 'nationality',
        description: 'Nationality / Citizenship',
        required: true,
        aliases: ['citizenship'],
      },
      {
        name: 'date_of_birth',
        description: 'Date of birth (DD/MM/YYYY or YYYY-MM-DD)',
        required: true,
        pattern: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
        aliases: ['dob', 'birth_date'],
      },
      {
        name: 'place_of_birth',
        description: 'Place of birth',
        required: false,
        aliases: ['birth_place'],
      },
      {
        name: 'date_of_issue',
        description: 'Date of issue',
        required: false,
        pattern: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
        aliases: ['issue_date'],
      },
      {
        name: 'date_of_expiry',
        description: 'Date of expiry / Expiration date',
        required: true,
        pattern: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
        aliases: ['expiry_date', 'expiration_date', 'valid_until'],
      },
      {
        name: 'issuing_authority',
        description: 'Issuing authority / Country',
        required: false,
        aliases: ['issuing_country'],
      },
      {
        name: 'sex',
        description: 'Sex / Gender (M/F)',
        required: false,
        pattern: /^[MF]$/i,
        aliases: ['gender'],
      },
      { name: 'mrz_line1', description: 'Machine Readable Zone line 1', required: false },
      { name: 'mrz_line2', description: 'Machine Readable Zone line 2', required: false },
    ],
    prompt: `Extract passport information from the document. Focus on:
- Full name (surname and given names separately if possible)
- Passport number (typically alphanumeric, 6-9 characters)
- Nationality/Citizenship
- Date of birth
- Place of birth
- Issue and expiry dates
- Gender
- MRZ (Machine Readable Zone) if visible`,
  },

  EMIRATES_ID: {
    fields: [
      { name: 'full_name', description: 'Full name in English', required: true },
      { name: 'full_name_arabic', description: 'Full name in Arabic', required: false },
      {
        name: 'emirates_id',
        description: 'Emirates ID number (784-YYYY-XXXXXXX-X)',
        required: true,
        pattern: /^784-\d{4}-\d{7}-\d$/,
        aliases: ['id_number', 'eid'],
      },
      { name: 'nationality', description: 'Nationality', required: true },
      {
        name: 'date_of_birth',
        description: 'Date of birth',
        required: true,
        pattern: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
        aliases: ['dob'],
      },
      {
        name: 'date_of_expiry',
        description: 'Card expiry date',
        required: true,
        pattern: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
        aliases: ['expiry_date'],
      },
      {
        name: 'sex',
        description: 'Sex / Gender',
        required: false,
        pattern: /^[MF]$/i,
        aliases: ['gender'],
      },
      {
        name: 'card_number',
        description: 'Card number (if different from Emirates ID)',
        required: false,
      },
    ],
    prompt: `Extract Emirates ID card information. Focus on:
- Full name (in both English and Arabic if available)
- Emirates ID number (format: 784-YYYY-XXXXXXX-X)
- Nationality
- Date of birth
- Card expiry date
- Gender`,
  },

  VISA: {
    fields: [
      { name: 'full_name', description: 'Visa holder full name', required: true },
      {
        name: 'visa_number',
        description: 'Visa number',
        required: true,
        aliases: ['visa_no', 'permit_number'],
      },
      {
        name: 'visa_type',
        description: 'Type of visa (Employment, Tourist, Residence, etc.)',
        required: true,
        aliases: ['type', 'permit_type'],
      },
      { name: 'nationality', description: 'Nationality of visa holder', required: false },
      { name: 'passport_number', description: 'Passport number', required: false },
      {
        name: 'date_of_issue',
        description: 'Visa issue date',
        required: false,
        pattern: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
        aliases: ['issue_date'],
      },
      {
        name: 'date_of_expiry',
        description: 'Visa expiry date',
        required: true,
        pattern: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
        aliases: ['expiry_date', 'valid_until'],
      },
      {
        name: 'sponsor',
        description: 'Sponsor name / Company',
        required: false,
        aliases: ['sponsor_name', 'employer'],
      },
      { name: 'uid', description: 'Unified ID Number', required: false },
      { name: 'file_number', description: 'File number', required: false },
      { name: 'place_of_issue', description: 'Place of issue', required: false },
      {
        name: 'profession',
        description: 'Profession / Occupation',
        required: false,
        aliases: ['occupation', 'job_title'],
      },
    ],
    prompt: `Extract visa/entry permit information. Focus on:
- Visa holder name
- Visa number and type
- Issue and expiry dates
- Sponsor/Employer information
- Profession/Occupation
- File number and UID if present`,
  },

  TRADE_LICENSE: {
    fields: [
      {
        name: 'license_number',
        description: 'Trade license number',
        required: true,
        aliases: ['license_no'],
      },
      {
        name: 'company_name',
        description: 'Company/Business name',
        required: true,
        aliases: ['business_name', 'trade_name'],
      },
      { name: 'company_name_arabic', description: 'Company name in Arabic', required: false },
      { name: 'license_type', description: 'Type of license', required: false, aliases: ['type'] },
      {
        name: 'activities',
        description: 'Business activities',
        required: false,
        aliases: ['business_activities'],
      },
      {
        name: 'date_of_issue',
        description: 'License issue date',
        required: false,
        pattern: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
        aliases: ['issue_date'],
      },
      {
        name: 'date_of_expiry',
        description: 'License expiry date',
        required: true,
        pattern: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
        aliases: ['expiry_date'],
      },
      {
        name: 'legal_form',
        description: 'Legal form (LLC, Sole Proprietor, etc.)',
        required: false,
      },
      { name: 'address', description: 'Business address', required: false },
      {
        name: 'issuing_authority',
        description: 'Issuing authority (DED, Free Zone, etc.)',
        required: false,
      },
    ],
    prompt: `Extract trade license information. Focus on:
- License number
- Company/Business name (English and Arabic)
- License type and business activities
- Issue and expiry dates
- Legal form
- Issuing authority`,
  },

  LABOR_CARD: {
    fields: [
      { name: 'full_name', description: 'Employee full name', required: true },
      {
        name: 'card_number',
        description: 'Labor card number',
        required: true,
        aliases: ['work_card_number'],
      },
      { name: 'person_code', description: 'Person code', required: false },
      { name: 'nationality', description: 'Nationality', required: false },
      {
        name: 'occupation',
        description: 'Occupation / Job title',
        required: true,
        aliases: ['profession', 'job_title'],
      },
      {
        name: 'employer',
        description: 'Employer name',
        required: true,
        aliases: ['company', 'sponsor'],
      },
      {
        name: 'date_of_issue',
        description: 'Card issue date',
        required: false,
        pattern: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
        aliases: ['issue_date'],
      },
      {
        name: 'date_of_expiry',
        description: 'Card expiry date',
        required: true,
        pattern: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
        aliases: ['expiry_date'],
      },
    ],
    prompt: `Extract labor card/work permit information. Focus on:
- Employee name
- Card/Person code
- Occupation/Profession
- Employer details
- Issue and expiry dates`,
  },

  BANK_STATEMENT: {
    fields: [
      {
        name: 'account_holder',
        description: 'Account holder name',
        required: true,
        aliases: ['customer_name', 'name'],
      },
      { name: 'account_number', description: 'Account number', required: true },
      {
        name: 'iban',
        description: 'IBAN',
        required: false,
        pattern: /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/i,
      },
      { name: 'bank_name', description: 'Bank name', required: true },
      { name: 'statement_period', description: 'Statement period', required: false },
      { name: 'opening_balance', description: 'Opening balance', required: false },
      { name: 'closing_balance', description: 'Closing balance', required: false },
      { name: 'currency', description: 'Currency', required: false },
      { name: 'branch', description: 'Branch name', required: false },
    ],
    prompt: `Extract bank statement information. Focus on:
- Account holder name
- Account number and IBAN
- Bank name and branch
- Statement period
- Opening and closing balances
- Currency`,
  },

  ID_CARD: {
    fields: [
      {
        name: 'full_name',
        description: 'Full name on the card',
        required: true,
        aliases: ['name', 'holder_name'],
      },
      {
        name: 'surname',
        description: 'Family name / Surname / Last name',
        required: false,
        aliases: ['family_name', 'last_name'],
      },
      {
        name: 'given_names',
        description: 'Given names / First name(s)',
        required: false,
        aliases: ['first_name', 'first_names'],
      },
      {
        name: 'license_number',
        description: 'License or ID number',
        required: true,
        pattern: /^[A-Z0-9-]{5,20}$/i,
        aliases: ['id_number', 'card_number', 'dl_number', 'driver_license_number'],
      },
      {
        name: 'date_of_birth',
        description: 'Date of birth',
        required: true,
        pattern: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
        aliases: ['dob', 'birth_date'],
      },
      {
        name: 'date_of_expiry',
        description: 'Expiry date',
        required: true,
        pattern: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
        aliases: ['expiry_date', 'expiration_date', 'exp'],
      },
      {
        name: 'date_of_issue',
        description: 'Issue date',
        required: false,
        pattern: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
        aliases: ['issue_date', 'iss'],
      },
      {
        name: 'sex',
        description: 'Sex / Gender (M/F)',
        required: false,
        pattern: /^[MF]$/i,
        aliases: ['gender'],
      },
      {
        name: 'height',
        description: 'Height (cm or ft/in)',
        required: false,
        aliases: ['hgt', 'haut'],
      },
      {
        name: 'address',
        description: 'Address on the card',
        required: false,
        aliases: ['street_address', 'residence'],
      },
      { name: 'city', description: 'City', required: false },
      { name: 'province', description: 'Province / State', required: false, aliases: ['state'] },
      {
        name: 'postal_code',
        description: 'Postal / Zip code',
        required: false,
        aliases: ['zip_code', 'zip'],
      },
      {
        name: 'license_class',
        description: 'License class (G, G1, G2, A, B, C, etc.)',
        required: false,
        aliases: ['class', 'category', 'categ'],
      },
      {
        name: 'restrictions',
        description: 'Restrictions / Conditions',
        required: false,
        aliases: ['conditions', 'cond', 'rest'],
      },
      {
        name: 'issuing_authority',
        description: 'Issuing authority or jurisdiction',
        required: false,
        aliases: ['issuer', 'issued_by'],
      },
    ],
    prompt: `Extract driver's license or ID card information. This is a government-issued identification document.

IMPORTANT: Look at the IMAGE directly - the OCR text may be incomplete or garbled due to security patterns.

Focus on extracting these fields from the card:
- Full name (usually "NAME" or "NOM" field) - extract surname and given names separately if labeled
- License/ID number (typically a long alphanumeric code, often with dashes)
- Date of birth (DOB/DDN)
- Issue date (ISS)
- Expiry date (EXP)
- Sex/Gender (SEX)
- Height (HGT/HAUT)
- Address including city, province/state, postal code
- License class (CLASS/CATEG)
- Any restrictions or conditions

Common date formats: YYYY/MM/DD, DD/MM/YYYY, MM/DD/YYYY
Extract dates exactly as shown, preserving the format.`,
  },

  INVOICE: {
    fields: [
      {
        name: 'invoice_number',
        description: 'Invoice number',
        required: true,
        aliases: ['invoice_no', 'bill_number'],
      },
      {
        name: 'vendor_name',
        description: 'Vendor/Company name',
        required: true,
        aliases: ['company_name', 'from'],
      },
      {
        name: 'customer_name',
        description: 'Customer/Bill to name',
        required: false,
        aliases: ['bill_to', 'to'],
      },
      {
        name: 'invoice_date',
        description: 'Invoice date',
        required: true,
        pattern: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
        aliases: ['date'],
      },
      {
        name: 'due_date',
        description: 'Due date',
        required: false,
        pattern: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
      },
      {
        name: 'total_amount',
        description: 'Total amount',
        required: true,
        aliases: ['total', 'amount_due'],
      },
      { name: 'tax_amount', description: 'Tax/VAT amount', required: false, aliases: ['vat'] },
      { name: 'currency', description: 'Currency', required: false },
      { name: 'account_number', description: 'Account/Customer number', required: false },
    ],
    prompt: `Extract invoice/bill information. Focus on:
- Invoice/Bill number
- Vendor and customer names
- Invoice date and due date
- Total amount and tax
- Currency
- Account number if present`,
  },

  CONTRACT: {
    fields: [
      {
        name: 'contract_type',
        description: 'Type of contract',
        required: false,
        aliases: ['type'],
      },
      {
        name: 'party1_name',
        description: 'First party name',
        required: true,
        aliases: ['landlord', 'employer', 'seller'],
      },
      {
        name: 'party2_name',
        description: 'Second party name',
        required: true,
        aliases: ['tenant', 'employee', 'buyer'],
      },
      {
        name: 'contract_date',
        description: 'Contract date',
        required: false,
        pattern: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
        aliases: ['date', 'effective_date'],
      },
      {
        name: 'start_date',
        description: 'Start date',
        required: false,
        pattern: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
      },
      {
        name: 'end_date',
        description: 'End date',
        required: false,
        pattern: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
        aliases: ['expiry_date'],
      },
      {
        name: 'contract_value',
        description: 'Contract value/Amount',
        required: false,
        aliases: ['rent', 'salary', 'amount'],
      },
      {
        name: 'property_address',
        description: 'Property address (for tenancy)',
        required: false,
        aliases: ['address'],
      },
    ],
    prompt: `Extract contract information. Focus on:
- Contract type (Employment, Tenancy, Service, etc.)
- Party names (both parties)
- Contract dates (start, end, effective)
- Contract value/Amount
- Property address for tenancy contracts`,
  },
};

/**
 * Base extraction prompt template
 */
const BASE_EXTRACTION_PROMPT = `You are a document data extraction expert. Extract structured information from the provided document text.

IMPORTANT INSTRUCTIONS:
1. Extract all available fields with their exact values as they appear in the document
2. For each field, estimate your confidence (0-100) based on:
   - How clearly the value was found (higher for explicit labels)
   - Text quality and legibility
   - Pattern matching (dates, IDs, etc.)
3. If a field is not found or unclear, set value to null with low confidence
4. Preserve original formatting for dates and IDs
5. Include the raw text that was matched for each field

Respond with a JSON object where each key is a field name and the value is an object with:
- "value": the extracted value (string, number, or null)
- "confidence": 0-100 confidence score
- "rawText": the original text that was matched (optional)

Example response format:
{
  "full_name": {"value": "John Smith", "confidence": 95, "rawText": "Name: John Smith"},
  "date_of_birth": {"value": "1990-01-15", "confidence": 85, "rawText": "DOB: 15/01/1990"},
  "id_number": {"value": null, "confidence": 0}
}`;

// ============================================================================
// Pattern-Based Extraction Fallback
// ============================================================================

/**
 * Common extraction patterns for fallback
 */
const EXTRACTION_PATTERNS: Record<string, RegExp> = {
  // ID Patterns
  passport_number: /(?:passport\s*(?:no|number|#)?[:\s]*)?([A-Z]{0,2}[0-9]{6,9})/i,
  emirates_id: /(784-\d{4}-\d{7}-\d)/,
  visa_number: /(?:visa\s*(?:no|number)?[:\s]*)?(\d{10,})/i,
  license_number: /(?:license\s*(?:no|number)?[:\s]*)?([\w-]{5,20})/i,

  // Date Patterns
  date_of_birth:
    /(?:d\.?o\.?b\.?|date\s*of\s*birth|birth\s*date)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})/i,
  date_of_expiry:
    /(?:expir(?:y|es?|ation)|valid\s*until)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})/i,
  date_of_issue:
    /(?:issue\s*date|date\s*of\s*issue|issued)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})/i,

  // Name Patterns
  full_name: /(?:name|holder|applicant)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
  surname: /(?:surname|family\s*name|last\s*name)[:\s]*([A-Z][a-z]+)/i,
  given_names: /(?:given\s*name|first\s*name|forename)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,

  // Location/Nationality
  nationality: /(?:nationality|citizenship)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
  place_of_birth:
    /(?:place\s*of\s*birth|birth\s*place|born\s*in)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,

  // Business/Financial
  company_name: /(?:company|business|trade)\s*name[:\s]*([^\n]+)/i,
  account_number: /(?:account\s*(?:no|number)?)[:\s]*(\d{8,16})/i,
  iban: /\b([A-Z]{2}\d{2}[A-Z0-9]{10,30})\b/i,
  total_amount:
    /(?:total|amount\s*due|grand\s*total)[:\s]*([A-Z]{3}\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,

  // Gender
  sex: /(?:sex|gender)[:\s]*([MF]|male|female)/i,
};

// ============================================================================
// API Key Management
// ============================================================================

/**
 * Get available Gemini API key
 */
function getGeminiApiKey(): string {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_KEY,
  ].filter((k): k is string => !!k && k.length > 0);

  if (keys.length === 0) {
    throw new Error('No Gemini API key configured. Set GEMINI_API_KEY environment variable.');
  }

  return keys[0];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Truncate text to maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '\n... [truncated]';
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number): number {
  return BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
}

/**
 * Execute a promise with timeout
 * @throws Error if the promise doesn't resolve within the timeout
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

// ============================================================================
// Rate Limiting (Simple Semaphore)
// ============================================================================

/**
 * Simple semaphore for rate limiting concurrent operations
 */
class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

/**
 * Global semaphore for rate limiting Gemini API calls
 * Max 5 concurrent calls to prevent cost spikes
 */
const geminiSemaphore = new Semaphore(MAX_CONCURRENT_GEMINI_CALLS);

/**
 * Detect image MIME type from base64 string
 */
function detectImageMimeType(base64: string): string {
  if (base64.startsWith('data:image/png')) return 'image/png';
  if (base64.startsWith('data:image/gif')) return 'image/gif';
  if (base64.startsWith('data:image/webp')) return 'image/webp';
  if (base64.startsWith('data:image/jpeg') || base64.startsWith('data:image/jpg')) {
    return 'image/jpeg';
  }

  // Check magic bytes for raw base64
  const decoded = base64.substring(0, 50);
  if (decoded.startsWith('/9j/')) return 'image/jpeg';
  if (decoded.startsWith('iVBOR')) return 'image/png';
  if (decoded.startsWith('R0lGO')) return 'image/gif';
  if (decoded.startsWith('UklGR')) return 'image/webp';

  return 'image/jpeg'; // Default
}

/**
 * Build the extraction prompt for a specific category
 */
function buildExtractionPrompt(category: DocumentCategory): string {
  const config = EXTRACTION_CONFIGS[category];

  if (!config) {
    // Generic extraction for unknown categories
    return `${BASE_EXTRACTION_PROMPT}

Extract any identifiable information from this document including:
- Names, dates, ID numbers
- Addresses, phone numbers, email
- Amounts, quantities
- Any labeled fields`;
  }

  const fieldsDescription = config.fields
    .map((f) => `- ${f.name}: ${f.description}${f.required ? ' (REQUIRED)' : ''}`)
    .join('\n');

  return `${BASE_EXTRACTION_PROMPT}

${config.prompt}

Expected fields to extract:
${fieldsDescription}`;
}

// ============================================================================
// Zod Schema for Gemini Response Validation
// ============================================================================

/**
 * Schema for a single extracted field from Gemini
 */
const ExtractedFieldSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  confidence: z.number().min(0).max(100).optional(),
  rawText: z.string().optional(),
});

/**
 * Schema for the full Gemini extraction response
 * A record of field names to extracted field objects
 */
const GeminiExtractionSchema = z.record(z.string(), ExtractedFieldSchema);

/**
 * Parse and validate Gemini extraction response with Zod schema
 *
 * @param responseText - Raw text response from Gemini
 * @returns Validated GeminiExtractionResponse
 * @throws Error on JSON parse failure or schema validation failure
 */
function parseGeminiResponse(responseText: string): GeminiExtractionResponse {
  // Try to extract JSON from the response (handles markdown code blocks)
  const jsonMatch =
    responseText.match(/```(?:json)?\s*([\s\S]*?)```/) || responseText.match(/\{[\s\S]*\}/);

  let jsonStr: string;
  if (!jsonMatch) {
    logger.warn('No JSON found in Gemini response', {
      responseLength: responseText.length,
      responsePreview: responseText.substring(0, 200),
    });
    throw new Error('No JSON object found in Gemini response');
  }

  // Extract JSON string (handle markdown code block format)
  if (jsonMatch[1]) {
    // From markdown code block ```json ... ```
    jsonStr = jsonMatch[1].trim();
  } else {
    // Direct JSON object match
    jsonStr = jsonMatch[0].trim();
  }

  // Step 1: Parse as JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseError) {
    logger.warn('Malformed JSON in Gemini response', {
      error: parseError instanceof Error ? parseError.message : 'Unknown error',
      jsonPreview: jsonStr.substring(0, 200),
    });
    throw new Error(
      `Malformed JSON response from Gemini: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
    );
  }

  // Step 2: Validate with Zod schema
  try {
    const validated = GeminiExtractionSchema.parse(parsed);
    return validated as GeminiExtractionResponse;
  } catch (validationError) {
    if (validationError instanceof ZodError) {
      const fieldErrors = validationError.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      logger.warn('Schema validation failed for Gemini response', {
        fieldErrors,
        errorCount: fieldErrors.length,
      });
      throw new Error(
        `Schema validation failed for Gemini response: ${fieldErrors.map((e) => `${e.path}: ${e.message}`).join(', ')}`
      );
    }
    throw validationError;
  }
}

/**
 * Validate and boost confidence based on pattern matching
 */
function validateWithPattern(
  fieldName: string,
  value: string | number | boolean | null,
  category: DocumentCategory
): number {
  if (value === null || value === undefined) return 0;

  const valueStr = String(value);
  const config = EXTRACTION_CONFIGS[category];

  if (!config) return 0;

  const fieldConfig = config.fields.find(
    (f) => f.name === fieldName || f.aliases?.includes(fieldName)
  );

  if (!fieldConfig?.pattern) return 0;

  // Test if value matches expected pattern
  if (fieldConfig.pattern.test(valueStr)) {
    return PATTERN_VALIDATION_BOOST;
  }

  return 0;
}

/**
 * Convert Gemini response to ExtractedFieldResult format
 */
function convertToExtractedFields(
  geminiResponse: GeminiExtractionResponse,
  category: DocumentCategory
): Record<string, ExtractedFieldResult> {
  const result: Record<string, ExtractedFieldResult> = {};

  for (const [fieldName, fieldData] of Object.entries(geminiResponse)) {
    // Base confidence from Gemini
    let confidence = fieldData.confidence ?? 70;

    // Apply pattern validation boost
    const patternBoost = validateWithPattern(fieldName, fieldData.value, category);
    confidence = Math.min(100, confidence + patternBoost);

    result[fieldName] = {
      value: fieldData.value,
      confidence,
      source: 'llm' as const,
      rawText: fieldData.rawText,
    };
  }

  return result;
}

// ============================================================================
// Pattern-Based Extraction (Fallback)
// ============================================================================

/**
 * Extract data using pattern matching as fallback
 */
function extractWithPatterns(
  text: string,
  category: DocumentCategory
): Record<string, ExtractedFieldResult> {
  const result: Record<string, ExtractedFieldResult> = {};
  const config = EXTRACTION_CONFIGS[category];

  // Use category-specific fields if available
  const fieldsToExtract = config?.fields.map((f) => f.name) ?? Object.keys(EXTRACTION_PATTERNS);

  for (const fieldName of fieldsToExtract) {
    // Check if we have a pattern for this field
    const pattern = EXTRACTION_PATTERNS[fieldName];
    if (!pattern) continue;

    const match = text.match(pattern);
    if (match && match[1]) {
      const value = match[1].trim();

      // Calculate confidence based on pattern specificity
      let confidence = 70; // Base confidence for pattern match

      // Boost for exact label matches
      if (match[0].toLowerCase().includes(fieldName.replace(/_/g, ' '))) {
        confidence += 10;
      }

      // Boost for pattern validation
      const patternBoost = validateWithPattern(fieldName, value, category);
      confidence = Math.min(100, confidence + patternBoost);

      result[fieldName] = {
        value,
        confidence,
        source: 'pattern' as const,
        rawText: match[0],
      };
    }
  }

  return result;
}

/**
 * Extract key-value pairs from text
 */
function extractKeyValuePairs(text: string): Record<string, ExtractedFieldResult> {
  const result: Record<string, ExtractedFieldResult> = {};
  const keyValuePattern = /([A-Za-z\s]+)[:\s]+([^\n]+)/g;

  let match: RegExpExecArray | null;
  while ((match = keyValuePattern.exec(text)) !== null) {
    const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
    const value = match[2].trim();

    // Skip very short keys or values
    if (key.length < 2 || value.length < 2) continue;

    // Skip if already extracted by pattern
    if (result[key]) continue;

    result[key] = {
      value,
      confidence: 60, // Lower confidence for generic key-value extraction
      source: 'pattern' as const,
      rawText: match[0],
    };
  }

  return result;
}

// ============================================================================
// Merging Results
// ============================================================================

/**
 * Merge LLM and pattern results, keeping higher confidence values
 */
function mergeExtractionResults(
  llmResults: Record<string, ExtractedFieldResult>,
  patternResults: Record<string, ExtractedFieldResult>
): Record<string, ExtractedFieldResult> {
  const merged: Record<string, ExtractedFieldResult> = { ...llmResults };

  for (const [fieldName, patternField] of Object.entries(patternResults)) {
    const existingField = merged[fieldName];

    if (!existingField) {
      // Field not in LLM results, add pattern result
      merged[fieldName] = patternField;
    } else if (patternField.confidence > existingField.confidence) {
      // Pattern result has higher confidence
      merged[fieldName] = patternField;
    } else if (existingField.value === null && patternField.value !== null) {
      // LLM couldn't extract but pattern did
      merged[fieldName] = patternField;
    }
  }

  return merged;
}

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extract document data using Gemini AI with fallback to pattern matching
 *
 * @param text - Document text content (from OCR)
 * @param category - Document category for category-specific extraction
 * @param imageBase64 - Optional base64-encoded image for multi-modal extraction
 * @returns ExtractionResult with per-field confidence scores
 *
 * @example
 * ```typescript
 * const result = await extractDocumentData(
 *   "PASSPORT No: A12345678\nName: John Smith\nDOB: 01/01/1990",
 *   'PASSPORT'
 * );
 * console.log(result.fields.passport_number.value); // 'A12345678'
 * console.log(result.fields.passport_number.confidence); // 95
 * ```
 */
export async function extractDocumentData(
  text: string,
  category: DocumentCategory,
  imageBase64?: string
): Promise<ExtractionResult> {
  const startTime = Date.now();
  let modelUsed = 'pattern-fallback';
  let llmFields: Record<string, ExtractedFieldResult> = {};
  let geminiSucceeded = false;

  logger.info('Starting document data extraction', {
    category,
    textLength: text.length,
    hasImage: !!imageBase64,
  });

  // Try Gemini extraction with retries
  try {
    llmFields = await extractWithGemini(text, category, imageBase64);
    modelUsed = EXTRACTION_MODEL;
    geminiSucceeded = true;

    logger.info('Gemini extraction completed', {
      fieldsExtracted: Object.keys(llmFields).length,
    });
  } catch (error) {
    logger.warn('Gemini extraction failed, using pattern fallback', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Always run pattern extraction for validation and backup
  const patternFields = extractWithPatterns(text, category);
  const keyValueFields = extractKeyValuePairs(text);

  // Merge pattern results
  const allPatternFields = mergeExtractionResults(patternFields, keyValueFields);

  // Merge LLM and pattern results
  const mergedFields = geminiSucceeded
    ? mergeExtractionResults(llmFields, allPatternFields)
    : allPatternFields;

  // Count statistics
  const totalFields = Object.keys(mergedFields).length;
  const highConfidenceFields = Object.values(mergedFields).filter(
    (f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD
  ).length;
  const lowConfidenceFields = totalFields - highConfidenceFields;

  const processingTime = Date.now() - startTime;

  logger.info('Document extraction completed', {
    category,
    totalFields,
    highConfidenceFields,
    lowConfidenceFields,
    processingTimeMs: processingTime,
    modelUsed,
  });

  return {
    fields: mergedFields,
    documentCategory: category,
    rawText: text,
    processingTime,
    modelUsed,
  };
}

/**
 * Extract data using Gemini API with retry logic, timeout, and rate limiting
 */
async function extractWithGemini(
  text: string,
  category: DocumentCategory,
  imageBase64?: string
): Promise<Record<string, ExtractedFieldResult>> {
  // Use semaphore for rate limiting (max 5 concurrent calls)
  return geminiSemaphore.run(async () => {
    const apiKey = getGeminiApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model: GenerativeModel = genAI.getGenerativeModel({ model: EXTRACTION_MODEL });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Build content parts
        const parts: Part[] = [];
        const prompt = buildExtractionPrompt(category);
        const truncatedText = truncateText(text, MAX_TEXT_LENGTH);

        // If image provided, prioritize visual extraction (Gemini vision is better than OCR)
        if (imageBase64) {
          parts.push({
            text: `${prompt}\n\nPRIMARILY use the attached IMAGE for extraction. The text below may be incomplete.\n\nContext: ${truncatedText}`,
          });
        } else {
          parts.push({ text: `${prompt}\n\nDocument Text:\n${truncatedText}` });
        }

        // Add image if provided
        if (imageBase64) {
          const mimeType = detectImageMimeType(imageBase64);
          const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
          parts.push({
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          });
        }

        // Generate extraction with timeout (30 seconds)
        logger.debug('Starting Gemini extraction with timeout', {
          timeoutMs: GEMINI_TIMEOUT_MS,
          attempt: attempt + 1,
          category,
        });

        const result = await withTimeout(
          model.generateContent(parts),
          GEMINI_TIMEOUT_MS,
          'Gemini extraction'
        );
        const response = result.response;
        const responseText = response.text();

        // Parse and convert response
        const parsed = parseGeminiResponse(responseText);
        return convertToExtractedFields(parsed, category);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Check if this was a timeout error
        const isTimeout = lastError.message.includes('timed out');
        logger.warn(`Gemini extraction attempt ${attempt + 1} failed`, {
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          error: lastError.message,
          isTimeout,
        });

        // Don't retry on certain errors
        if (lastError.message.includes('API key')) {
          throw lastError;
        }

        // Wait before retry with exponential backoff
        if (attempt < MAX_RETRIES - 1) {
          const delay = getBackoffDelay(attempt);
          logger.debug(`Waiting ${delay}ms before retry`);
          await sleep(delay);
        }
      }
    }

    throw lastError ?? new Error('Gemini extraction failed after all retries');
  });
}

// ============================================================================
// Exports
// ============================================================================

export {
  EXTRACTION_CONFIGS,
  EXTRACTION_PATTERNS,
  LOW_CONFIDENCE_THRESHOLD,
  extractWithPatterns,
  mergeExtractionResults,
  validateWithPattern,
};

export default extractDocumentData;

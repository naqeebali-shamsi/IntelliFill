/**
 * Field Mapper Agent
 *
 * Canonicalizes extracted field names to standard schema fields.
 * Uses alias tables and semantic similarity for fuzzy matching.
 *
 * Features:
 * - Category-specific alias mappings
 * - Semantic similarity for fuzzy matching
 * - Confidence scoring based on match quality
 * - Tracking of unmapped fields for review
 *
 * @module multiagent/agents/mapperAgent
 */

import { DocumentCategory } from '../types/state';
import { ExtractedFieldResult } from '../../types/extractedData';
import { piiSafeLogger as logger } from '../../utils/piiSafeLogger';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Result from the field mapping process
 */
export interface MappingResult {
  /** Mapped fields with canonical names as keys */
  mappedFields: Record<string, string>;
  /** Field names that could not be mapped */
  unmappedFields: string[];
  /** Mapping of original field names to canonical names */
  aliasesUsed: Record<string, string>;
  /** Overall confidence score for the mapping (0-100) */
  confidence: number;
  /** Detailed mapping information */
  mappingDetails: MappingDetail[];
}

/**
 * Detailed information about a single field mapping
 */
export interface MappingDetail {
  /** Original field name from extraction */
  originalField: string;
  /** Canonical field name (or null if unmapped) */
  canonicalField: string | null;
  /** Extracted value */
  value: string | number | boolean | null;
  /** Mapping confidence (0-100) */
  confidence: number;
  /** How the mapping was determined */
  matchType: 'exact' | 'alias' | 'semantic' | 'pattern' | 'unmapped';
}

/**
 * Alias definition for field mapping
 */
interface FieldAlias {
  canonical: string;
  aliases: string[];
  patterns?: RegExp[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Confidence thresholds for different match types
 */
const CONFIDENCE = {
  EXACT_MATCH: 100,
  ALIAS_MATCH: 90,
  PATTERN_MATCH: 85,
  SEMANTIC_HIGH: 80,
  SEMANTIC_MEDIUM: 70,
  SEMANTIC_LOW: 60,
  NO_MATCH: 0,
} as const;

/**
 * Minimum semantic similarity score for a match
 */
const MIN_SEMANTIC_SIMILARITY = 0.6;

// ============================================================================
// Category-Specific Alias Tables
// ============================================================================

/**
 * Common field aliases shared across document types
 */
const COMMON_ALIASES: FieldAlias[] = [
  {
    canonical: 'full_name',
    aliases: [
      'name',
      'holder_name',
      'applicant_name',
      'customer_name',
      'account_holder',
      'employee_name',
      'person_name',
      'individual_name',
    ],
    patterns: [/^name$/i, /full\s*name/i, /holder/i],
  },
  {
    canonical: 'given_name',
    aliases: [
      'first_name',
      'given_names',
      'forename',
      'forenames',
      'christian_name',
    ],
    patterns: [/first\s*name/i, /given/i, /forename/i],
  },
  {
    canonical: 'family_name',
    aliases: [
      'last_name',
      'surname',
      'family',
      'family_names',
    ],
    patterns: [/last\s*name/i, /surname/i, /family/i],
  },
  {
    canonical: 'date_of_birth',
    aliases: [
      'dob',
      'birth_date',
      'birthdate',
      'd_o_b',
      'date_birth',
    ],
    patterns: [/d\.?o\.?b\.?/i, /birth.*date/i, /date.*birth/i],
  },
  {
    canonical: 'date_of_expiry',
    aliases: [
      'expiry_date',
      'expiration_date',
      'exp_date',
      'valid_until',
      'expires',
      'expiration',
    ],
    patterns: [/expir/i, /valid.*until/i],
  },
  {
    canonical: 'date_of_issue',
    aliases: [
      'issue_date',
      'issued_date',
      'issued',
      'issuance_date',
    ],
    patterns: [/issue/i, /issuance/i],
  },
  {
    canonical: 'nationality',
    aliases: [
      'citizenship',
      'country_of_citizenship',
      'nation',
    ],
    patterns: [/national/i, /citizen/i],
  },
  {
    canonical: 'gender',
    aliases: [
      'sex',
      'male_female',
      'm_f',
    ],
    patterns: [/^sex$/i, /gender/i],
  },
  {
    canonical: 'address',
    aliases: [
      'residential_address',
      'home_address',
      'mailing_address',
      'street_address',
    ],
    patterns: [/address/i],
  },
  {
    canonical: 'phone_number',
    aliases: [
      'phone',
      'telephone',
      'mobile',
      'mobile_number',
      'contact_number',
      'tel',
    ],
    patterns: [/phone/i, /mobile/i, /tel/i],
  },
  {
    canonical: 'email',
    aliases: [
      'email_address',
      'e_mail',
      'mail',
    ],
    patterns: [/e-?mail/i],
  },
];

/**
 * Passport-specific field aliases
 */
const PASSPORT_ALIASES: FieldAlias[] = [
  {
    canonical: 'passport_number',
    aliases: [
      'passport_no',
      'document_number',
      'doc_number',
      'pass_number',
      'passport_num',
    ],
    patterns: [/passport.*n(o|um)/i, /document.*n(o|um)/i],
  },
  {
    canonical: 'place_of_birth',
    aliases: [
      'birth_place',
      'birthplace',
      'pob',
      'born_in',
    ],
    patterns: [/place.*birth/i, /birth.*place/i, /born.*in/i],
  },
  {
    canonical: 'issuing_authority',
    aliases: [
      'issuing_country',
      'authority',
      'issued_by',
      'issuer',
    ],
    patterns: [/issuing/i, /issued.*by/i, /authority/i],
  },
  {
    canonical: 'mrz_line1',
    aliases: ['mrz1', 'machine_readable_zone_1'],
  },
  {
    canonical: 'mrz_line2',
    aliases: ['mrz2', 'machine_readable_zone_2'],
  },
];

/**
 * Emirates ID-specific field aliases
 */
const EMIRATES_ID_ALIASES: FieldAlias[] = [
  {
    canonical: 'emirates_id',
    aliases: [
      'eid',
      'id_number',
      'emirates_id_number',
      'uae_id',
      'resident_id',
    ],
    patterns: [/emirates.*id/i, /eid/i, /uae.*id/i],
  },
  {
    canonical: 'full_name_arabic',
    aliases: [
      'name_arabic',
      'arabic_name',
      'name_ar',
    ],
    patterns: [/arabic.*name/i, /name.*arabic/i, /name.*ar$/i],
  },
  {
    canonical: 'card_number',
    aliases: ['card_no', 'card_num'],
  },
];

/**
 * Visa-specific field aliases
 */
const VISA_ALIASES: FieldAlias[] = [
  {
    canonical: 'visa_number',
    aliases: [
      'visa_no',
      'permit_number',
      'entry_permit_number',
    ],
    patterns: [/visa.*n(o|um)/i, /permit.*n(o|um)/i],
  },
  {
    canonical: 'visa_type',
    aliases: [
      'type',
      'permit_type',
      'entry_type',
      'visa_category',
    ],
    patterns: [/visa.*type/i, /permit.*type/i],
  },
  {
    canonical: 'sponsor',
    aliases: [
      'sponsor_name',
      'employer',
      'employer_name',
      'company',
      'company_name',
    ],
    patterns: [/sponsor/i, /employer/i],
  },
  {
    canonical: 'profession',
    aliases: [
      'occupation',
      'job_title',
      'designation',
      'position',
    ],
    patterns: [/profession/i, /occupation/i, /job/i],
  },
  {
    canonical: 'file_number',
    aliases: ['file_no', 'file_num'],
  },
  {
    canonical: 'uid',
    aliases: ['unified_id', 'unified_number'],
  },
];

/**
 * Trade License-specific field aliases
 */
const TRADE_LICENSE_ALIASES: FieldAlias[] = [
  {
    canonical: 'license_number',
    aliases: [
      'license_no',
      'licence_number',
      'licence_no',
      'trade_license_number',
    ],
    patterns: [/licen[sc]e.*n(o|um)/i],
  },
  {
    canonical: 'company_name',
    aliases: [
      'business_name',
      'trade_name',
      'establishment_name',
      'firm_name',
    ],
    patterns: [/company/i, /business.*name/i, /trade.*name/i],
  },
  {
    canonical: 'company_name_arabic',
    aliases: [
      'business_name_arabic',
      'trade_name_arabic',
      'company_ar',
    ],
  },
  {
    canonical: 'license_type',
    aliases: ['type', 'licence_type'],
  },
  {
    canonical: 'activities',
    aliases: [
      'business_activities',
      'activity',
      'trade_activities',
    ],
  },
  {
    canonical: 'legal_form',
    aliases: [
      'legal_type',
      'company_type',
      'business_type',
    ],
  },
];

/**
 * Bank Statement-specific field aliases
 */
const BANK_STATEMENT_ALIASES: FieldAlias[] = [
  {
    canonical: 'account_number',
    aliases: [
      'account_no',
      'acc_number',
      'acc_no',
    ],
    patterns: [/account.*n(o|um)/i, /acc.*n(o|um)/i],
  },
  {
    canonical: 'iban',
    aliases: ['iban_number', 'international_bank_account_number'],
  },
  {
    canonical: 'bank_name',
    aliases: ['bank', 'financial_institution'],
  },
  {
    canonical: 'statement_period',
    aliases: ['period', 'statement_date_range'],
  },
  {
    canonical: 'opening_balance',
    aliases: ['beginning_balance', 'start_balance'],
  },
  {
    canonical: 'closing_balance',
    aliases: ['ending_balance', 'end_balance', 'final_balance'],
  },
  {
    canonical: 'currency',
    aliases: ['curr', 'ccy'],
  },
];

/**
 * Invoice-specific field aliases
 */
const INVOICE_ALIASES: FieldAlias[] = [
  {
    canonical: 'invoice_number',
    aliases: [
      'invoice_no',
      'inv_number',
      'inv_no',
      'bill_number',
      'bill_no',
    ],
    patterns: [/invoice.*n(o|um)/i, /bill.*n(o|um)/i],
  },
  {
    canonical: 'vendor_name',
    aliases: [
      'company_name',
      'from',
      'seller',
      'supplier',
    ],
  },
  {
    canonical: 'customer_name',
    aliases: [
      'bill_to',
      'to',
      'buyer',
      'client',
    ],
  },
  {
    canonical: 'invoice_date',
    aliases: ['date', 'bill_date'],
  },
  {
    canonical: 'due_date',
    aliases: ['payment_due', 'pay_by'],
  },
  {
    canonical: 'total_amount',
    aliases: [
      'total',
      'amount_due',
      'grand_total',
      'invoice_total',
    ],
    patterns: [/total/i, /amount.*due/i],
  },
  {
    canonical: 'tax_amount',
    aliases: ['vat', 'tax', 'vat_amount'],
  },
];

/**
 * Contract-specific field aliases
 */
const CONTRACT_ALIASES: FieldAlias[] = [
  {
    canonical: 'contract_type',
    aliases: ['type', 'agreement_type'],
  },
  {
    canonical: 'party1_name',
    aliases: [
      'first_party',
      'landlord',
      'employer',
      'seller',
      'lessor',
    ],
  },
  {
    canonical: 'party2_name',
    aliases: [
      'second_party',
      'tenant',
      'employee',
      'buyer',
      'lessee',
    ],
  },
  {
    canonical: 'contract_date',
    aliases: ['date', 'effective_date', 'agreement_date'],
  },
  {
    canonical: 'start_date',
    aliases: ['commencement_date', 'begins'],
  },
  {
    canonical: 'end_date',
    aliases: ['termination_date', 'expires', 'expiry_date'],
  },
  {
    canonical: 'contract_value',
    aliases: [
      'value',
      'amount',
      'rent',
      'salary',
      'price',
    ],
  },
  {
    canonical: 'property_address',
    aliases: ['premises', 'location', 'property'],
  },
];

/**
 * Labor Card-specific field aliases
 */
const LABOR_CARD_ALIASES: FieldAlias[] = [
  {
    canonical: 'card_number',
    aliases: [
      'work_card_number',
      'labor_card_number',
      'card_no',
    ],
  },
  {
    canonical: 'person_code',
    aliases: ['personal_code', 'employee_code'],
  },
  {
    canonical: 'occupation',
    aliases: [
      'profession',
      'job_title',
      'designation',
    ],
  },
  {
    canonical: 'employer',
    aliases: [
      'company',
      'sponsor',
      'employer_name',
    ],
  },
];

/**
 * Get aliases for a specific document category
 */
function getAliasesForCategory(category: DocumentCategory): FieldAlias[] {
  const categoryAliases: Partial<Record<DocumentCategory, FieldAlias[]>> = {
    PASSPORT: PASSPORT_ALIASES,
    EMIRATES_ID: EMIRATES_ID_ALIASES,
    VISA: VISA_ALIASES,
    TRADE_LICENSE: TRADE_LICENSE_ALIASES,
    BANK_STATEMENT: BANK_STATEMENT_ALIASES,
    INVOICE: INVOICE_ALIASES,
    CONTRACT: CONTRACT_ALIASES,
    LABOR_CARD: LABOR_CARD_ALIASES,
  };

  const specific = categoryAliases[category] || [];
  return [...COMMON_ALIASES, ...specific];
}

// ============================================================================
// Matching Functions
// ============================================================================

/**
 * Normalize a field name for comparison
 */
function normalizeFieldName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Check for exact or alias match
 */
function findAliasMatch(
  fieldName: string,
  aliases: FieldAlias[]
): { canonical: string; confidence: number; matchType: 'exact' | 'alias' | 'pattern' } | null {
  const normalized = normalizeFieldName(fieldName);

  for (const alias of aliases) {
    // Check exact match with canonical name
    if (normalizeFieldName(alias.canonical) === normalized) {
      return {
        canonical: alias.canonical,
        confidence: CONFIDENCE.EXACT_MATCH,
        matchType: 'exact',
      };
    }

    // Check alias matches
    for (const a of alias.aliases) {
      if (normalizeFieldName(a) === normalized) {
        return {
          canonical: alias.canonical,
          confidence: CONFIDENCE.ALIAS_MATCH,
          matchType: 'alias',
        };
      }
    }

    // Check pattern matches
    if (alias.patterns) {
      for (const pattern of alias.patterns) {
        if (pattern.test(fieldName)) {
          return {
            canonical: alias.canonical,
            confidence: CONFIDENCE.PATTERN_MATCH,
            matchType: 'pattern',
          };
        }
      }
    }
  }

  return null;
}

/**
 * Calculate semantic similarity between two strings
 * Uses Levenshtein distance normalized by string length
 */
function calculateSemanticSimilarity(str1: string, str2: string): number {
  const s1 = normalizeFieldName(str1);
  const s2 = normalizeFieldName(str2);

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    const containmentRatio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
    return 0.7 + containmentRatio * 0.2;
  }

  // Levenshtein distance
  const matrix: number[][] = [];

  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[s1.length][s2.length];
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - distance / maxLength;
}

/**
 * Find best semantic match for a field name
 */
function findSemanticMatch(
  fieldName: string,
  aliases: FieldAlias[]
): { canonical: string; confidence: number } | null {
  let bestMatch: { canonical: string; similarity: number } | null = null;

  for (const alias of aliases) {
    // Check similarity with canonical name
    const canonicalSimilarity = calculateSemanticSimilarity(fieldName, alias.canonical);
    if (canonicalSimilarity >= MIN_SEMANTIC_SIMILARITY) {
      if (!bestMatch || canonicalSimilarity > bestMatch.similarity) {
        bestMatch = { canonical: alias.canonical, similarity: canonicalSimilarity };
      }
    }

    // Check similarity with aliases
    for (const a of alias.aliases) {
      const similarity = calculateSemanticSimilarity(fieldName, a);
      if (similarity >= MIN_SEMANTIC_SIMILARITY) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { canonical: alias.canonical, similarity };
        }
      }
    }
  }

  if (!bestMatch) return null;

  // Convert similarity to confidence
  let confidence: number;
  if (bestMatch.similarity >= 0.9) {
    confidence = CONFIDENCE.SEMANTIC_HIGH;
  } else if (bestMatch.similarity >= 0.75) {
    confidence = CONFIDENCE.SEMANTIC_MEDIUM;
  } else {
    confidence = CONFIDENCE.SEMANTIC_LOW;
  }

  return { canonical: bestMatch.canonical, confidence };
}

// ============================================================================
// Main Mapping Function
// ============================================================================

/**
 * Map extracted fields to canonical field names
 *
 * @param extractedFields - Fields extracted from document
 * @param documentCategory - Category of the document for category-specific mappings
 * @returns MappingResult with mapped fields and metadata
 *
 * @example
 * ```typescript
 * const result = await mapExtractedFields(
 *   { first_name: { value: 'John', confidence: 90, source: 'llm' } },
 *   'PASSPORT'
 * );
 * console.log(result.mappedFields.given_name); // 'John'
 * console.log(result.aliasesUsed.first_name); // 'given_name'
 * ```
 */
export async function mapExtractedFields(
  extractedFields: Record<string, ExtractedFieldResult>,
  documentCategory: DocumentCategory
): Promise<MappingResult> {
  const startTime = Date.now();

  logger.info('Starting field mapping', {
    category: documentCategory,
    fieldCount: Object.keys(extractedFields).length,
  });

  const aliases = getAliasesForCategory(documentCategory);
  const mappedFields: Record<string, string> = {};
  const unmappedFields: string[] = [];
  const aliasesUsed: Record<string, string> = {};
  const mappingDetails: MappingDetail[] = [];

  let totalConfidence = 0;
  let mappedCount = 0;

  for (const [fieldName, fieldResult] of Object.entries(extractedFields)) {
    // Skip null values
    if (fieldResult.value === null || fieldResult.value === undefined) {
      continue;
    }

    let mapping: { canonical: string; confidence: number; matchType: 'exact' | 'alias' | 'pattern' | 'semantic' } | null = null;

    // Try alias match first
    const aliasMatch = findAliasMatch(fieldName, aliases);
    if (aliasMatch) {
      mapping = { ...aliasMatch, matchType: aliasMatch.matchType as 'exact' | 'alias' | 'pattern' };
    }

    // If no alias match, try semantic match
    if (!mapping) {
      const semanticMatch = findSemanticMatch(fieldName, aliases);
      if (semanticMatch) {
        mapping = { ...semanticMatch, matchType: 'semantic' };
      }
    }

    if (mapping) {
      // Store the mapping
      mappedFields[mapping.canonical] = String(fieldResult.value);
      aliasesUsed[fieldName] = mapping.canonical;

      mappingDetails.push({
        originalField: fieldName,
        canonicalField: mapping.canonical,
        value: fieldResult.value,
        confidence: mapping.confidence,
        matchType: mapping.matchType,
      });

      totalConfidence += mapping.confidence;
      mappedCount++;
    } else {
      // Field could not be mapped
      unmappedFields.push(fieldName);

      mappingDetails.push({
        originalField: fieldName,
        canonicalField: null,
        value: fieldResult.value,
        confidence: CONFIDENCE.NO_MATCH,
        matchType: 'unmapped',
      });
    }
  }

  // Calculate overall confidence
  const overallConfidence = mappedCount > 0
    ? Math.round(totalConfidence / mappedCount)
    : 0;

  const processingTimeMs = Date.now() - startTime;

  logger.info('Field mapping completed', {
    category: documentCategory,
    mappedCount,
    unmappedCount: unmappedFields.length,
    confidence: overallConfidence,
    processingTimeMs,
  });

  return {
    mappedFields,
    unmappedFields,
    aliasesUsed,
    confidence: overallConfidence,
    mappingDetails,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the canonical field name for a given field
 */
export function getCanonicalFieldName(
  fieldName: string,
  documentCategory: DocumentCategory
): string | null {
  const aliases = getAliasesForCategory(documentCategory);

  const aliasMatch = findAliasMatch(fieldName, aliases);
  if (aliasMatch) return aliasMatch.canonical;

  const semanticMatch = findSemanticMatch(fieldName, aliases);
  if (semanticMatch) return semanticMatch.canonical;

  return null;
}

/**
 * Check if a field name is a known canonical field
 */
export function isCanonicalField(
  fieldName: string,
  documentCategory: DocumentCategory
): boolean {
  const aliases = getAliasesForCategory(documentCategory);
  const normalized = normalizeFieldName(fieldName);

  return aliases.some(alias => normalizeFieldName(alias.canonical) === normalized);
}

/**
 * Get all canonical field names for a document category
 */
export function getCanonicalFieldsForCategory(
  documentCategory: DocumentCategory
): string[] {
  const aliases = getAliasesForCategory(documentCategory);
  return [...new Set(aliases.map(a => a.canonical))];
}

// ============================================================================
// Exports
// ============================================================================

export {
  COMMON_ALIASES,
  PASSPORT_ALIASES,
  EMIRATES_ID_ALIASES,
  VISA_ALIASES,
  TRADE_LICENSE_ALIASES,
  BANK_STATEMENT_ALIASES,
  INVOICE_ALIASES,
  CONTRACT_ALIASES,
  LABOR_CARD_ALIASES,
  getAliasesForCategory,
  normalizeFieldName,
  calculateSemanticSimilarity,
  CONFIDENCE as MAPPING_CONFIDENCE,
};

export default mapExtractedFields;

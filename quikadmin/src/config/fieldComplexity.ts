/**
 * Field Complexity Configuration - Phase 2.3
 *
 * Defines field complexity levels for smart model routing.
 * Routes simple fields to fast/cheap models, complex fields to powerful models.
 *
 * @module config/fieldComplexity
 */

import { DocumentCategory } from '../multiagent/types/state';
import { LLMProvider } from '../multiagent/llmClient';

// ============================================================================
// Field Complexity Classification
// ============================================================================

/**
 * Field complexity levels
 */
export type FieldComplexity = 'simple' | 'moderate' | 'complex' | 'specialized';

/**
 * Model selection based on complexity
 */
export interface ModelSelection {
  /** Preferred provider */
  provider: LLMProvider;
  /** Model tier */
  tier: 'fast' | 'default' | 'vision';
  /** Reason for selection */
  reason: string;
}

/**
 * Simple fields: Clear, structured, pattern-matchable
 * - Names, dates, basic IDs
 * - High pattern recognition success rate
 * - Fast models work well
 */
export const SIMPLE_FIELDS = new Set([
  'full_name',
  'first_name',
  'last_name',
  'surname',
  'given_names',
  'date_of_birth',
  'date_of_issue',
  'date_of_expiry',
  'expiry_date',
  'issue_date',
  'nationality',
  'gender',
  'sex',
  'passport_number',
  'card_number',
  'license_number',
  'invoice_number',
  'invoice_date',
  'due_date',
  'account_number',
  'bank_name',
  'currency',
]);

/**
 * Moderate fields: May have variations, need context
 * - Addresses, company names, descriptions
 * - May span multiple lines
 * - Default models work well
 */
export const MODERATE_FIELDS = new Set([
  'address',
  'street_address',
  'city',
  'state',
  'province',
  'postal_code',
  'zip_code',
  'company_name',
  'business_name',
  'trade_name',
  'vendor_name',
  'customer_name',
  'account_holder',
  'employer',
  'sponsor',
  'occupation',
  'profession',
  'job_title',
  'place_of_birth',
  'place_of_issue',
  'issuing_authority',
  'total_amount',
  'tax_amount',
  'opening_balance',
  'closing_balance',
]);

/**
 * Complex fields: Require understanding of context, structure
 * - Business activities, legal forms, multi-value fields
 * - Need more sophisticated models
 */
export const COMPLEX_FIELDS = new Set([
  'activities',
  'business_activities',
  'legal_form',
  'license_type',
  'visa_type',
  'contract_type',
  'party1_name',
  'party2_name',
  'contract_value',
  'property_address',
  'restrictions',
  'conditions',
  'license_class',
  'statement_period',
  'uid',
  'file_number',
  'person_code',
]);

/**
 * Specialized fields: Require specific expertise or visual analysis
 * - MRZ parsing, Arabic text, handwritten content
 * - May need vision models
 */
export const SPECIALIZED_FIELDS = new Set([
  'mrz_line1',
  'mrz_line2',
  'full_name_arabic',
  'company_name_arabic',
  'iban',
  'height',
]);

/**
 * Get complexity level for a field
 */
export function getFieldComplexity(fieldName: string): FieldComplexity {
  const normalized = fieldName.toLowerCase();

  if (SIMPLE_FIELDS.has(normalized)) return 'simple';
  if (MODERATE_FIELDS.has(normalized)) return 'moderate';
  if (COMPLEX_FIELDS.has(normalized)) return 'complex';
  if (SPECIALIZED_FIELDS.has(normalized)) return 'specialized';

  // Default to moderate for unknown fields
  return 'moderate';
}

/**
 * Get overall complexity for a set of fields
 */
export function getOverallComplexity(fieldNames: string[]): FieldComplexity {
  if (fieldNames.length === 0) return 'simple';

  const complexities = fieldNames.map(getFieldComplexity);

  // If any specialized, overall is specialized
  if (complexities.includes('specialized')) return 'specialized';

  // If any complex, overall is complex
  if (complexities.includes('complex')) return 'complex';

  // If majority is moderate, overall is moderate
  const moderateCount = complexities.filter((c) => c === 'moderate').length;
  if (moderateCount > complexities.length / 2) return 'moderate';

  return 'simple';
}

// ============================================================================
// Model Selection Logic
// ============================================================================

/**
 * Document category complexity scores
 * Higher score = more complex documents
 */
export const CATEGORY_COMPLEXITY: Record<DocumentCategory, number> = {
  PASSPORT: 70, // MRZ, multiple dates, security features
  EMIRATES_ID: 65, // Arabic text, standardized format
  VISA: 60, // Multiple fields, varied formats
  TRADE_LICENSE: 75, // Business activities, legal terms
  LABOR_CARD: 55, // Standardized format
  ESTABLISHMENT_CARD: 70, // Business document
  MOA: 90, // Complex legal document
  BANK_STATEMENT: 50, // Structured tabular data
  INVOICE: 45, // Standardized format
  CONTRACT: 85, // Complex legal text
  ID_CARD: 60, // Government document, various formats
  UNKNOWN: 80, // Unknown = be cautious
};

/**
 * Select optimal model based on extraction context
 *
 * Routing logic:
 * 1. Specialized fields → Claude Sonnet (best at complex reasoning)
 * 2. Complex documents with vision → Gemini Pro Vision
 * 3. Simple fields only → Gemini Flash (fast and cheap)
 * 4. Default → Gemini Pro
 *
 * @param fields - Fields to extract
 * @param category - Document category
 * @param hasImage - Whether image is available
 * @returns Model selection with reasoning
 */
export function selectOptimalModel(
  fields: string[],
  category: DocumentCategory,
  hasImage: boolean = false
): ModelSelection {
  const overallComplexity = getOverallComplexity(fields);
  const categoryScore = CATEGORY_COMPLEXITY[category] || 50;
  const hasSpecialized = fields.some((f) => SPECIALIZED_FIELDS.has(f.toLowerCase()));
  const hasArabic = fields.some((f) =>
    f.toLowerCase().includes('arabic') || f.toLowerCase().includes('name_ar')
  );
  const hasMRZ = fields.some((f) => f.toLowerCase().includes('mrz'));

  // Specialized fields needing Claude's reasoning
  if (hasSpecialized && (hasArabic || hasMRZ)) {
    return {
      provider: 'claude',
      tier: 'default',
      reason: 'Specialized fields (Arabic/MRZ) benefit from Claude reasoning',
    };
  }

  // High complexity document with image - use vision
  if (hasImage && (categoryScore >= 70 || overallComplexity === 'complex')) {
    return {
      provider: 'gemini',
      tier: 'vision',
      reason: 'Complex document with image benefits from vision model',
    };
  }

  // Complex fields needing deeper understanding
  if (overallComplexity === 'complex' || categoryScore >= 75) {
    return {
      provider: 'gemini',
      tier: 'default',
      reason: 'Complex extraction needs standard model',
    };
  }

  // Simple extraction - use fast model
  if (overallComplexity === 'simple' && categoryScore < 60) {
    return {
      provider: 'gemini',
      tier: 'fast',
      reason: 'Simple fields can use fast model for cost savings',
    };
  }

  // Default to standard Gemini
  return {
    provider: 'gemini',
    tier: 'default',
    reason: 'Standard model for balanced performance',
  };
}

// ============================================================================
// Cost Estimation
// ============================================================================

/**
 * Estimated tokens per field complexity
 */
const TOKENS_PER_FIELD: Record<FieldComplexity, { input: number; output: number }> = {
  simple: { input: 50, output: 20 },
  moderate: { input: 100, output: 40 },
  complex: { input: 200, output: 80 },
  specialized: { input: 300, output: 100 },
};

/**
 * Estimate token usage for extraction
 */
export function estimateTokenUsage(
  fields: string[],
  textLength: number
): { inputTokens: number; outputTokens: number } {
  // Base tokens for prompt template
  let inputTokens = 500;
  let outputTokens = 100;

  // Add tokens for document text (rough estimate: 4 chars = 1 token)
  inputTokens += Math.ceil(textLength / 4);

  // Add tokens per field
  for (const field of fields) {
    const complexity = getFieldComplexity(field);
    const fieldTokens = TOKENS_PER_FIELD[complexity];
    inputTokens += fieldTokens.input;
    outputTokens += fieldTokens.output;
  }

  return { inputTokens, outputTokens };
}

/**
 * Estimate cost for extraction in USD
 */
export function estimateCost(
  fields: string[],
  textLength: number,
  provider: LLMProvider
): number {
  const { inputTokens, outputTokens } = estimateTokenUsage(fields, textLength);

  // Cost per 1000 tokens (approximate)
  const costRates: Record<LLMProvider, { input: number; output: number }> = {
    gemini: { input: 0.000075, output: 0.0003 },
    claude: { input: 0.0008, output: 0.004 },
    openai: { input: 0.00015, output: 0.0006 },
  };

  const rates = costRates[provider];
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}

// ============================================================================
// Field Grouping for Batch Processing
// ============================================================================

/**
 * Group fields by complexity for optimized batch processing
 *
 * Strategy: Extract simple fields with fast model, complex with standard
 * Can reduce costs by 40-60% while maintaining accuracy
 */
export function groupFieldsByComplexity(
  fields: string[]
): Record<FieldComplexity, string[]> {
  const groups: Record<FieldComplexity, string[]> = {
    simple: [],
    moderate: [],
    complex: [],
    specialized: [],
  };

  for (const field of fields) {
    const complexity = getFieldComplexity(field);
    groups[complexity].push(field);
  }

  return groups;
}

/**
 * Determine if two-pass extraction would be cost-effective
 *
 * Two-pass strategy:
 * 1. First pass: Extract simple fields with fast model
 * 2. Second pass: Extract complex fields with standard model
 *
 * Benefits: 40-60% cost reduction for mixed complexity documents
 * Trade-off: Slightly higher latency (two API calls)
 */
export function shouldUseTwoPassExtraction(
  fields: string[],
  textLength: number
): boolean {
  const groups = groupFieldsByComplexity(fields);

  const simpleCount = groups.simple.length;
  const complexCount = groups.complex.length + groups.specialized.length;
  const totalCount = fields.length;

  // Use two-pass if:
  // 1. At least 5 fields total (worth the overhead)
  // 2. At least 40% simple fields
  // 3. At least 20% complex/specialized fields
  // 4. Document text is substantial (>1000 chars)
  return (
    totalCount >= 5 &&
    simpleCount / totalCount >= 0.4 &&
    complexCount / totalCount >= 0.2 &&
    textLength > 1000
  );
}

/**
 * Document Classifier Agent
 *
 * Uses Gemini API to classify document types in the multiagent pipeline.
 * Supports both text and image-based classification with confidence scoring.
 *
 * Features:
 * - Multi-modal classification (text + image)
 * - Confidence scoring with alternative types
 * - Pattern-based fallback when Gemini fails
 * - Metadata extraction (language, page count, photo detection)
 *
 * @module multiagent/agents/classifierAgent
 */

import { GoogleGenerativeAI, GenerativeModel, Part } from '@google/generative-ai';
import { DocumentCategory } from '../types/state';
import { piiSafeLogger as logger } from '../../utils/piiSafeLogger';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Classification result from the document classifier
 */
export interface ClassificationResult {
  documentType: DocumentCategory;
  confidence: number; // 0-100
  alternativeTypes?: Array<{ type: DocumentCategory; confidence: number }>;
  metadata?: {
    language?: string;
    pageCount?: number;
    hasPhoto?: boolean;
  };
}

/**
 * Internal type for Gemini classification response
 */
interface GeminiClassificationResponse {
  documentType: string;
  confidence: number;
  alternativeTypes?: Array<{ type: string; confidence: number }>;
  language?: string;
  hasPhoto?: boolean;
  reasoning?: string;
}

/**
 * Pattern matching rule for fallback classification
 */
interface ClassificationPattern {
  category: DocumentCategory;
  patterns: RegExp[];
  weight: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Valid document categories with their normalized names
 */
const VALID_CATEGORIES: DocumentCategory[] = [
  'PASSPORT',
  'EMIRATES_ID',
  'TRADE_LICENSE',
  'VISA',
  'LABOR_CARD',
  'ESTABLISHMENT_CARD',
  'MOA',
  'BANK_STATEMENT',
  'INVOICE',
  'CONTRACT',
  'ID_CARD',
  'UNKNOWN',
];

/**
 * Mapping from task requirement categories to state categories
 * Task mentions: passport, emirates_id, drivers_license, visa, bank_statement, utility_bill
 * State has: PASSPORT, EMIRATES_ID, VISA, BANK_STATEMENT, etc.
 */
const CATEGORY_ALIASES: Record<string, DocumentCategory> = {
  passport: 'PASSPORT',
  emirates_id: 'EMIRATES_ID',
  emiratesid: 'EMIRATES_ID',
  'emirates id': 'EMIRATES_ID',
  drivers_license: 'ID_CARD', // Map to generic ID_CARD
  'drivers license': 'ID_CARD',
  'driver license': 'ID_CARD',
  visa: 'VISA',
  bank_statement: 'BANK_STATEMENT',
  'bank statement': 'BANK_STATEMENT',
  utility_bill: 'INVOICE', // Map utility bills to INVOICE category
  'utility bill': 'INVOICE',
  trade_license: 'TRADE_LICENSE',
  'trade license': 'TRADE_LICENSE',
  labor_card: 'LABOR_CARD',
  'labor card': 'LABOR_CARD',
  establishment_card: 'ESTABLISHMENT_CARD',
  moa: 'MOA',
  memorandum: 'MOA',
  invoice: 'INVOICE',
  contract: 'CONTRACT',
  id_card: 'ID_CARD',
  'id card': 'ID_CARD',
  unknown: 'UNKNOWN',
};

/**
 * Pattern-based classification rules for fallback
 */
const CLASSIFICATION_PATTERNS: ClassificationPattern[] = [
  {
    category: 'PASSPORT',
    patterns: [
      /passport/i,
      /travel\s*document/i,
      /nationality/i,
      /place\s*of\s*birth/i,
      /date\s*of\s*expiry/i,
      /mrz|machine\s*readable/i,
      /p<[a-z]{3}/i, // MRZ line pattern
    ],
    weight: 1.0,
  },
  {
    category: 'EMIRATES_ID',
    patterns: [
      /emirates\s*id/i,
      /784-\d{4}-\d{7}-\d/i, // Emirates ID number format
      /federal\s*authority.*identity/i,
      /uae\s*id/i,
      /resident\s*identity/i,
    ],
    weight: 1.0,
  },
  {
    category: 'VISA',
    patterns: [
      /visa/i,
      /entry\s*permit/i,
      /residence\s*permit/i,
      /work\s*permit/i,
      /tourist\s*visa/i,
      /employment\s*visa/i,
      /gdrfa/i, // General Directorate of Residency and Foreigners Affairs
    ],
    weight: 1.0,
  },
  {
    category: 'TRADE_LICENSE',
    patterns: [
      /trade\s*license/i,
      /commercial\s*license/i,
      /business\s*license/i,
      /department\s*of\s*economic\s*development/i,
      /ded\s*license/i,
      /free\s*zone\s*license/i,
    ],
    weight: 1.0,
  },
  {
    category: 'LABOR_CARD',
    patterns: [
      /labor\s*card/i,
      /labour\s*card/i,
      /work\s*card/i,
      /ministry\s*of\s*(human\s*resources|labour)/i,
      /mohre/i, // Ministry of Human Resources and Emiratisation
    ],
    weight: 1.0,
  },
  {
    category: 'ESTABLISHMENT_CARD',
    patterns: [
      /establishment\s*card/i,
      /company\s*card/i,
      /corporate\s*card/i,
      /establishment\s*number/i,
    ],
    weight: 1.0,
  },
  {
    category: 'MOA',
    patterns: [
      /memorandum\s*of\s*association/i,
      /articles\s*of\s*association/i,
      /moa/i,
      /aoa/i,
      /incorporation/i,
      /shareholders?\s*agreement/i,
    ],
    weight: 0.9,
  },
  {
    category: 'BANK_STATEMENT',
    patterns: [
      /bank\s*statement/i,
      /account\s*statement/i,
      /transaction\s*history/i,
      /opening\s*balance/i,
      /closing\s*balance/i,
      /debit|credit/i,
      /iban/i,
      /swift/i,
    ],
    weight: 0.9,
  },
  {
    category: 'INVOICE',
    patterns: [
      /invoice/i,
      /bill/i,
      /utility/i,
      /electricity/i,
      /water/i,
      /telecommunications/i,
      /etisalat/i,
      /du\s*bill/i,
      /dewa/i, // Dubai Electricity and Water Authority
      /fewa/i, // Federal Electricity and Water Authority
      /amount\s*due/i,
      /total\s*amount/i,
    ],
    weight: 0.8,
  },
  {
    category: 'CONTRACT',
    patterns: [
      /contract/i,
      /agreement/i,
      /tenancy/i,
      /lease/i,
      /employment\s*contract/i,
      /service\s*agreement/i,
      /terms\s*and\s*conditions/i,
      /parties?\s*to\s*this/i,
    ],
    weight: 0.8,
  },
  {
    category: 'ID_CARD',
    patterns: [
      /identity\s*card/i,
      /id\s*card/i,
      /national\s*id/i,
      /driver'?s?\s*licen[sc]e/i,
      /driving\s*licen[sc]e/i,
      /rta/i, // Roads and Transport Authority
    ],
    weight: 0.7,
  },
];

/**
 * Classification prompt for Gemini
 */
const CLASSIFICATION_PROMPT = `You are a document classification expert. Analyze the provided document content and classify it into one of the following categories:

Categories:
- PASSPORT: Travel documents, passports (look for MRZ zones, nationality, place of birth)
- EMIRATES_ID: UAE Emirates ID cards (look for 784-XXXX-XXXXXXX-X format)
- VISA: Entry permits, residence permits, work permits
- TRADE_LICENSE: Business/commercial licenses
- LABOR_CARD: Work cards from Ministry of Labour
- ESTABLISHMENT_CARD: Company/corporate establishment cards
- MOA: Memorandum of Association, Articles of Association
- BANK_STATEMENT: Bank account statements with transactions
- INVOICE: Bills, invoices, utility bills
- CONTRACT: Legal contracts, agreements, tenancy contracts
- ID_CARD: General ID cards, driver's licenses
- UNKNOWN: Cannot determine document type

Analyze the text and/or image provided and respond with a JSON object in this exact format:
{
  "documentType": "CATEGORY_NAME",
  "confidence": 85,
  "alternativeTypes": [
    {"type": "OTHER_CATEGORY", "confidence": 10}
  ],
  "language": "detected_language",
  "hasPhoto": true,
  "reasoning": "Brief explanation of why this classification was chosen"
}

Important:
- Confidence should be 0-100 where 100 is absolute certainty
- Include up to 2 alternative types if confidence is below 90
- Detect the primary language of the document
- hasPhoto should be true if the document contains a photograph of a person
- Provide brief reasoning for your classification`;

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
    throw new Error(
      'No Gemini API key configured. Set GEMINI_API_KEY environment variable.'
    );
  }

  return keys[0];
}

// ============================================================================
// Main Classification Function
// ============================================================================

/**
 * Classify a document using Gemini AI with fallback to pattern matching
 *
 * @param text - Document text content
 * @param imageBase64 - Optional base64-encoded image data
 * @returns Classification result with confidence and alternatives
 *
 * @example
 * ```typescript
 * const result = await classifyDocument(
 *   "UNITED ARAB EMIRATES PASSPORT No: A12345678",
 *   imageBase64Data
 * );
 * console.log(result.documentType); // 'PASSPORT'
 * console.log(result.confidence); // 95
 * ```
 */
export async function classifyDocument(
  text: string,
  imageBase64?: string
): Promise<ClassificationResult> {
  const startTime = Date.now();

  logger.info('Starting document classification', {
    textLength: text.length,
    hasImage: !!imageBase64,
  });

  try {
    // Try Gemini classification first
    const result = await classifyWithGemini(text, imageBase64);

    logger.info('Classification completed via Gemini', {
      documentType: result.documentType,
      confidence: result.confidence,
      processingTimeMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    logger.warn('Gemini classification failed, using pattern fallback', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Fallback to pattern-based classification
    const fallbackResult = classifyWithPatterns(text);

    logger.info('Classification completed via pattern matching', {
      documentType: fallbackResult.documentType,
      confidence: fallbackResult.confidence,
      processingTimeMs: Date.now() - startTime,
    });

    return fallbackResult;
  }
}

// ============================================================================
// Gemini Classification
// ============================================================================

/**
 * Classify document using Gemini AI
 */
async function classifyWithGemini(
  text: string,
  imageBase64?: string
): Promise<ClassificationResult> {
  const apiKey = getGeminiApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);

  // Use gemini-1.5-flash for fast classification
  // Use vision model if image is provided
  const modelName = imageBase64 ? 'gemini-1.5-flash' : 'gemini-1.5-flash';
  const model: GenerativeModel = genAI.getGenerativeModel({ model: modelName });

  // Build content parts
  const parts: Part[] = [];

  // Add text content
  if (text && text.trim().length > 0) {
    parts.push({
      text: `${CLASSIFICATION_PROMPT}\n\nDocument Text:\n${truncateText(text, 4000)}`,
    });
  } else {
    parts.push({ text: CLASSIFICATION_PROMPT });
  }

  // Add image if provided
  if (imageBase64) {
    // Detect mime type from base64 header or default to jpeg
    const mimeType = detectImageMimeType(imageBase64);
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    parts.push({
      inlineData: {
        mimeType,
        data: cleanBase64,
      },
    });
  }

  // Generate classification
  const result = await model.generateContent(parts);
  const response = result.response;
  const responseText = response.text();

  // Parse JSON response
  const parsed = parseGeminiResponse(responseText);

  return {
    documentType: normalizeCategory(parsed.documentType),
    confidence: Math.min(100, Math.max(0, parsed.confidence)),
    alternativeTypes: parsed.alternativeTypes?.map((alt) => ({
      type: normalizeCategory(alt.type),
      confidence: Math.min(100, Math.max(0, alt.confidence)),
    })),
    metadata: {
      language: parsed.language,
      hasPhoto: parsed.hasPhoto,
    },
  };
}

/**
 * Parse Gemini response text to extract JSON
 */
function parseGeminiResponse(responseText: string): GeminiClassificationResponse {
  // Try to extract JSON from the response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('No JSON object found in Gemini response');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as GeminiClassificationResponse;

    // Validate required fields
    if (!parsed.documentType || typeof parsed.confidence !== 'number') {
      throw new Error('Invalid response structure: missing documentType or confidence');
    }

    return parsed;
  } catch (parseError) {
    throw new Error(
      `Failed to parse Gemini JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
    );
  }
}

/**
 * Normalize a category string to valid DocumentCategory
 */
function normalizeCategory(category: string): DocumentCategory {
  if (!category) return 'UNKNOWN';

  // Convert to uppercase for direct match
  const upper = category.toUpperCase().trim();

  // Check if it's already a valid category
  if (VALID_CATEGORIES.includes(upper as DocumentCategory)) {
    return upper as DocumentCategory;
  }

  // Check aliases (case-insensitive)
  const lower = category.toLowerCase().trim();
  if (lower in CATEGORY_ALIASES) {
    return CATEGORY_ALIASES[lower];
  }

  // Try fuzzy matching on aliases
  for (const [alias, cat] of Object.entries(CATEGORY_ALIASES)) {
    if (lower.includes(alias) || alias.includes(lower)) {
      return cat;
    }
  }

  return 'UNKNOWN';
}

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
  if (decoded.startsWith('/9j/')) return 'image/jpeg'; // JPEG magic bytes in base64
  if (decoded.startsWith('iVBOR')) return 'image/png'; // PNG magic bytes in base64
  if (decoded.startsWith('R0lGO')) return 'image/gif'; // GIF magic bytes in base64
  if (decoded.startsWith('UklGR')) return 'image/webp'; // WEBP magic bytes in base64

  return 'image/jpeg'; // Default
}

/**
 * Truncate text to specified length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '... [truncated]';
}

// ============================================================================
// Pattern-based Fallback Classification
// ============================================================================

/**
 * Classify document using pattern matching (fallback method)
 */
export function classifyWithPatterns(text: string): ClassificationResult {
  if (!text || text.trim().length === 0) {
    return {
      documentType: 'UNKNOWN',
      confidence: 0,
      metadata: {},
    };
  }

  const scores: Array<{ category: DocumentCategory; score: number; matches: number }> = [];

  for (const rule of CLASSIFICATION_PATTERNS) {
    let matchCount = 0;
    let totalWeight = 0;

    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        matchCount++;
        totalWeight += rule.weight;
      }
    }

    if (matchCount > 0) {
      // Calculate score based on match count and rule weight
      const score = (matchCount / rule.patterns.length) * rule.weight * 100;
      scores.push({
        category: rule.category,
        score: Math.min(score, 95), // Cap at 95 for pattern matching
        matches: matchCount,
      });
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  if (scores.length === 0) {
    return {
      documentType: 'UNKNOWN',
      confidence: 10, // Low confidence for no matches
      metadata: {},
    };
  }

  const primary = scores[0];
  const alternatives = scores.slice(1, 3).map((s) => ({
    type: s.category,
    confidence: Math.round(s.score),
  }));

  // Detect if document has photo-related content
  const hasPhoto = /photo|photograph|picture|image/i.test(text);

  // Simple language detection
  const language = detectLanguage(text);

  return {
    documentType: primary.category,
    confidence: Math.round(primary.score),
    alternativeTypes: alternatives.length > 0 ? alternatives : undefined,
    metadata: {
      language,
      hasPhoto,
    },
  };
}

/**
 * Simple language detection based on character patterns
 */
function detectLanguage(text: string): string {
  // Arabic characters
  if (/[\u0600-\u06FF]/.test(text)) {
    return 'ar';
  }

  // Chinese characters
  if (/[\u4e00-\u9fff]/.test(text)) {
    return 'zh';
  }

  // Hindi/Devanagari
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hi';
  }

  // Default to English
  return 'en';
}

// ============================================================================
// Exports
// ============================================================================

export {
  VALID_CATEGORIES,
  CATEGORY_ALIASES,
  CLASSIFICATION_PATTERNS,
  normalizeCategory,
  classifyWithPatterns as patternBasedClassify,
};

export default classifyDocument;

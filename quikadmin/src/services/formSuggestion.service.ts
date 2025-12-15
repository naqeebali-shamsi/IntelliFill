/**
 * Form Suggestion Service
 *
 * Provides intelligent form field suggestions by leveraging the knowledge base.
 * Implements requirements from PRD Vector Search v2.0:
 * - Task #140: Form Suggestion Service
 * - REQ-API-004: Implement form field suggestion API for auto-fill
 *
 * Features:
 * - Generate semantic queries from form field names
 * - Search knowledge base for relevant chunks
 * - Extract potential values using NLP patterns and regex
 * - Rank suggestions by confidence score
 * - Return top N suggestions per field
 *
 * @module services/formSuggestion.service
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { VectorStorageService, SearchResult, createVectorStorageService } from './vectorStorage.service';
import { EmbeddingService, getEmbeddingService } from './embedding.service';
import { SearchCacheService, getSearchCacheService } from './searchCache.service';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Input for requesting field suggestions
 */
export interface FieldSuggestionRequest {
  fieldName: string;
  fieldType?: 'text' | 'date' | 'email' | 'phone' | 'number' | 'address' | 'name';
  context?: string;
  formContext?: string;
}

/**
 * Single suggestion for a form field
 */
export interface FieldSuggestion {
  value: string;
  confidence: number;
  sourceChunkId: string;
  sourceTitle: string;
  extractionMethod: 'regex' | 'semantic' | 'context';
  matchedText?: string;
}

/**
 * Suggestions result for a single field
 */
export interface FieldSuggestionsResult {
  fieldName: string;
  suggestions: FieldSuggestion[];
  searchTime: number;
}

/**
 * Batch suggestions request
 */
export interface FormSuggestionsRequest {
  formId?: string;
  fieldNames: string[];
  fieldTypes?: Record<string, string>;
  context?: string;
  maxSuggestions?: number;
}

/**
 * Batch suggestions response
 */
export interface FormSuggestionsResponse {
  formId?: string;
  fields: Record<string, FieldSuggestion[]>;
  totalSearchTime: number;
  cacheHits: number;
}

/**
 * Pattern definition for field extraction
 */
interface ExtractionPattern {
  pattern: RegExp;
  extractGroup?: number;
  postProcess?: (value: string) => string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_SUGGESTIONS = 5;
const DEFAULT_MIN_CONFIDENCE = 0.3;
const SEMANTIC_SEARCH_TOP_K = 10;
const MIN_SIMILARITY_SCORE = 0.5;

/**
 * Field name to semantic query mappings
 * Helps generate better search queries from common field names
 */
const FIELD_QUERY_MAPPINGS: Record<string, string[]> = {
  // Personal Information
  'firstName': ['first name', 'given name', 'forename'],
  'lastName': ['last name', 'surname', 'family name'],
  'fullName': ['full name', 'complete name', 'name'],
  'middleName': ['middle name', 'middle initial'],
  'dateOfBirth': ['date of birth', 'DOB', 'birth date', 'birthday'],
  'dob': ['date of birth', 'DOB', 'birth date'],
  'birthDate': ['date of birth', 'birth date', 'birthday'],
  'age': ['age', 'years old'],
  'gender': ['gender', 'sex'],

  // Contact Information
  'email': ['email', 'e-mail', 'email address'],
  'phone': ['phone', 'telephone', 'phone number', 'mobile'],
  'mobile': ['mobile', 'cell phone', 'mobile number'],
  'fax': ['fax', 'fax number'],

  // Address
  'address': ['address', 'street address', 'residential address'],
  'street': ['street', 'street address', 'address line'],
  'addressLine1': ['address line 1', 'street address', 'address'],
  'addressLine2': ['address line 2', 'apartment', 'suite', 'unit'],
  'city': ['city', 'town', 'municipality'],
  'state': ['state', 'province', 'region'],
  'zipCode': ['zip code', 'postal code', 'zip'],
  'postalCode': ['postal code', 'zip code', 'postcode'],
  'country': ['country', 'nation'],

  // Identification
  'ssn': ['social security number', 'SSN', 'social security'],
  'socialSecurityNumber': ['social security number', 'SSN'],
  'taxId': ['tax ID', 'tax identification number', 'TIN', 'EIN'],
  'driverLicense': ['driver license', 'drivers license', 'DL number'],
  'passportNumber': ['passport number', 'passport'],
  'nationalId': ['national ID', 'ID number', 'identification number'],

  // Employment
  'employer': ['employer', 'company', 'organization', 'workplace'],
  'occupation': ['occupation', 'job title', 'position', 'profession'],
  'jobTitle': ['job title', 'position', 'role'],
  'department': ['department', 'division', 'unit'],
  'employeeId': ['employee ID', 'employee number', 'staff ID'],
  'salary': ['salary', 'income', 'wages', 'compensation'],
  'annualIncome': ['annual income', 'yearly salary', 'annual salary'],

  // Financial
  'bankName': ['bank name', 'financial institution', 'bank'],
  'accountNumber': ['account number', 'bank account', 'account no'],
  'routingNumber': ['routing number', 'ABA number', 'routing'],
  'creditCardNumber': ['credit card number', 'card number'],

  // Insurance
  'policyNumber': ['policy number', 'insurance policy', 'policy ID'],
  'groupNumber': ['group number', 'group ID'],
  'memberId': ['member ID', 'membership number', 'subscriber ID'],

  // Medical
  'diagnosis': ['diagnosis', 'medical condition', 'condition'],
  'medication': ['medication', 'prescription', 'medicine', 'drug'],
  'allergies': ['allergies', 'allergy', 'allergic to'],
  'bloodType': ['blood type', 'blood group'],
  'physician': ['physician', 'doctor', 'healthcare provider'],

  // Education
  'school': ['school', 'university', 'college', 'institution'],
  'degree': ['degree', 'qualification', 'certification'],
  'graduationDate': ['graduation date', 'graduated', 'completion date'],
  'major': ['major', 'field of study', 'specialization'],
  'gpa': ['GPA', 'grade point average', 'grades'],
};

/**
 * Extraction patterns for common field types
 */
const EXTRACTION_PATTERNS: Record<string, ExtractionPattern[]> = {
  email: [
    { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi },
  ],
  phone: [
    { pattern: /\b(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g },
    { pattern: /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g },
  ],
  date: [
    { pattern: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g },
    { pattern: /\b\d{4}-\d{2}-\d{2}\b/g },
    { pattern: /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/gi },
    { pattern: /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b/gi },
  ],
  ssn: [
    { pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g },
  ],
  zipCode: [
    { pattern: /\b\d{5}(?:-\d{4})?\b/g },
  ],
  number: [
    { pattern: /\b\d+(?:,\d{3})*(?:\.\d+)?\b/g },
  ],
  currency: [
    { pattern: /\$\s*\d+(?:,\d{3})*(?:\.\d{2})?\b/g },
    { pattern: /\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|dollars?)\b/gi },
  ],
  percentage: [
    { pattern: /\b\d+(?:\.\d+)?%/g },
  ],
};

// ============================================================================
// Form Suggestion Service Class
// ============================================================================

export class FormSuggestionService {
  private prisma: PrismaClient;
  private vectorStorage: VectorStorageService;
  private embeddingService: EmbeddingService;
  private searchCache: SearchCacheService;

  constructor(
    prisma: PrismaClient,
    vectorStorage?: VectorStorageService,
    embeddingService?: EmbeddingService,
    searchCache?: SearchCacheService
  ) {
    this.prisma = prisma;
    this.vectorStorage = vectorStorage || createVectorStorageService(prisma);
    this.embeddingService = embeddingService || getEmbeddingService();
    this.searchCache = searchCache || getSearchCacheService();
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Get suggestions for a single form field
   *
   * @param fieldRequest - Field suggestion request
   * @param organizationId - Organization UUID (REQUIRED)
   * @param maxSuggestions - Maximum suggestions to return
   * @returns Field suggestions result
   */
  async getFieldSuggestions(
    fieldRequest: FieldSuggestionRequest,
    organizationId: string,
    maxSuggestions: number = DEFAULT_MAX_SUGGESTIONS
  ): Promise<FieldSuggestionsResult> {
    const startTime = Date.now();

    if (!organizationId) {
      throw new Error('organizationId is REQUIRED for field suggestions');
    }

    const { fieldName, fieldType, context, formContext } = fieldRequest;

    // Generate semantic queries from field name
    const queries = this.generateSemanticQueries(fieldName, fieldType, context);

    // Search knowledge base
    const allSuggestions: FieldSuggestion[] = [];

    for (const query of queries) {
      try {
        const searchResults = await this.searchKnowledgeBase(
          query,
          organizationId,
          SEMANTIC_SEARCH_TOP_K
        );

        // Extract values from search results
        const suggestions = this.extractSuggestions(
          searchResults,
          fieldName,
          fieldType
        );

        allSuggestions.push(...suggestions);
      } catch (error) {
        logger.warn('Query failed during field suggestion', {
          query,
          fieldName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Deduplicate and rank suggestions
    const rankedSuggestions = this.rankAndDeduplicate(allSuggestions, maxSuggestions);

    const searchTime = Date.now() - startTime;

    logger.debug('Field suggestions generated', {
      fieldName,
      organizationId,
      suggestionsCount: rankedSuggestions.length,
      searchTime,
    });

    return {
      fieldName,
      suggestions: rankedSuggestions,
      searchTime,
    };
  }

  /**
   * Get suggestions for multiple form fields at once
   *
   * @param request - Form suggestions request
   * @param organizationId - Organization UUID (REQUIRED)
   * @returns Form suggestions response
   */
  async getFormSuggestions(
    request: FormSuggestionsRequest,
    organizationId: string
  ): Promise<FormSuggestionsResponse> {
    const startTime = Date.now();

    if (!organizationId) {
      throw new Error('organizationId is REQUIRED for form suggestions');
    }

    const { formId, fieldNames, fieldTypes, context, maxSuggestions } = request;
    const max = maxSuggestions || DEFAULT_MAX_SUGGESTIONS;

    const fields: Record<string, FieldSuggestion[]> = {};
    let cacheHits = 0;

    // Process fields in parallel for better performance
    const fieldPromises = fieldNames.map(async (fieldName) => {
      const fieldType = fieldTypes?.[fieldName] as FieldSuggestionRequest['fieldType'];

      // Check cache first
      const cacheKey = this.generateCacheKey(organizationId, fieldName, fieldType, context);
      const cached = await this.searchCache.get(cacheKey);

      if (cached && Array.isArray(cached)) {
        cacheHits++;
        return { fieldName, suggestions: cached as FieldSuggestion[] };
      }

      const result = await this.getFieldSuggestions(
        { fieldName, fieldType, context },
        organizationId,
        max
      );

      // Cache the results
      await this.searchCache.set(cacheKey, result.suggestions);

      return { fieldName, suggestions: result.suggestions };
    });

    const results = await Promise.all(fieldPromises);

    for (const result of results) {
      fields[result.fieldName] = result.suggestions;
    }

    const totalSearchTime = Date.now() - startTime;

    logger.info('Form suggestions generated', {
      formId,
      organizationId,
      fieldsCount: fieldNames.length,
      totalSearchTime,
      cacheHits,
    });

    return {
      formId,
      fields,
      totalSearchTime,
      cacheHits,
    };
  }

  /**
   * Get contextual suggestions based on surrounding field values
   *
   * @param fieldName - Field to get suggestions for
   * @param filledFields - Already filled field values
   * @param organizationId - Organization UUID
   * @param maxSuggestions - Maximum suggestions
   * @returns Field suggestions
   */
  async getContextualSuggestions(
    fieldName: string,
    filledFields: Record<string, string>,
    organizationId: string,
    maxSuggestions: number = DEFAULT_MAX_SUGGESTIONS
  ): Promise<FieldSuggestionsResult> {
    const startTime = Date.now();

    if (!organizationId) {
      throw new Error('organizationId is REQUIRED');
    }

    // Build context from filled fields
    const contextParts = Object.entries(filledFields)
      .filter(([_, value]) => value && value.trim())
      .map(([key, value]) => `${this.humanizeFieldName(key)}: ${value}`);

    const context = contextParts.join(', ');

    // Generate query with context
    const queries = this.generateSemanticQueries(fieldName, undefined, context);
    const allSuggestions: FieldSuggestion[] = [];

    for (const query of queries) {
      try {
        const searchResults = await this.searchKnowledgeBase(
          query,
          organizationId,
          SEMANTIC_SEARCH_TOP_K
        );

        const suggestions = this.extractSuggestions(
          searchResults,
          fieldName,
          undefined
        );

        allSuggestions.push(...suggestions);
      } catch (error) {
        logger.warn('Contextual query failed', {
          query,
          fieldName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const rankedSuggestions = this.rankAndDeduplicate(allSuggestions, maxSuggestions);
    const searchTime = Date.now() - startTime;

    return {
      fieldName,
      suggestions: rankedSuggestions,
      searchTime,
    };
  }

  // ==========================================================================
  // Private Methods - Query Generation
  // ==========================================================================

  /**
   * Generate semantic search queries from field name
   */
  private generateSemanticQueries(
    fieldName: string,
    fieldType?: string,
    context?: string
  ): string[] {
    const queries: string[] = [];

    // Normalize field name
    const normalizedName = this.normalizeFieldName(fieldName);

    // Get predefined mappings
    const mappings = FIELD_QUERY_MAPPINGS[normalizedName] ||
                     FIELD_QUERY_MAPPINGS[fieldName] ||
                     [];

    // Add mapped queries
    queries.push(...mappings);

    // Add humanized field name as query
    const humanized = this.humanizeFieldName(fieldName);
    if (!queries.includes(humanized)) {
      queries.push(humanized);
    }

    // Add context-enhanced queries
    if (context) {
      const topQuery = queries[0] || humanized;
      queries.unshift(`${topQuery} ${context}`);
    }

    // Add type-specific queries
    if (fieldType) {
      const typeQuery = this.getTypeSpecificQuery(fieldName, fieldType);
      if (typeQuery && !queries.includes(typeQuery)) {
        queries.push(typeQuery);
      }
    }

    // Ensure we have at least one query
    if (queries.length === 0) {
      queries.push(humanized);
    }

    // Limit queries to prevent excessive API calls
    return queries.slice(0, 3);
  }

  /**
   * Normalize field name to a standard format
   */
  private normalizeFieldName(fieldName: string): string {
    // Convert various formats to camelCase
    return fieldName
      .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
      .replace(/^(.)/, (c) => c.toLowerCase());
  }

  /**
   * Convert field name to human-readable format
   */
  private humanizeFieldName(fieldName: string): string {
    return fieldName
      // Insert space before capitals
      .replace(/([A-Z])/g, ' $1')
      // Replace underscores and hyphens with spaces
      .replace(/[-_]+/g, ' ')
      // Trim and lowercase
      .trim()
      .toLowerCase();
  }

  /**
   * Get type-specific query enhancement
   */
  private getTypeSpecificQuery(fieldName: string, fieldType: string): string | null {
    const humanized = this.humanizeFieldName(fieldName);

    switch (fieldType) {
      case 'date':
        return `date ${humanized}`;
      case 'email':
        return `email address`;
      case 'phone':
        return `phone number telephone`;
      case 'address':
        return `address location`;
      case 'number':
        return `${humanized} number amount`;
      default:
        return null;
    }
  }

  // ==========================================================================
  // Private Methods - Search
  // ==========================================================================

  /**
   * Search knowledge base using semantic search
   */
  private async searchKnowledgeBase(
    query: string,
    organizationId: string,
    topK: number
  ): Promise<SearchResult[]> {
    // Generate embedding for query
    const embeddingResult = await this.embeddingService.generateEmbedding(
      query,
      organizationId
    );

    // Search vector storage
    const results = await this.vectorStorage.searchSimilar(
      embeddingResult.embedding,
      organizationId,
      { topK, minScore: MIN_SIMILARITY_SCORE }
    );

    return results;
  }

  // ==========================================================================
  // Private Methods - Extraction
  // ==========================================================================

  /**
   * Extract suggestions from search results
   */
  private extractSuggestions(
    searchResults: SearchResult[],
    fieldName: string,
    fieldType?: string
  ): FieldSuggestion[] {
    const suggestions: FieldSuggestion[] = [];

    for (const result of searchResults) {
      // Try pattern-based extraction first
      const patternSuggestions = this.extractByPattern(result, fieldType);
      suggestions.push(...patternSuggestions);

      // Try semantic extraction
      const semanticSuggestions = this.extractBySemantic(result, fieldName);
      suggestions.push(...semanticSuggestions);

      // Try context-based extraction
      const contextSuggestions = this.extractByContext(result, fieldName);
      suggestions.push(...contextSuggestions);
    }

    return suggestions;
  }

  /**
   * Extract values using regex patterns
   */
  private extractByPattern(
    result: SearchResult,
    fieldType?: string
  ): FieldSuggestion[] {
    const suggestions: FieldSuggestion[] = [];

    if (!fieldType || !EXTRACTION_PATTERNS[fieldType]) {
      return suggestions;
    }

    const patterns = EXTRACTION_PATTERNS[fieldType];

    for (const { pattern, extractGroup, postProcess } of patterns) {
      const matches = result.text.match(pattern);

      if (matches) {
        for (const match of matches) {
          let value = extractGroup !== undefined
            ? match.replace(pattern, `$${extractGroup}`)
            : match;

          if (postProcess) {
            value = postProcess(value);
          }

          // Calculate confidence based on similarity and match quality
          const confidence = result.similarity * 0.9; // Slight penalty for pattern extraction

          suggestions.push({
            value: value.trim(),
            confidence,
            sourceChunkId: result.id,
            sourceTitle: result.sourceTitle,
            extractionMethod: 'regex',
            matchedText: result.text.substring(0, 100),
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Extract values using semantic understanding
   */
  private extractBySemantic(
    result: SearchResult,
    fieldName: string
  ): FieldSuggestion[] {
    const suggestions: FieldSuggestion[] = [];
    const humanizedField = this.humanizeFieldName(fieldName);

    // Look for patterns like "fieldName: value" or "fieldName is value"
    const semanticPatterns = [
      new RegExp(`${humanizedField}[:\\s]+([^\\n,;.]+)`, 'gi'),
      new RegExp(`([^\\n,;.]+)\\s+(?:is|are|was|were)\\s+(?:the\\s+)?${humanizedField}`, 'gi'),
    ];

    for (const pattern of semanticPatterns) {
      let match;
      while ((match = pattern.exec(result.text)) !== null) {
        const value = (match[1] || '').trim();

        if (value && value.length > 1 && value.length < 200) {
          const confidence = result.similarity * 0.85;

          suggestions.push({
            value,
            confidence,
            sourceChunkId: result.id,
            sourceTitle: result.sourceTitle,
            extractionMethod: 'semantic',
            matchedText: match[0].substring(0, 100),
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Extract values using context clues
   */
  private extractByContext(
    result: SearchResult,
    fieldName: string
  ): FieldSuggestion[] {
    const suggestions: FieldSuggestion[] = [];
    const normalizedName = this.normalizeFieldName(fieldName);

    // Common field-value associations
    const contextPatterns: Record<string, RegExp[]> = {
      firstName: [/(?:Mr|Mrs|Ms|Miss|Dr)\.?\s+(\w+)/gi, /(?:first\s+name|given\s+name)[:\s]+(\w+)/gi],
      lastName: [/(\w+)\s+(?:family|surname)/gi, /(?:last\s+name|surname)[:\s]+(\w+)/gi],
      city: [/(?:city\s+of\s+|in\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g],
      state: [/,\s*([A-Z]{2})\s+\d{5}/g, /(?:state)[:\s]+([A-Za-z\s]+)/gi],
      employer: [/(?:employed\s+(?:at|by)|works?\s+(?:at|for))\s+([^,.\n]+)/gi],
    };

    const patterns = contextPatterns[normalizedName] || [];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(result.text)) !== null) {
        const value = (match[1] || '').trim();

        if (value && value.length > 1 && value.length < 100) {
          const confidence = result.similarity * 0.75; // Lower confidence for context

          suggestions.push({
            value,
            confidence,
            sourceChunkId: result.id,
            sourceTitle: result.sourceTitle,
            extractionMethod: 'context',
            matchedText: match[0].substring(0, 100),
          });
        }
      }
    }

    return suggestions;
  }

  // ==========================================================================
  // Private Methods - Ranking
  // ==========================================================================

  /**
   * Rank and deduplicate suggestions
   */
  private rankAndDeduplicate(
    suggestions: FieldSuggestion[],
    maxResults: number
  ): FieldSuggestion[] {
    // Deduplicate by value (case-insensitive)
    const seen = new Map<string, FieldSuggestion>();

    for (const suggestion of suggestions) {
      const normalizedValue = suggestion.value.toLowerCase().trim();

      if (normalizedValue.length === 0) {
        continue;
      }

      // Skip if below minimum confidence
      if (suggestion.confidence < DEFAULT_MIN_CONFIDENCE) {
        continue;
      }

      const existing = seen.get(normalizedValue);

      if (!existing || existing.confidence < suggestion.confidence) {
        seen.set(normalizedValue, suggestion);
      }
    }

    // Convert to array and sort by confidence
    const deduped = Array.from(seen.values());
    deduped.sort((a, b) => b.confidence - a.confidence);

    // Return top N
    return deduped.slice(0, maxResults);
  }

  // ==========================================================================
  // Private Methods - Caching
  // ==========================================================================

  /**
   * Generate cache key for field suggestions
   */
  private generateCacheKey(
    organizationId: string,
    fieldName: string,
    fieldType?: string,
    context?: string
  ): string {
    const parts = [
      'suggest',
      organizationId,
      fieldName.toLowerCase(),
      fieldType || 'any',
    ];

    if (context) {
      // Hash context for shorter keys
      const contextHash = context.substring(0, 50).replace(/\s+/g, '_');
      parts.push(contextHash);
    }

    return parts.join(':');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let formSuggestionServiceInstance: FormSuggestionService | null = null;

/**
 * Get singleton FormSuggestionService instance
 */
export function getFormSuggestionService(prisma: PrismaClient): FormSuggestionService {
  if (!formSuggestionServiceInstance) {
    formSuggestionServiceInstance = new FormSuggestionService(prisma);
  }
  return formSuggestionServiceInstance;
}

/**
 * Create a new FormSuggestionService instance
 */
export function createFormSuggestionService(
  prisma: PrismaClient,
  vectorStorage?: VectorStorageService,
  embeddingService?: EmbeddingService,
  searchCache?: SearchCacheService
): FormSuggestionService {
  return new FormSuggestionService(prisma, vectorStorage, embeddingService, searchCache);
}

export default FormSuggestionService;

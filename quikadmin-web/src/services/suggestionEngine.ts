/**
 * Suggestion Engine Service
 *
 * Provides intelligent autocomplete suggestions from user profile data.
 * Ranks suggestions by field name similarity, confidence scores, and recency.
 *
 * @module services/suggestionEngine
 */

import api from './api';

/**
 * Profile field from backend API
 */
export interface ProfileField {
  key: string;
  values: string[];
  sourceCount: number;
  confidence: number;
  lastUpdated: string;
}

/**
 * User profile structure
 */
export interface UserProfile {
  userId: string;
  fields: ProfileField[];
  lastAggregated: string;
  documentCount: number;
}

/**
 * Autocomplete suggestion with ranking metadata
 */
export interface Suggestion {
  value: string;
  confidence: number;
  fieldKey: string;
  sourceCount: number;
  lastUpdated: Date;
  relevanceScore: number; // 0-100 ranking score
}

/**
 * Field type categorization
 */
export enum FieldType {
  TEXT = 'text',
  EMAIL = 'email',
  PHONE = 'phone',
  DATE = 'date',
  ADDRESS = 'address',
  SSN = 'ssn',
  NUMBER = 'number',
  UNKNOWN = 'unknown'
}

/**
 * Field name patterns for automatic type detection
 */
const FIELD_PATTERNS: Record<FieldType, RegExp[]> = {
  [FieldType.EMAIL]: [
    /email/i,
    /e[-_]?mail/i,
    /mail/i
  ],
  [FieldType.PHONE]: [
    /phone/i,
    /tel/i,
    /mobile/i,
    /cell/i,
    /fax/i
  ],
  [FieldType.DATE]: [
    /date/i,
    /birth/i,
    /dob/i,
    /day/i,
    /month/i,
    /year/i,
    /expire/i,
    /expiry/i
  ],
  [FieldType.ADDRESS]: [
    /address/i,
    /street/i,
    /city/i,
    /state/i,
    /zip/i,
    /postal/i,
    /country/i,
    /location/i
  ],
  [FieldType.SSN]: [
    /ssn/i,
    /social[-_]?security/i,
    /tax[-_]?id/i,
    /ein/i
  ],
  [FieldType.NUMBER]: [
    /number/i,
    /num/i,
    /id/i,
    /account/i,
    /reference/i,
    /ref/i
  ],
  [FieldType.TEXT]: [],
  [FieldType.UNKNOWN]: []
};

/**
 * Suggestion Engine
 *
 * Fetches user profile and provides ranked suggestions for form fields
 */
export class SuggestionEngine {
  private profileCache: UserProfile | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch user profile from API with caching
   */
  async getUserProfile(forceRefresh: boolean = false): Promise<UserProfile | null> {
    try {
      // Check cache validity
      const now = Date.now();
      const isCacheValid = this.profileCache && (now - this.cacheTimestamp) < this.CACHE_DURATION_MS;

      if (!forceRefresh && isCacheValid) {
        return this.profileCache;
      }

      // Fetch fresh profile data
      const response = await api.get('/users/me/profile');

      if (response.data.success && response.data.profile) {
        this.profileCache = response.data.profile;
        this.cacheTimestamp = now;
        return this.profileCache;
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      return null;
    }
  }

  /**
   * Detect field type from field name
   */
  detectFieldType(fieldName: string): FieldType {
    const normalizedName = fieldName.toLowerCase().trim();

    for (const [type, patterns] of Object.entries(FIELD_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedName)) {
          return type as FieldType;
        }
      }
    }

    return FieldType.TEXT;
  }

  /**
   * Calculate similarity score between two strings (0-100)
   * Uses Levenshtein distance and substring matching
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    // Exact match
    if (s1 === s2) return 100;

    // Substring match
    if (s1.includes(s2) || s2.includes(s1)) {
      const longer = Math.max(s1.length, s2.length);
      const shorter = Math.min(s1.length, s2.length);
      return Math.round((shorter / longer) * 90);
    }

    // Levenshtein distance
    const matrix: number[][] = [];
    const len1 = s1.length;
    const len2 = s2.length;

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (s1.charAt(i - 1) === s2.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    const distance = matrix[len1][len2];
    const maxLength = Math.max(len1, len2);
    return Math.round((1 - distance / maxLength) * 100);
  }

  /**
   * Calculate recency score based on last updated date (0-100)
   */
  private calculateRecencyScore(lastUpdated: Date): number {
    const now = new Date();
    const daysSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceUpdate < 7) return 100;      // Within a week
    if (daysSinceUpdate < 30) return 80;      // Within a month
    if (daysSinceUpdate < 90) return 60;      // Within 3 months
    if (daysSinceUpdate < 180) return 40;     // Within 6 months
    if (daysSinceUpdate < 365) return 20;     // Within a year
    return 10;                                 // Older than a year
  }

  /**
   * Calculate overall relevance score for a suggestion
   *
   * Factors:
   * - Field name similarity (40% weight)
   * - Confidence score (30% weight)
   * - Recency (20% weight)
   * - Source count (10% weight)
   */
  private calculateRelevanceScore(
    fieldNameSimilarity: number,
    confidence: number,
    recencyScore: number,
    sourceCount: number
  ): number {
    const maxSourceCount = 10; // Cap at 10 sources for scoring
    const sourceScore = Math.min(sourceCount / maxSourceCount, 1) * 100;

    const relevance =
      (fieldNameSimilarity * 0.4) +
      (confidence * 0.3) +
      (recencyScore * 0.2) +
      (sourceScore * 0.1);

    return Math.round(relevance);
  }

  /**
   * Get suggestions for a form field
   *
   * @param fieldName - Name or ID of the form field
   * @param fieldType - Type of field (auto-detected if not provided)
   * @param currentValue - Current value in the field (for filtering)
   * @param maxSuggestions - Maximum number of suggestions to return (default: 5)
   * @returns Array of ranked suggestions
   */
  async getSuggestions(
    fieldName: string,
    fieldType?: FieldType,
    currentValue?: string,
    maxSuggestions: number = 5
  ): Promise<Suggestion[]> {
    try {
      // Fetch profile
      const profile = await this.getUserProfile();
      if (!profile || !profile.fields || profile.fields.length === 0) {
        return [];
      }

      // Auto-detect field type if not provided
      const detectedType = fieldType || this.detectFieldType(fieldName);

      // Normalize field name for comparison
      const normalizedFieldName = fieldName.toLowerCase().replace(/[_\s-]+/g, '_');

      // Build suggestions from all profile fields
      const allSuggestions: Suggestion[] = [];

      for (const field of profile.fields) {
        // Calculate field name similarity
        const similarity = this.calculateSimilarity(normalizedFieldName, field.key);

        // Skip fields with very low similarity (< 20%)
        if (similarity < 20) continue;

        // Check if field type matches
        const fieldMatchesType = this.fieldMatchesType(field.key, detectedType);

        // Boost similarity for type matches
        const adjustedSimilarity = fieldMatchesType ? Math.min(similarity + 20, 100) : similarity;

        // Process each value in the field
        for (const value of field.values) {
          // Filter by current value if provided
          if (currentValue && currentValue.length > 0) {
            const valueLower = value.toLowerCase();
            const currentLower = currentValue.toLowerCase();

            // Only include if value starts with or contains current input
            if (!valueLower.startsWith(currentLower) && !valueLower.includes(currentLower)) {
              continue;
            }
          }

          // Calculate scores
          const lastUpdated = new Date(field.lastUpdated);
          const recencyScore = this.calculateRecencyScore(lastUpdated);
          const relevanceScore = this.calculateRelevanceScore(
            adjustedSimilarity,
            field.confidence,
            recencyScore,
            field.sourceCount
          );

          allSuggestions.push({
            value,
            confidence: field.confidence,
            fieldKey: field.key,
            sourceCount: field.sourceCount,
            lastUpdated,
            relevanceScore
          });
        }
      }

      // Sort by relevance score (descending)
      allSuggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Remove duplicates (keep highest ranked)
      const uniqueSuggestions = this.removeDuplicates(allSuggestions);

      // Return top N suggestions
      return uniqueSuggestions.slice(0, maxSuggestions);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  }

  /**
   * Check if a field key matches a specific field type
   */
  private fieldMatchesType(fieldKey: string, fieldType: FieldType): boolean {
    const patterns = FIELD_PATTERNS[fieldType];
    if (!patterns || patterns.length === 0) return true;

    return patterns.some(pattern => pattern.test(fieldKey));
  }

  /**
   * Remove duplicate suggestions (case-insensitive)
   */
  private removeDuplicates(suggestions: Suggestion[]): Suggestion[] {
    const seen = new Set<string>();
    const unique: Suggestion[] = [];

    for (const suggestion of suggestions) {
      const key = suggestion.value.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(suggestion);
      }
    }

    return unique;
  }

  /**
   * Get confidence level label
   */
  getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= 80) return 'high';
    if (confidence >= 50) return 'medium';
    return 'low';
  }

  /**
   * Clear profile cache (useful for testing or after profile updates)
   */
  clearCache(): void {
    this.profileCache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Refresh profile cache
   */
  async refreshProfile(): Promise<UserProfile | null> {
    return this.getUserProfile(true);
  }
}

// Singleton instance
let suggestionEngineInstance: SuggestionEngine | null = null;

/**
 * Get singleton instance of SuggestionEngine
 */
export function getSuggestionEngine(): SuggestionEngine {
  if (!suggestionEngineInstance) {
    suggestionEngineInstance = new SuggestionEngine();
  }
  return suggestionEngineInstance;
}

export default SuggestionEngine;

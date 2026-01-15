/**
 * ID Number Matching Utilities for Entity Resolution
 *
 * Provides functions for normalizing and comparing ID numbers
 * (Emirates ID, Passport, Driver's License) to determine if
 * they likely belong to the same person.
 *
 * @module lib/entity-resolution/idMatcher
 */

/**
 * Result of comparing two ID numbers
 */
export interface IdMatchResult {
  /** Whether the IDs are considered a match */
  match: boolean;
  /** Confidence level of the match (0.0 to 1.0) */
  confidence: number;
  /** Human-readable explanation of the match result */
  reason: string;
}

/**
 * Normalize an ID number for comparison
 *
 * - Converts to uppercase
 * - Removes dashes, spaces, and non-alphanumeric characters
 *
 * @param id - The ID number to normalize
 * @returns Normalized ID string
 *
 * @example
 * normalizeId("784-1990-1234567-8")  // "784199012345678"
 * normalizeId("AB 123-456")          // "AB123456"
 */
export function normalizeId(id: string): string {
  if (!id) return '';
  return id.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Compare two ID numbers and determine if they match
 *
 * Matching tiers:
 * - Exact match (1.0 confidence) - IDs are identical after normalization
 * - Partial/substring match (0.85 confidence) - One ID contains the other (OCR truncation)
 * - Prefix match (0.7 confidence) - First 7+ characters match (Emirates ID structure)
 * - No match (0.0 confidence) - IDs don't appear to match
 *
 * @param id1 - First ID number to compare
 * @param id2 - Second ID number to compare
 * @returns Match result with confidence and reason
 *
 * @example
 * compareIds("784-1990-1234567-8", "78419901234567 8")  // { match: true, confidence: 1.0, reason: "Exact ID match" }
 * compareIds("784199012", "78419901234567")            // { match: true, confidence: 0.85, reason: "Partial ID match..." }
 */
export function compareIds(id1: string, id2: string): IdMatchResult {
  const n1 = normalizeId(id1);
  const n2 = normalizeId(id2);

  // Handle empty IDs
  if (!n1 || !n2) {
    return {
      match: false,
      confidence: 0,
      reason: 'One or both IDs are empty',
    };
  }

  // Tier 1: Exact match after normalization
  if (n1 === n2) {
    return {
      match: true,
      confidence: 1.0,
      reason: 'Exact ID match',
    };
  }

  // Tier 2: Partial/substring match (OCR may have truncated one)
  // Require at least 6 characters for meaningful comparison
  if (n1.length >= 6 && n2.length >= 6) {
    if (n1.includes(n2) || n2.includes(n1)) {
      return {
        match: true,
        confidence: 0.85,
        reason: 'Partial ID match - likely OCR truncation',
      };
    }
  }

  // Tier 3: Prefix match (Emirates ID format: 784-YYYY-NNNNNNN-C)
  // First 7 chars include country code (784) + birth year
  if (n1.length >= 7 && n2.length >= 7) {
    if (n1.substring(0, 7) === n2.substring(0, 7)) {
      return {
        match: true,
        confidence: 0.7,
        reason: 'ID prefix match - verify manually',
      };
    }
  }

  // Tier 4: No match
  return {
    match: false,
    confidence: 0,
    reason: 'No ID match',
  };
}

/**
 * Check if an ID appears to be an Emirates ID
 *
 * Emirates ID format: 784-YYYY-NNNNNNN-C (15 digits total)
 * - 784: UAE country code
 * - YYYY: Birth year
 * - NNNNNNN: Unique number
 * - C: Check digit
 *
 * @param id - The ID to check
 * @returns True if the ID appears to be an Emirates ID
 */
export function isEmiratesId(id: string): boolean {
  const normalized = normalizeId(id);
  // Emirates ID is 15 digits starting with 784
  return /^784\d{12}$/.test(normalized);
}

/**
 * Check if an ID appears to be a passport number
 *
 * Passport numbers typically:
 * - Are 6-9 characters
 * - May start with letters (country code) followed by numbers
 * - Don't start with 784 (that's Emirates ID)
 *
 * @param id - The ID to check
 * @returns True if the ID appears to be a passport number
 */
export function isPassportNumber(id: string): boolean {
  const normalized = normalizeId(id);
  // Passport numbers are typically 6-9 chars, may have letters
  // Exclude Emirates IDs (start with 784 and are 15 digits)
  if (normalized.startsWith('784') && normalized.length === 15) {
    return false;
  }
  return normalized.length >= 6 && normalized.length <= 9;
}

/**
 * Extract the year portion from an Emirates ID
 *
 * @param emiratesId - The Emirates ID
 * @returns The birth year, or null if not a valid Emirates ID
 */
export function extractBirthYearFromEmiratesId(emiratesId: string): number | null {
  const normalized = normalizeId(emiratesId);
  if (!isEmiratesId(normalized)) return null;

  const yearStr = normalized.substring(3, 7);
  const year = parseInt(yearStr, 10);

  // Sanity check: year should be reasonable (1900-2025)
  if (year >= 1900 && year <= new Date().getFullYear()) {
    return year;
  }

  return null;
}

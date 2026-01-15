/**
 * Person Matching Utilities for Entity Resolution
 *
 * High-level utilities for determining if documents belong to the same person.
 * Uses name similarity and ID matching to produce match recommendations.
 *
 * @module lib/entity-resolution/personMatcher
 */

/**
 * Confidence thresholds for grouping decisions
 *
 * These thresholds determine the suggested action based on match confidence:
 * - AUTO_GROUP (0.95+): High confidence, automatically group documents
 * - SUGGEST_GROUP (0.85-0.95): Medium confidence, suggest grouping to user
 * - REVIEW (0.70-0.85): Low confidence, show for manual review
 * - Below 0.70: Keep documents separate by default
 */
export const MATCH_THRESHOLDS = {
  /** Auto-group if confidence >= 0.95 */
  AUTO_GROUP: 0.95,
  /** Suggest grouping if confidence >= 0.85 */
  SUGGEST_GROUP: 0.85,
  /** Show for review if confidence >= 0.70 */
  REVIEW: 0.7,
} as const;

/**
 * Types of matches that can be detected
 */
export type MatchType =
  | 'exact_id' // Exact ID number match
  | 'high_similarity' // High name similarity score
  | 'partial' // Moderate similarity, needs review
  | 'no_match'; // Low or no similarity

/**
 * Suggested action based on match result
 */
export type SuggestedAction =
  | 'auto_group' // Automatically group documents
  | 'suggest' // Suggest grouping to user
  | 'keep_separate'; // Keep documents separate

/**
 * Result of matching two documents/persons
 */
export interface MatchResult {
  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
  /** Type of match detected */
  matchType: MatchType;
  /** Recommended action for the user */
  suggestedAction: SuggestedAction;
  /** Optional explanation for the match */
  reason?: string;
}

/**
 * Get the suggested action based on confidence score
 *
 * @param confidence - Match confidence (0.0 to 1.0)
 * @returns The suggested action
 */
export function getSuggestedAction(confidence: number): SuggestedAction {
  if (confidence >= MATCH_THRESHOLDS.AUTO_GROUP) {
    return 'auto_group';
  }
  if (confidence >= MATCH_THRESHOLDS.SUGGEST_GROUP) {
    return 'suggest';
  }
  return 'keep_separate';
}

/**
 * Get the match type based on confidence score
 *
 * @param confidence - Match confidence (0.0 to 1.0)
 * @param hasExactIdMatch - Whether there was an exact ID match
 * @returns The match type
 */
export function getMatchType(confidence: number, hasExactIdMatch: boolean = false): MatchType {
  if (hasExactIdMatch && confidence >= MATCH_THRESHOLDS.AUTO_GROUP) {
    return 'exact_id';
  }
  if (confidence >= MATCH_THRESHOLDS.AUTO_GROUP) {
    return 'high_similarity';
  }
  if (confidence >= MATCH_THRESHOLDS.REVIEW) {
    return 'partial';
  }
  return 'no_match';
}

/**
 * Create a MatchResult from a confidence score
 *
 * @param confidence - Match confidence (0.0 to 1.0)
 * @param hasExactIdMatch - Whether there was an exact ID match
 * @param reason - Optional explanation
 * @returns Complete match result
 */
export function createMatchResult(
  confidence: number,
  hasExactIdMatch: boolean = false,
  reason?: string
): MatchResult {
  return {
    confidence,
    matchType: getMatchType(confidence, hasExactIdMatch),
    suggestedAction: getSuggestedAction(confidence),
    reason,
  };
}

/**
 * Check if a match result indicates the documents should be grouped
 *
 * @param result - The match result to check
 * @returns True if documents should be grouped (auto or suggested)
 */
export function shouldGroup(result: MatchResult): boolean {
  return result.suggestedAction === 'auto_group' || result.suggestedAction === 'suggest';
}

/**
 * Check if a match result needs user review
 *
 * @param result - The match result to check
 * @returns True if the match needs user confirmation
 */
export function needsReview(result: MatchResult): boolean {
  return result.suggestedAction === 'suggest';
}

/**
 * Get a human-readable description of a match type
 *
 * @param matchType - The match type
 * @returns Human-readable description
 */
export function getMatchTypeDescription(matchType: MatchType): string {
  switch (matchType) {
    case 'exact_id':
      return 'Exact ID match';
    case 'high_similarity':
      return 'High name similarity';
    case 'partial':
      return 'Partial match - needs review';
    case 'no_match':
      return 'No match detected';
    default:
      return 'Unknown match type';
  }
}

/**
 * Get a human-readable description of a suggested action
 *
 * @param action - The suggested action
 * @returns Human-readable description
 */
export function getActionDescription(action: SuggestedAction): string {
  switch (action) {
    case 'auto_group':
      return 'Documents automatically grouped';
    case 'suggest':
      return 'Suggested to group - please confirm';
    case 'keep_separate':
      return 'Keeping documents separate';
    default:
      return 'Unknown action';
  }
}

/**
 * Compare two confidence scores and return the higher one
 * Useful when combining multiple matching strategies
 *
 * @param conf1 - First confidence score
 * @param conf2 - Second confidence score
 * @returns The higher confidence score
 */
export function maxConfidence(conf1: number, conf2: number): number {
  return Math.max(conf1, conf2);
}

/**
 * Combine multiple confidence scores using weighted average
 *
 * @param scores - Array of { confidence, weight } objects
 * @returns Combined confidence score
 */
export function combineConfidences(scores: Array<{ confidence: number; weight: number }>): number {
  if (scores.length === 0) return 0;

  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedSum = scores.reduce((sum, s) => sum + s.confidence * s.weight, 0);
  return weightedSum / totalWeight;
}

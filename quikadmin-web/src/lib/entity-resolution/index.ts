/**
 * Entity Resolution Utilities
 *
 * Exports all entity resolution utilities for detecting when documents
 * belong to the same person based on name similarity and ID matching.
 *
 * @module lib/entity-resolution
 */

// Name similarity utilities
export {
  normalizeName,
  areTransliterationVariants,
  getCanonicalForm,
  canonicalizeName,
  TRANSLITERATION_MAP,
} from './nameSimilarity';

// ID matching utilities
export {
  normalizeId,
  compareIds,
  isEmiratesId,
  isPassportNumber,
  extractBirthYearFromEmiratesId,
  type IdMatchResult,
} from './idMatcher';

// Person matching utilities
export {
  MATCH_THRESHOLDS,
  getSuggestedAction,
  getMatchType,
  createMatchResult,
  shouldGroup,
  needsReview,
  getMatchTypeDescription,
  getActionDescription,
  maxConfidence,
  combineConfidences,
  type MatchType,
  type SuggestedAction,
  type MatchResult,
} from './personMatcher';

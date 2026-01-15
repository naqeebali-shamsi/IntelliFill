/**
 * Person Grouping Service
 *
 * Backend service for entity resolution using fuzzball (Jaro-Winkler).
 * Detects when uploaded documents belong to different people and
 * automatically suggests groupings based on name similarity and ID matching.
 *
 * @module services/PersonGroupingService
 */

import * as fuzzball from 'fuzzball';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Document extraction data for grouping analysis
 */
export interface DocumentExtraction {
  /** Unique identifier for the document */
  documentId: string;
  /** Original file name */
  fileName: string;
  /** Extracted name from document (may be null if not found) */
  extractedName: string | null;
  /** Extracted ID number from document (may be null if not found) */
  extractedIdNumber: string | null;
  /** All extracted fields with confidence scores */
  fields: Record<string, { value: unknown; confidence: number }>;
}

/**
 * A group of documents belonging to the same person
 */
export interface PersonGroup {
  /** Unique identifier for the group */
  id: string;
  /** Best name found for this person (highest confidence) */
  name: string | null;
  /** Confidence in the grouping (0.0 to 1.0) */
  confidence: number;
  /** Document IDs belonging to this person */
  documentIds: string[];
  /** Explanation of why documents were grouped */
  matchReason: string;
}

/**
 * Suggested merge between two groups
 */
export interface SuggestedMerge {
  /** IDs of the two groups that might be merged */
  groupIds: [string, string];
  /** Confidence in the merge suggestion (0.0 to 1.0) */
  confidence: number;
  /** Explanation of why merge is suggested */
  reason: string;
}

/**
 * Result of grouping documents
 */
export interface GroupingResult {
  /** Detected person groups */
  groups: PersonGroup[];
  /** Suggested merges for user review */
  suggestedMerges: SuggestedMerge[];
}

// ============================================================================
// Constants
// ============================================================================

/** Threshold for automatic grouping (0.95 = very high confidence) */
const AUTO_GROUP_THRESHOLD = 0.95;

/** Threshold for suggesting a merge (0.85 = high confidence) */
const SUGGEST_MERGE_THRESHOLD = 0.85;

/** Minimum similarity to consider as a potential match (0.70) */
const MIN_MATCH_THRESHOLD = 0.7;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize a name for comparison
 * - Lowercase
 * - Remove diacritics
 * - Remove non-alphabetic characters
 * - Normalize whitespace
 */
function normalizeName(name: string): string {
  if (!name) return '';

  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z\s]/g, '') // Keep only letters and spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Normalize an ID number for comparison
 * - Uppercase
 * - Remove non-alphanumeric characters
 */
function normalizeId(id: string): string {
  if (!id) return '';
  return id.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Calculate name similarity using fuzzball's token_sort_ratio
 * Returns value from 0.0 to 1.0
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  if (!n1 || !n2) return 0;
  if (n1 === n2) return 1.0;

  // token_sort_ratio handles name ordering: "Ali Mohamed" vs "Mohamed Ali"
  const score = fuzzball.token_sort_ratio(n1, n2) / 100;

  return score;
}

/**
 * Compare two IDs and return similarity score
 * Returns value from 0.0 to 1.0
 */
function compareIds(id1: string, id2: string): { match: boolean; confidence: number } {
  const n1 = normalizeId(id1);
  const n2 = normalizeId(id2);

  if (!n1 || !n2) {
    return { match: false, confidence: 0 };
  }

  // Exact match
  if (n1 === n2) {
    return { match: true, confidence: 1.0 };
  }

  // Partial match (OCR truncation)
  if (n1.length >= 6 && n2.length >= 6) {
    if (n1.includes(n2) || n2.includes(n1)) {
      return { match: true, confidence: 0.85 };
    }
  }

  // Prefix match
  if (n1.length >= 7 && n2.length >= 7) {
    if (n1.substring(0, 7) === n2.substring(0, 7)) {
      return { match: true, confidence: 0.7 };
    }
  }

  return { match: false, confidence: 0 };
}

/**
 * Generate a unique group ID
 */
function generateGroupId(): string {
  return `group_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Union-Find Data Structure
// ============================================================================

/**
 * Union-Find (Disjoint Set) for grouping documents
 */
class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  /** Add an element */
  add(x: string): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  /** Find root of element (with path compression) */
  find(x: string): string {
    if (!this.parent.has(x)) {
      this.add(x);
    }

    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!));
    }

    return this.parent.get(x)!;
  }

  /** Union two elements (by rank) */
  union(x: string, y: string): void {
    const rootX = this.find(x);
    const rootY = this.find(y);

    if (rootX === rootY) return;

    const rankX = this.rank.get(rootX)!;
    const rankY = this.rank.get(rootY)!;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }

  /** Check if two elements are in the same group */
  connected(x: string, y: string): boolean {
    return this.find(x) === this.find(y);
  }

  /** Get all groups */
  getGroups(): Map<string, string[]> {
    const groups = new Map<string, string[]>();

    this.parent.forEach((_value, element) => {
      const root = this.find(element);
      if (!groups.has(root)) {
        groups.set(root, []);
      }
      groups.get(root)!.push(element);
    });

    return groups;
  }
}

// ============================================================================
// PersonGroupingService
// ============================================================================

class PersonGroupingService {
  /**
   * Group documents based on entity resolution
   *
   * Uses a three-tier matching strategy:
   * 1. Exact ID match (normalized) -> confidence 1.0, auto_group
   * 2. High name similarity via fuzzball (>=0.95) -> auto_group
   * 3. Moderate similarity (0.85-0.95) -> suggest merge
   * 4. Low similarity (<0.85) -> keep separate
   *
   * @param extractions - Array of document extractions to group
   * @returns Grouping result with groups and suggested merges
   */
  groupDocuments(extractions: DocumentExtraction[]): GroupingResult {
    logger.info('Starting document grouping', { documentCount: extractions.length });

    // Handle edge cases
    if (extractions.length === 0) {
      return { groups: [], suggestedMerges: [] };
    }

    if (extractions.length === 1) {
      const doc = extractions[0];
      return {
        groups: [
          {
            id: generateGroupId(),
            name: doc.extractedName,
            confidence: 1.0,
            documentIds: [doc.documentId],
            matchReason: 'Single document',
          },
        ],
        suggestedMerges: [],
      };
    }

    // Initialize union-find with all document IDs
    const uf = new UnionFind();
    for (const doc of extractions) {
      uf.add(doc.documentId);
    }

    // Track match reasons and confidences
    const matchReasons = new Map<string, string>();
    const matchConfidences = new Map<string, number>();
    const suggestedMerges: SuggestedMerge[] = [];

    // Compare all pairs of documents
    for (let i = 0; i < extractions.length; i++) {
      for (let j = i + 1; j < extractions.length; j++) {
        const doc1 = extractions[i];
        const doc2 = extractions[j];

        // Calculate match confidence
        const matchResult = this.calculateMatch(doc1, doc2);

        if (matchResult.confidence >= AUTO_GROUP_THRESHOLD) {
          // Auto-group: merge into same group
          uf.union(doc1.documentId, doc2.documentId);

          // Track the match reason for the merged group
          const root = uf.find(doc1.documentId);
          const existingConfidence = matchConfidences.get(root) || 0;
          if (matchResult.confidence > existingConfidence) {
            matchReasons.set(root, matchResult.reason);
            matchConfidences.set(root, matchResult.confidence);
          }

          logger.debug('Auto-grouped documents', {
            doc1Id: doc1.documentId,
            doc2Id: doc2.documentId,
            confidence: matchResult.confidence,
            reason: matchResult.reason,
          });
        } else if (matchResult.confidence >= SUGGEST_MERGE_THRESHOLD) {
          // Suggest merge: don't auto-group, but suggest to user
          suggestedMerges.push({
            groupIds: [doc1.documentId, doc2.documentId],
            confidence: matchResult.confidence,
            reason: matchResult.reason,
          });

          logger.debug('Suggested merge for documents', {
            doc1Id: doc1.documentId,
            doc2Id: doc2.documentId,
            confidence: matchResult.confidence,
            reason: matchResult.reason,
          });
        }
      }
    }

    // Build groups from union-find
    const groupMap = uf.getGroups();
    const groups: PersonGroup[] = [];

    groupMap.forEach((docIds, _root) => {
      // Find the best name for the group (highest confidence)
      let bestName: string | null = null;
      let bestNameConfidence = 0;

      for (const docId of docIds) {
        const doc = extractions.find((d) => d.documentId === docId);
        if (doc?.extractedName) {
          // Find confidence of the name field
          const nameField = doc.fields['fullName'] || doc.fields['full_name'] || doc.fields['name'];
          const nameConfidence = nameField?.confidence || 0.5;

          if (nameConfidence > bestNameConfidence) {
            bestName = doc.extractedName;
            bestNameConfidence = nameConfidence;
          }
        }
      }

      const groupId = generateGroupId();
      const groupConfidence = matchConfidences.get(uf.find(docIds[0])) || 1.0;
      const reason = matchReasons.get(uf.find(docIds[0])) || 'Grouped by name similarity';

      groups.push({
        id: groupId,
        name: bestName,
        confidence: groupConfidence,
        documentIds: docIds,
        matchReason: docIds.length === 1 ? 'Single document in group' : reason,
      });
    });

    // Update suggested merges to use group IDs instead of document IDs
    const updatedSuggestedMerges: SuggestedMerge[] = [];
    for (const merge of suggestedMerges) {
      // Find which groups these documents belong to
      const group1 = groups.find((g) => g.documentIds.includes(merge.groupIds[0]));
      const group2 = groups.find((g) => g.documentIds.includes(merge.groupIds[1]));

      if (group1 && group2 && group1.id !== group2.id) {
        // Only suggest if they're in different groups
        const existing = updatedSuggestedMerges.find(
          (m) =>
            (m.groupIds[0] === group1.id && m.groupIds[1] === group2.id) ||
            (m.groupIds[0] === group2.id && m.groupIds[1] === group1.id)
        );

        if (!existing) {
          updatedSuggestedMerges.push({
            groupIds: [group1.id, group2.id],
            confidence: merge.confidence,
            reason: merge.reason,
          });
        }
      }
    }

    logger.info('Document grouping completed', {
      documentCount: extractions.length,
      groupCount: groups.length,
      suggestedMergeCount: updatedSuggestedMerges.length,
    });

    return {
      groups,
      suggestedMerges: updatedSuggestedMerges,
    };
  }

  /**
   * Calculate match between two documents
   */
  private calculateMatch(
    doc1: DocumentExtraction,
    doc2: DocumentExtraction
  ): { confidence: number; reason: string } {
    // Tier 1: Exact ID match
    if (doc1.extractedIdNumber && doc2.extractedIdNumber) {
      const idMatch = compareIds(doc1.extractedIdNumber, doc2.extractedIdNumber);

      if (idMatch.match && idMatch.confidence >= AUTO_GROUP_THRESHOLD) {
        return {
          confidence: 1.0,
          reason: 'Exact ID number match',
        };
      }

      if (idMatch.match && idMatch.confidence >= SUGGEST_MERGE_THRESHOLD) {
        return {
          confidence: idMatch.confidence,
          reason: 'Partial ID number match',
        };
      }
    }

    // Tier 2: Name similarity
    if (doc1.extractedName && doc2.extractedName) {
      const nameSimilarity = calculateNameSimilarity(doc1.extractedName, doc2.extractedName);

      if (nameSimilarity >= AUTO_GROUP_THRESHOLD) {
        return {
          confidence: nameSimilarity,
          reason: 'High name similarity',
        };
      }

      if (nameSimilarity >= SUGGEST_MERGE_THRESHOLD) {
        return {
          confidence: nameSimilarity,
          reason: 'Moderate name similarity - review recommended',
        };
      }

      if (nameSimilarity >= MIN_MATCH_THRESHOLD) {
        return {
          confidence: nameSimilarity,
          reason: 'Low name similarity',
        };
      }
    }

    // Tier 3: Combined ID partial + name partial
    if (doc1.extractedIdNumber && doc2.extractedIdNumber) {
      const idMatch = compareIds(doc1.extractedIdNumber, doc2.extractedIdNumber);
      if (idMatch.match && doc1.extractedName && doc2.extractedName) {
        const nameSimilarity = calculateNameSimilarity(doc1.extractedName, doc2.extractedName);

        if (idMatch.confidence >= 0.7 && nameSimilarity >= 0.7) {
          // Combined evidence
          const combinedConfidence = idMatch.confidence * 0.6 + nameSimilarity * 0.4;
          return {
            confidence: combinedConfidence,
            reason: 'Combined ID and name match',
          };
        }
      }
    }

    // No significant match
    return {
      confidence: 0,
      reason: 'No match detected',
    };
  }
}

// Export singleton instance
export const personGroupingService = new PersonGroupingService();

export default personGroupingService;

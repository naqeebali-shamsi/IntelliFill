/**
 * Data utility functions for merging and processing extracted document data
 */

/**
 * Extracted data structure from document processing
 */
export interface ExtractedData {
  fields?: Record<string, unknown>;
  entities?: {
    names?: string[];
    emails?: string[];
    phones?: string[];
    dates?: string[];
    addresses?: string[];
  };
  metadata?: {
    confidence?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Merged extracted data structure
 */
export interface MergedExtractedData {
  fields: Record<string, unknown>;
  entities: {
    names: string[];
    emails: string[];
    phones: string[];
    dates: string[];
    addresses: string[];
  };
  metadata: {
    confidence: number;
    sourceCount: number;
  };
}

/**
 * Merge extracted data from multiple documents
 *
 * @param dataArray - Array of extracted data objects to merge
 * @returns Merged data with combined fields, deduplicated entities, and averaged confidence
 */
export function mergeExtractedData(dataArray: ExtractedData[]): MergedExtractedData {
  const merged: MergedExtractedData = {
    fields: {},
    entities: {
      names: [],
      emails: [],
      phones: [],
      dates: [],
      addresses: [],
    },
    metadata: {
      confidence: 0,
      sourceCount: dataArray.length,
    },
  };

  let totalConfidence = 0;
  let confidenceCount = 0;

  for (const data of dataArray) {
    // Merge fields
    if (data.fields) {
      Object.assign(merged.fields, data.fields);
    }

    // Merge entities
    if (data.entities) {
      merged.entities.names.push(...(data.entities.names || []));
      merged.entities.emails.push(...(data.entities.emails || []));
      merged.entities.phones.push(...(data.entities.phones || []));
      merged.entities.dates.push(...(data.entities.dates || []));
      merged.entities.addresses.push(...(data.entities.addresses || []));
    }

    // Average confidence
    if (data.metadata?.confidence !== undefined && data.metadata.confidence !== null) {
      totalConfidence += data.metadata.confidence;
      confidenceCount++;
    }
  }

  // Calculate average confidence
  merged.metadata.confidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

  // Remove duplicates from entities
  merged.entities.names = [...new Set(merged.entities.names)];
  merged.entities.emails = [...new Set(merged.entities.emails)];
  merged.entities.phones = [...new Set(merged.entities.phones)];
  merged.entities.dates = [...new Set(merged.entities.dates)];
  merged.entities.addresses = [...new Set(merged.entities.addresses)];

  return merged;
}

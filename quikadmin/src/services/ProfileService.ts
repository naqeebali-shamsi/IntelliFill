import { encryptJSON, decryptJSON } from '../utils/encryption';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { prisma } from '../utils/prisma';

export interface ProfileField {
  key: string;
  values: string[];
  sources: string[]; // Document IDs where this field was found
  confidence: number;
  lastUpdated: Date;
}

export interface AggregatedProfile {
  userId: string;
  fields: Record<string, ProfileField>;
  lastAggregated: Date;
  documentCount: number;
}

export class ProfileService {
  /**
   * Aggregate profile data from all user's documents
   * Performs intelligent deduplication and merging
   */
  async aggregateUserProfile(userId: string): Promise<AggregatedProfile> {
    try {
      logger.info(`Aggregating profile for user: ${userId}`);

      // Fetch all completed documents with extracted data
      const documents = await prisma.document.findMany({
        where: {
          userId,
          status: 'COMPLETED',
          extractedData: { not: null }
        },
        select: {
          id: true,
          extractedData: true,
          confidence: true,
          processedAt: true
        },
        orderBy: {
          processedAt: 'desc'
        }
      });

      logger.debug(`Found ${documents.length} documents for aggregation`);

      // Initialize aggregated fields
      const aggregatedFields: Record<string, ProfileField> = {};

      // Process each document
      for (const doc of documents) {
        if (!doc.extractedData) continue;

        try {
          // Decrypt extracted data
          const extractedData = decryptJSON(doc.extractedData as string);

          // Process each field from the document
          this.processDocumentData(
            extractedData,
            aggregatedFields,
            doc.id,
            doc.confidence || 0,
            doc.processedAt || new Date()
          );
        } catch (error) {
          logger.warn(`Failed to process document ${doc.id}:`, error);
          continue;
        }
      }

      // Deduplicate and normalize values
      this.deduplicateFields(aggregatedFields);

      return {
        userId,
        fields: aggregatedFields,
        lastAggregated: new Date(),
        documentCount: documents.length
      };
    } catch (error) {
      logger.error(`Failed to aggregate profile for user ${userId}:`, error);
      throw new Error(`Profile aggregation failed: ${error}`);
    }
  }

  /**
   * Process extracted data from a document and add to aggregated fields
   */
  private processDocumentData(
    data: any,
    aggregatedFields: Record<string, ProfileField>,
    documentId: string,
    confidence: number,
    processedAt: Date
  ): void {
    // Handle flat key-value pairs
    if (typeof data === 'object' && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        if (value === null || value === undefined) continue;

        const normalizedKey = this.normalizeFieldKey(key);
        const normalizedValues = this.extractValues(value);

        if (normalizedValues.length === 0) continue;

        // Initialize field if it doesn't exist
        if (!aggregatedFields[normalizedKey]) {
          aggregatedFields[normalizedKey] = {
            key: normalizedKey,
            values: [],
            sources: [],
            confidence: 0,
            lastUpdated: processedAt
          };
        }

        const field = aggregatedFields[normalizedKey];

        // Add values and sources
        for (const val of normalizedValues) {
          if (!field.values.includes(val)) {
            field.values.push(val);
          }
        }

        if (!field.sources.includes(documentId)) {
          field.sources.push(documentId);
        }

        // Update confidence (weighted average)
        const oldWeight = field.sources.length - 1;
        field.confidence = (field.confidence * oldWeight + confidence) / field.sources.length;

        // Update last updated date to most recent
        if (processedAt > field.lastUpdated) {
          field.lastUpdated = processedAt;
        }
      }
    }
  }

  /**
   * Extract values from various data types (string, array, object)
   */
  private extractValues(value: any): string[] {
    if (typeof value === 'string') {
      return [value.trim()].filter(v => v.length > 0);
    } else if (Array.isArray(value)) {
      return value
        .filter(v => typeof v === 'string')
        .map(v => v.trim())
        .filter(v => v.length > 0);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      return [String(value)];
    } else if (typeof value === 'object' && value !== null) {
      // Flatten nested objects
      return Object.values(value)
        .filter(v => typeof v === 'string' || typeof v === 'number')
        .map(v => String(v).trim())
        .filter(v => v.length > 0);
    }
    return [];
  }

  /**
   * Normalize field keys to common format
   */
  private normalizeFieldKey(key: string): string {
    return key
      .toLowerCase()
      .trim()
      .replace(/[_\s-]+/g, '_') // Replace spaces, hyphens, underscores with single underscore
      .replace(/[^a-z0-9_]/g, '') // Remove special characters
      .replace(/^_+|_+$/g, ''); // Trim underscores from start/end
  }

  /**
   * Deduplicate and normalize field values
   * Handles common duplicates like phone numbers with different formats
   */
  private deduplicateFields(fields: Record<string, ProfileField>): void {
    for (const field of Object.values(fields)) {
      const deduplicatedValues: string[] = [];

      for (const value of field.values) {
        // Check for email duplicates (case-insensitive)
        if (field.key.includes('email')) {
          const lowerValue = value.toLowerCase();
          if (!deduplicatedValues.some(v => v.toLowerCase() === lowerValue)) {
            deduplicatedValues.push(value);
          }
          continue;
        }

        // Check for phone number duplicates (normalize format)
        if (field.key.includes('phone') || field.key.includes('tel') || field.key.includes('mobile')) {
          const normalizedPhone = this.normalizePhoneNumber(value);
          if (!deduplicatedValues.some(v => this.normalizePhoneNumber(v) === normalizedPhone)) {
            deduplicatedValues.push(value);
          }
          continue;
        }

        // Check for SSN/ID duplicates (remove formatting)
        if (field.key.includes('ssn') || field.key.includes('social') || field.key.includes('id')) {
          const normalizedId = value.replace(/[^0-9]/g, '');
          if (!deduplicatedValues.some(v => v.replace(/[^0-9]/g, '') === normalizedId)) {
            deduplicatedValues.push(value);
          }
          continue;
        }

        // Default: case-sensitive exact match
        if (!deduplicatedValues.includes(value)) {
          deduplicatedValues.push(value);
        }
      }

      field.values = deduplicatedValues;
    }
  }

  /**
   * Normalize phone number for comparison
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // Remove country code if present (assume US +1)
    if (digits.length === 11 && digits.startsWith('1')) {
      return digits.substring(1);
    }

    return digits;
  }

  /**
   * Save aggregated profile to database
   */
  async saveProfile(userId: string, aggregatedProfile: AggregatedProfile): Promise<void> {
    try {
      // Encrypt profile data before saving
      const encryptedData = encryptJSON(aggregatedProfile.fields);

      // Upsert profile
      await prisma.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          profileData: encryptedData,
          lastAggregated: aggregatedProfile.lastAggregated
        },
        update: {
          profileData: encryptedData,
          lastAggregated: aggregatedProfile.lastAggregated
        }
      });

      logger.info(`Profile saved for user: ${userId}`);
    } catch (error) {
      logger.error(`Failed to save profile for user ${userId}:`, error);
      throw new Error(`Failed to save profile: ${error}`);
    }
  }

  /**
   * Retrieve user profile from database
   */
  async getProfile(userId: string): Promise<AggregatedProfile | null> {
    try {
      const profile = await prisma.userProfile.findUnique({
        where: { userId }
      });

      if (!profile) {
        return null;
      }

      // Decrypt profile data
      const fields = decryptJSON(profile.profileData as string);

      // Get document count
      const documentCount = await prisma.document.count({
        where: {
          userId,
          status: 'COMPLETED'
        }
      });

      return {
        userId,
        fields,
        lastAggregated: profile.lastAggregated,
        documentCount
      };
    } catch (error) {
      logger.error(`Failed to retrieve profile for user ${userId}:`, error);
      throw new Error(`Failed to retrieve profile: ${error}`);
    }
  }

  /**
   * Update profile manually (merge with existing data)
   */
  async updateProfile(userId: string, updates: Record<string, any>): Promise<AggregatedProfile> {
    try {
      // Get existing profile or create new one
      let profile = await this.getProfile(userId);

      if (!profile) {
        // If no profile exists, aggregate from documents first
        profile = await this.aggregateUserProfile(userId);
      }

      // Process updates
      for (const [key, value] of Object.entries(updates)) {
        const normalizedKey = this.normalizeFieldKey(key);
        const normalizedValues = this.extractValues(value);

        if (normalizedValues.length === 0) continue;

        // Update or create field
        if (profile.fields[normalizedKey]) {
          // Merge with existing values
          const existingValues = profile.fields[normalizedKey].values;
          const newValues = normalizedValues.filter(v => !existingValues.includes(v));
          profile.fields[normalizedKey].values.push(...newValues);
          profile.fields[normalizedKey].lastUpdated = new Date();
        } else {
          // Create new field
          profile.fields[normalizedKey] = {
            key: normalizedKey,
            values: normalizedValues,
            sources: ['manual_edit'],
            confidence: 100, // Manual edits have 100% confidence
            lastUpdated: new Date()
          };
        }
      }

      // Deduplicate after updates
      this.deduplicateFields(profile.fields);

      // Save updated profile
      profile.lastAggregated = new Date();
      await this.saveProfile(userId, profile);

      return profile;
    } catch (error) {
      logger.error(`Failed to update profile for user ${userId}:`, error);
      throw new Error(`Failed to update profile: ${error}`);
    }
  }

  /**
   * Refresh profile by re-aggregating from all documents
   */
  async refreshProfile(userId: string): Promise<AggregatedProfile> {
    try {
      const profile = await this.aggregateUserProfile(userId);
      await this.saveProfile(userId, profile);
      return profile;
    } catch (error) {
      logger.error(`Failed to refresh profile for user ${userId}:`, error);
      throw new Error(`Failed to refresh profile: ${error}`);
    }
  }

  /**
   * Delete user profile
   */
  async deleteProfile(userId: string): Promise<void> {
    try {
      await prisma.userProfile.delete({
        where: { userId }
      });
      logger.info(`Profile deleted for user: ${userId}`);
    } catch (error) {
      logger.error(`Failed to delete profile for user ${userId}:`, error);
      throw new Error(`Failed to delete profile: ${error}`);
    }
  }
}

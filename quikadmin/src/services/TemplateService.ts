import { Template } from '@prisma/client';
import { encryptJSON, decryptJSON } from '../utils/encryption';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform?: string;
  confidence?: number;
}

export interface TemplateData {
  name: string;
  description?: string;
  formType: string;
  fieldMappings: FieldMapping[];
  isPublic?: boolean;
}

export interface FormTypeDetectionResult {
  formType: string;
  confidence: number;
  matchedPatterns: string[];
}

export interface TemplateMatchResult {
  template: Template;
  similarity: number;
  matchedFields: string[];
}

// Form type patterns for detection
const FORM_TYPE_PATTERNS = {
  W2: {
    keywords: [
      'w2',
      'w-2',
      'wage',
      'tax',
      'statement',
      'employer',
      'ein',
      'fica',
      'medicare',
      'federal_income_tax',
      'social_security',
      'box_1',
      'box_2',
    ],
    requiredFields: ['employer_ein', 'employee_ssn', 'wages'],
    weight: 1.0,
  },
  I9: {
    keywords: [
      'i9',
      'i-9',
      'employment',
      'eligibility',
      'verification',
      'citizen',
      'status',
      'alien',
      'passport',
      'uscis',
      'document_number',
      'expiration_date',
    ],
    requiredFields: ['last_name', 'first_name', 'citizenship_status'],
    weight: 1.0,
  },
  PASSPORT: {
    keywords: [
      'passport',
      'travel',
      'document',
      'nationality',
      'issue_date',
      'expiration_date',
      'passport_number',
      'place_of_birth',
      'emergency_contact',
    ],
    requiredFields: ['passport_number', 'full_name', 'date_of_birth'],
    weight: 1.0,
  },
  JOB_APPLICATION: {
    keywords: [
      'application',
      'employment',
      'resume',
      'position',
      'cover_letter',
      'references',
      'work_experience',
      'education',
      'skills',
    ],
    requiredFields: ['first_name', 'last_name', 'email', 'phone'],
    weight: 1.0,
  },
  CUSTOM: {
    keywords: [] as string[],
    requiredFields: [] as string[],
    weight: 0.1,
  },
};

export class TemplateService {
  /**
   * Create a new template
   */
  async createTemplate(userId: string, templateData: TemplateData): Promise<Template> {
    try {
      logger.info(`Creating template for user: ${userId}`);

      // Encrypt field mappings
      const encryptedMappings = encryptJSON(templateData.fieldMappings);

      const template = await prisma.template.create({
        data: {
          userId,
          name: templateData.name,
          description: templateData.description,
          formType: templateData.formType,
          fieldMappings: encryptedMappings,
          isPublic: templateData.isPublic || false,
          usageCount: 0,
        },
      });

      logger.info(`Template created: ${template.id}`);
      return template;
    } catch (error) {
      logger.error(`Failed to create template:`, error);
      throw new Error(`Failed to create template: ${error}`);
    }
  }

  /**
   * Get all templates for a user
   */
  async getTemplates(userId: string): Promise<Template[]> {
    try {
      const templates = await prisma.template.findMany({
        where: {
          userId,
          isActive: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      return templates;
    } catch (error) {
      logger.error(`Failed to get templates for user ${userId}:`, error);
      throw new Error(`Failed to get templates: ${error}`);
    }
  }

  /**
   * Get public templates for marketplace
   */
  async getPublicTemplates(): Promise<Template[]> {
    try {
      const templates = await prisma.template.findMany({
        where: {
          isPublic: true,
          isActive: true,
        },
        orderBy: {
          usageCount: 'desc',
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return templates;
    } catch (error) {
      logger.error(`Failed to get public templates:`, error);
      throw new Error(`Failed to get public templates: ${error}`);
    }
  }

  /**
   * Get a single template by ID
   */
  async getTemplateById(templateId: string, userId?: string): Promise<Template | null> {
    try {
      const template = await prisma.template.findFirst({
        where: {
          id: templateId,
          isActive: true,
          OR: [{ userId: userId }, { isPublic: true }],
        },
      });

      return template;
    } catch (error) {
      logger.error(`Failed to get template ${templateId}:`, error);
      throw new Error(`Failed to get template: ${error}`);
    }
  }

  /**
   * Update a template
   */
  async updateTemplate(
    templateId: string,
    userId: string,
    updates: Partial<TemplateData>
  ): Promise<Template> {
    try {
      logger.info(`Updating template ${templateId} for user ${userId}`);

      // Verify ownership
      const existing = await prisma.template.findFirst({
        where: {
          id: templateId,
          userId,
        },
      });

      if (!existing) {
        throw new Error('Template not found or access denied');
      }

      const updateData: any = {};

      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.formType) updateData.formType = updates.formType;
      if (updates.isPublic !== undefined) updateData.isPublic = updates.isPublic;
      if (updates.fieldMappings) {
        updateData.fieldMappings = encryptJSON(updates.fieldMappings);
      }

      const template = await prisma.template.update({
        where: { id: templateId },
        data: updateData,
      });

      logger.info(`Template updated: ${template.id}`);
      return template;
    } catch (error) {
      logger.error(`Failed to update template ${templateId}:`, error);
      throw new Error(`Failed to update template: ${error}`);
    }
  }

  /**
   * Delete a template (soft delete)
   */
  async deleteTemplate(templateId: string, userId: string): Promise<void> {
    try {
      logger.info(`Deleting template ${templateId} for user ${userId}`);

      // Verify ownership
      const existing = await prisma.template.findFirst({
        where: {
          id: templateId,
          userId,
        },
      });

      if (!existing) {
        throw new Error('Template not found or access denied');
      }

      await prisma.template.update({
        where: { id: templateId },
        data: { isActive: false },
      });

      logger.info(`Template deleted: ${templateId}`);
    } catch (error) {
      logger.error(`Failed to delete template ${templateId}:`, error);
      throw new Error(`Failed to delete template: ${error}`);
    }
  }

  /**
   * Detect form type from field names
   * Returns form type with confidence score
   */
  async detectFormType(fieldNames: string[]): Promise<FormTypeDetectionResult> {
    try {
      logger.info(`Detecting form type from ${fieldNames.length} fields`);

      // Normalize field names
      const normalizedFields = fieldNames.map((f) => f.toLowerCase().replace(/[^a-z0-9_]/g, '_'));

      const scores: { [key: string]: { score: number; matches: string[] } } = {};

      // Score each form type
      for (const [formType, patterns] of Object.entries(FORM_TYPE_PATTERNS)) {
        let score = 0;
        const matches: string[] = [];

        // Check keyword matches
        for (const keyword of patterns.keywords) {
          const keywordMatches = normalizedFields.filter((field) => field.includes(keyword));
          if (keywordMatches.length > 0) {
            score += keywordMatches.length * patterns.weight;
            matches.push(...keywordMatches);
          }
        }

        // Check required fields (higher weight)
        for (const required of patterns.requiredFields) {
          const requiredMatches = normalizedFields.filter(
            (field) => field.includes(required) || this.fuzzyMatch(field, required)
          );
          if (requiredMatches.length > 0) {
            score += requiredMatches.length * patterns.weight * 2;
            matches.push(...requiredMatches);
          }
        }

        scores[formType] = { score, matches: [...new Set(matches)] };
      }

      // Find form type with highest score
      let bestMatch = 'CUSTOM';
      let bestScore = 0;
      let bestMatches: string[] = [];

      for (const [formType, result] of Object.entries(scores)) {
        if (result.score > bestScore) {
          bestScore = result.score;
          bestMatch = formType;
          bestMatches = result.matches;
        }
      }

      // Calculate confidence (normalize to 0-100)
      const maxPossibleScore = fieldNames.length * 2;
      const confidence = Math.min(100, (bestScore / maxPossibleScore) * 100);

      // If confidence is too low, default to CUSTOM
      if (confidence < 20 && bestMatch !== 'CUSTOM') {
        bestMatch = 'CUSTOM';
      }

      logger.info(`Form type detected: ${bestMatch} (confidence: ${confidence.toFixed(2)}%)`);

      return {
        formType: bestMatch,
        confidence: Math.round(confidence * 100) / 100,
        matchedPatterns: bestMatches,
      };
    } catch (error) {
      logger.error(`Failed to detect form type:`, error);
      throw new Error(`Failed to detect form type: ${error}`);
    }
  }

  /**
   * Match templates based on field names
   * Returns ranked list of matching templates with similarity scores
   */
  async matchTemplate(fieldNames: string[], userId?: string): Promise<TemplateMatchResult[]> {
    try {
      logger.info(`Matching templates for ${fieldNames.length} fields`);

      // Get all available templates (user's + public)
      const templates = await prisma.template.findMany({
        where: {
          isActive: true,
          OR: [{ userId: userId }, { isPublic: true }],
        },
      });

      // Normalize field names
      const normalizedFields = fieldNames.map((f) => f.toLowerCase().replace(/[^a-z0-9_]/g, '_'));

      const matches: TemplateMatchResult[] = [];

      for (const template of templates) {
        try {
          // Decrypt field mappings
          const mappings: FieldMapping[] = decryptJSON(template.fieldMappings);
          const templateFields = mappings.map((m) =>
            m.targetField.toLowerCase().replace(/[^a-z0-9_]/g, '_')
          );

          // Calculate similarity
          const { similarity, matchedFields } = this.calculateSimilarity(
            normalizedFields,
            templateFields
          );

          if (similarity > 0.1) {
            // Only include if at least 10% match
            matches.push({
              template,
              similarity: Math.round(similarity * 10000) / 100,
              matchedFields,
            });
          }
        } catch (error) {
          logger.warn(`Failed to process template ${template.id}:`, error);
          continue;
        }
      }

      // Sort by similarity (highest first)
      matches.sort((a, b) => b.similarity - a.similarity);

      logger.info(`Found ${matches.length} matching templates`);
      return matches;
    } catch (error) {
      logger.error(`Failed to match templates:`, error);
      throw new Error(`Failed to match templates: ${error}`);
    }
  }

  /**
   * Calculate similarity between two field sets
   * Uses Jaccard similarity coefficient
   */
  private calculateSimilarity(
    fields1: string[],
    fields2: string[]
  ): { similarity: number; matchedFields: string[] } {
    const set1 = new Set(fields1);
    const set2 = new Set(fields2);

    const matchedFields: string[] = [];
    let intersectionCount = 0;

    // Count exact matches
    for (const field of set1) {
      if (set2.has(field)) {
        intersectionCount++;
        matchedFields.push(field);
      } else {
        // Try fuzzy matching
        for (const field2 of set2) {
          if (this.fuzzyMatch(field, field2)) {
            intersectionCount += 0.8; // Partial credit for fuzzy match
            matchedFields.push(field);
            break;
          }
        }
      }
    }

    const unionCount = set1.size + set2.size - intersectionCount;
    const similarity = unionCount > 0 ? intersectionCount / unionCount : 0;

    return { similarity, matchedFields };
  }

  /**
   * Fuzzy string matching using Levenshtein distance
   */
  private fuzzyMatch(str1: string, str2: string, threshold = 0.8): boolean {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    const similarity = 1 - distance / maxLength;
    return similarity >= threshold;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Increment usage count when template is used
   */
  async incrementUsageCount(templateId: string): Promise<void> {
    try {
      await prisma.template.update({
        where: { id: templateId },
        data: {
          usageCount: {
            increment: 1,
          },
        },
      });
    } catch (error) {
      logger.warn(`Failed to increment usage count for template ${templateId}:`, error);
      // Don't throw error, this is non-critical
    }
  }

  /**
   * Get template field mappings (decrypted)
   */
  async getTemplateFieldMappings(templateId: string, userId?: string): Promise<FieldMapping[]> {
    try {
      const template = await this.getTemplateById(templateId, userId);

      if (!template) {
        throw new Error('Template not found');
      }

      const mappings: FieldMapping[] = decryptJSON(template.fieldMappings);
      return mappings;
    } catch (error) {
      logger.error(`Failed to get field mappings for template ${templateId}:`, error);
      throw new Error(`Failed to get field mappings: ${error}`);
    }
  }

  /**
   * Duplicate a template
   * Creates a new template with the same field mappings and settings
   * New template name will be "{original name} (Copy)"
   */
  async duplicateTemplate(templateId: string, userId: string): Promise<Template> {
    try {
      logger.info(`Duplicating template ${templateId} for user ${userId}`);

      // Get the original template
      const original = await this.getTemplateById(templateId, userId);

      if (!original) {
        throw new Error('Template not found or access denied');
      }

      // Get decrypted field mappings from original
      const fieldMappings = decryptJSON(original.fieldMappings);

      // Create new name with (Copy) suffix
      const newName = `${original.name} (Copy)`;

      // Create the duplicate
      const duplicatedTemplate = await this.createTemplate(userId, {
        name: newName,
        description: original.description || undefined,
        formType: original.formType,
        fieldMappings: fieldMappings,
        isPublic: false, // Duplicates are always private initially
      });

      logger.info(`Template duplicated: ${original.id} -> ${duplicatedTemplate.id}`);
      return duplicatedTemplate;
    } catch (error) {
      logger.error(`Failed to duplicate template ${templateId}:`, error);
      throw error;
    }
  }
}

/**
 * Client Document Field Service
 *
 * Handles field extraction from OCR data and profile merging for client documents.
 * Extracted from client-documents.routes.ts to improve modularity and reusability.
 */

import { DocumentCategory } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

/**
 * Field extraction result with metadata
 */
export interface ExtractedFields {
  fields: Record<string, any>;
  sourceCategory: DocumentCategory | null;
  extractedCount: number;
}

/**
 * Profile merge result with details
 */
export interface ProfileMergeResult {
  success: boolean;
  fieldsUpdated: number;
  skippedFields: string[];
  newProfileCreated: boolean;
}

/**
 * Service for extracting and managing client document fields
 */
export class ClientDocumentFieldService {
  /**
   * Extract fields from OCR structured data based on document category
   * Maps generic OCR patterns to specific profile fields
   *
   * @param structuredData - Raw OCR extraction results
   * @param category - Document category for field mapping
   * @returns Extracted and mapped fields
   */
  extractFieldsByCategory(
    structuredData: Record<string, any>,
    category: DocumentCategory | null
  ): Record<string, any> {
    const fields: Record<string, any> = {};

    // Map common patterns from structuredData
    if (structuredData.fields) {
      Object.assign(fields, structuredData.fields);
    }

    // Extract based on document category
    switch (category) {
      case 'PASSPORT':
        this.extractPassportFields(structuredData, fields);
        break;

      case 'EMIRATES_ID':
        this.extractEmiratesIdFields(structuredData, fields);
        break;

      case 'TRADE_LICENSE':
        this.extractTradeLicenseFields(structuredData, fields);
        break;

      case 'VISA':
        this.extractVisaFields(structuredData, fields);
        break;

      case 'LABOR_CARD':
        this.extractLaborCardFields(structuredData, fields);
        break;

      default:
        // Generic extraction for OTHER or null category
        this.extractGenericFields(structuredData, fields);
        break;
    }

    // Always extract common patterns if found
    this.extractCommonPatterns(structuredData, fields);

    return fields;
  }

  /**
   * Merge extracted fields into client profile
   * Only updates fields that are not manually edited (unless forced)
   *
   * @param clientId - Client ID to merge into
   * @param fields - Fields to merge
   * @param documentId - Source document ID for tracking
   * @returns Whether profile was updated
   */
  async mergeToClientProfile(
    clientId: string,
    fields: Record<string, any>,
    documentId: string
  ): Promise<boolean> {
    try {
      // Get or create profile
      let profile = await prisma.clientProfile.findUnique({
        where: { clientId },
      });

      if (!profile) {
        profile = await prisma.clientProfile.create({
          data: {
            clientId,
            data: {},
            fieldSources: {},
          },
        });
      }

      const currentData = (profile.data || {}) as Record<string, any>;
      const currentFieldSources = (profile.fieldSources || {}) as Record<string, any>;

      const newData = { ...currentData };
      const newFieldSources = { ...currentFieldSources };

      let fieldsUpdated = 0;

      for (const [fieldName, value] of Object.entries(fields)) {
        // Skip if field was manually edited (don't overwrite user corrections)
        if (currentFieldSources[fieldName]?.manuallyEdited) {
          logger.debug(`Skipping manually edited field: ${fieldName}`);
          continue;
        }

        // Skip if value is empty or null
        if (value === null || value === undefined || value === '') {
          continue;
        }

        // Update the field
        newData[fieldName] = value;
        newFieldSources[fieldName] = {
          documentId,
          extractedAt: new Date().toISOString(),
          manuallyEdited: false,
        };
        fieldsUpdated++;
      }

      if (fieldsUpdated > 0) {
        await prisma.clientProfile.update({
          where: { id: profile.id },
          data: {
            data: newData,
            fieldSources: newFieldSources,
          },
        });

        logger.info(`Updated ${fieldsUpdated} fields in profile for client: ${clientId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error merging to client profile:', error);
      return false;
    }
  }

  /**
   * Merge fields with detailed result information
   */
  async mergeToClientProfileDetailed(
    clientId: string,
    fields: Record<string, any>,
    documentId: string
  ): Promise<ProfileMergeResult> {
    const skippedFields: string[] = [];

    try {
      let profile = await prisma.clientProfile.findUnique({
        where: { clientId },
      });

      const newProfileCreated = !profile;

      if (!profile) {
        profile = await prisma.clientProfile.create({
          data: {
            clientId,
            data: {},
            fieldSources: {},
          },
        });
      }

      const currentData = (profile.data || {}) as Record<string, any>;
      const currentFieldSources = (profile.fieldSources || {}) as Record<string, any>;

      const newData = { ...currentData };
      const newFieldSources = { ...currentFieldSources };

      let fieldsUpdated = 0;

      for (const [fieldName, value] of Object.entries(fields)) {
        if (currentFieldSources[fieldName]?.manuallyEdited) {
          skippedFields.push(fieldName);
          continue;
        }

        if (value === null || value === undefined || value === '') {
          continue;
        }

        newData[fieldName] = value;
        newFieldSources[fieldName] = {
          documentId,
          extractedAt: new Date().toISOString(),
          manuallyEdited: false,
        };
        fieldsUpdated++;
      }

      if (fieldsUpdated > 0) {
        await prisma.clientProfile.update({
          where: { id: profile.id },
          data: {
            data: newData,
            fieldSources: newFieldSources,
          },
        });
      }

      return {
        success: true,
        fieldsUpdated,
        skippedFields,
        newProfileCreated,
      };
    } catch (error) {
      logger.error('Error merging to client profile:', error);
      return {
        success: false,
        fieldsUpdated: 0,
        skippedFields,
        newProfileCreated: false,
      };
    }
  }

  // ============================================================================
  // Private Field Extraction Methods
  // ============================================================================

  private extractPassportFields(structuredData: Record<string, any>, fields: Record<string, any>): void {
    if (structuredData.fields) {
      const f = structuredData.fields;
      if (f.passport_no || f.passport_number) {
        fields.passportNumber = f.passport_no || f.passport_number;
      }
      if (f.surname || f.family_name) {
        fields.surname = f.surname || f.family_name;
      }
      if (f.given_names || f.first_name) {
        fields.givenNames = f.given_names || f.first_name;
      }
      if (f.full_name || f.name) {
        fields.fullName = f.full_name || f.name;
      }
      if (f.nationality) {
        fields.nationality = f.nationality;
      }
      if (f.date_of_birth || f.dob || f.birth_date) {
        fields.dateOfBirth = f.date_of_birth || f.dob || f.birth_date;
      }
      if (f.sex || f.gender) {
        fields.gender = f.sex || f.gender;
      }
      if (f.place_of_birth || f.birthplace) {
        fields.placeOfBirth = f.place_of_birth || f.birthplace;
      }
      if (f.date_of_issue || f.issue_date) {
        fields.passportIssueDate = f.date_of_issue || f.issue_date;
      }
      if (f.date_of_expiry || f.expiry_date || f.expiration_date) {
        fields.passportExpiryDate = f.date_of_expiry || f.expiry_date || f.expiration_date;
      }
      if (f.place_of_issue || f.issuing_authority) {
        fields.passportIssuePlace = f.place_of_issue || f.issuing_authority;
      }
    }
    // Extract dates from patterns
    if (structuredData.date && structuredData.date.length > 0) {
      if (!fields.dateOfBirth && structuredData.date[0]) {
        fields.dateOfBirth = structuredData.date[0];
      }
      if (!fields.passportIssueDate && structuredData.date[1]) {
        fields.passportIssueDate = structuredData.date[1];
      }
      if (!fields.passportExpiryDate && structuredData.date[2]) {
        fields.passportExpiryDate = structuredData.date[2];
      }
    }
  }

  private extractEmiratesIdFields(structuredData: Record<string, any>, fields: Record<string, any>): void {
    if (structuredData.fields) {
      const f = structuredData.fields;
      if (f.id_number || f.emirates_id || f.eid) {
        fields.emiratesId = f.id_number || f.emirates_id || f.eid;
      }
      if (f.name || f.full_name) {
        fields.fullName = f.name || f.full_name;
      }
      if (f.name_arabic) {
        fields.fullNameArabic = f.name_arabic;
      }
      if (f.nationality) {
        fields.nationality = f.nationality;
      }
      if (f.date_of_birth || f.dob) {
        fields.dateOfBirth = f.date_of_birth || f.dob;
      }
      if (f.expiry_date || f.card_expiry) {
        fields.emiratesIdExpiry = f.expiry_date || f.card_expiry;
      }
    }
  }

  private extractTradeLicenseFields(structuredData: Record<string, any>, fields: Record<string, any>): void {
    if (structuredData.fields) {
      const f = structuredData.fields;
      if (f.license_number || f.trade_license_no || f.licence_no) {
        fields.tradeLicenseNumber = f.license_number || f.trade_license_no || f.licence_no;
      }
      if (f.company_name || f.establishment_name || f.business_name) {
        fields.companyNameEn = f.company_name || f.establishment_name || f.business_name;
      }
      if (f.company_name_arabic) {
        fields.companyNameAr = f.company_name_arabic;
      }
      if (f.legal_type || f.legal_form) {
        fields.legalType = f.legal_type || f.legal_form;
      }
      if (f.activities || f.business_activities) {
        fields.activities = f.activities || f.business_activities;
      }
      if (f.issue_date) {
        fields.tradeLicenseIssueDate = f.issue_date;
      }
      if (f.expiry_date || f.expiration_date) {
        fields.tradeLicenseExpiry = f.expiry_date || f.expiration_date;
      }
      if (f.free_zone) {
        fields.freeZone = f.free_zone;
      }
    }
  }

  private extractVisaFields(structuredData: Record<string, any>, fields: Record<string, any>): void {
    if (structuredData.fields) {
      const f = structuredData.fields;
      if (f.visa_number || f.visa_no) {
        fields.visaNumber = f.visa_number || f.visa_no;
      }
      if (f.visa_type || f.residence_type) {
        fields.visaType = f.visa_type || f.residence_type;
      }
      if (f.entry_permit || f.permit_number) {
        fields.entryPermitNumber = f.entry_permit || f.permit_number;
      }
      if (f.sponsor_name || f.sponsor) {
        fields.sponsorName = f.sponsor_name || f.sponsor;
      }
      if (f.sponsor_id) {
        fields.sponsorId = f.sponsor_id;
      }
      if (f.issue_date) {
        fields.visaIssueDate = f.issue_date;
      }
      if (f.expiry_date) {
        fields.visaExpiryDate = f.expiry_date;
      }
    }
  }

  private extractLaborCardFields(structuredData: Record<string, any>, fields: Record<string, any>): void {
    if (structuredData.fields) {
      const f = structuredData.fields;
      if (f.card_number || f.labor_card_no) {
        fields.laborCardNumber = f.card_number || f.labor_card_no;
      }
      if (f.occupation || f.job_title || f.designation) {
        fields.occupation = f.occupation || f.job_title || f.designation;
      }
      if (f.employer || f.company_name) {
        fields.employer = f.employer || f.company_name;
      }
      if (f.salary || f.basic_salary) {
        fields.salary = f.salary || f.basic_salary;
      }
      if (f.expiry_date) {
        fields.laborCardExpiry = f.expiry_date;
      }
    }
  }

  private extractGenericFields(structuredData: Record<string, any>, fields: Record<string, any>): void {
    if (structuredData.email) {
      fields.email = structuredData.email[0];
    }
    if (structuredData.phone) {
      fields.phone = structuredData.phone[0];
    }
    if (structuredData.fields) {
      Object.assign(fields, structuredData.fields);
    }
  }

  private extractCommonPatterns(structuredData: Record<string, any>, fields: Record<string, any>): void {
    if (structuredData.email && structuredData.email.length > 0 && !fields.email) {
      fields.email = structuredData.email[0];
    }
    if (structuredData.phone && structuredData.phone.length > 0 && !fields.phone) {
      fields.phone = structuredData.phone[0];
    }
  }
}

// Export singleton instance
export const clientDocumentFieldService = new ClientDocumentFieldService();

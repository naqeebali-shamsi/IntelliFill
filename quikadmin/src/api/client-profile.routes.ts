/**
 * Client Profile API Routes
 *
 * Manages unified client profile data extracted from documents
 * Profiles aggregate data from all client documents with source tracking
 *
 * Task 9: API: Client Profile Endpoints
 */

import { Router, Response, NextFunction } from 'express';
import { authenticateSupabase, AuthenticatedRequest } from '../middleware/supabaseAuth';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { prisma } from '../utils/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

// Profile data field schema
const profileFieldSchema = z.object({
  value: z.unknown(),
  manuallyEdited: z.boolean().optional(),
});

// Update profile schema
const updateProfileSchema = z.object({
  data: z.record(z.unknown()).optional(),
  fields: z.record(profileFieldSchema).optional(),
});

// Standard profile fields for UAE PRO agencies
const STANDARD_PROFILE_FIELDS = {
  // Personal Information
  fullName: { category: 'personal', label: 'Full Name' },
  fullNameArabic: { category: 'personal', label: 'Full Name (Arabic)' },
  nationality: { category: 'personal', label: 'Nationality' },
  dateOfBirth: { category: 'personal', label: 'Date of Birth' },
  gender: { category: 'personal', label: 'Gender' },
  placeOfBirth: { category: 'personal', label: 'Place of Birth' },
  motherName: { category: 'personal', label: "Mother's Name" },
  fatherName: { category: 'personal', label: "Father's Name" },
  maritalStatus: { category: 'personal', label: 'Marital Status' },
  religion: { category: 'personal', label: 'Religion' },

  // Passport Details
  passportNumber: { category: 'passport', label: 'Passport Number' },
  passportIssueDate: { category: 'passport', label: 'Issue Date' },
  passportExpiryDate: { category: 'passport', label: 'Expiry Date' },
  passportIssuePlace: { category: 'passport', label: 'Place of Issue' },
  passportType: { category: 'passport', label: 'Passport Type' },

  // Emirates ID
  emiratesId: { category: 'emiratesId', label: 'Emirates ID Number' },
  emiratesIdExpiry: { category: 'emiratesId', label: 'Expiry Date' },
  emiratesIdIssueDate: { category: 'emiratesId', label: 'Issue Date' },

  // Visa Details
  visaNumber: { category: 'visa', label: 'Visa Number' },
  visaType: { category: 'visa', label: 'Visa Type' },
  visaIssueDate: { category: 'visa', label: 'Issue Date' },
  visaExpiryDate: { category: 'visa', label: 'Expiry Date' },
  visaStatus: { category: 'visa', label: 'Status' },
  entryPermitNumber: { category: 'visa', label: 'Entry Permit Number' },
  sponsorName: { category: 'visa', label: 'Sponsor Name' },
  sponsorId: { category: 'visa', label: 'Sponsor ID' },

  // Company Details (if client is a company)
  companyNameEn: { category: 'company', label: 'Company Name (English)' },
  companyNameAr: { category: 'company', label: 'Company Name (Arabic)' },
  tradeLicenseNumber: { category: 'company', label: 'Trade License Number' },
  tradeLicenseExpiry: { category: 'company', label: 'License Expiry Date' },
  tradeLicenseIssueDate: { category: 'company', label: 'License Issue Date' },
  legalType: { category: 'company', label: 'Legal Type' },
  activities: { category: 'company', label: 'Business Activities' },
  establishmentDate: { category: 'company', label: 'Establishment Date' },
  registrationNumber: { category: 'company', label: 'Registration Number' },
  freeZone: { category: 'company', label: 'Free Zone' },

  // Contact Information
  email: { category: 'contact', label: 'Email' },
  phone: { category: 'contact', label: 'Phone' },
  mobile: { category: 'contact', label: 'Mobile' },
  fax: { category: 'contact', label: 'Fax' },
  address: { category: 'contact', label: 'Address' },
  poBox: { category: 'contact', label: 'P.O. Box' },
  city: { category: 'contact', label: 'City' },
  emirate: { category: 'contact', label: 'Emirate' },
  country: { category: 'contact', label: 'Country' },

  // Employment (for individuals)
  occupation: { category: 'employment', label: 'Occupation' },
  employer: { category: 'employment', label: 'Employer' },
  designation: { category: 'employment', label: 'Designation' },
  salary: { category: 'employment', label: 'Salary' },
  laborCardNumber: { category: 'employment', label: 'Labor Card Number' },
  laborCardExpiry: { category: 'employment', label: 'Labor Card Expiry' },
};

export function createClientProfileRoutes(): Router {
  const router = Router({ mergeParams: true }); // Enable access to :clientId from parent

  /**
   * GET /api/clients/:clientId/profile - Get client profile data
   */
  router.get(
    '/',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;
        const { clientId } = req.params;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify client belongs to user
        const client = await prisma.client.findFirst({
          where: { id: clientId, userId },
          include: {
            profile: true,
          },
        });

        if (!client) {
          return res.status(404).json({ error: 'Client not found' });
        }

        // If no profile exists, create one
        let profile = client.profile;
        if (!profile) {
          profile = await prisma.clientProfile.create({
            data: {
              clientId,
              data: {},
              fieldSources: {},
            },
          });
        }

        // Decrypt profile data (handles both encrypted and legacy formats)
        let profileData: Record<string, unknown> = {};
        if (profile.data) {
          if (typeof profile.data === 'string') {
            const { decryptJSON } = await import('../utils/encryption');
            try {
              profileData = decryptJSON(profile.data as string);
            } catch {
              profileData = JSON.parse(profile.data as string);
            }
          } else {
            profileData = profile.data as Record<string, unknown>;
          }
        }
        const fieldSources = (profile.fieldSources || {}) as Record<string, unknown>;

        const categorizedData: Record<
          string,
          Record<string, { value: unknown; label: string; source: unknown }>
        > = {
          personal: {},
          passport: {},
          emiratesId: {},
          visa: {},
          company: {},
          contact: {},
          employment: {},
          custom: {},
        };

        // Categorize known fields
        for (const [fieldName, value] of Object.entries(profileData)) {
          const fieldInfo =
            STANDARD_PROFILE_FIELDS[fieldName as keyof typeof STANDARD_PROFILE_FIELDS];
          if (fieldInfo) {
            categorizedData[fieldInfo.category][fieldName] = {
              value,
              label: fieldInfo.label,
              source: fieldSources[fieldName] || null,
            };
          } else {
            // Custom field
            categorizedData.custom[fieldName] = {
              value,
              label: fieldName,
              source: fieldSources[fieldName] || null,
            };
          }
        }

        // Detect expired document date fields
        const EXPIRY_FIELDS = [
          'passportExpiryDate',
          'emiratesIdExpiry',
          'visaExpiryDate',
          'tradeLicenseExpiry',
          'laborCardExpiry',
        ] as const;

        const now = new Date();
        const expiredFields: Array<{
          field: string;
          label: string;
          value: string;
          expiredSince: string;
        }> = [];

        for (const fieldName of EXPIRY_FIELDS) {
          const rawValue = profileData[fieldName];
          if (!rawValue || typeof rawValue !== 'string') continue;

          const parsed = new Date(rawValue);
          if (isNaN(parsed.getTime())) continue;

          if (parsed < now) {
            const fieldInfo = STANDARD_PROFILE_FIELDS[fieldName];
            expiredFields.push({
              field: fieldName,
              label: fieldInfo?.label || fieldName,
              value: rawValue,
              expiredSince: parsed.toISOString(),
            });
          }
        }

        res.json({
          success: true,
          data: {
            clientId,
            clientName: client.name,
            clientType: client.type,
            profile: {
              id: profile.id,
              data: profileData,
              categorizedData,
              fieldSources,
              expiredFields: expiredFields.length > 0 ? expiredFields : undefined,
              updatedAt: profile.updatedAt.toISOString(),
            },
            fieldDefinitions: STANDARD_PROFILE_FIELDS,
          },
        });
      } catch (error) {
        logger.error('Error fetching client profile:', error);
        next(error);
      }
    }
  );

  /**
   * PUT /api/clients/:clientId/profile - Update client profile data
   * Marks manually edited fields to prevent overwriting during extraction
   */
  router.put(
    '/',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;
        const { clientId } = req.params;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Validate request body
        const validation = updateProfileSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            error: 'Validation failed',
            details: validation.error.flatten().fieldErrors,
          });
        }

        // Verify client belongs to user
        const client = await prisma.client.findFirst({
          where: { id: clientId, userId },
          include: { profile: true },
        });

        if (!client) {
          return res.status(404).json({ error: 'Client not found' });
        }

        const { data, fields } = validation.data;

        // Get or create profile
        let profile = client.profile;
        if (!profile) {
          profile = await prisma.clientProfile.create({
            data: {
              clientId,
              data: {},
              fieldSources: {},
            },
          });
        }

        let currentData: Record<string, any> = {};
        if (profile.data) {
          if (typeof profile.data === 'string') {
            const { decryptJSON } = await import('../utils/encryption');
            try {
              currentData = decryptJSON(profile.data as string);
            } catch {
              currentData = JSON.parse(profile.data as string);
            }
          } else {
            currentData = profile.data as Record<string, any>;
          }
        }
        const currentFieldSources = (profile.fieldSources || {}) as Record<string, any>;

        // Update data
        const newData = { ...currentData };
        const newFieldSources = { ...currentFieldSources };

        if (data) {
          // Simple data update (all fields marked as manually edited)
          for (const [key, value] of Object.entries(data)) {
            newData[key] = value;
            newFieldSources[key] = {
              ...(currentFieldSources[key] || {}),
              manuallyEdited: true,
              editedAt: new Date().toISOString(),
            };
          }
        }

        if (fields) {
          // Detailed field update with metadata
          for (const [key, fieldData] of Object.entries(fields)) {
            newData[key] = fieldData.value;
            newFieldSources[key] = {
              ...(currentFieldSources[key] || {}),
              manuallyEdited: fieldData.manuallyEdited !== false,
              editedAt: new Date().toISOString(),
            };
          }
        }

        // Update profile (encrypt PII data before storing)
        const { encryptJSON } = await import('../utils/encryption');
        const updatedProfile = await prisma.clientProfile.update({
          where: { id: profile.id },
          data: {
            data: encryptJSON(newData),
            fieldSources: newFieldSources,
          },
        });

        logger.info(`Profile updated for client: ${clientId} by user: ${userId}`);

        res.json({
          success: true,
          message: 'Profile updated successfully',
          data: {
            profile: {
              id: updatedProfile.id,
              data: newData as Prisma.InputJsonValue,
              fieldSources: newFieldSources as Prisma.InputJsonValue,
              updatedAt: updatedProfile.updatedAt.toISOString(),
            },
          },
        });
      } catch (error) {
        logger.error('Error updating client profile:', error);
        next(error);
      }
    }
  );

  /**
   * PATCH /api/clients/:clientId/profile/fields/:fieldName - Update a single field
   */
  router.patch(
    '/fields/:fieldName',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;
        const { clientId, fieldName } = req.params;
        const { value } = req.body;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        if (value === undefined) {
          return res.status(400).json({ error: 'Value is required' });
        }

        // Verify client belongs to user
        const client = await prisma.client.findFirst({
          where: { id: clientId, userId },
          include: { profile: true },
        });

        if (!client) {
          return res.status(404).json({ error: 'Client not found' });
        }

        // Get or create profile
        let profile = client.profile;
        if (!profile) {
          profile = await prisma.clientProfile.create({
            data: {
              clientId,
              data: {},
              fieldSources: {},
            },
          });
        }

        let currentData: Record<string, any> = {};
        if (profile.data) {
          if (typeof profile.data === 'string') {
            const { decryptJSON } = await import('../utils/encryption');
            try {
              currentData = decryptJSON(profile.data as string);
            } catch {
              currentData = JSON.parse(profile.data as string);
            }
          } else {
            currentData = profile.data as Record<string, any>;
          }
        }
        const currentFieldSources = (profile.fieldSources || {}) as Record<string, any>;

        // Update single field
        const newData = { ...currentData, [fieldName]: value };
        const newFieldSources = {
          ...currentFieldSources,
          [fieldName]: {
            ...(currentFieldSources[fieldName] || {}),
            manuallyEdited: true,
            editedAt: new Date().toISOString(),
          },
        };

        // Update profile (encrypt PII data before storing)
        const { encryptJSON } = await import('../utils/encryption');
        await prisma.clientProfile.update({
          where: { id: profile.id },
          data: {
            data: encryptJSON(newData) as unknown as Prisma.InputJsonValue,
            fieldSources: newFieldSources as Prisma.InputJsonValue,
          },
        });

        logger.info(`Profile field '${fieldName}' updated for client: ${clientId}`);

        res.json({
          success: true,
          message: `Field '${fieldName}' updated successfully`,
          data: {
            fieldName,
            value,
            manuallyEdited: true,
          },
        });
      } catch (error) {
        logger.error('Error updating profile field:', error);
        next(error);
      }
    }
  );

  /**
   * DELETE /api/clients/:clientId/profile/fields/:fieldName - Remove a field from profile
   */
  router.delete(
    '/fields/:fieldName',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;
        const { clientId, fieldName } = req.params;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify client belongs to user
        const client = await prisma.client.findFirst({
          where: { id: clientId, userId },
          include: { profile: true },
        });

        if (!client) {
          return res.status(404).json({ error: 'Client not found' });
        }

        if (!client.profile) {
          return res.status(404).json({ error: 'Profile not found' });
        }

        let currentData: Record<string, unknown> = {};
        if (client.profile.data) {
          if (typeof client.profile.data === 'string') {
            const { decryptJSON } = await import('../utils/encryption');
            try {
              currentData = decryptJSON(client.profile.data as string);
            } catch {
              currentData = JSON.parse(client.profile.data as string);
            }
          } else {
            currentData = client.profile.data as Record<string, unknown>;
          }
        }
        const currentFieldSources = (client.profile.fieldSources || {}) as Record<string, unknown>;

        // Remove field
        const { [fieldName]: removedData, ...newData } = currentData;
        const { [fieldName]: removedSource, ...newFieldSources } = currentFieldSources;

        // Update profile (encrypt PII data before storing)
        const { encryptJSON } = await import('../utils/encryption');
        await prisma.clientProfile.update({
          where: { id: client.profile.id },
          data: {
            data: encryptJSON(newData) as unknown as Prisma.InputJsonValue,
            fieldSources: newFieldSources as Prisma.InputJsonValue,
          },
        });

        logger.info(`Profile field '${fieldName}' removed for client: ${clientId}`);

        res.json({
          success: true,
          message: `Field '${fieldName}' removed successfully`,
        });
      } catch (error) {
        logger.error('Error removing profile field:', error);
        next(error);
      }
    }
  );

  /**
   * GET /api/clients/:clientId/profile/export - Export profile data
   */
  router.get(
    '/export',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;
        const { clientId } = req.params;
        const format = (req.query.format as string) || 'json';

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify client belongs to user
        const client = await prisma.client.findFirst({
          where: { id: clientId, userId },
          include: { profile: true },
        });

        if (!client) {
          return res.status(404).json({ error: 'Client not found' });
        }

        let profileData: Record<string, unknown> = {};
        if (client.profile?.data) {
          if (typeof client.profile.data === 'string') {
            const { decryptJSON } = await import('../utils/encryption');
            try {
              profileData = decryptJSON(client.profile.data as string);
            } catch {
              profileData = JSON.parse(client.profile.data as string);
            }
          } else {
            profileData = client.profile.data as Record<string, unknown>;
          }
        }

        if (format === 'csv') {
          // Export as CSV
          const rows = Object.entries(profileData).map(([key, value]) => {
            const fieldInfo = STANDARD_PROFILE_FIELDS[key as keyof typeof STANDARD_PROFILE_FIELDS];
            return `"${fieldInfo?.label || key}","${String(value).replace(/"/g, '""')}"`;
          });
          const csv = `"Field","Value"\n${rows.join('\n')}`;

          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="${client.name}-profile.csv"`);
          return res.send(csv);
        }

        // Default: JSON export
        res.json({
          success: true,
          data: {
            client: {
              id: client.id,
              name: client.name,
              type: client.type,
            },
            profile: profileData,
            exportedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        logger.error('Error exporting profile:', error);
        next(error);
      }
    }
  );

  /**
   * GET /api/clients/:clientId/profile/fields - Get available field definitions
   */
  router.get('/fields', authenticateSupabase, async (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: {
        fields: STANDARD_PROFILE_FIELDS,
        categories: {
          personal: 'Personal Information',
          passport: 'Passport Details',
          emiratesId: 'Emirates ID',
          visa: 'Visa Details',
          company: 'Company Details',
          contact: 'Contact Information',
          employment: 'Employment Details',
          custom: 'Custom Fields',
        },
      },
    });
  });

  return router;
}

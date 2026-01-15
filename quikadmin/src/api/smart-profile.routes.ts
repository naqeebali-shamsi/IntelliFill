/**
 * Smart Profile Routes
 *
 * API endpoints for the Smart Profile UX flow - simplified document-to-form workflow.
 * Supports document type detection and batch extraction.
 *
 * @module api/smart-profile.routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { authenticateSupabase } from '../middleware/supabaseAuth';
import { classifyDocument } from '../multiagent/agents/classifierAgent';
import { extractDocumentData, LOW_CONFIDENCE_THRESHOLD } from '../multiagent/agents/extractorAgent';
import { DocumentCategory } from '../multiagent/types/state';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { validateFilePath } from '../utils/encryption';
import { OCRService } from '../services/OCRService';
import {
  personGroupingService,
  DocumentExtraction,
  PersonGroup,
  SuggestedMerge,
} from '../services/PersonGroupingService';

// ============================================================================
// Types
// ============================================================================

interface DetectionResult {
  fileId: string;
  fileName: string;
  detectedType: string;
  confidence: number;
  alternativeTypes?: Array<{ type: string; confidence: number }>;
  metadata?: {
    language?: string;
    hasPhoto?: boolean;
  };
  error?: string;
}

interface DetectTypesResponse {
  success: boolean;
  results: DetectionResult[];
  totalFiles: number;
  detectedCount: number;
  errorCount: number;
}

interface FieldSource {
  documentId: string;
  documentName: string;
  confidence: number;
  extractedAt: string;
}

interface LowConfidenceField {
  fieldName: string;
  value: unknown;
  confidence: number;
  documentId: string;
  documentName: string;
}

/**
 * Per-file error tracking for batch extraction
 */
interface FileError {
  fileId: string;
  fileName: string;
  error: string;
  stage: 'ocr' | 'extraction' | 'merge';
}

interface DetectedPerson {
  id: string;
  name: string | null;
  confidence: number;
  documentIds: string[];
}

interface ExtractBatchResponse {
  success: boolean;
  profileData: Record<string, unknown>;
  fieldSources: Record<string, FieldSource>;
  lowConfidenceFields: LowConfidenceField[];
  errors: FileError[];
  processingTime: number;
  documentsProcessed: number;
  successfulDocuments: number;
  totalFieldsExtracted: number;
  // Person grouping data
  detectedPeople: DetectedPerson[];
  suggestedMerges?: Array<{
    groupIds: [string, string];
    confidence: number;
    reason: string;
  }>;
}

// ============================================================================
// Multer Configuration
// ============================================================================

// Configure multer storage for temporary file handling
const storage = multer.diskStorage({
  destination: 'uploads/smart-profile/',
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `detect_${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 20, // Max 20 files per request
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();

    try {
      // Validate filename for path traversal
      validateFilePath(file.originalname);

      if (allowedTypes.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${ext} not supported. Allowed: PDF, JPG, PNG`));
      }
    } catch (error) {
      cb(error as Error);
    }
  },
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert file to base64 for image classification
 */
async function fileToBase64(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return buffer.toString('base64');
}

/**
 * Extract text from PDF using basic parsing
 * For full OCR, the batch extraction endpoint uses the multiagent pipeline
 */
async function extractTextFromPdf(filePath: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    logger.warn('PDF text extraction failed, will use image-based classification', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return '';
  }
}

/**
 * Map DocumentCategory to frontend DocumentType
 * Frontend uses: PASSPORT, EMIRATES_ID, DRIVERS_LICENSE, BANK_STATEMENT, OTHER
 */
function mapCategoryToFrontendType(category: string): string {
  const mapping: Record<string, string> = {
    PASSPORT: 'PASSPORT',
    EMIRATES_ID: 'EMIRATES_ID',
    ID_CARD: 'DRIVERS_LICENSE', // Map generic ID to drivers license
    VISA: 'OTHER',
    TRADE_LICENSE: 'OTHER',
    LABOR_CARD: 'OTHER',
    ESTABLISHMENT_CARD: 'OTHER',
    MOA: 'OTHER',
    BANK_STATEMENT: 'BANK_STATEMENT',
    INVOICE: 'OTHER',
    CONTRACT: 'OTHER',
    UNKNOWN: 'OTHER',
  };
  return mapping[category] || 'OTHER';
}

/**
 * Clean up temporary files
 */
async function cleanupFiles(filePaths: string[]): Promise<void> {
  for (const filePath of filePaths) {
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * POST /api/smart-profile/detect-types
 *
 * Detect document types from uploaded files.
 * Accepts multipart/form-data with files[] array.
 *
 * Returns classification results with confidence scores.
 */
async function detectTypesHandler(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const files = req.files as Express.Multer.File[];
  const filePaths: string[] = [];

  try {
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files provided',
        message: 'Please upload at least one file (PDF, JPG, or PNG)',
      });
    }

    logger.info('Starting document type detection', {
      fileCount: files.length,
      userId: (req as any).user?.id,
    });

    const results: DetectionResult[] = [];
    let detectedCount = 0;
    let errorCount = 0;

    // Process each file
    for (const file of files) {
      filePaths.push(file.path);
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      try {
        const ext = path.extname(file.originalname).toLowerCase();
        let text = '';
        let imageBase64: string | undefined;

        // Extract content based on file type
        if (ext === '.pdf') {
          // Try text extraction from PDF
          text = await extractTextFromPdf(file.path);
          // If no text, convert first page to image for classification
          if (!text || text.trim().length < 50) {
            // For PDFs with minimal text, use image classification
            // The classifyDocument can work with just the filename hints
            text = `PDF document: ${file.originalname}`;
          }
        } else {
          // Image file - convert to base64
          imageBase64 = await fileToBase64(file.path);
          text = `Image document: ${file.originalname}`;
        }

        // Classify the document
        const classification = await classifyDocument(text, imageBase64);

        // Map to frontend type
        const frontendType = mapCategoryToFrontendType(classification.documentType);

        // Determine if detection was successful (confidence >= 60%)
        const isDetected = classification.confidence >= 60;

        results.push({
          fileId,
          fileName: file.originalname,
          detectedType: isDetected ? frontendType : 'OTHER',
          confidence: classification.confidence / 100, // Convert to 0-1 scale for frontend
          alternativeTypes: classification.alternativeTypes?.map((alt) => ({
            type: mapCategoryToFrontendType(alt.type),
            confidence: alt.confidence / 100,
          })),
          metadata: classification.metadata,
        });

        if (isDetected) {
          detectedCount++;
        }

        logger.debug('File classified', {
          fileId,
          fileName: file.originalname,
          detectedType: frontendType,
          confidence: classification.confidence,
        });
      } catch (fileError) {
        errorCount++;
        results.push({
          fileId,
          fileName: file.originalname,
          detectedType: 'OTHER',
          confidence: 0,
          error: fileError instanceof Error ? fileError.message : 'Classification failed',
        });

        logger.warn('File classification failed', {
          fileId,
          fileName: file.originalname,
          error: fileError instanceof Error ? fileError.message : 'Unknown error',
        });
      }
    }

    const processingTime = Date.now() - startTime;

    logger.info('Document type detection completed', {
      totalFiles: files.length,
      detectedCount,
      errorCount,
      processingTimeMs: processingTime,
    });

    const response: DetectTypesResponse = {
      success: true,
      results,
      totalFiles: files.length,
      detectedCount,
      errorCount,
    };

    res.json(response);
  } catch (error) {
    next(error);
  } finally {
    // Clean up temporary files
    await cleanupFiles(filePaths);
  }
}

/**
 * Map frontend document type to backend DocumentCategory
 */
function mapFrontendTypeToCategory(frontendType: string): DocumentCategory {
  const mapping: Record<string, DocumentCategory> = {
    PASSPORT: 'PASSPORT',
    EMIRATES_ID: 'EMIRATES_ID',
    DRIVERS_LICENSE: 'ID_CARD',
    BANK_STATEMENT: 'BANK_STATEMENT',
    OTHER: 'UNKNOWN',
  };
  return mapping[frontendType] || 'UNKNOWN';
}

/**
 * Map profile field names from extractor to user-friendly names
 */
function mapFieldToProfileKey(fieldName: string): string {
  // Normalize field names to camelCase for profile data
  const mappings: Record<string, string> = {
    full_name: 'fullName',
    full_name_arabic: 'fullNameArabic',
    surname: 'surname',
    given_names: 'givenNames',
    passport_number: 'passportNumber',
    emirates_id: 'emiratesId',
    nationality: 'nationality',
    date_of_birth: 'dateOfBirth',
    place_of_birth: 'placeOfBirth',
    date_of_issue: 'dateOfIssue',
    date_of_expiry: 'dateOfExpiry',
    issuing_authority: 'issuingAuthority',
    sex: 'gender',
    visa_number: 'visaNumber',
    visa_type: 'visaType',
    sponsor: 'sponsor',
    occupation: 'occupation',
    employer: 'employer',
    license_number: 'licenseNumber',
    company_name: 'companyName',
    account_number: 'accountNumber',
    iban: 'iban',
    bank_name: 'bankName',
    card_number: 'cardNumber',
  };
  return mappings[fieldName] || fieldName.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * POST /api/smart-profile/extract-batch
 *
 * Extract data from multiple documents and merge into unified profile.
 * Accepts multipart/form-data with:
 * - files[]: Array of document files
 * - documentTypes[]: Array of document types (matching files array)
 *
 * Returns:
 * - profileData: Merged profile fields (highest confidence wins)
 * - fieldSources: Which document each field came from
 * - lowConfidenceFields: Fields below 85% confidence threshold
 */
async function extractBatchHandler(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const files = req.files as Express.Multer.File[];
  const filePaths: string[] = [];

  try {
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files provided',
        message: 'Please upload at least one file for extraction',
      });
    }

    // Parse document types from request body
    const documentTypesRaw = req.body.documentTypes;
    const documentTypes: string[] = Array.isArray(documentTypesRaw)
      ? documentTypesRaw
      : typeof documentTypesRaw === 'string'
        ? [documentTypesRaw]
        : [];

    // Validate we have types for all files
    if (documentTypes.length !== files.length) {
      return res.status(400).json({
        success: false,
        error: 'Mismatched file and type count',
        message: `Received ${files.length} files but ${documentTypes.length} document types`,
      });
    }

    logger.info('Starting batch extraction', {
      fileCount: files.length,
      documentTypes,
      userId: (req as any).user?.id,
    });

    // Initialize OCR service for text extraction
    const ocrService = new OCRService();

    // Profile data accumulator - stores highest confidence value per field
    const profileData: Record<string, unknown> = {};
    const fieldSources: Record<string, FieldSource> = {};
    const lowConfidenceFields: LowConfidenceField[] = [];
    const errors: FileError[] = [];
    let successfulDocuments = 0;

    // Document extractions for person grouping
    const documentExtractions: DocumentExtraction[] = [];

    // Low confidence threshold (85% = 0.85)
    const LOW_CONF_THRESHOLD = 85;

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const documentType = documentTypes[i];
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      filePaths.push(file.path);

      try {
        const ext = path.extname(file.originalname).toLowerCase();
        let ocrText = '';
        let imageBase64: string | undefined;

        // Map frontend type to backend category
        const category = mapFrontendTypeToCategory(documentType);

        // Extract text from document (OCR stage)
        try {
          if (ext === '.pdf') {
            // Process PDF with OCR service (needed for multi-page docs)
            const ocrResult = await ocrService.processPDF(file.path);
            ocrText = ocrResult.text;
            logger.debug(
              `PDF OCR completed: ${ocrText.length} chars, ${ocrResult.confidence}% confidence`
            );
          } else {
            // For ALL images: use Gemini vision directly - it's better than Tesseract
            imageBase64 = await fileToBase64(file.path);
            ocrText = `[Image: ${file.originalname}]`;
            logger.debug(`Image file - using Gemini vision for extraction`);
          }
        } catch (ocrError) {
          errors.push({
            fileId,
            fileName: file.originalname,
            error: ocrError instanceof Error ? ocrError.message : 'OCR processing failed',
            stage: 'ocr',
          });
          logger.warn('OCR processing failed', {
            fileId,
            fileName: file.originalname,
            error: ocrError instanceof Error ? ocrError.message : 'Unknown error',
          });
          continue; // Skip to next file
        }

        // Extract structured data using the extractor agent (extraction stage)
        let extractionResult;
        try {
          extractionResult = await extractDocumentData(ocrText, category, imageBase64);
        } catch (extractionError) {
          errors.push({
            fileId,
            fileName: file.originalname,
            error:
              extractionError instanceof Error ? extractionError.message : 'Data extraction failed',
            stage: 'extraction',
          });
          logger.warn('Data extraction failed', {
            fileId,
            fileName: file.originalname,
            error: extractionError instanceof Error ? extractionError.message : 'Unknown error',
          });
          continue; // Skip to next file
        }

        logger.debug(`Extraction completed for ${file.originalname}`, {
          fieldsExtracted: Object.keys(extractionResult.fields).length,
          category,
          processingTime: extractionResult.processingTime,
        });

        // Merge extracted fields into profile (merge stage)
        try {
          const extractedAt = new Date().toISOString();
          for (const [fieldName, fieldResult] of Object.entries(extractionResult.fields)) {
            const profileKey = mapFieldToProfileKey(fieldName);
            const confidence = fieldResult.confidence;

            // Check if this field already exists with higher confidence
            const existingSource = fieldSources[profileKey];
            if (existingSource && existingSource.confidence >= confidence) {
              // Existing value has higher or equal confidence, skip
              continue;
            }

            // Store this value (it has higher confidence or is new)
            profileData[profileKey] = fieldResult.value;
            fieldSources[profileKey] = {
              documentId: fileId,
              documentName: file.originalname,
              confidence,
              extractedAt,
            };

            // Track low confidence fields for review
            if (confidence < LOW_CONF_THRESHOLD && fieldResult.value !== null) {
              // Remove any existing low-confidence entry for this field (if being replaced)
              const existingLowConfIdx = lowConfidenceFields.findIndex(
                (f) => f.fieldName === profileKey
              );
              if (existingLowConfIdx >= 0) {
                lowConfidenceFields.splice(existingLowConfIdx, 1);
              }

              lowConfidenceFields.push({
                fieldName: profileKey,
                value: fieldResult.value,
                confidence,
                documentId: fileId,
                documentName: file.originalname,
              });
            }
          }
        } catch (mergeError) {
          errors.push({
            fileId,
            fileName: file.originalname,
            error: mergeError instanceof Error ? mergeError.message : 'Field merge failed',
            stage: 'merge',
          });
          logger.warn('Field merge failed', {
            fileId,
            fileName: file.originalname,
            error: mergeError instanceof Error ? mergeError.message : 'Unknown error',
          });
          continue; // Skip to next file
        }

        // File processed successfully
        successfulDocuments++;

        // Collect extraction data for person grouping
        // Extract name and ID fields for grouping
        const nameField =
          extractionResult.fields['full_name'] ||
          extractionResult.fields['fullName'] ||
          extractionResult.fields['name'];
        const idField =
          extractionResult.fields['emirates_id'] ||
          extractionResult.fields['emiratesId'] ||
          extractionResult.fields['passport_number'] ||
          extractionResult.fields['passportNumber'] ||
          extractionResult.fields['id_number'] ||
          extractionResult.fields['idNumber'];

        documentExtractions.push({
          documentId: fileId,
          fileName: file.originalname,
          extractedName: nameField?.value as string | null,
          extractedIdNumber: idField?.value as string | null,
          fields: extractionResult.fields,
        });

        logger.debug(`Merged fields from ${file.originalname}`, {
          totalProfileFields: Object.keys(profileData).length,
          lowConfidenceCount: lowConfidenceFields.length,
        });
      } catch (fileError) {
        // Catch-all for unexpected errors
        errors.push({
          fileId,
          fileName: file.originalname,
          error: fileError instanceof Error ? fileError.message : 'Unknown error',
          stage: 'extraction',
        });
        logger.warn('File extraction failed (unexpected)', {
          fileId,
          fileName: file.originalname,
          error: fileError instanceof Error ? fileError.message : 'Unknown error',
        });
        // Continue processing other files
      }
    }

    // Clean up OCR service
    await ocrService.cleanup();

    const processingTime = Date.now() - startTime;

    // Perform person grouping on successful extractions
    const groupingResult = personGroupingService.groupDocuments(documentExtractions);

    // Convert PersonGroups to DetectedPerson format for response
    const detectedPeople: DetectedPerson[] = groupingResult.groups.map((group) => ({
      id: group.id,
      name: group.name,
      confidence: group.confidence,
      documentIds: group.documentIds,
    }));

    logger.info('Batch extraction completed', {
      documentsProcessed: files.length,
      successfulDocuments,
      errorCount: errors.length,
      totalFieldsExtracted: Object.keys(profileData).length,
      lowConfidenceFieldCount: lowConfidenceFields.length,
      detectedPeopleCount: detectedPeople.length,
      suggestedMergeCount: groupingResult.suggestedMerges.length,
      processingTimeMs: processingTime,
    });

    // success is true ONLY if all files processed without errors
    const response: ExtractBatchResponse = {
      success: errors.length === 0,
      profileData,
      fieldSources,
      lowConfidenceFields,
      errors,
      processingTime,
      documentsProcessed: files.length,
      successfulDocuments,
      totalFieldsExtracted: Object.keys(profileData).length,
      detectedPeople,
      suggestedMerges:
        groupingResult.suggestedMerges.length > 0 ? groupingResult.suggestedMerges : undefined,
    };

    res.json(response);
  } catch (error) {
    next(error);
  } finally {
    // Clean up temporary files
    await cleanupFiles(filePaths);
  }
}

// ============================================================================
// Router Setup
// ============================================================================

export function createSmartProfileRoutes(): Router {
  const router = Router();

  // Ensure upload directory exists
  const uploadDir = 'uploads/smart-profile';
  fs.mkdir(uploadDir, { recursive: true }).catch(() => {
    // Directory might already exist
  });

  // POST /api/smart-profile/detect-types
  // Accepts multipart/form-data with files[] array
  router.post('/detect-types', authenticateSupabase, upload.array('files', 20), detectTypesHandler);

  // POST /api/smart-profile/extract-batch
  // Accepts multipart/form-data with files[] and documentTypes[]
  router.post(
    '/extract-batch',
    authenticateSupabase,
    upload.array('files', 20),
    extractBatchHandler
  );

  return router;
}

export default createSmartProfileRoutes;

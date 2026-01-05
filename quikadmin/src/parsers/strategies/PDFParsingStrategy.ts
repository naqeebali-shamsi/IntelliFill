/**
 * PDF Parsing Strategy
 * Handles PDF document parsing with OCR fallback
 */

import { BaseParsingStrategy, ParsedDocument } from './ParsingStrategy';
import { PDFDocument } from 'pdf-lib';
import { logger } from '../../utils/logger';
import { OCRService } from '../../services/OCRService';
import { getFileBuffer } from '../../utils/fileReader';

export class PDFParsingStrategy extends BaseParsingStrategy {
  protected extensions = ['pdf'];
  protected strategyName = 'PDF Parser';
  protected priority = 10;

  private ocrService: OCRService;
  private useOCRFallback: boolean;

  constructor(options: { useOCRFallback?: boolean } = {}) {
    super();
    this.useOCRFallback = options.useOCRFallback ?? true;
    this.ocrService = new OCRService();
  }

  async parse(pathOrUrl: string): Promise<ParsedDocument> {
    try {
      logger.info(`Parsing PDF: ${pathOrUrl}`);

      // Use shared fileReader utility for both local paths and R2 URLs
      const pdfBytes = await getFileBuffer(pathOrUrl);
      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

      // Get metadata
      const metadata = await this.extractMetadata(pdfDoc, pathOrUrl);

      // Try to extract text (pdf-lib doesn't support text extraction directly)
      let content = '';
      let requiresOCR = true;
      let confidence = 0;

      // Check if PDF has extractable text
      // In production, use pdf-parse or pdfjs-dist for text extraction
      try {
        // For now, we'll use a placeholder or OCR
        if (this.useOCRFallback) {
          logger.info('Using OCR for PDF text extraction');
          const ocrResult = await this.ocrService.processPDF(pathOrUrl);
          content = ocrResult.text;
          confidence = ocrResult.confidence;
          requiresOCR = false;
        } else {
          // Placeholder for when pdf-parse is integrated
          content = await this.extractTextWithPdfParse(pathOrUrl);
          requiresOCR = content.trim().length === 0;
        }
      } catch (error) {
        logger.warn('Failed to extract text from PDF, OCR may be required', error);
        requiresOCR = true;
      }

      // Extract form fields if present
      const structuredData = await this.extractFormFields(pdfDoc);

      return {
        type: 'pdf',
        content,
        metadata,
        structuredData,
        requiresOCR,
        confidence,
      };
    } catch (error) {
      logger.error('PDF parsing error:', error);
      throw new Error(`Failed to parse PDF: ${error}`);
    } finally {
      // Cleanup OCR service if used
      if (this.ocrService) {
        await this.ocrService.cleanup();
      }
    }
  }

  private async extractMetadata(pdfDoc: PDFDocument, filePath: string): Promise<any> {
    const baseMetadata = await this.getFileMetadata(filePath);

    return {
      ...baseMetadata,
      pageCount: pdfDoc.getPageCount(),
      title: pdfDoc.getTitle(),
      author: pdfDoc.getAuthor(),
      subject: pdfDoc.getSubject(),
      creator: pdfDoc.getCreator(),
      producer: pdfDoc.getProducer(),
      creationDate: pdfDoc.getCreationDate(),
      modificationDate: pdfDoc.getModificationDate(),
      keywords: pdfDoc.getKeywords(),
    };
  }

  private async extractFormFields(pdfDoc: PDFDocument): Promise<Record<string, any>> {
    try {
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      const formData: Record<string, any> = {
        hasForm: fields.length > 0,
        fieldCount: fields.length,
        fields: {},
      };

      for (const field of fields) {
        const fieldName = field.getName();
        formData.fields[fieldName] = {
          type: field.constructor.name,
          required: false, // pdf-lib doesn't expose this directly
          editable: true,
        };
      }

      return formData;
    } catch (error) {
      logger.debug('No form fields in PDF or error extracting them');
      return { hasForm: false, fieldCount: 0 };
    }
  }

  private async extractTextWithPdfParse(filePath: string): Promise<string> {
    // Placeholder for pdf-parse integration
    // In production, you would use:
    // const pdfParse = require('pdf-parse');
    // const dataBuffer = await fs.readFile(filePath);
    // const data = await pdfParse(dataBuffer);
    // return data.text;

    logger.warn('pdf-parse not implemented, returning empty content');
    return '';
  }
}

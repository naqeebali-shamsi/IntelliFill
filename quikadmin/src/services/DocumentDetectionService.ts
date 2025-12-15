import * as fs from 'fs/promises';
import { logger } from '../utils/logger';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number; info?: Record<string, unknown> }>;

/**
 * Service for detecting document types and characteristics
 * Determines if a PDF is scanned (no text layer) or text-based (native PDF)
 */
export class DocumentDetectionService {
  /**
   * Detect if a PDF is scanned (no text layer) or text-based
   * @param pdfPath - Path to the PDF file
   * @returns true if PDF is scanned (needs OCR), false if text-based
   */
  async isScannedPDF(pdfPath: string): Promise<boolean> {
    try {
      const dataBuffer = await fs.readFile(pdfPath);
      const data = await pdfParse(dataBuffer);

      // Extract text content
      const text = data.text.trim();
      const pageCount = data.numpages;

      // Calculate text density metrics
      const textLength = text.length;
      const textPerPage = pageCount > 0 ? textLength / pageCount : 0;

      logger.debug('PDF Analysis:', {
        path: pdfPath,
        pages: pageCount,
        textLength,
        textPerPage
      });

      // Heuristics for detecting scanned PDFs:
      // 1. Very little or no text extracted
      // 2. Low text density per page (less than 50 characters suggests scanned)
      // 3. Text is mostly whitespace or special characters

      if (textLength === 0) {
        logger.info(`PDF detected as SCANNED (no text): ${pdfPath}`);
        return true; // Definitely scanned
      }

      if (textPerPage < 50) {
        logger.info(`PDF detected as SCANNED (low text density ${textPerPage.toFixed(1)} chars/page): ${pdfPath}`);
        return true; // Likely scanned with minimal OCR text
      }

      // Check if text is mostly meaningful (not just whitespace/special chars)
      const meaningfulChars = text.replace(/[\s\n\r\t]/g, '').length;
      const meaningfulRatio = textLength > 0 ? meaningfulChars / textLength : 0;

      if (meaningfulRatio < 0.1) {
        logger.info(`PDF detected as SCANNED (low meaningful text ratio ${meaningfulRatio.toFixed(2)}): ${pdfPath}`);
        return true; // Mostly whitespace, likely scanned
      }

      logger.info(`PDF detected as TEXT-BASED (${textPerPage.toFixed(1)} chars/page): ${pdfPath}`);
      return false; // Has substantial text layer, use direct extraction

    } catch (error) {
      logger.error(`Error detecting PDF type for ${pdfPath}:`, error);
      // Default to scanned if detection fails - safer to OCR than miss content
      logger.warn('Defaulting to SCANNED mode due to detection error');
      return true;
    }
  }

  /**
   * Extract text directly from text-based PDF
   * @param pdfPath - Path to the PDF file
   * @returns Extracted text content
   */
  async extractTextFromPDF(pdfPath: string): Promise<string> {
    try {
      const dataBuffer = await fs.readFile(pdfPath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error) {
      logger.error(`Error extracting text from PDF ${pdfPath}:`, error);
      throw new Error(`Failed to extract text from PDF: ${error}`);
    }
  }

  /**
   * Get detailed PDF information
   * @param pdfPath - Path to the PDF file
   * @returns PDF metadata and statistics
   */
  async getPDFInfo(pdfPath: string): Promise<{
    numPages: number;
    textLength: number;
    textPerPage: number;
    isScanned: boolean;
    metadata: any;
  }> {
    try {
      const dataBuffer = await fs.readFile(pdfPath);
      const data = await pdfParse(dataBuffer);
      const isScanned = await this.isScannedPDF(pdfPath);

      const textLength = data.text.trim().length;
      const textPerPage = data.numpages > 0 ? textLength / data.numpages : 0;

      return {
        numPages: data.numpages,
        textLength,
        textPerPage,
        isScanned,
        metadata: data.info
      };
    } catch (error) {
      logger.error(`Error getting PDF info for ${pdfPath}:`, error);
      throw new Error(`Failed to get PDF info: ${error}`);
    }
  }

  /**
   * Batch check multiple PDFs for scanned status
   * @param pdfPaths - Array of PDF file paths
   * @returns Map of path to isScanned status
   */
  async batchCheckScanned(pdfPaths: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    await Promise.all(
      pdfPaths.map(async (path) => {
        try {
          const isScanned = await this.isScannedPDF(path);
          results.set(path, isScanned);
        } catch (error) {
          logger.error(`Batch check failed for ${path}:`, error);
          results.set(path, true); // Default to scanned on error
        }
      })
    );

    return results;
  }
}

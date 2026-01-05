import pdfParse from 'pdf-parse';
import { logger } from '../utils/logger';
import { getFileBuffer, isUrl } from '../utils/fileReader';

/**
 * Service for detecting document types and characteristics
 * Determines if a PDF is scanned (no text layer) or text-based (native PDF)
 *
 * Supports both local file paths and HTTP/HTTPS URLs (e.g., R2 storage)
 */
export class DocumentDetectionService {
  /**
   * Detect if a PDF is scanned (no text layer) or text-based
   * @param pdfPathOrUrl - Path to the PDF file or HTTP URL
   * @returns true if PDF is scanned (needs OCR), false if text-based
   */
  async isScannedPDF(pdfPathOrUrl: string): Promise<boolean> {
    try {
      const dataBuffer = await getFileBuffer(pdfPathOrUrl);
      const data = await pdfParse(dataBuffer);

      // Extract text content
      const text = data.text.trim();
      const pageCount = data.numpages;

      // Calculate text density metrics
      const textLength = text.length;
      const textPerPage = pageCount > 0 ? textLength / pageCount : 0;

      // Log path safely (truncate URLs for privacy)
      const logPath = isUrl(pdfPathOrUrl)
        ? `URL:${pdfPathOrUrl.substring(0, 50)}...`
        : pdfPathOrUrl;

      logger.debug('PDF Analysis:', {
        path: logPath,
        pages: pageCount,
        textLength,
        textPerPage,
      });

      // Heuristics for detecting scanned PDFs:
      // 1. Very little or no text extracted
      // 2. Low text density per page (less than 50 characters suggests scanned)
      // 3. Text is mostly whitespace or special characters

      if (textLength === 0) {
        logger.info(`PDF detected as SCANNED (no text): ${logPath}`);
        return true; // Definitely scanned
      }

      if (textPerPage < 50) {
        logger.info(
          `PDF detected as SCANNED (low text density ${textPerPage.toFixed(1)} chars/page): ${logPath}`
        );
        return true; // Likely scanned with minimal OCR text
      }

      // Check if text is mostly meaningful (not just whitespace/special chars)
      const meaningfulChars = text.replace(/[\s\n\r\t]/g, '').length;
      const meaningfulRatio = textLength > 0 ? meaningfulChars / textLength : 0;

      if (meaningfulRatio < 0.1) {
        logger.info(
          `PDF detected as SCANNED (low meaningful text ratio ${meaningfulRatio.toFixed(2)}): ${logPath}`
        );
        return true; // Mostly whitespace, likely scanned
      }

      logger.info(`PDF detected as TEXT-BASED (${textPerPage.toFixed(1)} chars/page): ${logPath}`);
      return false; // Has substantial text layer, use direct extraction
    } catch (error) {
      const logPath = isUrl(pdfPathOrUrl)
        ? `URL:${pdfPathOrUrl.substring(0, 50)}...`
        : pdfPathOrUrl;
      logger.error(`Error detecting PDF type for ${logPath}:`, error);
      // Default to scanned if detection fails - safer to OCR than miss content
      logger.warn('Defaulting to SCANNED mode due to detection error');
      return true;
    }
  }

  /**
   * Extract text directly from text-based PDF
   * @param pdfPathOrUrl - Path to the PDF file or HTTP URL
   * @returns Extracted text content
   */
  async extractTextFromPDF(pdfPathOrUrl: string): Promise<string> {
    try {
      const dataBuffer = await getFileBuffer(pdfPathOrUrl);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error) {
      const logPath = isUrl(pdfPathOrUrl)
        ? `URL:${pdfPathOrUrl.substring(0, 50)}...`
        : pdfPathOrUrl;
      logger.error(`Error extracting text from PDF ${logPath}:`, error);
      throw new Error(`Failed to extract text from PDF: ${error}`);
    }
  }

  /**
   * Get detailed PDF information
   * @param pdfPathOrUrl - Path to the PDF file or HTTP URL
   * @returns PDF metadata and statistics
   */
  async getPDFInfo(pdfPathOrUrl: string): Promise<{
    numPages: number;
    textLength: number;
    textPerPage: number;
    isScanned: boolean;
    metadata: any;
  }> {
    try {
      const dataBuffer = await getFileBuffer(pdfPathOrUrl);
      const data = await pdfParse(dataBuffer);

      // Use the buffer we already have instead of re-downloading
      const textLength = data.text.trim().length;
      const textPerPage = data.numpages > 0 ? textLength / data.numpages : 0;

      // Determine if scanned based on the same logic
      let isScanned = false;
      if (textLength === 0 || textPerPage < 50) {
        isScanned = true;
      } else {
        const meaningfulChars = data.text.trim().replace(/[\s\n\r\t]/g, '').length;
        const meaningfulRatio = textLength > 0 ? meaningfulChars / textLength : 0;
        isScanned = meaningfulRatio < 0.1;
      }

      return {
        numPages: data.numpages,
        textLength,
        textPerPage,
        isScanned,
        metadata: data.info,
      };
    } catch (error) {
      const logPath = isUrl(pdfPathOrUrl)
        ? `URL:${pdfPathOrUrl.substring(0, 50)}...`
        : pdfPathOrUrl;
      logger.error(`Error getting PDF info for ${logPath}:`, error);
      throw new Error(`Failed to get PDF info: ${error}`);
    }
  }

  /**
   * Batch check multiple PDFs for scanned status
   * @param pdfPathsOrUrls - Array of PDF file paths or URLs
   * @returns Map of path/URL to isScanned status
   */
  async batchCheckScanned(pdfPathsOrUrls: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    await Promise.all(
      pdfPathsOrUrls.map(async (pathOrUrl) => {
        try {
          const isScanned = await this.isScannedPDF(pathOrUrl);
          results.set(pathOrUrl, isScanned);
        } catch (error) {
          const logPath = isUrl(pathOrUrl) ? `URL:${pathOrUrl.substring(0, 50)}...` : pathOrUrl;
          logger.error(`Batch check failed for ${logPath}:`, error);
          results.set(pathOrUrl, true); // Default to scanned on error
        }
      })
    );

    return results;
  }
}

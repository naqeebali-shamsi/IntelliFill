import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as mammoth from 'mammoth';
import { parse } from 'csv-parse/sync';
import { logger } from '../utils/logger';
import pdfParse from 'pdf-parse';

export interface ParsedDocument {
  type: 'pdf' | 'docx' | 'txt' | 'csv' | 'image';
  content: string;
  metadata: Record<string, any>;
  structuredData?: Record<string, any>;
}

export class DocumentParser {
  async parse(filePath: string): Promise<ParsedDocument> {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'pdf':
        return this.parsePDF(filePath);
      case 'docx':
      case 'doc':
        return this.parseDOCX(filePath);
      case 'txt':
        return this.parseTXT(filePath);
      case 'csv':
        return this.parseCSV(filePath);
      case 'jpeg':
      case 'jpg':
      case 'png':
      case 'gif':
      case 'webp':
        return this.parseImage(filePath, extension);
      default:
        throw new Error(`Unsupported file type: ${extension}`);
    }
  }

  private async parsePDF(filePath: string): Promise<ParsedDocument> {
    try {
      const pdfBytes = await fs.readFile(filePath);

      // Use pdf-parse for actual text extraction
      let content = '';
      let pdfParseMetadata: Record<string, any> = {};

      try {
        const pdfData = await pdfParse(pdfBytes);
        content = pdfData.text || '';
        pdfParseMetadata = {
          numpages: pdfData.numpages,
          numrender: pdfData.numrender,
          info: pdfData.info,
          metadata: pdfData.metadata
        };

        // Log extraction success
        logger.info(`PDF text extracted: ${content.length} characters from ${pdfData.numpages} pages`);

        // Warn if no text was extracted (might be scanned PDF)
        if (!content || content.trim().length === 0) {
          logger.warn('PDF appears to have no extractable text. May require OCR for scanned documents.');
        }
      } catch (parseError) {
        logger.warn('pdf-parse extraction failed, falling back to pdf-lib metadata:', parseError);
        // Fall back to basic metadata extraction if pdf-parse fails
        content = '';
      }

      // Also load with pdf-lib for form fields and additional metadata
      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

      return {
        type: 'pdf',
        content,
        metadata: {
          pageCount: pdfDoc.getPageCount(),
          title: pdfDoc.getTitle() || pdfParseMetadata?.info?.Title || 'Untitled',
          author: pdfDoc.getAuthor() || pdfParseMetadata?.info?.Author,
          creationDate: pdfDoc.getCreationDate(),
          hasText: content.trim().length > 0,
          textLength: content.length,
          requiresOCR: content.trim().length === 0,
          ...pdfParseMetadata
        }
      };
    } catch (error) {
      logger.error('PDF parsing error:', error);
      throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async parseDOCX(filePath: string): Promise<ParsedDocument> {
    try {
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      
      return {
        type: 'docx',
        content: result.value,
        metadata: {
          messages: result.messages
        }
      };
    } catch (error) {
      logger.error('DOCX parsing error:', error);
      throw new Error(`Failed to parse DOCX: ${error}`);
    }
  }

  private async parseTXT(filePath: string): Promise<ParsedDocument> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      return {
        type: 'txt',
        content,
        metadata: {
          encoding: 'utf-8',
          lines: content.split('\n').length
        }
      };
    } catch (error) {
      logger.error('TXT parsing error:', error);
      throw new Error(`Failed to parse TXT: ${error}`);
    }
  }

  private async parseCSV(filePath: string): Promise<ParsedDocument> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true
      });
      
      return {
        type: 'csv',
        content,
        metadata: {
          rowCount: records.length,
          columns: records.length > 0 ? Object.keys(records[0]) : []
        },
        structuredData: { records }
      };
    } catch (error) {
      logger.error('CSV parsing error:', error);
      throw new Error(`Failed to parse CSV: ${error}`);
    }
  }

  private async parseImage(filePath: string, extension: string): Promise<ParsedDocument> {
    try {
      const stats = await fs.stat(filePath);

      // For images, we return metadata about the image
      // Actual OCR would be done by a separate OCR service (Tesseract.js)
      return {
        type: 'image',
        content: `[Image file: ${extension.toUpperCase()}]`,
        metadata: {
          format: extension,
          size: stats.size,
          path: filePath,
          requiresOCR: true
        }
      };
    } catch (error) {
      logger.error('Image parsing error:', error);
      throw new Error(`Failed to parse image: ${error}`);
    }
  }

  async parseMultiple(filePaths: string[]): Promise<ParsedDocument[]> {
    return Promise.all(filePaths.map(path => this.parse(path)));
  }
}
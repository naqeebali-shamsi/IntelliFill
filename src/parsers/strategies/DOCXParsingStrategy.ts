/**
 * DOCX Parsing Strategy
 * Handles Microsoft Word document parsing
 */

import { BaseParsingStrategy, ParsedDocument } from './ParsingStrategy';
import * as mammoth from 'mammoth';
import * as fs from 'fs/promises';
import { logger } from '../../utils/logger';

export class DOCXParsingStrategy extends BaseParsingStrategy {
  protected extensions = ['docx', 'doc'];
  protected strategyName = 'DOCX Parser';
  protected priority = 8;
  
  async parse(filePath: string): Promise<ParsedDocument> {
    try {
      logger.info(`Parsing DOCX: ${filePath}`);
      
      const buffer = await fs.readFile(filePath);
      
      // Extract raw text
      const textResult = await mammoth.extractRawText({ buffer });
      
      // Extract HTML for better structure preservation
      const htmlResult = await mammoth.convertToHtml({ buffer });
      
      // Extract metadata
      const metadata = await this.extractMetadata(filePath, textResult);
      
      // Extract structured data (tables, lists, etc.)
      const structuredData = this.extractStructuredData(htmlResult.value);
      
      return {
        type: 'docx',
        content: textResult.value,
        metadata,
        structuredData,
        requiresOCR: false,
        confidence: 100 // DOCX text extraction is always accurate
      };
      
    } catch (error) {
      logger.error('DOCX parsing error:', error);
      throw new Error(`Failed to parse DOCX: ${error}`);
    }
  }
  
  private async extractMetadata(filePath: string, textResult: any): Promise<any> {
    const baseMetadata = await this.getFileMetadata(filePath);
    
    // Count words and paragraphs
    const content = textResult.value;
    const words = content.split(/\s+/).filter((word: string) => word.length > 0);
    const paragraphs = content.split(/\n\n+/);
    
    return {
      ...baseMetadata,
      wordCount: words.length,
      paragraphCount: paragraphs.length,
      characterCount: content.length,
      messages: textResult.messages || [],
      hasImages: textResult.messages?.some((m: any) => 
        m.type === 'warning' && m.message.includes('image')
      )
    };
  }
  
  private extractStructuredData(html: string): Record<string, any> {
    const structuredData: Record<string, any> = {};
    
    // Extract tables (simplified - use cheerio or jsdom in production)
    const tableMatches = html.match(/<table[^>]*>.*?<\/table>/gs);
    if (tableMatches) {
      structuredData.tables = tableMatches.length;
      structuredData.hasStructuredContent = true;
    }
    
    // Extract lists
    const listMatches = html.match(/<(ul|ol)[^>]*>.*?<\/(ul|ol)>/gs);
    if (listMatches) {
      structuredData.lists = listMatches.length;
    }
    
    // Extract headings
    const headingMatches = html.match(/<h[1-6][^>]*>.*?<\/h[1-6]>/gs);
    if (headingMatches) {
      structuredData.headings = headingMatches.map(h => 
        h.replace(/<[^>]+>/g, '').trim()
      );
    }
    
    // Extract links
    const linkMatches = html.match(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gs);
    if (linkMatches) {
      structuredData.links = linkMatches.map(link => {
        const hrefMatch = link.match(/href="([^"]*)"/);
        const textMatch = link.match(/>([^<]+)</);
        return {
          href: hrefMatch ? hrefMatch[1] : '',
          text: textMatch ? textMatch[1] : ''
        };
      });
    }
    
    return structuredData;
  }
}
/**
 * Strategy Pattern Interface for Document Parsing
 * Defines the contract for all document parsing strategies
 */

export interface ParsedDocument {
  type: string;
  content: string;
  metadata: DocumentMetadata;
  structuredData?: Record<string, any>;
  requiresOCR?: boolean;
  confidence?: number;
}

export interface DocumentMetadata {
  pageCount?: number;
  title?: string;
  author?: string;
  creationDate?: Date;
  modificationDate?: Date;
  fileSize?: number;
  encoding?: string;
  language?: string;
  [key: string]: any;
}

/**
 * Base interface for all parsing strategies
 * Implements the Strategy pattern for document parsing
 */
export interface IParsingStrategy {
  /**
   * Check if this strategy can parse the given file
   */
  canParse(filePath: string): boolean;
  
  /**
   * Get supported file extensions
   */
  getSupportedExtensions(): string[];
  
  /**
   * Parse the document and extract content
   */
  parse(filePath: string): Promise<ParsedDocument>;
  
  /**
   * Get strategy name for logging/debugging
   */
  getName(): string;
  
  /**
   * Get priority for strategy selection (higher = preferred)
   */
  getPriority(): number;
}

/**
 * Abstract base class for parsing strategies
 * Provides common functionality for all strategies
 */
export abstract class BaseParsingStrategy implements IParsingStrategy {
  protected abstract extensions: string[];
  protected abstract strategyName: string;
  protected priority: number = 0;
  
  canParse(filePath: string): boolean {
    const extension = this.getFileExtension(filePath);
    return this.extensions.includes(extension);
  }
  
  getSupportedExtensions(): string[] {
    return [...this.extensions];
  }
  
  getName(): string {
    return this.strategyName;
  }
  
  getPriority(): number {
    return this.priority;
  }
  
  abstract parse(filePath: string): Promise<ParsedDocument>;
  
  protected getFileExtension(filePath: string): string {
    return filePath.split('.').pop()?.toLowerCase() || '';
  }
  
  protected async getFileMetadata(filePath: string): Promise<Partial<DocumentMetadata>> {
    const fs = await import('fs/promises');
    const stats = await fs.stat(filePath);
    
    return {
      fileSize: stats.size,
      modificationDate: stats.mtime
    };
  }
}
import { ParsedDocument } from '../parsers/DocumentParser';
import { logger } from '../utils/logger';

export interface ExtractedData {
  fields: Record<string, any>;
  entities: {
    names: string[];
    emails: string[];
    phones: string[];
    dates: string[];
    addresses: string[];
    numbers: string[];
    currencies: string[];
  };
  metadata: {
    extractionMethod: string;
    confidence: number;
    timestamp: Date;
  };
}

export class DataExtractor {
  private emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
  private phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
  private dateRegex = /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})|(\d{4}[-/]\d{1,2}[-/]\d{1,2})/g;
  private currencyRegex = /[$€£¥]\s?\d+(?:,\d{3})*(?:\.\d{2})?/g;

  async extract(document: ParsedDocument): Promise<ExtractedData> {
    const content = document.content;
    
    // Extract entities using regex patterns
    const entities = {
      names: this.extractNames(content),
      emails: this.extractEmails(content),
      phones: this.extractPhones(content),
      dates: this.extractDates(content),
      addresses: this.extractAddresses(content),
      numbers: this.extractNumbers(content),
      currencies: this.extractCurrencies(content)
    };

    // Extract structured fields based on document type
    const fields = await this.extractFields(document);

    return {
      fields,
      entities,
      metadata: {
        extractionMethod: this.getExtractionMethod(document.type),
        confidence: this.calculateConfidence(entities, fields),
        timestamp: new Date()
      }
    };
  }

  private extractEmails(text: string): string[] {
    const matches = text.match(this.emailRegex) || [];
    return [...new Set(matches)];
  }

  private extractPhones(text: string): string[] {
    const matches = text.match(this.phoneRegex) || [];
    return [...new Set(matches.filter(phone => phone.replace(/\D/g, '').length >= 7))];
  }

  private extractDates(text: string): string[] {
    const matches = text.match(this.dateRegex) || [];
    return [...new Set(matches)];
  }

  private extractCurrencies(text: string): string[] {
    const matches = text.match(this.currencyRegex) || [];
    return [...new Set(matches)];
  }

  private extractNames(text: string): string[] {
    // Simple name extraction - in production use NER models
    const namePatterns = [
      /Name:\s*(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Eng\.)?\s*([A-Z][a-z]+ [A-Z][a-z]+)/g,
      /Full Name:\s*(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Eng\.)?\s*([A-Z][a-z]+ [A-Z][a-z]+)/g,
      /(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s+([A-Z][a-z]+ [A-Z][a-z]+)/g
    ];

    const names: string[] = [];
    for (const pattern of namePatterns) {
      const matches = [...text.matchAll(pattern)];
      names.push(...matches.map(m => m[1]));
    }
    
    return [...new Set(names)];
  }

  private extractAddresses(text: string): string[] {
    // Simple address extraction - in production use NER models
    const addressPattern = /\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Plaza|Pl))/gi;
    const matches = text.match(addressPattern) || [];
    return [...new Set(matches)];
  }

  private extractNumbers(text: string): string[] {
    const numberPattern = /\b\d+(?:\.\d+)?\b/g;
    const matches = text.match(numberPattern) || [];
    return [...new Set(matches)];
  }

  private async extractFields(document: ParsedDocument): Promise<Record<string, any>> {
    const fields: Record<string, any> = {};

    // Extract based on document type
    if (document.type === 'csv' && document.structuredData?.records) {
      // For CSV, use the first record as template
      const records = document.structuredData.records;
      if (records.length > 0) {
        Object.assign(fields, records[0]);
      }
    } else {
      // For text-based documents, extract key-value pairs
      const keyValuePattern = /([A-Za-z\s]+):\s*([^\n]+)/g;
      const matches = [...document.content.matchAll(keyValuePattern)];
      
      for (const match of matches) {
        const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
        const value = match[2].trim();
        fields[key] = value;
      }
    }

    return fields;
  }

  private getExtractionMethod(type: string): string {
    const methods: Record<string, string> = {
      pdf: 'OCR + Pattern Matching',
      docx: 'XML Parsing + Pattern Matching',
      txt: 'Pattern Matching',
      csv: 'Structured Parsing'
    };
    return methods[type] || 'Unknown';
  }

  private calculateConfidence(entities: any, fields: any): number {
    // Simple confidence calculation based on data completeness
    let score = 0;
    let total = 0;

    // Check entity extraction
    for (const [key, value] of Object.entries(entities)) {
      total += 1;
      if (Array.isArray(value) && value.length > 0) {
        score += 1;
      }
    }

    // Check field extraction
    const fieldCount = Object.keys(fields).length;
    if (fieldCount > 0) {
      score += Math.min(fieldCount / 10, 1); // Normalize to max 1
      total += 1;
    }

    return total > 0 ? (score / total) * 100 : 0;
  }

  async extractFromMultiple(documents: ParsedDocument[]): Promise<ExtractedData> {
    const allExtracted = await Promise.all(documents.map(doc => this.extract(doc)));
    
    // Merge extracted data from multiple documents
    const merged: ExtractedData = {
      fields: {},
      entities: {
        names: [],
        emails: [],
        phones: [],
        dates: [],
        addresses: [],
        numbers: [],
        currencies: []
      },
      metadata: {
        extractionMethod: 'Multi-document extraction',
        confidence: 0,
        timestamp: new Date()
      }
    };

    for (const data of allExtracted) {
      // Merge fields
      Object.assign(merged.fields, data.fields);
      
      // Merge entities (deduplicated)
      for (const [key, value] of Object.entries(data.entities)) {
        if (Array.isArray(value)) {
          (merged.entities as any)[key] = [...new Set([...(merged.entities as any)[key], ...value])];
        }
      }
    }

    // Calculate average confidence
    merged.metadata.confidence = allExtracted.reduce((sum, d) => sum + d.metadata.confidence, 0) / allExtracted.length;

    return merged;
  }
}
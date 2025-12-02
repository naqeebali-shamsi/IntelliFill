import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DocumentParser } from '../parsers/DocumentParser';
import { DataExtractor } from '../extractors/DataExtractor';
import { FieldMapper } from '../mappers/FieldMapper';
import { FormFiller } from '../fillers/FormFiller';
import { ValidationService } from '../validators/ValidationService';
import { logger } from '../utils/logger';

export interface IntelliFillServiceConfig {
  documentParser?: DocumentParser;
  dataExtractor?: DataExtractor;
  fieldMapper?: FieldMapper;
  formFiller?: FormFiller;
  validationService?: ValidationService;
}

export interface ProcessingResult {
  success: boolean;
  fillResult: any;
  mappingResult: any;
  processingTime: number;
  errors: string[];
  warnings?: string[];
}

export class IntelliFillService {
  private documentParser: DocumentParser;
  private dataExtractor: DataExtractor;
  private fieldMapper: FieldMapper;
  private formFiller: FormFiller;
  private validationService: ValidationService;

  constructor(config?: IntelliFillServiceConfig) {
    this.documentParser = config?.documentParser || new DocumentParser();
    this.dataExtractor = config?.dataExtractor || new DataExtractor();
    this.fieldMapper = config?.fieldMapper || new FieldMapper();
    this.formFiller = config?.formFiller || new FormFiller();
    this.validationService = config?.validationService || new ValidationService();
  }

  async processSingle(
    documentPath: string,
    formPath: string,
    outputPath: string
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Parse document
      const parsedDoc = await this.documentParser.parse(documentPath);
      
      // Extract data
      const extractedData = await this.dataExtractor.extract(parsedDoc);
      
      // Get form fields
      const formFields = await this.extractFormFields(formPath);
      
      // Map fields
      const mappingResult = await this.fieldMapper.mapFields(extractedData, formFields);
      
      // Fill form
      const fillResult = await this.formFiller.fillPDFForm(formPath, mappingResult, outputPath);
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        fillResult,
        mappingResult,
        processingTime,
        errors,
        warnings: fillResult.warnings || warnings
      };
    } catch (error) {
      logger.error('Error processing single document:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      return {
        success: false,
        fillResult: { success: false, filledFields: [], failedFields: [], outputPath: '', warnings: [] },
        mappingResult: { mappings: [], unmappedFormFields: [], unmappedDataFields: [], overallConfidence: 0 },
        processingTime: Date.now() - startTime,
        errors,
        warnings
      };
    }
  }

  async processMultiple(
    documentPaths: string[],
    formPath: string,
    outputPath: string
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    const allExtractedData: any[] = [];

    try {
      // Process all documents
      for (const docPath of documentPaths) {
        const parsedDoc = await this.documentParser.parse(docPath);
        const extractedData = await this.dataExtractor.extract(parsedDoc);
        allExtractedData.push(extractedData);
      }
      
      // Merge extracted data
      const mergedData = this.mergeExtractedData(allExtractedData);
      
      // Get form fields
      const formFields = await this.extractFormFields(formPath);
      
      // Map fields
      const mappingResult = await this.fieldMapper.mapFields(mergedData, formFields);
      
      // Fill form
      const fillResult = await this.formFiller.fillPDFForm(formPath, mappingResult, outputPath);
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        fillResult,
        mappingResult,
        processingTime,
        errors,
        warnings: fillResult.warnings || warnings
      };
    } catch (error) {
      logger.error('Error processing multiple documents:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      return {
        success: false,
        fillResult: { success: false, filledFields: [], failedFields: [], outputPath: '', warnings: [] },
        mappingResult: { mappings: [], unmappedFormFields: [], unmappedDataFields: [], overallConfidence: 0 },
        processingTime: Date.now() - startTime,
        errors,
        warnings
      };
    }
  }

  async batchProcess(jobs: any[]): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    for (const job of jobs) {
      const result = await this.processSingle(
        job.documents[0],
        job.form,
        job.output
      );
      results.push(result);
    }
    
    return results;
  }

  async validateDocument(documentPath: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    try {
      const parsedDoc = await this.documentParser.parse(documentPath);
      const validationResult = await this.validationService.validateData(parsedDoc.metadata || {});
      
      return {
        valid: validationResult.valid,
        errors: validationResult.errors || [],
        warnings: validationResult.warnings || []
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: []
      };
    }
  }

  async fillPDF(
    formPath: string,
    data: Record<string, any>,
    outputPath: string
  ): Promise<void> {
    const formPdfBytes = await fs.readFile(formPath);
    const pdfDoc = await PDFDocument.load(formPdfBytes);
    
    const form = pdfDoc.getForm();
    
    for (const [fieldName, value] of Object.entries(data)) {
      try {
        const field = form.getTextField(fieldName);
        if (field) {
          field.setText(String(value));
        }
      } catch (error) {
        console.warn(`Field ${fieldName} not found in form`);
      }
    }
    
    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPath, pdfBytes);
  }

  async extractFormFields(formPath: string): Promise<string[]> {
    const formPdfBytes = await fs.readFile(formPath);
    const pdfDoc = await PDFDocument.load(formPdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    return fields.map(field => field.getName());
  }

  async mergeDocuments(documents: string[]): Promise<Buffer> {
    const mergedPdf = await PDFDocument.create();
    
    for (const docPath of documents) {
      const docBytes = await fs.readFile(docPath);
      const doc = await PDFDocument.load(docBytes);
      const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
      pages.forEach(page => mergedPdf.addPage(page));
    }
    
    return Buffer.from(await mergedPdf.save());
  }

  private mergeExtractedData(dataArray: any[]): any {
    // Simple merge strategy - combine all fields
    const merged: any = {
      fields: {},
      entities: {
        names: [],
        emails: [],
        phones: [],
        dates: [],
        addresses: []
      },
      metadata: {
        confidence: 0
      }
    };

    for (const data of dataArray) {
      // Merge fields
      Object.assign(merged.fields, data.fields);
      
      // Merge entities
      merged.entities.names.push(...(data.entities?.names || []));
      merged.entities.emails.push(...(data.entities?.emails || []));
      merged.entities.phones.push(...(data.entities?.phones || []));
      merged.entities.dates.push(...(data.entities?.dates || []));
      merged.entities.addresses.push(...(data.entities?.addresses || []));
      
      // Average confidence
      merged.metadata.confidence += data.metadata?.confidence || 0;
    }
    
    merged.metadata.confidence /= dataArray.length;
    
    // Remove duplicates
    merged.entities.names = [...new Set(merged.entities.names)];
    merged.entities.emails = [...new Set(merged.entities.emails)];
    merged.entities.phones = [...new Set(merged.entities.phones)];
    merged.entities.dates = [...new Set(merged.entities.dates)];
    merged.entities.addresses = [...new Set(merged.entities.addresses)];
    
    return merged;
  }
}
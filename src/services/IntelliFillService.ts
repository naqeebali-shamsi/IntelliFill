import { DocumentParser, ParsedDocument } from '../parsers/DocumentParser';
import { DataExtractor, ExtractedData } from '../extractors/DataExtractor';
import { FieldMapper, MappingResult } from '../mappers/FieldMapper';
import { FormFiller, FillResult } from '../fillers/FormFiller';
import { ValidationService } from '../validators/ValidationService';
import { logger } from '../utils/logger';

export interface IntelliFillOptions {
  documentParser: DocumentParser;
  dataExtractor: DataExtractor;
  fieldMapper: FieldMapper;
  formFiller: FormFiller;
  validationService: ValidationService;
}

export interface ProcessingResult {
  success: boolean;
  parsedDocuments: ParsedDocument[];
  extractedData: ExtractedData;
  mappingResult: MappingResult;
  fillResult: FillResult;
  validationResult?: any;
  errors: string[];
  processingTime: number;
}

export class IntelliFillService {
  private documentParser: DocumentParser;
  private dataExtractor: DataExtractor;
  private fieldMapper: FieldMapper;
  private formFiller: FormFiller;
  private validationService: ValidationService;

  constructor(options: IntelliFillOptions) {
    this.documentParser = options.documentParser;
    this.dataExtractor = options.dataExtractor;
    this.fieldMapper = options.fieldMapper;
    this.formFiller = options.formFiller;
    this.validationService = options.validationService;
  }

  async processSingle(
    documentPath: string,
    formPath: string,
    outputPath: string
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Step 1: Parse source document
      logger.info('Parsing source document...');
      const parsedDocument = await this.documentParser.parse(documentPath);

      // Step 2: Extract data from document
      logger.info('Extracting data from document...');
      const extractedData = await this.dataExtractor.extract(parsedDocument);

      // Step 3: Get form fields
      logger.info('Analyzing PDF form fields...');
      const { fields: formFields } = await this.formFiller.validateFormFields(formPath);

      // Step 4: Map extracted data to form fields
      logger.info('Mapping data to form fields...');
      const mappingResult = await this.fieldMapper.mapFields(extractedData, formFields);

      // Step 5: Validate mappings
      logger.info('Validating mappings...');
      const validationResult = await this.validationService.validateMappings(mappingResult);
      if (validationResult.errors.length > 0) {
        errors.push(...validationResult.errors);
      }

      // Step 6: Fill the PDF form
      logger.info('Filling PDF form...');
      const fillResult = await this.formFiller.fillPDFForm(formPath, mappingResult, outputPath);

      const processingTime = Date.now() - startTime;

      return {
        success: fillResult.success && errors.length === 0,
        parsedDocuments: [parsedDocument],
        extractedData,
        mappingResult,
        fillResult,
        validationResult,
        errors,
        processingTime
      };
    } catch (error) {
      logger.error('Processing error:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      return {
        success: false,
        parsedDocuments: [],
        extractedData: {
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
            extractionMethod: 'Failed',
            confidence: 0,
            timestamp: new Date()
          }
        },
        mappingResult: {
          mappings: [],
          unmappedFormFields: [],
          unmappedDataFields: [],
          overallConfidence: 0
        },
        fillResult: {
          success: false,
          filledFields: [],
          failedFields: [],
          warnings: []
        },
        errors,
        processingTime: Date.now() - startTime
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

    try {
      // Step 1: Parse all source documents
      logger.info(`Parsing ${documentPaths.length} source documents...`);
      const parsedDocuments = await this.documentParser.parseMultiple(documentPaths);

      // Step 2: Extract data from all documents
      logger.info('Extracting data from documents...');
      const extractedData = await this.dataExtractor.extractFromMultiple(parsedDocuments);

      // Step 3: Get form fields
      logger.info('Analyzing PDF form fields...');
      const { fields: formFields } = await this.formFiller.validateFormFields(formPath);

      // Step 4: Map extracted data to form fields
      logger.info('Mapping data to form fields...');
      const mappingResult = await this.fieldMapper.mapFields(extractedData, formFields);

      // Step 5: Validate mappings
      logger.info('Validating mappings...');
      const validationResult = await this.validationService.validateMappings(mappingResult);
      if (validationResult.errors.length > 0) {
        errors.push(...validationResult.errors);
      }

      // Step 6: Fill the PDF form
      logger.info('Filling PDF form...');
      const fillResult = await this.formFiller.fillPDFForm(formPath, mappingResult, outputPath);

      const processingTime = Date.now() - startTime;

      return {
        success: fillResult.success && errors.length === 0,
        parsedDocuments,
        extractedData,
        mappingResult,
        fillResult,
        validationResult,
        errors,
        processingTime
      };
    } catch (error) {
      logger.error('Processing error:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      return {
        success: false,
        parsedDocuments: [],
        extractedData: {
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
            extractionMethod: 'Failed',
            confidence: 0,
            timestamp: new Date()
          }
        },
        mappingResult: {
          mappings: [],
          unmappedFormFields: [],
          unmappedDataFields: [],
          overallConfidence: 0
        },
        fillResult: {
          success: false,
          filledFields: [],
          failedFields: [],
          warnings: []
        },
        errors,
        processingTime: Date.now() - startTime
      };
    }
  }

  async batchProcess(
    jobs: Array<{
      documents: string[];
      form: string;
      output: string;
    }>
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    for (const job of jobs) {
      const result = job.documents.length === 1
        ? await this.processSingle(job.documents[0], job.form, job.output)
        : await this.processMultiple(job.documents, job.form, job.output);
      
      results.push(result);
    }

    return results;
  }
}
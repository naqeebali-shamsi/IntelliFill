#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DocumentParser } from '../parsers/DocumentParser';
import { DataExtractor } from '../extractors/DataExtractor';
import { FieldMapper } from '../mappers/FieldMapper';
import { FormFiller } from '../fillers/FormFiller';
import { ValidationService } from '../validators/ValidationService';
import { IntelliFillService } from '../services/IntelliFillService';

const program = new Command();

// Initialize services
const documentParser = new DocumentParser();
const dataExtractor = new DataExtractor();
const fieldMapper = new FieldMapper();
const formFiller = new FormFiller();
const validationService = new ValidationService();

const intelliFillService = new IntelliFillService({
  documentParser,
  dataExtractor,
  fieldMapper,
  formFiller,
  validationService
});

program
  .name('pdf-filler')
  .description('CLI tool for intelligent PDF form filling')
  .version('1.0.0');

// Fill command
program
  .command('fill')
  .description('Fill a PDF form with data from documents')
  .requiredOption('-d, --document <path>', 'Path to source document(s)', (val, prev: string[] | undefined) => {
    return prev ? prev.concat(val) : [val];
  })
  .requiredOption('-f, --form <path>', 'Path to PDF form')
  .requiredOption('-o, --output <path>', 'Output path for filled PDF')
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (options) => {
    try {
      console.log('🚀 Starting PDF form filling process...\n');

      const documents = Array.isArray(options.document) ? options.document : [options.document];
      
      if (options.verbose) {
        console.log(`📄 Processing ${documents.length} document(s)`);
        console.log(`📋 Form: ${options.form}`);
        console.log(`💾 Output: ${options.output}\n`);
      }

      const result = documents.length === 1
        ? await intelliFillService.processSingle(documents[0], options.form, options.output)
        : await intelliFillService.processMultiple(documents, options.form, options.output);

      if (result.success) {
        console.log('✅ PDF form filled successfully!\n');
        console.log(`📊 Statistics:`);
        console.log(`   - Fields filled: ${result.fillResult.filledFields.length}`);
        console.log(`   - Confidence: ${(result.mappingResult.overallConfidence * 100).toFixed(1)}%`);
        console.log(`   - Processing time: ${result.processingTime}ms`);
        
        if (result.fillResult.warnings.length > 0) {
          console.log(`\n⚠️  Warnings:`);
          result.fillResult.warnings.forEach(w => console.log(`   - ${w}`));
        }
        
        console.log(`\n💾 Output saved to: ${result.fillResult.outputPath}`);
      } else {
        console.error('❌ Failed to fill PDF form\n');
        console.error('Errors:');
        result.errors.forEach(e => console.error(`   - ${e}`));
        
        if (result.fillResult.warnings.length > 0) {
          console.log(`\n⚠️  Warnings:`);
          result.fillResult.warnings.forEach(w => console.log(`   - ${w}`));
        }
        
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

// Extract command
program
  .command('extract')
  .description('Extract data from a document')
  .requiredOption('-d, --document <path>', 'Path to document')
  .option('-o, --output <path>', 'Output path for extracted data (JSON)')
  .action(async (options) => {
    try {
      console.log('🔍 Extracting data from document...\n');

      const parsed = await documentParser.parse(options.document);
      const extracted = await dataExtractor.extract(parsed);

      console.log('📊 Extraction Results:\n');
      console.log(`Document Type: ${parsed.type}`);
      console.log(`Confidence: ${extracted.metadata.confidence.toFixed(1)}%`);
      console.log(`\nExtracted Fields: ${Object.keys(extracted.fields).length}`);
      console.log(`Entities Found:`);
      console.log(`   - Names: ${extracted.entities.names.length}`);
      console.log(`   - Emails: ${extracted.entities.emails.length}`);
      console.log(`   - Phones: ${extracted.entities.phones.length}`);
      console.log(`   - Dates: ${extracted.entities.dates.length}`);
      console.log(`   - Addresses: ${extracted.entities.addresses.length}`);

      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(extracted, null, 2));
        console.log(`\n💾 Extracted data saved to: ${options.output}`);
      }
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate a PDF form and list its fields')
  .requiredOption('-f, --form <path>', 'Path to PDF form')
  .action(async (options) => {
    try {
      console.log('🔍 Analyzing PDF form...\n');

      const fieldInfo = await formFiller.validateFormFields(options.form);

      console.log(`📋 Form Analysis Results:\n`);
      console.log(`Total Fields: ${fieldInfo.fields.length}\n`);
      console.log('Field Details:');
      
      for (const fieldName of fieldInfo.fields) {
        const type = fieldInfo.fieldTypes[fieldName];
        console.log(`   - ${fieldName} (${type})`);
      }
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

// Batch command
program
  .command('batch')
  .description('Process multiple form filling jobs from a config file')
  .requiredOption('-c, --config <path>', 'Path to batch configuration JSON file')
  .action(async (options) => {
    try {
      console.log('📦 Processing batch jobs...\n');

      const configContent = await fs.readFile(options.config, 'utf-8');
      const config = JSON.parse(configContent);

      if (!config.jobs || !Array.isArray(config.jobs)) {
        throw new Error('Invalid configuration: missing jobs array');
      }

      const results = await intelliFillService.batchProcess(config.jobs);

      console.log(`✅ Batch processing complete!\n`);
      console.log(`📊 Results:`);
      
      results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        console.log(`\nJob ${index + 1}: ${status}`);
        if (result.success) {
          console.log(`   - Fields filled: ${result.fillResult.filledFields.length}`);
          console.log(`   - Confidence: ${(result.mappingResult.overallConfidence * 100).toFixed(1)}%`);
        } else {
          console.log(`   - Errors: ${result.errors.join(', ')}`);
        }
      });

      const successCount = results.filter(r => r.success).length;
      console.log(`\n📈 Overall: ${successCount}/${results.length} jobs successful`);
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);
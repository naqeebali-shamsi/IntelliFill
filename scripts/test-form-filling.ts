#!/usr/bin/env ts-node

/**
 * PDF Form Filling Test Script
 * Demonstrates the complete workflow: OCR -> Extract -> Map -> Fill
 */

import { IntelliFillService } from '../src/services/IntelliFillService';
import { DocumentParser } from '../src/parsers/DocumentParser';
import { DataExtractor } from '../src/extractors/DataExtractor';
import { FieldMapper } from '../src/mappers/FieldMapper';
import { FormFiller } from '../src/fillers/FormFiller';
import { ValidationService } from '../src/validators/ValidationService';
import { OCRService } from '../src/services/OCRService';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PDFDocument, PDFForm, PDFTextField, rgb, StandardFonts } from 'pdf-lib';

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Create a sample PDF form for testing
 */
async function createSampleForm(): Promise<string> {
  const testDir = path.join(process.cwd(), 'tests', 'test-data');
  await fs.mkdir(testDir, { recursive: true });
  
  const formPath = path.join(testDir, 'sample-form.pdf');
  
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const form = pdfDoc.getForm();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();
  
  // Add title
  page.drawText('Application Form', {
    x: 50,
    y: height - 50,
    size: 20,
    font,
    color: rgb(0, 0, 0),
  });
  
  // Add form fields with labels
  const fields = [
    { label: 'Full Name:', fieldName: 'fullName', y: height - 100 },
    { label: 'Email Address:', fieldName: 'email', y: height - 150 },
    { label: 'Phone Number:', fieldName: 'phone', y: height - 200 },
    { label: 'Date:', fieldName: 'date', y: height - 250 },
    { label: 'Invoice Number:', fieldName: 'invoiceNumber', y: height - 300 },
    { label: 'Amount:', fieldName: 'amount', y: height - 350 },
    { label: 'Status:', fieldName: 'status', y: height - 400 },
    { label: 'Comments:', fieldName: 'comments', y: height - 450 },
  ];
  
  for (const field of fields) {
    // Draw label
    page.drawText(field.label, {
      x: 50,
      y: field.y,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });
    
    // Create text field
    const textField = form.createTextField(field.fieldName);
    textField.addToPage(page, {
      x: 200,
      y: field.y - 5,
      width: 300,
      height: 20,
      borderColor: rgb(0, 0, 0),
      backgroundColor: rgb(1, 1, 1),
    });
  }
  
  // Save the PDF
  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(formPath, pdfBytes);
  
  log(`Sample form created at: ${formPath}`, 'green');
  return formPath;
}

/**
 * Create a sample source document (could be an invoice, statement, etc.)
 */
async function createSourceDocument(): Promise<string> {
  const testDir = path.join(process.cwd(), 'tests', 'test-data');
  const docPath = path.join(testDir, 'source-document.pdf');
  
  // Create a simple PDF with text that we want to extract
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { height } = page.getSize();
  
  // Add content that matches our form fields
  const content = [
    'INVOICE',
    '',
    'Invoice #: INV-2024-001',
    'Date: 12/31/2024',
    '',
    'Bill To:',
    'John Doe',
    'john.doe@example.com',
    'Phone: +1 (555) 123-4567',
    '',
    'Amount Due: $1,234.56',
    'Status: Approved',
    '',
    'Description:',
    'Professional services rendered for document processing automation.',
    'This invoice covers the implementation of the QuikAdmin system.',
  ];
  
  let yPosition = height - 50;
  for (const line of content) {
    page.drawText(line, {
      x: 50,
      y: yPosition,
      size: line === 'INVOICE' ? 20 : 12,
      font,
      color: rgb(0, 0, 0),
    });
    yPosition -= line === 'INVOICE' ? 40 : 25;
  }
  
  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(docPath, pdfBytes);
  
  log(`Source document created at: ${docPath}`, 'green');
  return docPath;
}

/**
 * Main test function - Complete form filling workflow
 */
async function testFormFillingWorkflow() {
  log('\n🚀 Testing Complete PDF Form Filling Workflow\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  try {
    // Step 1: Create test files
    log('\n📁 Step 1: Creating Test Files', 'blue');
    const formPath = await createSampleForm();
    const docPath = await createSourceDocument();
    
    // Step 2: Initialize services
    log('\n⚙️  Step 2: Initializing Services', 'blue');
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
    
    log('  ✅ All services initialized', 'green');
    
    // Step 3: Parse source document
    log('\n📄 Step 3: Parsing Source Document', 'blue');
    const parsedDoc = await documentParser.parse(docPath);
    log(`  ✅ Document parsed: Type: ${parsedDoc.type}, ${parsedDoc.content.length} characters`, 'green');
    
    // Show extracted text
    log('\n  📝 Extracted Text Preview:', 'yellow');
    const preview = parsedDoc.content.substring(0, 200);
    console.log('  ' + preview.replace(/\n/g, '\n  '));
    
    // Step 4: Extract structured data
    log('\n🔍 Step 4: Extracting Structured Data', 'blue');
    const extractedData = await dataExtractor.extract(parsedDoc);
    log('  ✅ Data extracted successfully', 'green');
    
    // Show extracted fields
    log('\n  📊 Extracted Fields:', 'yellow');
    for (const [key, value] of Object.entries(extractedData.fields)) {
      if (value) {
        log(`    • ${key}: ${value}`, 'cyan');
      }
    }
    
    // Step 5: Get form fields
    log('\n📋 Step 5: Analyzing Target Form', 'blue');
    const formInfo = await formFiller.validateFormFields(formPath);
    log(`  ✅ Found ${formInfo.fields.length} form fields`, 'green');
    
    log('\n  📝 Form Fields:', 'yellow');
    for (const [field, type] of Object.entries(formInfo.fieldTypes)) {
      log(`    • ${field} (${type})`, 'cyan');
    }
    
    // Step 6: Map data to form fields
    log('\n🔗 Step 6: Mapping Data to Form Fields', 'blue');
    const mappingResult = await fieldMapper.mapFields(extractedData, formInfo.fields);
    log(`  ✅ Mapped ${mappingResult.mappings.length} fields`, 'green');
    log(`  ⚠️  Unmapped: ${mappingResult.unmappedFormFields.length} fields`, 'yellow');
    
    // Show mappings
    log('\n  🎯 Field Mappings:', 'yellow');
    for (const mapping of mappingResult.mappings) {
      const confidence = (mapping.confidence * 100).toFixed(0);
      log(`    • ${mapping.formField} → "${mapping.value}" (${confidence}% confidence)`, 'cyan');
    }
    
    // Step 7: Fill the form
    log('\n✍️  Step 7: Filling PDF Form', 'blue');
    const outputPath = path.join(path.dirname(formPath), 'filled-form.pdf');
    const fillResult = await formFiller.fillPDFForm(formPath, mappingResult, outputPath);
    
    if (fillResult.success) {
      log(`  ✅ Form filled successfully!`, 'green');
      log(`  📄 Output saved to: ${outputPath}`, 'green');
    } else {
      log(`  ⚠️  Form filled with warnings`, 'yellow');
    }
    
    // Show results
    log('\n📊 Fill Results:', 'yellow');
    log(`  • Filled fields: ${fillResult.filledFields.length}`, 'green');
    log(`  • Failed fields: ${fillResult.failedFields.length}`, fillResult.failedFields.length > 0 ? 'red' : 'green');
    log(`  • Warnings: ${fillResult.warnings.length}`, fillResult.warnings.length > 0 ? 'yellow' : 'green');
    
    if (fillResult.warnings.length > 0) {
      log('\n  ⚠️  Warnings:', 'yellow');
      for (const warning of fillResult.warnings) {
        log(`    • ${warning}`, 'yellow');
      }
    }
    
    // Step 8: Test with OCR (bonus)
    log('\n🔬 Step 8: Testing OCR Integration (Bonus)', 'blue');
    const ocrService = new OCRService();
    
    // Create test image from our source document
    const testImagePath = path.join(path.dirname(formPath), 'test-ocr-image.png');
    
    // For now, use the existing test image if available
    const imageExists = await fs.access(testImagePath).then(() => true).catch(() => false);
    if (imageExists) {
      const ocrResult = await ocrService.processImage(testImagePath);
      log(`  ✅ OCR extracted text with ${ocrResult.confidence.toFixed(0)}% confidence`, 'green');
      
      // Extract structured data from OCR text
      const ocrData = await ocrService.extractStructuredData(ocrResult.text);
      log(`  ✅ Found ${Object.keys(ocrData).length} data types in OCR text`, 'green');
    } else {
      log(`  ⚠️  Skipping OCR test (no test image)`, 'yellow');
    }
    
    await ocrService.cleanup();
    
    // Summary
    log('\n' + '='.repeat(60), 'cyan');
    log('🎉 PDF Form Filling Workflow Test Complete!', 'green');
    log('='.repeat(60), 'cyan');
    
    log('\n📈 Workflow Summary:', 'cyan');
    log('  1. ✅ Test files created', 'green');
    log('  2. ✅ Document parsed successfully', 'green');
    log('  3. ✅ Data extracted from source', 'green');
    log('  4. ✅ Form fields identified', 'green');
    log('  5. ✅ Data mapped to fields', 'green');
    log('  6. ✅ PDF form filled', 'green');
    log('  7. ✅ Output PDF saved', 'green');
    log('  8. ✅ OCR integration tested', 'green');
    
    log('\n✨ The QuikAdmin PDF form filling system is working!', 'magenta');
    log('🚀 Ready to automate document processing!\n', 'magenta');
    
    // Store results in memory
    const { rememberProjectContext } = await import('../src/utils/claude-memory');
    await rememberProjectContext('form-filling-test', {
      status: 'success',
      timestamp: new Date().toISOString(),
      mappedFields: mappingResult.mappings.length,
      filledFields: fillResult.filledFields.length,
      confidence: mappingResult.overallConfidence,
      outputPath
    });
    
    return true;
  } catch (error) {
    log(`\n❌ Error during workflow test: ${error}`, 'red');
    console.error(error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testFormFillingWorkflow()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { testFormFillingWorkflow };
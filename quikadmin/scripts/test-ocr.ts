#!/usr/bin/env ts-node

/**
 * OCR Service Test Script
 * Tests the OCR functionality with sample images and text extraction
 */

import { OCRService } from '../src/services/OCRService';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name: string, passed: boolean) {
  const symbol = passed ? '✅' : '❌';
  const color = passed ? 'green' : 'red';
  log(`${symbol} Test ${name}: ${passed ? 'PASSED' : 'FAILED'}`, color);
}

/**
 * Create a test image with text for OCR testing
 */
async function createTestImage(): Promise<string> {
  const testDir = path.join(process.cwd(), 'tests', 'test-data');
  await fs.mkdir(testDir, { recursive: true });
  
  const imagePath = path.join(testDir, 'test-ocr-image.png');
  
  // Create an image with text using sharp
  const svg = `
    <svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="400" fill="white"/>
      <text x="50" y="50" font-family="Arial" font-size="24" fill="black">
        OCR Test Document
      </text>
      <text x="50" y="100" font-family="Arial" font-size="18" fill="black">
        Name: John Doe
      </text>
      <text x="50" y="130" font-family="Arial" font-size="18" fill="black">
        Email: john.doe@example.com
      </text>
      <text x="50" y="160" font-family="Arial" font-size="18" fill="black">
        Phone: +1 (555) 123-4567
      </text>
      <text x="50" y="190" font-family="Arial" font-size="18" fill="black">
        Date: 12/31/2024
      </text>
      <text x="50" y="220" font-family="Arial" font-size="18" fill="black">
        Invoice #: INV-2024-001
      </text>
      <text x="50" y="250" font-family="Arial" font-size="18" fill="black">
        Amount: $1,234.56
      </text>
      <text x="50" y="280" font-family="Arial" font-size="18" fill="black">
        Status: Approved
      </text>
      <text x="50" y="330" font-family="Arial" font-size="16" fill="black">
        This is a test document for OCR functionality verification.
      </text>
      <text x="50" y="360" font-family="Arial" font-size="16" fill="black">
        The system should extract all text and structured data correctly.
      </text>
    </svg>
  `;
  
  await sharp(Buffer.from(svg))
    .png()
    .toFile(imagePath);
  
  log(`Test image created at: ${imagePath}`, 'green');
  return imagePath;
}

/**
 * Create a test text file for comparison
 */
async function createExpectedText(): Promise<string> {
  return `OCR Test Document
Name: John Doe
Email: john.doe@example.com
Phone: +1 (555) 123-4567
Date: 12/31/2024
Invoice #: INV-2024-001
Amount: $1,234.56
Status: Approved
This is a test document for OCR functionality verification.
The system should extract all text and structured data correctly.`;
}

/**
 * Main test function
 */
async function runOCRTests() {
  log('\n🔍 Testing OCR Functionality...\n', 'cyan');
  
  const ocrService = new OCRService();
  let allTestsPassed = true;
  
  try {
    // Test 1: Service Initialization
    log('📝 Test 1: OCR Service Initialization', 'blue');
    await ocrService.initialize();
    logTest('1: Service Initialization', true);
    
    // Test 2: Create Test Image
    log('\n🖼️ Test 2: Creating Test Image', 'blue');
    const testImagePath = await createTestImage();
    const imageExists = await fs.access(testImagePath).then(() => true).catch(() => false);
    logTest('2: Test Image Creation', imageExists);
    allTestsPassed = allTestsPassed && imageExists;
    
    // Test 3: Process Image with OCR
    log('\n🔤 Test 3: Processing Image with OCR', 'blue');
    const ocrResult = await ocrService.processImage(testImagePath);
    const ocrTextExtracted = ocrResult.text.length > 0;
    logTest('3: OCR Text Extraction', ocrTextExtracted);
    allTestsPassed = allTestsPassed && ocrTextExtracted;
    
    if (ocrTextExtracted) {
      log('\n📄 Extracted Text:', 'yellow');
      log('─'.repeat(50), 'yellow');
      console.log(ocrResult.text);
      log('─'.repeat(50), 'yellow');
      log(`\n📊 OCR Confidence: ${ocrResult.confidence.toFixed(2)}%`, 'yellow');
      log(`⏱️ Processing Time: ${ocrResult.metadata.processingTime}ms`, 'yellow');
    }
    
    // Test 4: Extract Structured Data
    log('\n📋 Test 4: Extracting Structured Data', 'blue');
    const structuredData = await ocrService.extractStructuredData(ocrResult.text);
    const hasStructuredData = Object.keys(structuredData).length > 0;
    logTest('4: Structured Data Extraction', hasStructuredData);
    allTestsPassed = allTestsPassed && hasStructuredData;
    
    if (hasStructuredData) {
      log('\n🗂️ Structured Data Found:', 'yellow');
      
      if (structuredData.email) {
        log(`  📧 Emails: ${structuredData.email.join(', ')}`, 'green');
      }
      
      if (structuredData.phone) {
        log(`  📞 Phones: ${structuredData.phone.join(', ')}`, 'green');
      }
      
      if (structuredData.date) {
        log(`  📅 Dates: ${structuredData.date.join(', ')}`, 'green');
      }
      
      if (structuredData.currency) {
        log(`  💰 Currency: ${structuredData.currency.join(', ')}`, 'green');
      }
      
      if (structuredData.fields && Object.keys(structuredData.fields).length > 0) {
        log('\n  📝 Extracted Fields:', 'yellow');
        for (const [key, value] of Object.entries(structuredData.fields)) {
          log(`    • ${key}: ${value}`, 'cyan');
        }
      }
    }
    
    // Test 5: Accuracy Check
    log('\n✔️ Test 5: OCR Accuracy Check', 'blue');
    const expectedText = await createExpectedText();
    const normalizeText = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();
    const expectedNormalized = normalizeText(expectedText);
    const actualNormalized = normalizeText(ocrResult.text);
    
    // Calculate similarity (simple approach)
    const commonWords = expectedNormalized.split(' ').filter(word => 
      actualNormalized.includes(word)
    );
    const accuracy = (commonWords.length / expectedNormalized.split(' ').length) * 100;
    
    const accuracyPassed = accuracy > 70; // 70% threshold for passing
    logTest(`5: OCR Accuracy (${accuracy.toFixed(1)}%)`, accuracyPassed);
    allTestsPassed = allTestsPassed && accuracyPassed;
    
    // Test 6: Cleanup
    log('\n🧹 Test 6: Service Cleanup', 'blue');
    await ocrService.cleanup();
    logTest('6: Service Cleanup', true);
    
    // Summary
    log('\n' + '='.repeat(50), 'cyan');
    if (allTestsPassed) {
      log('🎉 All OCR tests completed successfully!', 'green');
      log('\n✨ OCR Service is fully functional!', 'green');
      
      // Store test results in memory
      const { rememberProjectContext } = await import('../src/utils/claude-memory');
      await rememberProjectContext('ocr-test-results', {
        status: 'passed',
        accuracy,
        confidence: ocrResult.confidence,
        processingTime: ocrResult.metadata.processingTime,
        timestamp: new Date().toISOString(),
        extractedData: structuredData
      });
      
      log('💾 Test results stored in memory bank', 'green');
    } else {
      log('⚠️ Some OCR tests failed. Please review the results.', 'red');
    }
    
    // Performance Summary
    log('\n📈 OCR Performance Metrics:', 'cyan');
    log(`  • Processing Speed: ${ocrResult.metadata.processingTime}ms`, 'yellow');
    log(`  • Text Confidence: ${ocrResult.confidence.toFixed(2)}%`, 'yellow');
    log(`  • Accuracy Score: ${accuracy.toFixed(1)}%`, 'yellow');
    log(`  • Languages Supported: eng, spa, fra, deu`, 'yellow');
    
  } catch (error) {
    log(`\n❌ OCR test error: ${error}`, 'red');
    allTestsPassed = false;
  }
  
  return allTestsPassed;
}

// Run tests
if (require.main === module) {
  runOCRTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
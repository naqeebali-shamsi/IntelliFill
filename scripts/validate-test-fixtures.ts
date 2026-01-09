#!/usr/bin/env ts-node
/**
 * Test Fixture Validation Script
 *
 * Validates that all required test assets are accessible and functional
 * before running the test suite.
 *
 * Usage: npx ts-node scripts/validate-test-fixtures.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface FixtureDefinition {
  name: string;
  path: string;
  required: boolean;
  shouldFail?: boolean; // For corrupted files
  minSize?: number;
}

const E2E_FIXTURES_DIR = path.join(__dirname, '../e2e/fixtures');

const REQUIRED_FIXTURES: FixtureDefinition[] = [
  { name: 'Sample Document', path: 'sample-document.pdf', required: true },
  { name: 'Sample Document 2', path: 'sample-document-2.pdf', required: true },
  { name: 'Large Document', path: 'large-document.pdf', required: false },
  { name: 'Oversized Document', path: 'oversized-document.pdf', required: false },
  { name: 'Invalid File', path: 'invalid-file.txt', required: true },
  { name: 'Test Passport', path: 'test-passport.pdf', required: false },
  { name: 'Test Emirates ID', path: 'test-emirates-id.jpg', required: false },
  { name: 'Test Trade License', path: 'test-trade-license.pdf', required: false },
  { name: 'Test Corrupted', path: 'test-corrupted.pdf', required: false, shouldFail: true },
  { name: 'Visa Template', path: 'visa-application-template.pdf', required: false },
];

interface ValidationResult {
  fixture: string;
  exists: boolean;
  readable: boolean;
  size: number;
  error?: string;
}

async function validateFixture(fixture: FixtureDefinition): Promise<ValidationResult> {
  const fullPath = path.join(E2E_FIXTURES_DIR, fixture.path);
  const result: ValidationResult = {
    fixture: fixture.name,
    exists: false,
    readable: false,
    size: 0,
  };

  try {
    const stats = fs.statSync(fullPath);
    result.exists = true;
    result.size = stats.size;

    // Try to read the file
    const buffer = fs.readFileSync(fullPath);
    result.readable = true;

    // Check minimum size if specified
    if (fixture.minSize && stats.size < fixture.minSize) {
      result.error = `File too small: ${stats.size} < ${fixture.minSize}`;
    }

    // For PDFs, check magic bytes
    if (fixture.path.endsWith('.pdf') && !fixture.shouldFail) {
      const header = buffer.toString('utf8', 0, 5);
      if (header !== '%PDF-') {
        result.error = 'Invalid PDF header';
      }
    }

    // For corrupted files, verify they have issues
    if (fixture.shouldFail && fixture.path.endsWith('.pdf')) {
      const header = buffer.toString('utf8', 0, 5);
      if (header === '%PDF-') {
        // File looks valid, but it should be corrupted
        // This is OK - we just note it might not trigger failures
        result.error = 'Warning: Corrupted file has valid header';
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      result.error = err.message;
    } else {
      result.error = 'Unknown error';
    }
  }

  return result;
}

async function main(): Promise<void> {
  console.log('🔍 Validating Test Fixtures...\n');
  console.log(`📁 Fixtures Directory: ${E2E_FIXTURES_DIR}\n`);

  let hasErrors = false;
  const results: ValidationResult[] = [];

  for (const fixture of REQUIRED_FIXTURES) {
    const result = await validateFixture(fixture);
    results.push(result);

    const status = result.exists && result.readable && !result.error ? '✅' : '❌';
    const sizeStr = result.exists ? `(${result.size} bytes)` : '';

    console.log(`${status} ${fixture.name}: ${fixture.path} ${sizeStr}`);

    if (result.error) {
      console.log(`   ⚠️  ${result.error}`);
    }

    if (fixture.required && (!result.exists || !result.readable)) {
      hasErrors = true;
    }
  }

  console.log('\n📊 Summary:');
  const existing = results.filter((r) => r.exists).length;
  const readable = results.filter((r) => r.readable).length;
  console.log(`   Files found: ${existing}/${results.length}`);
  console.log(`   Files readable: ${readable}/${results.length}`);

  if (hasErrors) {
    console.log('\n❌ Validation FAILED: Some required fixtures are missing or unreadable');
    process.exit(1);
  } else {
    console.log('\n✅ Validation PASSED: All required fixtures are accessible');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

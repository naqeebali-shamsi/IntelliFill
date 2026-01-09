/**
 * Migrate ExtractedData Format Script
 *
 * Purpose: Convert existing document extractedData from legacy format
 *          (simple key-value pairs) to the new format with confidence scores.
 *
 * This handles the data migration for documents created before the
 * ExtractedFieldResult format was introduced.
 *
 * New format:
 * {
 *   fieldName: {
 *     value: string | number | boolean | null,
 *     confidence: number (0-100),
 *     source: 'ocr' | 'pattern' | 'llm',
 *     rawText?: string
 *   }
 * }
 *
 * Usage: npx tsx scripts/migrate-extracted-data-format.ts [--dry-run] [--limit N]
 *
 * Options:
 *   --dry-run  Preview changes without saving to database
 *   --limit N  Process only N documents (for testing)
 *
 * Safety:
 * - Idempotent: Safe to run multiple times (skips already-migrated data)
 * - Non-destructive: Only adds confidence/source, preserves original values
 * - Uses default confidence: 0 and source: 'pattern' for legacy data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : undefined;

/**
 * Check if a value is already in the new ExtractedFieldResult format
 */
function isNewFormat(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    'value' in obj &&
    'confidence' in obj &&
    'source' in obj &&
    typeof obj.confidence === 'number' &&
    ['ocr', 'pattern', 'llm'].includes(obj.source as string)
  );
}

/**
 * Check if extractedData is already migrated
 */
function isAlreadyMigrated(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const obj = data as Record<string, unknown>;
  const keys = Object.keys(obj);

  if (keys.length === 0) {
    return true; // Empty object is already migrated
  }

  // Check if at least one field is in the new format
  return keys.some((key) => isNewFormat(obj[key]));
}

/**
 * Convert legacy extractedData to new format with confidence
 */
function migrateToNewFormat(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip if already in new format
    if (isNewFormat(value)) {
      result[key] = value;
      continue;
    }

    // Handle arrays by taking the first value
    const normalizedValue = Array.isArray(value) ? (value[0] ?? null) : value;

    // Convert to new format with default confidence and source
    result[key] = {
      value: normalizedValue,
      confidence: 0, // Default confidence for legacy data
      source: 'pattern', // Default source for legacy data
      rawText: typeof normalizedValue === 'string' ? normalizedValue : undefined,
    };
  }

  return result;
}

async function migrateExtractedData(): Promise<void> {
  console.log('='.repeat(60));
  console.log('ExtractedData Format Migration Script');
  console.log('='.repeat(60));
  console.log('');

  if (dryRun) {
    console.log('[DRY RUN MODE] No changes will be saved to database');
    console.log('');
  }

  if (limit) {
    console.log(`[LIMIT MODE] Processing only ${limit} documents`);
    console.log('');
  }

  const startTime = Date.now();

  try {
    // Step 1: Find documents with extractedData that need migration
    console.log('[1/4] Finding documents with extractedData...');

    const documents = await prisma.document.findMany({
      where: {
        extractedData: { not: null },
      },
      select: {
        id: true,
        fileName: true,
        extractedData: true,
      },
      take: limit,
    });

    console.log(`      Found ${documents.length} documents with extractedData`);

    // Step 2: Filter documents needing migration
    console.log('');
    console.log('[2/4] Analyzing documents for migration...');

    const docsNeedingMigration = documents.filter((doc) => {
      const data = doc.extractedData as Record<string, unknown> | null;
      return data && !isAlreadyMigrated(data);
    });

    console.log(`      ${docsNeedingMigration.length} documents need migration`);
    console.log(`      ${documents.length - docsNeedingMigration.length} documents already migrated`);

    if (docsNeedingMigration.length === 0) {
      console.log('');
      console.log('[DONE] No documents need migration. All data is up to date.');
      return;
    }

    // Step 3: Display summary of what will be migrated
    console.log('');
    console.log('[3/4] Documents to be migrated:');

    for (const doc of docsNeedingMigration.slice(0, 10)) {
      const data = doc.extractedData as Record<string, unknown>;
      const fieldCount = Object.keys(data).length;
      console.log(`      - ${doc.fileName} (${fieldCount} fields)`);
    }

    if (docsNeedingMigration.length > 10) {
      console.log(`      ... and ${docsNeedingMigration.length - 10} more`);
    }

    // Step 4: Perform migration
    console.log('');
    console.log('[4/4] Migrating documents...');

    let migratedCount = 0;
    let errorCount = 0;

    for (const doc of docsNeedingMigration) {
      try {
        const legacyData = doc.extractedData as Record<string, unknown>;
        const migratedData = migrateToNewFormat(legacyData);

        if (!dryRun) {
          await prisma.document.update({
            where: { id: doc.id },
            data: {
              extractedData: migratedData,
            },
          });
        }

        migratedCount++;

        // Progress indicator every 10 documents
        if (migratedCount % 10 === 0) {
          console.log(`      Migrated ${migratedCount}/${docsNeedingMigration.length} documents...`);
        }
      } catch (error) {
        errorCount++;
        console.error(`      Error migrating ${doc.fileName}: ${error instanceof Error ? error.message : error}`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('');
    console.log('='.repeat(60));
    console.log(dryRun ? '[DRY RUN COMPLETE]' : '[SUCCESS] Migration completed');
    console.log('='.repeat(60));
    console.log(`  Migrated: ${migratedCount} documents`);
    console.log(`  Errors:   ${errorCount} documents`);
    console.log(`  Skipped:  ${documents.length - docsNeedingMigration.length} (already migrated)`);
    console.log(`  Time:     ${elapsed}s`);
    console.log('');

    if (dryRun) {
      console.log('To apply changes, run without --dry-run flag.');
    }
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('[ERROR] Migration failed');
    console.error('='.repeat(60));

    if (error instanceof Error) {
      console.error(`  Message: ${error.message}`);
      if (error.stack) {
        console.error('');
        console.error('Stack trace:');
        console.error(error.stack);
      }
    } else {
      console.error('  Unknown error:', error);
    }

    process.exit(1);
  }
}

// Main execution
migrateExtractedData()
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('');
    console.log('Database connection closed.');
  });

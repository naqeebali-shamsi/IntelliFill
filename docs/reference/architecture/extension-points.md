---
title: 'Extension Points Guide'
description: 'Guide for extending IntelliFill with custom document types, entity patterns, and field mapping strategies'
category: 'reference'
audience: 'developers'
lastUpdated: '2026-01-25'
status: 'active'
---

# Extension Points Guide

This guide documents how to extend IntelliFill with custom document types, entity extraction patterns, form field types, and mapping strategies.

---

## 1. Adding New Document Types

IntelliFill supports adding new document types for specialized extraction.

### 1.1 Current Document Types

| Type | File Extensions | Extraction Method |
|------|-----------------|-------------------|
| `pdf` | `.pdf` | OCR + Pattern Matching |
| `docx` | `.docx` | XML Parsing + Pattern Matching |
| `txt` | `.txt` | Pattern Matching |
| `csv` | `.csv` | Structured Parsing |
| `image` | `.jpg`, `.png`, `.tiff` | OCR |

### 1.2 Steps to Add a New Document Type

#### Step 1: Add Type Enum

**File**: `quikadmin/src/parsers/DocumentParser.ts`

```typescript
export type DocumentType = 'pdf' | 'docx' | 'txt' | 'csv' | 'image' | 'xlsx'; // Add new type
```

#### Step 2: Create Parser Method

Add a new parsing method in `DocumentParser.ts`:

```typescript
async parseXlsx(filePath: string): Promise<ParsedDocument> {
  // 1. Read the file
  const workbook = xlsx.readFile(filePath);

  // 2. Extract content
  const content = this.extractXlsxContent(workbook);

  // 3. Extract structured data
  const structuredData = this.extractXlsxStructuredData(workbook);

  return {
    type: 'xlsx',
    content,
    structuredData,
    metadata: {
      pageCount: workbook.SheetNames.length,
      extractedAt: new Date(),
    },
  };
}
```

#### Step 3: Register in Parser Switch

```typescript
async parse(filePath: string, fileType: string): Promise<ParsedDocument> {
  switch (this.getDocumentType(fileType)) {
    case 'pdf':
      return this.parsePdf(filePath);
    case 'docx':
      return this.parseDocx(filePath);
    case 'xlsx':  // Add new case
      return this.parseXlsx(filePath);
    // ...
  }
}
```

#### Step 4: Update Extraction Method

**File**: `quikadmin/src/extractors/DataExtractor.ts`

```typescript
private getExtractionMethod(type: string): string {
  const methods: Record<string, string> = {
    pdf: 'OCR + Pattern Matching',
    docx: 'XML Parsing + Pattern Matching',
    txt: 'Pattern Matching',
    csv: 'Structured Parsing',
    xlsx: 'Workbook Parsing',  // Add new method description
  };
  return methods[type] || 'Unknown';
}
```

#### Step 5: Update File Validation

**File**: `quikadmin/src/middleware/fileUpload.ts`

```typescript
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // Add XLSX
];
```

---

## 2. Adding Entity Extraction Patterns

Extend the entity recognition system with custom patterns.

### 2.1 Current Entity Types

| Entity | Regex Pattern | Confidence |
|--------|---------------|------------|
| Email | `[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+` | 0.90 |
| Phone | `(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}` | 0.90 |
| Date | `(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\|(\d{4}[-/]\d{1,2}[-/]\d{1,2})` | 0.80 |
| Currency | `[$€£¥]\s?\d+(?:,\d{3})*(?:\.\d{2})?` | 0.70 |
| Name | Pattern-based with title prefixes | 0.85 |
| Address | Street pattern matching | 0.75 |
| Numbers | `\b\d+(?:\.\d+)?\b` | Variable |

### 2.2 Steps to Add a New Entity Type

#### Step 1: Define the Regex Pattern

**File**: `quikadmin/src/extractors/DataExtractor.ts`

```typescript
export class DataExtractor {
  // Existing patterns
  private emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
  private phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;

  // Add new pattern
  private emiratesIdRegex = /\d{3}-\d{4}-\d{7}-\d{1}/g;
  private uaePassportRegex = /[A-Z]{1,2}\d{7}/g;
}
```

#### Step 2: Update ExtractedData Interface

```typescript
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
    emiratesIds: string[];    // Add new entity type
    passportNumbers: string[]; // Add new entity type
  };
  metadata: {
    extractionMethod: string;
    confidence: number;
    timestamp: Date;
  };
}
```

#### Step 3: Create Extraction Method

```typescript
private extractEmiratesIds(text: string): string[] {
  const matches = text.match(this.emiratesIdRegex) || [];
  return [...new Set(matches)];
}

private extractPassportNumbers(text: string): string[] {
  const matches = text.match(this.uaePassportRegex) || [];
  return [...new Set(matches)];
}
```

#### Step 4: Call in Main Extract Method

```typescript
async extract(document: ParsedDocument): Promise<ExtractedData> {
  const content = document.content;

  const entities = {
    names: this.extractNames(content),
    emails: this.extractEmails(content),
    phones: this.extractPhones(content),
    dates: this.extractDates(content),
    addresses: this.extractAddresses(content),
    numbers: this.extractNumbers(content),
    currencies: this.extractCurrencies(content),
    emiratesIds: this.extractEmiratesIds(content),       // Add new
    passportNumbers: this.extractPassportNumbers(content), // Add new
  };

  // ...
}
```

#### Step 5: Add Field Mapper Entity Mapping

**File**: `quikadmin/src/mappers/FieldMapper.ts`

```typescript
private mapToEntity(
  formField: string,
  entities: ExtractedData['entities']
): { source: string; value: unknown; confidence: number; method: string } | null {
  const fieldLower = formField.toLowerCase();

  // Existing mappings...

  // Add Emirates ID mapping
  if (fieldLower.includes('emirates') || fieldLower.includes('eid')) {
    if (entities.emiratesIds.length > 0) {
      return {
        source: 'entities.emiratesIds',
        value: entities.emiratesIds[0],
        confidence: 0.95,
        method: 'Entity Pattern Match',
      };
    }
  }

  // Add Passport mapping
  if (fieldLower.includes('passport')) {
    if (entities.passportNumbers.length > 0) {
      return {
        source: 'entities.passportNumbers',
        value: entities.passportNumbers[0],
        confidence: 0.9,
        method: 'Entity Pattern Match',
      };
    }
  }

  return null;
}
```

---

## 3. Adding Form Field Types

Extend PDF form filling with custom field type handlers.

### 3.1 Current Field Types

| Type | Class | Handling |
|------|-------|----------|
| Text | `PDFTextField` | Direct text insertion |
| Checkbox | `PDFCheckBox` | Boolean check/uncheck |
| Dropdown | `PDFDropdown` | Option selection |
| Radio | `PDFRadioGroup` | Option selection |

### 3.2 Steps to Add a New Field Type Handler

**File**: `quikadmin/src/fillers/FormFiller.ts`

#### Example: Adding Signature Field Support

```typescript
import { PDFDocument, PDFForm, PDFTextField, PDFCheckBox,
         PDFDropdown, PDFRadioGroup, PDFSignature } from 'pdf-lib';

// In fillPDFForm method, add new case:
for (const mapping of mappings.mappings) {
  try {
    const field = form.getField(mapping.formField);

    if (!field) {
      warnings.push(`Field '${mapping.formField}' not found`);
      continue;
    }

    // Existing handlers...

    // Add signature field handler
    if (field instanceof PDFSignature) {
      // Note: Actual signature insertion requires digital certificates
      // This example marks the field as requiring signature
      warnings.push(
        `Signature field '${mapping.formField}' requires manual signing`
      );
      continue;
    }

    // Generic unknown field handler
    warnings.push(`Unknown field type for '${mapping.formField}'`);

  } catch (error) {
    failedFields.push({
      field: mapping.formField,
      reason: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
```

### 3.3 Adding Custom Value Transformers

Add transformers for special field formatting:

```typescript
private formatFieldValue(fieldName: string, value: unknown): string {
  const fieldLower = fieldName.toLowerCase();
  const valueStr = String(value);

  // Date formatting
  if (fieldLower.includes('date')) {
    return this.formatDate(valueStr);
  }

  // Phone formatting
  if (fieldLower.includes('phone') || fieldLower.includes('tel')) {
    return this.formatPhone(valueStr);
  }

  // Currency formatting
  if (fieldLower.includes('amount') || fieldLower.includes('price')) {
    return this.formatCurrency(valueStr);
  }

  return valueStr;
}

private formatDate(value: string): string {
  // Convert to DD/MM/YYYY format
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toLocaleDateString('en-GB');
  }
  return value;
}

private formatPhone(value: string): string {
  // Format as +971 XX XXX XXXX for UAE
  const digits = value.replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('5')) {
    return `+971 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }
  return value;
}
```

---

## 4. Creating Custom Field Mapping Strategies

Add specialized mapping strategies for specific use cases.

### 4.1 Current Mapping Strategies

| Strategy | Method | Usage |
|----------|--------|-------|
| Direct Field Match | Levenshtein similarity | Default for all fields |
| Entity Pattern Match | Keyword detection | Emails, phones, names, dates, addresses |
| Type Validation Boost | Regex pattern matching | Emails, phones, dates, ZIP codes |

### 4.2 Steps to Add a Custom Strategy

#### Example: UAE Document Field Strategy

**File**: `quikadmin/src/mappers/UAEFieldStrategy.ts` (new file)

```typescript
import { ExtractedData } from '../extractors/DataExtractor';

export interface UAEFieldMapping {
  source: string;
  value: unknown;
  confidence: number;
  method: string;
}

/**
 * Specialized field mapping strategy for UAE government forms
 */
export class UAEFieldStrategy {
  /**
   * Common UAE form field patterns and their expected data sources
   */
  private fieldMappings: Record<string, string[]> = {
    // Emirates ID fields
    'emirates_id': ['emirates_id', 'eid', 'id_number', 'national_id'],
    'eid_expiry': ['id_expiry', 'eid_expiry_date', 'id_valid_until'],

    // Visa fields
    'visa_number': ['visa_no', 'visa_number', 'entry_permit'],
    'visa_expiry': ['visa_expiry', 'visa_valid_until'],
    'visa_type': ['visa_type', 'entry_type', 'permit_type'],

    // Passport fields
    'passport_number': ['passport_no', 'passport', 'travel_document'],
    'passport_expiry': ['passport_expiry', 'passport_valid_until'],
    'place_of_issue': ['issue_place', 'issued_at', 'issuing_authority'],

    // Personal fields
    'full_name_arabic': ['name_ar', 'arabic_name', 'الاسم'],
    'full_name_english': ['name_en', 'english_name', 'name'],
    'nationality': ['nationality', 'citizenship', 'country'],
    'profession': ['profession', 'occupation', 'job_title'],
    'sponsor_name': ['sponsor', 'employer', 'company_name'],
  };

  /**
   * Map UAE-specific form fields
   */
  mapUAEField(
    formField: string,
    extractedData: ExtractedData
  ): UAEFieldMapping | null {
    const normalizedField = this.normalizeField(formField);

    // Check each mapping group
    for (const [targetField, sourceFields] of Object.entries(this.fieldMappings)) {
      if (sourceFields.some(sf => normalizedField.includes(sf) || sf.includes(normalizedField))) {
        // Find matching data in extracted fields
        for (const source of sourceFields) {
          if (extractedData.fields[source]) {
            return {
              source,
              value: extractedData.fields[source],
              confidence: 0.95,
              method: 'UAE Document Strategy',
            };
          }
        }
      }
    }

    return null;
  }

  private normalizeField(field: string): string {
    return field.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }
}
```

#### Integrate with FieldMapper

**File**: `quikadmin/src/mappers/FieldMapper.ts`

```typescript
import { UAEFieldStrategy } from './UAEFieldStrategy';

export class FieldMapper {
  private uaeStrategy = new UAEFieldStrategy();

  private findBestMatch(
    normalizedFormField: string,
    extractedData: ExtractedData,
    mappedDataFields: Set<string>
  ): { source: string; value: unknown; confidence: number; method: string } | null {
    let bestMatch = null;
    let bestConfidence = 0;

    // Try UAE-specific strategy first
    const uaeMatch = this.uaeStrategy.mapUAEField(normalizedFormField, extractedData);
    if (uaeMatch && uaeMatch.confidence > bestConfidence) {
      bestMatch = uaeMatch;
      bestConfidence = uaeMatch.confidence;
    }

    // Fall back to direct field matches
    // ... existing code ...

    return bestMatch;
  }
}
```

---

## 5. Adding Profile Deduplication Rules

Extend the profile aggregation with custom deduplication logic.

### 5.1 Current Deduplication Rules

| Field Type | Normalization | Comparison |
|------------|---------------|------------|
| Email | Lowercase | Case-insensitive |
| Phone | Digits only, strip country code | Numeric comparison |
| SSN/ID | Digits only | Numeric comparison |
| Default | None | Exact match |

### 5.2 Steps to Add Custom Deduplication

**File**: `quikadmin/src/services/ProfileService.ts`

```typescript
private deduplicateFields(fields: Record<string, ProfileField>): void {
  for (const field of Object.values(fields)) {
    const deduplicatedValues: string[] = [];

    for (const value of field.values) {
      // Existing rules...

      // Add Emirates ID deduplication (with dashes)
      if (field.key.includes('emirates') || field.key.includes('eid')) {
        const normalizedEid = this.normalizeEmiratesId(value);
        if (!deduplicatedValues.some(v =>
            this.normalizeEmiratesId(v) === normalizedEid)) {
          deduplicatedValues.push(value);
        }
        continue;
      }

      // Add passport number deduplication (case-insensitive)
      if (field.key.includes('passport')) {
        const normalizedPassport = value.toUpperCase().replace(/\s/g, '');
        if (!deduplicatedValues.some(v =>
            v.toUpperCase().replace(/\s/g, '') === normalizedPassport)) {
          deduplicatedValues.push(value);
        }
        continue;
      }

      // Default: exact match
      if (!deduplicatedValues.includes(value)) {
        deduplicatedValues.push(value);
      }
    }

    field.values = deduplicatedValues;
  }
}

private normalizeEmiratesId(eid: string): string {
  // Remove all non-digits, normalize to format: 784-XXXX-XXXXXXX-X
  return eid.replace(/[^\d]/g, '');
}
```

---

## 6. Testing Extensions

### 6.1 Unit Test Template

```typescript
// tests/mappers/UAEFieldStrategy.test.ts
import { UAEFieldStrategy } from '../../src/mappers/UAEFieldStrategy';

describe('UAEFieldStrategy', () => {
  const strategy = new UAEFieldStrategy();

  describe('mapUAEField', () => {
    it('should map emirates_id field', () => {
      const extractedData = {
        fields: { emirates_id: '784-1990-1234567-1' },
        entities: { /* ... */ },
        metadata: { /* ... */ },
      };

      const result = strategy.mapUAEField('Emirates ID Number', extractedData);

      expect(result).toBeDefined();
      expect(result?.value).toBe('784-1990-1234567-1');
      expect(result?.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should return null for unknown fields', () => {
      const extractedData = {
        fields: {},
        entities: { /* ... */ },
        metadata: { /* ... */ },
      };

      const result = strategy.mapUAEField('unknown_field', extractedData);

      expect(result).toBeNull();
    });
  });
});
```

### 6.2 Integration Test Template

```typescript
// tests/integration/document-processing.test.ts
import { DataExtractor } from '../../src/extractors/DataExtractor';
import { FieldMapper } from '../../src/mappers/FieldMapper';

describe('Document Processing Integration', () => {
  it('should extract and map UAE document data', async () => {
    const extractor = new DataExtractor();
    const mapper = new FieldMapper();

    // Mock document with UAE data
    const document = {
      type: 'txt',
      content: `
        Name: John Smith
        Emirates ID: 784-1990-1234567-1
        Passport: AB1234567
        Phone: +971 50 123 4567
      `,
      structuredData: null,
      metadata: {},
    };

    const extracted = await extractor.extract(document);

    expect(extracted.entities.phones).toContain('+971 50 123 4567');

    const formFields = ['Full Name', 'Emirates ID', 'Phone Number'];
    const mapping = await mapper.mapFields(extracted, formFields);

    expect(mapping.mappings.length).toBeGreaterThan(0);
    expect(mapping.overallConfidence).toBeGreaterThan(0.5);
  });
});
```

---

## 7. Best Practices

### 7.1 Pattern Design

1. **Test patterns extensively** before adding to production
2. **Use non-capturing groups** `(?:...)` when grouping isn't needed
3. **Consider performance** - complex patterns slow extraction
4. **Add flags appropriately** - `g` for global, `i` for case-insensitive

### 7.2 Confidence Scores

| Match Type | Recommended Confidence |
|------------|----------------------|
| Exact pattern match | 0.95 - 1.00 |
| Entity pattern match | 0.85 - 0.95 |
| Fuzzy string match | 0.60 - 0.85 |
| Fallback match | 0.50 - 0.60 |

### 7.3 Error Handling

```typescript
// Always wrap extraction in try-catch
try {
  const matches = text.match(pattern) || [];
  return [...new Set(matches)];
} catch (error) {
  logger.warn(`Pattern extraction failed: ${error.message}`);
  return [];
}
```

---

## Related Documentation

- [Core Algorithms Reference](./core-algorithms.md) - Algorithm implementations
- [Technical Differentiators](../../business/technical-differentiators.md) - Business context
- [API Reference](../api/endpoints.md) - API endpoints

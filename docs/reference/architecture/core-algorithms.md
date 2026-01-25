---
title: 'Core Algorithms Reference'
description: 'Detailed technical documentation of IntelliFill core algorithms'
category: 'reference'
audience: 'developers'
lastUpdated: '2026-01-25'
status: 'active'
---

# Core Algorithms Reference

This document provides detailed technical documentation of the algorithms powering IntelliFill's document processing and form-filling capabilities.

---

## 1. Field Mapping Algorithm

**Source**: `quikadmin/src/mappers/FieldMapper.ts`

The FieldMapper class is responsible for automatically matching extracted document data to form template fields.

### 1.1 Algorithm Flow

```
┌─────────────────┐
│ Form Fields     │
│ (array)         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 1. Normalize    │  Convert to lowercase, replace special chars
│    Field Names  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. Detect       │  Find fields that normalize to same value
│    Duplicates   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 3. For each form field:                 │
│    a. Find best match from extracted    │
│       data (direct match OR entity)     │
│    b. Calculate similarity score        │
│    c. Apply type validation boost       │
│    d. Accept if confidence >= 0.5       │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ 4. Return       │  Mappings, unmapped fields, overall confidence
│    MappingResult│
└─────────────────┘
```

### 1.2 Field Normalization

**Function**: `normalizeFieldName(field: string): string`

```typescript
private normalizeFieldName(field: string): string {
  return field
    .toLowerCase()                    // Convert to lowercase
    .replace(/[^a-z0-9]/g, '_')       // Replace non-alphanumeric with underscore
    .replace(/_+/g, '_')              // Collapse multiple underscores
    .replace(/^_|_$/g, '');           // Trim leading/trailing underscores
}
```

**Examples:**

| Input | Normalized |
|-------|------------|
| `Full Name` | `full_name` |
| `E-Mail Address` | `e_mail_address` |
| `Phone #` | `phone_` → `phone` |
| `__test__` | `test` |

### 1.3 Levenshtein Distance Implementation

**Function**: `levenshteinDistance(str1: string, str2: string): number`

The algorithm uses dynamic programming to calculate the minimum edit distance between two strings.

**Time Complexity**: O(m × n) where m and n are string lengths
**Space Complexity**: O(m × n)

```typescript
private levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  // Initialize first column: 0, 1, 2, 3, ...
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row: 0, 1, 2, 3, ...
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        // Characters match - no operation needed
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        // Take minimum of three operations:
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,  // substitution
          matrix[i][j - 1] + 1,       // insertion
          matrix[i - 1][j] + 1        // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}
```

**Example Calculation**: "email" vs "e_mail"

```
     ""  e  _  m  a  i  l
""    0  1  2  3  4  5  6
e     1  0  1  2  3  4  5
m     2  1  1  1  2  3  4
a     3  2  2  2  1  2  3
i     4  3  3  3  2  1  2
l     5  4  4  4  3  2  1

Result: 1 (single underscore insertion)
```

### 1.4 Similarity Calculation

**Function**: `calculateSimilarity(str1: string, str2: string): number`

```typescript
private calculateSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;  // Both empty strings = perfect match

  const distance = this.levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}
```

**Formula**: `similarity = 1 - (editDistance / maxLength)`

**Examples:**

| String 1 | String 2 | Distance | Max Length | Similarity |
|----------|----------|----------|------------|------------|
| `email` | `email` | 0 | 5 | 1.00 |
| `email` | `e_mail` | 1 | 6 | 0.83 |
| `fullname` | `full_name` | 1 | 9 | 0.89 |
| `phone` | `telephone` | 4 | 9 | 0.56 |
| `address` | `location` | 8 | 8 | 0.00 |

### 1.5 Type Validation Boosts

**Function**: `applyTypeValidation(field: string, value: unknown, confidence: number): number`

When extracted data matches expected patterns, confidence is boosted:

```typescript
private applyTypeValidation(field: string, value: unknown, confidence: number): number {
  const fieldLower = field.toLowerCase();
  const valueStr = String(value);

  // Email validation: boost ×1.2
  if (fieldLower.includes('email') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valueStr)) {
    return Math.min(confidence * 1.2, 1);
  }

  // Phone validation: boost ×1.2
  if ((fieldLower.includes('phone') || fieldLower.includes('tel')) &&
      /^\+?\d[\d\s\-()]+$/.test(valueStr)) {
    return Math.min(confidence * 1.2, 1);
  }

  // Date validation: boost ×1.15
  if (fieldLower.includes('date') && /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(valueStr)) {
    return Math.min(confidence * 1.15, 1);
  }

  // ZIP/Postal validation: boost ×1.2
  if ((fieldLower.includes('zip') || fieldLower.includes('postal')) &&
      /^\d{5}(-\d{4})?$/.test(valueStr)) {
    return Math.min(confidence * 1.2, 1);
  }

  return confidence;
}
```

**Boost Summary:**

| Field Type | Pattern | Boost Factor |
|------------|---------|--------------|
| Email | `[^\s@]+@[^\s@]+\.[^\s@]+` | ×1.2 |
| Phone/Tel | `\+?\d[\d\s\-()]+` | ×1.2 |
| ZIP/Postal | `\d{5}(-\d{4})?` | ×1.2 |
| Date | `\d{1,2}[-/]\d{1,2}[-/]\d{2,4}` | ×1.15 |

**Example:**
- Field: `customer_email`, Value: `john@example.com`
- Base similarity: 0.75
- After boost: `min(0.75 × 1.2, 1) = 0.90`

---

## 2. Entity Extraction Patterns

**Source**: `quikadmin/src/extractors/DataExtractor.ts`

The DataExtractor class identifies and extracts 7 entity types from unstructured text.

### 2.1 Regular Expression Patterns

| Entity | Pattern | Notes |
|--------|---------|-------|
| **Email** | `([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)` | Global, case-insensitive |
| **Phone** | `(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}` | Requires 7+ digits |
| **Date** | `(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\|(\d{4}[-/]\d{1,2}[-/]\d{1,2})` | MM/DD/YYYY or YYYY-MM-DD |
| **Currency** | `[$€£¥]\s?\d+(?:,\d{3})*(?:\.\d{2})?` | Common symbols with formatting |
| **Name** | `Name:\s*(?:Mr.\|Mrs.\|Ms.\|Dr.\|Prof.\|Eng\.)?\s*([A-Z][a-z]+ [A-Z][a-z]+)` | Pattern-based with titles |
| **Address** | `\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Street\|Ave\|...))` | Street address patterns |
| **Numbers** | `\b\d+(?:\.\d+)?\b` | Any numeric value |

### 2.2 Extraction Methods

#### Email Extraction

```typescript
private extractEmails(text: string): string[] {
  const matches = text.match(this.emailRegex) || [];
  return [...new Set(matches)];  // Deduplicate
}
```

#### Phone Extraction

```typescript
private extractPhones(text: string): string[] {
  const matches = text.match(this.phoneRegex) || [];
  // Filter to only include phones with 7+ digits
  return [...new Set(matches.filter(phone =>
    phone.replace(/\D/g, '').length >= 7
  ))];
}
```

#### Name Extraction

```typescript
private extractNames(text: string): string[] {
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
```

### 2.3 Confidence Calculation

**Function**: `calculateConfidence(entities, fields): number`

```typescript
private calculateConfidence(entities: any, fields: any): number {
  let score = 0;
  let total = 0;

  // Score entity extraction (1 point per non-empty entity type)
  for (const [key, value] of Object.entries(entities)) {
    total += 1;
    if (Array.isArray(value) && value.length > 0) {
      score += 1;
    }
  }

  // Score field extraction (up to 1 point based on count)
  const fieldCount = Object.keys(fields).length;
  if (fieldCount > 0) {
    score += Math.min(fieldCount / 10, 1);  // Max 1 point for 10+ fields
    total += 1;
  }

  return total > 0 ? (score / total) * 100 : 0;
}
```

---

## 3. Profile Aggregation Algorithm

**Source**: `quikadmin/src/services/ProfileService.ts`

The ProfileService aggregates data from multiple documents into a unified user profile.

### 3.1 Aggregation Flow

```
┌──────────────────┐
│ User Documents   │  All COMPLETED documents with extractedData
│ (ordered by date)│
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ For each document:                           │
│   1. Decrypt extracted data                  │
│   2. For each field:                         │
│      a. Normalize field key                  │
│      b. Extract values (handle arrays/objs)  │
│      c. Add to aggregated fields             │
│      d. Update confidence (weighted avg)     │
│      e. Track source documents               │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ Deduplicate      │  Type-aware deduplication
│ Fields           │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ AggregatedProfile│  fields, sources, confidence, lastAggregated
└──────────────────┘
```

### 3.2 Weighted Confidence Formula

When a field appears in multiple documents, confidence is calculated as a weighted average:

```typescript
// oldWeight = number of previous sources (n - 1)
// field.sources.length = total sources after adding current (n)
const oldWeight = field.sources.length - 1;
field.confidence = (field.confidence * oldWeight + confidence) / field.sources.length;
```

**Mathematical Formula:**

```
C_new = (C_old × (n-1) + C_doc) / n

Where:
  C_new = New aggregate confidence
  C_old = Previous aggregate confidence
  C_doc = Current document's confidence
  n = Total number of sources
```

**Example:**

| Step | Doc Confidence | Sources (n) | Aggregate Confidence |
|------|----------------|-------------|----------------------|
| Initial | 0.85 | 1 | 0.85 |
| Add doc (0.90) | 0.90 | 2 | (0.85×1 + 0.90)/2 = 0.875 |
| Add doc (0.80) | 0.80 | 3 | (0.875×2 + 0.80)/3 = 0.85 |
| Add doc (0.95) | 0.95 | 4 | (0.85×3 + 0.95)/4 = 0.875 |

### 3.3 Field Key Normalization

```typescript
private normalizeFieldKey(key: string): string {
  return key
    .toLowerCase()
    .trim()
    .replace(/[_\s-]+/g, '_')       // Unify separators to underscore
    .replace(/[^a-z0-9_]/g, '')     // Remove special characters
    .replace(/^_+|_+$/g, '');       // Trim underscores
}
```

### 3.4 Value Extraction

```typescript
private extractValues(value: any): string[] {
  if (typeof value === 'string') {
    return [value.trim()].filter(v => v.length > 0);
  } else if (Array.isArray(value)) {
    return value
      .filter(v => typeof v === 'string')
      .map(v => v.trim())
      .filter(v => v.length > 0);
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  } else if (typeof value === 'object' && value !== null) {
    // Flatten nested objects
    return Object.values(value)
      .filter(v => typeof v === 'string' || typeof v === 'number')
      .map(v => String(v).trim())
      .filter(v => v.length > 0);
  }
  return [];
}
```

### 3.5 Smart Deduplication

The deduplication logic applies type-aware normalization:

```typescript
private deduplicateFields(fields: Record<string, ProfileField>): void {
  for (const field of Object.values(fields)) {
    const deduplicatedValues: string[] = [];

    for (const value of field.values) {
      // Email: case-insensitive comparison
      if (field.key.includes('email')) {
        const lowerValue = value.toLowerCase();
        if (!deduplicatedValues.some(v => v.toLowerCase() === lowerValue)) {
          deduplicatedValues.push(value);
        }
        continue;
      }

      // Phone: digits-only comparison
      if (field.key.includes('phone') || field.key.includes('tel') ||
          field.key.includes('mobile')) {
        const normalizedPhone = this.normalizePhoneNumber(value);
        if (!deduplicatedValues.some(v =>
            this.normalizePhoneNumber(v) === normalizedPhone)) {
          deduplicatedValues.push(value);
        }
        continue;
      }

      // SSN/ID: digits-only comparison
      if (field.key.includes('ssn') || field.key.includes('social') ||
          field.key.includes('id')) {
        const normalizedId = value.replace(/[^0-9]/g, '');
        if (!deduplicatedValues.some(v =>
            v.replace(/[^0-9]/g, '') === normalizedId)) {
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
```

#### Phone Normalization

```typescript
private normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Remove US country code if present
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.substring(1);
  }
  return digits;
}
```

**Deduplication Examples:**

| Field Type | Values | After Dedup |
|------------|--------|-------------|
| Email | `["John@test.com", "john@test.com"]` | `["John@test.com"]` |
| Phone | `["+1 555-1234", "5551234"]` | `["+1 555-1234"]` |
| SSN | `["123-45-6789", "123456789"]` | `["123-45-6789"]` |
| Name | `["John Smith", "John Smith"]` | `["John Smith"]` |

---

## 4. Form Filling Algorithm

**Source**: `quikadmin/src/fillers/FormFiller.ts`

The FormFiller class writes data to PDF form fields using pdf-lib.

### 4.1 Field Type Handling

```typescript
// Fill based on field type
if (field instanceof PDFTextField) {
  field.setText(String(mapping.value));

} else if (field instanceof PDFCheckBox) {
  if (this.parseBoolean(mapping.value)) {
    field.check();
  } else {
    field.uncheck();
  }

} else if (field instanceof PDFDropdown) {
  const options = field.getOptions();
  const valueStr = String(mapping.value);
  if (options.includes(valueStr)) {
    field.select(valueStr);
  } else {
    // Try case-insensitive match
    const match = options.find(opt =>
      opt.toLowerCase() === valueStr.toLowerCase());
    if (match) field.select(match);
  }

} else if (field instanceof PDFRadioGroup) {
  const options = field.getOptions();
  const valueStr = String(mapping.value);
  if (options.includes(valueStr)) {
    field.select(valueStr);
  }
}
```

### 4.2 Boolean Parsing

```typescript
parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return lower === 'true' || lower === 'yes' ||
           lower === '1' || lower === 'checked' || lower === 'x';
  }
  return Boolean(value);
}
```

**Accepted truthy values:**
- `true` (boolean)
- `"true"`, `"yes"`, `"1"`, `"checked"`, `"x"` (case-insensitive strings)

---

## 5. Algorithm Complexity Summary

| Algorithm | Time Complexity | Space Complexity |
|-----------|-----------------|------------------|
| Field Normalization | O(n) | O(n) |
| Levenshtein Distance | O(m×n) | O(m×n) |
| Similarity Calculation | O(m×n) | O(m×n) |
| Entity Extraction | O(n×p) | O(n) |
| Profile Aggregation | O(d×f) | O(f) |
| Deduplication | O(v²) | O(v) |

Where:
- `n` = string length
- `m` = second string length
- `p` = number of regex patterns
- `d` = number of documents
- `f` = number of fields
- `v` = number of values

---

## Related Documentation

- [Technical Differentiators](../../business/technical-differentiators.md) - Business perspective on algorithms
- [Extension Points Guide](./extension-points.md) - How to extend these algorithms
- [API Reference](../api/endpoints.md) - API endpoints that use these algorithms

---
title: 'Dynamic PII Architecture: Final Design'
description: "Architecture for handling dynamically-discovered PII in IntelliFill's document extraction pipeline"
category: 'reference'
lastUpdated: '2025-12-30'
status: 'active'
---

# Dynamic PII Architecture: Final Design

**Last Updated**: 2025-12-17
**Status**: Approved Architecture
**Priority**: CRITICAL - Core Product Architecture

---

## Executive Summary

This document defines the architecture for handling dynamically-discovered PII in IntelliFill's document extraction pipeline. The system extracts arbitrary fields from documents (passports, Emirates IDs, trade licenses) via OCR, meaning we cannot know in advance what PII will be present.

**Selected Approach**: Hybrid (Encrypt-All + Document Templates + Classification Engine)

---

## Architecture Decisions

### Decision 1: Encryption Strategy

**Decision**: Encrypt all extracted data by default, with selective decryption based on access control.

**Rationale**:

- Provides immediate PHIPA/PIPEDA compliance
- Conservative approach - treats all extracted data as PII
- Reduces classification error risk (false negatives)
- Simplifies audit trail

### Decision 2: Key Management

**Decision**: Per-tenant keys derived from master key using HKDF.

**Rationale**:

- Tenant isolation - one key compromise doesn't affect others
- Master key stored in environment variable (Phase 1), migrateable to AWS KMS/Vault (Phase 2)
- Key rotation support via key versioning
- Balance between security and operational complexity

### Decision 3: Searchable Fields

**Decision**: Maintain plaintext blind indexes for these searchable fields only:

| Field                          | Reason                   | Search Type |
| ------------------------------ | ------------------------ | ----------- |
| `documentType`                 | Filter documents by type | Exact match |
| `clientId`                     | Associate with client    | Exact match |
| `issueDate`                    | Date-based filtering     | Range       |
| `expiryDate`                   | Expiration alerts        | Range       |
| `status`                       | Workflow state           | Exact match |
| `passportNumber` (blind index) | Lookup by passport       | Exact match |
| `emiratesId` (blind index)     | Lookup by Emirates ID    | Exact match |
| `clientName` (blind index)     | Client lookup            | Exact match |

All other extracted data remains encrypted and only accessible on explicit decrypt.

### Decision 4: Migration Strategy

**Decision**: Lazy migration with background backfill.

**Implementation**:

1. New documents encrypted on write
2. Existing documents decrypted transparently (read-time detection)
3. Background job encrypts unencrypted documents
4. Audit log tracks migration progress

---

## Data Model

### Phase 1: Encrypted JSON Blobs

```prisma
// prisma/schema.prisma additions

model Document {
  id                     String   @id @default(cuid())
  userId                 String
  companyId              String
  fileName               String
  fileType               String
  status                 DocumentStatus

  // Searchable metadata (plaintext)
  documentType           String?  // "UAE_PASSPORT", "EMIRATES_ID", "TRADE_LICENSE"
  issueDate              DateTime?
  expiryDate             DateTime?
  ocrConfidence          Float?

  // Encrypted data
  extractedDataEncrypted Bytes?   // AES-256-GCM encrypted JSON
  extractedDataNonce     Bytes?   // 12-byte nonce (IV)
  encryptionKeyVersion   Int      @default(1)

  // Blind indexes for search
  blindIndexes           BlindIndex[]

  // Legacy field (deprecated, to be migrated)
  extractedData          Json?    @deprecated

  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  @@index([documentType])
  @@index([issueDate])
  @@index([expiryDate])
  @@index([companyId, status])
}

model BlindIndex {
  id           String   @id @default(cuid())
  documentId   String
  document     Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  fieldName    String   // "passport_number", "emirates_id", "client_name"
  indexHash    String   // HMAC-SHA256 of value

  createdAt    DateTime @default(now())

  @@unique([documentId, fieldName])
  @@index([indexHash])
  @@index([fieldName, indexHash])
}

model ClientProfile {
  id                   String   @id @default(cuid())
  userId               String
  companyId            String

  // Searchable metadata (plaintext)
  displayName          String?  // User-chosen display name
  documentCount        Int      @default(0)

  // Encrypted PII
  dataEncrypted        Bytes?   // AES-256-GCM encrypted JSON
  dataNonce            Bytes?   // 12-byte nonce
  encryptionKeyVersion Int      @default(1)

  // Blind indexes for search
  nameBlindIndex       String?  // HMAC of actual name
  passportBlindIndex   String?  // HMAC of passport number
  emiratesIdBlindIndex String?  // HMAC of Emirates ID

  // Legacy field (deprecated)
  data                 Json?    @deprecated

  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@index([companyId])
  @@index([nameBlindIndex])
  @@index([passportBlindIndex])
  @@index([emiratesIdBlindIndex])
}

model EncryptionKeyRotation {
  id            String   @id @default(cuid())
  companyId     String
  keyVersion    Int
  status        KeyRotationStatus // ACTIVE, ROTATING, RETIRED
  createdAt     DateTime @default(now())
  rotatedAt     DateTime?

  @@unique([companyId, keyVersion])
}

enum KeyRotationStatus {
  ACTIVE
  ROTATING
  RETIRED
}
```

### Phase 2: Document Templates

```prisma
model DocumentTemplate {
  id              String   @id @default(cuid())
  name            String   // "UAE_PASSPORT"
  displayName     String   // "UAE Passport"
  version         String   // "1.0"

  // Field classifications
  piiFields       String[] // ["full_name", "passport_number", "date_of_birth"]
  phiFields       String[] // Medical-related fields
  sensitiveFields String[] // ["photo"]
  publicFields    String[] // ["issue_date", "expiry_date", "document_type"]

  // Detection patterns
  detectionPatterns Json   // Regex patterns to identify this document type

  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([name, version])
}
```

---

## Service Architecture

### EncryptionService

```typescript
// src/services/encryption/EncryptionService.ts

import * as crypto from 'crypto';
import { logger } from '../utils/logger';

export interface EncryptedPayload {
  ciphertext: Buffer;
  nonce: Buffer;
  keyVersion: number;
}

export interface DecryptedData<T = any> {
  data: T;
  keyVersion: number;
  wasLegacy: boolean;
}

export class EncryptionService {
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly NONCE_LENGTH = 12;
  private readonly AUTH_TAG_LENGTH = 16;
  private readonly KEY_LENGTH = 32;

  /**
   * Derives a tenant-specific encryption key from master key
   */
  deriveTenantKey(companyId: string, keyVersion: number = 1): Buffer {
    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey) {
      throw new Error('ENCRYPTION_MASTER_KEY not configured');
    }

    // HKDF: derive tenant-specific key
    const salt = Buffer.from(`tenant:${companyId}:v${keyVersion}`, 'utf8');
    const info = Buffer.from('intellifill-pii-encryption', 'utf8');

    return crypto.hkdfSync('sha256', Buffer.from(masterKey, 'base64'), salt, info, this.KEY_LENGTH);
  }

  /**
   * Derives key for blind indexes (separate from encryption key)
   */
  deriveBlindIndexKey(companyId: string): Buffer {
    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey) {
      throw new Error('ENCRYPTION_MASTER_KEY not configured');
    }

    const salt = Buffer.from(`blind-index:${companyId}`, 'utf8');
    const info = Buffer.from('intellifill-blind-index', 'utf8');

    return crypto.hkdfSync('sha256', Buffer.from(masterKey, 'base64'), salt, info, this.KEY_LENGTH);
  }

  /**
   * Encrypts a JSON payload
   */
  encrypt<T>(data: T, companyId: string, keyVersion: number = 1): EncryptedPayload {
    const key = this.deriveTenantKey(companyId, keyVersion);
    const nonce = crypto.randomBytes(this.NONCE_LENGTH);

    const cipher = crypto.createCipheriv(this.ALGORITHM, key, nonce, {
      authTagLength: this.AUTH_TAG_LENGTH,
    });

    const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Combine ciphertext + auth tag
    const ciphertext = Buffer.concat([encrypted, authTag]);

    logger.debug('Data encrypted', {
      companyId,
      keyVersion,
      plaintextLength: plaintext.length,
      ciphertextLength: ciphertext.length,
    });

    return { ciphertext, nonce, keyVersion };
  }

  /**
   * Decrypts an encrypted payload
   */
  decrypt<T>(payload: EncryptedPayload, companyId: string): DecryptedData<T> {
    const { ciphertext, nonce, keyVersion } = payload;
    const key = this.deriveTenantKey(companyId, keyVersion);

    // Extract auth tag from end of ciphertext
    const authTag = ciphertext.subarray(-this.AUTH_TAG_LENGTH);
    const encrypted = ciphertext.subarray(0, -this.AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, nonce, {
      authTagLength: this.AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    const data = JSON.parse(decrypted.toString('utf8')) as T;

    logger.debug('Data decrypted', {
      companyId,
      keyVersion,
      ciphertextLength: ciphertext.length,
    });

    return { data, keyVersion, wasLegacy: false };
  }

  /**
   * Creates a blind index for searchable encrypted fields
   */
  createBlindIndex(value: string, companyId: string): string {
    const key = this.deriveBlindIndexKey(companyId);

    // Normalize value for consistent indexing
    const normalized = value.toLowerCase().trim();

    // HMAC-SHA256
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(normalized);

    return hmac.digest('hex');
  }

  /**
   * Checks if a value matches a blind index
   */
  matchesBlindIndex(value: string, indexHash: string, companyId: string): boolean {
    const computedHash = this.createBlindIndex(value, companyId);
    return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(indexHash, 'hex'));
  }

  /**
   * Detects if data is legacy (unencrypted JSON)
   */
  isLegacyData(extractedData: any, extractedDataEncrypted: Buffer | null): boolean {
    // If we have encrypted data, it's not legacy
    if (extractedDataEncrypted && extractedDataEncrypted.length > 0) {
      return false;
    }

    // If we have JSON in the old field, it's legacy
    return extractedData !== null && extractedData !== undefined;
  }

  /**
   * Migrates legacy data to encrypted format
   */
  migrateLegacyData<T>(legacyData: T, companyId: string, keyVersion: number = 1): EncryptedPayload {
    logger.info('Migrating legacy data to encrypted format', { companyId });
    return this.encrypt(legacyData, companyId, keyVersion);
  }
}

export const encryptionService = new EncryptionService();
```

### PIIClassificationService

```typescript
// src/services/pii/PIIClassificationService.ts

import { logger } from '../utils/logger';

export type PIIClassification = 'PII' | 'PHI' | 'SENSITIVE' | 'PUBLIC';

export interface ClassifiedField {
  key: string;
  value: any;
  classification: PIIClassification;
  confidence: number;
  reason: string;
}

export interface ClassificationResult {
  documentType: string | null;
  fields: ClassifiedField[];
  piiFieldCount: number;
  publicFieldCount: number;
}

// Known UAE document type templates
const DOCUMENT_TEMPLATES: Record<
  string,
  {
    piiFields: string[];
    phiFields: string[];
    sensitiveFields: string[];
    publicFields: string[];
  }
> = {
  UAE_PASSPORT: {
    piiFields: [
      'full_name',
      'name',
      'passport_number',
      'passport_no',
      'date_of_birth',
      'dob',
      'nationality',
      'place_of_birth',
      'photo',
      'given_name',
      'surname',
      'sex',
      'gender',
    ],
    phiFields: [],
    sensitiveFields: [],
    publicFields: ['issue_date', 'expiry_date', 'document_type', 'type', 'country_code', 'mrz'],
  },
  UAE_EMIRATES_ID: {
    piiFields: [
      'full_name',
      'name',
      'emirates_id',
      'id_number',
      'date_of_birth',
      'dob',
      'nationality',
      'photo',
      'sponsor_id',
      'card_number',
    ],
    phiFields: [],
    sensitiveFields: [],
    publicFields: ['issue_date', 'expiry_date', 'document_type', 'card_expiry'],
  },
  UAE_TRADE_LICENSE: {
    piiFields: [
      'owner_name',
      'owner_emirates_id',
      'owner_passport',
      'contact_person',
      'phone',
      'mobile',
      'email',
      'address',
    ],
    phiFields: [],
    sensitiveFields: ['license_number', 'capital', 'share_capital'],
    publicFields: [
      'company_name',
      'trade_name',
      'issue_date',
      'expiry_date',
      'legal_form',
      'activities',
      'jurisdiction',
      'registration_number',
    ],
  },
  UAE_VISA: {
    piiFields: [
      'full_name',
      'passport_number',
      'nationality',
      'date_of_birth',
      'sponsor_name',
      'sponsor_id',
      'unified_number',
      'photo',
    ],
    phiFields: [],
    sensitiveFields: [],
    publicFields: ['visa_type', 'issue_date', 'expiry_date', 'entry_permit_number', 'profession'],
  },
  UAE_LABOUR_CONTRACT: {
    piiFields: [
      'employee_name',
      'employer_name',
      'emirates_id',
      'passport_number',
      'nationality',
      'address',
      'phone',
      'email',
    ],
    phiFields: [],
    sensitiveFields: ['salary', 'basic_salary', 'total_salary', 'allowances', 'bank_account'],
    publicFields: ['contract_date', 'start_date', 'end_date', 'job_title', 'contract_type'],
  },
};

// Field name patterns that indicate PII
const PII_KEY_PATTERNS = [
  { pattern: /^(full_?)?name$/i, classification: 'PII' as const, confidence: 0.95 },
  {
    pattern: /^(first|last|given|sur|family)_?name$/i,
    classification: 'PII' as const,
    confidence: 0.95,
  },
  { pattern: /email|e-mail|mail_address/i, classification: 'PII' as const, confidence: 0.95 },
  { pattern: /phone|mobile|tel|fax/i, classification: 'PII' as const, confidence: 0.9 },
  { pattern: /passport/i, classification: 'PII' as const, confidence: 0.95 },
  { pattern: /emirates_?id|eid/i, classification: 'PII' as const, confidence: 0.95 },
  { pattern: /visa_?(number|no)/i, classification: 'PII' as const, confidence: 0.9 },
  {
    pattern: /address|street|city|zip|postal|po_box/i,
    classification: 'PII' as const,
    confidence: 0.85,
  },
  { pattern: /dob|date_?of_?birth|birth_?date/i, classification: 'PII' as const, confidence: 0.95 },
  { pattern: /^age$/i, classification: 'PII' as const, confidence: 0.8 },
  { pattern: /nationality|citizenship/i, classification: 'PII' as const, confidence: 0.85 },
  { pattern: /gender|sex/i, classification: 'PII' as const, confidence: 0.85 },
  { pattern: /ssn|social_?security/i, classification: 'PII' as const, confidence: 0.99 },
  {
    pattern: /salary|income|wage|payment|compensation/i,
    classification: 'SENSITIVE' as const,
    confidence: 0.9,
  },
  { pattern: /bank|account|iban|swift/i, classification: 'SENSITIVE' as const, confidence: 0.95 },
  {
    pattern: /medical|health|diagnosis|prescription|treatment/i,
    classification: 'PHI' as const,
    confidence: 0.95,
  },
];

// Value patterns that indicate PII regardless of key name
const PII_VALUE_PATTERNS = [
  {
    pattern: /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i,
    classification: 'PII' as const,
    reason: 'email_format',
  },
  { pattern: /^\+?\d{10,15}$/, classification: 'PII' as const, reason: 'phone_format' },
  {
    pattern: /^784-\d{4}-\d{7}-\d{1}$/,
    classification: 'PII' as const,
    reason: 'emirates_id_format',
  },
  { pattern: /^\d{3}-\d{2}-\d{4}$/, classification: 'PII' as const, reason: 'ssn_format' },
  {
    pattern: /^[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}$/i,
    classification: 'SENSITIVE' as const,
    reason: 'iban_format',
  },
];

export class PIIClassificationService {
  /**
   * Detects document type from extracted text
   */
  detectDocumentType(extractedText: string): string | null {
    const text = extractedText.toUpperCase();

    // UAE Passport detection
    if (
      text.includes('PASSPORT') &&
      (text.includes('UNITED ARAB EMIRATES') || text.includes('UAE') || text.includes('EMIRATS'))
    ) {
      return 'UAE_PASSPORT';
    }

    // Emirates ID detection
    if (
      (text.includes('EMIRATES') && text.includes('IDENTITY')) ||
      (text.includes('ID CARD') && text.includes('UAE')) ||
      /784-\d{4}-\d{7}-\d{1}/.test(extractedText)
    ) {
      return 'UAE_EMIRATES_ID';
    }

    // Trade License detection
    if (
      ((text.includes('TRADE') || text.includes('COMMERCIAL')) && text.includes('LICENSE')) ||
      text.includes('DEPARTMENT OF ECONOMIC DEVELOPMENT') ||
      (text.includes('DED') && text.includes('LICENSE'))
    ) {
      return 'UAE_TRADE_LICENSE';
    }

    // Visa detection
    if (
      text.includes('VISA') &&
      (text.includes('ENTRY') || text.includes('RESIDENCE') || text.includes('PERMIT'))
    ) {
      return 'UAE_VISA';
    }

    // Labour Contract detection
    if (
      (text.includes('LABOUR') || text.includes('LABOR') || text.includes('EMPLOYMENT')) &&
      text.includes('CONTRACT')
    ) {
      return 'UAE_LABOUR_CONTRACT';
    }

    return null;
  }

  /**
   * Classifies all extracted fields
   */
  classifyFields(fields: Record<string, any>, documentType: string | null): ClassificationResult {
    const classifiedFields: ClassifiedField[] = [];
    let piiCount = 0;
    let publicCount = 0;

    for (const [key, value] of Object.entries(fields)) {
      const classified = this.classifyField(key, value, documentType);
      classifiedFields.push(classified);

      if (
        classified.classification === 'PII' ||
        classified.classification === 'PHI' ||
        classified.classification === 'SENSITIVE'
      ) {
        piiCount++;
      } else {
        publicCount++;
      }
    }

    logger.debug('Fields classified', {
      documentType,
      totalFields: classifiedFields.length,
      piiCount,
      publicCount,
    });

    return {
      documentType,
      fields: classifiedFields,
      piiFieldCount: piiCount,
      publicFieldCount: publicCount,
    };
  }

  /**
   * Classifies a single field
   */
  private classifyField(key: string, value: any, documentType: string | null): ClassifiedField {
    const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
    const stringValue = String(value);

    // 1. Check template-based classification first (highest confidence)
    if (documentType && DOCUMENT_TEMPLATES[documentType]) {
      const template = DOCUMENT_TEMPLATES[documentType];

      if (template.piiFields.includes(normalizedKey)) {
        return { key, value, classification: 'PII', confidence: 1.0, reason: 'template_pii' };
      }
      if (template.phiFields.includes(normalizedKey)) {
        return { key, value, classification: 'PHI', confidence: 1.0, reason: 'template_phi' };
      }
      if (template.sensitiveFields.includes(normalizedKey)) {
        return {
          key,
          value,
          classification: 'SENSITIVE',
          confidence: 1.0,
          reason: 'template_sensitive',
        };
      }
      if (template.publicFields.includes(normalizedKey)) {
        return { key, value, classification: 'PUBLIC', confidence: 1.0, reason: 'template_public' };
      }
    }

    // 2. Check key-based patterns
    for (const { pattern, classification, confidence } of PII_KEY_PATTERNS) {
      if (pattern.test(normalizedKey)) {
        return { key, value, classification, confidence, reason: 'key_pattern' };
      }
    }

    // 3. Check value-based patterns
    for (const { pattern, classification, reason } of PII_VALUE_PATTERNS) {
      if (pattern.test(stringValue)) {
        return { key, value, classification, confidence: 0.85, reason: `value_pattern:${reason}` };
      }
    }

    // 4. Heuristic: If uncertain and looks like personal data, mark as SENSITIVE
    if (this.looksLikePII(normalizedKey, stringValue)) {
      return { key, value, classification: 'SENSITIVE', confidence: 0.6, reason: 'heuristic' };
    }

    // 5. Default: PUBLIC
    return { key, value, classification: 'PUBLIC', confidence: 0.5, reason: 'default' };
  }

  /**
   * Heuristic check for PII-like data
   */
  private looksLikePII(key: string, value: string): boolean {
    // Contains Arabic text (often names)
    if (/[\u0600-\u06FF]/.test(value)) {
      return true;
    }

    // Looks like a formatted ID/number
    if (/^\d{6,}$/.test(value.replace(/[-\s]/g, ''))) {
      return true;
    }

    // Contains multiple capital words (might be a name)
    if (/^[A-Z][a-z]+ [A-Z][a-z]+/.test(value)) {
      return true;
    }

    return false;
  }

  /**
   * Gets list of fields that should have blind indexes for search
   */
  getBlindIndexFields(documentType: string | null): string[] {
    // Core searchable fields across all document types
    const coreFields = [
      'passport_number',
      'passport_no',
      'emirates_id',
      'id_number',
      'full_name',
      'name',
    ];

    // Document-specific searchable fields
    const typeSpecificFields: Record<string, string[]> = {
      UAE_PASSPORT: ['passport_number', 'full_name'],
      UAE_EMIRATES_ID: ['emirates_id', 'id_number', 'full_name'],
      UAE_TRADE_LICENSE: ['license_number', 'company_name', 'owner_name'],
      UAE_VISA: ['unified_number', 'entry_permit_number', 'full_name'],
      UAE_LABOUR_CONTRACT: ['employee_name', 'employer_name'],
    };

    if (documentType && typeSpecificFields[documentType]) {
      return [...new Set([...coreFields, ...typeSpecificFields[documentType]])];
    }

    return coreFields;
  }
}

export const piiClassificationService = new PIIClassificationService();
```

### Prisma Middleware for Transparent Encryption

```typescript
// src/middleware/encryption.middleware.ts

import { Prisma } from '@prisma/client';
import { encryptionService } from '../services/encryption/EncryptionService';
import { piiClassificationService } from '../services/pii/PIIClassificationService';
import { logger } from '../utils/logger';

/**
 * Prisma middleware for transparent encryption/decryption of PII fields
 */
export function encryptionMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    // Handle Document model
    if (params.model === 'Document') {
      // Encrypt on create/update
      if (params.action === 'create' || params.action === 'update' || params.action === 'upsert') {
        params.args.data = await encryptDocumentData(params.args.data);
      }

      // Decrypt on read
      if (
        params.action === 'findUnique' ||
        params.action === 'findFirst' ||
        params.action === 'findMany'
      ) {
        const result = await next(params);
        return decryptDocumentResult(result);
      }
    }

    // Handle ClientProfile model
    if (params.model === 'ClientProfile') {
      if (params.action === 'create' || params.action === 'update' || params.action === 'upsert') {
        params.args.data = await encryptClientProfileData(params.args.data);
      }

      if (
        params.action === 'findUnique' ||
        params.action === 'findFirst' ||
        params.action === 'findMany'
      ) {
        const result = await next(params);
        return decryptClientProfileResult(result);
      }
    }

    return next(params);
  };
}

async function encryptDocumentData(data: any): Promise<any> {
  if (!data.extractedData && !data.extractedDataEncrypted) {
    return data;
  }

  const companyId = data.companyId;
  if (!companyId) {
    logger.warn('Cannot encrypt document without companyId');
    return data;
  }

  // If extractedData is provided (new format), encrypt it
  if (data.extractedData && typeof data.extractedData === 'object') {
    const extractedData = data.extractedData;

    // Detect document type and classify fields
    const ocrText = extractedData.rawText || '';
    const documentType = piiClassificationService.detectDocumentType(ocrText);

    // Create blind indexes for searchable fields
    const blindIndexes = createBlindIndexes(extractedData, companyId, documentType);

    // Encrypt the entire extracted data
    const encrypted = encryptionService.encrypt(extractedData, companyId);

    // Return modified data
    return {
      ...data,
      documentType,
      extractedData: undefined, // Clear legacy field
      extractedDataEncrypted: encrypted.ciphertext,
      extractedDataNonce: encrypted.nonce,
      encryptionKeyVersion: encrypted.keyVersion,
      blindIndexes: {
        createMany: {
          data: blindIndexes,
        },
      },
    };
  }

  return data;
}

function createBlindIndexes(
  extractedData: any,
  companyId: string,
  documentType: string | null
): Array<{ fieldName: string; indexHash: string }> {
  const indexes: Array<{ fieldName: string; indexHash: string }> = [];
  const fields = extractedData.fields || {};
  const entities = extractedData.entities || {};

  const searchableFields = piiClassificationService.getBlindIndexFields(documentType);

  for (const fieldName of searchableFields) {
    const normalizedFieldName = fieldName.toLowerCase().replace(/\s+/g, '_');
    let value: string | null = null;

    // Check in fields
    for (const [key, val] of Object.entries(fields)) {
      if (key.toLowerCase().replace(/\s+/g, '_') === normalizedFieldName && val) {
        value = String(val);
        break;
      }
    }

    // Check in entities (for names)
    if (!value && normalizedFieldName.includes('name') && entities.names?.length > 0) {
      value = entities.names[0];
    }

    if (value) {
      indexes.push({
        fieldName: normalizedFieldName,
        indexHash: encryptionService.createBlindIndex(value, companyId),
      });
    }
  }

  logger.debug('Created blind indexes', {
    companyId,
    documentType,
    indexCount: indexes.length,
  });

  return indexes;
}

async function decryptDocumentResult(result: any): Promise<any> {
  if (!result) return result;

  // Handle array results
  if (Array.isArray(result)) {
    return Promise.all(result.map(decryptSingleDocument));
  }

  return decryptSingleDocument(result);
}

async function decryptSingleDocument(doc: any): Promise<any> {
  if (!doc) return doc;

  const companyId = doc.companyId;

  // Check for encrypted data
  if (doc.extractedDataEncrypted && doc.extractedDataNonce) {
    try {
      const decrypted = encryptionService.decrypt(
        {
          ciphertext: doc.extractedDataEncrypted,
          nonce: doc.extractedDataNonce,
          keyVersion: doc.encryptionKeyVersion || 1,
        },
        companyId
      );

      return {
        ...doc,
        extractedData: decrypted.data,
        _encrypted: true,
        _keyVersion: decrypted.keyVersion,
      };
    } catch (error) {
      logger.error('Failed to decrypt document', { documentId: doc.id, error });
      throw new Error('Failed to decrypt document data');
    }
  }

  // Handle legacy unencrypted data (migrate on read)
  if (doc.extractedData && !doc.extractedDataEncrypted) {
    logger.info('Legacy document detected, will be migrated on next save', { documentId: doc.id });
    return {
      ...doc,
      _encrypted: false,
      _needsMigration: true,
    };
  }

  return doc;
}

async function encryptClientProfileData(data: any): Promise<any> {
  if (!data.data) return data;

  const companyId = data.companyId;
  if (!companyId) {
    logger.warn('Cannot encrypt client profile without companyId');
    return data;
  }

  const profileData = data.data;

  // Create blind indexes for searchable fields
  const blindIndexes: Record<string, string | null> = {
    nameBlindIndex: null,
    passportBlindIndex: null,
    emiratesIdBlindIndex: null,
  };

  if (profileData.name) {
    blindIndexes.nameBlindIndex = encryptionService.createBlindIndex(profileData.name, companyId);
  }
  if (profileData.passportNumber) {
    blindIndexes.passportBlindIndex = encryptionService.createBlindIndex(
      profileData.passportNumber,
      companyId
    );
  }
  if (profileData.emiratesId) {
    blindIndexes.emiratesIdBlindIndex = encryptionService.createBlindIndex(
      profileData.emiratesId,
      companyId
    );
  }

  // Encrypt profile data
  const encrypted = encryptionService.encrypt(profileData, companyId);

  return {
    ...data,
    data: undefined, // Clear legacy field
    dataEncrypted: encrypted.ciphertext,
    dataNonce: encrypted.nonce,
    encryptionKeyVersion: encrypted.keyVersion,
    ...blindIndexes,
  };
}

async function decryptClientProfileResult(result: any): Promise<any> {
  if (!result) return result;

  if (Array.isArray(result)) {
    return Promise.all(result.map(decryptSingleClientProfile));
  }

  return decryptSingleClientProfile(result);
}

async function decryptSingleClientProfile(profile: any): Promise<any> {
  if (!profile) return profile;

  const companyId = profile.companyId;

  if (profile.dataEncrypted && profile.dataNonce) {
    try {
      const decrypted = encryptionService.decrypt(
        {
          ciphertext: profile.dataEncrypted,
          nonce: profile.dataNonce,
          keyVersion: profile.encryptionKeyVersion || 1,
        },
        companyId
      );

      return {
        ...profile,
        data: decrypted.data,
        _encrypted: true,
        _keyVersion: decrypted.keyVersion,
      };
    } catch (error) {
      logger.error('Failed to decrypt client profile', { profileId: profile.id, error });
      throw new Error('Failed to decrypt client profile data');
    }
  }

  // Handle legacy data
  if (profile.data && !profile.dataEncrypted) {
    return {
      ...profile,
      _encrypted: false,
      _needsMigration: true,
    };
  }

  return profile;
}
```

---

## Integration with Extraction Pipeline

### Updated DataExtractor

```typescript
// Additions to src/extractors/DataExtractor.ts

import {
  piiClassificationService,
  ClassificationResult,
} from '../services/pii/PIIClassificationService';

export interface ExtractedDataWithClassification extends ExtractedData {
  classification: ClassificationResult;
  rawText: string;
}

export class DataExtractor {
  // ... existing methods ...

  /**
   * Extracts and classifies data from a document
   */
  async extractWithClassification(
    document: ParsedDocument
  ): Promise<ExtractedDataWithClassification> {
    const extracted = await this.extract(document);

    // Detect document type from content
    const documentType = piiClassificationService.detectDocumentType(document.content);

    // Classify all fields
    const classification = piiClassificationService.classifyFields(extracted.fields, documentType);

    return {
      ...extracted,
      classification,
      rawText: document.content,
    };
  }
}
```

---

## Search Implementation

### Searching Encrypted Data

```typescript
// src/services/document/DocumentSearchService.ts

import { PrismaClient } from '@prisma/client';
import { encryptionService } from '../encryption/EncryptionService';
import { logger } from '../../utils/logger';

export interface SearchFilters {
  documentType?: string;
  passportNumber?: string;
  emiratesId?: string;
  clientName?: string;
  issueDateFrom?: Date;
  issueDateTo?: Date;
  expiryDateFrom?: Date;
  expiryDateTo?: Date;
}

export class DocumentSearchService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Search documents with support for encrypted field search via blind indexes
   */
  async search(companyId: string, filters: SearchFilters) {
    const where: any = { companyId };

    // Plaintext filters (direct database query)
    if (filters.documentType) {
      where.documentType = filters.documentType;
    }

    if (filters.issueDateFrom || filters.issueDateTo) {
      where.issueDate = {};
      if (filters.issueDateFrom) where.issueDate.gte = filters.issueDateFrom;
      if (filters.issueDateTo) where.issueDate.lte = filters.issueDateTo;
    }

    if (filters.expiryDateFrom || filters.expiryDateTo) {
      where.expiryDate = {};
      if (filters.expiryDateFrom) where.expiryDate.gte = filters.expiryDateFrom;
      if (filters.expiryDateTo) where.expiryDate.lte = filters.expiryDateTo;
    }

    // Encrypted field filters (via blind indexes)
    const blindIndexFilters: Array<{ fieldName: string; indexHash: string }> = [];

    if (filters.passportNumber) {
      blindIndexFilters.push({
        fieldName: 'passport_number',
        indexHash: encryptionService.createBlindIndex(filters.passportNumber, companyId),
      });
    }

    if (filters.emiratesId) {
      blindIndexFilters.push({
        fieldName: 'emirates_id',
        indexHash: encryptionService.createBlindIndex(filters.emiratesId, companyId),
      });
    }

    if (filters.clientName) {
      blindIndexFilters.push({
        fieldName: 'full_name',
        indexHash: encryptionService.createBlindIndex(filters.clientName, companyId),
      });
    }

    // Add blind index conditions
    if (blindIndexFilters.length > 0) {
      where.blindIndexes = {
        some: {
          OR: blindIndexFilters.map((f) => ({
            fieldName: f.fieldName,
            indexHash: f.indexHash,
          })),
        },
      };
    }

    logger.debug('Searching documents', {
      companyId,
      filters: Object.keys(filters),
      blindIndexCount: blindIndexFilters.length,
    });

    return this.prisma.document.findMany({
      where,
      include: {
        blindIndexes: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

---

## Migration Strategy

### Background Migration Job

```typescript
// src/jobs/EncryptionMigrationJob.ts

import { PrismaClient } from '@prisma/client';
import { encryptionService } from '../services/encryption/EncryptionService';
import { piiClassificationService } from '../services/pii/PIIClassificationService';
import { logger } from '../utils/logger';

export class EncryptionMigrationJob {
  constructor(private prisma: PrismaClient) {}

  /**
   * Migrates all unencrypted documents to encrypted format
   */
  async migrateAllDocuments(
    batchSize: number = 100
  ): Promise<{ migrated: number; failed: number }> {
    let migrated = 0;
    let failed = 0;
    let cursor: string | undefined;

    logger.info('Starting encryption migration job');

    while (true) {
      // Find unencrypted documents
      const documents = await this.prisma.document.findMany({
        where: {
          extractedData: { not: null },
          extractedDataEncrypted: null,
        },
        take: batchSize,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: 'asc' },
      });

      if (documents.length === 0) {
        break;
      }

      for (const doc of documents) {
        try {
          await this.migrateDocument(doc);
          migrated++;
        } catch (error) {
          logger.error('Failed to migrate document', { documentId: doc.id, error });
          failed++;
        }
      }

      cursor = documents[documents.length - 1].id;

      logger.info('Migration batch complete', {
        migrated,
        failed,
        lastDocumentId: cursor,
      });
    }

    logger.info('Encryption migration complete', { migrated, failed });
    return { migrated, failed };
  }

  /**
   * Migrates a single document
   */
  private async migrateDocument(doc: any): Promise<void> {
    const extractedData = doc.extractedData;
    const companyId = doc.companyId;

    // Detect document type
    const rawText = extractedData.rawText || '';
    const documentType = piiClassificationService.detectDocumentType(rawText);

    // Create blind indexes
    const blindIndexData = this.createBlindIndexes(extractedData, companyId, documentType);

    // Encrypt
    const encrypted = encryptionService.encrypt(extractedData, companyId);

    // Update document
    await this.prisma.$transaction([
      // Update document
      this.prisma.document.update({
        where: { id: doc.id },
        data: {
          documentType,
          extractedData: null, // Clear legacy field
          extractedDataEncrypted: encrypted.ciphertext,
          extractedDataNonce: encrypted.nonce,
          encryptionKeyVersion: encrypted.keyVersion,
        },
      }),
      // Create blind indexes
      this.prisma.blindIndex.createMany({
        data: blindIndexData.map((bi) => ({
          documentId: doc.id,
          ...bi,
        })),
        skipDuplicates: true,
      }),
    ]);

    logger.debug('Document migrated', { documentId: doc.id, documentType });
  }

  private createBlindIndexes(
    extractedData: any,
    companyId: string,
    documentType: string | null
  ): Array<{ fieldName: string; indexHash: string }> {
    const indexes: Array<{ fieldName: string; indexHash: string }> = [];
    const fields = extractedData.fields || {};
    const entities = extractedData.entities || {};

    const searchableFields = piiClassificationService.getBlindIndexFields(documentType);

    for (const fieldName of searchableFields) {
      const normalizedFieldName = fieldName.toLowerCase().replace(/\s+/g, '_');
      let value: string | null = null;

      for (const [key, val] of Object.entries(fields)) {
        if (key.toLowerCase().replace(/\s+/g, '_') === normalizedFieldName && val) {
          value = String(val);
          break;
        }
      }

      if (!value && normalizedFieldName.includes('name') && entities.names?.length > 0) {
        value = entities.names[0];
      }

      if (value) {
        indexes.push({
          fieldName: normalizedFieldName,
          indexHash: encryptionService.createBlindIndex(value, companyId),
        });
      }
    }

    return indexes;
  }
}
```

---

## Logging Integration

### PII-Safe Logging

```typescript
// src/utils/piiSafeLogger.ts

import { logger } from './logger';

// Fields that should never be logged (even redacted)
const NEVER_LOG_FIELDS = new Set([
  'password',
  'secret',
  'token',
  'key',
  'apiKey',
  'authorization',
  'creditCard',
  'cvv',
  'ssn',
]);

// Fields that should be redacted
const PII_FIELDS = new Set([
  'email',
  'phone',
  'name',
  'firstName',
  'lastName',
  'fullName',
  'passportNumber',
  'emiratesId',
  'address',
  'dateOfBirth',
  'dob',
  'salary',
  'bankAccount',
  'iban',
]);

/**
 * Sanitizes an object for logging by redacting PII
 */
export function sanitizeForLogging(obj: any, depth: number = 0): any {
  if (depth > 10) return '[MAX_DEPTH]';
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Check for known PII patterns
    if (isEmailLike(obj)) return '[REDACTED_EMAIL]';
    if (isPhoneLike(obj)) return '[REDACTED_PHONE]';
    if (isEmiratesIdLike(obj)) return '[REDACTED_EMIRATES_ID]';
    return obj;
  }

  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLogging(item, depth + 1));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();

    // Never log certain fields
    if (NEVER_LOG_FIELDS.has(keyLower)) {
      continue;
    }

    // Redact known PII fields
    if (PII_FIELDS.has(keyLower) || isPIIFieldName(keyLower)) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Handle nested objects/arrays
    if (typeof value === 'object' && value !== null) {
      // Don't log encrypted data
      if (keyLower.includes('encrypted') || keyLower.includes('ciphertext')) {
        sanitized[key] = '[ENCRYPTED_DATA]';
        continue;
      }
      sanitized[key] = sanitizeForLogging(value, depth + 1);
    } else {
      sanitized[key] = sanitizeForLogging(value, depth + 1);
    }
  }

  return sanitized;
}

function isEmailLike(str: string): boolean {
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(str);
}

function isPhoneLike(str: string): boolean {
  return /^\+?\d{10,15}$/.test(str.replace(/[-\s]/g, ''));
}

function isEmiratesIdLike(str: string): boolean {
  return /^784-\d{4}-\d{7}-\d{1}$/.test(str);
}

function isPIIFieldName(key: string): boolean {
  const piiPatterns = [
    /name/i,
    /email/i,
    /phone/i,
    /passport/i,
    /emirates/i,
    /address/i,
    /birth/i,
    /salary/i,
    /bank/i,
    /account/i,
  ];
  return piiPatterns.some((pattern) => pattern.test(key));
}

/**
 * Creates a PII-safe logger that automatically sanitizes data
 */
export const piiSafeLogger = {
  info: (message: string, data?: any) => {
    logger.info(message, data ? sanitizeForLogging(data) : undefined);
  },

  warn: (message: string, data?: any) => {
    logger.warn(message, data ? sanitizeForLogging(data) : undefined);
  },

  error: (message: string, data?: any) => {
    logger.error(message, data ? sanitizeForLogging(data) : undefined);
  },

  debug: (message: string, data?: any) => {
    logger.debug(message, data ? sanitizeForLogging(data) : undefined);
  },
};
```

---

## Environment Configuration

### Required Environment Variables

```env
# Encryption Configuration
ENCRYPTION_MASTER_KEY=<base64-encoded-32-byte-key>  # Generate: openssl rand -base64 32

# Key Rotation (optional)
ENCRYPTION_CURRENT_KEY_VERSION=1
ENCRYPTION_PREVIOUS_KEY_VERSIONS=  # Comma-separated for rotation support

# Migration Settings
ENCRYPTION_MIGRATION_ENABLED=true
ENCRYPTION_MIGRATION_BATCH_SIZE=100
```

### Key Generation Script

```bash
#!/bin/bash
# scripts/generate-encryption-key.sh

echo "Generating new encryption master key..."
NEW_KEY=$(openssl rand -base64 32)
echo ""
echo "Add this to your .env file:"
echo "ENCRYPTION_MASTER_KEY=$NEW_KEY"
echo ""
echo "IMPORTANT: Store this key securely. Loss of this key means loss of all encrypted data."
```

---

## Compliance Mapping

| Requirement                        | Implementation                                  |
| ---------------------------------- | ----------------------------------------------- |
| **PHIPA: Data at rest encryption** | AES-256-GCM for all extracted PII               |
| **PHIPA: Access controls**         | Tenant isolation via derived keys               |
| **PIPEDA: Consent**                | Only extract from user-uploaded documents       |
| **PIPEDA: Retention limits**       | Supports data deletion with key destruction     |
| **SOC 2: Encryption**              | AES-256-GCM with authenticated encryption       |
| **SOC 2: Key management**          | HKDF-derived tenant keys, version-controlled    |
| **SOC 2: Audit trail**             | Encryption/decryption logged (without PII)      |
| **Vanta: Data classification**     | PIIClassificationService with confidence scores |
| **Vanta: Automated detection**     | Pattern-based + template-based classification   |

---

## Performance Characteristics

| Operation            | Expected Latency  | Notes                              |
| -------------------- | ----------------- | ---------------------------------- |
| Encryption           | 5-15ms            | Per document, depends on data size |
| Decryption           | 5-15ms            | Per document                       |
| Blind index creation | 1-2ms             | Per field                          |
| Blind index lookup   | Standard DB query | Uses indexed HMAC hash             |
| Classification       | 2-5ms             | Per document                       |

---

## Implementation Priority

### Week 1: Core Encryption

1. Generate master key and configure environment
2. Implement EncryptionService
3. Add encrypted fields to Prisma schema
4. Run migration to add new fields

### Week 2: Middleware Integration

1. Implement Prisma middleware
2. Update DataExtractor integration
3. Add blind index creation
4. Test encryption/decryption flow

### Week 3: Classification Engine

1. Implement PIIClassificationService
2. Add document templates
3. Integrate classification into extraction
4. Test classification accuracy

### Week 4: Migration & Search

1. Implement DocumentSearchService
2. Build migration job
3. Run migration in staging
4. Verify search functionality

---

## Related Documents

- [Architecture Options Analysis](./dynamic-pii-architecture-options.md)
- [Instrumentation Strategy](../monitoring/instrumentation-strategy.md)
- [Security Model](../../explanation/security-model.md)

---

**Document Version**: 1.0
**Author**: Observability & Security Audit Team
**Approved By**: Pending

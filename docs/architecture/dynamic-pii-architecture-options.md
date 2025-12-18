# Dynamic PII Architecture: Options Analysis

**Last Updated**: 2025-12-17
**Status**: Architecture Decision Required
**Priority**: CRITICAL - Core Product Architecture

---

## Problem Statement

IntelliFill extracts arbitrary fields from documents (passports, Emirates IDs, trade licenses, etc.) via OCR. The system **cannot know in advance** what PII fields will be extracted - fields are discovered at runtime using pattern matching.

### Current Data Flow

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  Document     │────>│   OCR/Parse   │────>│  DataExtractor│
│  (PDF/Image)  │     │  (Tesseract)  │     │               │
└───────────────┘     └───────────────┘     └───────┬───────┘
                                                     │
                           ┌─────────────────────────┘
                           ▼
                    ┌──────────────────────────────────┐
                    │        ExtractedData              │
                    │  ┌────────────────────────────┐  │
                    │  │ fields: {                   │  │
                    │  │   full_name: "Ahmed Al.."  │  │  ← Unknown keys
                    │  │   passport_number: "..."   │  │  ← at design time
                    │  │   emiratesId: "784-..."    │  │
                    │  │   salary: "15000 AED"      │  │
                    │  │   [any other key]: value   │  │
                    │  │ }                          │  │
                    │  │                            │  │
                    │  │ entities: {                │  │
                    │  │   names: ["Ahmed.."]       │  │  ← All PII
                    │  │   emails: ["a@b.com"]      │  │
                    │  │   phones: ["+971..."]      │  │
                    │  │   dates: ["15/03/1990"]    │  │
                    │  │   addresses: ["..."]       │  │
                    │  │ }                          │  │
                    │  └────────────────────────────┘  │
                    └──────────────────────────────────┘
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
           ┌─────────────────┐              ┌─────────────────┐
           │ Document Table  │              │ ClientProfile   │
           │ extractedData   │              │ data (JSON)     │
           │ (JSON - plain!) │              │ (JSON - plain!) │
           └─────────────────┘              └─────────────────┘
```

### Why This Matters

1. **Compliance**: PHIPA/PIPEDA require encryption of PII at rest
2. **Breach Risk**: Database access = complete PII exposure
3. **Logging Risk**: Can't log anything from extracted data
4. **Export Risk**: CSV/JSON exports contain unmasked PII

---

## Architecture Options

### Option 1: Encrypt Everything by Default

**Approach**: Treat ALL extracted data as PII, encrypt entire JSON blobs

```typescript
// Current
Document.extractedData = { fields: {...}, entities: {...} }

// Proposed
Document.extractedData = AES256_GCM_encrypt({
  fields: {...},
  entities: {...}
})
```

**Pros:**
- ✅ Simple to implement
- ✅ Maximum security - all data encrypted
- ✅ Compliant by default

**Cons:**
- ❌ Cannot search/filter on encrypted data
- ❌ Must decrypt to display anything
- ❌ Performance cost on every read
- ❌ No analytics on extracted data

**Searchability Solution**: Blind indexes or encrypted search (Prisma Encrypt, CipherStash)

---

### Option 2: Field-Level Classification + Selective Encryption

**Approach**: Classify each extracted field as PII/non-PII, encrypt only PII

```typescript
interface ClassifiedField {
  key: string;
  value: string;
  classification: 'PII' | 'PHI' | 'SENSITIVE' | 'PUBLIC';
  encryptedValue?: string;  // Only for PII/PHI/SENSITIVE
  searchableHash?: string;  // For searching without decryption
}

// Extraction output
{
  fields: [
    { key: "document_type", value: "passport", classification: "PUBLIC" },
    { key: "full_name", value: "[encrypted]", classification: "PII", encryptedValue: "aes256..." },
    { key: "passport_number", value: "[encrypted]", classification: "PII", encryptedValue: "aes256..." },
    { key: "issue_date", value: "2020-01-15", classification: "PUBLIC" },
  ],
  entities: {
    // All entities are encrypted by default (known PII types)
  }
}
```

**Classification Engine:**
```typescript
class PIIClassifier {
  // Known PII field patterns
  private PII_PATTERNS = [
    { pattern: /name|fullname|firstname|lastname/i, class: 'PII' },
    { pattern: /email|mail/i, class: 'PII' },
    { pattern: /phone|mobile|tel/i, class: 'PII' },
    { pattern: /passport|emiratesid|visa|license/i, class: 'PII' },
    { pattern: /address|street|city|zip|postal/i, class: 'PII' },
    { pattern: /dob|birth|age/i, class: 'PII' },
    { pattern: /salary|income|payment/i, class: 'SENSITIVE' },
    { pattern: /diagnosis|medical|health|prescription/i, class: 'PHI' },
  ];

  // Value-based detection (for unknown keys)
  private VALUE_DETECTORS = [
    { pattern: /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i, class: 'PII' }, // Email
    { pattern: /^\+?\d{10,15}$/, class: 'PII' }, // Phone
    { pattern: /^784-\d{4}-\d{7}-\d{1}$/, class: 'PII' }, // Emirates ID
    { pattern: /^\d{3}-\d{2}-\d{4}$/, class: 'PII' }, // SSN
  ];

  classify(key: string, value: string): Classification {
    // 1. Check key against known patterns
    for (const { pattern, class: cls } of this.PII_PATTERNS) {
      if (pattern.test(key)) return cls;
    }

    // 2. Check value format against known PII patterns
    for (const { pattern, class: cls } of this.VALUE_DETECTORS) {
      if (pattern.test(value)) return cls;
    }

    // 3. Conservative default - if uncertain, mark as SENSITIVE
    if (this.looksLikePII(key, value)) return 'SENSITIVE';

    return 'PUBLIC';
  }

  private looksLikePII(key: string, value: string): boolean {
    // Heuristics:
    // - Contains numbers in specific formats
    // - Contains Arabic text (often names)
    // - Matches common PII value lengths
    // - Contains capital letters (names)
    return false; // Implementation
  }
}
```

**Pros:**
- ✅ Public fields remain searchable
- ✅ Flexible classification rules
- ✅ Can evolve classification over time
- ✅ Analytics on non-PII fields

**Cons:**
- ❌ Classification errors possible (miss PII)
- ❌ More complex implementation
- ❌ Classification rules need maintenance
- ❌ Performance overhead for classification

---

### Option 3: Document-Type Templates + Dynamic Overrides

**Approach**: Pre-define field classifications for known document types, use heuristics for unknown

```typescript
// Known document type templates
const DOCUMENT_TEMPLATES = {
  'UAE_PASSPORT': {
    piiFields: ['full_name', 'passport_number', 'date_of_birth', 'nationality', 'place_of_birth'],
    phiFields: [],
    sensitiveFields: ['photo'],
    publicFields: ['issue_date', 'expiry_date', 'document_type'],
  },
  'UAE_EMIRATES_ID': {
    piiFields: ['full_name', 'emirates_id', 'date_of_birth', 'nationality', 'photo'],
    phiFields: [],
    sensitiveFields: ['sponsor_id'],
    publicFields: ['issue_date', 'expiry_date', 'card_number'],
  },
  'UAE_TRADE_LICENSE': {
    piiFields: ['owner_name', 'owner_emirates_id', 'owner_passport'],
    sensitiveFields: ['license_number', 'capital', 'activities'],
    publicFields: ['company_name', 'issue_date', 'expiry_date', 'legal_form'],
  },
  // ... more templates
};

// Document type detection
class DocumentTypeDetector {
  async detect(extractedText: string): Promise<string | null> {
    // Use pattern matching or ML model to detect document type
    if (extractedText.includes('PASSPORT') && extractedText.includes('UNITED ARAB EMIRATES')) {
      return 'UAE_PASSPORT';
    }
    // ... more detection logic
    return null; // Unknown document type
  }
}

// Classification flow
async function classifyExtractedData(
  extractedData: ExtractedData,
  documentType: string | null
): Promise<ClassifiedExtractedData> {
  if (documentType && DOCUMENT_TEMPLATES[documentType]) {
    // Use template-based classification
    return classifyWithTemplate(extractedData, DOCUMENT_TEMPLATES[documentType]);
  } else {
    // Fall back to heuristic classification
    return classifyWithHeuristics(extractedData);
  }
}
```

**Pros:**
- ✅ High accuracy for known document types
- ✅ Explicit control over classification
- ✅ Easy to audit and explain
- ✅ Can add new templates as needed

**Cons:**
- ❌ Requires manual template maintenance
- ❌ Unknown documents still need heuristics
- ❌ Document type detection can fail
- ❌ Templates need updates for new document versions

---

### Option 4: AI-Powered Classification

**Approach**: Use LLM to classify extracted fields as PII

```typescript
class AIClassifier {
  private model: GoogleGenerativeAI;

  async classifyFields(
    fields: Record<string, string>,
    documentContext?: string
  ): Promise<Record<string, Classification>> {
    const prompt = `
      You are a PII classifier. For each field below, classify as:
      - PII: Personal Identifiable Information (names, IDs, contact info)
      - PHI: Protected Health Information (medical data)
      - SENSITIVE: Business-sensitive but not PII (financials, contracts)
      - PUBLIC: Non-sensitive information

      Document context: ${documentContext || 'Unknown'}

      Fields to classify:
      ${JSON.stringify(fields, null, 2)}

      Respond with JSON: { "field_name": "classification", ... }
    `;

    const response = await this.model.generateContent(prompt);
    return JSON.parse(response.text());
  }
}
```

**Pros:**
- ✅ Highly accurate for ambiguous cases
- ✅ Understands context (e.g., "John" in a form vs. product name)
- ✅ No manual template maintenance
- ✅ Can explain classification decisions

**Cons:**
- ❌ Latency (200-500ms per document)
- ❌ Cost per API call
- ❌ Data sent to external service (privacy concern!)
- ❌ Non-deterministic (same input may get different output)
- ❌ Cannot use for actual PII content (chicken-egg problem)

**Hybrid Approach**: Use AI to generate/validate templates, not for runtime classification

---

### Option 5: Zero-Knowledge Extraction (Privacy-Preserving)

**Approach**: Never store raw PII - only encrypted or derived values

```typescript
interface ZeroKnowledgeField {
  fieldId: string;          // "passport_number"
  encryptedValue: string;   // AES-256-GCM encrypted
  blindIndex: string;       // HMAC hash for searching
  dataType: 'text' | 'date' | 'number';
  metadata: {
    source: 'ocr' | 'manual';
    confidence: number;
    extractedAt: Date;
  };
}

// Storage
{
  "fields": [
    {
      "fieldId": "passport_number",
      "encryptedValue": "aes256:iv:ciphertext:tag",
      "blindIndex": "hmac:abc123...",  // Can search without decrypting
      "dataType": "text",
      "metadata": {
        "source": "ocr",
        "confidence": 0.95,
        "extractedAt": "2025-12-17T..."
      }
    }
  ]
}

// Searching
async function findDocumentsByPassport(passportNumber: string): Promise<Document[]> {
  const searchIndex = hmac(passportNumber, process.env.BLIND_INDEX_KEY);
  return db.document.findMany({
    where: {
      fields: {
        some: {
          fieldId: 'passport_number',
          blindIndex: searchIndex
        }
      }
    }
  });
}
```

**Pros:**
- ✅ Maximum privacy - no plaintext PII in database
- ✅ Still searchable via blind indexes
- ✅ Compliant with strictest regulations
- ✅ Decryption only when explicitly needed

**Cons:**
- ❌ Complex implementation
- ❌ Cannot do partial/fuzzy search
- ❌ Key management is critical
- ❌ Performance overhead
- ❌ Harder to debug/support

---

## Recommendation Matrix

| Criteria | Opt 1 (Encrypt All) | Opt 2 (Classify) | Opt 3 (Templates) | Opt 4 (AI) | Opt 5 (Zero-K) |
|----------|---------------------|------------------|-------------------|------------|----------------|
| **Security** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Searchability** | ⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Complexity** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| **Performance** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Maintainability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **Compliance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Time to Implement** | 1-2 weeks | 3-4 weeks | 4-6 weeks | 2-3 weeks | 6-8 weeks |

---

## Recommended Approach: Hybrid (Option 1 + 3)

### Phase 1: Encrypt All (Immediate Security)
1. Encrypt entire `extractedData` JSON blob with AES-256-GCM
2. Encrypt entire `ClientProfile.data` JSON blob
3. This provides immediate compliance

### Phase 2: Add Document Templates (Searchability)
1. Define templates for known UAE document types
2. Store non-PII fields in plaintext for search/filter
3. Keep PII fields encrypted with blind indexes

### Phase 3: Refine with Classification Engine (Quality)
1. Build classification engine for unknown documents
2. Use templates + heuristics (not AI for runtime)
3. Log classification decisions for audit

### Data Model Evolution

```typescript
// Phase 1: Encrypt All
model Document {
  id              String    @id
  extractedDataEncrypted  Bytes    // AES-256-GCM encrypted JSON
  extractedDataIV         Bytes    // Initialization vector
  // ...
}

// Phase 2: Hybrid with Searchable Non-PII
model Document {
  id              String    @id

  // Searchable non-PII metadata (plaintext)
  documentType    String?   // "UAE_PASSPORT", "TRADE_LICENSE"
  issueDate       DateTime?
  expiryDate      DateTime?
  status          String?

  // Encrypted PII (JSON blob)
  piiDataEncrypted  Bytes
  piiDataIV         Bytes

  // Blind indexes for encrypted field search
  blindIndexes    BlindIndex[]
}

model BlindIndex {
  id            String   @id
  documentId    String
  fieldName     String   // "passport_number"
  indexHash     String   // HMAC of value
  @@unique([documentId, fieldName])
  @@index([indexHash])
}
```

---

## Implementation Priority

### Week 1-2: Immediate Security
1. Add `encryptJSON/decryptJSON` functions for large JSON blobs
2. Add Prisma middleware to encrypt `Document.extractedData`
3. Add Prisma middleware to encrypt `ClientProfile.data`
4. Update read paths to decrypt on access

### Week 3-4: Key Management
1. Implement key derivation (per-tenant keys)
2. Add key rotation support
3. Document key backup/recovery process

### Week 5-6: Blind Indexes
1. Design blind index schema
2. Implement HMAC-based indexing
3. Add search capability for encrypted fields

### Week 7-8: Document Templates
1. Define templates for top 5 UAE document types
2. Implement document type detection
3. Add template-based field classification

---

## Open Questions for Decision

1. **Key Management**: Where should encryption keys be stored?
   - Option A: Environment variable (simple, less secure)
   - Option B: AWS KMS / HashiCorp Vault (secure, more complex)
   - Option C: Per-tenant keys derived from master key (balanced)

2. **Search Requirements**: What fields need to be searchable?
   - Client name? Document number? Issue date?
   - This affects which fields can be encrypted

3. **Performance Budget**: How much latency is acceptable?
   - Encryption adds ~10-50ms per document
   - Decryption on read adds ~10-50ms

4. **Backward Compatibility**: How to migrate existing data?
   - One-time migration script?
   - Lazy migration on read?
   - Keep unencrypted data with deprecation warning?

---

## Next Steps

1. **Decision**: Choose primary approach (recommend Option 1+3 hybrid)
2. **Prototype**: Build encryption middleware for one model
3. **Test**: Verify performance and compatibility
4. **Migrate**: Plan existing data migration
5. **Document**: Update architecture docs

---

**Document Version**: 1.0
**Author**: Observability Audit Team
**Review Required By**: Engineering Lead, Security Lead

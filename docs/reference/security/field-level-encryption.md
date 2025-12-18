# Field-Level Encryption Strategy

**Last Updated**: 2025-12-17
**Status**: Reference Implementation
**Related**: [Dynamic PII Architecture](../../architecture/dynamic-pii-architecture.md)

---

## Overview

This document provides the technical reference for IntelliFill's field-level encryption system, which protects dynamically-extracted PII from documents.

---

## Encryption Scheme

### Algorithm Selection

| Component | Algorithm | Key Size | Notes |
|-----------|-----------|----------|-------|
| Symmetric Encryption | AES-256-GCM | 256-bit | Authenticated encryption |
| Key Derivation | HKDF-SHA256 | 256-bit output | Tenant key derivation |
| Blind Index | HMAC-SHA256 | 256-bit output | Searchable encryption |
| Nonce/IV | Random | 96-bit (12 bytes) | Unique per encryption |

### Why AES-256-GCM?

1. **Authenticated Encryption**: GCM provides both confidentiality and integrity
2. **Performance**: Hardware acceleration (AES-NI) on modern CPUs
3. **Compliance**: FIPS 140-2 approved, meets PHIPA/PIPEDA requirements
4. **Standard**: Industry-standard for data-at-rest encryption

### Ciphertext Format

```
┌──────────────────────────────────────────────────────────────────┐
│                        Encrypted Payload                          │
├──────────────────┬──────────────────────────┬────────────────────┤
│  Nonce (12 bytes)│     Ciphertext (n bytes) │ Auth Tag (16 bytes)│
└──────────────────┴──────────────────────────┴────────────────────┘
```

**Storage in Database**:
- `extractedDataEncrypted`: Ciphertext + Auth Tag (combined)
- `extractedDataNonce`: 12-byte nonce stored separately
- `encryptionKeyVersion`: Integer tracking key version

---

## Key Management

### Key Hierarchy

```
                    ┌───────────────────────┐
                    │   Master Key          │
                    │   (Environment Var)   │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │   HKDF Derivation     │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│  Tenant A Key │       │  Tenant B Key │       │  Tenant C Key │
│  (Derived)    │       │  (Derived)    │       │  (Derived)    │
└───────────────┘       └───────────────┘       └───────────────┘
```

### Key Derivation Function

```typescript
// Tenant key derivation using HKDF
function deriveTenantKey(masterKey: Buffer, companyId: string, version: number): Buffer {
  const salt = Buffer.from(`tenant:${companyId}:v${version}`, 'utf8');
  const info = Buffer.from('intellifill-pii-encryption', 'utf8');

  return crypto.hkdfSync(
    'sha256',
    masterKey,
    salt,
    info,
    32 // 256-bit key
  );
}
```

### Key Properties

| Property | Value | Rationale |
|----------|-------|-----------|
| **Master Key Storage** | Environment variable | Phase 1 simplicity |
| **Master Key Format** | Base64-encoded 32 bytes | Easy handling |
| **Tenant Isolation** | Derived keys per company | One breach doesn't expose all |
| **Key Versioning** | Integer version in DB | Supports rotation |
| **Rotation Period** | Annual (recommended) | Balance security/operations |

### Master Key Generation

```bash
# Generate a new master key
openssl rand -base64 32

# Example output (DO NOT USE):
# Uw5L8qJ7YbNmK3pR9xZvA2cF6hT0gMwE4jS1nB8kD5I=
```

### Future Key Management (Phase 2)

For production at scale, migrate to:
- **AWS KMS**: Managed key storage with automatic rotation
- **HashiCorp Vault**: Self-hosted secrets management
- **Azure Key Vault**: For Azure deployments

---

## Blind Index Implementation

### Purpose

Blind indexes enable searching encrypted data without decryption. An HMAC of the plaintext value is stored alongside encrypted data.

### How It Works

```
                    ┌────────────────┐
                    │  Plaintext     │
                    │  "John Smith"  │
                    └───────┬────────┘
                            │
                    ┌───────┴────────┐
                    │  Normalize     │
                    │  "john smith"  │
                    └───────┬────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
      ┌───────────────┐           ┌───────────────┐
      │  HMAC-SHA256  │           │  AES-256-GCM  │
      │  (Index Key)  │           │  (Encrypt Key)│
      └───────┬───────┘           └───────┬───────┘
              │                           │
              ▼                           ▼
      ┌───────────────┐           ┌───────────────┐
      │  Blind Index  │           │  Ciphertext   │
      │  (searchable) │           │  (encrypted)  │
      └───────────────┘           └───────────────┘
```

### Index Key Derivation

The blind index key is **separate** from the encryption key:

```typescript
function deriveBlindIndexKey(masterKey: Buffer, companyId: string): Buffer {
  const salt = Buffer.from(`blind-index:${companyId}`, 'utf8');
  const info = Buffer.from('intellifill-blind-index', 'utf8');

  return crypto.hkdfSync('sha256', masterKey, salt, info, 32);
}
```

### Normalization Rules

Before creating a blind index, values are normalized:

```typescript
function normalizeForIndex(value: string): string {
  return value
    .toLowerCase()           // Case insensitive
    .trim()                  // Remove whitespace
    .replace(/\s+/g, ' ')    // Normalize internal spaces
    .normalize('NFC');       // Unicode normalization
}
```

### Searchable Fields

| Field | Document Types | Index Purpose |
|-------|---------------|---------------|
| `passport_number` | Passport | Document lookup |
| `emirates_id` | Emirates ID, Visa | Person lookup |
| `full_name` | All | Person search |
| `license_number` | Trade License | Business lookup |
| `company_name` | Trade License | Business search |

### Search Query Pattern

```typescript
async function findByPassport(passportNumber: string, companyId: string) {
  const indexHash = createBlindIndex(passportNumber, companyId);

  return prisma.document.findMany({
    where: {
      companyId,
      blindIndexes: {
        some: {
          fieldName: 'passport_number',
          indexHash: indexHash
        }
      }
    }
  });
}
```

### Limitations

1. **Exact match only**: Cannot do partial/fuzzy search
2. **No range queries**: Cannot search "names starting with A"
3. **Case normalization**: "John" and "JOHN" produce same index
4. **One-way**: Cannot reverse index to get value

---

## Encryption Flow

### Write Path (Document Creation)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Document Upload/OCR                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DataExtractor                                │
│  1. Parse document                                               │
│  2. Extract fields (key-value pairs)                            │
│  3. Extract entities (names, emails, phones)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                PIIClassificationService                          │
│  1. Detect document type (UAE_PASSPORT, etc.)                   │
│  2. Classify each field (PII/PHI/SENSITIVE/PUBLIC)             │
│  3. Determine searchable fields for blind indexes               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Prisma Middleware                              │
│  1. Create blind indexes for searchable fields                  │
│  2. Encrypt entire extractedData JSON blob                      │
│  3. Store encrypted data + nonce + key version                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL                                  │
│  Document {                                                      │
│    extractedDataEncrypted: <ciphertext>,                        │
│    extractedDataNonce: <nonce>,                                 │
│    encryptionKeyVersion: 1,                                     │
│    blindIndexes: [{ fieldName, indexHash }, ...]               │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Read Path (Document Retrieval)

```
┌─────────────────────────────────────────────────────────────────┐
│                     API Request                                  │
│  GET /api/documents/:id                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL                                  │
│  SELECT * FROM Document WHERE id = ?                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Prisma Middleware                              │
│  1. Check if data is encrypted (extractedDataEncrypted exists)  │
│  2. Derive tenant key from companyId                            │
│  3. Decrypt using AES-256-GCM                                   │
│  4. Return decrypted extractedData                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Response                                 │
│  { id, fileName, extractedData: {...} }                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Error Handling

### Decryption Failures

```typescript
try {
  const decrypted = encryptionService.decrypt(payload, companyId);
  return decrypted;
} catch (error) {
  if (error.message.includes('Unsupported state')) {
    // Authentication tag verification failed
    logger.error('Decryption authentication failed', {
      documentId,
      keyVersion: payload.keyVersion,
      error: 'DATA_TAMPERING_DETECTED'
    });
    throw new SecurityError('Document data integrity check failed');
  }

  if (error.message.includes('Invalid key length')) {
    // Key derivation issue
    logger.error('Invalid encryption key', {
      documentId,
      companyId,
      error: 'KEY_DERIVATION_FAILED'
    });
    throw new ConfigurationError('Encryption configuration error');
  }

  throw error;
}
```

### Missing Encryption Key

```typescript
function ensureEncryptionKey(): void {
  if (!process.env.ENCRYPTION_MASTER_KEY) {
    throw new ConfigurationError(
      'ENCRYPTION_MASTER_KEY environment variable not configured. ' +
      'Generate with: openssl rand -base64 32'
    );
  }

  const key = Buffer.from(process.env.ENCRYPTION_MASTER_KEY, 'base64');
  if (key.length !== 32) {
    throw new ConfigurationError(
      'ENCRYPTION_MASTER_KEY must be 32 bytes (256 bits) base64-encoded'
    );
  }
}
```

---

## Key Rotation

### Rotation Process

1. **Generate new key version** in configuration
2. **Update active version** in environment
3. **New writes** use new key version
4. **Reads** support multiple versions (check `encryptionKeyVersion`)
5. **Background job** re-encrypts old documents with new key
6. **Retire old version** after migration complete

### Configuration

```env
# Current active key version
ENCRYPTION_CURRENT_KEY_VERSION=2

# Previous versions for decryption (comma-separated)
ENCRYPTION_PREVIOUS_KEY_VERSIONS=1
```

### Version-Aware Decryption

```typescript
function decrypt(payload: EncryptedPayload, companyId: string): any {
  const { keyVersion } = payload;

  // Derive key for the version used during encryption
  const key = deriveTenantKey(companyId, keyVersion);

  // Decrypt with version-specific key
  return decryptWithKey(payload, key);
}
```

---

## Performance Considerations

### Benchmarks

| Operation | Average Time | P99 Time | Memory |
|-----------|-------------|----------|--------|
| Encrypt 1KB JSON | 2.3ms | 4.1ms | 8KB |
| Decrypt 1KB JSON | 2.1ms | 3.8ms | 8KB |
| Encrypt 100KB JSON | 8.5ms | 15.2ms | 256KB |
| Decrypt 100KB JSON | 7.2ms | 13.1ms | 256KB |
| Create blind index | 0.3ms | 0.8ms | 1KB |

### Optimization Tips

1. **Batch operations**: Encrypt/decrypt in batches when possible
2. **Caching**: Cache derived keys (they're deterministic)
3. **Parallel processing**: Encryption is CPU-bound, parallelize
4. **Streaming**: For large documents, consider streaming encryption

### Key Caching

```typescript
class EncryptionService {
  private keyCache = new Map<string, { key: Buffer; expires: number }>();
  private KEY_CACHE_TTL = 60000; // 1 minute

  deriveTenantKey(companyId: string, version: number): Buffer {
    const cacheKey = `${companyId}:${version}`;
    const cached = this.keyCache.get(cacheKey);

    if (cached && cached.expires > Date.now()) {
      return cached.key;
    }

    const key = this.deriveTenantKeyUncached(companyId, version);

    this.keyCache.set(cacheKey, {
      key,
      expires: Date.now() + this.KEY_CACHE_TTL
    });

    return key;
  }
}
```

---

## Security Audit Checklist

### Key Management
- [ ] Master key stored securely (not in code/git)
- [ ] Master key is 256 bits (32 bytes)
- [ ] Different keys for encryption vs blind index
- [ ] Key version tracking implemented
- [ ] Key rotation procedure documented

### Encryption
- [ ] Using AES-256-GCM (authenticated encryption)
- [ ] Unique nonce per encryption operation
- [ ] Nonce stored separately from ciphertext
- [ ] Auth tag verified on decryption
- [ ] No ECB mode usage

### Implementation
- [ ] Prisma middleware handles all encrypt/decrypt
- [ ] Legacy data migration path exists
- [ ] Decryption errors logged securely (no PII)
- [ ] Timing-safe comparison for blind indexes
- [ ] No plaintext PII in logs

### Compliance
- [ ] Encryption meets PHIPA requirements
- [ ] Key management meets PIPEDA
- [ ] Audit trail for key access
- [ ] Data deletion capability (key destruction)

---

## Troubleshooting

### "Decryption failed: Invalid authentication tag"

**Cause**: Data was modified after encryption, or wrong key used.

**Check**:
1. Verify `encryptionKeyVersion` matches available keys
2. Check if data was corrupted in transit/storage
3. Verify `companyId` is correct (affects key derivation)

### "Cannot decrypt legacy data"

**Cause**: Document was created before encryption was enabled.

**Solution**:
1. Check `_needsMigration` flag on returned document
2. Run migration job to encrypt legacy data
3. Or handle legacy data in application code

### "Blind index search returns no results"

**Cause**: Normalization mismatch or different companyId.

**Check**:
1. Ensure search value is normalized same as stored
2. Verify searching with correct companyId
3. Check if blind index was created for that field

---

## Related Documents

- [Dynamic PII Architecture](../../architecture/dynamic-pii-architecture.md)
- [PII Classification Service](./pii-classification.md)
- [Compliance Requirements](../../architecture/compliance-requirements.md)

---

**Document Version**: 1.0

# IntelliFill Instrumentation & Observability Strategy

**Last Updated**: 2025-12-17
**Status**: Draft - Ready for Review
**Owner**: Engineering Team

---

## Executive Summary

This document provides a comprehensive instrumentation strategy for IntelliFill, a healthcare/business document processing platform handling PII. Based on a thorough codebase audit, compliance research, and industry best practices analysis, this strategy delivers **100% observability without overwhelming data volume**, while maintaining strict compliance with PHIPA, PIPEDA, SOC 2 Type II, and Vanta requirements.

### Key Findings

| Area | Current State | Target State | Gap |
|------|--------------|--------------|-----|
| **Backend Logging** | 60% (Winston) | 95% | Structured, PII-safe |
| **Backend Metrics** | 40% (Defined, not active) | 95% | Prometheus integration |
| **Backend Tracing** | 15% (Request IDs only) | 90% | OpenTelemetry |
| **Frontend Observability** | 24% | 85% | Sentry + Web Vitals |
| **Compliance Logging** | 70% (Audit logger) | 100% | PII redaction |
| **Alerting** | 0% | 90% | SLO-based |

### Critical Security Gaps Identified

1. **Unencrypted PII in database** - ClientProfile.data, Document.extractedText
2. **PII in logs** - Email addresses, names logged in plaintext
3. **Unencrypted form outputs** - Filled PDFs saved without encryption
4. **No log retention policies** - Logs accumulate indefinitely
5. **Demo credentials in code** - Hardcoded demo@intellifill.com/demo123

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Compliance Requirements Matrix](#2-compliance-requirements-matrix)
3. [Strategic Architecture](#3-strategic-architecture)
4. [Implementation Plan](#4-implementation-plan)
5. [PII Protection Strategy](#5-pii-protection-strategy)
6. [Alerting & SLO Strategy](#6-alerting--slo-strategy)
7. [Platform Recommendations](#7-platform-recommendations)
8. [Cost Projections](#8-cost-projections)
9. [Risk Assessment](#9-risk-assessment)

---

## 1. Current State Assessment

### 1.1 Backend Observability

#### What EXISTS and WORKS

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Winston Logger | `src/utils/logger.ts` | Working | JSON format, file rotation |
| Prometheus Metrics | `src/utils/metrics.ts` | Defined, NOT integrated | Metrics endpoint not exposed |
| Audit Logger | `src/middleware/auditLogger.ts` | Working | 720+ lines, anomaly detection |
| Health Checks | `src/api/routes.ts` | Working | `/health`, `/ready` endpoints |
| Redis Health | `src/utils/redisHealth.ts` | Working | Connection validation |
| Queue Metrics | `src/queue/QueueService.ts` | Working | Job progress tracking |

#### What is MISSING

| Component | Priority | Compliance Impact |
|-----------|----------|-------------------|
| Distributed Tracing | P1 | SOC 2 CC7.1 |
| External Log Aggregation | P1 | PHIPA, PIPEDA |
| Metrics Endpoint `/metrics` | P1 | SOC 2 CC7.2 |
| Alerting System | P1 | SOC 2 CC7.3 |
| Log Encryption | P1 | PHIPA 1.3 |
| PII Redaction in Logs | P0 | PHIPA, PIPEDA |

### 1.2 Frontend Observability

#### Current Coverage: 24%

| Category | Coverage | Status |
|----------|----------|--------|
| Error Tracking | 30% | Client-side only, no external service |
| Analytics | 0% | Not implemented |
| Performance Monitoring | 15% | Progress tracking only |
| Session Recording | 0% | Not implemented |
| Logging | 25% | Basic console logging |
| User Context | 60% | In stores, not in error reports |
| Network Monitoring | 40% | Basic progress/status |

#### Critical Gaps

- No Sentry integration (DSN configured but unused)
- No Google Analytics (GA ID configured but unused)
- No Core Web Vitals tracking
- No session replay capability
- Console logs lost on refresh

### 1.3 Infrastructure Monitoring

#### Existing Infrastructure

| Component | Status | Location |
|-----------|--------|----------|
| Docker Multi-stage | Complete | `quikadmin/Dockerfile` |
| GitHub Actions CI/CD | 80% | `.github/workflows/` |
| Render Deployment | 90% | `render.yaml` |
| Prometheus Config | Ready | `monitoring/prometheus.yml` |
| Grafana Dashboards | Ready | `monitoring/grafana/` |

#### Infrastructure Gaps

- Monitoring stack not deployed to production
- No external uptime monitoring
- No auto-scaling policies
- Alert rules defined but not activated

### 1.4 PII Data Flow Analysis

#### High-Risk PII Storage Locations

```
┌─────────────────────────────────────────────────────────────────┐
│                    PII FLOW DIAGRAM                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Document Upload                                                │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐      │
│  │ PDF/IMG  │───>│ AES-256-GCM  │───>│ uploads/docs/    │ ✅   │
│  └──────────┘    │ Encryption   │    │ (encrypted)      │      │
│                  └──────────────┘    └──────────────────┘      │
│                                                                 │
│  OCR Processing                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐      │
│  │ OCR Text │───>│ No Encrypt   │───>│ Document.        │ ❌   │
│  │ (PII)    │    │              │    │ extractedText    │      │
│  └──────────┘    └──────────────┘    └──────────────────┘      │
│                                                                 │
│  Client Profiles                                                │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐      │
│  │ Profile  │───>│ No Encrypt   │───>│ ClientProfile.   │ ❌   │
│  │ Data     │    │              │    │ data (JSON)      │      │
│  └──────────┘    └──────────────┘    └──────────────────┘      │
│                                                                 │
│  Form Filling                                                   │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐      │
│  │ Filled   │───>│ No Encrypt   │───>│ outputs/filled-  │ ❌   │
│  │ PDF      │    │              │    │ *.pdf            │      │
│  └──────────┘    └──────────────┘    └──────────────────┘      │
│                                                                 │
│  Audit Logs                                                     │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐      │
│  │ Request  │───>│ Partial      │───>│ AuditLog.        │ ⚠️   │
│  │ Data     │    │ Sanitize     │    │ newValue (JSON)  │      │
│  └──────────┘    └──────────────┘    └──────────────────┘      │
│                                                                 │
│  ✅ = Encrypted  ❌ = Unencrypted  ⚠️ = Partially Protected    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Compliance Requirements Matrix

### 2.1 PHIPA Requirements (Ontario Health Privacy)

| Requirement | Current | Required | Gap |
|-------------|---------|----------|-----|
| PHI Access Audit Trail | Partial | Complete | Audit logs lack PHI classification |
| 10-Year Log Retention | No | Yes | No retention policy |
| Tamper-Proof Logs | No | Yes | Logs not immutable |
| Log Encryption at Rest | No | AES-256 | Not implemented |
| Break-Glass Logging | No | Yes | No emergency access tracking |
| Consent Logging | No | Yes | Not tracked |

### 2.2 PIPEDA Requirements (Canadian Federal Privacy)

| Requirement | Current | Required | Gap |
|-------------|---------|----------|-----|
| PI Access Logging | Partial | Complete | Missing purpose-of-use |
| Breach Detection | No | Yes | No automated detection |
| 7-Year Log Retention | No | Yes | No retention policy |
| DSAR Logging | No | Yes | Not implemented |
| Third-Party Disclosure | No | Yes | Not tracked |

### 2.3 SOC 2 Type II Requirements

| Control | Current | Required | Gap |
|---------|---------|----------|-----|
| CC6.1 Access Controls | 70% | 100% | Missing MFA logging |
| CC6.2 Authorization | 60% | 100% | Missing role change audit |
| CC6.3 System Operations | 40% | 100% | Metrics not active |
| CC7.1 System Monitoring | 30% | 100% | No anomaly detection active |
| CC7.2 Availability | 20% | 100% | No uptime monitoring |
| CC7.3 Incident Response | 10% | 100% | No incident logging |
| CC8.1 Change Management | 50% | 100% | Missing deployment logs |

### 2.4 Vanta Integration Requirements

| Requirement | Current | Ready |
|-------------|---------|-------|
| Structured JSON Logs | Yes | Yes |
| GitHub Integration | Yes | Yes |
| Sentry Integration | Configured | No (not activated) |
| PagerDuty Integration | No | No |
| Log Aggregation | No | No |
| Evidence Collection | No | No |

---

## 3. Strategic Architecture

### 3.1 Target Observability Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                 OBSERVABILITY ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    APPLICATION LAYER                      │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  Backend (Express)          Frontend (React)             │   │
│  │  ┌─────────────────┐       ┌─────────────────┐          │   │
│  │  │ OTel Auto-Inst. │       │ OTel Web SDK    │          │   │
│  │  │ Winston Logger  │       │ Sentry          │          │   │
│  │  │ Prom Metrics    │       │ Web Vitals      │          │   │
│  │  │ Audit Logger    │       │                 │          │   │
│  │  └────────┬────────┘       └────────┬────────┘          │   │
│  └───────────┼──────────────────────────┼───────────────────┘   │
│              │                          │                       │
│              ▼                          ▼                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   COLLECTION LAYER                        │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │ OTel         │  │ Prometheus   │  │ Sentry       │   │   │
│  │  │ Collector    │  │ Server       │  │ Relay        │   │   │
│  │  │ (traces)     │  │ (metrics)    │  │ (errors)     │   │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │   │
│  └─────────┼─────────────────┼─────────────────┼────────────┘   │
│            │                 │                 │                │
│            ▼                 ▼                 ▼                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    STORAGE LAYER                          │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │ Grafana      │  │ Prometheus   │  │ Sentry       │   │   │
│  │  │ Tempo        │  │ TSDB         │  │ Cloud        │   │   │
│  │  │ (traces)     │  │ (metrics)    │  │ (errors)     │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │
│  │                                                             │
│  │  ┌──────────────────────────────────────────────────────┐  │
│  │  │ AWS CloudWatch Logs / Better Stack / Datadog Logs    │  │
│  │  │ (compliance logs - encrypted, 10yr retention)        │  │
│  │  └──────────────────────────────────────────────────────┘  │
│  └─────────────────────────────────────────────────────────────┘
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 VISUALIZATION & ALERTING                  │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │   │
│  │  │ Grafana │  │ Sentry  │  │ PagerDuty│  │ Vanta  │    │   │
│  │  │Dashboard│  │Alerts   │  │ OnCall  │  │Evidence│    │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Instrumentation Layers

#### Layer 1: Infrastructure (Host/Container)
- Node.js process metrics (CPU, memory, event loop)
- Container metrics (Docker stats)
- Redis connection pool metrics
- PostgreSQL connection pool metrics

#### Layer 2: Application (Express.js)
- HTTP request/response metrics (RED)
- Middleware execution timing
- Error rates by endpoint
- Authentication events

#### Layer 3: Business Logic
- Document processing metrics
- OCR confidence scores
- Form filling success rates
- Queue depth and processing times

#### Layer 4: External Dependencies
- Supabase auth latency
- Cloudflare R2 storage operations
- Google AI (Gemini) API calls
- Redis operations

---

## 4. Implementation Plan

### Phase 0: Critical Security Fixes (Week 1)

**Priority: CRITICAL - Must complete before any other instrumentation**

| Task | Files Affected | Risk if Skipped |
|------|----------------|-----------------|
| Remove PII from logs | `supabase-auth.routes.ts`, `auditLogger.ts` | Data breach |
| Encrypt ClientProfile.data | `schema.prisma`, services | PHIPA violation |
| Encrypt filled PDFs | `FormFiller.ts` | PII exposure |
| Secure demo account | `supabase-auth.routes.ts` | Account takeover |

**Implementation:**

```typescript
// 1. Create SecureLogger with PII redaction
// src/utils/secureLogger.ts

const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b\d{3}-\d{3}-\d{4}\b/g, // Phone
  /\b784-\d{4}-\d{7}-\d{1}\b/g, // Emirates ID
];

const PII_FIELDS = [
  'email', 'password', 'phone', 'address', 'ssn', 'emiratesId',
  'passportNumber', 'fullName', 'dateOfBirth', 'salary'
];

export function sanitizeForLogging(data: any): any {
  // Implementation to redact PII from log data
}
```

### Phase 1: Backend Foundation (Weeks 2-3)

| Task | Effort | Dependencies |
|------|--------|--------------|
| Activate Prometheus metrics endpoint | 2 hours | None |
| Add OTel auto-instrumentation | 4 hours | npm install |
| Configure log shipping to CloudWatch | 4 hours | AWS account |
| Implement structured logging wrapper | 8 hours | Phase 0 |
| Add request correlation IDs | 4 hours | OTel SDK |

**Key Metrics to Instrument:**

```typescript
// RED Metrics (Request-focused)
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

// Business Metrics
const documentsProcessed = new Counter({
  name: 'documents_processed_total',
  help: 'Documents processed',
  labelNames: ['status', 'document_type']
});

const ocrConfidence = new Histogram({
  name: 'ocr_confidence_score',
  help: 'OCR confidence scores',
  buckets: [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0]
});
```

### Phase 2: Frontend Observability (Week 4)

| Task | Effort | Dependencies |
|------|--------|--------------|
| Activate Sentry integration | 2 hours | DSN (exists) |
| Add OTel Web SDK | 4 hours | npm install |
| Implement Core Web Vitals | 4 hours | web-vitals |
| Add error boundary with Sentry | 4 hours | Sentry SDK |
| Configure session replay | 2 hours | Sentry config |

**Frontend Instrumentation:**

```typescript
// src/lib/observability.ts
import * as Sentry from '@sentry/react';
import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals';

export function initObservability() {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      new Sentry.BrowserTracing(),
      new Sentry.Replay({
        maskAllInputs: true, // PII protection
        blockAllMedia: false,
      }),
    ],
    beforeSend(event) {
      // Remove PII from error events
      return sanitizeErrorEvent(event);
    },
  });

  // Core Web Vitals
  onCLS(sendToAnalytics);
  onFID(sendToAnalytics);
  onLCP(sendToAnalytics);
  onFCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}
```

### Phase 3: Compliance Logging (Weeks 5-6)

| Task | Effort | Dependencies |
|------|--------|--------------|
| Implement PHI access logging | 8 hours | Phase 1 |
| Add breach detection logging | 8 hours | Anomaly detection |
| Configure 10-year retention | 4 hours | CloudWatch/S3 |
| Implement DSAR logging | 4 hours | Audit logger |
| Add consent tracking | 8 hours | Schema change |

**Compliance Log Structure:**

```typescript
interface ComplianceLogEntry {
  timestamp: string;           // ISO 8601
  event_id: string;           // UUID
  event_type: 'PHI_ACCESS' | 'PI_ACCESS' | 'SECURITY' | 'BREACH';

  // Actor
  user_id: string;
  user_role: string;
  session_id: string;
  ip_address: string;

  // Action
  action: string;             // VIEW, CREATE, UPDATE, DELETE, EXPORT
  resource_type: string;      // document, profile, etc.
  resource_id: string;

  // Classification
  phi_present: boolean;
  pii_present: boolean;
  data_classification: 'public' | 'internal' | 'confidential' | 'restricted';

  // Result
  result: 'success' | 'failure' | 'blocked';
  failure_reason?: string;

  // Compliance
  compliance_frameworks: string[];  // ['PHIPA', 'PIPEDA', 'SOC2']
  retention_days: number;          // 3650 for PHI
  purpose?: string;                // 'treatment', 'billing', etc.
  consent_verified?: boolean;
}
```

### Phase 4: Alerting & SLOs (Week 7)

| Task | Effort | Dependencies |
|------|--------|--------------|
| Define SLIs and SLOs | 4 hours | Phase 1 metrics |
| Configure Prometheus alerts | 8 hours | Alertmanager |
| Set up PagerDuty integration | 4 hours | PagerDuty account |
| Create runbooks | 8 hours | Alert definitions |
| Implement error budget tracking | 4 hours | Grafana |

### Phase 5: Dashboard & Visualization (Week 8)

| Task | Effort | Dependencies |
|------|--------|--------------|
| Create operational dashboard | 8 hours | All phases |
| Create compliance dashboard | 8 hours | Phase 3 |
| Configure Vanta integration | 4 hours | Vanta account |
| Document observability stack | 4 hours | All phases |

---

## 5. PII Protection Strategy

### 5.0 Integration with Dynamic PII Architecture

IntelliFill extracts arbitrary fields from documents (passports, Emirates IDs, trade licenses) via OCR. The system **cannot know in advance** what PII fields will be extracted - fields are discovered at runtime using pattern matching.

**For complete architecture details, see:**
- [Dynamic PII Architecture](../../architecture/dynamic-pii-architecture.md)
- [Field-Level Encryption](../security/field-level-encryption.md)

#### Key Integration Points

1. **Extraction Pipeline**: All extracted data is encrypted by default using AES-256-GCM
2. **Classification Engine**: `PIIClassificationService` classifies fields as PII/PHI/SENSITIVE/PUBLIC
3. **Blind Indexes**: HMAC-based indexes enable search without exposing PII
4. **Prisma Middleware**: Transparent encryption/decryption on database operations

#### Observability of Encrypted Data

When logging events related to encrypted data:

```typescript
// Example: Logging document processing without exposing PII
logger.info('Document processed', {
  documentId: doc.id,
  documentType: doc.documentType,           // PUBLIC - can log
  fieldCount: Object.keys(extractedData.fields).length,  // Count, not content
  piiFieldCount: classification.piiFieldCount,  // Classification stats
  publicFieldCount: classification.publicFieldCount,
  ocrConfidence: extractedData.metadata.confidence,
  processingTimeMs: endTime - startTime,
  // NEVER log: extractedData.fields, extractedData.entities
});
```

### 5.1 Logging PII Rules

#### NEVER Log (Prohibited)
- Passwords (plaintext or hashed)
- API keys, tokens, secrets
- Full credit card numbers
- Emirates ID numbers
- Passport numbers
- Health card numbers
- Biometric data
- Full addresses
- **Any content from `extractedData.fields`** (dynamically extracted)
- **Any content from `extractedData.entities`** (names, emails, phones)
- **Encrypted data blobs** (ciphertext, nonces)

#### LOG with Masking (Allowed if masked)
- Email addresses → `jo***@example.com`
- Phone numbers → `***-***-1234`
- Names → `J*** D***`
- Dates of birth → `1990-**-**`

#### LOG as Identifiers (Allowed)
- User UUIDs
- Session UUIDs
- Request IDs
- Trace IDs
- Document UUIDs (not content)
- **Document types** (e.g., "UAE_PASSPORT")
- **Field counts** (e.g., "12 fields extracted")
- **Classification summaries** (e.g., "8 PII, 4 public")
- **Confidence scores** (e.g., "OCR: 95%")
- **Blind index hashes** (for debugging search issues)

### 5.2 Implementation

```typescript
// src/utils/piiSanitizer.ts

export class PIISanitizer {
  private static readonly REDACT = '[REDACTED]';

  private static readonly PII_FIELD_PATTERNS = new Set([
    'password', 'pwd', 'passwd', 'secret', 'token', 'key',
    'email', 'phone', 'mobile', 'fax', 'address',
    'ssn', 'sin', 'emiratesId', 'passportNumber',
    'dateOfBirth', 'dob', 'salary', 'creditCard',
    'diagnosis', 'prescription', 'medicalHistory'
  ]);

  static sanitize(data: any, options?: { preserve?: string[] }): any {
    if (data === null || data === undefined) return data;

    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item, options));
    }

    if (typeof data === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (options?.preserve?.includes(key)) {
          result[key] = value;
        } else if (this.isPIIField(key)) {
          result[key] = this.REDACT;
        } else {
          result[key] = this.sanitize(value, options);
        }
      }
      return result;
    }

    return data;
  }

  private static isPIIField(fieldName: string): boolean {
    const lower = fieldName.toLowerCase();
    return Array.from(this.PII_FIELD_PATTERNS).some(
      pattern => lower.includes(pattern)
    );
  }

  private static sanitizeString(str: string): string {
    // Email pattern
    str = str.replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      '[EMAIL_REDACTED]'
    );
    // Phone pattern
    str = str.replace(
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      '[PHONE_REDACTED]'
    );
    // Emirates ID
    str = str.replace(
      /\b784-\d{4}-\d{7}-\d{1}\b/g,
      '[EMIRATES_ID_REDACTED]'
    );
    return str;
  }
}
```

### 5.3 Database Encryption

**See [Field-Level Encryption Reference](../security/field-level-encryption.md) for complete details.**

#### Schema Changes

```prisma
// prisma/schema.prisma

model Document {
  id                     String   @id @default(cuid())
  companyId              String

  // Searchable metadata (plaintext)
  documentType           String?  // "UAE_PASSPORT", "EMIRATES_ID"
  issueDate              DateTime?
  expiryDate             DateTime?
  ocrConfidence          Float?

  // Encrypted PII (AES-256-GCM)
  extractedDataEncrypted Bytes?   // Encrypted JSON blob
  extractedDataNonce     Bytes?   // 12-byte nonce
  encryptionKeyVersion   Int      @default(1)

  // Blind indexes for searchable encrypted fields
  blindIndexes           BlindIndex[]

  // Legacy field (deprecated, to be migrated)
  extractedData          Json?    @deprecated
}

model BlindIndex {
  id           String   @id @default(cuid())
  documentId   String
  fieldName    String   // "passport_number", "full_name"
  indexHash    String   // HMAC-SHA256 hash for search

  @@unique([documentId, fieldName])
  @@index([indexHash])
}
```

#### Encryption Middleware

The encryption middleware automatically:
1. **On Write**: Encrypts `extractedData` → `extractedDataEncrypted`
2. **On Write**: Creates blind indexes for searchable fields
3. **On Read**: Decrypts `extractedDataEncrypted` → `extractedData`
4. **On Read**: Flags legacy unencrypted documents for migration

```typescript
// src/middleware/encryption.middleware.ts
import { encryptionService } from '../services/encryption/EncryptionService';
import { piiClassificationService } from '../services/pii/PIIClassificationService';

export function encryptionMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    if (params.model === 'Document') {
      if (['create', 'update'].includes(params.action)) {
        params.args.data = await encryptDocumentData(params.args.data);
      }
      if (['findUnique', 'findFirst', 'findMany'].includes(params.action)) {
        const result = await next(params);
        return decryptDocumentResult(result);
      }
    }
    return next(params);
  };
}
```

#### Observability for Encrypted Operations

```typescript
// Log encryption operations without exposing PII
logger.info('Document encrypted', {
  documentId: doc.id,
  companyId: doc.companyId,
  keyVersion: encryptionKeyVersion,
  blindIndexCount: blindIndexes.length,
  encryptedBytesSize: extractedDataEncrypted.length,
  // NEVER log: extractedData, ciphertext content
});

// Log decryption operations
logger.debug('Document decrypted', {
  documentId: doc.id,
  keyVersion: doc.encryptionKeyVersion,
  wasLegacy: doc._needsMigration,
});

// Log search operations (safe - only logs hashes)
logger.debug('Blind index search', {
  fieldName: 'passport_number',
  indexHash: searchHash.substring(0, 8) + '...',  // Truncate for logs
  matchCount: results.length,
});
```

### 5.4 Minimal Viable Security (Compliance-First Approach)

While the full dynamic PII architecture provides maximum security, there are pragmatic approaches that achieve compliance with less implementation overhead.

#### Compliance Requirements Analysis

| Requirement | PHIPA | PIPEDA | SOC 2 | What It Actually Requires |
|-------------|-------|--------|-------|---------------------------|
| **Encryption at Rest** | Required | Required | CC6.1 | Database-level OR field-level |
| **Encryption in Transit** | Required | Required | CC6.7 | TLS 1.2+ (already have) |
| **Access Controls** | Required | Required | CC6.2 | Row-level security sufficient |
| **Audit Logging** | Required | Required | CC7.1 | Who accessed what, when |
| **Breach Detection** | Required | Required | CC7.3 | Anomaly detection |
| **Data Minimization** | - | Principle | - | Don't store unnecessary PII |

#### Minimal Approach: Database-Level Encryption

**Instead of field-level encryption, leverage infrastructure:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    MINIMAL SECURITY STACK                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 1: Transport Security                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ HTTPS/TLS 1.3 everywhere                          ✅ DONE │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Layer 2: Database Encryption (at rest)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Neon/PostgreSQL: Encrypted by default (AES-256)         │  │
│  │ No application changes needed                           │  │
│  │ Encryption key managed by Neon                    ✅ FREE│  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Layer 3: Access Control (authorization)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Supabase RLS: Row-level security policies               │  │
│  │ Users can only access their company's data              │  │
│  │ Already partially implemented                    ⚠️ NEED │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Layer 4: Logging Security (observability)                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ PII-safe logging: Redact before logging                 │  │
│  │ See PIISanitizer implementation above           ⚠️ NEED  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Layer 5: Audit Trail                                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ auditLogger.ts: Already tracks who/what/when             │  │
│  │ Need: Add compliance log structure              ⚠️ NEED  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### What Neon Provides (Free)

Neon PostgreSQL includes:
- **Encryption at rest**: AES-256 for all data
- **Encryption in transit**: TLS for all connections
- **Automatic backups**: Encrypted
- **Point-in-time recovery**: Encrypted

This means: **Database-level encryption is already compliant for "encryption at rest" requirements.**

#### Minimal Implementation Checklist

**Week 1: Critical Logging Fixes (8 hours)**

```typescript
// 1. Create PII-safe logger wrapper
// src/utils/piiSafeLogger.ts

import { sanitizeForLogging } from './piiSanitizer';
import { logger } from './logger';

export const piiSafeLogger = {
  info: (msg: string, data?: any) => logger.info(msg, sanitizeForLogging(data)),
  warn: (msg: string, data?: any) => logger.warn(msg, sanitizeForLogging(data)),
  error: (msg: string, data?: any) => logger.error(msg, sanitizeForLogging(data)),
  debug: (msg: string, data?: any) => logger.debug(msg, sanitizeForLogging(data)),
};

// 2. Replace logger imports across codebase
// Find: import { logger } from '../utils/logger';
// Replace: import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
```

**Week 2: RLS Policies (4 hours)**

```sql
-- Supabase RLS for multi-tenant isolation
-- Already have user context via Supabase Auth

-- Documents: Users can only see their company's documents
CREATE POLICY "company_isolation_documents"
ON documents
USING (company_id = auth.jwt()->>'company_id');

-- ClientProfiles: Same isolation
CREATE POLICY "company_isolation_profiles"
ON client_profiles
USING (company_id = auth.jwt()->>'company_id');
```

**Week 3: Compliance Logging (8 hours)**

```typescript
// Extend existing auditLogger with compliance fields
interface ComplianceAuditEntry {
  // Existing fields...

  // Add compliance tracking
  pii_present: boolean;          // Flag if PII was involved
  data_classification: 'public' | 'internal' | 'confidential';
  compliance_frameworks: string[];  // ['PIPEDA', 'PHIPA']
}
```

#### Trade-offs: Minimal vs Full Encryption

| Aspect | Minimal (DB-Level) | Full (Field-Level) |
|--------|-------------------|-------------------|
| **Implementation Time** | 2-3 weeks | 6-8 weeks |
| **Code Changes** | Low (~20 files) | High (~50 files) |
| **Performance Impact** | None | 10-50ms per operation |
| **Searchability** | Full SQL queries | Blind indexes only |
| **Compliance** | ✅ Meets requirements | ✅✅ Exceeds requirements |
| **Breach Impact** | DB access = all data | DB access = encrypted blobs |
| **Key Management** | Neon manages | We manage |
| **Developer Experience** | Unchanged | Requires encryption awareness |

#### When to Upgrade to Full Encryption

Consider upgrading to field-level encryption when:
1. **Handling PHI (health data)** - HIPAA requires additional controls
2. **Multi-region deployment** - Data residency requirements
3. **Enterprise customers** - May require proof of encryption
4. **After a security incident** - Enhanced protection
5. **SOC 2 Type II audit** - Auditors may recommend it

#### Recommended Path

**Phase 1 (Weeks 1-3): Minimal Viable Security**
1. Implement PII-safe logging (blocks data breach via logs)
2. Add Supabase RLS policies (blocks unauthorized access)
3. Enhance audit logging with compliance fields
4. Document security posture for audits

**Phase 2 (Future): Full Encryption** (if needed)
1. Implement field-level encryption per architecture doc
2. Add blind indexes for search
3. Migrate existing data
4. Update all services

#### Compliance Evidence (for Vanta/Auditors)

With minimal approach, you can prove compliance via:

```markdown
## Encryption at Rest Evidence
- Neon PostgreSQL: All data encrypted with AES-256
- Certificate: https://neon.tech/security
- Configuration: Default, no opt-out possible

## Access Control Evidence
- Supabase Auth: JWT-based authentication
- RLS Policies: Row-level security per company
- Audit Logs: All access logged with user context

## Logging Security Evidence
- PII Sanitizer: Implemented in piiSafeLogger.ts
- Redaction patterns: Emails, phones, Emirates IDs
- No plaintext PII in logs: Verified via log search
```

---

## 6. Alerting & SLO Strategy

### 6.1 Service Level Objectives

| SLO | Target | Measurement Window | Error Budget |
|-----|--------|-------------------|--------------|
| API Availability | 99.9% | 30 days | 43 min/month |
| API Latency (p95) | < 500ms | 7 days | 5% requests |
| Document Processing Success | 95% | 24 hours | 5% failures |
| OCR Accuracy | > 90% confidence | 7 days | 10% low confidence |
| Error Rate | < 1% | 24 hours | 1% of requests |

### 6.2 Alert Priorities

```yaml
# alerts/slo-alerts.yml

groups:
  - name: slo_critical
    rules:
      # P1: Page immediately
      - alert: APIAvailabilityCritical
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[5m])) /
            sum(rate(http_requests_total[5m]))
          ) > 0.02
        for: 2m
        labels:
          severity: critical
          team: backend
        annotations:
          summary: "API error rate exceeds 2%"
          runbook: "https://docs.intellifill.com/runbooks/api-errors"

      # P1: Document processing down
      - alert: DocumentProcessingDown
        expr: |
          sum(rate(documents_processed_total{status="success"}[5m])) == 0
        for: 5m
        labels:
          severity: critical
          team: backend

  - name: slo_warning
    rules:
      # P2: Review within 4 hours
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95,
            rate(http_request_duration_seconds_bucket[5m])
          ) > 0.5
        for: 10m
        labels:
          severity: warning

      # P2: OCR confidence dropping
      - alert: LowOCRConfidence
        expr: |
          histogram_quantile(0.50,
            rate(ocr_confidence_score_bucket[1h])
          ) < 0.8
        for: 30m
        labels:
          severity: warning
```

### 6.3 Alert Routing

```yaml
# alertmanager.yml

route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default'

  routes:
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
      continue: true

    - match:
        severity: warning
      receiver: 'slack-warnings'

receivers:
  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: '<PAGERDUTY_KEY>'
        severity: critical

  - name: 'slack-warnings'
    slack_configs:
      - api_url: '<SLACK_WEBHOOK>'
        channel: '#alerts-warning'
```

---

## 7. Platform Recommendations

### 7.1 Recommended Stack (Startup Stage)

| Component | Recommended | Alternative | Monthly Cost |
|-----------|-------------|-------------|--------------|
| **Traces** | Grafana Tempo (Cloud) | Jaeger (self-hosted) | $0 (free tier) |
| **Metrics** | Prometheus + Grafana | Datadog | $8 (free tier) |
| **Logs** | Better Stack | AWS CloudWatch | $10-50 |
| **Errors** | Sentry | Highlight.io | $26 (Dev tier) |
| **Alerting** | Grafana OnCall | PagerDuty | $0 (free tier) |
| **Compliance** | AWS CloudWatch | Datadog | $20-50 |
| **RUM** | Sentry | Vercel Analytics | Included |

**Total Estimated Cost: $50-150/month**

### 7.2 Growth Stage Stack (>10k users)

| Component | Recommended | Monthly Cost |
|-----------|-------------|--------------|
| **APM** | Datadog | $100-200 |
| **Logs** | Datadog Logs | $50-100 |
| **Compliance** | AWS CloudWatch + S3 | $50-100 |
| **Errors** | Sentry Team | $80 |

**Total Estimated Cost: $300-500/month**

### 7.3 Vanta Integration Path

1. **Immediate**: Connect GitHub, Sentry, AWS
2. **Phase 1**: Connect Grafana Cloud for metrics
3. **Phase 3**: Connect PagerDuty for incident tracking
4. **Ongoing**: Automated evidence collection

---

## 8. Cost Projections

### 8.1 Implementation Costs

| Phase | Engineering Hours | Calendar Time |
|-------|------------------|---------------|
| Phase 0: Security Fixes | 40 hours | 1 week |
| Phase 1: Backend Foundation | 24 hours | 2 weeks |
| Phase 2: Frontend | 16 hours | 1 week |
| Phase 3: Compliance | 32 hours | 2 weeks |
| Phase 4: Alerting | 28 hours | 1 week |
| Phase 5: Dashboards | 24 hours | 1 week |
| **Total** | **164 hours** | **8 weeks** |

### 8.2 Operational Costs (Monthly)

| Stage | Users | Traces/day | Logs/day | Cost |
|-------|-------|-----------|----------|------|
| MVP | <1k | 10k | 1GB | $50 |
| Growth | 1k-10k | 100k | 10GB | $150 |
| Scale | 10k-50k | 500k | 50GB | $500 |

### 8.3 ROI Considerations

**Without observability:**
- Mean time to detect (MTTD): Hours to days
- Mean time to resolve (MTTR): Days
- Customer churn from incidents: High

**With observability:**
- MTTD: Minutes
- MTTR: Hours
- Proactive issue prevention: High

---

## 9. Risk Assessment

### 9.1 Current Risks (Unmitigated)

| Risk | Likelihood | Impact | Risk Score |
|------|------------|--------|------------|
| PII Breach via Logs | High | Critical | Critical |
| Database PII Exposure | High | Critical | Critical |
| Compliance Audit Failure | High | High | High |
| Undetected Outages | Medium | High | High |
| Slow Incident Response | High | Medium | High |

### 9.2 Residual Risks (After Implementation)

| Risk | Likelihood | Impact | Risk Score |
|------|------------|--------|------------|
| PII Breach via Logs | Low | Critical | Medium |
| Database PII Exposure | Low | Critical | Medium |
| Compliance Audit Failure | Low | High | Medium |
| Undetected Outages | Low | High | Low |
| Slow Incident Response | Low | Medium | Low |

---

## Appendices

### A. File Locations Reference

**Backend:**
- Logger: `quikadmin/src/utils/logger.ts`
- Metrics: `quikadmin/src/utils/metrics.ts`
- Audit: `quikadmin/src/middleware/auditLogger.ts`
- Encryption: `quikadmin/src/utils/encryption.ts`
- Queue: `quikadmin/src/queue/QueueService.ts`
- Health: `quikadmin/src/api/routes.ts`

**Frontend:**
- API Client: `quikadmin-web/src/services/api.ts`
- Auth Store: `quikadmin-web/src/stores/backendAuthStore.ts`
- Error Boundary: `quikadmin-web/src/components/ErrorBoundary.tsx`
- Logger: `quikadmin-web/src/utils/logger.ts`

**Infrastructure:**
- Docker: `quikadmin/Dockerfile`
- CI/CD: `.github/workflows/`
- Prometheus: `quikadmin/monitoring/prometheus.yml`
- Render: `render.yaml`

### B. Related Documentation

- [Compliance Requirements](./compliance-observability-requirements.md)
- [Backend Architecture](../../architecture/system-overview.md)
- [API Reference](../api/)
- [Deployment Guide](../../how-to/deployment/)

---

**Document Version**: 1.0
**Created**: 2025-12-17
**Next Review**: 2026-03-17

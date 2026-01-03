# Product Requirements Document: Multi-Agent System Integration

**Document Type:** Product Requirements Document (PRD)
**Version:** 1.0
**Date:** January 2, 2026
**Status:** Ready for Implementation
**Project Owner:** AI Research Team
**Target Release:** Q2 2026

---

## Executive Summary

### Problem Statement

IntelliFill's current document processing system achieves 85-90% accuracy using traditional OCR (Tesseract.js) and pattern matching. This limitation creates:

- **User Friction:** Manual corrections required for 10-15% of documents
- **Business Impact:** Higher support costs, reduced trust, lower conversion rates
- **Competitive Disadvantage:** AI-powered competitors achieving 92%+ accuracy
- **Scalability Limits:** Regex-based extraction fails on complex/non-standard documents

### Proposed Solution

Integrate a multi-agent LLM-powered processing system from the proven PoC (IntelliFill-MultiAgent-PoC) into production IntelliFill. This system uses:

- **7 Specialized Agents:** Orchestrator, Classifier, Extractor, Mapper, QA, OCR Optimizer, Error Recovery
- **LangGraph Workflows:** State-driven orchestration with error recovery
- **Ollama LLMs:** Llama 3.2 8B (primary), Mistral 7B (fast), Phi-3 Mini (edge)
- **Adaptive Processing:** Context-aware semantic extraction vs. rigid pattern matching

### Business Impact

| Metric | Current | Target | Impact |
|--------|---------|--------|--------|
| **Accuracy** | 85-90% | 92-97% | +5-10% improvement |
| **User Satisfaction** | 4.2/5 | 4.7/5 | +0.5 rating improvement |
| **Manual Corrections** | 10-15% | 3-5% | 66% reduction |
| **Processing Time (P95)** | 15s | <30s | Acceptable for quality gain |
| **Support Tickets** | Baseline | -30% | Lower operational costs |

### Resource Requirements

| Resource | Requirement | Notes |
|----------|-------------|-------|
| **Infrastructure** | GPU server (8GB+ VRAM) or serverless GPU | For Ollama models |
| **Development** | 2-3 engineers, 12 weeks | Backend + DevOps + QA |
| **Redis** | Production Redis (Upstash) | Queue management |
| **Storage** | +500MB for model weights | One-time download |
| **Compute** | +$200-400/month | GPU inference costs |

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Latency >30s | Medium | High | A/B test, fallback to current system |
| Model hallucination | Low | High | QA agent + confidence thresholds |
| GPU availability | Medium | Medium | Serverless GPU (Modal, Replicate) |
| Integration complexity | Low | Medium | Shadow mode + phased rollout |
| Accuracy below target | Low | High | Extensive testing + model tuning |

### Timeline Overview

| Phase | Duration | Milestones |
|-------|----------|-----------|
| **Phase 1: Setup** | 2 weeks | Environment, dependencies, infrastructure |
| **Phase 2: Shadow Mode** | 2 weeks | Parallel processing, validation |
| **Phase 3: A/B Testing (5%)** | 2 weeks | Early adopters, feedback |
| **Phase 4: A/B Testing (25%)** | 2 weeks | Scale validation |
| **Phase 5: A/B Testing (50%)** | 2 weeks | Stability verification |
| **Phase 6: A/B Testing (75%)** | 1 week | Pre-rollout confidence |
| **Phase 7: Full Rollout** | 1 week | 100% traffic |
| **Phase 8: Legacy Cleanup** | 2 weeks | Archive old system |
| **Total** | **12 weeks** | **~3 months** |

---

## Product Overview

### Product Vision

Transform IntelliFill from a rule-based document processor into an intelligent AI-powered system that understands context, adapts to document variations, and delivers consistently accurate results with minimal user intervention.

### Target Users

#### Primary Users
1. **Document Processors (80%):** Users uploading ID cards, licenses, passports, financial forms
   - Pain: Manual corrections for poorly scanned or non-standard documents
   - Gain: Higher first-pass accuracy, faster processing

2. **Enterprise Customers (15%):** Organizations processing 100+ documents/day
   - Pain: Accuracy inconsistencies affecting automation ROI
   - Gain: Predictable accuracy, audit trail, confidence scores

3. **Developers (5%):** Teams integrating IntelliFill API
   - Pain: Handling edge cases, explaining extraction failures
   - Gain: Structured confidence scores, detailed error context

#### Secondary Users
- **Support Team:** Fewer escalations from improved accuracy
- **Product Team:** Richer analytics from multi-agent metadata

### Value Proposition

**For document processors** who need reliable data extraction from varied document formats, **IntelliFill with Multi-Agent AI** is a document processing SaaS that **understands context and adapts to document variations**, unlike **traditional OCR systems** that rely on rigid patterns. Our solution **delivers 92-97% accuracy with transparent confidence scores**.

### Success Criteria

#### Phase 1 (Shadow Mode) - Exit Criteria
- [ ] 1000+ documents processed in shadow mode
- [ ] Shadow processing success rate ≥95%
- [ ] Accuracy match rate ≥90% vs. production
- [ ] Zero production impact
- [ ] P95 latency ≤60s (2x current acceptable for validation)

#### Phase 2-6 (A/B Testing) - Exit Criteria per Tier
- [ ] User satisfaction ≥4.5/5
- [ ] Accuracy ≥92% (measured against ground truth)
- [ ] Error rate <1%
- [ ] P95 latency ≤30s
- [ ] No critical bugs
- [ ] Positive ROI demonstrated

#### Phase 7 (Full Rollout) - Success Metrics
- [ ] Accuracy sustained at 92-97% for 2 weeks
- [ ] User satisfaction ≥4.7/5
- [ ] Support ticket reduction ≥25%
- [ ] System stability (uptime >99.9%)

#### Long-Term (3 Months Post-Rollout)
- [ ] Accuracy improvement maintained
- [ ] Net Promoter Score (NPS) increase ≥10 points
- [ ] Customer churn reduction ≥15%
- [ ] API usage growth ≥20%

### Assumptions

1. **Technical Assumptions:**
   - GPU infrastructure available (8GB+ VRAM) or serverless GPU accessible
   - Redis production instance (Upstash) operational
   - Ollama models downloadable and compatible with production environment
   - LangGraph workflows compatible with Bull queue integration

2. **Business Assumptions:**
   - Users accept 2x latency for 2x accuracy improvement (validated in shadow mode)
   - Current accuracy baseline (85-90%) is confirmed through user testing
   - Budget approved for GPU compute ($200-400/month)

3. **User Assumptions:**
   - Users prefer accuracy over speed (within reasonable limits <60s)
   - Confidence scores help users trust automated extraction
   - Manual correction UI remains acceptable fallback

4. **Operational Assumptions:**
   - Team has capacity to monitor 12-week rollout
   - Rollback procedures can execute within 5 minutes
   - Current system remains stable during parallel operation

---

## Functional Requirements

### FR-1: Multi-Agent Document Processing Pipeline

**Priority:** P0 (Critical)
**User Story:** As a document processor, I want the system to intelligently extract data from my documents so that I spend less time on manual corrections.

#### Acceptance Criteria
- [ ] System processes documents through 7-agent pipeline (Orchestrator → Classifier → Extractor → Mapper → QA → Error Recovery)
- [ ] Classification accuracy ≥95% (document type detection)
- [ ] Extraction accuracy ≥92% (field-level accuracy)
- [ ] Mapping accuracy ≥90% (source → target form fields)
- [ ] QA agent validates results with confidence scores (0-1 scale)
- [ ] Error recovery attempts up to 3 retries with exponential backoff
- [ ] Results stored in existing database schema (Document.extractedData field)

#### Technical Details
```typescript
// Enhanced extractedData schema with multi-agent metadata
interface MultiAgentExtractedData {
  // Existing fields preserved for backward compatibility
  fields: Record<string, any>;
  entities: {
    names: string[];
    emails: string[];
    phones: string[];
    dates: string[];
    addresses: string[];
    numbers: string[];
    currencies: string[];
  };

  // New multi-agent fields
  multiAgent: {
    version: string; // "1.0.0"
    orchestratorId: string;
    processingStages: {
      classification: StageResult;
      extraction: StageResult;
      mapping: StageResult;
      qa: StageResult;
    };
    overallConfidence: number; // 0-1
    agentMetadata: {
      modelsUsed: string[]; // e.g., ["llama3.2:8b", "mistral:7b"]
      totalTokens: number;
      processingTimeMs: number;
    };
  };
}

interface StageResult {
  status: "success" | "failed" | "partial";
  confidence: number;
  timestamp: Date;
  attemptCount: number;
  errors?: string[];
}
```

### FR-2: Shadow Mode Processing

**Priority:** P0 (Critical)
**User Story:** As a system administrator, I want to validate the multi-agent system in production without affecting users so that I can ensure quality before rollout.

#### Acceptance Criteria
- [ ] Shadow processor runs in parallel with current system
- [ ] Shadow results logged but not sent to users
- [ ] Comparison analytics generated for each document (accuracy delta, confidence delta, field match rate)
- [ ] Performance metrics collected (latency, token usage, VRAM)
- [ ] Zero impact on production user experience
- [ ] Feature flag (`shadow-mode`) controls activation
- [ ] Comparison results stored in analytics database

#### Technical Details
```typescript
// Shadow mode comparison stored in new table
model ShadowComparison {
  id              String   @id @default(uuid())
  documentId      String
  documentType    String

  // Production results
  productionConfidence  Float
  productionFieldCount  Int
  productionProcessingMs Int

  // Multi-agent results
  multiAgentConfidence  Float
  multiAgentFieldCount  Int
  multiAgentProcessingMs Int

  // Comparison metrics
  accuracyDelta         Float  // -1 to +1
  confidenceDelta       Float
  fieldMatchRate        Float  // 0-1
  significantDifferences Json  // Array of field mismatches

  createdAt      DateTime @default(now())

  @@index([documentType])
  @@index([createdAt])
}
```

### FR-3: A/B Testing Framework

**Priority:** P0 (Critical)
**User Story:** As a product manager, I want to gradually roll out the multi-agent system to a percentage of users so that I can validate improvements with real traffic.

#### Acceptance Criteria
- [ ] Assignment service allocates users to control/treatment groups
- [ ] Assignment is sticky per user (same user always gets same variant)
- [ ] Percentage adjustable via admin API (5%, 10%, 25%, 50%, 75%, 100%)
- [ ] Variant metadata included in all responses for analytics
- [ ] Automatic fallback to control group if treatment fails
- [ ] User feedback collection tied to variant assignment
- [ ] Real-time dashboard shows variant performance comparison

#### Technical Details
```typescript
// A/B test assignment table
model ABTestAssignment {
  id         String   @id @default(uuid())
  userId     String
  documentId String
  variant    String   // "control" | "treatment"
  percentage Int      // Percentage at assignment time
  assignedAt DateTime @default(now())

  @@unique([userId, documentId])
  @@index([userId])
  @@index([variant])
}

// Variant performance metrics
model VariantMetrics {
  id              String   @id @default(uuid())
  variant         String
  documentCount   Int
  avgAccuracy     Float
  avgConfidence   Float
  avgProcessingMs Int
  errorRate       Float
  userSatisfaction Float
  timestamp       DateTime @default(now())

  @@index([variant, timestamp])
}
```

### FR-4: Queue Integration

**Priority:** P0 (Critical)
**User Story:** As a backend engineer, I want multi-agent processing to integrate with existing Bull queues so that it follows current async processing patterns.

#### Acceptance Criteria
- [ ] New queue: `multi-agent-processing` created alongside `ocr-processing`
- [ ] Job data compatible with existing OCRProcessingJob interface
- [ ] Progress updates sent via existing realtime service
- [ ] Retry logic: 3 attempts with exponential backoff (5s, 25s, 125s)
- [ ] Job timeout: 5 minutes (300,000ms)
- [ ] Queue health monitoring via existing `/health` endpoint
- [ ] Redis connection pooling shared with existing queues

#### Technical Details
```typescript
// Multi-agent job data
interface MultiAgentJob {
  documentId: string;
  userId: string;
  filePath: string;
  targetFormId?: string;
  processingMode: "standard" | "enhanced"; // enhanced = higher DPI, more prompts
  priority: "low" | "normal" | "high";
  variant?: "control" | "treatment"; // For A/B testing
  metadata?: {
    uploadedAt: Date;
    fileSize: number;
    pageCount: number;
  };
}

// Queue configuration
const multiAgentQueue = new Bull<MultiAgentJob>("multi-agent-processing", {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    timeout: 300000, // 5 minutes
  },
});
```

### FR-5: Confidence-Based Routing

**Priority:** P1 (High)
**User Story:** As a user, I want the system to automatically request manual review when confidence is low so that I'm not surprised by inaccurate results.

#### Acceptance Criteria
- [ ] Documents with confidence <0.70 automatically flagged for review
- [ ] Documents with confidence 0.70-0.85 show warning UI
- [ ] Documents with confidence >0.85 auto-approved (user can still edit)
- [ ] Confidence threshold configurable via environment variable
- [ ] Manual review queue created in database
- [ ] Email/push notification sent for review requests
- [ ] Analytics track review rate by document type

#### Technical Details
```typescript
// Enhanced Document status with confidence routing
enum DocumentStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  REVIEW_REQUIRED = "REVIEW_REQUIRED", // New status
  FAILED = "FAILED"
}

// Confidence thresholds (environment variables)
const CONFIDENCE_THRESHOLDS = {
  AUTO_APPROVE: parseFloat(process.env.CONFIDENCE_AUTO_APPROVE || "0.85"),
  WARNING: parseFloat(process.env.CONFIDENCE_WARNING || "0.70"),
  REVIEW_REQUIRED: parseFloat(process.env.CONFIDENCE_REVIEW || "0.70")
};
```

### FR-6: Admin Dashboard Enhancements

**Priority:** P2 (Medium)
**User Story:** As an administrator, I want to monitor multi-agent performance in real-time so that I can detect issues and adjust rollout percentage.

#### Acceptance Criteria
- [ ] Dashboard shows A/B test metrics (control vs. treatment)
- [ ] Real-time accuracy chart (last 24h, 7d, 30d)
- [ ] Confidence score distribution histogram
- [ ] Top failure reasons by stage (classification, extraction, mapping, QA)
- [ ] Token usage and cost tracking
- [ ] Rollout percentage adjustment UI with confirmation dialog
- [ ] Manual rollback button (emergency use)

#### UI Components
```typescript
// Admin dashboard API endpoints
GET /api/admin/multiagent/metrics
  - Returns: VariantMetrics[], ShadowComparison[]

GET /api/admin/multiagent/health
  - Returns: Queue health, model availability, GPU utilization

POST /api/admin/multiagent/percentage
  - Body: { percentage: number } // 0-100
  - Returns: Updated assignment config

POST /api/admin/multiagent/rollback
  - Body: { reason: string }
  - Returns: Rollback status
```

### FR-7: User Feedback Collection

**Priority:** P1 (High)
**User Story:** As a user, I want to rate the accuracy of extracted data so that the system improves over time.

#### Acceptance Criteria
- [ ] After document processing, show feedback modal (1-5 stars)
- [ ] Optional text comment field for issues
- [ ] Separate ratings for accuracy, speed, overall satisfaction
- [ ] Feedback linked to variant assignment (control/treatment)
- [ ] Analytics dashboard shows feedback trends by variant
- [ ] Negative feedback (<3 stars) triggers manual review
- [ ] Feedback submitted via API: `POST /api/feedback`

#### Technical Details
```typescript
// User feedback schema
model UserFeedback {
  id              String   @id @default(uuid())
  documentId      String
  userId          String
  variant         String   // "control" | "treatment"

  // Ratings (1-5)
  overallRating   Int
  accuracyRating  Int
  speedRating     Int

  // Optional details
  comment         String?
  issuesReported  String[] // e.g., ["wrong_name", "missing_date"]

  createdAt       DateTime @default(now())

  @@index([variant])
  @@index([overallRating])
  @@index([createdAt])
}
```

---

## Non-Functional Requirements

### NFR-1: Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| **P50 Latency** | ≤15s | 50th percentile processing time |
| **P95 Latency** | ≤30s | 95th percentile processing time |
| **P99 Latency** | ≤60s | 99th percentile processing time |
| **Throughput** | 100 docs/hour per worker | Sustained processing rate |
| **Queue Depth** | <500 waiting jobs | Redis queue length |
| **GPU Utilization** | 60-80% average | Prevent over/under-provisioning |

#### Acceptance Criteria
- [ ] Load testing with 1000 documents shows P95 ≤30s
- [ ] Sustained throughput of 100 docs/hour for 24 hours
- [ ] No memory leaks over 7-day continuous operation
- [ ] Queue recovery time <5 minutes after Redis outage
- [ ] GPU memory usage stable (no leaks from model caching)

### NFR-2: Security

| Requirement | Implementation |
|-------------|----------------|
| **Data Encryption** | All PII fields encrypted at rest (AES-256) |
| **Authentication** | Existing Supabase Auth + JWT middleware |
| **Authorization** | User can only access their own documents |
| **Audit Logging** | All processing logged with user ID, timestamp, variant |
| **Model Security** | Ollama models run in isolated container/VM |
| **API Security** | Rate limiting: 100 requests/minute per user |

#### Acceptance Criteria
- [ ] Security audit passed (OWASP Top 10)
- [ ] No PII data in logs (use PII-safe logger)
- [ ] Model inference isolated from user file storage
- [ ] Secrets management via environment variables (never hardcoded)
- [ ] HTTPS/TLS for all external communication

### NFR-3: Reliability

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Uptime** | 99.9% | Monthly uptime excluding maintenance |
| **Error Rate** | <1% | % of documents failing processing |
| **MTTR** | <15 minutes | Mean time to recover from incidents |
| **Data Durability** | 99.999% | No data loss from system failures |
| **Rollback Time** | <5 minutes | Time to revert to current system |

#### Acceptance Criteria
- [ ] Automatic health checks every 60s
- [ ] Circuit breaker pattern for model inference failures
- [ ] Graceful degradation: fallback to current system if multi-agent fails
- [ ] Database backups every 6 hours
- [ ] Redis persistence enabled (AOF + RDB)
- [ ] Incident response runbook documented

### NFR-4: Scalability

| Requirement | Target | Implementation |
|-------------|--------|----------------|
| **Horizontal Scaling** | 1-10 workers | Bull queue supports multiple workers |
| **Document Size** | Up to 50 pages | Chunking strategy for large documents |
| **Concurrent Users** | 1000 users | Async queue processing |
| **Model Concurrency** | 4 concurrent requests per GPU | Connection pooling |
| **Redis Scaling** | Upstash free tier limits | Optimized polling intervals |

#### Acceptance Criteria
- [ ] Adding worker nodes increases throughput linearly (up to GPU limit)
- [ ] 50-page document processes without timeout
- [ ] 1000 concurrent uploads queue properly
- [ ] Model inference handles 4 parallel requests
- [ ] Redis polling optimized (5-minute intervals) to stay within Upstash free tier

### NFR-5: Maintainability

| Requirement | Implementation |
|-------------|----------------|
| **Code Quality** | TypeScript strict mode, ESLint, Prettier |
| **Test Coverage** | ≥80% unit test coverage, E2E tests for critical paths |
| **Documentation** | API docs (OpenAPI), architecture diagrams (Mermaid), ADRs |
| **Logging** | Structured logs (Pino), log levels (debug, info, warn, error) |
| **Monitoring** | Metrics (Prometheus), dashboards (Grafana), alerts |

#### Acceptance Criteria
- [ ] All public APIs have JSDoc comments
- [ ] Architecture Decision Records (ADRs) created for major decisions
- [ ] Integration tests cover shadow mode, A/B testing, queue processing
- [ ] Logs include correlation IDs for request tracing
- [ ] Metrics exported in Prometheus format

### NFR-6: Usability

| Requirement | Target |
|-------------|--------|
| **Confidence Display** | Show confidence score (0-100%) with color coding |
| **Processing Status** | Real-time progress updates (via WebSocket) |
| **Error Messages** | User-friendly explanations (not technical stack traces) |
| **Feedback UI** | <3 clicks to submit feedback |
| **Mobile Support** | Responsive design for tablet/mobile |

#### Acceptance Criteria
- [ ] Confidence score shown with green (>85%), yellow (70-85%), red (<70%)
- [ ] Progress bar updates every 5% increment
- [ ] Error messages provide actionable next steps (e.g., "Try re-uploading with higher DPI")
- [ ] Feedback modal auto-appears after processing (dismissable)
- [ ] Mobile UI tested on iOS Safari, Android Chrome

### NFR-7: Compliance

| Requirement | Implementation |
|-------------|----------------|
| **GDPR** | Right to erasure (delete user data), data portability |
| **SOC 2** | Audit logs, access controls, encryption at rest/transit |
| **CCPA** | Do-not-sell flag, data disclosure requests |
| **HIPAA** | Not applicable (no health data processed) |

#### Acceptance Criteria
- [ ] Data deletion API: `DELETE /api/users/:id/data` (cascades to documents)
- [ ] Data export API: `GET /api/users/:id/export` (JSON format)
- [ ] Audit logs retained for 90 days
- [ ] Encryption verified (at rest: AES-256, in transit: TLS 1.3)

---

## Technical Requirements

### TR-1: Infrastructure Requirements

#### GPU Infrastructure

**Option A: Self-Hosted GPU Server**
- GPU: NVIDIA RTX 3060 or better (8GB+ VRAM)
- CPU: 8 cores, 16 threads
- RAM: 32GB DDR4
- Storage: 500GB SSD
- Network: 100 Mbps+ bandwidth
- OS: Ubuntu 22.04 LTS
- Cost: ~$2000 upfront + $50/month (electricity, maintenance)

**Option B: Serverless GPU (Recommended)**
- Provider: Modal, Replicate, or RunPod
- GPU: A10 or T4 (shared)
- Auto-scaling: 0-4 instances
- Cold start: <30s
- Cost: $0.0004/second GPU time (~$200-400/month for 100 docs/day)

#### Redis Infrastructure

**Production Redis:**
- Provider: Upstash (recommended for serverless)
- Plan: Free tier (10K commands/day) or Pay-as-you-go
- Features: TLS, persistence (AOF), replication
- Cost: $0 (free tier) or ~$10/month (paid)

#### Database

**Existing Neon PostgreSQL:**
- No changes required
- Add new tables via Prisma migration
- Estimated storage increase: +50MB

### TR-2: Dependency Requirements

#### New Dependencies (Backend)

```json
{
  "dependencies": {
    "@langchain/core": "^1.1.7",
    "@langchain/langgraph": "^0.2.0",
    "@langchain/ollama": "^0.1.0",
    "@langchain/community": "^0.3.0",
    "ollama": "^0.5.0",
    "zod": "^3.22.0"
  }
}
```

Total bundle size increase: ~15MB

#### Ollama Models (Downloaded to GPU Server)

| Model | Size | Use Case | VRAM | Download Time |
|-------|------|----------|------|---------------|
| **Llama 3.2 8B** | 4.9 GB | Primary extraction, QA | 5.5 GB | ~10 minutes |
| **Mistral 7B** | 4.1 GB | Fast mapping, orchestration | 4.5 GB | ~8 minutes |
| **Phi-3 Mini** | 2.3 GB | Edge classification, error recovery | 2.8 GB | ~5 minutes |

**Total Storage:** 11.3 GB
**Total VRAM:** 12.8 GB (fits in 16GB GPU, tight on 8GB)

**For 8GB GPU:** Use quantized versions (Q4_K_M) to reduce VRAM to ~8GB total

### TR-3: Database Schema Changes

#### New Tables

```prisma
// Multi-agent processing state
model MultiAgentProcessing {
  id             String          @id @default(uuid())
  documentId     String          @unique
  correlationId  String          @unique
  userId         String
  status         ProcessingStatus
  currentStage   ProcessingStage
  state          Json            // Full ProcessingState from LangGraph
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  completedAt    DateTime?

  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

enum ProcessingStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  FAILED
  REVIEW_REQUIRED
}

enum ProcessingStage {
  CLASSIFICATION
  EXTRACTION
  MAPPING
  VALIDATION
  ERROR_RECOVERY
  COMPLETE
}

// Checkpoints for long-running jobs
model Checkpoint {
  id             String   @id @default(uuid())
  documentId     String
  correlationId  String
  stage          String
  state          Json
  reason         String
  compressed     Boolean  @default(false)
  sizeBytes      Int
  createdAt      DateTime @default(now())

  @@index([documentId])
  @@index([correlationId])
  @@index([createdAt])
}

// A/B test assignments
model ABTestAssignment {
  id         String   @id @default(uuid())
  userId     String
  documentId String
  variant    String   // "control" | "treatment"
  percentage Int      // Percentage at assignment time
  assignedAt DateTime @default(now())

  @@unique([userId, documentId])
  @@index([userId])
  @@index([variant])
}

// Shadow mode comparison analytics
model ShadowComparison {
  id                      String   @id @default(uuid())
  documentId              String
  documentType            String

  // Production metrics
  productionConfidence    Float
  productionFieldCount    Int
  productionProcessingMs  Int

  // Multi-agent metrics
  multiAgentConfidence    Float
  multiAgentFieldCount    Int
  multiAgentProcessingMs  Int

  // Comparison
  accuracyDelta           Float
  confidenceDelta         Float
  fieldMatchRate          Float
  significantDifferences  Json     // Array of field mismatches

  createdAt               DateTime @default(now())

  @@index([documentType])
  @@index([createdAt])
}

// User feedback
model UserFeedback {
  id              String   @id @default(uuid())
  documentId      String
  userId          String
  variant         String

  overallRating   Int      // 1-5
  accuracyRating  Int      // 1-5
  speedRating     Int      // 1-5

  comment         String?
  issuesReported  String[] // Array of issue descriptions

  createdAt       DateTime @default(now())

  @@index([variant])
  @@index([overallRating])
  @@index([createdAt])
}

// Variant performance metrics (aggregated)
model VariantMetrics {
  id               String   @id @default(uuid())
  variant          String
  documentCount    Int
  avgAccuracy      Float
  avgConfidence    Float
  avgProcessingMs  Int
  errorRate        Float
  userSatisfaction Float
  timestamp        DateTime @default(now())

  @@index([variant, timestamp])
}
```

#### Modified Tables

```prisma
// Existing Document table - add reprocessing support
model Document {
  // ... existing fields ...

  // New fields for multi-agent support
  reprocessCount Int @default(0)
  multiAgentVersion String? // e.g., "1.0.0"

  // Enhanced extractedData now includes multiAgent metadata
  // (no schema change, backward compatible JSON)
}
```

### TR-4: API Changes

#### New Endpoints

```typescript
// Multi-agent processing
POST /api/process/multiagent
  - Body: { documentId: string, targetFormId?: string }
  - Response: { jobId: string, status: string }

// Shadow mode toggle (admin only)
POST /api/admin/shadow-mode
  - Body: { enabled: boolean }
  - Response: { success: boolean }

// A/B test percentage (admin only)
POST /api/admin/ab-test/percentage
  - Body: { percentage: number } // 0-100
  - Response: { percentage: number, affected_users: number }

// Rollback (admin only)
POST /api/admin/multiagent/rollback
  - Body: { reason: string }
  - Response: { success: boolean, rollback_time: string }

// User feedback
POST /api/feedback
  - Body: { documentId: string, overallRating: number, accuracyRating: number, speedRating: number, comment?: string }
  - Response: { id: string }

// Multi-agent metrics (admin only)
GET /api/admin/multiagent/metrics
  - Query: { variant?: string, from?: Date, to?: Date }
  - Response: VariantMetrics[]

// Shadow comparison analytics (admin only)
GET /api/admin/shadow/comparisons
  - Query: { documentType?: string, limit?: number }
  - Response: ShadowComparison[]
```

#### Modified Endpoints

```typescript
// Existing process endpoint - add variant metadata
POST /api/process/single
  - Response now includes:
    {
      // ... existing fields ...
      variant?: "control" | "treatment",
      multiAgent?: {
        version: string,
        confidence: number,
        processingTimeMs: number
      }
    }

// Health check - add multi-agent queue status
GET /api/health
  - Response now includes:
    {
      // ... existing fields ...
      queues: {
        ocr: { ... },
        multiAgent: {
          available: boolean,
          waiting: number,
          active: number,
          completed: number,
          failed: number
        }
      },
      models: {
        ollama: {
          available: boolean,
          models: string[]
        }
      }
    }
```

### TR-5: Environment Variables

```bash
# Multi-Agent Configuration
MULTIAGENT_ENABLED=false                    # Feature flag (default: false)
SHADOW_MODE_ENABLED=false                   # Shadow mode flag (default: false)
AB_TEST_PERCENTAGE=5                        # Initial A/B test percentage (default: 5)

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434      # Ollama API endpoint
OLLAMA_MODEL_PRIMARY=llama3.2:8b            # Primary extraction model
OLLAMA_MODEL_FAST=mistral:7b                # Fast mapping model
OLLAMA_MODEL_EDGE=phi3:mini                 # Edge classification model
OLLAMA_TIMEOUT_MS=120000                    # Model timeout (2 minutes)

# Model Parameters
MODEL_TEMPERATURE=0.1                       # Low temperature for deterministic output
MODEL_MAX_TOKENS=2048                       # Max tokens per generation
MODEL_CONTEXT_WINDOW=8192                   # Context window size

# Processing Configuration
CONFIDENCE_AUTO_APPROVE=0.85                # Auto-approve threshold
CONFIDENCE_WARNING=0.70                     # Warning threshold
CONFIDENCE_REVIEW_REQUIRED=0.70             # Manual review threshold

# Queue Configuration (existing)
REDIS_URL=redis://...                       # Existing Redis connection

# Monitoring (optional)
LANGFUSE_PUBLIC_KEY=pk_...                  # Langfuse API key (optional)
LANGFUSE_SECRET_KEY=sk_...                  # Langfuse secret key (optional)
LANGFUSE_HOST=https://cloud.langfuse.com    # Langfuse host (optional)
```

---

## Integration Phases

### Phase 1: Environment Setup & Infrastructure (2 weeks)

**Objective:** Set up development and production infrastructure for multi-agent system.

#### Exit Criteria
- [ ] GPU inference responding with <5s latency
- [ ] Redis production instance operational
- [ ] Database migrations applied successfully
- [ ] All tests passing

---

### Phase 2: Shadow Mode Implementation (2 weeks)

**Objective:** Run multi-agent system in parallel with current system to validate accuracy without user impact.

#### Exit Criteria
- [ ] 1000+ documents processed in shadow mode
- [ ] Shadow success rate ≥95%
- [ ] Accuracy match rate ≥90%
- [ ] Zero production errors from shadow processor
- [ ] Dashboard operational

---

### Phase 3: A/B Testing Infrastructure (2 weeks)

**Objective:** Build A/B testing framework to route percentage of users to multi-agent system.

#### Exit Criteria
- [ ] Assignment service routes 5% traffic to treatment
- [ ] Treatment variant processes documents successfully
- [ ] Fallback to control works on treatment failures
- [ ] User feedback collection operational
- [ ] Metrics dashboard shows variant comparison

---

### Phase 4: Gradual Rollout (8 weeks)

**Objective:** Incrementally increase traffic to multi-agent system, monitoring quality at each step.

#### Rollout Schedule

| Week | Percentage | Sample Size (est.) | Focus | Exit Criteria |
|------|------------|-------------------|-------|---------------|
| **1-2** | 5% | ~350 docs | Early adopters, bug detection | Error rate <2%, no critical bugs |
| **3-4** | 10% | ~700 docs | Scale validation | Accuracy ≥92%, latency P95 ≤35s |
| **5-6** | 25% | ~1750 docs | Performance validation | User satisfaction ≥4.5, error rate <1% |
| **7-8** | 50% | ~3500 docs | Stability verification | All metrics green for 2 weeks |
| **9** | 75% | ~5250 docs | Pre-rollout confidence | Sustained performance, no regressions |
| **10** | 100% | All docs | Full rollout | ROI positive, accuracy sustained |

**Rollback Triggers (Automatic):**
- Error rate >10% for 5 consecutive minutes
- P95 latency >120s for 10 minutes
- User satisfaction drops below 3.0

**Exit Criteria (100% Rollout):**
- [ ] All tiers completed successfully
- [ ] Accuracy sustained at 92-97% for 2 weeks
- [ ] User satisfaction ≥4.7/5
- [ ] Support tickets reduced by ≥25%
- [ ] No critical bugs

---

### Phase 5: Full Rollout & Legacy Deprecation (3 weeks)

**Objective:** Complete migration to multi-agent system and archive legacy code.

#### Exit Criteria
- [ ] Multi-agent system is primary processor
- [ ] Legacy system archived
- [ ] Documentation updated
- [ ] Team trained on new system

---

## Risk Management

### Risk 1: Latency Exceeds 30s (P95)

**Probability:** Medium
**Impact:** High (user experience degradation)

**Mitigation:**
1. **Pre-Launch:** Benchmark latency, optimize prompts, use faster models, implement caching
2. **During Rollout:** Monitor P95 latency, automatic rollback if P95 >120s for 10 minutes
3. **Fallback:** Offer "fast mode" (current system) vs. "accurate mode" (multi-agent)

---

### Risk 2: Model Hallucination (Incorrect Extraction)

**Probability:** Low
**Impact:** High (trust erosion, incorrect data)

**Mitigation:**
1. **Prevention:** QA agent validates all extractions, confidence thresholds flag low-quality results
2. **Detection:** User feedback flags hallucinations, analytics track field-level accuracy
3. **Response:** Immediate rollback if hallucination rate >5%, retrain prompts, adjust temperature

---

### Risk 3: GPU Unavailability

**Probability:** Medium (serverless GPU)
**Impact:** Medium (processing blocked)

**Mitigation:**
1. **Infrastructure:** Use serverless GPU with auto-scaling, multi-region deployment, monitor GPU health
2. **Fallback:** Automatic fallback to current system if GPU unavailable, queue jobs retry after 5 minutes
3. **Cost Management:** Set auto-scaling limits (max 4 instances), monitor GPU usage

---

### Risk 4: Integration Complexity

**Probability:** Low
**Impact:** Medium (timeline delay)

**Mitigation:**
1. **Planning:** Shadow mode validates integration, phased rollout allows iterative fixes
2. **Development:** Reuse existing queue patterns, maintain backward compatibility, comprehensive tests
3. **Team:** Pair programming, code reviews, daily standups during rollout

---

### Risk 5: Accuracy Below 92% Target

**Probability:** Low
**Impact:** High (business case fails)

**Mitigation:**
1. **Validation:** Test suite with 500 ground-truth documents, A/B testing compares accuracy directly
2. **Tuning:** Prompt engineering workshops, model fine-tuning if needed
3. **Acceptance:** If accuracy ≥90% but <92%, evaluate user satisfaction; 5% improvement may still justify rollout

---

## Success Metrics

### Primary Metrics (KPIs)

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| **Accuracy** | 85-90% | 92-97% | Field-level accuracy vs. ground truth |
| **User Satisfaction** | 4.2/5 | 4.7/5 | Feedback ratings (1-5 stars) |
| **Manual Corrections** | 10-15% | 3-5% | % of documents requiring edits |
| **Support Tickets** | Baseline | -30% | Monthly ticket volume |

### Secondary Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| **P95 Latency** | 15s | ≤30s | 95th percentile processing time |
| **Error Rate** | ~2% | <1% | % of documents failing processing |
| **Confidence Score** | N/A | ≥0.85 avg | Average confidence across all documents |
| **Churn Rate** | Baseline | -15% | Monthly user churn |

### Operational Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Uptime** | 99.9% | Monthly uptime excluding maintenance |
| **MTTR** | <15 min | Mean time to recover from incidents |
| **Queue Depth** | <500 | Average waiting jobs in queue |
| **GPU Utilization** | 60-80% | Average GPU usage (prevent over/under-provisioning) |

---

## Rollback Plan

### Rollback Triggers

**Automatic Rollback (Immediate):**
- Error rate >10% for 5 consecutive minutes
- P95 latency >120s for 10 minutes
- Critical security vulnerability discovered
- GPU unavailability >15 minutes

**Manual Rollback (Team Decision):**
- User satisfaction drops below 3.5/5
- Support tickets increase by >50%
- Accuracy falls below 85%
- Business stakeholder request

### Rollback Procedure

#### Emergency Rollback (<5 minutes)

```bash
# Step 1: Disable multi-agent routing
curl -X POST https://api.intellifill.com/api/admin/ab-test/percentage \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{ "percentage": 0 }'

# Step 2: Re-enable current processor
curl -X POST https://api.intellifill.com/api/admin/feature-flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{ "flag": "current-processor", "enabled": true }'

# Step 3: Verify rollback
curl https://api.intellifill.com/api/health
# Should show: multiAgent.percentage = 0

# Step 4: Alert team
# Slack notification sent automatically via monitoring system
```

#### Gradual Rollback (Non-Critical Issues)

```bash
# Reduce traffic incrementally
# Week 1: 75% → 50%
# Week 2: 50% → 25%
# Week 3: 25% → 0%

curl -X POST https://api.intellifill.com/api/admin/ab-test/percentage \
  -d '{ "percentage": 50 }'
```

### Data Preservation

**During Rollback:**
- All multi-agent processing data retained (MultiAgentProcessing, Checkpoint tables)
- User feedback preserved for analysis
- Comparison analytics available for post-mortem
- Rollback reason documented in incident report

**Post-Rollback:**
- Root cause analysis (RCA) document created
- Fix timeline established
- Re-rollout plan drafted
- Stakeholders notified

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Shadow Mode** | Processing documents with multi-agent system in parallel without affecting users |
| **Control Group** | Users receiving current system processing |
| **Treatment Group** | Users receiving multi-agent system processing |
| **Confidence Score** | 0-1 value indicating agent's certainty in extraction accuracy |
| **Variant** | "control" or "treatment" assignment in A/B test |
| **Accuracy Delta** | Difference in accuracy between multi-agent and current system |
| **Field Match Rate** | Percentage of fields matching between two systems |
| **Orchestrator** | Agent coordinating workflow between other agents |
| **Checkpoint** | Saved state of processing for recovery |
| **Hallucination** | Incorrect LLM output not grounded in source document |

---

**Document Version:** 1.0
**Last Updated:** January 2, 2026
**Next Review:** After Phase 2 (Shadow Mode) completion
**Approvals Required:** Engineering Lead, Product Manager, CTO

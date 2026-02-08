# IntelliFill Product Hardening Dossier

**Date:** 2026-02-08
**Method:** 7 parallel deep-dive agents analyzing code, researching production-grade alternatives, adversarial critique, and engineering upgrade plans
**Scope:** All 7 major features of IntelliFill

---

## Executive Summary

This dossier is the result of a systematic product hardening exercise across every major feature of IntelliFill. Seven independent agents read thousands of lines of source code, researched how production-grade systems solve the same problems, adversarially attacked each feature to find trust-breaking failure modes, and proposed concrete, shippable upgrades.

### The Verdict

IntelliFill has **solid architectural foundations** -- Supabase Auth + RLS, Bull queues with retry logic, LangGraph-based multi-agent pipeline, pgvector for semantic search, pdf-lib for form filling. The codebase is well-structured and thoughtfully designed.

However, the product has **critical gaps between intent and execution** that would cause trust-breaking failures in production:

- **2 security vulnerabilities** that should be fixed today (registration privilege escalation, demo mode backdoor)
- **1 non-functional feature** marketed as working (multi-agent pipeline nodes are stubs)
- **3 silent data corruption vectors** (date format ambiguity, profile last-write-wins, literal "null" in forms)
- **Multiple missing safety nets** (no Arabic OCR for UAE documents, fabricated confidence scores, fake batch embedding)

### Critical Findings by Severity

| Severity                  | Count | Examples                                                                                                           |
| ------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| **P0 -- Fix Today**       | 5     | Registration privilege escalation, demo backdoor, multi-agent stubs, Arabic OCR exclusion, plaintext PII           |
| **P1 -- Fix This Sprint** | 8     | Date format ambiguity, literal "null" bug, XFA silent failure, confidence fabrication, stale jobs, queue collision |
| **P2 -- Plan Next**       | 15    | Profile audit trail, field key registry, re-ranking, DLQ, document expiry, batch limits                            |
| **P3 -- Backlog**         | 12    | Deprecate UserProfile, common name hardening, Langfuse integration, prompt versioning                              |

---

## P0 -- Fix Today (5 Items)

These are issues where the product is actively broken, insecure, or misleading users right now.

### 1. Registration Privilege Escalation [SECURITY]

**Feature:** RBAC
**File:** `quikadmin/src/api/supabase-auth.routes.ts:233`
**Problem:** Registration endpoint accepts `role` from user input with `['user', 'admin']` as valid values. Any user can register as ADMIN, bypassing ALL RLS policies via the `is_admin()` database function.
**Fix:** Hardcode `const role = 'user'` on registration. 30-minute fix.

### 2. Demo Mode Backdoor [SECURITY]

**Feature:** RBAC
**File:** `quikadmin/src/api/supabase-auth.routes.ts:1137`
**Problem:** Demo login only disables when `ENABLE_DEMO_MODE === 'false'` (opt-out). If env var is unset in production, anyone can login with `demo@intellifill.com / demo123` and get a 4-hour token.
**Fix:** Change to opt-in: `!== 'true'`. 1-hour fix.

### 3. Multi-Agent Pipeline Returns Empty Data [FUNCTIONAL]

**Feature:** Multi-Agent AI Pipeline
**File:** `quikadmin/src/multiagent/workflow.ts:139-259`
**Problem:** 4 of 5 LangGraph workflow nodes are stubs. `extractNode()` returns `{}`, `mapNode()` passes through, `qaNode()` returns `isValid: true` always, `errorRecoverNode()` just increments retry count. The fully-implemented agent code in `classifierAgent.ts`, `extractorAgent.ts`, `mapperAgent.ts`, `qaAgent.ts` is **dead code**. The pipeline classifies documents then returns empty results marked as "successful."
**Fix:** Wire stub nodes to their implemented agent functions. Small effort -- the code exists, it just needs connecting.

### 4. Arabic Characters Excluded from OCR [FUNCTIONAL]

**Feature:** OCR & Document Extraction
**File:** `quikadmin/src/services/OCRService.ts`
**Problem:** Tesseract's `tessedit_char_whitelist` explicitly only includes ASCII characters. Arabic text on UAE documents (Emirates IDs, trade licenses, visas) is **silently dropped**. For a product processing UAE government documents, this means 100% data loss on Arabic fields.
**Fix:** Remove restrictive whitelist, add Arabic language pack (`'eng+ara'`). 1-2 hour fix.

### 5. ClientProfile Stores PII in Plaintext [SECURITY]

**Feature:** Client Profiles
**File:** `quikadmin/src/services/ClientDocumentFieldService.ts`
**Problem:** `ClientProfile.data` contains passport numbers, Emirates IDs, dates of birth, salary information in plaintext JSON. The legacy `UserProfile` system encrypts with `encryptJSON()`, but the primary `ClientProfile` system does not. Database breach exposes all client PII directly.
**Fix:** Apply `encryptJSON()`/`decryptJSON()` (utilities already exist). Add migration for existing records with backward-compatible reader.

---

## P1 -- Fix This Sprint (8 Items)

### 6. Date Format Ambiguity (DD/MM vs MM/DD) [DATA CORRUPTION]

**Feature:** OCR & Extraction
**Problem:** Date regex matches both formats. `01/02/1990` could be January 2 or February 1. UAE documents use DD/MM/YYYY, US documents use MM/DD/YYYY. No disambiguation exists. **#1 most likely production failure** for form filling.
**Fix:** Create `DateResolver` service with category-based locale detection, plausible range validation, cross-field checks. S effort.

### 7. Literal "null" Written into PDF Forms [DATA CORRUPTION]

**Feature:** Form Auto-fill
**File:** `quikadmin/src/fillers/FormFiller.ts:67`
**Problem:** `String(null)` writes literal "null" text into form fields. The test suite explicitly validates this behavior as correct. Users would see "null" printed on submitted government forms.
**Fix:** Skip null/undefined/empty values, add to warnings. 5-10 lines. S effort.

### 8. XFA Forms Produce Deceptively Empty Output [TRUST]

**Feature:** Form Auto-fill
**Problem:** Many government/immigration forms use XFA format. pdf-lib's `getFields()` returns empty array for XFA. The system "successfully" produces an unfilled PDF with zero warnings and `success: true`.
**Fix:** Detect XFA before filling, return explicit unsupported format error. 15-20 lines. S effort.

### 9. Fabricated Confidence Scores [TRUST]

**Feature:** OCR & Extraction
**File:** `quikadmin/src/services/OCRService.ts`
**Problem:** `estimateVLMConfidence()` starts at 85 and applies heuristic bumps. It does not reflect actual model uncertainty. A hallucinated result can show 92% confidence. Users trust these numbers to decide whether to review data.
**Fix:** Replace with Gemini log-probabilities. Create ground truth dataset for calibration. M-L effort.

### 10. Concurrent OCR Worker Crash [RELIABILITY]

**Feature:** OCR & Extraction
**File:** `quikadmin/src/parsers/strategies/`
**Problem:** `PDFParsingStrategy.parse()` calls `ocrService.cleanup()` in `finally`, terminating the singleton Tesseract worker. If another request is mid-OCR, it crashes. Two separate Tesseract workers also exist (OCRService + DocumentExtractionService).
**Fix:** Consolidate workers, remove cleanup from `finally`, manage lifecycle at app level. M effort.

### 11. Documents Stuck in "PROCESSING" Forever [RELIABILITY]

**Feature:** Batch Processing
**Problem:** If a worker crashes, document status stays `PROCESSING` permanently. Bull's stalled detection takes 5 min (Upstash tuning), but even then, the database status is never reconciled.
**Fix:** Add stale job reconciliation cron (every 15 min, reset documents processing > 30 min). S effort.

### 12. Queue Name Collision [DATA CORRUPTION]

**Feature:** Batch Processing
**Files:** `QueueService.ts:105` and `ocrQueue.ts:322`
**Problem:** Both create a Bull queue named `ocr-processing` with DIFFERENT processors expecting different job data shapes. If both are active, jobs get processed by the wrong handler.
**Fix:** Rename legacy queue or deprecate `QueueService.ts`. S effort.

### 13. ClientProfile Audit Trail Missing [COMPLIANCE]

**Feature:** Client Profiles
**Problem:** `UserProfile` has `ProfileAuditLog` with field-level change tracking. `ClientProfile` (the primary system) has none. No way to determine when a field was changed, what it was before, or who changed it.
**Fix:** Create `ClientProfileAuditLog` table mirroring existing pattern. S-M effort.

---

## P2 -- Plan Next (15 Items)

### 14. Confidence-Gated Profile Overwrites

**Feature:** Client Profiles
**Problem:** `mergeToClientProfile()` does unconditional last-write-wins. Low-quality OCR silently overwrites correct data.
**Fix:** Compare confidence before overwriting, surface conflicts for user review. M effort.

### 15. MRZ Checksum Validation for Passports

**Feature:** OCR & Extraction
**Problem:** MRZ lines are extracted but checksums never validated. Free cryptographic-grade verification of passport number, DOB, and expiry is unused.
**Fix:** Add MRZ parsing library, cross-validate against extracted fields. S effort.

### 16. Adaptive Image Preprocessing

**Feature:** OCR & Extraction
**Problem:** Fixed `threshold(128)` destroys faint text on photocopied/low-contrast documents. VLM path sends binarized images (should send color).
**Fix:** Use Otsu's method for Tesseract, skip threshold for VLM. S effort.

### 17. Post-Fill PDF Verification

**Feature:** Form Auto-fill
**Problem:** No verification that filled values were written correctly. Silent corruption from encoding failures, truncation, or font issues goes undetected.
**Fix:** Re-load filled PDF and compare values against expected. S effort.

### 18. Date Format Detection and Conversion

**Feature:** Form Auto-fill
**Problem:** Dates are passed through as-is. A DD/MM/YYYY date filled into an MM/DD/YYYY field creates legally invalid forms.
**Fix:** Create `DateFormatService` with template-level target format config. M effort.

### 19. Mapping Confidence Guardrails

**Feature:** Form Auto-fill
**Problem:** 0.5 Levenshtein threshold creates false positives (`employee_id` ↔ `employer_id`). ValidationService exists but is never called.
**Fix:** Raise threshold, add semantic alias lists, wire ValidationService into pipeline. M effort.

### 20. Fix Fake Batch Embedding

**Feature:** Knowledge Base
**File:** `quikadmin/src/services/embedding.service.ts:644`
**Problem:** `generateBatchWithRetry` iterates texts sequentially with individual API calls. Claims batch processing but doesn't use `batchEmbedContents`. 100 chunks = 50 seconds instead of one call.
**Fix:** Use Google's actual batch API. S effort.

### 21. Persist Embedding Quota to Database

**Feature:** Knowledge Base
**Problem:** Quota tracking is in-memory `Map`. Server restart = quota reset. Multi-instance deployments multiply effective quota.
**Fix:** Redis-backed or DB-backed counter. S effort.

### 22. Add Organization-Level RLS for Knowledge Base

**Feature:** RBAC
**Problem:** `document_sources` and `document_chunks` have no RLS policies. Cross-tenant knowledge base leakage depends entirely on application code filtering.
**Fix:** Enable RLS with `organization_id` policies, add `set_org_context()`. M effort.

### 23. Unified Field Key Registry

**Feature:** Client Profiles
**Problem:** Three different normalization strategies (snake_case, camelCase, custom mapping) across ProfileService, ClientDocumentFieldService, and smart-profile. Same field appears under different keys.
**Fix:** Single canonical registry used by all code paths. M effort.

### 24. Document Expiry Tracking

**Feature:** Client Profiles
**Problem:** Expired passport/visa/ID data is served without warning. Forms filled with expired document data get rejected.
**Fix:** Post-process profile response to flag expired date fields. S effort.

### 25. Batch Size Limits & Timeout

**Feature:** Batch Processing
**Problem:** No limit on batch size. 1000-document batch could run for hours. No timeout on batch jobs.
**Fix:** Max 50 per batch, 30-min timeout, backpressure when queue > 200. S effort.

### 26. Queue Deduplication

**Feature:** Batch Processing
**Problem:** Knowledge and multiagent queues have no deduplication. Double-clicks create duplicate jobs.
**Fix:** Apply deterministic job ID pattern from ocrQueue. S effort.

### 27. Harden Document Sharing

**Feature:** RBAC
**Problem:** Shares are globally accessible via token with no org boundaries, no rate limiting, no max access count.
**Fix:** Add org awareness, rate limits, configurable access caps. M effort.

### 28. Invalidate Search Cache After Processing

**Feature:** Knowledge Base
**Problem:** Cache is invalidated on upload but NOT after processing completes. Users search and don't find just-processed documents for up to 5 min.
**Fix:** Add invalidation call after storage stage. S effort (30 min).

---

## P3 -- Backlog (12 Items)

| #   | Item                                           | Feature          | Effort |
| --- | ---------------------------------------------- | ---------------- | ------ |
| 29  | Wire agents to unified LLM client              | Multi-Agent      | M      |
| 30  | Set temperature=0 for deterministic extraction | Multi-Agent      | S      |
| 31  | Add classification confidence guard            | Multi-Agent      | M      |
| 32  | Enable Langfuse tracing                        | Multi-Agent      | M      |
| 33  | Add pipeline cost budget with hard cap         | Multi-Agent      | S      |
| 34  | Deprecate UserProfile system                   | Client Profiles  | S-L    |
| 35  | Harden PersonGrouping for common Arabic names  | Client Profiles  | M      |
| 36  | Cross-encoder re-ranking for search            | Knowledge Base   | L      |
| 37  | Dead letter queue for poison pills             | Batch Processing | M      |
| 38  | Unified shutdown manager                       | Batch Processing | M      |
| 39  | Queue observability dashboard                  | Batch Processing | M      |
| 40  | Act on critical anomaly alerts                 | RBAC             | M      |

---

## Feature-by-Feature Dossiers

### 1. OCR & Document Extraction

**Current Reality:** Dual-engine OCR (Tesseract + Gemini VLM behind feature flag). Image preprocessing with Sharp. Two coexisting extraction systems (legacy regex DataExtractor + modern LLM extractorAgent). Category-specific prompts with Zod validation. Self-correction loop for low-confidence fields. Redis-based extraction caching.

**What's Technically Weak:**

- Arabic characters explicitly excluded from Tesseract whitelist (100% Arabic data loss on UAE docs)
- Fixed threshold(128) destroys faint text
- VLM confidence is fabricated (starts at 85, heuristic bumps)
- Two unsynchronized Tesseract workers with cleanup race condition
- Date regex matches both DD/MM and MM/DD with no disambiguation
- Name regex fails on Arabic, multi-word, hyphenated, ALL-CAPS names
- MRZ checksums extracted but never validated
- Multi-document merge uses `Object.assign` (last-write-wins, no conflict detection)

**What Better Systems Do:** Multi-engine ensemble with automatic selection. Calibrated confidence from model logits. Adaptive preprocessing (Otsu/Sauvola). MRZ checksum verification. Layout-aware extraction. Human-in-the-loop review queues.

**Trust-Breaking Failures:** Wrong date format (Jan 2 vs Feb 1). European passport name extraction failure. Arabic text silently dropped. Confidence says 92% on hallucinated data. Concurrent requests crash OCR worker.

**Upgrade Plan:** Arabic OCR support (S) -> Date disambiguation (S) -> Worker consolidation (M) -> MRZ validation (S) -> Adaptive preprocessing (S) -> Cross-field validation (S-M) -> Confidence calibration (L)

---

### 2. Client Profiles

**Current Reality:** Two parallel profile systems (UserProfile with encryption + audit, ClientProfile without either). Last-write-wins merge for automated extraction. Manual edit protection via `manuallyEdited` flag. PersonGroupingService for entity resolution using Jaro-Winkler fuzzy matching. Smart Profile batch flow that doesn't persist results.

**What's Technically Weak:**

- ClientProfile stores PII in plaintext (passport numbers, Emirates IDs)
- No audit trail on the primary profile system
- Last-write-wins overwrites correct data with bad OCR
- Two parallel systems with no connection
- Three different field key normalization strategies
- Smart Profile batch extraction doesn't persist
- PersonGroupingService false positives on common Arabic names

**What Better Systems Do:** Golden Record with survivorship rules. Source-of-truth hierarchy by document type. Temporal versioning. Conflict queues for human review. Field-level encryption. Expiry-aware fields.

**Trust-Breaking Failures:** Bad OCR silently overwrites correct name. No way to trace when/who changed a field. Expired passport data served without warning. Two "Mohammed Ahmed" clients merged into one.

**Upgrade Plan:** Encrypt ClientProfile (S) -> Audit trail (S-M) -> Confidence-gated overwrites (M) -> Document expiry (S) -> Field key registry (M) -> PersonGrouping hardening (M) -> Deprecate UserProfile (L)

---

### 3. Form Auto-fill

**Current Reality:** Two flows (automated FieldMapper + template-based manual mapping). Levenshtein distance matching with 0.5 threshold. Smart option matching for dropdowns/radio (6-tier: exact -> variation -> reverse -> partial -> first-letter -> Dice). Supports 6 PDF field types. ValidationService exists but is never called.

**What's Technically Weak:**

- `String(null)` writes literal "null" into form fields (test validates this as correct)
- XFA forms produce empty output with `success: true`
- No date format detection or conversion
- 0.5 Levenshtein threshold creates false positives
- No post-fill PDF verification
- Orphaned files when DB write fails after PDF save
- ValidationService wired up but never called
- No field length awareness (pdf-lib may silently truncate)

**What Better Systems Do:** Bidirectional confidence scoring. Template registration with field type metadata. Human review before finalizing. AcroForm + XFA support. Post-fill verification round-trip. Locale-aware date formatting. Audit trail per filled field.

**Trust-Breaking Failures:** "null" printed on government forms. Dates in wrong format (legally invalid). employee_id filled with employer data. XFA forms returned empty. Corrupted PDF after fill.

**Upgrade Plan:** Post-fill verification (S) -> Null guard (S) -> XFA detection (S) -> Date format service (M) -> Mapping guardrails (M) -> Atomic file+record (S) -> Field-level audit (S-M)

---

### 4. Batch Processing

**Current Reality:** 8 queues across 4 files using two libraries (Bull + BullMQ). QueueCoordinator only covers 2 of 5 active queues. Exponential backoff retries. Upstash-tuned stalled detection (5 min intervals). Real-time progress via RealtimeService. Knowledge queue has checkpointing; others don't.

**What's Technically Weak:**

- Queue name collision (`ocr-processing` created by both QueueService and ocrQueue)
- Documents stuck in PROCESSING forever (no reconciliation)
- No batch size limits (1000-doc batch could run for hours)
- Knowledge/multiagent queues have no deduplication
- Batch "parallel" mode doesn't track child job completion
- Multiple independent SIGTERM handlers (race condition)
- QueueCoordinator doesn't include knowledge/multiagent queues

**What Better Systems Do:** Temporal durable execution with workflow replay. DAG-based orchestration. Dead letter queues. Circuit breakers. Per-tenant rate limits. Backpressure. Prometheus metrics with alerting.

**Trust-Breaking Failures:** Documents permanently stuck. Queue collision causes wrong processor. Batch reports success when children failed. Redis crash causes duplicate processing.

**Upgrade Plan:** Stale job reconciliation (S) -> Batch limits (S) -> Queue name fix (S) -> Deduplication (S) -> Unified shutdown (M) -> Dead letter queue (M) -> Observability dashboard (M)

---

### 5. Knowledge Base & Vector Search

**Current Reality:** Upload->Queue->Extract->Chunk->Embed->Store pipeline. Three chunking strategies (semantic/fixed/hybrid). Google text-embedding-004 (768-dim). pgvector with HNSW index. Hybrid search (vector + PostgreSQL ts_rank). Dual caching (Redis embedding cache + search cache). Processing checkpoints for resumability. Organization-scoped with RLS on vector tables.

**What's Technically Weak:**

- "Batch" embedding is actually sequential (100x slower than real batch API)
- Quota tracking in-memory (resets on restart, multiplies across instances)
- HNSW index is global (not partitioned by org)
- Chunks can exist without embeddings (nullable column)
- `reprocessChunks` only deletes, doesn't actually re-process
- No re-ranking layer (raw vector scores)
- Stale cache during active processing
- `text_search` tsvector column not in Prisma schema (drift risk)

**What Better Systems Do:** Late/contextual chunking. Parent-child chunk hierarchies. Reciprocal Rank Fusion for hybrid search. Cross-encoder re-ranking. Embedding model versioning and migration. Matryoshka embeddings for dimension reduction.

**Trust-Breaking Failures:** Cross-tenant data leakage via RLS context leak. Search returns topically similar but factually wrong results. Newly processed documents invisible for 5 min. Embedding model upgrade has no migration path.

**Upgrade Plan:** Fix batch embedding (S) -> Search cache invalidation (S) -> Embedding NOT NULL guard (S) -> Persist quotas (S) -> Org-filtered HNSW index (M) -> Compress checkpoints (M) -> Cross-encoder re-ranking (L)

---

### 6. Multi-Agent AI Pipeline

**Current Reality:** LangGraph StateGraph with 5 agents (Classifier, Extractor, Mapper, QA, Error Recovery). Only classifier is wired up -- other 4 nodes are stubs returning empty/hardcoded data. BullMQ queue with 2 concurrent workers. A/B testing schema exists but routing logic doesn't. Checkpointing schema exists but isn't used. Feature-flagged with 6 flags, all defaulting OFF.

**What's Technically Weak:**

- **4 of 5 workflow nodes are stubs** -- pipeline is non-functional
- Agents use raw GoogleGenerativeAI instead of unified LLM client
- No temperature setting (non-deterministic results)
- No pipeline cost budget
- No checkpointing despite schema existing
- No job-level timeout enforcement
- No deduplication on document processing
- A/B test comparison logic doesn't exist

**What Better Systems Do:** Persistent checkpointing (MemorySaver). Human-in-the-loop interrupts. Streaming intermediate state. Token budgets with hard caps. Prompt versioning. Canary deployments. Confidence calibration. Evaluation suites with ground truth.

**Trust-Breaking Failures:** Pipeline returns empty data marked successful. Misclassification cascades to wrong extraction. Self-correction burns unlimited tokens. Non-deterministic results make A/B testing unreliable. Stuck pipeline occupies worker indefinitely.

**Upgrade Plan:** Wire agent implementations (S) -> Set temperature=0 (S) -> Job timeout + dedup (S) -> Cost budget (S) -> Classification confidence guard (M) -> Unified LLM client (M) -> Langfuse tracing (M)

---

### 7. Multi-Tenant RBAC

**Current Reality:** Dual-auth (Supabase Auth + custom JWT). Two role systems (UserRole on User, OrgMemberRole on memberships). RLS on 11 user-owned tables. Organization context middleware with 5-min cache. Token family rotation with theft detection. Invitation system with 7-day expiry. Comprehensive audit logging with anomaly detection.

**What's Technically Weak:**

- Registration accepts admin role from user input (privilege escalation)
- Demo mode enabled by default (opt-out instead of opt-in)
- Dual role system creates privilege confusion
- Knowledge base tables have NO RLS (org isolation is application-only)
- Document sharing has no org boundaries
- Org context cache staleness (5 min) means revoked users retain access
- Critical security alerts detected but not acted upon
- Jobs, processing_history, notifications have no RLS

**What Better Systems Do:** Single hierarchical role model. RLS on every tenant-scoped table. Permission inheritance. Cryptographic invitation tokens. API key management. Immutable audit logs. DSAR tooling. Rate-limited invitations.

**Trust-Breaking Failures:** Anyone can register as ADMIN. Demo login works in production if env var unset. Cross-tenant knowledge base leak via missed filter. Revoked user retains access for 5 min. Document share link enables unlimited data exfiltration.

**Upgrade Plan:** Fix registration escalation (S) -> Disable demo default (S) -> Unify role model (M) -> KB RLS (M) -> Harden sharing (M) -> Fix cache staleness (S-M) -> Act on critical alerts (M)

---

## Product Trustworthiness Scorecard

| Feature              | Security | Data Integrity | Reliability | Completeness | Overall |
| -------------------- | -------- | -------------- | ----------- | ------------ | ------- |
| OCR & Extraction     | C        | D              | C           | B            | C       |
| Client Profiles      | D        | D              | B           | C            | D+      |
| Form Auto-fill       | B        | D              | C           | B            | C       |
| Batch Processing     | B        | C              | C           | B            | C+      |
| Knowledge Base       | B        | C              | B           | B            | B-      |
| Multi-Agent Pipeline | B        | F              | C           | F            | D       |
| Multi-Tenant RBAC    | D        | B              | B           | B            | C+      |

**Legend:** A = Production-grade, B = Solid with gaps, C = Functional but fragile, D = Significant issues, F = Non-functional or critically broken

---

## Recommended Implementation Roadmap

### Week 1: Emergency Fixes (5 items, ~2 days of work)

1. Fix registration privilege escalation (30 min)
2. Disable demo mode by default (1 hour)
3. Wire multi-agent stub nodes to implementations (1 day)
4. Add Arabic OCR support (2 hours)
5. Fix literal "null" in form filling (1 hour)

### Week 2: Data Integrity (5 items, ~3 days)

6. Encrypt ClientProfile data (1 day)
7. Add XFA form detection (2 hours)
8. Fix date format ambiguity (1-2 days)
9. Fix stale job reconciliation (half day)
10. Fix queue name collision (2 hours)

### Week 3: Trust & Reliability (5 items, ~4 days)

11. Add ClientProfile audit trail (1-2 days)
12. Consolidate OCR workers (1-2 days)
13. Fix fake batch embedding (2 hours)
14. Add queue deduplication (half day)
15. Add batch size limits (half day)

### Week 4: Validation & Safety (5 items, ~4 days)

16. Add MRZ checksum validation (1-2 days)
17. Post-fill PDF verification (half day)
18. Add org-level RLS for knowledge base (1-2 days)
19. Persist embedding quotas (half day)
20. Invalidate search cache after processing (30 min)

### Sprint 2+: Hardening (remaining items)

21-40. Confidence calibration, re-ranking, DLQ, mapping guardrails, date format service, Langfuse, cost budgets, unified role model, sharing hardening, etc.

---

## Files Analyzed

| Category             | Files Read    | Lines Analyzed (est.) |
| -------------------- | ------------- | --------------------- |
| OCR & Extraction     | 15+ files     | ~4,000                |
| Client Profiles      | 10+ files     | ~2,500                |
| Form Auto-fill       | 12+ files     | ~3,000                |
| Batch Processing     | 10+ files     | ~2,500                |
| Knowledge Base       | 12+ files     | ~5,000                |
| Multi-Agent Pipeline | 17+ files     | ~8,000                |
| Multi-Tenant RBAC    | 12+ files     | ~3,500                |
| **Total**            | **~90 files** | **~28,500 lines**     |

---

_Generated by 7-agent parallel hardening swarm on 2026-02-08_

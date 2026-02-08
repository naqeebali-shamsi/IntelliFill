# IntelliFill Product Roadmap

**Version:** 1.0
**Date:** 2026-02-08
**Owner:** Product Manager
**Initiatives:** Product Hardening (40 items) + Browser Extension Foundation

---

## 1. Executive Summary

### Vision

IntelliFill processes UAE government documents through OCR, AI extraction, profile management, and form auto-fill. The platform has solid architectural foundations -- Supabase Auth, Bull queues, LangGraph pipeline, pgvector search, pdf-lib filling -- but a product hardening audit revealed **critical gaps between intent and execution** that would cause trust-breaking failures in production.

Simultaneously, a Chrome extension prototype exists (`extension/`) but is vanilla JS, hardcoded to localhost, and not integrated with the backend. It needs to become a production-grade TypeScript extension connected to the real API.

### Current State

| Area                | Status                                                               |
| ------------------- | -------------------------------------------------------------------- |
| **Security**        | 2 critical vulnerabilities (registration escalation, demo backdoor)  |
| **Data Integrity**  | 3 silent corruption vectors (dates, null values, profile overwrites) |
| **Pipeline**        | 4 of 5 LangGraph nodes are stubs returning empty data                |
| **OCR**             | Arabic characters silently dropped from UAE documents                |
| **Client Profiles** | PII stored in plaintext, no audit trail                              |
| **Extension**       | ~2,500 lines vanilla JS, localhost-only, no auth, Manifest V3        |

### Target State (End of Week 8)

| Area                | Target                                                                        |
| ------------------- | ----------------------------------------------------------------------------- |
| **Security**        | All P0/P1 vulnerabilities patched, PII encrypted at rest                      |
| **Data Integrity**  | Date disambiguation, null guards, confidence-gated overwrites                 |
| **Pipeline**        | All 5 agents wired and functional with QA validation                          |
| **OCR**             | Arabic + English bilingual extraction, calibrated confidence                  |
| **Client Profiles** | Encrypted data, full audit trail, document expiry warnings                    |
| **Extension**       | TypeScript, production build system, auth integration, Chrome Web Store ready |

### Trustworthiness Scorecard Trajectory

| Feature              | Current | After Phase 1 | After Phase 2 | After Phase 3 |
| -------------------- | ------- | ------------- | ------------- | ------------- |
| OCR & Extraction     | C       | B             | B+            | A-            |
| Client Profiles      | D+      | C+            | B             | B+            |
| Form Auto-fill       | C       | B             | B+            | A-            |
| Batch Processing     | C+      | C+            | B             | B+            |
| Knowledge Base       | B-      | B-            | B             | B+            |
| Multi-Agent Pipeline | D       | B             | B+            | A-            |
| Multi-Tenant RBAC    | C+      | B+            | A-            | A-            |

**Legend:** A = Production-grade, B = Solid with gaps, C = Functional but fragile, D = Significant issues, F = Non-functional

---

## 2. Phase 1: Emergency Hardening (Week 1-2)

> Fix security vulnerabilities, wire broken pipeline, set up extension foundation.

### Week 1: Security + Quick Wins (P0 Items 1-5, P1 Items 6-8)

#### P0-1: Registration Privilege Escalation [SECURITY] [30 min]

- **File:** `quikadmin/src/api/supabase-auth.routes.ts:233`
- **Problem:** Registration endpoint accepts `role` from user input. Anyone can register as ADMIN, bypassing all RLS policies.
- **Fix:** Remove `role` from request body destructuring. Hardcode `const role = 'user'`.
- **Verification:** POST `/api/auth/v2/register` with `{"role": "admin"}` produces user with `role: 'user'`.

#### P0-2: Demo Mode Backdoor [SECURITY] [1 hr]

- **File:** `quikadmin/src/api/supabase-auth.routes.ts:1137`
- **Problem:** Demo login only disabled when `ENABLE_DEMO_MODE === 'false'` (opt-out). Unset env var = demo login works in production.
- **Fix:** Change to opt-in: `!== 'true'`.
- **Verification:** Unset `ENABLE_DEMO_MODE` -> demo login returns 403.

#### P0-3: Multi-Agent Pipeline Stubs [FUNCTIONAL] [1-2 days]

- **File:** `quikadmin/src/multiagent/workflow.ts:139-302`
- **Problem:** 4 of 5 LangGraph nodes are stubs. `extractNode()` returns `{}`, `mapNode()` passes through, `qaNode()` returns `isValid: true`, `errorRecoverNode()` just increments retry. The real agent code in `agents/*.ts` is dead code.
- **Fix:** Wire stub nodes to existing implemented agents (`extractorAgent.ts`, `mapperAgent.ts`, `qaAgent.ts`, `errorRecoveryAgent.ts`). Resolve type mismatches between agent return types and state types.
- **Dependencies:** None. Agent code already exists and is tested.

#### P0-4: Arabic OCR Support [FUNCTIONAL] [2 hrs]

- **File:** `quikadmin/src/services/OCRService.ts:255-260`
- **Problem:** `tessedit_char_whitelist` explicitly includes only ASCII. Arabic text on UAE documents is silently dropped.
- **Fix:** Remove restrictive whitelist. Change Tesseract language from `'eng'` to `'eng+ara'`.

#### P0-5: ClientProfile PII Encryption [SECURITY] [1 day]

- **File:** `quikadmin/src/services/ClientDocumentFieldService.ts`
- **Problem:** `ClientProfile.data` stores passport numbers, Emirates IDs, DOBs in plaintext. `encryptJSON()`/`decryptJSON()` utilities exist but are not used.
- **Fix:** Apply `encryptJSON()` on write, `decryptJSON()` on read with backward-compatible fallback for legacy unencrypted records. Create migration script for existing records.

#### P1-6: Literal "null" in Form Fields [DATA CORRUPTION] [30 min]

- **File:** `quikadmin/src/fillers/FormFiller.ts:67`
- **Problem:** `String(null)` writes literal "null" text into PDF form fields.
- **Fix:** Skip null/undefined/empty values, add to warnings list.

#### P1-7: XFA Form Detection [TRUST] [30 min]

- **File:** `quikadmin/src/fillers/FormFiller.ts`
- **Problem:** XFA forms return empty field array. System reports `success: true` with 0 fields filled.
- **Fix:** Detect zero fields, return `success: false` with clear unsupported-format warning.

#### P1-8: Date Format Disambiguation [DATA CORRUPTION] [1-2 days]

- **Problem:** Date regex matches both DD/MM and MM/DD. `01/02/1990` is ambiguous. UAE uses DD/MM, but no disambiguation exists.
- **Fix:** Create `DateResolver` service with category-based locale detection. UAE document categories default to DD/MM/YYYY. Unambiguous dates (day > 12) auto-resolve.
- **New file:** `quikadmin/src/services/DateResolver.ts`

### Week 2: Extension TypeScript Foundation

#### EXT-1: Project Structure & Build System [2-3 days]

- **Goal:** Transform vanilla JS prototype into TypeScript project with modern build tooling.
- **Evaluate:** WXT (recommended for Manifest V3 + hot reload), Plasmo, or Vite plugin.
- **Structure:**
  ```
  extension/
  ├── src/
  │   ├── background/        # Service worker
  │   ├── content/           # Content scripts
  │   ├── popup/             # Popup UI (React)
  │   ├── lib/               # Shared utilities
  │   │   ├── api/           # Backend API client
  │   │   ├── auth/          # Authentication
  │   │   ├── storage/       # Encrypted chrome.storage wrapper
  │   │   └── detection/     # Field detection (migrated)
  │   └── types/             # TypeScript definitions
  ├── public/                # Static assets, icons
  ├── dist/                  # Build output
  ├── tsconfig.json
  ├── package.json
  └── wxt.config.ts          # Or equivalent build config
  ```
- **Deliverables:**
  - TypeScript compilation for all source files
  - Hot reload in development mode
  - Production build that produces valid Chrome extension
  - Port existing `field-detector.js`, `autocomplete-injector.js`, `content-script.js`, `background.js`, `popup.js` to TypeScript

#### EXT-2: API Client & Auth Integration [2-3 days]

- **Goal:** Connect extension to real backend API with proper authentication.
- **Auth flow options:**
  1. **Supabase Auth direct** -- Extension uses Supabase JS client, stores session in `chrome.storage.session`
  2. **JWT relay** -- Extension authenticates via backend `/api/auth/v2/login`, stores tokens in `chrome.storage.session`
- **Recommended:** Option 2 (JWT relay) for consistency with web app and simpler Supabase-free extension bundle.
- **API client features:**
  - Base URL configurable (not hardcoded to localhost)
  - Token refresh on 401 response
  - Automatic `Authorization: Bearer` header injection
  - Request/response type safety via shared types
- **Update `manifest.json`:**
  - Replace `host_permissions` from localhost to production API domain
  - Add `"storage"` permission for session tokens
  - Consider `"identity"` permission if using OAuth flow

### Week 1-2 Success Criteria

| Metric                      | Target                                                         |
| --------------------------- | -------------------------------------------------------------- |
| P0 security vulnerabilities | 0 remaining                                                    |
| Multi-agent pipeline        | Returns real extracted data for test documents                 |
| Arabic OCR                  | Extracts Arabic text from Emirates ID test image               |
| Extension                   | TypeScript builds, loads in Chrome, authenticates with backend |
| Adversarial tests           | 10+ tests covering P0 fixes pass                               |

---

## 3. Phase 2: Stability & Core Extension (Week 3-4)

> Fix remaining P1 items, build extension core features.

### Week 3: P1 Reliability & Trust Fixes (Items 9-13)

#### P1-9: VLM Confidence Calibration [TRUST] [4 hrs]

- **File:** `quikadmin/src/services/OCRService.ts:497-507`
- **Problem:** `estimateVLMConfidence()` starts at 85 with heuristic bumps. Fabricated confidence on hallucinated results.
- **Fix:** Lower baseline to 60, cap at 85 for heuristic estimates, add negative signals (short text, error keywords). Label as "estimated" in all outputs.

#### P1-10: OCR Worker Race Condition [RELIABILITY] [1-2 days]

- **Files:** `quikadmin/src/services/OCRService.ts`, `quikadmin/src/parsers/strategies/`
- **Problem:** `cleanup()` in `finally` block terminates singleton Tesseract worker during concurrent requests.
- **Fix:** Remove `cleanup()` from `finally`. Add reference counting. Consolidate OCRService + DocumentExtractionService workers into one managed singleton. Cleanup only at app shutdown.

#### P1-11: Stale Job Reconciliation [RELIABILITY] [4 hrs]

- **Problem:** Documents stuck in `PROCESSING` forever after worker crash.
- **Fix:** New `staleJobReconciler.ts` cron service. Every 15 minutes, reset documents processing > 30 minutes to `FAILED`.
- **Integration:** Wire into `src/index.ts` app lifecycle.

#### P1-12: Queue Name Collision [DATA CORRUPTION] [2 hrs]

- **Files:** `quikadmin/src/queue/QueueService.ts:105`, `quikadmin/src/queues/ocrQueue.ts:322`
- **Problem:** Both create Bull queue named `'ocr-processing'` with different processors.
- **Fix:** Rename legacy queue in `QueueService.ts` to `'legacy-ocr-processing'` or deprecate `QueueService.ts` entirely.

#### P1-13: ClientProfile Audit Trail [COMPLIANCE] [1-2 days]

- **Problem:** No audit trail on the primary ClientProfile system.
- **Fix:** Create `ClientProfileAuditLog` Prisma model mirroring existing `ProfileAuditLog` pattern. Log field-level changes in `mergeToClientProfile` with old/new values, source, and document ID.
- **Depends on:** P0-5 (encryption must be in place first).

### Week 4: Extension Core Features

#### EXT-3: Profile Sync & Encrypted Storage [2-3 days]

- **Goal:** Fetch client profile data from backend and cache locally with encryption.
- **Features:**
  - Fetch profiles via `GET /api/users/me/profile` (or `/api/client-profiles`)
  - Encrypt profile data in `chrome.storage.local` using Web Crypto API (AES-GCM)
  - Auto-refresh profile data on extension open
  - Clear cached data on logout
  - Offline access to last-synced profile (read-only)
- **Storage model:**
  ```typescript
  interface CachedProfile {
    clientId: string;
    clientName: string;
    encryptedData: string; // AES-GCM encrypted profile fields
    lastSynced: number; // Unix timestamp
    version: number; // For conflict detection
  }
  ```

#### EXT-4: Intelligent Field Detection & Auto-Fill [2-3 days]

- **Goal:** Upgrade existing field detection from vanilla JS to typed, confidence-based system.
- **Features:**
  - Detect form fields by `name`, `id`, `label`, `placeholder`, `aria-label`, `autocomplete` attributes
  - Fuzzy matching between detected field names and profile field keys
  - Confidence indicator per field (green/yellow/red)
  - Click-to-confirm for low-confidence matches
  - Support for: text inputs, date pickers, dropdowns, radio buttons, checkboxes
  - Multi-step form awareness (detect form pages/tabs)
- **Migrate from:** `extension/lib/field-detector.js` (existing detection logic)

#### EXT-5: Multi-Profile Support [1-2 days]

- **Goal:** Support switching between multiple client profiles.
- **Features:**
  - Profile selector dropdown in popup
  - Quick-switch keyboard shortcut
  - Per-profile fill history
  - Visual indicator of active profile in content script overlay

### Week 3-4 Success Criteria

| Metric                                 | Target                        |
| -------------------------------------- | ----------------------------- |
| P1 items completed                     | 8/8                           |
| OCR worker crashes under concurrency   | 0                             |
| Stale PROCESSING documents after crash | Auto-resolved within 15 min   |
| Extension field detection accuracy     | 90%+ on test form suite       |
| Extension profiles cached & encrypted  | Verified with Chrome DevTools |

---

## 4. Phase 3: Production Extension & P2 Hardening (Week 5-8)

> Harden remaining items, prepare extension for Chrome Web Store.

### Week 5-6: P2 Hardening (Selected Items)

#### P2-14: Confidence-Gated Profile Overwrites [4 hrs]

- **File:** `ClientDocumentFieldService.ts`
- Compare confidence before overwriting. Low-quality OCR should not silently replace correct data.

#### P2-15: MRZ Checksum Validation [1-2 days]

- Add `mrz` npm package. Cross-validate passport numbers, DOBs, and expiry dates against MRZ checksums.

#### P2-16: Adaptive Image Preprocessing [4 hrs]

- Replace fixed `threshold(128)` with Otsu's method for Tesseract. Send unthresholded images to VLM.

#### P2-17: Post-Fill PDF Verification [4 hrs]

- Re-load filled PDF and compare values against expected. Catch silent corruption from encoding/truncation.

#### P2-18: Date Format Conversion for Form Filling [1 day]

- Create `DateFormatService` with template-level target format config. Convert source dates to target format.

#### P2-19: Mapping Confidence Guardrails [1 day]

- Raise Levenshtein threshold above 0.5. Add semantic alias lists. Wire `ValidationService` into pipeline.

#### P2-20: Fix Fake Batch Embedding [2 hrs]

- **File:** `quikadmin/src/services/embedding.service.ts:644`
- Replace sequential embedding with Google's `batchEmbedContents` API. 100x speedup.

#### P2-21: Persist Embedding Quota [4 hrs]

- Move quota tracking from in-memory `Map` to Redis-backed counter.

#### P2-22: Organization-Level RLS for Knowledge Base [1-2 days]

- Enable RLS on `document_sources` and `document_chunks` tables. Add `organization_id` policies.

#### P2-23: Search Cache Invalidation After Processing [30 min]

- Add cache invalidation call after knowledge pipeline storage stage.

#### P2-24: Batch Size Limits [2 hrs]

- Max 50 documents per batch. 30-minute timeout. Backpressure when queue exceeds 200.

#### P2-25: Queue Deduplication [4 hrs]

- Apply deterministic job ID pattern from `ocrQueue` to knowledge and multiagent queues.

### Week 7-8: Extension Production Readiness

#### EXT-6: Chrome Web Store Packaging [2-3 days]

- **Deliverables:**
  - Privacy policy page
  - Chrome Web Store listing assets (screenshots, description, promo images)
  - Content Security Policy hardened for production
  - Remove all `http://localhost` references from manifest
  - Minified production build with source maps for debugging
  - Version management and changelog

#### EXT-7: Firefox Extension Support [2-3 days]

- **Goal:** Build for Firefox via WebExtension API compatibility.
- **Approach:** WXT/Plasmo natively supports multi-browser output. Main differences:
  - `browser.*` namespace (vs `chrome.*`)
  - Manifest V2 for Firefox (or V3 with polyfill)
  - `browser_specific_settings` in manifest for Firefox Add-ons
- **Test:** Validate on Firefox Developer Edition.

#### EXT-8: Error Reporting & Analytics [1-2 days]

- **Features:**
  - Sentry integration for error tracking (extension-compatible SDK)
  - Anonymous usage analytics (fill success rate, fields matched, time saved)
  - Opt-in telemetry with clear user consent
  - Extension health check (API connectivity, auth status, cache freshness)

#### EXT-9: Auto-Update Mechanism [1 day]

- Chrome Web Store handles auto-updates natively for listed extensions.
- For sideloaded/enterprise: implement `update_url` in manifest pointing to self-hosted update manifest.
- Version bump triggers: `npm version patch/minor` -> build -> zip -> upload.

#### EXT-10: E2E Testing [2-3 days]

- **Framework:** Playwright with Chrome extension loading or Puppeteer with `--load-extension`.
- **Test suite:**
  - Extension loads and popup renders
  - Login/logout flow
  - Profile sync from backend
  - Field detection on test HTML forms
  - Auto-fill with verification
  - Multi-profile switching
  - Error states (offline, expired token, API down)

### Week 5-8 Success Criteria

| Metric                                | Target                     |
| ------------------------------------- | -------------------------- |
| P2 items completed                    | 12/15                      |
| Extension Chrome Web Store submission | Submitted for review       |
| Extension Firefox Add-ons submission  | Submitted for review       |
| E2E test coverage                     | 15+ test scenarios passing |
| Form fill accuracy (E2E)              | 95%+ on test form suite    |
| Extension bundle size                 | < 500KB (excluding icons)  |

---

## 5. Dependencies & Risk Matrix

### Internal Dependencies

```
P0-5 (PII Encryption) ───> P1-13 (Audit Trail)
                       ───> P2-14 (Confidence-Gated Overwrites)

P0-3 (Pipeline Wiring) ──> P2-19 (Mapping Guardrails)
                        ──> P3 (Langfuse, cost budget, classification guard)

P1-8 (DateResolver)  ────> P2-18 (Date Format Conversion)

P0-1 + P0-2 (Security) ──> EXT-2 (Auth Integration)
                           (Must fix before extension connects to API)

EXT-1 (TS Foundation) ───> EXT-2 (API Client)
                      ───> EXT-3 (Profile Sync)
                      ───> EXT-4 (Field Detection)

EXT-2 (Auth) ────────────> EXT-3 (Profile Sync)
             ────────────> EXT-5 (Multi-Profile)
```

### Risk Matrix

| Risk                                                        | Likelihood | Impact   | Mitigation                                                                                               |
| ----------------------------------------------------------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------- |
| Multi-agent type mismatches block pipeline wiring           | Medium     | High     | Implementation specs include exact type adapters. Types are documented.                                  |
| Arabic OCR quality is low with Tesseract `eng+ara`          | Medium     | Medium   | VLM path (Gemini) handles Arabic well. Tesseract is fallback only.                                       |
| Encryption migration corrupts existing profile data         | Low        | Critical | Migration script has dry-run mode. Backward-compatible reader handles both encrypted and legacy formats. |
| Extension build system choice delays TypeScript migration   | Low        | Medium   | WXT is well-documented for Manifest V3. Fallback: plain Vite with `@crxjs/vite-plugin`.                  |
| Chrome Web Store review rejection                           | Medium     | Low      | No high-risk permissions requested. Privacy policy prepared. Multiple submission attempts expected.      |
| Queue name collision causes data corruption during rename   | Low        | High     | Deploy during maintenance window. Drain legacy queue before rename.                                      |
| VLM confidence recalibration causes user-facing score drops | High       | Low      | Expected and desired. Communicate that lower scores are more honest, not worse quality.                  |

---

## 6. Success Metrics

### Phase 1 (Week 1-2) KPIs

| Metric                            | Baseline   | Target                   | How to Measure                          |
| --------------------------------- | ---------- | ------------------------ | --------------------------------------- |
| Critical security vulnerabilities | 2          | 0                        | Adversarial test suite                  |
| Pipeline extraction success rate  | 0% (stubs) | > 80% on test docs       | Pipeline E2E test with 10 UAE documents |
| Arabic text extraction            | 0%         | > 70% character accuracy | Test with 5 Emirates ID images          |
| Extension TypeScript coverage     | 0%         | 100% of source files     | `tsc --noEmit` succeeds                 |

### Phase 2 (Week 3-4) KPIs

| Metric                         | Baseline | Target                       | How to Measure                               |
| ------------------------------ | -------- | ---------------------------- | -------------------------------------------- |
| P1 items completed             | 0/8      | 8/8                          | Task Master status                           |
| Stale job auto-recovery        | Never    | < 30 min                     | Monitor reconciler logs                      |
| Form fill "null" occurrences   | Unknown  | 0                            | Grep filled PDFs in test suite               |
| Extension field match accuracy | N/A      | 90%+                         | Test against 5 UAE government form templates |
| Extension auth flow            | None     | Login/logout/refresh working | Manual QA + E2E test                         |

### Phase 3 (Week 5-8) KPIs

| Metric                              | Baseline                 | Target                | How to Measure             |
| ----------------------------------- | ------------------------ | --------------------- | -------------------------- |
| P2 items completed                  | 0/12                     | 10/12                 | Task Master status         |
| Overall trustworthiness score       | C (avg)                  | B+ (avg)              | Scorecard reassessment     |
| Extension Chrome Web Store          | Not submitted            | Approved              | Chrome Developer Dashboard |
| Extension E2E tests                 | 0                        | 15+ scenarios         | CI pipeline                |
| Embedding throughput                | ~2 docs/min (sequential) | ~100 docs/min (batch) | Benchmark test             |
| Knowledge base cross-tenant leakage | Possible                 | Impossible (RLS)      | Adversarial RLS test       |

### Overall Program Metrics

| Metric                               | Target                   | Timeline      |
| ------------------------------------ | ------------------------ | ------------- |
| P0 items resolved                    | 5/5                      | End of Week 1 |
| P1 items resolved                    | 8/8                      | End of Week 4 |
| P2 items resolved                    | 10/12                    | End of Week 8 |
| Extension public beta                | Chrome Web Store listing | End of Week 8 |
| Adversarial test coverage            | 25+ test scenarios       | End of Week 8 |
| Zero critical/high security findings | Verified by rescan       | End of Week 2 |

---

## 7. P3 Backlog (Post-Week 8)

Items deferred to future sprints. Prioritize based on user feedback and production incidents.

| #   | Item                                           | Feature          | Effort | Notes                                    |
| --- | ---------------------------------------------- | ---------------- | ------ | ---------------------------------------- |
| 29  | Wire agents to unified LLM client              | Multi-Agent      | M      | Reduces vendor lock-in                   |
| 30  | Set temperature=0 for deterministic extraction | Multi-Agent      | S      | Prerequisite for A/B testing             |
| 31  | Classification confidence guard                | Multi-Agent      | M      | Prevents misclassification cascade       |
| 32  | Langfuse tracing integration                   | Multi-Agent      | M      | Observability for pipeline costs/latency |
| 33  | Pipeline cost budget with hard cap             | Multi-Agent      | S      | Prevents runaway token spend             |
| 34  | Deprecate UserProfile system                   | Client Profiles  | S-L    | After ClientProfile is fully hardened    |
| 35  | Harden PersonGrouping for common Arabic names  | Client Profiles  | M      | Prevent false merges                     |
| 36  | Cross-encoder re-ranking for search            | Knowledge Base   | L      | Quality improvement for RAG              |
| 37  | Dead letter queue for poison pills             | Batch Processing | M      | Prevent retry storms                     |
| 38  | Unified shutdown manager                       | Batch Processing | M      | Clean multi-queue shutdown               |
| 39  | Queue observability dashboard                  | Batch Processing | M      | Operational visibility                   |
| 40  | Act on critical anomaly alerts                 | RBAC             | M      | Security monitoring                      |
| 41  | Document expiry tracking                       | Client Profiles  | S      | Flag expired passport/visa data          |
| 42  | Harden document sharing                        | RBAC             | M      | Org boundaries, rate limits              |
| 43  | Unified field key registry                     | Client Profiles  | M      | Single canonical field naming            |

---

## 8. Reference Documents

| Document                  | Path                                                           | Purpose                                                     |
| ------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| Product Hardening Dossier | `docs/research/product-hardening-dossier-2026.md`              | Full audit of 40 hardening items across 7 features          |
| Implementation Specs      | `docs/research/product-hardening-implementation-specs-2026.md` | Line-level code changes for 20 items with adversarial tests |
| RBAC Hardening            | `docs/research/rbac-multi-tenant-hardening-2026.md`            | Deep dive on auth, multi-tenancy, data isolation            |
| LLM Extraction Research   | `docs/research/llm-data-extraction-2026.md`                    | 2026 state-of-art for extraction architectures              |
| Extension Prototype       | `extension/`                                                   | Existing vanilla JS Chrome extension (~2,500 lines)         |

---

_This roadmap is a living document. Update weekly as items are completed, blocked, or reprioritized._
_Generated 2026-02-08 by Product Manager agent from hardening dossier + extension analysis._

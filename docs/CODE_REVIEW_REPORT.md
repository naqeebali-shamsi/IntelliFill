# Code Review Report: Product Hardening Implementation

**Reviewer:** AI Code Reviewer (Opus 4.6)
**Date:** 2026-02-08
**Scope:** ~20 changes from the Product Hardening Dossier implementation session
**Verdict:** Several critical issues found that must be addressed before merging

---

## 1. Critical Issues (MUST FIX)

### CRITICAL-1: Dead validRoles Check Still Allows admin Validation Messaging Leak

**File:** quikadmin/src/api/supabase-auth.routes.ts, lines 269-274
**Severity:** Medium-High (security hardening incomplete)

The role variable is now correctly hardcoded to user at line 239. However, the old validation block at lines 269-274 is dead code that still references the validRoles array containing admin. Since role is now always user, this condition can never trigger. It leaks information that admin is a valid role in the error message and is confusing dead code.

**Recommended Fix:** Remove lines 269-274 entirely.

---

### CRITICAL-2: RegisterRequest Interface Still Declares role as Accepted Input

**File:** quikadmin/src/api/supabase-auth.routes.ts, line 161
**Severity:** Medium (misleading API contract)

The RegisterRequest interface still includes role?: string. Any developer or API doc generator would think role is an accepted input parameter.

## **Recommended Fix:** Remove role?: string from the RegisterRequest interface.

### CRITICAL-3: DateResolver Two-Digit Year Handling Always Assumes 2000s

**File:** quikadmin/src/services/DateResolver.ts, line 57
**Severity:** High (data corruption for historical dates)

The code 2000 + parseInt(yearStr, 10) means a passport with birth date 15/03/65 resolves to year 2065 instead of 1965. For a document processing system handling passports and IDs, many dates of birth will have two-digit years in the 1900s range.

**Recommended Fix:** Apply a pivot-year heuristic -- if two-digit year > current short year + 10, assume 1900s; otherwise assume 2000s.

---

### CRITICAL-4: DateResolver Not Integrated Into Any Pipeline

**File:** quikadmin/src/services/DateResolver.ts
**Severity:** High (feature exists but is unused)

A grep across the entire src/ directory shows NO other file imports or calls resolveDate. The spec states it should be called in ClientDocumentFieldService.ts during mergeToClientProfile. Without integration, ambiguous dates remain unfixed.

**Recommended Fix:** Import and call resolveDate() in ClientDocumentFieldService.ts during the merge loop for date fields.

---

### CRITICAL-5: RLS Migration May Block All Knowledge Base Queries

**File:** quikadmin/prisma/migrations/20260208000000_add_org_rls_knowledge_base/migration.sql
**Severity:** High (potential service outage)

The RLS policies use get_current_org_id() which returns NULL if the session variable is not set. organization_id = NULL in SQL is always FALSE, meaning any code path that queries knowledge base tables without calling set_org_context() will silently return zero rows. Only ONE file (organizationContext.ts line 294) calls set_org_context(). Background workers, cron jobs, and migration scripts will fail silently.

**Recommended Fix:** (1) Audit all code paths querying document_sources/document_chunks, (2) Consider a fallback for system processes, (3) Add integration tests.

---

### CRITICAL-6: Confidence-Gated Overwrite Compares Incompatible Types

**File:** quikadmin/src/services/ClientDocumentFieldService.ts, lines 162-170
**Severity:** Medium-High (logic bug, feature inoperative)

The value parameter is typically a plain string, not an object with .confidence. So newConfidence is almost always null, meaning the confidence gate never triggers. The stored confidence will also always be null, making the entire P2-1 feature inoperative.

## **Recommended Fix:** Refactor the method signature to accept confidence scores separately from field values.

## 2. Security Concerns

### SEC-1: Registration Privilege Escalation -- FIXED (Verified)

**File:** quikadmin/src/api/supabase-auth.routes.ts, lines 229-239
**Status:** FIXED correctly. Role hardcoded to user. See CRITICAL-1/2 for cleanup.

### SEC-2: Demo Mode Backdoor -- FIXED (Verified)

**File:** quikadmin/src/api/supabase-auth.routes.ts, line 1140
**Status:** FIXED correctly. Condition is now !== true (opt-in).

### SEC-3: ClientProfile PII Encryption -- FIXED (Verified)

**Files:** ClientDocumentFieldService.ts and client-profile.routes.ts
**Status:** All 7 read/write points verified. All encrypt on write and decrypt on read with backward compatibility for 3 data formats. No missed read points found.

### SEC-4: Organization Role Change Endpoints -- Properly Protected

**File:** quikadmin/src/api/organization.routes.ts, lines 490 and 826
**Status:** Protected by authenticateSupabase, requireOrgAdmin, and Joi validation. No issue.

### SEC-5: Auto-Lock Dynamic Import in Middleware

**File:** quikadmin/src/middleware/auditLogger.ts, lines 458-474
**Status:** Dynamic import is safe. Minor concern: alert.userId could be null for system-generated alerts -- add a null check before prisma.user.update.

---

## 3. Warnings (Should Fix)

### WARN-1: Stale Job Reconciler Does Not Store Failure Reason

**File:** quikadmin/src/services/staleJobReconciler.ts, lines 27-29
Only sets status: FAILED without any error message. Add an errorMessage field.

### WARN-2: Workflow extractNode Does Not Pass Available Image Data

**File:** quikadmin/src/multiagent/workflow.ts, line 151
The imageBase64 parameter is always undefined, degrading VLM extraction quality.

### WARN-3: Workflow routeAfterErrorRecovery Always Routes to EXTRACT

**File:** quikadmin/src/multiagent/workflow.ts, lines 529-542
The error recovery node determines the correct retry target, but the graph conditional edge always routes to EXTRACT, ignoring the node decision.

### WARN-4: ClientProfileAuditLog.changedBy Is Always NULL

**File:** quikadmin/src/services/ClientDocumentFieldService.ts, lines 174-183
Audit entries never populate changedBy. Add a userId parameter to the merge methods.

### WARN-5: Batch Embedding -- No Chunk Size Limit on API Call

**File:** quikadmin/src/services/embedding.service.ts, lines 714-729
generateBatchWithRetry sends all texts in a single API call. Google has batch limits (typically 100). Add sub-chunking.

### WARN-6: ISO Date Passthrough Does Not Validate Date Components

**File:** quikadmin/src/services/DateResolver.ts, lines 40-48
Accepts any YYYY-M-D pattern without validating month (1-12) or day ranges. 2026-13-45 returns confidence 100.

---

## 4. Missing Test Coverage

| ID     | Missing Test                                                           | Priority |
| ------ | ---------------------------------------------------------------------- | -------- |
| TEST-1 | DateResolver unit tests (two-digit years, ambiguous dates, edge cases) | Critical |
| TEST-2 | Confidence-gated overwrite tests                                       | High     |
| TEST-3 | ClientProfileAuditLog creation tests                                   | High     |
| TEST-4 | RLS policy integration tests                                           | High     |
| TEST-5 | Stale job reconciler tests                                             | Medium   |
| TEST-6 | Adversarial test suite (7 files specified in spec, none created)       | High     |

---

## 5. Approved Changes (Verified Correct)

| ID          | Change                        | File                                         | Status                        |
| ----------- | ----------------------------- | -------------------------------------------- | ----------------------------- |
| APPROVED-1  | Demo Mode Opt-In Fix          | supabase-auth.routes.ts:1140                 | Correct                       |
| APPROVED-2  | Registration Role Hardcoding  | supabase-auth.routes.ts:229-239              | Correct (minor cleanup)       |
| APPROVED-3  | FormFiller Null Guard         | FormFiller.ts:71-75                          | Correct                       |
| APPROVED-4  | XFA/Flat PDF Detection        | FormFiller.ts:55-66, 405-414                 | Correct (both methods)        |
| APPROVED-5  | Arabic OCR Support            | OCRService.ts:244, 255-260                   | Correct                       |
| APPROVED-6  | VLM Confidence Fix            | OCRService.ts:497-527                        | Correct (baseline 60, cap 85) |
| APPROVED-7  | Multi-Agent Pipeline Wiring   | workflow.ts (all 4 nodes)                    | Correct                       |
| APPROVED-8  | Queue Name Collision Fix      | QueueService.ts:105                          | Correct                       |
| APPROVED-9  | Batch Size Limit              | QueueService.ts:259-268                      | Correct (MAX=50)              |
| APPROVED-10 | Stale Job Reconciler + Wiring | staleJobReconciler.ts, index.ts              | Correct                       |
| APPROVED-11 | Batch Embedding               | embedding.service.ts:714-729                 | Correct                       |
| APPROVED-12 | ClientProfile Audit Trail     | schema.prisma, ClientDocumentFieldService.ts | Correct                       |
| APPROVED-13 | OCR Worker Race Condition Fix | PDFParsingStrategy.ts:77                     | Correct                       |
| APPROVED-14 | RLS Migration SQL             | migration.sql                                | Correct syntax                |
| APPROVED-15 | Post-Fill PDF Verification    | FormFiller.ts:563-611                        | Correct                       |

---

## Summary

| Category          | Count | Status                            |
| ----------------- | ----- | --------------------------------- |
| Critical Issues   | 6     | Must fix before merge             |
| Security Concerns | 5     | 4 verified fixed, 1 minor concern |
| Warnings          | 6     | Should fix soon                   |
| Missing Tests     | 6     | Urgently needed                   |
| Approved Changes  | 15    | Verified correct                  |

### Top 3 Priorities Before Merge

1. **CRITICAL-3:** Fix DateResolver two-digit year handling -- will corrupt birth dates for anyone born before 2000
2. **CRITICAL-5:** Verify all knowledge base query paths call set_org_context() -- RLS could silently break knowledge base features
3. **CRITICAL-4:** Integrate DateResolver into the pipeline -- without integration, the entire DateResolver feature is dead code

### Recommended Pre-Merge Checklist

- [ ] Remove dead validRoles block and role from RegisterRequest interface (CRITICAL-1, CRITICAL-2)
- [ ] Fix two-digit year pivot logic in DateResolver (CRITICAL-3)
- [ ] Integrate DateResolver into ClientDocumentFieldService (CRITICAL-4)
- [ ] Audit all knowledge base query paths for org context (CRITICAL-5)
- [ ] Refactor confidence-gating to use separate confidence parameter (CRITICAL-6)
- [ ] Add error message to stale job reconciler updates (WARN-1)
- [ ] Add null check for alert.userId in auto-lock (SEC-5)
- [ ] Create at minimum the DateResolver and auth adversarial test suites (TEST-1, TEST-6)

---

_Generated by AI Code Reviewer on 2026-02-08_

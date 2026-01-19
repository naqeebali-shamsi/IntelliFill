# Phase 2: Coverage Validation Report

**Generated:** 2026-01-09
**Project:** IntelliFill
**Input Files:**
- Registry: `phase1-element-registry.json` (186 elements)
- Summary: `phase1-summary.md`
- Repo Snapshot: `phase0-repo-conventions-snapshot.md`

---

## 1. Route Coverage Matrix

### Routes Defined in App.tsx vs Registry Coverage

| Route | App.tsx | Registry Elements | Status |
|-------|---------|-------------------|--------|
| `/login` | Yes | 4 | Adequate |
| `/register` | Yes | 4 | Adequate |
| `/forgot-password` | Yes | 2 | **Under-covered** (only 2 elements) |
| `/reset-password` | Yes | 2 | **Under-covered** (only 2 elements) |
| `/verify-email` | Yes | 2 | **Under-covered** (only 2 elements) |
| `/auth/callback` | Yes | 1 | **Minimal** (auto-redirect handler) |
| `/accept-invite` | Yes | 2 | **Under-covered** (only 2 elements) |
| `/forbidden` | Yes | 0 | **Missing** (error page with navigation) |
| `/dashboard` | Yes | 8 | Adequate |
| `/upload` | Yes | 6 | Adequate |
| `/documents` | Yes | 18 | Good |
| `/history` | Yes | 3 | Adequate |
| `/job/:jobId` | Yes | 6 | Adequate |
| `/profiles` | Yes | 14 | Good |
| `/profiles/:id` | Yes | 15 | Good |
| `/templates` | Yes | 18 | Good |
| `/templates/new` | Yes | 7 | Adequate |
| `/templates/:id/edit` | Yes | 7 | Adequate |
| `/fill-form` | Yes | 4 | Adequate |
| `/demo/autocomplete` | Yes | 3 | Adequate |
| `/filled-forms` | Yes | 7 | Adequate |
| `/settings` | Yes | 15 | Good |
| `/knowledge` | **No** | 6 | **Route Missing from App.tsx** |
| `/*` (NotFound) | Yes | 0 | **Missing** (error page with navigation) |
| `global` | N/A | 32 | Good (shared components) |

### Routes with < 3 Elements (Flagged for Review)

1. **`/forgot-password`** (2 elements) - May have additional click handlers for "Back to Login" link
2. **`/reset-password`** (2 elements) - Minimal page, coverage may be adequate
3. **`/verify-email`** (2 elements) - Has resend button, coverage adequate
4. **`/auth/callback`** (1 element) - Auto-redirect, no interactive elements expected
5. **`/accept-invite`** (2 elements) - May have decline/cancel actions
6. **`/forbidden`** (0 elements) - Should have "Go Back" or "Return Home" navigation
7. **`/*` NotFoundPage** (0 elements) - Should have "Return Home" navigation

### Critical Finding: `/knowledge` Route Missing

The registry contains 6 elements for `/knowledge` route, but **App.tsx does not define this route**. The `KnowledgeBase.tsx` page exists in `src/pages/` but is not wired into the router.

**Affected Elements:**
- `knowledge-base-refresh`
- `knowledge-base-upload`
- `knowledge-base-delete-dialog`
- `knowledge-base-delete`
- `knowledge-search-toggle-hybrid`
- `knowledge-search-submit`
- `knowledge-search-clear`

**Action Required:** Either add route to App.tsx or remove from registry if feature is disabled.

---

## 2. Component Coverage Summary

### Elements by Component Area

| Area | Files Scanned | Elements Found | Coverage |
|------|---------------|----------------|----------|
| `pages/` | 35 files | 102 | Good |
| `components/features/` | ~45 files | 64 | Good |
| `components/ui/` | ~50 files | 8 | Adequate (mostly passive) |
| `components/layout/` | ~5 files | 4 | Adequate |
| `components/knowledge/` | 2 files | 2 | Adequate |
| `hooks/` | 15 files | 6 | Adequate (mutations) |
| `stores/` | 15 files | 4 | Adequate (actions) |

### Components with Unregistered Handlers

Files with `onClick` handlers (250 total occurrences) not all captured:

| Component File | onClick Count | Registered | Gap |
|----------------|--------------|------------|-----|
| `ProfileList.tsx` | 16 | 14 | 2 possible gaps |
| `OrganizationTabContent.tsx` | 10 | 7 | **3 gaps** |
| `bulk-actions-toolbar.tsx` | 8 | 5 | 3 possible gaps |
| `data-table.tsx` | 8 | 6 | 2 possible gaps |
| `TemplateCard.tsx` | 8 | 5 | 3 possible gaps |
| `FilledFormHistory.tsx` | 7 | 7 | Fully covered |
| `profile-fields-manager.tsx` | 9 | 5 | **4 gaps** |

### Components with `onSubmit` Forms

All 13 files with `onSubmit` handlers are represented in the registry:
- `Login.tsx`, `Register.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, `VerifyEmail.tsx`
- `Settings.tsx`, `ProfileDetail.tsx`, `ProfileSettings.tsx`
- `InviteMemberModal.tsx`, `profile-form-modal.tsx`, `profile-fields-manager.tsx`
- `TemplateEditor.tsx`, `FormFillDemo.tsx`

### TanStack Query Mutation Coverage

All 13 files with `useMutation` hooks are represented:
- `TemplateLibrary.tsx`, `Settings.tsx`, `FilledFormHistory.tsx`
- `AcceptInvitePage.tsx`, `ProfileList.tsx`, `ProfileDetail.tsx`
- `Templates.tsx`, `ProfileSettings.tsx`
- `profile-fields-manager.tsx`, `template-manager.tsx`, `profile-form-modal.tsx`
- `hooks/useFetch.ts`, `hooks/useDocumentActions.ts`

---

## 3. API Coverage Check

### Backend API Endpoints vs UI Elements

| API Endpoint | UI Elements | Coverage Status |
|--------------|-------------|-----------------|
| **Auth (`/api/auth/v2/`)** | | |
| `POST /login` | 1 | Covered |
| `POST /register` | 1 | Covered |
| `POST /logout` | 1 | Covered |
| `POST /forgot-password` | 2 | Covered |
| `POST /reset-password` | 1 | Covered |
| `POST /verify-email` | 1 | Covered |
| `POST /resend-verification` | 1 | Covered |
| `POST /demo` | 1 | Covered |
| **Documents (`/api/documents/`)** | | |
| `GET /documents` | 1 | Covered |
| `GET /documents/:id` | 1 | Covered |
| `GET /documents/:id/download` | 3 | Covered |
| `POST /documents` | 2 | Covered |
| `POST /documents/:id/reprocess` | 3 | Covered |
| `POST /documents/reprocess/batch` | 1 | Covered |
| `DELETE /documents/:id` | 3 | Covered |
| `DELETE /documents/batch` | 2 | Covered |
| **Clients/Profiles (`/api/clients/`)** | | |
| `GET /clients` | 1 | Covered |
| `GET /clients/:id` | 1 | Covered |
| `POST /clients` | 2 | Covered |
| `PUT /clients/:id` | 4 | Covered |
| `PUT /clients/:id/profile` | 2 | Covered |
| `PUT /clients/:id/archive` | 2 | Covered |
| `PUT /clients/:id/restore` | 2 | Covered |
| `DELETE /clients/:id` | 4 | Covered |
| **Templates (`/api/templates/`)** | | |
| `GET /templates` | 1 | Covered |
| `GET /templates/:id` | 1 | Covered |
| `POST /templates` | 4 | Covered |
| `PUT /templates/:id` | 1 | Covered |
| `POST /templates/:id/duplicate` | 2 | Covered |
| `POST /templates/:id/use` | 2 | Covered |
| `DELETE /templates/:id` | 5 | Covered |
| **Filled Forms (`/api/filled-forms/`)** | | |
| `GET /filled-forms` | 1 | Covered |
| `GET /filled-forms/:id` | 1 | Covered |
| `GET /filled-forms/:id/download` | 1 | Covered |
| `POST /filled-forms/generate` | 1 | Covered |
| `POST /filled-forms/preview` | 1 | Covered |
| `POST /filled-forms/save-adhoc` | 1 | Covered |
| `DELETE /filled-forms/:id` | 2 | Covered |
| **Organizations (`/api/organizations/`)** | | |
| `POST /organizations` | 1 | Covered |
| `PUT /organizations/:id` | 1 | Covered |
| `POST /organizations/:id/leave` | 1 | Covered |
| `DELETE /organizations/:id` | 1 | Covered (owner-only) |
| `DELETE /organizations/:id/members/:userId` | 1 | Covered |
| **Knowledge (`/api/knowledge/`)** | | |
| `GET /knowledge/sources` | 1 | **Route not in App.tsx** |
| `POST /knowledge/sources/upload` | 1 | **Route not in App.tsx** |
| `POST /knowledge/search` | 1 | **Route not in App.tsx** |
| `DELETE /knowledge/sources/:id` | 1 | **Route not in App.tsx** |
| **User Profile (`/api/users/`)** | | |
| `GET /users/me/profile` | 1 | Covered |
| `PUT /users/me/profile` | 2 | Covered |
| `DELETE /users/me/profile` | 1 | Covered |
| **Processing (`/api/process/`)** | | |
| `POST /process/single` | 0 | **Missing** |
| `POST /process/multiple` | 0 | **Missing** |
| `POST /process/batch` | 0 | **Missing** |
| `POST /form/fields` | 0 | **Missing** |
| `POST /validate` | 0 | **Missing** |
| **Admin (`/api/admin/security/`)** | | |
| Security dashboard endpoints | 0 | **No UI - Admin only** |
| **E2E (`/api/e2e/`)** | | |
| Test endpoints | 0 | **Test-only - no UI needed** |
| **Other** | | |
| `GET /api/health` | 0 | Internal |
| `GET /api/ready` | 0 | Internal |
| `GET /api/realtime` (SSE) | 0 | Background connection |

### Missing API-to-UI Mappings

1. **Processing Endpoints** (`/api/process/*`) - These are backend processing APIs that may be called programmatically but lack direct UI buttons. They're used through:
   - File upload flows (documents)
   - Form filling workflows (SimpleFillForm)

2. **Admin Security Dashboard** (`/api/admin/security/*`) - No frontend UI exists. This is an administrative backend-only feature.

3. **Knowledge Base Route** - Elements exist but route is not in App.tsx

---

## 4. Identified Blind Spots

### 4.1 Config-Driven / Dynamic UI Elements

| Feature Flag | Status | Impact |
|--------------|--------|--------|
| `VITE_ENABLE_DEMO` | Documented | Demo login button visibility |
| `VITE_USE_BACKEND_AUTH` | Documented | Auth mode selection |
| `VITE_ENABLE_KNOWLEDGE_BASE` | Documented but not implemented | Knowledge route disabled? |
| `VITE_ENABLE_DOCUMENT_CHAT` | Documented but not implemented | Potential feature |
| `VITE_ENABLE_BULK_PROCESSING` | Documented but not implemented | Bulk actions visibility |
| `VITE_ENABLE_EXPORT` | Documented but not implemented | Export functionality |

**How to Confirm:** Check `.env` files and search for `import.meta.env.VITE_ENABLE_*` usage in components.

### 4.2 Remote / Deferred-Loaded Components

| Component | Loading Strategy | Registry Status |
|-----------|-----------------|-----------------|
| All page components | `lazy()` import | Covered |
| No dynamic remote loading detected | N/A | N/A |

**Status:** All lazy-loaded components are discovered via static analysis.

### 4.3 Feature-Flagged Elements

| Element | Gate Condition | Registry Status |
|---------|---------------|-----------------|
| Demo Login | `VITE_ENABLE_DEMO=true` | Covered (`auth-demo-login`) |
| Knowledge Base | Potentially flagged | **Route missing from App.tsx** |

**How to Confirm:** Search for conditional rendering based on `import.meta.env.VITE_*` variables.

### 4.4 Role-Gated / Admin-Only Elements

| Feature | Role Required | Registry Status |
|---------|--------------|-----------------|
| Delete Organization | `OWNER` | Covered (`org-delete`) |
| Remove Member | `ADMIN` or `OWNER` | Covered (`members-list-remove`) |
| Change Member Role | `ADMIN` or `OWNER` | **Missing** |
| Security Dashboard | Backend admin | **No UI exists** |
| Invite Member | `ADMIN` or `OWNER` | Covered |

**Missing Element:** `members-list-change-role`
- Location: `MembersList.tsx:139`
- Handler: `changeMemberRole()`
- API: `PUT /api/organizations/:id/members/:userId/role`

### 4.5 Mobile-Specific Interactions

| Interaction | Registry Status |
|-------------|-----------------|
| Mobile sidebar toggle | Covered (`sidebar-mobile-open`) |
| Mobile card view | Implicit in grid/table toggles |
| Touch gestures | Not detected |
| Swipe actions | Not detected |

**Status:** No mobile-specific swipe or gesture handlers found.

### 4.6 Keyboard-Only Interactions

| Component | Keyboard Handler | Registry Status |
|-----------|-----------------|-----------------|
| `autocomplete-field.tsx` | `onKeyDown` | Covered implicitly |
| `file-upload-zone.tsx` | `onKeyDown` | Covered implicitly |
| `FilledFormHistory.tsx` | `onKeyDown` | Covered implicitly |
| `SearchInterface.tsx` | `onKeyDown` | Covered implicitly |
| `profile-field-editor.tsx` | `onKeyDown` | Covered implicitly |
| `profile-fields-manager.tsx` | `onKeyDown` | Covered implicitly |

**Status:** Keyboard handlers support existing click-based interactions; no unique keyboard-only actions.

### 4.7 Drag-and-Drop Interactions

| Component | DnD Library | Registry Status |
|-----------|------------|-----------------|
| `file-upload-zone.tsx` | react-dropzone | Covered (`upload-file-drop`) |
| `AvatarUpload.tsx` | Native drag | Covered (`upload-avatar-drop`) |

**Status:** All drag-drop interactions are covered.

### 4.8 Error Page Navigation

| Page | Expected Elements | Registry Status |
|------|------------------|-----------------|
| `NotFoundPage.tsx` | "Return Home" button | **Missing** |
| `ForbiddenPage.tsx` | "Go Back" or "Return Home" | **Missing** |
| `ErrorBoundary.tsx` | Reset/Home buttons | Covered |

**Missing Elements:**
1. `not-found-return-home` - Navigation from 404 page
2. `forbidden-return-home` - Navigation from 403 page

---

## 5. Recommendations for Additional Discovery

### High Priority

1. **Add `/knowledge` route to App.tsx** or document why it's disabled
   - Check if `VITE_ENABLE_KNOWLEDGE_BASE` flag controls this
   - If disabled, mark knowledge elements as feature-gated

2. **Add missing elements:**
   - `members-list-change-role` - MembersList.tsx role change dropdown
   - `not-found-return-home` - NotFoundPage.tsx navigation
   - `forbidden-return-home` - ForbiddenPage.tsx navigation

3. **Review OrganizationTabContent.tsx** - 3 gap onClick handlers
   - May include: edit mode toggle, cancel edit, other actions

4. **Review profile-fields-manager.tsx** - 4 gap onClick handlers
   - May include: field type selection, validation toggles, etc.

### Medium Priority

5. **Document feature flag dependencies:**
   - Create mapping of which elements require which `VITE_*` flags
   - Add conditional gating notes to registry

6. **API processing endpoints:**
   - Determine if `/api/process/*` endpoints need UI elements
   - May be called internally by existing upload/fill workflows

7. **Admin security dashboard:**
   - If admin UI is planned, document pending elements
   - If backend-only, document as out-of-scope for UI testing

### Low Priority

8. **Templates.tsx vs TemplateLibrary.tsx:**
   - Both files exist with similar functionality
   - Clarify which is canonical route handler

9. **ProfileSettings.tsx:**
   - Exists in pages/ but not in App.tsx routes
   - May be embedded in Settings.tsx as a tab

---

## 6. Summary Statistics

| Metric | Count |
|--------|-------|
| Total Routes in App.tsx | 21 |
| Routes with Registry Elements | 19 |
| Routes Missing Coverage | 2 (`/forbidden`, `/*`) |
| Orphaned Route in Registry | 1 (`/knowledge`) |
| Total Elements in Registry | 186 |
| Elements with High Confidence | 172 (92.5%) |
| Elements with Medium Confidence | 14 (7.5%) |
| API Endpoints Covered | ~45 |
| API Endpoints Missing UI | ~8 (mostly backend-only) |
| Identified Blind Spots | 8 categories |
| Missing Elements to Add | 3-4 |

---

## 7. Files Generated

- `phase2-coverage-report.md` - This coverage validation report

---

**Validation Method:** Cross-referenced App.tsx routes, grep patterns for handlers, backend routes.ts, and service files against phase1-element-registry.json.

**Next Phase:** Test coverage mapping - identify which discovered elements have E2E test coverage.

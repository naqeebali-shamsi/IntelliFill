# Phase 3: Portfolio Triage & Batch Plan

**Generated:** 2026-01-09
**Project:** IntelliFill
**Input Files:**
- Registry: `phase1-element-registry.json` (186 elements)
- Coverage Report: `phase2-coverage-report.md`

---

## 1. Priority Score Table (Top 50 Elements)

**Scoring Formula:**
`Priority = (Impact x3) + (Risk x2) + (Frequency x1) + (Architectural x2) - (Complexity x1)`

| Rank | Element ID | Domain | Impact | Risk | Freq | Arch | Cmplx | Score |
|------|-----------|--------|--------|------|------|------|-------|-------|
| 1 | `auth-login-form` | Auth | 5 | 5 | 5 | 5 | 2 | **38** |
| 2 | `auth-register-form` | Auth | 5 | 5 | 4 | 5 | 3 | **36** |
| 3 | `auth-logout` | Auth | 4 | 5 | 5 | 5 | 1 | **36** |
| 4 | `upload-file-drop` | Documents | 5 | 4 | 5 | 4 | 2 | **34** |
| 5 | `profile-form-modal-submit` | Profiles | 5 | 4 | 4 | 4 | 3 | **32** |
| 6 | `org-delete` | Settings | 4 | 5 | 1 | 5 | 2 | **31** |
| 7 | `template-editor-submit` | Templates | 5 | 4 | 4 | 4 | 4 | **31** |
| 8 | `document-delete-mutation` | Documents | 4 | 5 | 4 | 3 | 2 | **30** |
| 9 | `members-list-confirm-remove` | Settings | 4 | 5 | 2 | 4 | 2 | **30** |
| 10 | `auth-forgot-password-form` | Auth | 4 | 4 | 3 | 4 | 2 | **29** |
| 11 | `profile-delete-mutation` | Profiles | 4 | 5 | 3 | 3 | 2 | **29** |
| 12 | `template-library-delete-mutation` | Templates | 4 | 5 | 3 | 3 | 2 | **29** |
| 13 | `invite-member-modal-submit` | Settings | 4 | 4 | 3 | 4 | 2 | **29** |
| 14 | `document-bulk-delete-mutation` | Documents | 4 | 5 | 3 | 3 | 3 | **28** |
| 15 | `auth-reset-password-form` | Auth | 4 | 4 | 2 | 4 | 2 | **28** |
| 16 | `profile-detail-save` | Profiles | 4 | 4 | 4 | 3 | 2 | **28** |
| 17 | `simple-fill-continue` | Forms | 5 | 3 | 4 | 4 | 3 | **28** |
| 18 | `invite-accept-mutation` | Auth | 4 | 4 | 2 | 4 | 2 | **27** |
| 19 | `auth-verify-email-form` | Auth | 4 | 4 | 2 | 4 | 2 | **27** |
| 20 | `org-leave` | Settings | 4 | 4 | 2 | 4 | 2 | **27** |
| 21 | `document-detail-download` | Documents | 4 | 3 | 4 | 3 | 2 | **26** |
| 22 | `auth-resend-verification` | Auth | 3 | 3 | 3 | 4 | 1 | **26** |
| 23 | `filled-forms-confirm-delete` | Forms | 4 | 5 | 2 | 2 | 2 | **26** |
| 24 | `upload-retry` | Documents | 4 | 3 | 3 | 3 | 2 | **25** |
| 25 | `document-reprocess-mutation` | Documents | 4 | 3 | 3 | 3 | 2 | **25** |
| 26 | `auth-demo-login` | Auth | 3 | 3 | 3 | 4 | 2 | **25** |
| 27 | `bulk-actions-confirm-delete` | Documents | 4 | 5 | 2 | 2 | 3 | **25** |
| 28 | `template-preview-modal-use` | Templates | 4 | 3 | 3 | 3 | 2 | **25** |
| 29 | `profile-form-create-mutation` | Profiles | 4 | 3 | 3 | 3 | 2 | **25** |
| 30 | `settings-profile-form` | Settings | 4 | 3 | 3 | 3 | 2 | **25** |
| 31 | `document-detail-delete` | Documents | 4 | 4 | 3 | 2 | 2 | **24** |
| 32 | `document-card-delete` | Documents | 4 | 4 | 3 | 2 | 2 | **24** |
| 33 | `profile-card-delete` | Profiles | 4 | 4 | 3 | 2 | 2 | **24** |
| 34 | `template-card-delete` | Templates | 4 | 4 | 3 | 2 | 2 | **24** |
| 35 | `org-create` | Settings | 4 | 3 | 2 | 4 | 2 | **24** |
| 36 | `org-save` | Settings | 4 | 3 | 2 | 3 | 2 | **23** |
| 37 | `simple-fill-save-history` | Forms | 4 | 3 | 3 | 2 | 2 | **23** |
| 38 | `document-detail-reprocess` | Documents | 3 | 3 | 3 | 3 | 2 | **23** |
| 39 | `profile-detail-delete` | Profiles | 4 | 4 | 2 | 2 | 2 | **23** |
| 40 | `upload-avatar-drop` | Settings | 4 | 3 | 3 | 2 | 2 | **23** |
| 41 | `template-manager-save` | Templates | 4 | 3 | 3 | 3 | 3 | **23** |
| 42 | `auth-remember-me-toggle` | Auth | 3 | 3 | 4 | 3 | 2 | **22** |
| 43 | `auth-terms-toggle` | Auth | 3 | 3 | 3 | 3 | 1 | **22** |
| 44 | `profile-list-create` | Profiles | 4 | 2 | 3 | 3 | 2 | **22** |
| 45 | `filled-forms-download` | Forms | 4 | 2 | 3 | 2 | 2 | **21** |
| 46 | `template-library-create` | Templates | 4 | 2 | 3 | 3 | 2 | **22** |
| 47 | `auth-password-visibility-toggle` | Auth | 2 | 1 | 5 | 3 | 1 | **21** |
| 48 | `profile-card-archive` | Profiles | 3 | 3 | 2 | 2 | 2 | **20** |
| 49 | `knowledge-base-delete` | Knowledge | 4 | 4 | 1 | 2 | 2 | **20** |
| 50 | `error-boundary-reset` | Global | 3 | 2 | 3 | 4 | 1 | **22** |

---

## 2. Batch Plan (Ordered by Priority)

### Batch 1: Auth & Security Foundation
**Priority:** CRITICAL - All other batches depend on this
**Element Count:** 13
**Estimated Duration:** 2-3 days

### Batch 2: Document Management Core
**Priority:** HIGH - Core business functionality
**Element Count:** 18
**Estimated Duration:** 3-4 days

### Batch 3: Profile Management
**Priority:** HIGH - User data management
**Element Count:** 15
**Estimated Duration:** 2-3 days

### Batch 4: Template & Form Filling
**Priority:** MEDIUM-HIGH - Core workflow
**Element Count:** 20
**Estimated Duration:** 3-4 days

### Batch 5: Settings & Organization
**Priority:** MEDIUM - Admin functionality
**Element Count:** 15
**Estimated Duration:** 2-3 days

### Batch 6: Error Handling & Cross-cutting
**Priority:** MEDIUM - UX quality
**Element Count:** 15
**Estimated Duration:** 2 days

### Batch 7: Knowledge Base
**Priority:** LOW - Feature-gated (route not active)
**Element Count:** 7
**Estimated Duration:** 1-2 days (deferred)

---

## 3. Batch 1 - Auth & Security (Detailed Scope)

### Elements in Scope

| Element ID | Type | API Endpoint | Notes |
|-----------|------|--------------|-------|
| `auth-login-form` | submit | `POST /api/auth/v2/login` | Primary auth entry |
| `auth-register-form` | submit | `POST /api/auth/v2/register` | New user creation |
| `auth-logout` | auth | `POST /api/auth/v2/logout` | Session termination |
| `auth-forgot-password-form` | submit | `POST /api/auth/v2/forgot-password` | Password reset request |
| `auth-reset-password-form` | submit | `POST /api/auth/v2/reset-password` | Password reset completion |
| `auth-verify-email-form` | submit | `POST /api/auth/v2/verify-email` | Email verification |
| `auth-resend-verification` | submit | `POST /api/auth/v2/resend-verification` | Resend verification |
| `auth-demo-login` | auth | `POST /api/auth/v2/demo` | Demo mode (gated) |
| `auth-remember-me-toggle` | toggle | N/A | Session persistence |
| `auth-terms-toggle` | toggle | N/A | ToS acceptance |
| `auth-marketing-toggle` | toggle | N/A | Marketing consent |
| `auth-password-visibility-toggle` | toggle | N/A | UX helper |
| `invite-accept-mutation` | mutation | `POST /api/invites/:token/accept` | Org invite acceptance |

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Login response time | < 2s | E2E test timing |
| Registration success rate | > 98% | Error rate monitoring |
| Password reset completion | < 5 min total flow | User flow timing |
| Token refresh reliability | 100% silent refresh | No forced logouts |
| Session persistence accuracy | Remember-me works | Manual QA |
| Error handling coverage | 100% of error states | Code coverage |

### Out of Scope (for Batch 1)

- OAuth/social login providers (not implemented)
- MFA/2FA (not implemented)
- Rate limiting UI feedback (backend concern)
- Admin security dashboard (backend-only)

### Estimated Complexity

| Complexity | Count | Elements |
|-----------|-------|----------|
| Small (S) | 6 | toggles, resend, demo |
| Medium (M) | 5 | verify, forgot, reset, invite |
| Large (L) | 2 | login, register |

**Total Estimate:** Medium complexity batch

### Dependencies

| Dependency | Type | Status |
|-----------|------|--------|
| Backend auth endpoints | External | Implemented |
| Supabase auth (optional mode) | External | Configured |
| JWT token handling | Internal | Implemented in backendAuthStore |
| E2E test users | Testing | Seeded via `seed-e2e-users.ts` |
| Error boundary | Internal | Already exists |

### Component Files

```
pages/Login.tsx
pages/Register.tsx
pages/ForgotPassword.tsx
pages/ResetPassword.tsx
pages/VerifyEmail.tsx
pages/AcceptInvitePage.tsx
pages/AuthCallback.tsx
stores/backendAuthStore.ts
components/layout/AppLayout.tsx (logout)
```

---

## 4. Batch 2 - Document Management (Detailed Scope)

### Elements in Scope

| Element ID | Type | API Endpoint |
|-----------|------|--------------|
| `upload-file-drop` | upload | `POST /api/documents` |
| `upload-clear-completed` | submit | N/A |
| `upload-clear-all` | submit | N/A |
| `upload-cancel` | submit | N/A |
| `upload-retry` | submit | `POST /api/documents` |
| `upload-remove-file` | submit | N/A |
| `document-refresh` | submit | `GET /api/documents` |
| `document-view-mode-grid` | toggle | N/A |
| `document-view-mode-table` | toggle | N/A |
| `document-click` | dialog | `GET /api/documents/:id` |
| `document-detail-close` | dialog | N/A |
| `document-detail-download` | download | `GET /api/documents/:id/download` |
| `document-detail-reprocess` | mutation | `POST /api/documents/:id/reprocess` |
| `document-detail-delete` | mutation | `DELETE /api/documents/:id` |
| `document-delete-mutation` | mutation | `DELETE /api/documents/:id` |
| `document-bulk-delete-mutation` | mutation | `DELETE /api/documents/batch` |
| `document-reprocess-mutation` | mutation | `POST /api/documents/:id/reprocess` |
| `bulk-actions-confirm-delete` | mutation | `DELETE /api/documents/batch` |

### Estimated Complexity: Medium-Large

---

## 5. Batch 3-7 Summary

### Batch 3: Profile Management (15 elements)
```
profile-list-create, profile-list-clear-filter, profile-list-view-grid,
profile-list-view-table, profile-card-click, profile-card-edit,
profile-card-duplicate, profile-card-archive, profile-card-delete,
profile-delete-mutation, profile-archive-mutation, profile-restore-mutation,
profile-detail-back, profile-detail-edit-toggle, profile-detail-save
```

### Batch 4: Template & Form Filling (20 elements)
```
template-library-create, template-library-view-grid, template-library-view-list,
template-library-click, template-library-confirm-delete, template-library-delete-mutation,
template-library-duplicate-mutation, template-card-preview, template-card-edit,
template-card-duplicate, template-card-delete, template-editor-submit,
template-editor-back, template-editor-add-field, template-editor-remove-field,
simple-fill-continue, simple-fill-save-history, simple-fill-download,
filled-forms-view, filled-forms-download
```

### Batch 5: Settings & Organization (15 elements)
```
settings-profile-form, settings-update-profile-mutation, settings-tab-change,
settings-notification-toggles, org-create, org-save, org-invite-modal-open,
org-leave-dialog-open, org-delete-dialog-open, org-leave, org-delete,
invite-member-modal-submit, invite-member-modal-close, members-list-remove,
members-list-confirm-remove
```

### Batch 6: Error Handling & Cross-cutting (15 elements)
```
error-boundary-reset, error-boundary-home, error-state-retry,
data-table-sort, data-table-row-click, data-table-select-all,
data-table-row-select, data-table-pagination, search-bar-clear,
search-bar-suggestion-click, autocomplete-select-suggestion,
processing-status-retry, processing-status-cancel, theme-toggle-light,
theme-toggle-dark
```

### Batch 7: Knowledge Base (7 elements) - DEFERRED
```
knowledge-base-refresh, knowledge-base-upload, knowledge-base-delete-dialog,
knowledge-base-delete, knowledge-search-toggle-hybrid, knowledge-search-submit,
knowledge-search-clear
```

**Note:** Route `/knowledge` not in App.tsx. Defer until feature is enabled.

---

## 6. Risk Assessment

### High-Risk Elements (Address First)

| Element | Risk Type | Mitigation |
|---------|-----------|------------|
| `auth-login-form` | Security - credential handling | Backend validates, frontend sends securely |
| `auth-register-form` | Security - account creation | Email verification required |
| `auth-reset-password-form` | Security - password change | Token expiration, single-use tokens |
| `org-delete` | Data integrity - cascading delete | Owner-only, confirmation dialog |
| `document-bulk-delete-mutation` | Data integrity - batch operation | Confirmation dialog, soft delete option |
| `members-list-confirm-remove` | Access control - org membership | Role check (ADMIN/OWNER only) |

### Security-Sensitive Elements

| Category | Elements |
|----------|----------|
| Authentication | `auth-login-form`, `auth-register-form`, `auth-logout`, `auth-reset-password-form` |
| Authorization | `org-delete` (owner-only), `members-list-confirm-remove` (admin/owner) |
| Session Management | `auth-remember-me-toggle`, `auth-logout` |
| Token Handling | `invite-accept-mutation`, `auth-verify-email-form` |

### Data Integrity Elements

| Category | Elements |
|----------|----------|
| Delete Operations | All `*-delete-*` elements (13 total) |
| Bulk Operations | `document-bulk-delete-mutation`, `bulk-actions-confirm-delete` |
| Profile Data | `profile-form-modal-submit`, `profile-detail-save`, `profile-field-delete` |
| Document Data | `upload-file-drop`, `document-reprocess-mutation` |

---

## 7. Missing Elements to Add

From Phase 2 Coverage Report:

| Element ID | Route | Component | Priority |
|-----------|-------|-----------|----------|
| `members-list-change-role` | /settings | MembersList.tsx:139 | HIGH (security) |
| `not-found-return-home` | /* | NotFoundPage.tsx | MEDIUM |
| `forbidden-return-home` | /forbidden | ForbiddenPage.tsx | MEDIUM |

**Recommendation:** Add to Batch 5 (Settings) and Batch 6 (Error Handling) respectively.

---

## 8. Navigation Elements (Low Priority)

The following navigation elements are primarily routing convenience and lower priority for testing:

```
nav-login-page, nav-register-page, nav-forgot-password, nav-reset-password,
nav-verify-email, nav-auth-callback, nav-accept-invite, nav-dashboard,
nav-upload, nav-history, nav-documents, nav-fill-form, nav-demo-autocomplete,
nav-filled-forms, nav-profiles, nav-profile-detail, nav-templates,
nav-template-new, nav-template-edit, nav-settings, nav-job-details,
dashboard-nav-upload, dashboard-nav-history, dashboard-nav-job,
dashboard-nav-templates, dashboard-nav-documents
```

These are tested implicitly through route navigation in other element tests.

---

## 9. Implementation Recommendations

### Phase 1 Implementation (Batch 1 - Auth)

1. **Start with E2E test infrastructure** (already seeded)
2. **Login flow first** - Foundation for all authenticated tests
3. **Registration next** - User account creation
4. **Password reset flow** - Complete auth lifecycle
5. **Edge cases last** - Demo login, visibility toggles

### Test Coverage Strategy

| Test Type | Coverage Target | Tools |
|-----------|-----------------|-------|
| E2E Happy Path | 100% of core flows | Playwright |
| E2E Error States | 80% of error scenarios | Playwright |
| Unit Tests | 90% of store/hook logic | Vitest |
| Component Tests | 70% of interactive components | Vitest + Testing Library |

### Estimated Total Duration

| Batch | Duration | Dependencies |
|-------|----------|--------------|
| Batch 1 | 2-3 days | None |
| Batch 2 | 3-4 days | Batch 1 complete |
| Batch 3 | 2-3 days | Batch 1 complete |
| Batch 4 | 3-4 days | Batch 1, 3 complete |
| Batch 5 | 2-3 days | Batch 1 complete |
| Batch 6 | 2 days | All batches |
| Batch 7 | 1-2 days | Feature flag enabled |

**Total:** ~15-21 days for full coverage

---

## 10. Next Steps

1. [ ] Confirm batch assignments with team
2. [ ] Begin Batch 1 implementation
3. [ ] Add missing elements to registry (`members-list-change-role`, error page navigation)
4. [ ] Decide on Knowledge Base feature flag status
5. [ ] Set up E2E test framework for systematic batch testing

---

**Triage Complete:** 186 elements analyzed, 7 batches defined, priorities assigned.

*Generated by Phase 3 Portfolio Triage Agent*

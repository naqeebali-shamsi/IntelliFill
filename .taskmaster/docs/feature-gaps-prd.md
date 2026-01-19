# IntelliFill Feature Gaps PRD

## Overview
This PRD documents features that are promised in the UI but not implemented, discovered through comprehensive codebase analysis. Features are organized by priority and domain.

## Project Context
- **Frontend**: React + TypeScript + Vite (quikadmin-web)
- **Backend**: Express + TypeScript + Prisma (quikadmin)
- **Auth**: Supabase Auth + JWT with httpOnly cookies
- **State**: Zustand stores

---

## CRITICAL PRIORITY - Security & Compliance

### Task: Fix documentService Security Vulnerability
**Priority**: P0 - Critical
**Effort**: Low (1-2 hours)
**Files**: `quikadmin-web/src/services/documentService.ts`

The documentService.ts file uses raw `fetch()` with `localStorage.getItem("auth_token")` instead of the secure `api` service. This bypasses XSS mitigations implemented in api.ts.

**Requirements**:
1. Replace raw fetch calls with api service from api.ts
2. Remove localStorage token access (lines 165-222)
3. Use tokenManager for secure in-memory token handling
4. Ensure downloadDocument, deleteDocument, reprocessDocument use api service

**Affected Functions**:
- downloadDocument (line 165-180)
- deleteDocument (line 186-197)
- reprocessDocument (line 209-214)

---

### Task: Implement Delete Account Flow
**Priority**: P0 - Critical
**Effort**: Medium (4-6 hours)
**Files**:
- `quikadmin-web/src/pages/Settings.tsx` (line 656-658)
- `quikadmin/src/api/users.routes.ts` (new endpoint)

Button exists but has no onClick handler. Destructive action requires safeguards.

**Requirements**:
1. Create confirmation dialog with password verification
2. Add warning about irreversible action
3. Create backend endpoint DELETE /api/users/me
4. Delete user data: documents, profiles, settings, org memberships
5. Revoke all tokens and sessions
6. Delete Supabase auth user
7. Redirect to login after deletion

---

### Task: Implement Change Password Modal
**Priority**: P0 - Critical
**Effort**: Medium (3-4 hours)
**Files**:
- `quikadmin-web/src/pages/Settings.tsx` (line 589-591)
- `quikadmin-web/src/components/settings/ChangePasswordModal.tsx` (new)
- `quikadmin/src/api/supabase-auth.routes.ts`

**Requirements**:
1. Create modal component with current password, new password, confirm password fields
2. Validate password strength (min 8 chars, uppercase, lowercase, number)
3. Call Supabase auth updateUser for password change
4. Show success toast and close modal
5. Handle errors (wrong current password, weak password)

---

### Task: Implement Two-Factor Authentication Setup
**Priority**: P0 - Critical
**Effort**: High (8-12 hours)
**Files**:
- `quikadmin-web/src/pages/Settings.tsx` (line 600-606)
- `quikadmin-web/src/components/settings/TwoFactorSetupModal.tsx` (new)
- `quikadmin/src/api/supabase-auth.routes.ts`

**Requirements**:
1. Create 2FA setup modal with QR code generation
2. Integrate with Supabase MFA enrollment
3. Show backup codes after enrollment
4. Add 2FA verification to login flow
5. Add 2FA disable option with password confirmation
6. Update security status display

---

## HIGH PRIORITY - User-Visible Broken Features

### Task: Connect Settings Page Controls to Backend
**Priority**: P1 - High
**Effort**: Medium (4-6 hours)
**Files**:
- `quikadmin-web/src/pages/Settings.tsx`
- `quikadmin-web/src/services/accountService.ts`

13 controls in Settings page have no handlers.

**Requirements**:
1. Theme selection (line 253-262) - Connect to useTheme() hook
2. Compact mode toggle (line 271) - Add localStorage persistence
3. Language selection (line 287-296) - Store preference, prepare for i18n
4. Auto-process toggle (line 313) - Save to user settings API
5. Enable OCR toggle (line 322) - Save to user settings API
6. Notification toggles (lines 543, 552, 559, 573) - Save to user settings API
7. Export Data button (line 627) - Implement JSON export
8. Clear Cache button (line 637) - Clear localStorage/sessionStorage
9. Upgrade button (line 515) - Navigate to billing page or show coming soon

---

### Task: Route Knowledge Base Page
**Priority**: P1 - High
**Effort**: Low (30 minutes)
**Files**:
- `quikadmin-web/src/App.tsx`
- `quikadmin-web/src/components/layout/AppLayout.tsx`

Complete KnowledgeBase.tsx page exists but has no route or navigation.

**Requirements**:
1. Add route in App.tsx: `<Route path="knowledge" element={<KnowledgeBase />} />`
2. Add navigation item in AppLayout.tsx sidebar
3. Use Brain or BookOpen icon for nav item
4. Test page loads and functions correctly

---

### Task: Implement Document Tags System UI
**Priority**: P1 - High
**Effort**: Medium (6-8 hours)
**Files**:
- `quikadmin-web/src/components/features/document-filters.tsx`
- `quikadmin-web/src/components/features/document-card.tsx`
- `quikadmin-web/src/types/document.ts`
- `quikadmin/prisma/schema.prisma`

Tags infrastructure exists in types but no UI to manage them.

**Requirements**:
1. Add tags field to Document model in Prisma schema
2. Create TagInput component for adding/removing tags
3. Add tags display to DocumentCard component
4. Add tag filter chips to DocumentFilters popover
5. Create tag management in document detail modal
6. Update document service to handle tags CRUD

---

### Task: Implement Email Invitation Sending
**Priority**: P1 - High
**Effort**: Medium (4-6 hours)
**Files**:
- `quikadmin/src/api/organization.routes.ts` (line 878)
- `quikadmin/src/services/emailService.ts` (new)

Organization invitations are created but emails are only logged, not sent.

**Requirements**:
1. Set up email service (SendGrid, Resend, or Nodemailer)
2. Create invitation email template with accept link
3. Send email when invitation is created
4. Include organization name, inviter name, role in email
5. Add email verification for invitation acceptance
6. Handle email delivery failures gracefully

---

### Task: Integrate Form Preview into Fill Workflow
**Priority**: P1 - High
**Effort**: Low (2-3 hours)
**Files**:
- `quikadmin-web/src/pages/SimpleFillForm.tsx`
- `quikadmin-web/src/components/features/form-preview.tsx`

FormPreview component is built but never rendered in the workflow.

**Requirements**:
1. Add preview step between mapping and processing in SimpleFillForm
2. Show FormPreview with all mapped fields and values
3. Allow user to edit values before final generation
4. Add "Back to Mapping" and "Generate PDF" buttons
5. Update step indicator to show 4 steps

---

### Task: Fix Multi-File-Type Filter
**Priority**: P1 - High
**Effort**: Low (1-2 hours)
**Files**:
- `quikadmin-web/src/hooks/useDocuments.ts` (line 64-67)
- `quikadmin/src/api/documents.routes.ts`

Frontend allows multiple file type selection but only first is sent to backend.

**Requirements**:
1. Update backend to accept array of types: `type: string[]`
2. Update frontend to send all selected types
3. Backend filters documents matching ANY of the selected types
4. Update API documentation

---

### Task: Implement New Client Button Functionality
**Priority**: P1 - High
**Effort**: Medium (3-4 hours)
**Files**:
- `quikadmin-web/src/components/layout/AppLayout.tsx` (line 135-142)
- `quikadmin-web/src/components/profiles/CreateProfileModal.tsx` (new or existing)

Sidebar "New Client" quick action button has no handler.

**Requirements**:
1. Add onClick handler to open profile creation modal
2. Create or reuse CreateProfileModal component
3. After creation, navigate to new profile detail page
4. Show success toast

---

## MEDIUM PRIORITY - Incomplete Features

### Task: Implement Notification Bell and Center
**Priority**: P2 - Medium
**Effort**: High (8-12 hours)
**Files**:
- `quikadmin-web/src/components/layout/AppLayout.tsx` (header)
- `quikadmin-web/src/components/notifications/NotificationBell.tsx` (new)
- `quikadmin-web/src/components/notifications/NotificationCenter.tsx` (new)
- `quikadmin/prisma/schema.prisma` (Notification model)

No notification UI exists despite notification settings.

**Requirements**:
1. Create Notification model in Prisma
2. Create NotificationBell component with unread badge
3. Create NotificationCenter drawer/popover
4. List notifications with mark as read
5. Create notification types: processing_complete, error, org_invite
6. Add real-time updates via polling or SSE

---

### Task: Implement Document Preview
**Priority**: P2 - Medium
**Effort**: Medium (4-6 hours)
**Files**:
- `quikadmin-web/src/components/features/document-detail.tsx`
- `quikadmin-web/src/components/features/DocumentPreview.tsx` (new)

Document detail modal shows metadata but not actual document content.

**Requirements**:
1. Create DocumentPreview component
2. Integrate PDF.js for PDF rendering
3. Support image preview for JPG/PNG
4. Add page navigation for multi-page documents
5. Show preview in document detail modal
6. Add zoom controls

---

### Task: Implement Bulk Download as ZIP
**Priority**: P2 - Medium
**Effort**: Medium (4-6 hours)
**Files**:
- `quikadmin-web/src/hooks/useDocumentActions.ts` (line 189-256)
- `quikadmin/src/api/documents.routes.ts`

Current bulk download is sequential files, should be single ZIP.

**Requirements**:
1. Create backend endpoint POST /api/documents/download-batch
2. Accept array of document IDs
3. Stream ZIP file response using archiver library
4. Update frontend to call batch endpoint
5. Show download progress
6. Handle large file sets with streaming

---

### Task: Implement OCR Quality Options
**Priority**: P2 - Medium
**Effort**: Medium (6-8 hours)
**Files**:
- `quikadmin-web/src/components/features/ocr-confidence-alert.tsx`
- `quikadmin/src/services/OCRService.ts`
- `quikadmin/src/api/documents.routes.ts`

No quality presets or language selection for OCR.

**Requirements**:
1. Add quality parameter to reprocess endpoint (draft/standard/high)
2. Add language parameter for Tesseract
3. Create quality selection UI in OCR confidence alert
4. Apply preprocessing based on quality level
5. Show estimated processing time per quality level

---

### Task: Implement Profile Audit Trail
**Priority**: P2 - Medium
**Effort**: Medium (4-6 hours)
**Files**:
- `quikadmin/prisma/schema.prisma`
- `quikadmin-web/src/pages/ProfileDetail.tsx`
- `quikadmin/src/services/profile.service.ts`

No change history for profile data modifications.

**Requirements**:
1. Create ProfileAuditLog model in Prisma
2. Log all profile field changes with before/after values
3. Record user who made change and timestamp
4. Create audit history tab in ProfileDetail
5. Show timeline of changes per field

---

### Task: Remove Dead Code - Templates.tsx
**Priority**: P2 - Medium
**Effort**: Low (30 minutes)
**Files**:
- `quikadmin-web/src/pages/Templates.tsx`

Orphaned page file - TemplateLibrary.tsx is the active implementation.

**Requirements**:
1. Verify Templates.tsx is not imported anywhere
2. Delete Templates.tsx file
3. Ensure TemplateLibrary.tsx has all needed functionality
4. Update any stale imports

---

## LOW PRIORITY - Nice to Have

### Task: Implement Search Autocomplete
**Priority**: P3 - Low
**Effort**: Medium (4-6 hours)
**Files**:
- `quikadmin-web/src/components/knowledge/SearchInterface.tsx`

Debounced query exists but autocomplete never implemented.

**Requirements**:
1. Create autocomplete suggestions endpoint
2. Show dropdown with matching results
3. Highlight matching text
4. Keyboard navigation for suggestions
5. Select suggestion on click/enter

---

### Task: Implement Document Sharing
**Priority**: P3 - Low
**Effort**: High (10-14 hours)
**Files**:
- `quikadmin-web/src/components/features/document-card.tsx`
- `quikadmin/prisma/schema.prisma`
- `quikadmin/src/api/documents.routes.ts`

No sharing functionality exists.

**Requirements**:
1. Create DocumentShare model with permissions
2. Add share button to DocumentCard
3. Create share modal with email input
4. Generate shareable links with expiry
5. Implement viewer role for shared documents
6. Add shared documents view

---

### Task: Implement Batch Form Filling UI
**Priority**: P3 - Low
**Effort**: High (8-12 hours)
**Files**:
- `quikadmin-web/src/pages/BatchFillForm.tsx` (new)
- `quikadmin/src/api/filled-forms.routes.ts`

No UI for filling multiple forms at once.

**Requirements**:
1. Create BatchFillForm page
2. Allow selecting multiple PDF templates
3. Allow selecting multiple profiles as data sources
4. Show matrix of template x profile combinations
5. Generate all combinations in batch
6. Show progress and results

---

### Task: Implement Multi-Format Export for Filled Forms
**Priority**: P3 - Low
**Effort**: Medium (4-6 hours)
**Files**:
- `quikadmin-web/src/pages/FilledFormHistory.tsx`
- `quikadmin/src/api/filled-forms.routes.ts`

Only PDF export currently supported.

**Requirements**:
1. Add format selector dropdown (PDF, JSON, CSV)
2. Implement JSON export with form data
3. Implement CSV export with field mappings
4. Update download endpoint to accept format parameter

---

## Technical Debt

### Task: Remove Console Statements from Production Code
**Priority**: P3 - Low
**Effort**: Low (1-2 hours)
**Files**: Multiple pages

Debug console.log/error statements in production code.

**Requirements**:
1. Search for console.log, console.error in src/pages
2. Remove or wrap in development check
3. Replace with proper error handling/logging
4. Consider adding logger utility

---

### Task: Integrate Error Reporting Service
**Priority**: P3 - Low
**Effort**: Medium (2-4 hours)
**Files**:
- `quikadmin-web/src/components/ErrorBoundary.tsx` (line 86)

TODO comment for Sentry integration.

**Requirements**:
1. Set up Sentry account and project
2. Install @sentry/react
3. Initialize Sentry in main.tsx
4. Update ErrorBoundary to report errors
5. Add environment and user context

---

## Success Metrics
- All Settings page controls functional
- Zero security vulnerabilities in token handling
- Knowledge Base accessible from navigation
- Email invitations actually sent
- Document tags fully working end-to-end

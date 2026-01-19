# Phase 1: UI Interactive Element Discovery - Summary

**Generated:** 2026-01-09
**Project:** IntelliFill
**Registry File:** `phase1-element-registry.json`

---

## Overview

This document summarizes the findings from Phase 1 of the UI Interactive Element Discovery workflow. The discovery scanned the IntelliFill frontend codebase (`quikadmin-web/src`) to identify all interactive UI elements that trigger actions, mutations, navigations, or state changes.

---

## Total Elements Discovered

**186 interactive elements** identified across the frontend application.

---

## Breakdown by Element Type

| Type | Count | Description |
|------|-------|-------------|
| **nav** | 42 | Route navigation, page transitions, pagination |
| **mutation** | 56 | TanStack Query mutations, API state changes |
| **submit** | 37 | Form submissions, button actions triggering operations |
| **dialog** | 22 | Modal/dialog open/close actions |
| **toggle** | 22 | Switch components, view mode changes, checkboxes |
| **upload** | 4 | File upload interactions |
| **download/export** | 7 | File downloads and exports |
| **auth** | 4 | Authentication-specific flows |
| **other** | 6 | Miscellaneous (sort, copy, filter) |

---

## Breakdown by Route/Screen

| Route | Element Count | Key Features |
|-------|---------------|--------------|
| `/login` | 4 | Login form, remember me, password visibility |
| `/register` | 4 | Registration form, terms, marketing consent |
| `/forgot-password` | 2 | Password reset request |
| `/reset-password` | 2 | Password reset completion |
| `/verify-email` | 2 | Email verification |
| `/auth/callback` | 1 | OAuth callback |
| `/accept-invite` | 2 | Organization invite acceptance |
| `/dashboard` | 8 | Quick actions, navigation cards |
| `/upload` | 6 | File upload, queue management |
| `/documents` | 18 | Document CRUD, bulk actions, filtering |
| `/history` | 3 | Job history, filtering |
| `/job/:jobId` | 6 | Job details, copy, refresh |
| `/profiles` | 14 | Profile CRUD, view modes |
| `/profiles/:id` | 15 | Profile detail, editing, field management |
| `/templates` | 18 | Template CRUD, preview, use |
| `/templates/new` | 7 | Template creation |
| `/templates/:id/edit` | 7 | Template editing |
| `/fill-form` | 4 | Form filling workflow |
| `/demo/autocomplete` | 3 | Demo form filling |
| `/filled-forms` | 7 | Filled form history |
| `/settings` | 15 | User settings, organization |
| `/knowledge` | 6 | Knowledge base management |
| `global` | 32 | Sidebar, theme, error handling, shared components |

---

## API Touchpoints Identified

### Authentication (`/api/auth/v2/*`)
- `POST /login` - User login
- `POST /register` - New user registration
- `POST /logout` - User logout
- `POST /forgot-password` - Password reset request
- `POST /reset-password` - Password reset completion
- `POST /verify-email` - Email verification
- `POST /resend-verification` - Resend verification email
- `POST /demo` - Demo mode login

### Documents (`/api/documents/*`)
- `GET /documents` - List documents
- `GET /documents/:id` - Get document
- `GET /documents/:id/download` - Download document
- `POST /documents` - Upload document
- `POST /documents/:id/reprocess` - Reprocess OCR
- `POST /documents/reprocess/batch` - Batch reprocess
- `DELETE /documents/:id` - Delete document
- `DELETE /documents/batch` - Bulk delete

### Profiles (`/api/clients/*`)
- `GET /clients` - List profiles
- `GET /clients/:id` - Get profile
- `POST /clients` - Create profile
- `PUT /clients/:id` - Update profile
- `PUT /clients/:id/profile` - Update profile data
- `PUT /clients/:id/archive` - Archive profile
- `PUT /clients/:id/restore` - Restore profile
- `DELETE /clients/:id` - Delete profile

### Templates (`/api/templates/*`)
- `GET /templates` - List templates
- `GET /templates/:id` - Get template
- `POST /templates` - Create template
- `PUT /templates/:id` - Update template
- `POST /templates/:id/duplicate` - Duplicate template
- `POST /templates/:id/use` - Use template
- `DELETE /templates/:id` - Delete template

### Filled Forms (`/api/filled-forms/*`)
- `GET /filled-forms` - List filled forms
- `GET /filled-forms/:id` - Get filled form
- `GET /filled-forms/:id/download` - Download filled form
- `POST /filled-forms/generate` - Generate filled form
- `POST /filled-forms/preview` - Preview form
- `POST /filled-forms/save-adhoc` - Save ad-hoc form
- `DELETE /filled-forms/:id` - Delete filled form

### Organizations (`/api/organizations/*`)
- `POST /organizations` - Create organization
- `PUT /organizations/:id` - Update organization
- `POST /organizations/:id/leave` - Leave organization
- `DELETE /organizations/:id` - Delete organization
- `DELETE /organizations/:id/members/:userId` - Remove member

### Invites (`/api/invites/*`)
- `POST /invites` - Create invite
- `POST /invites/:token/accept` - Accept invite

### Knowledge (`/api/knowledge/*`)
- `GET /knowledge/sources` - List sources
- `POST /knowledge/sources/upload` - Upload source
- `POST /knowledge/search` - Search knowledge
- `DELETE /knowledge/sources/:id` - Delete source

### User Profile (`/api/users/*`)
- `GET /users/me/profile` - Get user profile
- `PUT /users/me/profile` - Update user profile
- `DELETE /users/me/profile` - Delete user profile

---

## Gating/Access Control

| Gate Type | Count | Examples |
|-----------|-------|----------|
| `authenticated` | 145 | Most protected route elements |
| `authenticated/owner` | 1 | Delete organization |
| `demo_mode_enabled` | 1 | Demo login |
| `null` (public) | 39 | Auth pages, theme toggle |

---

## Key Components with Multiple Actions

| Component | Actions | File Path |
|-----------|---------|-----------|
| `DocumentLibrary` | 10 | `pages/DocumentLibrary.tsx` |
| `ProfileList` | 12 | `pages/ProfileList.tsx` |
| `ProfileDetail` | 10 | `pages/ProfileDetail.tsx` |
| `TemplateLibrary` | 8 | `pages/TemplateLibrary.tsx` |
| `TemplateEditor` | 7 | `pages/TemplateEditor.tsx` |
| `OrganizationTabContent` | 7 | `components/features/OrganizationTabContent.tsx` |
| `bulk-actions-toolbar` | 5 | `components/features/bulk-actions-toolbar.tsx` |
| `document-card` | 5 | `components/features/document-card.tsx` |
| `data-table` | 6 | `components/features/data-table.tsx` |

---

## Mutation Hooks (TanStack Query)

| Hook Location | Mutations | Purpose |
|---------------|-----------|---------|
| `hooks/useDocumentActions.ts` | 6 | Document CRUD, bulk ops |
| `pages/ProfileList.tsx` | 3 | Profile archive/restore/delete |
| `pages/ProfileDetail.tsx` | 5 | Profile CRUD operations |
| `pages/TemplateLibrary.tsx` | 2 | Template delete/duplicate |
| `pages/FilledFormHistory.tsx` | 1 | Filled form delete |
| `pages/Settings.tsx` | 1 | Profile update |
| `pages/AcceptInvitePage.tsx` | 1 | Accept invite |
| `components/features/profile-form-modal.tsx` | 2 | Create/update profile |
| `components/features/template-manager.tsx` | 2 | Template create/delete |

---

## Zustand Store Actions

| Store | Key Actions | File Path |
|-------|-------------|-----------|
| `backendAuthStore` | login, logout, register, demoLogin, refreshToken | `stores/backendAuthStore.ts` |
| `uploadStore` | addFiles, clearCompleted, clearAll, cancelUpload, retryUpload | `stores/uploadStore.ts` |
| `documentStore` | fetchDocuments, addDocument, removeDocument | `stores/documentStore.ts` |
| `templateStore` | fetchTemplates, createTemplate, deleteTemplate | `stores/templateStore.ts` |
| `uiStore` | toggleSidebar, setTheme | `stores/uiStore.ts` |

---

## Confidence Levels

| Confidence | Count | Notes |
|------------|-------|-------|
| **high** | 172 | Clear handler/API mapping |
| **med** | 14 | Inferred or partial information |
| **low** | 0 | None identified |

---

## Next Steps (Phase 2)

1. **Coverage Analysis**: Map discovered elements to existing E2E tests
2. **Gap Identification**: Identify untested interactive elements
3. **Test Generation**: Create test cases for uncovered elements
4. **Priority Ranking**: Rank elements by criticality for testing

---

## Files Generated

- `phase1-element-registry.json` - Full registry with 186 elements
- `phase1-summary.md` - This summary document

---

**Discovery Method:** Static code analysis using grep patterns for:
- `onClick` handlers
- `onSubmit` handlers
- `useMutation` hooks
- `useNavigate` usage
- `onCheckedChange` handlers
- `Dialog/AlertDialog` components
- `DropdownMenu` components
- API service calls

**Coverage:** All files in `quikadmin-web/src/` including:
- Pages (35 files)
- Components/features (45 files)
- Components/ui (50 files)
- Hooks (15 files)
- Stores (15 files)
- Services (15 files)

# Product Requirements Document: Profile CRUD E2E Test Fixes

**Document Version:** 1.0
**Status:** Draft
**Priority:** HIGH
**Created:** 2026-01-09
**Author:** AI Product Specialist

---

## Executive Summary

### Problem Statement

The IntelliFill application has critical gaps in its Profile CRUD functionality that are causing E2E test failures. The Settings page Account tab allows users to edit profile fields, but the current implementation has four major issues:

1. **Profile data does not load on mount** - Users see empty fields instead of their saved profile data
2. **Avatar upload is completely missing** - No component, no endpoint, no storage integration
3. **Validation rules are inconsistent** - Frontend/backend phone validation mismatch (20 vs 30 chars)
4. **AuthUser type is incomplete** - Missing profile fields (avatarUrl, phone, jobTitle, bio)

### Solution Overview

Implement a complete Profile CRUD flow with:
- GET `/api/users/me/profile` endpoint for fetching current profile data
- Avatar upload component with file handling, preview, and R2 storage integration
- Synchronized validation rules between frontend (Zod) and backend (Joi)
- Extended AuthUser type with all profile fields
- useProfile() hook for data fetching and state management

### Business Impact

| Metric | Current State | Target State |
|--------|---------------|--------------|
| Profile E2E Tests | 0% passing | 100% passing |
| User Profile Completion | Unknown (no tracking) | Trackable |
| Avatar Upload Feature | Not available | Fully functional |
| Data Persistence | Broken on refresh | Persists correctly |

### Resource Requirements

| Role | Effort Estimate |
|------|-----------------|
| Backend Developer | 4-6 hours |
| Frontend Developer | 6-8 hours |
| QA/Testing | 2-3 hours |
| **Total** | **12-17 hours** |

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| R2 storage configuration issues | Medium | High | Use existing R2 setup from document uploads |
| Auth state sync complexity | Medium | Medium | Leverage existing token refresh patterns |
| Breaking existing Settings page | Low | High | Incremental changes with backward compatibility |

---

## Product Overview

### Product Vision

Users should be able to view, edit, and persist their complete profile information including avatar image, contact details, and bio. The profile data should load immediately when visiting Settings, persist across sessions, and sync with the auth store for display throughout the application.

### Target Users

| User Type | Description | Primary Use Case |
|-----------|-------------|------------------|
| All IntelliFill Users | Anyone with an account | Manage their profile information |
| Organization Admins | Users managing teams | View member profiles |
| API Consumers | External integrations | Fetch user profile data |

### Value Proposition

A complete profile management system enables:
- **User personalization**: Avatar and bio create identity within the platform
- **Professional context**: Job title helps team collaboration
- **Contact flexibility**: Phone number for optional notifications
- **Trust and engagement**: Complete profiles increase user investment in the platform

### Success Criteria

| Criterion | Metric | Target |
|-----------|--------|--------|
| E2E Test Pass Rate | Profile-related tests | 100% |
| Profile Load Time | GET /api/users/me/profile | < 200ms p95 |
| Avatar Upload Success | Upload completion rate | > 99% |
| Data Persistence | Profile survives refresh | 100% |
| Form Validation | Frontend/backend parity | 100% match |

### Assumptions

1. R2 storage is already configured for document uploads and can be reused for avatars
2. The existing `authenticateSupabase` middleware provides the user ID for all profile operations
3. The frontend uses React Query for server state management
4. Users have stable internet connections for avatar uploads

---

## Functional Requirements

### FR-1: Profile Data Fetching

#### Core Features

| Feature ID | Feature | Priority | Description |
|------------|---------|----------|-------------|
| FR-1.1 | GET Profile Endpoint | P0 | New endpoint to fetch current user profile |
| FR-1.2 | useProfile Hook | P0 | React hook for profile data fetching |
| FR-1.3 | Form Pre-population | P0 | Settings form loads with fetched data |
| FR-1.4 | Error Handling | P1 | Graceful degradation on fetch failure |

#### User Stories

**US-1.1: View Current Profile**
```
As a logged-in user
I want to see my current profile data when I open Settings
So that I know what information is already saved

Acceptance Criteria:
- Given I am logged in and navigate to Settings > Account tab
- When the page loads
- Then I see my firstName, lastName, phone, jobTitle, and bio pre-populated
- And I see my avatar image if one exists
- And read-only email field shows my email with verification badge if verified
```

**US-1.2: Profile Load Error Handling**
```
As a user with connectivity issues
I want to see a helpful error message if profile fails to load
So that I understand what happened and can retry

Acceptance Criteria:
- Given I am logged in and the profile API call fails
- When I navigate to Settings > Account tab
- Then I see an error message "Failed to load profile data"
- And I see a "Retry" button
- And the form fields show placeholder text, not empty
```

#### API Specification

**GET /api/users/me/profile**

Request:
```
Headers:
  Authorization: Bearer <access_token>
```

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "avatarUrl": "https://r2.example.com/avatars/uuid.jpg",
      "phone": "+1-555-0123",
      "jobTitle": "Software Engineer",
      "bio": "I build things.",
      "emailVerified": true,
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-09T12:00:00Z"
    }
  }
}
```

Response (401 Unauthorized):
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

---

### FR-2: Avatar Upload

#### Core Features

| Feature ID | Feature | Priority | Description |
|------------|---------|----------|-------------|
| FR-2.1 | AvatarUpload Component | P0 | React component for avatar selection and preview |
| FR-2.2 | Avatar Upload Endpoint | P0 | POST endpoint for file upload |
| FR-2.3 | Avatar Storage | P0 | R2 bucket integration for avatar files |
| FR-2.4 | Avatar Preview | P1 | Show selected image before saving |
| FR-2.5 | Avatar Removal | P1 | Allow users to remove their avatar |
| FR-2.6 | Avatar Validation | P0 | File type and size validation |

#### User Stories

**US-2.1: Upload Avatar Image**
```
As a user
I want to upload a profile picture
So that my colleagues can recognize me in the platform

Acceptance Criteria:
- Given I am on Settings > Account tab
- When I click on the avatar placeholder or "Upload Avatar" button
- Then a file picker opens allowing image selection
- And I can select JPG, PNG, GIF, or WebP files up to 5MB
- When I select a valid image
- Then I see a preview of the image in the avatar circle
- And the "Save Changes" button becomes enabled
- When I click "Save Changes"
- Then the avatar is uploaded and persists across sessions
```

**US-2.2: Preview Avatar Before Save**
```
As a user selecting a new avatar
I want to see how it will look before committing
So that I can choose the best image

Acceptance Criteria:
- Given I have selected an image file
- When the file is loaded
- Then I see an immediate preview in the avatar circle
- And the preview is cropped/scaled to fit the circle
- And I can select a different image if unsatisfied
```

**US-2.3: Remove Avatar**
```
As a user with an existing avatar
I want to remove my profile picture
So that I can use the default placeholder instead

Acceptance Criteria:
- Given I have an existing avatar
- When I click "Remove Avatar" or the X button on the avatar
- Then the avatar preview shows the default placeholder
- And "Save Changes" becomes enabled
- When I click "Save Changes"
- Then my avatarUrl is set to null in the database
- And the old avatar file is marked for cleanup
```

**US-2.4: Invalid Avatar File Rejection**
```
As a user selecting an avatar
I want to see clear error messages for invalid files
So that I understand what files are acceptable

Acceptance Criteria:
- Given I select a file that is not JPG/PNG/GIF/WebP
- When the file picker closes
- Then I see error "Invalid file type. Please select JPG, PNG, GIF, or WebP"
- And the avatar preview does not change

- Given I select an image larger than 5MB
- When the file picker closes
- Then I see error "File too large. Maximum size is 5MB"
- And the avatar preview does not change
```

#### API Specification

**POST /api/users/me/avatar**

Request:
```
Headers:
  Authorization: Bearer <access_token>
  Content-Type: multipart/form-data

Body:
  avatar: <file> (required, max 5MB, JPG/PNG/GIF/WebP)
```

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "avatarUrl": "https://r2.example.com/avatars/user-uuid-timestamp.jpg"
  }
}
```

Response (400 Bad Request - Invalid File Type):
```json
{
  "success": false,
  "error": "Invalid file type. Allowed: jpg, jpeg, png, gif, webp"
}
```

Response (400 Bad Request - File Too Large):
```json
{
  "success": false,
  "error": "File too large. Maximum size is 5MB"
}
```

**DELETE /api/users/me/avatar**

Request:
```
Headers:
  Authorization: Bearer <access_token>
```

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "avatarUrl": null
  }
}
```

---

### FR-3: Profile Update (Enhancement)

#### Current State Analysis

The existing PATCH `/api/users/me/profile` endpoint works correctly for updating profile fields. However, the frontend does not fetch current data on mount, causing the form to always start empty.

#### Enhancements Required

| Feature ID | Feature | Priority | Description |
|------------|---------|----------|-------------|
| FR-3.1 | Fetch-Then-Edit Pattern | P0 | Load current data before allowing edits |
| FR-3.2 | Auth Store Sync | P1 | Update AuthUser with profile fields |
| FR-3.3 | Optimistic Updates | P2 | Show changes immediately, rollback on error |

#### User Stories

**US-3.1: Edit Pre-populated Form**
```
As a user editing my profile
I want to modify my existing information
So that I don't have to re-enter unchanged fields

Acceptance Criteria:
- Given I am on Settings > Account tab
- When the page finishes loading
- Then firstName shows my current first name
- And lastName shows my current last name
- And phone shows my current phone number
- And jobTitle shows my current job title
- And bio shows my current bio
- When I change only my job title and save
- Then only the jobTitle field is updated
- And all other fields retain their values
```

**US-3.2: Profile Data in Auth Store**
```
As a user viewing the sidebar
I want to see my avatar and name
So that I know I'm logged in as the right account

Acceptance Criteria:
- Given I have set an avatar and my name is "John Doe"
- When I view any page with the sidebar
- Then I see my avatar image in the sidebar user section
- And I see "John Doe" as my display name
```

---

### FR-4: Validation Alignment

#### Current Mismatch Analysis

| Field | Frontend (Zod) | Backend (Joi) | Resolution |
|-------|----------------|---------------|------------|
| phone | max 20 chars | max 30 chars | Align to 30 chars |
| avatarUrl | No file validation | N/A (no endpoint) | Add file validation |
| firstName | min 1, max 50 | min 1, max 50 | Aligned |
| lastName | max 50 | max 50 | Aligned |
| jobTitle | max 100 | max 100 | Aligned |
| bio | max 500 | max 500 | Aligned |

#### Requirements

| Feature ID | Feature | Priority | Description |
|------------|---------|----------|-------------|
| FR-4.1 | Phone Validation Sync | P0 | Update frontend to max 30 chars |
| FR-4.2 | Avatar File Validation | P0 | Add frontend and backend validation |
| FR-4.3 | Validation Error Display | P1 | Show backend errors in form |

---

### FR-5: AuthUser Type Extension

#### Current Type

```typescript
// quikadmin-web/src/services/authService.ts
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  emailVerified: boolean;
  lastLogin?: string;
  createdAt?: string;
  isDemo?: boolean;
}
```

#### Required Type

```typescript
export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;      // NEW
  phone: string | null;           // NEW
  jobTitle: string | null;        // NEW
  bio: string | null;             // NEW
  role: string;
  emailVerified: boolean;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;             // NEW
  isDemo?: boolean;
}
```

---

## Non-Functional Requirements

### NFR-1: Performance

| Requirement | Metric | Target |
|-------------|--------|--------|
| Profile GET latency | p95 response time | < 200ms |
| Avatar upload time | End-to-end (5MB file) | < 5s |
| Form load time | Time to interactive | < 500ms |

### NFR-2: Security

| Requirement | Description |
|-------------|-------------|
| Authentication | All profile endpoints require valid JWT |
| Authorization | Users can only access their own profile |
| File Upload Security | Validate MIME type, scan for malware |
| Avatar Storage | Secure R2 presigned URLs or proxied access |

### NFR-3: Usability

| Requirement | Description |
|-------------|-------------|
| Form Accessibility | WCAG 2.1 AA compliance |
| Error Messages | Clear, actionable error text |
| Loading States | Skeleton loaders during fetch |
| Responsive Design | Works on mobile viewports |

### NFR-4: Reliability

| Requirement | Metric | Target |
|-------------|--------|--------|
| Avatar upload success rate | Successful uploads / attempts | > 99% |
| Profile API availability | Uptime | 99.9% |
| Data consistency | Profile updates persisted | 100% |

---

## Technical Considerations

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Settings.tsx │──│ useProfile() │──│ accountService.ts    │  │
│  │              │  │    Hook      │  │ - getProfile()       │  │
│  │ ┌──────────┐ │  └──────────────┘  │ - updateProfile()    │  │
│  │ │ Avatar   │ │                    │ - uploadAvatar()     │  │
│  │ │ Upload   │ │                    │ - deleteAvatar()     │  │
│  │ └──────────┘ │                    └──────────────────────┘  │
│  └──────────────┘                              │                │
│                                                │                │
│  ┌──────────────────────┐                      │                │
│  │ backendAuthStore.ts  │◄─────────────────────┘                │
│  │ - AuthUser extended  │  (sync profile fields)               │
│  └──────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP/S
┌─────────────────────────────────────────────────────────────────┐
│                       Backend (Express)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    users.routes.ts                       │   │
│  │  GET  /api/users/me/profile     (NEW)                    │   │
│  │  PATCH /api/users/me/profile    (existing)               │   │
│  │  POST  /api/users/me/avatar     (NEW)                    │   │
│  │  DELETE /api/users/me/avatar    (NEW)                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Prisma (PostgreSQL)                     │   │
│  │  User { avatarUrl, phone, jobTitle, bio, ... }           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Cloudflare R2 (Avatar Storage)              │   │
│  │  /avatars/{userId}/{timestamp}.{ext}                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Frontend Framework | React 18 | Existing |
| State Management | Zustand + React Query | Existing |
| Form Handling | React Hook Form + Zod | Existing |
| Backend Framework | Express 4.18 | Existing |
| File Upload | Multer | Existing (used for documents) |
| Object Storage | Cloudflare R2 | Existing (used for documents) |
| Database | PostgreSQL (Neon) | Existing |
| ORM | Prisma 6.14 | Existing |

### Data Model

The User model in Prisma already has the required fields:

```prisma
model User {
  id             String         @id @default(uuid())
  email          String         @unique
  firstName      String?
  lastName       String?
  avatarUrl      String?        @map("avatar_url")
  phone          String?        @db.VarChar(30)
  jobTitle       String?        @map("job_title") @db.VarChar(100)
  bio            String?        @db.VarChar(500)
  // ... other fields
}
```

No database migrations required.

### Integration Requirements

| Integration | Type | Notes |
|-------------|------|-------|
| Cloudflare R2 | Object Storage | Reuse existing configuration from document uploads |
| Supabase Auth | JWT Validation | Existing middleware |
| React Query | Server State | Add profile query |

### Infrastructure Needs

| Resource | Requirement | Notes |
|----------|-------------|-------|
| R2 Storage | Avatar bucket/prefix | `/avatars/` prefix in existing bucket |
| API Rate Limiting | Profile endpoints | Inherit existing rate limits |
| CDN | Avatar delivery | Optional: CDN for avatar URLs |

---

## Implementation Blueprint

### Epic Breakdown

| Epic | Description | Stories |
|------|-------------|---------|
| E1 | Backend Profile GET | US-1.1, US-1.2 |
| E2 | Avatar Upload | US-2.1, US-2.2, US-2.3, US-2.4 |
| E3 | Frontend Profile Hook | US-3.1, US-3.2 |
| E4 | Validation Alignment | FR-4.1, FR-4.2, FR-4.3 |
| E5 | AuthUser Extension | FR-5 |

### Sprint Plan

**Sprint 1 (Days 1-2): Backend Foundation**
- [ ] Implement GET `/api/users/me/profile` endpoint
- [ ] Implement POST `/api/users/me/avatar` endpoint
- [ ] Implement DELETE `/api/users/me/avatar` endpoint
- [ ] Add avatar file validation (multer config)
- [ ] Add R2 upload for avatars
- [ ] Write backend unit tests

**Sprint 2 (Days 2-3): Frontend Integration**
- [ ] Create `useProfile()` hook with React Query
- [ ] Create `AvatarUpload.tsx` component
- [ ] Update Settings.tsx to use useProfile hook
- [ ] Add avatar upload integration
- [ ] Align phone validation (20 -> 30 chars)
- [ ] Update AuthUser type
- [ ] Update auth store to sync profile fields

**Sprint 3 (Day 4): Testing & Polish**
- [ ] Write E2E tests for profile CRUD
- [ ] Test avatar upload/remove flow
- [ ] Test profile data persistence across refresh
- [ ] Fix any validation mismatches
- [ ] Add loading/error states

### Dependency Graph

```
┌─────────────────────┐
│ Backend GET Profile │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│  useProfile Hook    │────▶│  Settings.tsx       │
└──────────┬──────────┘     │  Integration        │
           │                └─────────────────────┘
           │
           ▼
┌─────────────────────┐
│ AuthUser Extension  │
└─────────────────────┘

┌─────────────────────┐
│ Backend Avatar API  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│ AvatarUpload.tsx    │────▶│  Settings.tsx       │
│ Component           │     │  Integration        │
└─────────────────────┘     └─────────────────────┘

┌─────────────────────┐
│ Validation Alignment│ (can run in parallel)
└─────────────────────┘
```

---

## Quality Assurance Framework

### Acceptance Criteria Summary

| Feature | Test Type | Pass Criteria |
|---------|-----------|---------------|
| Profile GET | Unit, Integration, E2E | Returns all profile fields |
| Profile Edit | Unit, Integration, E2E | Saves changes, persists on refresh |
| Avatar Upload | Unit, Integration, E2E | File uploads, URL persists |
| Avatar Remove | Unit, Integration, E2E | Sets avatarUrl to null |
| Form Validation | Unit, E2E | Frontend/backend errors match |
| Auth Store Sync | Integration, E2E | Profile fields in sidebar |

### E2E Test Scenarios

```typescript
// Profile CRUD E2E Tests

describe('Profile Management', () => {
  describe('Profile Data Loading', () => {
    it('should load current profile data on Settings mount', async () => {
      // Pre-condition: User has saved profile with all fields
      await page.goto('/settings');
      await page.click('[data-testid="account-tab"]');

      // Assert form is pre-populated
      await expect(page.locator('[data-testid="firstName-input"]')).toHaveValue('John');
      await expect(page.locator('[data-testid="lastName-input"]')).toHaveValue('Doe');
      await expect(page.locator('[data-testid="phone-input"]')).toHaveValue('+1-555-0123');
      await expect(page.locator('[data-testid="jobTitle-input"]')).toHaveValue('Engineer');
      await expect(page.locator('[data-testid="bio-input"]')).toHaveValue('I build things.');
    });

    it('should show loading skeleton while fetching profile', async () => {
      await page.goto('/settings');
      await expect(page.locator('[data-testid="profile-skeleton"]')).toBeVisible();
    });
  });

  describe('Avatar Upload', () => {
    it('should upload avatar and show preview', async () => {
      await page.goto('/settings');
      await page.click('[data-testid="account-tab"]');

      // Upload image
      const fileInput = page.locator('[data-testid="avatar-input"]');
      await fileInput.setInputFiles('test-avatar.jpg');

      // Assert preview shows
      await expect(page.locator('[data-testid="avatar-preview"]')).toBeVisible();

      // Save
      await page.click('[data-testid="save-profile-btn"]');
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();

      // Refresh and verify persistence
      await page.reload();
      await expect(page.locator('[data-testid="avatar-image"]')).toHaveAttribute('src', /r2.*avatars/);
    });

    it('should remove avatar', async () => {
      // Pre-condition: User has avatar
      await page.goto('/settings');
      await page.click('[data-testid="account-tab"]');

      await page.click('[data-testid="remove-avatar-btn"]');
      await page.click('[data-testid="save-profile-btn"]');

      // Verify removed
      await page.reload();
      await expect(page.locator('[data-testid="avatar-placeholder"]')).toBeVisible();
    });

    it('should reject invalid file types', async () => {
      await page.goto('/settings');
      await page.click('[data-testid="account-tab"]');

      const fileInput = page.locator('[data-testid="avatar-input"]');
      await fileInput.setInputFiles('document.pdf');

      await expect(page.locator('[data-testid="avatar-error"]')).toContainText('Invalid file type');
    });
  });

  describe('Profile Update', () => {
    it('should save profile changes and persist after refresh', async () => {
      await page.goto('/settings');
      await page.click('[data-testid="account-tab"]');

      // Edit fields
      await page.fill('[data-testid="firstName-input"]', 'Jane');
      await page.fill('[data-testid="jobTitle-input"]', 'Senior Engineer');

      // Save
      await page.click('[data-testid="save-profile-btn"]');
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();

      // Refresh and verify
      await page.reload();
      await expect(page.locator('[data-testid="firstName-input"]')).toHaveValue('Jane');
      await expect(page.locator('[data-testid="jobTitle-input"]')).toHaveValue('Senior Engineer');
    });
  });
});
```

### Performance Benchmarks

| Metric | Tool | Target | Alert Threshold |
|--------|------|--------|-----------------|
| Profile GET latency | Backend metrics | < 200ms p95 | > 500ms |
| Avatar upload time | E2E test timing | < 5s (5MB file) | > 10s |
| Form LCP | Lighthouse | < 2.5s | > 4s |

---

## Appendices

### Appendix A: Current vs Target State Comparison

| Aspect | Current State | Target State |
|--------|---------------|--------------|
| Profile GET endpoint | Does not exist | Returns all profile fields |
| Profile form on mount | Empty fields | Pre-populated with data |
| Avatar upload | Not available | Full upload/preview/remove flow |
| Avatar storage | N/A | R2 at /avatars/{userId}/ |
| Phone validation (FE) | max 20 chars | max 30 chars |
| AuthUser type | 7 fields | 11 fields (added avatar, phone, jobTitle, bio) |
| Profile in sidebar | firstName only | firstName + avatar |

### Appendix B: File Changes Required

**Backend (quikadmin/)**
| File | Change Type | Description |
|------|-------------|-------------|
| `src/api/users.routes.ts` | Modify | Add GET profile, POST/DELETE avatar |
| `src/utils/r2Storage.ts` | Modify/Create | Add avatar upload helpers |
| `src/validators/schemas/settingsSchemas.ts` | Verify | Already correct (30 chars) |

**Frontend (quikadmin-web/)**
| File | Change Type | Description |
|------|-------------|-------------|
| `src/services/accountService.ts` | Modify | Add getProfile(), uploadAvatar(), deleteAvatar() |
| `src/hooks/useProfile.ts` | Create | React Query hook for profile data |
| `src/components/features/AvatarUpload.tsx` | Create | Avatar upload component |
| `src/pages/Settings.tsx` | Modify | Integrate useProfile, add AvatarUpload |
| `src/services/authService.ts` | Modify | Extend AuthUser type |
| `src/stores/backendAuthStore.ts` | Modify | Sync profile fields to store |
| `src/lib/validations/account.ts` | Modify | Change phone max to 30 chars |

### Appendix C: API Response Schemas

**Profile Response Schema (TypeScript)**
```typescript
interface ProfileResponse {
  success: true;
  data: {
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      avatarUrl: string | null;
      phone: string | null;
      jobTitle: string | null;
      bio: string | null;
      emailVerified: boolean;
      createdAt: string;
      updatedAt: string;
    };
  };
}
```

**Avatar Upload Response Schema (TypeScript)**
```typescript
interface AvatarUploadResponse {
  success: true;
  data: {
    avatarUrl: string;
  };
}
```

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-09 | AI Product Specialist | Initial draft |

---

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Tech Lead | | | |
| QA Lead | | | |

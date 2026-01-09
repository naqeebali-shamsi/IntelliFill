# PRD: Avatar Upload Integration

**Document Version:** 1.0
**Created:** 2026-01-09
**Status:** Draft
**Priority:** High

---

## Executive Summary

### Problem Statement

The IntelliFill platform has a fully implemented `AvatarUpload` component that is not integrated into the application. Users cannot upload, preview, or manage their profile avatars despite the frontend component being complete and the database schema supporting avatar storage. This creates a gap between implemented features and user-facing functionality.

### Solution Overview

Integrate the existing `AvatarUpload` component into the Settings page and create the necessary backend endpoints for file upload to R2 storage. This involves:
1. Wiring the `AvatarUpload` component into `Settings.tsx`
2. Creating `POST /api/users/me/avatar` endpoint with multer for file handling
3. Creating `DELETE /api/users/me/avatar` endpoint for avatar removal
4. Adding `uploadAvatar` and `deleteAvatar` functions to `accountService.ts`
5. Implementing a two-step save flow (upload file first, then update profile)

### Business Impact

- **User Experience:** Enables personalized profiles, increasing user engagement and platform stickiness
- **Feature Completion:** Closes the gap between implemented and deployed features
- **E2E Test Compliance:** Enables passing of 4 E2E profile tests currently expecting avatar functionality

### Resource Requirements

- **Backend:** 4-6 hours (endpoints + R2 integration)
- **Frontend:** 2-4 hours (integration + state management)
- **Testing:** 2-3 hours (unit + integration tests)
- **Total Estimate:** 8-13 hours

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| R2 storage configuration issues | Medium | High | Test in staging before production |
| File size validation bypass | Low | Medium | Server-side validation mandatory |
| Image format security vulnerabilities | Low | High | Use allowlist + file signature validation |
| Avatar URL caching issues | Medium | Low | Add cache-busting query params |

---

## Product Overview

### Product Vision

Enable IntelliFill users to personalize their profiles with custom avatar images, enhancing the user experience and enabling visual identification across the platform (e.g., in organization member lists, document comments, and activity feeds).

### Target Users

| User Type | Description | Primary Need |
|-----------|-------------|--------------|
| Individual Users | Users managing personal document profiles | Visual personalization |
| Organization Members | Users in shared workspaces | Visual identification among team members |
| Agency Users | Users managing multiple client accounts | Professional branding |

### Value Proposition

- **For Individual Users:** Personalize your profile with a custom avatar that represents you across the platform
- **For Organizations:** Quickly identify team members in member lists and activity feeds
- **For the Platform:** Increase user engagement through personalization features

### Success Criteria

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Avatar upload success rate | > 99% | Backend metrics |
| E2E test pass rate | 100% (4 tests) | CI pipeline |
| Upload time (5MB file) | < 3 seconds | Performance monitoring |
| User adoption (30-day) | > 25% of active users | Analytics |

### Assumptions

1. R2 storage is already configured and accessible from the backend
2. Users have reliable internet for file uploads up to 5MB
3. The existing `AvatarUpload` component validation is sufficient
4. Public URLs from R2 are accessible for avatar display

---

## Functional Requirements

### Core Features

#### F1: Avatar Upload

**Description:** Users can upload a new avatar image from the Settings > Account page.

**User Stories:**

**US1.1: Upload Avatar Image**
- **As a** registered user
- **I want to** upload a profile picture
- **So that** my profile is personalized and I am visually identifiable

**Acceptance Criteria:**
- Given I am on the Settings > Account tab
- When I click the avatar upload button or drag-drop an image
- Then I see a preview of the selected image
- And the image is validated (type, size)
- And I can proceed to save my profile

**US1.2: Preview Avatar Before Save**
- **As a** user uploading an avatar
- **I want to** see a preview before saving
- **So that** I can verify the image looks correct

**Acceptance Criteria:**
- Given I have selected an image file
- When the file is validated successfully
- Then I see the image preview in the avatar circle
- And the preview replaces any existing avatar display
- And I can choose to proceed with save or select a different image

**US1.3: Save Avatar with Profile**
- **As a** user with a pending avatar upload
- **I want to** save my avatar when I save my profile
- **So that** all profile changes are saved together

**Acceptance Criteria:**
- Given I have selected a new avatar image
- When I click "Save Changes"
- Then the avatar file is uploaded to storage
- And my profile is updated with the new avatar URL
- And I see a success notification
- And the avatar persists after page refresh

#### F2: Avatar Removal

**Description:** Users can remove their existing avatar and revert to the default placeholder.

**User Stories:**

**US2.1: Remove Avatar**
- **As a** user with an avatar
- **I want to** remove my current avatar
- **So that** I can use the default placeholder or upload a different image

**Acceptance Criteria:**
- Given I have an existing avatar displayed
- When I click the remove (X) button
- Then the avatar preview shows the default placeholder
- And when I save, the avatar is removed from my profile
- And the old avatar file is deleted from storage

#### F3: Avatar Validation

**Description:** The system validates avatar uploads for type and size.

**User Stories:**

**US3.1: Validate File Type**
- **As a** user uploading an avatar
- **I want to** see an error if I upload an invalid file type
- **So that** I know which file formats are acceptable

**Acceptance Criteria:**
- Given I select a file that is not JPG, PNG, GIF, or WebP
- When the file is processed
- Then I see an error message: "Invalid file type. Accepted types: .jpg, .jpeg, .png, .gif, .webp"
- And the file is not uploaded

**US3.2: Validate File Size**
- **As a** user uploading an avatar
- **I want to** see an error if my file is too large
- **So that** I know the size limit

**Acceptance Criteria:**
- Given I select a file larger than 5MB
- When the file is processed
- Then I see an error message: "File is too large. Maximum size is 5MB"
- And the file is not uploaded

#### F4: Error Handling

**Description:** The system gracefully handles upload failures.

**User Stories:**

**US4.1: Handle Upload Failure**
- **As a** user experiencing an upload error
- **I want to** see a clear error message
- **So that** I know what went wrong and can retry

**Acceptance Criteria:**
- Given the avatar upload fails (network error, server error)
- When the error occurs
- Then I see a user-friendly error message
- And my profile form remains usable
- And I can retry the upload

### User Flows

#### Flow 1: Upload New Avatar

```
1. User navigates to Settings page
2. User clicks "Account" tab
3. User sees avatar section with current avatar or placeholder
4. User clicks camera icon or "Upload" button
5. File picker opens
6. User selects image file
7. System validates file (type, size)
   - If invalid: Show error, stay on form
   - If valid: Show preview
8. User clicks "Save Changes"
9. System uploads file to R2 storage
10. System updates profile with new avatar URL
11. System shows success toast
12. Avatar persists after refresh
```

#### Flow 2: Drag-and-Drop Upload

```
1. User is on Settings > Account tab
2. User drags image file over avatar area
3. Avatar area shows drag-over state
4. User drops file
5. System validates and shows preview
6. User saves profile
7. Avatar is uploaded and saved
```

#### Flow 3: Remove Avatar

```
1. User is on Settings > Account with existing avatar
2. User clicks "X" button on avatar
3. Preview reverts to placeholder
4. User clicks "Save Changes"
5. System deletes avatar from storage
6. System updates profile with null avatar URL
7. Default placeholder is displayed
```

### Business Rules

| Rule ID | Rule Description |
|---------|------------------|
| BR1 | Avatar file size must not exceed 5MB |
| BR2 | Avatar file type must be one of: JPEG, PNG, GIF, WebP |
| BR3 | Avatar dimensions are not restricted (displayed at component-defined sizes) |
| BR4 | Old avatar files should be deleted from storage when replaced |
| BR5 | Avatar URLs should be served via R2 public endpoint or presigned URLs |
| BR6 | Avatar upload must complete before profile update is submitted |

### Integration Points

| System | Integration Type | Description |
|--------|-----------------|-------------|
| R2 Storage | REST API (S3-compatible) | Store avatar files |
| Prisma/PostgreSQL | ORM | Store avatar URL in User.avatarUrl |
| Frontend State | Zustand/React Query | Cache and sync avatar state |

---

## Non-Functional Requirements

### Performance

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Upload time (5MB) | < 3 seconds | User experience |
| Preview display | < 200ms | Instant feedback |
| Page load with avatar | < 500ms | Fast rendering |

### Security

| Requirement | Implementation |
|-------------|----------------|
| File type validation | Server-side allowlist + magic number check |
| File size validation | Server-side enforcement (multer limits) |
| Authenticated uploads | JWT required for all avatar endpoints |
| Secure storage | R2 with proper bucket policies |
| No executable content | Reject files with executable extensions |

### Usability

| Requirement | Implementation |
|-------------|----------------|
| Drag-and-drop support | Already implemented in AvatarUpload |
| Keyboard accessible | Already implemented (Enter/Space to upload) |
| Clear error messages | Inline error display below avatar |
| Loading state | Show spinner during upload |

### Reliability

| Requirement | Target |
|-------------|--------|
| Upload success rate | > 99.5% |
| Error recovery | Retry capability without data loss |
| Graceful degradation | Form usable even if avatar upload fails |

### Compliance

| Requirement | Implementation |
|-------------|----------------|
| WCAG 2.1 AA | Aria labels on all interactive elements |
| Data privacy | Avatar stored with user-specific keys |

---

## Technical Considerations

### Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Settings.tsx  │────▶│  accountService │────▶│  Backend API    │
│  + AvatarUpload │     │   uploadAvatar  │     │ POST /me/avatar │
└─────────────────┘     │   deleteAvatar  │     │ DELETE /me/avatar│
                        └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │   R2 Storage    │
                                                │  avatars/{uid}/ │
                                                └─────────────────┘
```

### Technology Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| File input | AvatarUpload.tsx | Existing component |
| HTTP client | Axios | Existing in accountService |
| File upload | FormData + multer | Standard multipart |
| Storage | Cloudflare R2 | S3-compatible |
| ORM | Prisma | Update User.avatarUrl |

### Data Model

**User Table (existing)**
```prisma
model User {
  avatarUrl String? @map("avatar_url")
  // ... other fields
}
```

**R2 Storage Key Pattern**
```
avatars/{userId}/{timestamp}-{filename}
```

Example: `avatars/550e8400-e29b-41d4-a716-446655440000/1704844800000-avatar.png`

### API Specifications

#### POST /api/users/me/avatar

**Purpose:** Upload a new avatar image

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Auth: Bearer token required
- Body: `file` field containing image

**Request Example:**
```typescript
const formData = new FormData();
formData.append('file', avatarFile);

await axios.post('/api/users/me/avatar', formData, {
  headers: {
    'Content-Type': 'multipart/form-data',
    'Authorization': `Bearer ${token}`
  }
});
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "avatarUrl": "https://{account}.r2.cloudflarestorage.com/bucket/avatars/{userId}/{filename}",
    "key": "avatars/{userId}/{timestamp}-{filename}"
  }
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid file type. Accepted types: .jpg, .jpeg, .png, .gif, .webp"
  }
}
```

**Response (413 Payload Too Large):**
```json
{
  "success": false,
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "File is too large. Maximum size is 5MB"
  }
}
```

#### DELETE /api/users/me/avatar

**Purpose:** Remove current avatar

**Request:**
- Method: `DELETE`
- Auth: Bearer token required

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "avatarUrl": null
  }
}
```

### Frontend Service Functions

```typescript
// accountService.ts additions

/**
 * Upload avatar image
 * @param file - Image file to upload
 * @returns URL of uploaded avatar
 */
export const uploadAvatar = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<{ success: boolean; data: { avatarUrl: string } }>(
    '/users/me/avatar',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );

  return response.data.data.avatarUrl;
};

/**
 * Delete current avatar
 */
export const deleteAvatar = async (): Promise<void> => {
  await api.delete('/users/me/avatar');
};
```

### Settings.tsx Integration

```typescript
// Key integration points in Settings.tsx

// 1. Import AvatarUpload component
import { AvatarUpload } from '@/components/features/AvatarUpload';

// 2. Add state for pending avatar
const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
const [avatarRemoved, setAvatarRemoved] = useState(false);

// 3. Handle avatar change
const handleAvatarChange = (file: File | null) => {
  setPendingAvatarFile(file);
  setAvatarRemoved(false);
};

// 4. Handle avatar remove
const handleAvatarRemove = () => {
  setPendingAvatarFile(null);
  setAvatarRemoved(true);
};

// 5. Modify form submit to handle avatar
const onSubmitProfile = async (data: ProfileFormData) => {
  let avatarUrl = profile?.avatarUrl;

  // Upload new avatar if pending
  if (pendingAvatarFile) {
    avatarUrl = await uploadAvatar(pendingAvatarFile);
  } else if (avatarRemoved && profile?.avatarUrl) {
    await deleteAvatar();
    avatarUrl = null;
  }

  // Update profile with new avatar URL
  const updateData: UpdateProfileData = {
    ...data,
    avatarUrl,
  };

  updateProfileMutation.mutate(updateData);
};

// 6. Render AvatarUpload in Account tab
<AvatarUpload
  currentAvatarUrl={profile?.avatarUrl}
  onAvatarChange={handleAvatarChange}
  onAvatarRemove={handleAvatarRemove}
  disabled={updateProfileMutation.isPending}
/>
```

### Backend Implementation

```typescript
// users.routes.ts additions

import multer from 'multer';
import { uploadFile, deleteFile } from '../services/r2Storage.service';

// Multer config for avatar upload
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

/**
 * POST /api/users/me/avatar - Upload avatar
 */
router.post(
  '/me/avatar',
  authenticateSupabase,
  avatarUpload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No file provided' }
        });
      }

      // Get current avatar to delete later
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatarUrl: true },
      });

      // Generate unique key
      const ext = path.extname(req.file.originalname).toLowerCase();
      const key = `avatars/${userId}/${Date.now()}${ext}`;

      // Upload to R2
      const result = await uploadFile(key, req.file.buffer, req.file.mimetype);

      // Update user profile
      await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: result.url },
      });

      // Delete old avatar if exists
      if (currentUser?.avatarUrl) {
        const oldKey = extractKeyFromUrl(currentUser.avatarUrl);
        if (oldKey) await deleteFile(oldKey).catch(() => {});
      }

      res.status(201).json({
        success: true,
        data: { avatarUrl: result.url, key },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/users/me/avatar - Remove avatar
 */
router.delete(
  '/me/avatar',
  authenticateSupabase,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      // Get current avatar
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatarUrl: true },
      });

      if (user?.avatarUrl) {
        // Delete from R2
        const key = extractKeyFromUrl(user.avatarUrl);
        if (key) await deleteFile(key).catch(() => {});

        // Clear from profile
        await prisma.user.update({
          where: { id: userId },
          data: { avatarUrl: null },
        });
      }

      res.json({
        success: true,
        data: { avatarUrl: null },
      });
    } catch (error) {
      next(error);
    }
  }
);
```

### Infrastructure Needs

| Requirement | Current State | Action Needed |
|-------------|---------------|---------------|
| R2 Bucket | Configured | Verify public access for avatars |
| R2 Credentials | In .env | No action |
| CORS | Configured | Verify multipart upload support |

---

## Implementation Plan

### Phase 1: Backend API (Priority: High)

| Task | Estimate | Dependencies |
|------|----------|--------------|
| 1.1 Add multer config for avatar upload | 1h | None |
| 1.2 Implement POST /me/avatar endpoint | 2h | 1.1 |
| 1.3 Implement DELETE /me/avatar endpoint | 1h | None |
| 1.4 Add validation and error handling | 1h | 1.2, 1.3 |
| 1.5 Write unit tests for endpoints | 2h | 1.2, 1.3 |

### Phase 2: Frontend Integration (Priority: High)

| Task | Estimate | Dependencies |
|------|----------|--------------|
| 2.1 Add uploadAvatar to accountService | 0.5h | Phase 1 |
| 2.2 Add deleteAvatar to accountService | 0.5h | Phase 1 |
| 2.3 Integrate AvatarUpload into Settings.tsx | 2h | 2.1, 2.2 |
| 2.4 Implement two-step save logic | 1h | 2.3 |
| 2.5 Add loading and error states | 0.5h | 2.4 |

### Phase 3: Testing & Validation (Priority: Medium)

| Task | Estimate | Dependencies |
|------|----------|--------------|
| 3.1 Run E2E profile-crud tests | 0.5h | Phase 2 |
| 3.2 Fix any failing tests | 1h | 3.1 |
| 3.3 Manual QA testing | 1h | 3.2 |
| 3.4 Performance validation | 0.5h | 3.3 |

### Rollout Plan

1. **Development:** Implement in feature branch
2. **Testing:** Run full E2E suite
3. **Staging:** Deploy to staging environment
4. **Validation:** Manual QA on staging
5. **Production:** Deploy with feature flag (optional)
6. **Monitoring:** Watch error rates and upload metrics

---

## Test Strategy

### Unit Tests

| Test Case | Location | Priority |
|-----------|----------|----------|
| Avatar upload endpoint - valid file | users.routes.test.ts | High |
| Avatar upload endpoint - invalid type | users.routes.test.ts | High |
| Avatar upload endpoint - file too large | users.routes.test.ts | High |
| Avatar delete endpoint | users.routes.test.ts | High |
| uploadAvatar service function | accountService.test.ts | Medium |
| deleteAvatar service function | accountService.test.ts | Medium |

### Integration Tests

| Test Case | Location | Priority |
|-----------|----------|----------|
| Upload avatar and verify in profile | users.integration.test.ts | High |
| Replace avatar (old file deleted) | users.integration.test.ts | Medium |
| Remove avatar and verify null | users.integration.test.ts | High |

### E2E Tests (Existing)

| Test | File | Expected Result |
|------|------|-----------------|
| should upload and update avatar image | profile-crud.spec.ts | Pass |
| should display avatar preview before saving | profile-crud.spec.ts | Pass |
| should handle avatar upload failure gracefully | profile-crud.spec.ts | Pass |
| should limit avatar file size if enforced | profile-crud.spec.ts | Pass |

### Test Data Requirements

| File | Purpose | Location |
|------|---------|----------|
| sample-image.png | Valid avatar upload | e2e/sample-docs/ |
| sample-image.jpg | Alternate format test | e2e/sample-docs/ |
| large-image.png | Size limit test (>5MB) | e2e/sample-docs/ |
| invalid-file.txt | Invalid type test | e2e/sample-docs/ |

---

## Appendix

### Existing Component: AvatarUpload.tsx

**Location:** `quikadmin-web/src/components/features/AvatarUpload.tsx`

**Features Already Implemented:**
- File selection via click or drag-and-drop
- Preview display before save
- File type validation (JPEG, PNG, GIF, WebP)
- File size validation (5MB limit)
- Remove button to clear selection
- Disabled state handling
- Size variants (sm, md, lg)
- Error message display
- Keyboard accessibility (Enter/Space)
- ARIA labels for screen readers

**Test IDs Available:**
- `data-testid="avatar-upload"` - Container
- `data-testid="avatar-image"` - Image/fallback display
- `data-testid="avatar-upload-input"` - Hidden file input
- `data-testid="avatar-upload-button"` - Upload button
- `data-testid="avatar-remove-button"` - Remove button

### R2 Storage Service

**Location:** `quikadmin/src/services/r2Storage.service.ts`

**Available Functions:**
- `uploadFile(key, body, contentType)` - Upload file to R2
- `deleteFile(key)` - Delete file from R2
- `getSignedDownloadUrl(key, expiresIn)` - Generate presigned URL
- `fileExists(key)` - Check if file exists

### Database Schema

**User Model:**
```prisma
model User {
  id             String          @id @default(uuid()) @db.Uuid
  email          String          @unique @db.VarChar(255)
  // ... other fields
  avatarUrl      String?         @map("avatar_url")
  // ... relations
}
```

### References

- [E2E Test Expectations](file://N:/IntelliFill/quikadmin-web/e2e/tests/profile/profile-crud.spec.ts)
- [AvatarUpload Component](file://N:/IntelliFill/quikadmin-web/src/components/features/AvatarUpload.tsx)
- [Settings Page](file://N:/IntelliFill/quikadmin-web/src/pages/Settings.tsx)
- [Account Service](file://N:/IntelliFill/quikadmin-web/src/services/accountService.ts)
- [Users Routes](file://N:/IntelliFill/quikadmin/src/api/users.routes.ts)
- [R2 Storage Service](file://N:/IntelliFill/quikadmin/src/services/r2Storage.service.ts)

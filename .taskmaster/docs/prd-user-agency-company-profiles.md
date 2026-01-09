# PRD: User/Agency/Company Profile System

**Document Version:** 1.0
**Date:** 2026-01-08
**Status:** Ready for Implementation
**Author:** AI Agent Panel (Claude)

---

## 1. Executive Summary

### 1.1 Problem Statement

IntelliFill currently has a functional but limited profile system:
- Users have basic identity fields (`firstName`, `lastName`, `email`)
- `UserProfile` exists but stores **extracted document data**, not personal profiles
- `Organization` model exists but lacks membership roles and team features
- No avatar/photo support for user personalization
- Limited user settings and preferences

### 1.2 Proposed Solution

Implement a comprehensive User/Agency/Company profile system that:
1. Extends User model with personal profile fields (avatar, phone, bio)
2. Enables multi-organization membership with role-based access
3. Provides team invitation and management workflows
4. Enhances user settings with notification and UI preferences

### 1.3 Success Criteria

| Metric | Target |
|--------|--------|
| Registration → First document upload | < 3 minutes |
| Organization creation completion rate | > 80% |
| Invite acceptance rate | > 60% |
| Settings page engagement (first week) | > 40% |

---

## 2. Current State Analysis

### 2.1 Existing Models (Prisma Schema)

| Model | Purpose | Status |
|-------|---------|--------|
| `User` | Core identity, auth | Has basic fields, needs extension |
| `UserProfile` | Aggregated document data | Keep as-is (different purpose) |
| `UserSettings` | Preferences | Needs notification/UI additions |
| `Organization` | Multi-tenancy | Needs branding, membership relation |
| `Client` | B2C form-filling profiles | Keep as-is |
| `ClientProfile` | Client extracted data | Keep as-is |

### 2.2 Existing API Patterns

- **Auth**: Supabase JWT + refresh token cookies
- **Validation**: Zod schemas with `validate()` middleware
- **Response Format**: `{ success: true, data: {...} }`
- **Error Format**: `{ error: "TYPE", message: "...", code: "..." }`

### 2.3 Existing Frontend Patterns

- **Forms**: React Hook Form + Zod + `Form` components
- **State**: Zustand with immer middleware
- **Data Fetching**: React Query `useQuery`/`useMutation`
- **UI**: Radix UI primitives + TailwindCSS
- **Styling**: Glassmorphism cards, semantic tokens

---

## 3. Technical Specification

### 3.1 Database Schema Changes

#### 3.1.1 New Enums

```prisma
enum OrgMemberRole {
  OWNER     // Full control, billing, can delete org
  ADMIN     // Manage members, settings
  MEMBER    // Standard access
  VIEWER    // Read-only access
}

enum MembershipStatus {
  PENDING   // Invited but not accepted
  ACTIVE    // Active member
  SUSPENDED // Temporarily disabled
  LEFT      // User left voluntarily
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
  CANCELLED
}
```

#### 3.1.2 New Model: OrganizationMembership

```prisma
model OrganizationMembership {
  id             String           @id @default(uuid())
  userId         String           @map("user_id")
  user           User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  organizationId String           @map("organization_id")
  organization   Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  role           OrgMemberRole    @default(MEMBER)
  status         MembershipStatus @default(ACTIVE)

  invitedBy      String?          @map("invited_by")
  invitedAt      DateTime?        @map("invited_at")
  joinedAt       DateTime?        @map("joined_at")

  createdAt      DateTime         @default(now()) @map("created_at")
  updatedAt      DateTime         @updatedAt @map("updated_at")

  @@unique([userId, organizationId])
  @@index([userId])
  @@index([organizationId])
  @@index([status])
  @@map("organization_memberships")
}
```

#### 3.1.3 New Model: OrganizationInvitation

```prisma
model OrganizationInvitation {
  id             String           @id @default(uuid())
  organizationId String           @map("organization_id")
  organization   Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  email          String
  role           OrgMemberRole    @default(MEMBER)
  invitedBy      String           @map("invited_by")
  status         InvitationStatus @default(PENDING)
  expiresAt      DateTime         @map("expires_at")
  acceptedAt     DateTime?        @map("accepted_at")
  createdAt      DateTime         @default(now()) @map("created_at")

  @@unique([organizationId, email])
  @@index([email])
  @@index([status])
  @@index([expiresAt])
  @@map("organization_invitations")
}
```

#### 3.1.4 Modify Existing: Organization

Add fields:
```prisma
slug      String  @unique @db.VarChar(100)  // URL-friendly identifier
logoUrl   String? @map("logo_url")          // Branding
website   String? @db.VarChar(255)          // Optional
settings  Json    @default("{}")            // Flexible settings

// New relations
memberships  OrganizationMembership[]
invitations  OrganizationInvitation[]
```

#### 3.1.5 Modify Existing: User

Add fields:
```prisma
avatarUrl   String? @map("avatar_url")
phone       String? @db.VarChar(30)
jobTitle    String? @map("job_title") @db.VarChar(100)
bio         String? @db.VarChar(500)

// New relation
memberships OrganizationMembership[]
```

#### 3.1.6 Modify Existing: UserSettings

Add fields:
```prisma
notifyOnProcessComplete Boolean @default(true) @map("notify_on_process_complete")
notifyOnOrgInvite       Boolean @default(true) @map("notify_on_org_invite")
digestFrequency         String  @default("never") @map("digest_frequency") @db.VarChar(20)
theme                   String  @default("system") @db.VarChar(20)
compactMode             Boolean @default(false) @map("compact_mode")
```

### 3.2 API Endpoints

#### 3.2.1 Organization Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/api/organizations` | Create organization | User |
| GET | `/api/organizations/me` | Get current user's org | User |
| PATCH | `/api/organizations/:id` | Update org | Admin |
| DELETE | `/api/organizations/:id` | Delete org | Owner |

#### 3.2.2 Membership Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/organizations/:id/members` | List members | Member |
| POST | `/api/organizations/:id/members/invite` | Invite member | Admin |
| PATCH | `/api/organizations/:id/members/:userId` | Change role | Admin |
| DELETE | `/api/organizations/:id/members/:userId` | Remove member | Admin |

#### 3.2.3 Invitation Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/invites/:token` | Validate invite | Public |
| POST | `/api/invites/:token/accept` | Accept invite | User |
| DELETE | `/api/organizations/:id/invites/:id` | Cancel invite | Admin |

#### 3.2.4 User Settings Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/users/me/settings` | Get settings | User |
| PATCH | `/api/users/me/settings` | Update settings | User |

### 3.3 Frontend Components

#### 3.3.1 New Pages

| Page | Route | Purpose |
|------|-------|---------|
| `AccountProfilePage` | `/settings` (Account tab) | Edit personal info |
| Organization Tab | `/settings` (Org tab) | Manage organization |
| `AcceptInvitePage` | `/accept-invite` | Handle invitation acceptance |

#### 3.3.2 New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `AvatarUpload` | `components/features/` | Profile picture upload |
| `InviteMemberModal` | `components/features/` | Team invitation form |
| `MembersList` | `components/features/` | Organization members table |
| `OrganizationCard` | `components/features/` | Org info display |

#### 3.3.3 New Stores

| Store | Purpose |
|-------|---------|
| `accountStore.ts` | User account update operations |
| `organizationStore.ts` | Organization state (if complex) |

#### 3.3.4 New Services

| Service | Purpose |
|---------|---------|
| `accountService.ts` | User profile API calls |
| `organizationService.ts` | Organization/membership APIs |

### 3.4 Validation Schemas

#### 3.4.1 Organization Schemas (Zod)

```typescript
// organizationSchemas.ts
const createOrganizationSchema = z.object({
  name: z.string().min(2).max(100).trim()
});

const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});

const inviteMemberSchema = z.object({
  email: z.string().email().toLowerCase(),
  role: z.enum(['MEMBER', 'VIEWER']).default('MEMBER')
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER'])
});
```

#### 3.4.2 Account Schemas (Zod)

```typescript
// accountSchemas.ts
const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  phone: z.string().max(30).optional(),
  jobTitle: z.string().max(100).optional(),
  bio: z.string().max(500).optional()
});

const updateSettingsSchema = z.object({
  preferredLanguage: z.string().length(2).optional(),
  emailNotifications: z.boolean().optional(),
  timezone: z.string().max(50).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  compactMode: z.boolean().optional()
});
```

---

## 4. User Flows

### 4.1 Post-Registration Flow

```
Registration Complete
        ↓
Redirect to /dashboard (NO wizard)
        ↓
Dashboard with empty state CTA: "Upload your first document"
        ↓
Optional sidebar prompt: "Complete your profile for faster form-filling"
```

**Rationale:** Show value first, ask for info later.

### 4.2 Profile Editing Flow

```
User clicks avatar in sidebar OR navigates to /settings
        ↓
Settings Page - Account Tab
  - Display name (editable)
  - Email (read-only with verified badge)
  - Phone (optional)
  - [Change Password] button
  - [Delete Account] (danger zone)
        ↓
Inline Save / Auto-save
```

### 4.3 Organization Creation Flow

```
User navigates to Settings > Organization tab
        ↓
If no org: "Create Organization" CTA
        ↓
Modal: Enter Organization Name (single field)
        ↓
Success: User becomes Admin of new org
```

### 4.4 Team Invitation Flow

```
Admin clicks "Invite Members"
        ↓
Invite Modal: Email + Role dropdown
        ↓
System sends magic link email
        ↓
Invited user clicks link → /accept-invite?token=xxx
        ↓
If logged in: Auto-join, redirect to dashboard
If not logged in: Login/Register → Auto-join
```

### 4.5 Role Management Flow

```
Admin views Organization Members
        ↓
Member List Table: Name | Email | Role | Status | Actions
        ↓
Change Role Dropdown: Admin | Member | Viewer
        ↓
Confirmation (if demoting)
```

---

## 5. Implementation Phases

### Phase 1: Database & Backend Foundation (Week 1)

**Tasks:**
1. Create Prisma migration with new enums and models
2. Extend User, Organization, UserSettings models
3. Generate slug backfill script for existing organizations
4. Create membership records for users with existing organizationId
5. Add `requireOrgAdmin` middleware
6. Create organizationSchemas.ts and settingsSchemas.ts

**Files to Create/Modify:**
- `quikadmin/prisma/schema.prisma` - Add models and fields
- `quikadmin/src/middleware/organizationContext.ts` - Add requireOrgAdmin
- `quikadmin/src/validators/schemas/organizationSchemas.ts` - NEW
- `quikadmin/src/validators/schemas/settingsSchemas.ts` - NEW

### Phase 2: API Layer (Week 1-2)

**Tasks:**
1. Create organization.routes.ts with CRUD endpoints
2. Create membership sub-routes
3. Create invitation endpoints
4. Add settings endpoints to users.routes.ts
5. Register routes in routes.ts

**Files to Create/Modify:**
- `quikadmin/src/api/organization.routes.ts` - NEW
- `quikadmin/src/api/users.routes.ts` - Add settings endpoints
- `quikadmin/src/api/routes.ts` - Register new routes

### Phase 3: Frontend - Account Profile (Week 2)

**Tasks:**
1. Create accountService.ts
2. Create accountStore.ts
3. Enhance Settings > Account tab with editable fields
4. Create AvatarUpload component
5. Add Zod validation schemas

**Files to Create/Modify:**
- `quikadmin-web/src/services/accountService.ts` - NEW
- `quikadmin-web/src/stores/accountStore.ts` - NEW
- `quikadmin-web/src/components/features/avatar-upload.tsx` - NEW
- `quikadmin-web/src/pages/Settings.tsx` - Enhance Account tab
- `quikadmin-web/src/lib/validations/account.ts` - NEW

### Phase 4: Frontend - Organization (Week 3)

**Tasks:**
1. Create organizationService.ts
2. Add Organization tab to Settings page
3. Create organization creation modal
4. Create MembersList component
5. Create InviteMemberModal component

**Files to Create/Modify:**
- `quikadmin-web/src/services/organizationService.ts` - NEW
- `quikadmin-web/src/components/features/members-list.tsx` - NEW
- `quikadmin-web/src/components/features/invite-member-modal.tsx` - NEW
- `quikadmin-web/src/pages/Settings.tsx` - Add Organization tab

### Phase 5: Invitation System (Week 3-4)

**Tasks:**
1. Create AcceptInvitePage
2. Add invitation email sending (stub for MVP)
3. Implement invitation acceptance flow
4. Handle logged in vs not logged in states
5. Add route to App.tsx

**Files to Create/Modify:**
- `quikadmin-web/src/pages/AcceptInvitePage.tsx` - NEW
- `quikadmin-web/src/routes/index.tsx` - Add route
- `quikadmin/src/services/EmailService.ts` - Add invitation template

### Phase 6: Polish & Testing (Week 4)

**Tasks:**
1. Add loading states (Skeleton components)
2. Add error states (Alert components)
3. Add empty states (EmptyState component)
4. Mobile responsiveness testing
5. Edge case handling (last admin, etc.)
6. Unit tests for new endpoints
7. Integration tests for invitation flow

---

## 6. What We Explicitly Chose NOT to Include

| Feature | Reason |
|---------|--------|
| Profile photo on registration | Zero value for doc processing, adds friction |
| Multi-step onboarding wizard | Users want to see value first |
| Multiple organizations per user | Complexity; defer until requested |
| Custom roles beyond enum | 4 roles cover 95% of use cases |
| Granular permission matrix UI | Over-engineering for MVP |
| Organization logo upload | Nice-to-have, not MVP |
| SSO/SAML | Enterprise feature for later tier |
| Organization billing | Separate feature, not profile scope |
| Activity audit log UI | Backend logs exist; defer UI |
| Department hierarchy | Over-engineering for MVP |
| Profile completeness tracking | Can be computed, no need to store |

---

## 7. Technical Dependencies

### 7.1 Existing Libraries (Already Installed)

- `@radix-ui/react-avatar` - Avatar component base
- `react-hook-form` + `@hookform/resolvers` + `zod` - Form handling
- `@tanstack/react-query` - Data fetching
- `zustand` + `immer` - State management
- `sonner` - Toast notifications
- `framer-motion` - Animations

### 7.2 No New Libraries Required

All functionality can be implemented with existing dependencies.

---

## 8. Migration Strategy

### 8.1 Database Migration

```bash
# Phase 1: Non-breaking additions (all nullable or with defaults)
npx prisma migrate dev --name add_profile_organization_features
```

### 8.2 Data Backfill Script

```sql
-- Generate slugs for existing organizations
UPDATE organizations
SET slug = LOWER(REPLACE(name, ' ', '-')) || '-' || SUBSTRING(id, 1, 8)
WHERE slug IS NULL;

-- Create memberships for users with existing organizationId
INSERT INTO organization_memberships (id, user_id, organization_id, role, status, joined_at)
SELECT
  gen_random_uuid(), id, organization_id, 'MEMBER', 'ACTIVE', created_at
FROM users
WHERE organization_id IS NOT NULL
ON CONFLICT (user_id, organization_id) DO NOTHING;
```

### 8.3 Feature Flags (Optional)

If gradual rollout desired:
```typescript
// Feature flag in user settings or env
ENABLE_ORGANIZATION_FEATURES=true
```

---

## 9. Security Considerations

1. **Authorization**: All org endpoints check membership and role
2. **Last Admin Protection**: Cannot demote/remove last admin
3. **Invitation Expiry**: Invitations expire after 7 days
4. **Rate Limiting**: Apply existing rate limits to new endpoints
5. **Audit Logging**: Use existing global audit middleware
6. **Input Validation**: Zod schemas on all inputs

---

## 10. Acceptance Criteria

### 10.1 User Profile

- [ ] User can update display name, phone, bio in Settings
- [ ] User can upload/change avatar
- [ ] User can remove avatar
- [ ] Changes persist after page refresh

### 10.2 Organization

- [ ] User can create organization with just a name
- [ ] Creator becomes ADMIN automatically
- [ ] Admin can update organization name
- [ ] Admin can invite members via email
- [ ] Admin can change member roles
- [ ] Admin can remove members
- [ ] Member can view organization and members
- [ ] Member can leave organization
- [ ] Last admin cannot demote self or leave

### 10.3 Invitation

- [ ] Admin can send invitation
- [ ] Invitee receives email with magic link
- [ ] Logged-in user can accept invitation
- [ ] Non-logged-in user is prompted to login/register
- [ ] After acceptance, user is member of organization
- [ ] Admin can cancel pending invitations
- [ ] Expired invitations show appropriate message

### 10.4 Settings

- [ ] User can update notification preferences
- [ ] User can change theme (light/dark/system)
- [ ] User can toggle compact mode
- [ ] Settings changes persist

---

## 11. Appendix

### 11.1 Research Sources

- Notion's Lightweight Onboarding patterns
- Linear's team invitation UX
- Vercel's organization management
- RBAC best practices guides

### 11.2 Related Documents

- UX Flow Design: `docs/ux-research/profile-organization-flows.md`
- Existing Schema: `quikadmin/prisma/schema.prisma`
- API Patterns: `quikadmin/src/api/*.routes.ts`

---

**Document Prepared By:** AI Agent Panel (5 specialized agents)
**Review Required By:** Product Owner, Tech Lead
**Implementation Start:** Upon approval

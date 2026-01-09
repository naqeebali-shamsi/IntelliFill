# PRD: Organization Features E2E Test Fixes

**Document Version**: 1.0
**Created**: 2026-01-09
**Priority**: MEDIUM
**Status**: Draft
**Author**: AI Assistant (Claude)

---

## Executive Summary

### Problem Statement

12 end-to-end tests related to organization features are failing in the IntelliFill test suite. These tests cover critical organization lifecycle management (7 tests) and member management functionality (5 tests). The failures are caused by a combination of missing `data-testid` attributes, incomplete test fixtures, selector mismatches between tests and actual components, and missing test seeding for organization/member data.

### Solution Overview

This PRD defines the fixes required to align the E2E test infrastructure with the existing backend and frontend implementations. The approach focuses on three areas:
1. Adding missing `data-testid` attributes to frontend components
2. Enhancing test fixtures to properly seed organizations and members
3. Updating test selectors in page objects and spec files to match actual component structure

### Business Impact

- **Quality Assurance**: Functional organization E2E tests ensure reliable team collaboration features
- **Development Velocity**: Passing tests enable confident CI/CD deployments
- **Feature Validation**: Tests validate role-based access control (RBAC) is working correctly

### Resource Requirements

- **Estimated Effort**: 2-3 developer days
- **Dependencies**: No external dependencies; uses existing infrastructure
- **Skills Required**: TypeScript, Playwright, React testing patterns

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Selector changes break other tests | Medium | Medium | Use `data-testid` attributes exclusively |
| Test fixture conflicts in parallel runs | Low | High | Worker-scoped resource tracking already in place |
| Backend API changes | Low | Medium | Tests already use existing stable API |

---

## Product Overview

### Product Vision

The organization features enable IntelliFill users to create and manage team workspaces, invite members with role-based permissions, and collaborate on document processing. E2E tests must validate the complete user journey for these critical multi-tenant features.

### Target Users

1. **Admin Users**: Create organizations, invite members, manage settings
2. **Owner Users**: Full organization control including deletion
3. **Member Users**: Standard access to organization resources
4. **Viewer Users**: Read-only access to organization content

### Value Proposition

Reliable E2E tests for organization features ensure:
- Team collaboration features work as designed
- Role-based access control is enforced correctly
- Organization lifecycle (create, update, delete) functions properly
- Member invitation and acceptance flows complete successfully

### Success Criteria

| Metric | Target | Current | Measurement Method |
|--------|--------|---------|-------------------|
| Organization Lifecycle Tests Passing | 7/7 | 0/7 | `bun run test:e2e` |
| Member Management Tests Passing | 5/5 | 0/5 | `bun run test:e2e` |
| Test Execution Time | <60s per test | N/A | Playwright reporter |
| Flakiness Rate | <5% | N/A | CI/CD retry metrics |

### Assumptions

1. Backend organization API endpoints are fully functional (verified by existing unit tests)
2. Frontend components render correctly in non-test environments
3. Test user seeding script (`seed-e2e-users.ts`) can be extended for organization data
4. Storage state authentication fixtures work correctly for all roles

---

## Functional Requirements

### 1. Organization Lifecycle Tests (E2E-012)

#### FR-1.1: Create Organization Flow

**Description**: Test the complete flow of creating a new organization from the settings page.

**User Stories**:

```
As an authenticated user without an organization,
I want to create a new organization
So that I can collaborate with my team.

Acceptance Criteria:
Given I am on the Settings > Organization tab
And I do not belong to any organization
When I click "Create Organization"
And I enter a valid organization name
And I click "Create"
Then the organization should be created
And I should become the OWNER of the organization
And the organization details should be displayed
```

**Technical Requirements**:
- Add `data-testid="create-org-button"` to EmptyState action button
- Add `data-testid="org-name-input"` to organization name input field
- Add `data-testid="create-org-submit"` to form submit button
- Verify API response includes `role: 'OWNER'`

#### FR-1.2: Required Field Validation

**Description**: Verify that organization creation requires a name.

**User Stories**:

```
As a user creating an organization,
I want to see validation errors when I submit incomplete data
So that I understand what is required.

Acceptance Criteria:
Given I am on the "Create Organization" form
When I click "Create" without entering a name
Then I should see a validation error
And the form should not submit
And the error should indicate the name is required
```

**Technical Requirements**:
- Add `data-testid="org-name-error"` to validation error message
- Ensure form submission is prevented when name is empty
- Add `aria-invalid="true"` to input when validation fails

#### FR-1.3: Prevent Duplicate Organization Names

**Description**: Validate server-side duplicate name handling.

**User Stories**:

```
As a user creating an organization,
I want to be prevented from using a name that already exists
So that organization names remain unique.

Acceptance Criteria:
Given an organization named "Test Organization" exists
When I try to create an organization with the same name
Then I should see an error message
And the organization should not be created
```

**Technical Requirements**:
- Backend returns 400/409 for duplicate names
- Frontend displays server error in `[role="alert"]` element
- Add `data-testid="org-create-error"` to error alert

#### FR-1.4: Update Organization Settings

**Description**: Test updating organization name and settings.

**User Stories**:

```
As an organization admin or owner,
I want to update my organization's settings
So that I can keep information current.

Acceptance Criteria:
Given I am an ADMIN or OWNER of an organization
When I click "Edit" on the organization details
And I modify the organization name
And I click "Save"
Then the changes should be persisted
And a success message should be displayed
And the updated name should be visible after page reload
```

**Technical Requirements**:
- Add `data-testid="org-edit-button"` to edit button
- Add `data-testid="org-name-input"` to inline edit input (reuse)
- Add `data-testid="org-save-button"` to save button
- Add `data-testid="org-cancel-button"` to cancel button

#### FR-1.5: Settings Persistence Across Sessions

**Description**: Verify organization settings persist after session refresh.

**User Stories**:

```
As an organization member,
I want my organization settings to persist across sessions
So that I don't lose configuration.

Acceptance Criteria:
Given I have updated organization settings
When I clear session storage
And I reload the page
Then the organization settings should still reflect my changes
```

**Technical Requirements**:
- Test clears `sessionStorage` but not `localStorage`
- Reload page and verify organization name matches
- Database is source of truth, not local storage

#### FR-1.6: Show Member List in Organization Settings

**Description**: Display list of organization members.

**User Stories**:

```
As an organization member,
I want to see the list of team members
So that I know who has access to our organization.

Acceptance Criteria:
Given I am on the Organization settings tab
And my organization has multiple members
When the page loads
Then I should see a list of all members
And each member should show their name, email, and role
And the current user should be marked "(you)"
```

**Technical Requirements**:
- Add `data-testid="members-list"` to MembersList component wrapper
- Add `data-testid="member-row"` to each TableRow in MembersList
- Add `data-testid="member-role-{userId}"` to role badges/selects
- Member count should be >= 1 (at least the owner)

#### FR-1.7: Organization Deletion Requires Confirmation

**Description**: Verify deletion requires explicit confirmation.

**User Stories**:

```
As an organization owner,
I want deletion to require confirmation
So that I don't accidentally delete my organization.

Acceptance Criteria:
Given I am the OWNER of an organization
When I click "Delete Organization"
Then a confirmation dialog should appear
And it should warn about permanent data loss
When I click "Cancel"
Then the dialog should close
And the organization should remain
```

**Technical Requirements**:
- Add `data-testid="delete-org-button"` to delete button
- Add `data-testid="delete-org-dialog"` to AlertDialog
- Add `data-testid="delete-org-confirm"` to confirm button
- Add `data-testid="delete-org-cancel"` to cancel button

#### FR-1.8: 404 for Deleted Organization

**Description**: Verify accessing deleted organization returns 404.

**User Stories**:

```
As a user,
I want to see a 404 error when accessing a deleted organization
So that I know the organization no longer exists.

Acceptance Criteria:
Given an organization has been deleted
When I try to access its settings via direct URL
Then I should see a 404 error or be redirected
```

**Technical Requirements**:
- Test uses fake UUID to simulate deleted org
- Frontend should show 404 page or redirect to dashboard
- Add route handling for `/organizations/:id/*` with invalid ID

---

### 2. Member Management Tests (E2E-019, E2E-020)

#### FR-2.1: Complete Member Invitation Flow

**Description**: Test the full invitation lifecycle from sending to acceptance.

**User Stories**:

```
As an organization admin,
I want to invite new members to my organization
So that they can collaborate with the team.

Acceptance Criteria:
Given I am an ADMIN or OWNER of an organization
And I am on the Organization settings tab
When I click "Invite Member"
And I enter a valid email address
And I select a role
And I click "Send Invitation"
Then an invitation should be created
And a success message should appear
And the pending invitation should be visible in the member list
```

**Technical Requirements**:
- Add `data-testid="invite-member-button"` to invite button (use existing `addMemberButton`)
- Add `data-testid="invite-email-input"` to email field in InviteMemberModal
- Add `data-testid="invite-role-select"` to role select in InviteMemberModal
- Add `data-testid="invite-submit-button"` to submit button
- Add `data-testid="invite-success-message"` to success alert

#### FR-2.2: Prevent Duplicate Invitations

**Description**: Verify system prevents inviting the same email twice.

**User Stories**:

```
As an organization admin,
I want to be prevented from sending duplicate invitations
So that members don't receive multiple invitation emails.

Acceptance Criteria:
Given a pending invitation exists for "member@test.com"
When I try to invite "member@test.com" again
Then I should see an error message
And no duplicate invitation should be created
```

**Technical Requirements**:
- Backend returns 409 CONFLICT for duplicate email
- Frontend displays error in InviteMemberModal
- Add `data-testid="invite-error-message"` to error alert

#### FR-2.3: Admin-Only Features Visibility

**Description**: Verify admin/owner exclusive features are visible to appropriate roles.

**User Stories**:

```
As an organization admin or owner,
I want to see member management controls
So that I can manage my team.

Acceptance Criteria:
Given I am logged in as ADMIN or OWNER
When I view the Organization settings tab
Then I should see the "Invite Member" button
And I should see role change dropdowns for members
And I should see remove member options
```

**Technical Requirements**:
- `data-testid="invite-member-button"` visible for ADMIN/OWNER
- Role change Select components visible for manageable members
- Remove member dropdown items visible where permitted

#### FR-2.4: Role-Based UI Rendering (Member View)

**Description**: Verify members see restricted UI.

**User Stories**:

```
As an organization member (non-admin),
I want to see a read-only view of organization settings
So that I can view but not modify team configuration.

Acceptance Criteria:
Given I am logged in as MEMBER role
When I view the Organization settings tab
Then I should NOT see the "Invite Member" button
And I should see member list in read-only format
And role badges should be displayed instead of dropdowns
```

**Technical Requirements**:
- Test uses `memberPage` fixture (MEMBER role)
- `data-testid="invite-member-button"` should NOT be visible
- Role displayed as Badge, not Select for non-manageable members

#### FR-2.5: Read-Only View for Viewer Role

**Description**: Verify viewers have minimal access.

**User Stories**:

```
As an organization viewer,
I want to see a minimal read-only view
So that I can see organization information without modification options.

Acceptance Criteria:
Given I am logged in as VIEWER role
When I view the Organization settings tab
Then I should NOT see the "Invite Member" button
Then I should NOT see any "Delete" buttons
And I should see the member list in read-only format
```

**Technical Requirements**:
- Test uses `viewerPage` fixture (VIEWER role)
- No delete buttons should be visible (`button:has-text("Delete")` count = 0)
- Organization details displayed but edit button hidden

---

## Non-Functional Requirements

### NFR-1: Performance

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Test execution time (per test) | <30 seconds | Playwright timing |
| API response time in tests | <2 seconds | Network timing |
| Page load after navigation | <3 seconds | LCP metric |

### NFR-2: Reliability

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Test flakiness rate | <5% | Retry count / total runs |
| Parallel test isolation | 100% | No cross-contamination |
| Authentication fixture success | >99% | Auth failures / attempts |

### NFR-3: Maintainability

| Requirement | Implementation |
|-------------|----------------|
| Selector strategy | Use `data-testid` exclusively for test selectors |
| Page Object Pattern | All selectors defined in SettingsPage.ts |
| Fixture isolation | Worker-scoped resources via org.fixture.ts |
| Test data management | Dedicated test-users.json and seeding scripts |

### NFR-4: Accessibility

| Requirement | Standard |
|-------------|----------|
| Form validation | `aria-invalid`, `aria-describedby` for errors |
| Dialog accessibility | `role="dialog"`, `role="alertdialog"` |
| Focus management | Focus trapped in modals, returned on close |
| Status announcements | `role="status"` for success, `role="alert"` for errors |

---

## Technical Considerations

### Architecture Overview

```
E2E Test Architecture
----------------------

quikadmin-web/e2e/
├── fixtures/
│   ├── index.ts              # Central fixture exports
│   ├── auth.fixture.ts       # Authentication fixtures (viewer/member/admin/owner)
│   └── org.fixture.ts        # Organization fixtures, extends auth
│
├── pages/
│   ├── BasePage.ts           # Base page object with common methods
│   ├── SettingsPage.ts       # Settings page selectors (UPDATE NEEDED)
│   └── LoginPage.ts          # Login page object
│
├── helpers/
│   ├── api.helper.ts         # API request helpers
│   └── mock.helper.ts        # Network mocking helpers
│
├── data/
│   ├── index.ts              # Test data exports
│   ├── test-users.json       # User credentials (UPDATE NEEDED)
│   └── test-templates.json   # Template test data
│
├── tests/
│   └── organization/
│       ├── org-lifecycle.spec.ts       # E2E-012 tests
│       └── member-management.spec.ts   # E2E-019, E2E-020 tests
│
└── .auth/                    # Cached storage states (gitignored)
```

### Data Testid Attributes Required

The following `data-testid` attributes must be added to frontend components:

#### OrganizationTabContent.tsx

```typescript
// Empty state - Create Organization button
<EmptyState
  action={{
    label: 'Create Organization',
    onClick: () => setShowCreateForm(true),
    icon: Building2,
    'data-testid': 'create-org-button',  // ADD
  }}
/>

// Create form - Organization name input
<Input
  id="org-name"
  data-testid="org-name-input"  // ADD
  value={newOrgName}
  onChange={(e) => setNewOrgName(e.target.value)}
/>

// Create form - Submit button
<Button
  data-testid="create-org-submit"  // ADD
  onClick={handleCreateOrganization}
>
  Create
</Button>

// Organization details - Edit button
<Button
  data-testid="org-edit-button"  // ADD
  onClick={() => setIsEditing(true)}
>
  <Settings className="mr-2 h-4 w-4" />
  Edit
</Button>

// Organization details - Save button (inline edit)
<Button
  data-testid="org-save-button"  // ADD
  size="sm"
  onClick={handleSaveOrganization}
>
  Save
</Button>

// Organization details - Cancel button (inline edit)
<Button
  data-testid="org-cancel-button"  // ADD
  size="sm"
  variant="outline"
  onClick={() => setIsEditing(false)}
>
  Cancel
</Button>

// Invite Member button
<Button
  data-testid="invite-member-button"  // ADD
  size="sm"
  onClick={() => setShowInviteModal(true)}
>
  <UserPlus className="mr-2 h-4 w-4" />
  Invite Member
</Button>

// Delete Organization button
<Button
  data-testid="delete-org-button"  // ADD
  variant="destructive"
  size="sm"
  onClick={() => setShowDeleteDialog(true)}
>
  <Trash2 className="mr-2 h-4 w-4" />
  Delete
</Button>

// Delete confirmation dialog
<AlertDialogContent data-testid="delete-org-dialog">  // ADD

// Delete confirm button
<AlertDialogAction
  data-testid="delete-org-confirm"  // ADD
  onClick={handleDeleteOrganization}
>
  Delete Organization
</AlertDialogAction>

// Delete cancel button
<AlertDialogCancel data-testid="delete-org-cancel">  // ADD
  Cancel
</AlertDialogCancel>
```

#### MembersList.tsx

```typescript
// Table wrapper
<div
  data-testid="members-list"  // ADD
  className="hidden md:block rounded-lg border overflow-hidden"
>

// Each member row
<TableRow
  key={member.id}
  data-testid="member-row"  // ADD
  data-user-id={member.userId}  // ADD for debugging
>

// Role badge/select
<Badge
  data-testid={`member-role-${member.userId}`}  // ADD
  variant={roleConfig[member.role].variant}
>
```

#### InviteMemberModal.tsx

```typescript
// Email input
<Input
  id="email"
  data-testid="invite-email-input"  // ADD
  type="email"
  placeholder="colleague@example.com"
  {...register('email')}
/>

// Role select
<Select
  data-testid="invite-role-select"  // ADD
  value={selectedRole}
  onValueChange={(value) => setValue('role', value)}
>

// Submit button
<Button
  data-testid="invite-submit-button"  // ADD
  type="submit"
  disabled={isSubmitting}
>
  Send Invitation
</Button>

// Success alert
<Alert
  data-testid="invite-success-message"  // ADD
  className="bg-success/10 border-success/20"
>
  Invitation sent successfully!
</Alert>

// Error alert
<Alert
  data-testid="invite-error-message"  // ADD
  variant="destructive"
>
  <AlertDescription>{error}</AlertDescription>
</Alert>
```

### Test Fixture Updates

#### Update test-users.json

```json
{
  "testUsers": {
    "admin": {
      "email": "e2e-admin@intellifill.local",
      "password": "E2ETestPassword123!",
      "name": "E2E Admin User",
      "role": "ADMIN",
      "organizationId": "e2e-test-org-1"
    },
    "owner": {
      "email": "e2e-owner@intellifill.local",
      "password": "E2ETestPassword123!",
      "name": "E2E Owner User",
      "role": "OWNER",
      "organizationId": "e2e-test-org-1"
    },
    "member": {
      "email": "e2e-member@intellifill.local",
      "password": "E2ETestPassword123!",
      "name": "E2E Member User",
      "role": "MEMBER",
      "organizationId": "e2e-test-org-1"
    },
    "viewer": {
      "email": "e2e-viewer@intellifill.local",
      "password": "E2ETestPassword123!",
      "name": "E2E Viewer User",
      "role": "VIEWER",
      "organizationId": "e2e-test-org-1"
    }
  }
}
```

#### Update seed-e2e-users.ts

Add organization and membership seeding:

```typescript
// Seed E2E test organization
const testOrg = await prisma.organization.upsert({
  where: { slug: 'e2e-test-org' },
  create: {
    id: 'e2e-test-org-1',
    name: 'E2E Test Organization',
    slug: 'e2e-test-org',
    status: 'ACTIVE',
  },
  update: {
    name: 'E2E Test Organization',
    status: 'ACTIVE',
  },
});

// Create memberships for each test user
const users = [
  { email: 'e2e-owner@intellifill.local', role: 'OWNER' },
  { email: 'e2e-admin@intellifill.local', role: 'ADMIN' },
  { email: 'e2e-member@intellifill.local', role: 'MEMBER' },
  { email: 'e2e-viewer@intellifill.local', role: 'VIEWER' },
];

for (const userData of users) {
  const user = await prisma.user.findUnique({
    where: { email: userData.email },
  });

  if (user) {
    await prisma.organizationMembership.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: testOrg.id,
        },
      },
      create: {
        userId: user.id,
        organizationId: testOrg.id,
        role: userData.role,
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
      update: {
        role: userData.role,
        status: 'ACTIVE',
      },
    });

    // Update user's organizationId
    await prisma.user.update({
      where: { id: user.id },
      data: { organizationId: testOrg.id },
    });
  }
}
```

### Update SettingsPage.ts Selectors

```typescript
// Updated selectors object
readonly selectors = {
  // Organization settings - Use data-testid exclusively
  createOrgButton: '[data-testid="create-org-button"]',
  orgNameInput: '[data-testid="org-name-input"]',
  createOrgSubmit: '[data-testid="create-org-submit"]',
  orgEditButton: '[data-testid="org-edit-button"]',
  orgSaveButton: '[data-testid="org-save-button"]',
  orgCancelButton: '[data-testid="org-cancel-button"]',
  deleteOrgButton: '[data-testid="delete-org-button"]',
  deleteOrgDialog: '[data-testid="delete-org-dialog"]',
  deleteOrgConfirm: '[data-testid="delete-org-confirm"]',
  deleteOrgCancel: '[data-testid="delete-org-cancel"]',

  // Member management
  inviteMemberButton: '[data-testid="invite-member-button"]',
  inviteEmailInput: '[data-testid="invite-email-input"]',
  inviteRoleSelect: '[data-testid="invite-role-select"]',
  inviteSubmitButton: '[data-testid="invite-submit-button"]',
  inviteSuccessMessage: '[data-testid="invite-success-message"]',
  inviteErrorMessage: '[data-testid="invite-error-message"]',
  membersList: '[data-testid="members-list"]',
  memberRow: '[data-testid="member-row"]',

  // ... existing selectors
};
```

### Integration Requirements

#### API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/organizations` | POST | Create organization |
| `/api/organizations/me` | GET | Get current user's organization |
| `/api/organizations/:id` | PATCH | Update organization |
| `/api/organizations/:id` | DELETE | Delete organization |
| `/api/organizations/:id/members` | GET | List members |
| `/api/organizations/:id/members/invite` | POST | Send invitation |
| `/api/organizations/:id/members/:userId` | DELETE | Remove member |
| `/api/invites/:token` | GET | Validate invitation |
| `/api/invites/:token/accept` | POST | Accept invitation |

All endpoints are implemented and have unit test coverage.

### Infrastructure Needs

1. **Test Database Reset**: Add organization/membership cleanup to `global.teardown.ts`
2. **Storage State Refresh**: Ensure auth states include organizationId claim
3. **CI Pipeline**: Add organization seeding step before E2E test run

---

## User Story Development

### US-1: Create Organization

```
As a new IntelliFill user,
I want to create an organization
So that I can invite my team members.

Acceptance Criteria:
Given I am authenticated
And I do not belong to any organization
When I navigate to Settings > Organization
Then I should see a "Create Organization" button
When I click the button
And I enter organization name "My Company"
And I click "Create"
Then the organization should be created
And I should be assigned the OWNER role
And I should see the organization details

Story Points: 3
Priority: High
Dependencies: None
```

### US-2: Invite Team Member

```
As an organization admin,
I want to invite team members via email
So that they can join my organization.

Acceptance Criteria:
Given I am an ADMIN or OWNER of an organization
When I click "Invite Member"
And I enter a valid email "colleague@example.com"
And I select role "Member"
And I click "Send Invitation"
Then the invitation should be created
And a success message should appear
And the invite should be visible in pending list

Story Points: 5
Priority: High
Dependencies: US-1 (organization exists)
```

### US-3: Role-Based Access Control

```
As a product owner,
I want users to see different UI based on their role
So that unauthorized actions are prevented.

Acceptance Criteria:
Given a VIEWER role user
When they view Organization settings
Then they should NOT see:
  - Invite Member button
  - Delete Organization button
  - Edit Organization button
  - Role change dropdowns
And they SHOULD see:
  - Organization details (read-only)
  - Member list (read-only)

Story Points: 3
Priority: High
Dependencies: US-1 (organization with members)
```

### US-4: Organization Deletion

```
As an organization owner,
I want to delete my organization
So that I can remove it when no longer needed.

Acceptance Criteria:
Given I am the OWNER of an organization
When I click "Delete Organization"
Then a confirmation dialog should appear
When I click "Delete"
Then the organization should be deleted
And all memberships should be removed
And I should be redirected to dashboard

Story Points: 3
Priority: Medium
Dependencies: US-1 (organization exists)
```

### Story Quality Checklist

| Criteria | US-1 | US-2 | US-3 | US-4 |
|----------|------|------|------|------|
| Independent | Y | Partial | N | N |
| Negotiable | Y | Y | Y | Y |
| Valuable | Y | Y | Y | Y |
| Estimable | Y | Y | Y | Y |
| Small | Y | Y | Y | Y |
| Testable | Y | Y | Y | Y |

---

## Implementation Blueprint

### Development Roadmap

#### Phase 1: Frontend Component Updates (Day 1)

| Task | File | Effort |
|------|------|--------|
| Add data-testid to OrganizationTabContent | `OrganizationTabContent.tsx` | 30min |
| Add data-testid to MembersList | `MembersList.tsx` | 20min |
| Add data-testid to InviteMemberModal | `InviteMemberModal.tsx` | 20min |
| Update EmptyState component for testid prop | `empty-state.tsx` | 15min |
| Verify AlertDialog supports data-testid | `alert-dialog.tsx` | 10min |

#### Phase 2: Test Fixture Updates (Day 1-2)

| Task | File | Effort |
|------|------|--------|
| Update test-users.json with org data | `data/test-users.json` | 15min |
| Extend seed script for organizations | `seed-e2e-users.ts` | 45min |
| Update SettingsPage selectors | `pages/SettingsPage.ts` | 30min |
| Add member count method to SettingsPage | `pages/SettingsPage.ts` | 15min |

#### Phase 3: Test Specification Updates (Day 2)

| Task | File | Effort |
|------|------|--------|
| Update org-lifecycle.spec.ts selectors | `tests/organization/org-lifecycle.spec.ts` | 60min |
| Update member-management.spec.ts | `tests/organization/member-management.spec.ts` | 60min |
| Add missing test assertions | Both spec files | 30min |
| Add cleanup hooks | Both spec files | 15min |

#### Phase 4: Validation & CI (Day 2-3)

| Task | Effort |
|------|--------|
| Run full E2E suite locally | 30min |
| Fix any remaining failures | Variable |
| Update CI workflow for org seeding | 20min |
| Document test data requirements | 15min |

### Sprint Planning

```
Sprint: Organization E2E Test Fixes
Duration: 3 days

Day 1:
- [ ] Add all data-testid attributes to frontend components
- [ ] Update test-users.json
- [ ] Extend seed-e2e-users.ts

Day 2:
- [ ] Update SettingsPage.ts selectors
- [ ] Update org-lifecycle.spec.ts
- [ ] Update member-management.spec.ts
- [ ] Initial test run

Day 3:
- [ ] Fix remaining test failures
- [ ] CI pipeline updates
- [ ] Documentation
- [ ] Final validation (all 12 tests passing)
```

### Quality Assurance Framework

#### Test Categories

| Category | Test Count | Files |
|----------|-----------|-------|
| Organization Lifecycle | 7 | `org-lifecycle.spec.ts` |
| Member Management | 5 | `member-management.spec.ts` |
| **Total** | **12** | |

#### Acceptance Criteria Matrix

| Test | Selector Used | API Called | Expected Outcome |
|------|--------------|-----------|------------------|
| Create org | `create-org-button`, `org-name-input` | POST /organizations | 201, org visible |
| Validate required | `org-name-input`, `create-org-submit` | None | Validation error |
| Prevent duplicate | `org-name-input`, `create-org-submit` | POST /organizations | 400/409, error shown |
| Update settings | `org-edit-button`, `org-save-button` | PATCH /organizations/:id | 200, name updated |
| Settings persist | `org-name-input` | GET /organizations/me | Value matches |
| Show members | `members-list`, `member-row` | GET /organizations/:id/members | Count >= 1 |
| Delete confirm | `delete-org-button`, `delete-org-dialog` | None | Dialog visible |
| 404 deleted | Direct URL | GET /organizations/:id | 404 or redirect |
| Invite member | `invite-member-button`, `invite-email-input` | POST /organizations/:id/members/invite | 201, success |
| Prevent duplicate invite | `invite-email-input` | POST /organizations/:id/members/invite | 409, error |
| Admin features visible | `invite-member-button` | None | Button visible |
| Member features hidden | `invite-member-button` | None | Button NOT visible |
| Viewer read-only | `invite-member-button`, delete buttons | None | All hidden |

---

## Appendices

### A. File Changes Summary

| File Path | Change Type | Description |
|-----------|------------|-------------|
| `quikadmin-web/src/components/features/OrganizationTabContent.tsx` | Modify | Add 10+ data-testid attributes |
| `quikadmin-web/src/components/features/MembersList.tsx` | Modify | Add 3 data-testid attributes |
| `quikadmin-web/src/components/features/InviteMemberModal.tsx` | Modify | Add 5 data-testid attributes |
| `quikadmin-web/e2e/data/test-users.json` | Modify | Add organizationId to users |
| `quikadmin-web/e2e/pages/SettingsPage.ts` | Modify | Update selectors to use data-testid |
| `quikadmin/scripts/seed-e2e-users.ts` | Modify | Add organization/membership seeding |
| `quikadmin-web/e2e/tests/organization/org-lifecycle.spec.ts` | Modify | Update to use new selectors |
| `quikadmin-web/e2e/tests/organization/member-management.spec.ts` | Modify | Update to use new selectors |

### B. Existing Test User Roles

| Role | Email | Permissions |
|------|-------|------------|
| OWNER | e2e-owner@intellifill.local | Full control, can delete org |
| ADMIN | e2e-admin@intellifill.local | Manage members, change settings |
| MEMBER | e2e-member@intellifill.local | View and edit documents |
| VIEWER | e2e-viewer@intellifill.local | Read-only access |

### C. API Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| AUTH_REQUIRED | 401 | User not authenticated |
| INSUFFICIENT_PERMISSIONS | 403 | User lacks required role |
| NOT_ORG_MEMBER | 403 | User not in organization |
| USER_ALREADY_MEMBER | 409 | User already has membership |
| LAST_OWNER_PROTECTION | 400 | Cannot demote/remove last owner |
| INVITATION_NOT_FOUND | 404 | Invitation does not exist |
| INVITATION_EXPIRED | 410 | Invitation has expired |
| EMAIL_MISMATCH | 403 | Logged in user email != invite email |

### D. Related Documentation

- Backend CLAUDE.md: `quikadmin/CLAUDE.md`
- Frontend CLAUDE.md: `quikadmin-web/CLAUDE.md`
- E2E Testing Architecture: `quikadmin-web/CLAUDE.md` (E2E Testing section)
- Organization Routes: `quikadmin/src/api/organization.routes.ts`
- Invitation Routes: `quikadmin/src/api/invitation.routes.ts`

---

**Document End**

*This PRD provides the complete specification for fixing the 12 failing organization-related E2E tests. Implementation should follow the phased approach outlined in the Development Roadmap section.*

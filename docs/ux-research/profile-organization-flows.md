# IntelliFill Profile & Organization UX Flow Design

**UX Researcher:** AI Agent (Claude)
**Date:** 2026-01-08
**Status:** Draft for Review

---

## Executive Summary

This document outlines user flows for profile management and organization features in IntelliFill. The design follows **adversarial requirements** - questioning every step to minimize friction while maximizing user value.

**Key Principle:** Collect only what is necessary, when it is necessary.

---

## Current State Analysis

### Existing Pages & Routes

Based on codebase review:

| Route | Component | Purpose |
|-------|-----------|---------|
| `/register` | Register.tsx | Account creation |
| `/profiles` | ProfileList.tsx | Manage form-filling profiles (Personal/Business) |
| `/profiles/:id` | ProfileDetail.tsx | View/edit single profile with stored data |
| `/settings` | Settings.tsx | Account, notifications, security settings |

### Current Registration Flow

The existing registration collects:
1. Full Name (required)
2. Email (required)
3. Password (required)
4. Confirm Password (required)
5. Terms Agreement (required)
6. Marketing Consent (optional)

**Assessment:** This is already minimal. No changes needed for initial registration.

### Current Profile System

IntelliFill uses "Profiles" for a different purpose than typical user profiles:
- **Profiles** = Identities for form-filling (e.g., "John Doe Personal", "Acme Corp Business")
- **Not** the logged-in user's account settings

This is a **B2C architecture** where users manage multiple identities.

---

## Design Decisions

### What We Will NOT Build (and Why)

| Feature | Reason for Exclusion |
|---------|---------------------|
| Multi-step wizard onboarding | Adds friction without clear value; users want to see the product first |
| Organization switcher in header | Premature complexity; most users will have 1 org |
| Granular permission matrix UI | 90% of users need only Admin/Member; power users can use API |
| Profile photo upload on registration | Zero value for document processing; distraction |
| Mandatory company details on signup | Forces B2B assumptions on B2C users |
| Team activity feed | Nice-to-have, not MVP; adds server load |

### What We Will Build (Minimum Viable)

1. **User Account Settings** - Basic personal info editing
2. **Organization Creation** - Simple, one-click org setup
3. **Team Invitation** - Email-based invite with magic link
4. **Role Assignment** - Two roles only: Admin and Member

---

## User Flow Diagrams

### Flow 1: User Onboarding (Post-Registration)

```
[Registration Complete]
        |
        v
[Redirect to /dashboard] <-- NO wizard, NO forced setup
        |
        v
[Dashboard shows empty state with CTA]
   "Upload your first document"
        |
        +-- Optional: Profile prompt in sidebar
        |   "Complete your profile for faster form-filling"
        |
        v
[User starts using app immediately]
```

**Design Rationale:**
- Users came to process documents, not fill out profiles
- Show value first, ask for info later
- Progressive disclosure: prompt for profile data when it is actually needed

### Flow 2: Profile Editing (Existing User)

```
[User clicks avatar in sidebar OR navigates to /settings]
        |
        v
[Settings Page - Account Tab]
   - Display name (editable)
   - Email (read-only, verified badge)
   - Phone (optional)
   - [Change Password] button
   - [Delete Account] (danger zone)
        |
        v
[Inline Save] <-- Auto-save or single "Save" button
```

**Key Decision:** Settings is for the USER ACCOUNT. Profiles at `/profiles` remain for FORM-FILLING IDENTITIES. These are separate concepts.

### Flow 3: Organization Creation

```
[User navigates to Settings > Organization tab]
        |
        v
[Organization Section]
   |
   +-- If no org: "Create Organization" CTA
   |       |
   |       v
   |   [Modal: Enter Organization Name]
   |       - Organization name (required, min 2 chars)
   |       - [Create] button
   |       |
   |       v
   |   [Success: User becomes Admin of new org]
   |
   +-- If has org: Display org card
           - Org name (editable if Admin)
           - Member count
           - [Invite Members] button
           - [Leave Organization] button
```

**Design Rationale:**
- No separate "create org" page - inline in settings
- Single field to start (just the name)
- Creator automatically becomes Admin
- Can add more org details later if needed

### Flow 4: Team Invitation

```
[Admin clicks "Invite Members" in Settings]
        |
        v
[Invite Modal]
   - Email input field
   - Role dropdown: [Admin | Member]
   - [Send Invite] button
        |
        v
[System sends magic link email]
        |
        v
[Invited user receives email]
   "You've been invited to join {OrgName} on IntelliFill"
   [Accept Invitation] button
        |
        v
[Click redirects to /accept-invite?token=xxx]
        |
        +-- If logged in: Auto-join org, redirect to dashboard
        |
        +-- If not logged in but has account: Login, then auto-join
        |
        +-- If no account: Register flow, then auto-join
```

**Design Rationale:**
- Email-based invitation (industry standard)
- Magic link removes friction
- No invite codes to type
- Graceful handling of existing vs new users

### Flow 5: Role Management

```
[Admin views Organization Members in Settings]
        |
        v
[Member List Table]
   | Name | Email | Role | Status | Actions |
   |------|-------|------|--------|---------|
   | John | j@... | Admin| Active | [...] |
   | Jane | j@... | Member| Active | [Change Role] [Remove] |
   | Bob  | b@... | Member| Pending| [Resend] [Cancel] |
        |
        v
[Change Role Dropdown]
   - Admin: Can invite, remove members, change roles
   - Member: Can use shared profiles, view team data
```

**Role Definitions:**

| Role | Permissions |
|------|-------------|
| Admin | Invite members, remove members, change roles, edit org settings, all Member permissions |
| Member | View org profiles, use shared document templates, process documents |

**Design Rationale:**
- Two roles cover 95% of use cases
- No complex permission matrix
- Clear, predictable behavior
- Admins cannot demote themselves if they are the last admin

---

## Screen-by-Screen Breakdown

### Screen 1: Settings Page (Enhanced)

**Route:** `/settings`

**Tabs:**
1. General (existing)
2. Account (existing, enhanced)
3. Organization (NEW)
4. Notifications (existing)
5. Security (existing)
6. Advanced (existing)

**Account Tab Changes:**

```
+------------------------------------------+
|  Profile Information                      |
|                                          |
|  Display Name: [_______________]         |
|                                          |
|  Email: user@example.com [Verified]      |
|  (Email changes require verification)    |
|                                          |
|  Phone: [_______________] (optional)     |
|                                          |
|  [Save Changes]                          |
+------------------------------------------+
```

### Screen 2: Organization Tab (NEW)

**Route:** `/settings` (Organization tab active)

**State A - No Organization:**

```
+------------------------------------------+
|  Organization                            |
|                                          |
|  +------------------------------------+  |
|  |  [Building icon]                    |  |
|  |                                    |  |
|  |  Create an Organization            |  |
|  |                                    |  |
|  |  Collaborate with your team by    |  |
|  |  creating an organization.        |  |
|  |                                    |  |
|  |  [Create Organization]            |  |
|  +------------------------------------+  |
|                                          |
|  -- OR --                               |
|                                          |
|  Have an invite? Check your email for   |
|  the invitation link.                   |
+------------------------------------------+
```

**State B - Has Organization (Admin View):**

```
+------------------------------------------+
|  Organization                            |
|                                          |
|  Organization Name                       |
|  [Acme Corporation_____] [Save]          |
|                                          |
|  Your Role: Admin                        |
|                                          |
+------------------------------------------+
|  Team Members (3)           [Invite +]   |
|                                          |
|  +------------------------------------+  |
|  | John D.    john@acme.com   Admin  |  |
|  | (you)                              |  |
|  +------------------------------------+  |
|  | Jane S.    jane@acme.com   Member |  |
|  |                      [v] [Remove] |  |
|  +------------------------------------+  |
|  | Bob T.     bob@acme.com    Pending|  |
|  |              [Resend] [Cancel]    |  |
|  +------------------------------------+  |
|                                          |
+------------------------------------------+
|  Danger Zone                             |
|                                          |
|  [Delete Organization]                   |
|  This will remove all members and        |
|  cannot be undone.                       |
+------------------------------------------+
```

**State C - Has Organization (Member View):**

```
+------------------------------------------+
|  Organization                            |
|                                          |
|  Acme Corporation                        |
|  Your Role: Member                       |
|                                          |
+------------------------------------------+
|  Team Members (3)                        |
|                                          |
|  +------------------------------------+  |
|  | John D.    john@acme.com   Admin  |  |
|  +------------------------------------+  |
|  | Jane S.    jane@acme.com   Member |  |
|  | (you)                              |  |
|  +------------------------------------+  |
|  | Bob T.     bob@acme.com   Member  |  |
|  +------------------------------------+  |
|                                          |
+------------------------------------------+
|  [Leave Organization]                    |
+------------------------------------------+
```

### Screen 3: Invite Modal

**Trigger:** Click "Invite +" button

```
+------------------------------------------+
|  Invite Team Member              [X]     |
|                                          |
|  Email Address                           |
|  [_______________________]               |
|                                          |
|  Role                                    |
|  [Member           v]                    |
|   - Member: Can view and use team data  |
|   - Admin: Full access + team management|
|                                          |
|  [Cancel]              [Send Invitation] |
+------------------------------------------+
```

### Screen 4: Accept Invitation Page

**Route:** `/accept-invite?token=xxx`

**State A - Already logged in:**

```
+------------------------------------------+
|  [IntelliFill Logo]                      |
|                                          |
|  You've been invited to join            |
|                                          |
|  [Acme Corporation]                      |
|                                          |
|  as a Member                            |
|                                          |
|  [Accept & Join]                        |
|                                          |
|  [Decline]                              |
+------------------------------------------+
```

**State B - Not logged in:**

```
+------------------------------------------+
|  [IntelliFill Logo]                      |
|                                          |
|  You've been invited to join            |
|                                          |
|  [Acme Corporation]                      |
|                                          |
|  Sign in to accept this invitation      |
|                                          |
|  [Sign In]  or  [Create Account]        |
+------------------------------------------+
```

---

## Data Collection Philosophy

### What to Collect Upfront (Registration)

| Field | Required | Reason |
|-------|----------|--------|
| Email | Yes | Account identifier, communication |
| Password | Yes | Security |
| Full Name | Yes | Display purposes, personalization |
| Terms | Yes | Legal requirement |

**Total: 4 required fields** - This is already optimal.

### What to Collect Later (Progressive)

| Field | When to Prompt | How to Prompt |
|-------|----------------|---------------|
| Phone | Settings page, optional | Never prompt, user adds if desired |
| Company Name | When creating org | Single field modal |
| Profile Data | When filling first form | "Save to profile?" checkbox |
| Timezone | Auto-detect, manual in settings | Show detected, allow override |

---

## Navigation Structure Changes

### Current Navigation (AppLayout.tsx)

```
- Dashboard
- Upload
- Fill Form
- History
- Profiles      <-- Form-filling identities
- Documents
- Templates
- Settings
```

### Proposed Changes

**No changes to main nav.** The Organization feature lives within Settings, not as a separate nav item. This:
1. Keeps nav clean
2. Acknowledges most users use 1 org
3. Treats org as account-level setting, not app feature

---

## Technical Considerations

### Database Schema (Already Exists)

The Prisma schema already has:
- `Organization` model with status
- `User.organizationId` (optional foreign key)
- `UserRole` enum: ADMIN, USER, VIEWER

**Recommendation:** Map roles as:
- ADMIN = Organization Admin
- USER = Organization Member
- VIEWER = Can be used for read-only members later (future)

### New Routes Needed

| Route | Purpose |
|-------|---------|
| `/accept-invite` | Handle invitation acceptance |

### New API Endpoints Needed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/organizations` | POST | Create organization |
| `/api/organizations/:id` | PUT | Update org name |
| `/api/organizations/:id` | DELETE | Delete organization |
| `/api/organizations/:id/members` | GET | List members |
| `/api/organizations/:id/invites` | POST | Send invitation |
| `/api/organizations/:id/invites/:id` | DELETE | Cancel invite |
| `/api/organizations/:id/members/:id` | PUT | Change role |
| `/api/organizations/:id/members/:id` | DELETE | Remove member |
| `/api/invites/:token` | GET | Validate invite |
| `/api/invites/:token/accept` | POST | Accept invite |

---

## What We Explicitly Chose NOT to Include

| Feature | Reason |
|---------|--------|
| Profile photo | Zero value for doc processing, adds complexity |
| Bio/About field | Not relevant to use case |
| Social links | Not relevant to use case |
| Job title | Can add to org member if needed later |
| Department | Over-engineering for MVP |
| Multiple organizations per user | Add complexity; defer until customer requests |
| Organization logo | Nice-to-have, not MVP |
| Custom roles | Two roles sufficient; avoid permission matrix hell |
| SSO/SAML | Enterprise feature, add when enterprise tier exists |
| Domain-based auto-join | Security implications need careful design |
| Organization billing | Separate billing feature, not profile/org UX |
| Activity audit log | Backend feature, not needed in MVP UI |
| Organization-level templates | Future feature, adds complexity |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Registration completion rate | >80% | Track drop-off at each step |
| Time to first document upload | <3 min | From registration complete to first upload |
| Org creation abandonment | <20% | Started but not completed |
| Invite acceptance rate | >60% | Invites sent vs accepted |
| Settings page engagement | >40% | % users who visit settings in first week |

---

## Implementation Priority

### Phase 1: Core Profile (Week 1)
1. Enhance Settings > Account tab with editable name/phone
2. Connect Settings to backend API
3. Auto-save or explicit save functionality

### Phase 2: Organization Foundation (Week 2)
1. Add Organization tab to Settings
2. Create Organization flow (modal)
3. Display organization info
4. Basic member list (read-only)

### Phase 3: Team Invitation (Week 3)
1. Invite modal and API
2. Email sending integration
3. Accept invitation page
4. Role management UI

### Phase 4: Polish (Week 4)
1. Edge case handling
2. Error states
3. Loading states
4. Empty states
5. Mobile responsiveness

---

## Appendix: Research Sources

- [Notion's Lightweight Onboarding](https://goodux.appcues.com/blog/notions-lightweight-onboarding)
- [UX Onboarding Best Practices 2025](https://www.uxdesigninstitute.com/blog/ux-onboarding-best-practices-guide/)
- [Best Sign Up Flows 2025](https://www.eleken.co/blog-posts/sign-up-flow)
- [SaaS UX Design Best Practices](https://userpilot.com/blog/saas-ux-design/)
- [How to Design RBAC System](https://www.nocobase.com/en/blog/how-to-design-rbac-role-based-access-control-system)
- [Role-Based Access Control Guide](https://budibase.com/blog/app-building/role-based-access-control/)
- [SaaS Invitation Email Examples](https://www.saasframe.io/categories/invitation-emails)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-08 | AI Agent | Initial draft |

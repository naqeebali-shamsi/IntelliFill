# PRD: Cross-Tab Session Synchronization

**Document Version:** 1.0
**Status:** Draft
**Author:** AI Agent (Claude Opus 4.5)
**Created:** 2026-01-09
**Last Updated:** 2026-01-09

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Overview](#3-product-overview)
4. [User Stories](#4-user-stories)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Technical Requirements](#7-technical-requirements)
8. [Implementation Plan](#8-implementation-plan)
9. [Success Criteria](#9-success-criteria)
10. [Security Considerations](#10-security-considerations)
11. [Risks and Mitigations](#11-risks-and-mitigations)
12. [Appendices](#12-appendices)

---

## 1. Executive Summary

### 1.1 Problem Statement
IntelliFill currently lacks cross-tab session synchronization, creating security vulnerabilities and poor user experience when users work with multiple browser tabs or need to manage sessions across devices.

### 1.2 Solution Overview
Implement a comprehensive session synchronization system using BroadcastChannel API (with localStorage fallback), tab visibility detection, backend session tracking, and a user-facing session management UI in Settings.

### 1.3 Business Impact
- **Security:** Prevent zombie sessions and potential session hijacking
- **UX:** Consistent authentication state across all browser tabs
- **Compliance:** Support "Logout All Devices" for security incidents
- **Trust:** Users can see and control active sessions

### 1.4 Resource Requirements
- **Frontend:** ~3-5 days development
- **Backend:** ~2-3 days development
- **Testing:** ~2 days E2E and unit tests
- **Total Estimate:** 7-10 days

### 1.5 Risk Assessment
- **Medium Risk:** Browser compatibility for BroadcastChannel (mitigated by localStorage fallback)
- **Low Risk:** Database schema changes (Session model exists, needs enhancement)

---

## 2. Problem Statement

### 2.1 Current State Analysis

#### What Exists
| Component | Implementation | Status |
|-----------|---------------|--------|
| `backendAuthStore` | Zustand with persist middleware | Working |
| `tokenManager` | In-memory access token storage | Working |
| Refresh Token Cookie | httpOnly cookie for refresh tokens | Working |
| Token Family Service | Rotation and theft detection | Working |
| Logout Endpoint | Uses `'global'` scope (Supabase) | Working |
| Session Model (Prisma) | Basic fields defined | Partially used |

#### Critical Gaps Identified

1. **No BroadcastChannel Implementation**
   - Tabs cannot communicate authentication state changes
   - Logout in Tab 1 is not detected by Tab 2 until page refresh

2. **No Storage Event Listeners**
   - No fallback mechanism for browsers without BroadcastChannel
   - localStorage changes not observed across tabs

3. **No Tab Visibility Detection**
   - Background tabs do not verify session validity
   - Stale auth state persists in inactive tabs

4. **No "Logout All Devices" UI**
   - Backend supports `'global'` scope logout
   - No user-accessible button in Settings > Security

5. **No Active Sessions List UI**
   - Users cannot see where they are logged in
   - No ability to revoke individual sessions

6. **Session Model Underutilized**
   - Prisma `Session` model exists but not populated on login
   - No API endpoints to list/revoke sessions

### 2.2 Impact of Current Gaps

| Gap | User Impact | Security Impact |
|-----|-------------|-----------------|
| No cross-tab sync | Confusing UX, manual refresh required | Zombie sessions remain active |
| No session list | No visibility into active sessions | Cannot detect unauthorized access |
| No individual revocation | Must logout everywhere | Overkill response to single compromised device |
| No background validation | Stale UI state | Expired tokens not cleared |

### 2.3 E2E Test Expectations

From `session-tabs.spec.ts` and `session.spec.ts`:

```typescript
// Expected behaviors currently failing:
test('should redirect tab 2 to login after logout in tab 1')
test('should detect logout in background tab')
test('should invalidate all sessions when using "Logout All Devices"')
test('should show active sessions list if supported')
test('should prevent session hijacking with token validation')
```

---

## 3. Product Overview

### 3.1 Product Vision
Provide users with seamless, secure session management across all browser tabs and devices, with full visibility and control over active sessions.

### 3.2 Target Users
- **Primary:** All authenticated IntelliFill users
- **Secondary:** Security-conscious enterprise customers
- **Tertiary:** Administrators managing team access

### 3.3 Value Proposition
- **Security:** Real-time session invalidation prevents unauthorized access
- **Convenience:** Automatic sync eliminates manual refresh
- **Control:** Users can manage sessions from a single location
- **Confidence:** Visibility into active sessions builds trust

### 3.4 Success Criteria Summary
1. Cross-tab logout sync within 500ms
2. Active sessions visible in Settings
3. Individual session revocation functional
4. All E2E session tests passing
5. Zero regression in existing auth flows

### 3.5 Assumptions
- Users have modern browsers (Chrome 54+, Firefox 38+, Safari 10.1+)
- Redis available for session storage (production)
- Users accept minor UX interruption on forced logout

---

## 4. User Stories

### 4.1 Cross-Tab Logout Synchronization

**US-001: As a user, I want to be automatically logged out of all open tabs when I logout from one tab, so that my session is consistently terminated.**

**Acceptance Criteria:**
```gherkin
Given I am logged into IntelliFill in Tab 1 and Tab 2
When I click "Logout" in Tab 1
Then Tab 1 redirects to the login page
And Tab 2 detects the logout within 500ms
And Tab 2 displays a "Session ended" toast notification
And Tab 2 redirects to the login page within 1 second
And all localStorage auth data is cleared
And the in-memory token is cleared in both tabs
```

**Priority:** P0 (Critical)
**Estimate:** 2 days

---

**US-002: As a user, I want Tab 2 to detect logout even if it's in the background, so that I don't accidentally use an invalid session.**

**Acceptance Criteria:**
```gherkin
Given I am logged in on Tab 1 and Tab 2
And Tab 2 is minimized or not focused
When I logout from Tab 1
And I later bring Tab 2 to focus
Then Tab 2 validates the session immediately
And if invalid, Tab 2 redirects to login with a "Session expired" message
```

**Priority:** P0 (Critical)
**Estimate:** 1 day

---

### 4.2 Logout All Devices

**US-003: As a user, I want to logout from all devices at once, so that I can secure my account if I suspect unauthorized access.**

**Acceptance Criteria:**
```gherkin
Given I am logged into IntelliFill on multiple devices
And I navigate to Settings > Security
When I click "Sign out everywhere"
Then a confirmation dialog appears warning about logging out all devices
When I confirm the action
Then all sessions are invalidated on the backend
And all browser tabs/devices redirect to login
And a success message confirms "All sessions terminated"
And I can immediately log back in
```

**Priority:** P0 (Critical)
**Estimate:** 1 day

---

### 4.3 Active Sessions Management

**US-004: As a user, I want to see a list of all my active sessions, so that I can monitor where my account is logged in.**

**Acceptance Criteria:**
```gherkin
Given I am logged into IntelliFill
When I navigate to Settings > Security
Then I see an "Active Sessions" section
And each session displays:
  - Device type (Desktop/Mobile/Tablet)
  - Browser name and version
  - IP address (partially masked for privacy)
  - Location (city, country from IP)
  - Last activity timestamp
  - "Current" badge for the active session
And sessions are sorted by last activity (most recent first)
And I see a "Sign out everywhere" button
```

**Priority:** P1 (High)
**Estimate:** 3 days (includes backend + frontend)

---

**US-005: As a user, I want to revoke individual sessions, so that I can selectively terminate specific logins without affecting others.**

**Acceptance Criteria:**
```gherkin
Given I am viewing the Active Sessions list
And I see a session that is not my current session
When I click "Revoke" on that session
Then a confirmation dialog appears
When I confirm
Then that specific session is invalidated
And the session is removed from the list
And if the revoked session was open in another browser, it redirects to login
And my current session remains active
```

**Priority:** P1 (High)
**Estimate:** 1 day

---

### 4.4 Login State Synchronization

**US-006: As a user, when I log in on one tab, I want other tabs to recognize the login, so I don't need to refresh.**

**Acceptance Criteria:**
```gherkin
Given I have the IntelliFill login page open in Tab 1 and Tab 2
When I log in successfully in Tab 1
Then Tab 1 navigates to the dashboard
And Tab 2 detects the login event within 500ms
And Tab 2 automatically updates to show the logged-in state
And Tab 2 navigates to the dashboard (or refreshes to authenticated view)
```

**Priority:** P2 (Medium)
**Estimate:** 0.5 days

---

## 5. Functional Requirements

### 5.1 Core Features

#### FR-001: BroadcastChannel Session Sync
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001.1 | Create `SessionSyncChannel` using BroadcastChannel API | P0 |
| FR-001.2 | Broadcast `LOGOUT` event on successful logout | P0 |
| FR-001.3 | Broadcast `LOGIN` event on successful login | P2 |
| FR-001.4 | Listen for session events in all tabs | P0 |
| FR-001.5 | Handle `LOGOUT` by clearing local state and redirecting | P0 |
| FR-001.6 | Handle `LOGIN` by refreshing auth state | P2 |
| FR-001.7 | Include event metadata (timestamp, sessionId, userId) | P1 |

#### FR-002: Storage Event Fallback
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-002.1 | Detect if BroadcastChannel is unavailable | P0 |
| FR-002.2 | Fall back to localStorage `storage` event listener | P0 |
| FR-002.3 | Write sentinel value on logout (`intellifill-logout-timestamp`) | P0 |
| FR-002.4 | Detect sentinel change in other tabs | P0 |
| FR-002.5 | Clear sentinel after processing | P1 |

#### FR-003: Tab Visibility Detection
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-003.1 | Listen for `visibilitychange` document event | P0 |
| FR-003.2 | On `visible`, validate session with backend | P0 |
| FR-003.3 | If session invalid, clear state and redirect to login | P0 |
| FR-003.4 | Debounce validation to prevent rapid API calls | P1 |
| FR-003.5 | Show "Validating session..." indicator briefly | P2 |

#### FR-004: Logout All Devices
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-004.1 | Add "Sign out everywhere" button in Settings > Security | P0 |
| FR-004.2 | Confirmation modal before action | P0 |
| FR-004.3 | Call `POST /api/auth/v2/logout-all` endpoint | P0 |
| FR-004.4 | Backend invalidates all sessions for user | P0 |
| FR-004.5 | Broadcast logout to all tabs | P0 |
| FR-004.6 | Display success/error feedback | P0 |

#### FR-005: Active Sessions List
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-005.1 | Add "Active Sessions" section in Settings > Security | P1 |
| FR-005.2 | Fetch sessions via `GET /api/auth/v2/sessions` | P1 |
| FR-005.3 | Display device, browser, IP, location, last activity | P1 |
| FR-005.4 | Highlight current session with "This device" badge | P1 |
| FR-005.5 | Show "Revoke" button for non-current sessions | P1 |
| FR-005.6 | Call `DELETE /api/auth/v2/sessions/:id` to revoke | P1 |
| FR-005.7 | Refresh list after revocation | P1 |

### 5.2 User Flows

#### UF-001: Cross-Tab Logout Flow
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Tab 1     │     │   Tab 2     │     │  Backend    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ Click Logout      │                   │
       │──────────────────────────────────────>│
       │                   │    POST /logout   │
       │                   │                   │
       │<──────────────────────────────────────│
       │    200 OK         │                   │
       │                   │                   │
       │ Clear local state │                   │
       │                   │                   │
       │ Broadcast LOGOUT  │                   │
       │ ──────────────────>                   │
       │ (BroadcastChannel)│                   │
       │                   │                   │
       │ Redirect to /login│                   │
       │                   │                   │
       │                   │ Receive LOGOUT    │
       │                   │ event             │
       │                   │                   │
       │                   │ Clear local state │
       │                   │                   │
       │                   │ Show toast        │
       │                   │                   │
       │                   │ Redirect to /login│
       │                   │                   │
```

#### UF-002: Background Tab Validation Flow
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Background  │     │  Foreground │     │  Backend    │
│   Tab       │     │    Tab      │     │             │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ (minimized)       │ User logs out     │
       │                   │──────────────────>│
       │                   │                   │
       │ LOGOUT broadcast  │                   │
       │<──────────────────│                   │
       │ (may not process  │                   │
       │  if tab suspended)│                   │
       │                   │                   │
       │                   │                   │
       │ User brings tab   │                   │
       │ to foreground     │                   │
       │                   │                   │
       │ visibilitychange  │                   │
       │ event fires       │                   │
       │                   │                   │
       │ Validate session  │                   │
       │──────────────────────────────────────>│
       │                   │    GET /auth/me   │
       │                   │                   │
       │<──────────────────────────────────────│
       │   401 Unauthorized│                   │
       │                   │                   │
       │ Clear state,      │                   │
       │ redirect to /login│                   │
       │                   │                   │
```

### 5.3 Business Rules

| ID | Rule | Enforcement |
|----|------|-------------|
| BR-001 | Sessions expire after 7 days of inactivity | Backend cron job |
| BR-002 | Maximum 10 concurrent sessions per user | Login validation |
| BR-003 | Current session cannot be revoked | UI disable + backend check |
| BR-004 | IP geolocation must be privacy-compliant | Mask last 2 octets |
| BR-005 | Session metadata logged for audit | AuditLog entry |

### 5.4 Integration Points

| System | Integration Type | Purpose |
|--------|------------------|---------|
| Supabase Auth | JWT validation | Verify session validity |
| Redis | Session storage | Fast session lookup |
| Prisma/PostgreSQL | Persistent storage | Session metadata |
| GeoIP Service | IP lookup | Location display |
| BroadcastChannel API | Tab communication | Real-time sync |

---

## 6. Non-Functional Requirements

### 6.1 Performance
| ID | Requirement | Target |
|----|-------------|--------|
| NFR-001 | Cross-tab sync latency | < 500ms |
| NFR-002 | Session list load time | < 1 second |
| NFR-003 | Visibility check API call | < 200ms |
| NFR-004 | Logout all sessions | < 2 seconds |

### 6.2 Security
| ID | Requirement | Implementation |
|----|-------------|----------------|
| NFR-005 | Session tokens must be unguessable | UUID v4 + crypto random |
| NFR-006 | Session revocation must be immediate | Redis + DB invalidation |
| NFR-007 | IP addresses must be partially masked | Show first 2 octets only |
| NFR-008 | Session list requires authentication | JWT validation |
| NFR-009 | Audit log all session operations | AuditLog middleware |

### 6.3 Usability
| ID | Requirement | Target |
|----|-------------|--------|
| NFR-010 | Clear feedback on session actions | Toast notifications |
| NFR-011 | Confirmation before destructive actions | Modal dialogs |
| NFR-012 | Accessible to screen readers | WCAG 2.1 AA |

### 6.4 Reliability
| ID | Requirement | Target |
|----|-------------|--------|
| NFR-013 | BroadcastChannel fallback coverage | 100% |
| NFR-014 | Session sync success rate | > 99.5% |
| NFR-015 | Graceful degradation without Redis | In-memory fallback |

### 6.5 Compliance
| ID | Requirement | Standard |
|----|-------------|----------|
| NFR-016 | IP geolocation privacy | GDPR Art. 5 |
| NFR-017 | Session data retention | 90 days max |
| NFR-018 | Audit log retention | 1 year |

---

## 7. Technical Requirements

### 7.1 Frontend Architecture

#### 7.1.1 Session Sync Service

**File:** `quikadmin-web/src/lib/sessionSync.ts`

```typescript
interface SessionSyncEvent {
  type: 'LOGIN' | 'LOGOUT' | 'SESSION_REVOKED';
  timestamp: number;
  userId?: string;
  sessionId?: string;
  metadata?: {
    reason?: 'user_action' | 'expired' | 'revoked' | 'logout_all';
  };
}

interface SessionSyncService {
  init(): void;
  broadcast(event: SessionSyncEvent): void;
  subscribe(callback: (event: SessionSyncEvent) => void): () => void;
  cleanup(): void;
}
```

**Requirements:**
- Use BroadcastChannel with name `intellifill-session-sync`
- Fall back to localStorage events if BroadcastChannel unavailable
- Singleton pattern for consistent state
- TypeScript strict mode compliant

#### 7.1.2 Tab Visibility Handler

**File:** `quikadmin-web/src/hooks/useTabVisibility.ts`

```typescript
interface UseTabVisibilityOptions {
  onVisible?: () => void;
  onHidden?: () => void;
  validateSession?: boolean;
  debounceMs?: number;
}

function useTabVisibility(options: UseTabVisibilityOptions): {
  isVisible: boolean;
  lastVisibleAt: number | null;
}
```

**Requirements:**
- Listen to `document.visibilitychange`
- Debounce validation calls (default 1000ms)
- Call `authService.getMe()` on visibility
- Clear state and redirect on 401

#### 7.1.3 Auth Store Integration

**File:** `quikadmin-web/src/stores/backendAuthStore.ts` (modifications)

```typescript
// Add to AuthState interface
interface AuthState {
  // ... existing fields
  currentSessionId: string | null;
}

// Add to AuthActions interface
interface AuthActions {
  // ... existing methods
  logoutAllDevices: () => Promise<void>;
  revokeSession: (sessionId: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
}
```

#### 7.1.4 Settings Security Tab Enhancement

**File:** `quikadmin-web/src/pages/Settings.tsx` (modifications)

New components needed:
- `ActiveSessionsList` - displays sessions table
- `SessionCard` - individual session display
- `RevokeSessionModal` - confirmation dialog
- `LogoutAllDevicesModal` - confirmation dialog

### 7.2 Backend Architecture

#### 7.2.1 Session Model Enhancement

**File:** `quikadmin/prisma/schema.prisma`

```prisma
model Session {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  token       String    @unique

  // Device information
  deviceType  String?   // 'desktop', 'mobile', 'tablet'
  browser     String?   // 'Chrome 120', 'Safari 17'
  os          String?   // 'Windows 11', 'macOS 14'

  // Location (privacy-compliant)
  ipAddress   String?   // Stored full, displayed masked
  city        String?
  country     String?

  // Timestamps
  lastActivity DateTime @default(now())
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  // Status
  isRevoked    Boolean  @default(false)
  revokedAt    DateTime?
  revokedReason String?

  @@index([userId])
  @@index([token])
  @@index([isRevoked])
  @@index([expiresAt])
  @@map("sessions")
}
```

#### 7.2.2 Session API Endpoints

**File:** `quikadmin/src/api/session.routes.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/v2/sessions` | List active sessions for current user |
| `DELETE` | `/api/auth/v2/sessions/:id` | Revoke specific session |
| `POST` | `/api/auth/v2/logout-all` | Revoke all sessions |
| `GET` | `/api/auth/v2/sessions/current` | Get current session details |

**Request/Response Schemas:**

```typescript
// GET /api/auth/v2/sessions
interface SessionListResponse {
  success: boolean;
  data: {
    sessions: {
      id: string;
      deviceType: string | null;
      browser: string | null;
      os: string | null;
      ipAddress: string; // Masked: "192.168.x.x"
      city: string | null;
      country: string | null;
      lastActivity: string; // ISO timestamp
      createdAt: string;
      isCurrent: boolean;
    }[];
    total: number;
  };
}

// DELETE /api/auth/v2/sessions/:id
interface RevokeSessionResponse {
  success: boolean;
  message: string;
}

// POST /api/auth/v2/logout-all
interface LogoutAllResponse {
  success: boolean;
  message: string;
  data: {
    revokedCount: number;
  };
}
```

#### 7.2.3 Session Service

**File:** `quikadmin/src/services/session.service.ts`

```typescript
interface SessionService {
  createSession(userId: string, req: Request): Promise<Session>;
  getSessionsByUserId(userId: string): Promise<Session[]>;
  revokeSession(sessionId: string, userId: string): Promise<void>;
  revokeAllSessions(userId: string, exceptCurrent?: string): Promise<number>;
  validateSession(token: string): Promise<Session | null>;
  updateLastActivity(sessionId: string): Promise<void>;
  cleanupExpiredSessions(): Promise<number>;
}
```

#### 7.2.4 Device Detection Utility

**File:** `quikadmin/src/utils/deviceDetection.ts`

```typescript
interface DeviceInfo {
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  os: string;
}

function parseUserAgent(userAgent: string): DeviceInfo;
function maskIpAddress(ip: string): string;
```

### 7.3 Database Migrations

**Migration:** `add_session_tracking_fields`

```sql
-- Add new columns to sessions table
ALTER TABLE sessions
ADD COLUMN device_type VARCHAR(20),
ADD COLUMN browser VARCHAR(100),
ADD COLUMN os VARCHAR(100),
ADD COLUMN city VARCHAR(100),
ADD COLUMN country VARCHAR(100),
ADD COLUMN last_activity TIMESTAMP DEFAULT NOW(),
ADD COLUMN is_revoked BOOLEAN DEFAULT FALSE,
ADD COLUMN revoked_at TIMESTAMP,
ADD COLUMN revoked_reason VARCHAR(255);

-- Add indexes
CREATE INDEX idx_sessions_user_revoked ON sessions(user_id, is_revoked);
CREATE INDEX idx_sessions_last_activity ON sessions(last_activity);
```

### 7.4 API Contract

#### 7.4.1 List Sessions

```yaml
GET /api/auth/v2/sessions
Authorization: Bearer <access_token>

Response 200:
  success: true
  data:
    sessions:
      - id: "uuid"
        deviceType: "desktop"
        browser: "Chrome 120"
        os: "Windows 11"
        ipAddress: "192.168.x.x"
        city: "Dubai"
        country: "UAE"
        lastActivity: "2026-01-09T10:30:00Z"
        createdAt: "2026-01-08T09:00:00Z"
        isCurrent: true
    total: 3

Response 401:
  success: false
  error: "Authentication required"
```

#### 7.4.2 Revoke Session

```yaml
DELETE /api/auth/v2/sessions/:id
Authorization: Bearer <access_token>

Response 200:
  success: true
  message: "Session revoked successfully"

Response 400:
  success: false
  error: "Cannot revoke current session"

Response 404:
  success: false
  error: "Session not found"
```

#### 7.4.3 Logout All

```yaml
POST /api/auth/v2/logout-all
Authorization: Bearer <access_token>

Response 200:
  success: true
  message: "All sessions terminated"
  data:
    revokedCount: 5
```

---

## 8. Implementation Plan

### 8.1 Phase 1: Core Infrastructure (Days 1-3)

| Task | Owner | Duration | Dependencies |
|------|-------|----------|--------------|
| 1.1 Prisma schema migration | Backend | 0.5 days | None |
| 1.2 Session service implementation | Backend | 1 day | 1.1 |
| 1.3 Device detection utility | Backend | 0.5 days | None |
| 1.4 Session API endpoints | Backend | 1 day | 1.2, 1.3 |

**Deliverables:**
- [ ] Database migration applied
- [ ] `SessionService` with CRUD operations
- [ ] API endpoints functional
- [ ] Unit tests for service layer

### 8.2 Phase 2: Frontend Sync (Days 4-6)

| Task | Owner | Duration | Dependencies |
|------|-------|----------|--------------|
| 2.1 SessionSyncService (BroadcastChannel) | Frontend | 1 day | None |
| 2.2 Storage event fallback | Frontend | 0.5 days | 2.1 |
| 2.3 useTabVisibility hook | Frontend | 0.5 days | None |
| 2.4 Auth store integration | Frontend | 1 day | 2.1, 2.2 |
| 2.5 Cross-tab logout flow | Frontend | 1 day | 2.4 |

**Deliverables:**
- [ ] BroadcastChannel sync working
- [ ] Fallback for older browsers
- [ ] Background tab validation
- [ ] Logout syncs across tabs

### 8.3 Phase 3: UI Components (Days 7-8)

| Task | Owner | Duration | Dependencies |
|------|-------|----------|--------------|
| 3.1 ActiveSessionsList component | Frontend | 1 day | Phase 1 |
| 3.2 SessionCard component | Frontend | 0.5 days | 3.1 |
| 3.3 Revoke/LogoutAll modals | Frontend | 0.5 days | 3.1 |
| 3.4 Settings Security tab update | Frontend | 0.5 days | 3.1-3.3 |
| 3.5 Toast notifications | Frontend | 0.25 days | 3.4 |

**Deliverables:**
- [ ] Active sessions visible in Settings
- [ ] Revoke session functional
- [ ] Logout All Devices functional
- [ ] User feedback via toasts

### 8.4 Phase 4: Testing & Polish (Days 9-10)

| Task | Owner | Duration | Dependencies |
|------|-------|----------|--------------|
| 4.1 Unit tests (frontend) | Frontend | 0.5 days | Phase 2-3 |
| 4.2 Unit tests (backend) | Backend | 0.5 days | Phase 1 |
| 4.3 E2E tests update | QA | 1 day | Phase 2-3 |
| 4.4 Bug fixes and polish | Both | 1 day | 4.1-4.3 |

**Deliverables:**
- [ ] All E2E session tests passing
- [ ] 80%+ code coverage on new code
- [ ] No regressions in existing auth flows
- [ ] Documentation updated

### 8.5 Milestones

| Milestone | Date | Criteria |
|-----------|------|----------|
| M1: Backend Complete | Day 3 | APIs functional, tests passing |
| M2: Sync Working | Day 6 | Cross-tab logout verified |
| M3: UI Complete | Day 8 | Sessions visible in Settings |
| M4: Ready for QA | Day 10 | All tests passing |

---

## 9. Success Criteria

### 9.1 Acceptance Criteria

| ID | Criterion | Verification Method |
|----|-----------|---------------------|
| AC-001 | Cross-tab logout syncs within 500ms | E2E test timing |
| AC-002 | Background tab redirects on focus | E2E test |
| AC-003 | "Sign out everywhere" terminates all sessions | E2E test + DB check |
| AC-004 | Active sessions list shows all sessions | Manual test |
| AC-005 | Individual session revocation works | E2E test |
| AC-006 | Current session marked correctly | UI verification |
| AC-007 | Works without BroadcastChannel | Browser compatibility test |
| AC-008 | No regression in login/logout flows | Existing E2E tests |

### 9.2 Key Performance Indicators (KPIs)

| KPI | Target | Measurement |
|-----|--------|-------------|
| Session sync latency | < 500ms | Client-side timing |
| Session list load time | < 1s | API response time |
| E2E test pass rate | 100% | CI pipeline |
| Support tickets (session issues) | -50% | Helpdesk metrics |

### 9.3 E2E Test Coverage

```typescript
// Tests that must pass:
describe('Session Synchronization', () => {
  test('should redirect tab 2 after logout in tab 1');
  test('should sync login state across tabs');
  test('should detect logout in background tab');
  test('should invalidate all sessions on logout-all');
  test('should show active sessions list');
  test('should revoke individual session');
  test('should prevent current session revocation');
  test('should handle concurrent logins');
  test('should work with storage event fallback');
});
```

---

## 10. Security Considerations

### 10.1 Threat Model

| Threat | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| Session hijacking | Medium | High | Token rotation, IP validation |
| Zombie sessions | High | Medium | Cross-tab sync, expiration |
| XSS token theft | Low | High | httpOnly cookies, in-memory tokens |
| CSRF on logout | Low | Medium | SameSite cookies, CSRF tokens |
| Session fixation | Low | High | Regenerate session on login |

### 10.2 Security Requirements

| ID | Requirement | Implementation |
|----|-------------|----------------|
| SEC-001 | Session tokens cryptographically random | `crypto.randomUUID()` |
| SEC-002 | Session tokens not exposed in URL | Body/Cookie only |
| SEC-003 | IP addresses masked in UI | Show `192.168.x.x` |
| SEC-004 | Session revocation immediate | Redis invalidation |
| SEC-005 | Rate limit session operations | 10 req/min |
| SEC-006 | Audit log all session changes | AuditLog middleware |

### 10.3 Privacy Compliance

| Requirement | GDPR Article | Implementation |
|-------------|--------------|----------------|
| Purpose limitation | Art. 5(1)(b) | Sessions for security only |
| Data minimization | Art. 5(1)(c) | Minimal device info stored |
| Storage limitation | Art. 5(1)(e) | 90-day retention |
| Integrity | Art. 5(1)(f) | Encrypted at rest |

### 10.4 Session Hijacking Prevention

```typescript
// On each API request, validate:
interface SessionValidation {
  tokenValid: boolean;         // JWT signature valid
  tokenNotExpired: boolean;    // exp claim in future
  sessionNotRevoked: boolean;  // DB isRevoked = false
  ipMatchesAllowed: boolean;   // Optional: IP consistency
  userAgentConsistent: boolean; // Optional: UA fingerprint
}
```

---

## 11. Risks and Mitigations

### 11.1 Technical Risks

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| BroadcastChannel not supported | Low | Medium | Storage event fallback | Frontend |
| Redis unavailable | Low | High | In-memory session cache | Backend |
| Session race conditions | Medium | Medium | Optimistic UI + retry | Frontend |
| Migration breaks prod | Low | High | Blue-green deploy | DevOps |

### 11.2 Business Risks

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| User confusion on forced logout | Medium | Low | Clear messaging + docs | Product |
| Performance degradation | Low | Medium | Caching, lazy load | Backend |
| Feature creep | Medium | Medium | Strict scope control | PM |

### 11.3 Contingency Plans

| Scenario | Response |
|----------|----------|
| BroadcastChannel fails silently | Fall back to polling + storage events |
| Sessions table grows too large | Implement retention job, archive old data |
| Sync causes infinite loops | Add deduplication, event IDs |

---

## 12. Appendices

### 12.1 Glossary

| Term | Definition |
|------|------------|
| BroadcastChannel | Browser API for same-origin tab communication |
| Session | Server-side record of an authenticated login |
| Token Family | Related refresh tokens for rotation detection |
| Zombie Session | Session that should be invalid but appears valid |
| Storage Event | Event fired when localStorage changes in another tab |

### 12.2 Related Documents

| Document | Location |
|----------|----------|
| Auth Architecture | `docs/explanation/security-model.md` |
| E2E Test Specs | `quikadmin-web/e2e/tests/auth/session*.spec.ts` |
| Backend Auth Routes | `quikadmin/src/api/supabase-auth.routes.ts` |
| Token Family Service | `quikadmin/src/services/RefreshTokenFamilyService.ts` |
| Prisma Schema | `quikadmin/prisma/schema.prisma` |

### 12.3 Browser Compatibility

| Browser | BroadcastChannel | Storage Events | Status |
|---------|------------------|----------------|--------|
| Chrome 54+ | Yes | Yes | Full support |
| Firefox 38+ | Yes | Yes | Full support |
| Safari 15.4+ | Yes | Yes | Full support |
| Safari < 15.4 | No | Yes | Fallback mode |
| Edge 79+ | Yes | Yes | Full support |
| IE 11 | No | Partial | Not supported |

### 12.4 API Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `SESSION_NOT_FOUND` | 404 | Requested session does not exist |
| `CANNOT_REVOKE_CURRENT` | 400 | Cannot revoke your current session |
| `SESSION_ALREADY_REVOKED` | 400 | Session was already revoked |
| `MAX_SESSIONS_REACHED` | 403 | User has too many active sessions |
| `INVALID_SESSION_TOKEN` | 401 | Session token is invalid or expired |

### 12.5 Test User Accounts

| Email | Role | Purpose |
|-------|------|---------|
| `e2e-admin@test.com` | Admin | Full session management |
| `e2e-member@test.com` | Member | Standard session tests |
| `e2e-viewer@test.com` | Viewer | Multi-user session tests |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-09 | AI Agent | Initial draft |

---

**END OF DOCUMENT**

# Frontend Hostile Audit Fixes - PRD

## Overview

This PRD addresses 3 critical issues identified through a hostile audit of the IntelliFill frontend codebase (quikadmin-web). The audit involved 5 SME panels (Frontend Architecture, RBAC/Auth, Data Persistence, Testing, DX/Maintainability) followed by 3 Skeptical Review panels that validated claims through code inspection.

**Original Claims**: 85+
**Post-Skeptical Review**: 3 validated issues
**Reduction Rate**: 96%

## Validated Issues

### Issue 1: ProfileFieldsManager Silent Data Loss [CRITICAL]

**Location**:

- `quikadmin-web/src/pages/ProfileDetail.tsx` (line 478)
- `quikadmin-web/src/components/features/profile-fields-manager.tsx` (lines 541-545)

**Problem**:
The `ProfileFieldsManager` component has a "Save Changes" button that displays a success toast but does NOT actually persist data. The `onFieldsUpdate` callback prop is never passed from `ProfileDetail.tsx`.

```typescript
// ProfileDetail.tsx - onFieldsUpdate is NOT passed
<ProfileFieldsManager
  profileId={id!}
  fields={profile.profileData?.data || {}}
  fieldSources={profile.profileData?.fieldSources || {}}
  editable={true}
/>

// profile-fields-manager.tsx - callback is undefined
const handleSaveChanges = () => {
  onFieldsUpdate?.(localFields);  // Never called - undefined
  setHasChanges(false);
  toast.success('Changes saved');  // LIE - nothing persisted
};
```

**User Impact**: Users click "Save Changes", see success message, leave the page, and lose all their edits.

**Fix Required**:

1. Add a mutation in `ProfileDetail.tsx` to update profile data via API
2. Pass `onFieldsUpdate` callback to `ProfileFieldsManager`
3. Add proper error handling and loading states

---

### Issue 2: Auth Store Has Zero Unit Tests [HIGH]

**Location**:

- `quikadmin-web/src/stores/backendAuthStore.ts` (784 lines)
- `quikadmin-web/src/stores/__tests__/` (no auth tests)

**Problem**:
The `backendAuthStore.ts` is the most critical store containing:

- Login/logout/register flows
- Token refresh logic with expiration handling
- Session initialization with silent refresh
- Account lockout logic
- Error code mapping
- Demo mode handling

This 784-line file has ZERO unit tests. Other stores (documentStore, profilesStore, uploadStore, templateStore, knowledgeStore) all have comprehensive test coverage.

**Risk**: Authentication bugs, session corruption, and lockout issues will reach production undetected.

**Fix Required**:

1. Create `quikadmin-web/src/stores/__tests__/backendAuthStore.test.ts`
2. Test all auth flows: login, register, logout, demoLogin
3. Test token refresh: `isTokenExpiringSoon()`, `refreshTokenIfNeeded()`
4. Test session initialization: `initialize()` with various localStorage states
5. Test error handling: all error code mappings
6. Test account lockout: attempt counting, lock/unlock behavior

---

### Issue 3: 50+ `:any` Type Escapes [MEDIUM]

**Location**: 97 occurrences across 31 production files

**Problem**:
Widespread use of `: any` defeats TypeScript's type safety. Key files affected:

- `services/api.ts` (11 occurrences) - API layer loses type info
- `stores/types.ts` (11 occurrences) - Core type definitions
- `stores/backendAuthStore.ts` (8 occurrences) - Security-adjacent code
- `pages/*.tsx` (various) - Error handlers

**Categories**:

1. **Error handlers** (~30 occurrences): `catch (err: any)` - Common pattern but loses error typing
2. **API responses** (~15 occurrences): `data?: any` - Actual type debt
3. **Component props** (~10 occurrences): Props should be typed
4. **Logger utility** (4 occurrences): `...args: any[]` - Acceptable for variadic

**Fix Required**:

1. Create shared error types: `ApiError`, `AuthError`, `ValidationError`
2. Fix API service types with proper generics
3. Remove `any` from component props
4. Address auth store `any` types (security priority)
5. Defer acceptable cases (logger, error handlers that genuinely need any)

---

## Task Breakdown

### Task 1: Fix ProfileFieldsManager Data Persistence

**Subtasks**:
1.1. Add `updateProfileData` mutation to ProfileDetail.tsx
1.2. Wire `onFieldsUpdate` prop to ProfileFieldsManager
1.3. Add loading state during save
1.4. Add proper error handling with user feedback
1.5. Add integration test for save flow
1.6. Test: Verify data persists after page reload

**Acceptance Criteria**:

- User edits fields, clicks "Save Changes"
- Success toast appears after API call succeeds
- Data persists after page navigation/reload
- Error toast appears if API call fails
- Loading indicator shown during save

---

### Task 2: Add Auth Store Unit Tests

**Subtasks**:
2.1. Create test file with Vitest setup
2.2. Test login flow (success, various error codes, lockout)
2.3. Test register flow (success, validation errors)
2.4. Test logout flow (success, server failure)
2.5. Test demoLogin flow
2.6. Test token refresh (isTokenExpiringSoon, refreshTokenIfNeeded)
2.7. Test initialize flow (no session, expired session, valid session)
2.8. Test password reset flows
2.9. Test loading stage transitions
2.10. Add test coverage threshold check

**Acceptance Criteria**:

- All 784 lines have test coverage
- Tests run in CI pipeline
- Error edge cases covered
- Mock setup documented

---

### Task 3: Fix Critical `:any` Type Escapes

**Subtasks**:
3.1. Create shared error types in `types/errors.ts`
3.2. Fix `services/api.ts` - add generics for responses
3.3. Fix `stores/backendAuthStore.ts` - type error handlers
3.4. Fix `pages/*.tsx` - type mutation error handlers
3.5. Document acceptable `any` uses (logger, truly dynamic)
3.6. Add ESLint rule to warn on new `any` usage

**Acceptance Criteria**:

- `:any` count reduced by 50%+ (from 97 to <50)
- Security-adjacent code (auth) has zero `any`
- API layer fully typed
- ESLint prevents regression

---

## Priority Order

1. **ProfileFieldsManager Fix** - Critical (active data loss)
2. **Auth Store Tests** - High (prevent future auth bugs)
3. **Type Safety** - Medium (tech debt)

## Estimated Effort

| Task                        | Complexity | Subtasks | Hours     |
| --------------------------- | ---------- | -------- | --------- |
| 1. ProfileFieldsManager Fix | Low        | 6        | 3-4       |
| 2. Auth Store Tests         | High       | 10       | 8-12      |
| 3. Type Safety              | Medium     | 6        | 4-6       |
| **Total**                   |            | **22**   | **15-22** |

## Out of Scope (Rejected by Skeptical Review)

The following Phase 1 claims were REJECTED as invalid:

- "No E2E tests" - E2E tests exist at root `/e2e/`
- "No CSRF protection" - SameSite=strict + JWT provides protection
- "Token refresh race conditions" - Singleton promise pattern prevents
- "Role privilege escalation" - Backend validates from database
- "Duplicate migrationUtils" - Different purposes (format vs namespace)
- "loadingStage unused" - Consumed in ProtectedRoute
- "Client-side lockout is theater" - Defense in depth, acceptable
- "Object.freeze pointless" - 1 line, no harm, small benefit
- "Over-testing UI primitives" - Verify accessibility compliance
- "Dual Profile confusion" - Different domain concepts, not naming issue

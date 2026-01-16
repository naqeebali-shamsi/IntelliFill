# Plan 04-04 Summary: SmartProfile Client Integration

## Status: COMPLETE

**Phase:** 04-pro-features
**Duration:** ~40 min (across two sessions with bug fix)

## Objective

Integrate client management with SmartProfile wizard for seamless client-profile workflow. PRO agents need to easily save extracted profiles to existing clients or create new clients directly from the Smart Profile flow.

## Tasks Completed (4/4)

| #   | Task                                       | Files                                                           | Commit    |
| --- | ------------------------------------------ | --------------------------------------------------------------- | --------- |
| 1   | Add client state to smartProfileStore      | `quikadmin-web/src/stores/smartProfileStore.ts`                 | `28b6ec5` |
| 2   | Create ClientSelector component            | `quikadmin-web/src/components/smart-profile/ClientSelector.tsx` | `52b9eaf` |
| 3   | Integrate ClientSelector into SmartProfile | `quikadmin-web/src/pages/SmartProfile.tsx`                      | `2cddaea` |
| 4   | Human verification + Bug fix               | `quikadmin/src/api/clients.routes.ts`                           | `735008f` |

## Implementation Details

### Task 1: smartProfileStore Client Selection State

Extended store with client selection workflow state:

**New State Fields:**

- `selectedClientId: string | null` - Existing client to save to
- `newClientName: string | null` - Name for new client creation
- `clientMode: 'existing' | 'new' | null` - Selection mode
- `savedClientName: string | null` - Display name after successful save

**New Actions:**

- `selectExistingClient(clientId, clientName)` - Select existing client
- `setNewClientName(name)` - Set name for new client
- `setClientMode(mode)` - Set selection mode
- `clearClientSelection()` - Reset all client state
- `setSavedClientName(name)` - Set saved client name

**New Hook:**

- `useClientSelection()` - Convenience hook for components

### Task 2: ClientSelector Component

Created `ClientSelector.tsx` in `components/smart-profile/`:

**UI Structure:**

1. Tabbed interface using Radix Tabs
   - "Existing Client" tab (default)
   - "New Client" tab

2. Existing Client Tab:
   - Search input with debounce (300ms)
   - Scrollable client list (max 10 items)
   - Each item: name, type badge, doc count
   - Visual selection with checkmark
   - Filter to ACTIVE clients only

3. New Client Tab:
   - Name input (pre-filled from profile data)
   - Type select (INDIVIDUAL/COMPANY)
   - Required validation

4. Action buttons:
   - Cancel
   - Save to Client / Create & Save (disabled until valid)

**Props Interface:**

```typescript
interface ClientSelectorProps {
  onSelectExisting: (clientId: string, clientName: string) => void;
  onCreateNew: (name: string, type: ClientType) => void;
  onCancel: () => void;
  selectedClientId?: string;
  defaultName?: string;
  isLoading?: boolean;
}
```

### Task 3: SmartProfile Integration

Modified `SmartProfile.tsx` ProfileStepContent:

**UI Changes:**

- "Save to Client" button in profile card header
- Collapsible ClientSelector panel using Radix Collapsible
- After save: "Saved to: {clientName}" badge with Change button

**New Handlers:**

- `handleSaveToClient(clientId)`: Get client name, merge profile via API
- `handleCreateClientAndSave(name, type)`: Create client + save profile

**API Integration:**

- Uses `profilesService.updateProfileData(clientId, data)` for consistent auth
- Backend endpoint: PUT `/api/clients/:clientId/profile`

**Reset Behavior:**

- `handleReset()` now calls `clearClientSelection()`

### Task 4: Bug Fix - Profile Data Not Displaying

**Bug Report:** Save to client showed success notification but when navigating to the client's profile, stored data showed empty.

**Root Cause Analysis:**

1. Backend GET `/api/clients/:id` returned: `profileData: client.profile?.data` (flattened data)
2. Frontend `profilesService.getWithData()` expected: `client.profile` (full object with data, fieldSources)
3. ProfileDetail accessed: `profile.profileData?.data` (undefined because profileData was already the data, not a wrapper)

**Fix Applied:**

Modified `quikadmin/src/api/clients.routes.ts` to return full profile object:

```javascript
profile: client.profile ? {
  id: client.profile.id,
  data: client.profile.data || {},
  fieldSources: client.profile.fieldSources || {},
  updatedAt: client.profile.updatedAt.toISOString(),
} : null,
// Keep profileData for backward compatibility
profileData: client.profile?.data || {},
```

## Verification Checklist

- [x] `cd quikadmin-web && bun run build` succeeds
- [x] "Save to Client" button appears in profile step
- [x] Can search and select existing client
- [x] Can create new client with name
- [x] Profile merges to selected client
- [x] Profile data displays correctly in ProfileDetail after save
- [x] Backend tests pass (65 tests)
- [x] User verified and reported bug
- [x] Bug fixed and committed

## Dependencies

- Plan 04-01 completed (clientsService, clientsStore)
- Backend `/api/clients` and `/api/clients/:id/profile` endpoints

## Patterns Followed

- Store pattern from `clientsStore.ts` (immer + devtools)
- Component pattern from `FormSuggester/` (tabs, search)
- Service pattern using authenticated `api` instance
- Collapsible pattern from Radix UI primitives

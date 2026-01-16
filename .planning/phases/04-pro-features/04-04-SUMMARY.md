# Plan 04-04 Summary: SmartProfile Client Integration

## Status: PAUSED AT CHECKPOINT

Plan paused for human verification of client integration flow.

## Objective

Integrate client management with SmartProfile wizard for seamless client-profile workflow. PRO agents need to easily save extracted profiles to existing clients or create new clients directly from the Smart Profile flow.

## Tasks Completed (3/4)

| #   | Task                                       | Files                                                           | Commit    |
| --- | ------------------------------------------ | --------------------------------------------------------------- | --------- |
| 1   | Add client state to smartProfileStore      | `quikadmin-web/src/stores/smartProfileStore.ts`                 | `28b6ec5` |
| 2   | Create ClientSelector component            | `quikadmin-web/src/components/smart-profile/ClientSelector.tsx` | `52b9eaf` |
| 3   | Integrate ClientSelector into SmartProfile | `quikadmin-web/src/pages/SmartProfile.tsx`                      | `2cddaea` |
| 4   | **CHECKPOINT** Human verification          | -                                                               | PENDING   |

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

## Verification Checklist

- [x] `cd quikadmin-web && bun run build` succeeds
- [x] "Save to Client" button appears in profile step
- [ ] Can search and select existing client (needs human verify)
- [ ] Can create new client with name (needs human verify)
- [ ] Profile merges to selected client (needs human verify)
- [ ] User approved the integration flow (PENDING)

## Checkpoint Requirements

To verify this plan, test the following:

1. **Start services:**

   ```bash
   # Backend
   cd quikadmin && npm run dev
   # Frontend
   cd quikadmin-web && bun run dev
   ```

2. **Navigate to:** http://localhost:8080/smart-profile

3. **Test flow:**
   - Upload a document (any test PDF)
   - Progress through wizard to profile step
   - Test "Save to Existing Client" (if clients exist)
   - Test "Create New Client"
   - Verify toasts show success
   - Verify client appears in /clients page

4. **Resume signal:** Type "approved" to continue, or describe issues

## Dependencies

- Plan 04-01 completed (clientsService, clientsStore)
- Backend `/api/clients` and `/api/clients/:id/profile` endpoints

## Patterns Followed

- Store pattern from `clientsStore.ts` (immer + devtools)
- Component pattern from `FormSuggester/` (tabs, search)
- Service pattern using authenticated `api` instance
- Collapsible pattern from Radix UI primitives

# Extraction & Download Evidence Bundle

**Generated**: 2025-12-20
**Test Status**: BLOCKED - Accounts Deactivated

## Summary

| Metric          | Value                     |
| --------------- | ------------------------- |
| Frontend Status | Working                   |
| Backend Status  | Working                   |
| Login Result    | 403 - Account Deactivated |
| Demo Result     | 403 - Account Deactivated |
| Extraction Test | Not Reached               |

## Deployment Status

### Frontend (Vercel)

- **URL**: `https://intellifill-web.vercel.app`
- **Status**: WORKING
- **Screenshot**: `artifacts/repro/01_login_page.png`

### Backend API (Render)

- **URL**: `https://intellifill-api.onrender.com`
- **Status**: WORKING (responding to requests)

## Test Execution

### Step 1: Navigate to Login Page

- **Result**: Success
- **Screenshot**: `artifacts/repro/01_login_page.png`

### Step 2: Login with Test Credentials

- **Email**: `Naqeebali.shamsi@gmail.com`
- **API Endpoint**: `POST /api/auth/v2/login`
- **Response**: `403 Forbidden`
- **Error**: `ACCOUNT_DEACTIVATED - Account is deactivated. Please contact support.`
- **Screenshot**: `artifacts/repro/02_account_deactivated.png`

### Step 3: Try Demo Mode

- **API Endpoint**: `POST /api/auth/v2/demo`
- **Response**: `403 Forbidden`
- **Error**: `ACCOUNT_DEACTIVATED - Account is deactivated. Please contact support.`
- **Screenshot**: `artifacts/repro/03_demo_also_deactivated.png`

## Network Requests Captured

| Method | Endpoint             | Status | Result              |
| ------ | -------------------- | ------ | ------------------- |
| POST   | `/api/auth/v2/login` | 403    | Account deactivated |
| POST   | `/api/auth/v2/demo`  | 403    | Account deactivated |

## Root Cause

Both the test user account (`Naqeebali.shamsi@gmail.com`) and the demo account have been deactivated in the database. This prevents any testing of the extraction and download flow.

## Required Actions

1. **Reactivate Test Account**: Update the user record in the database

   ```sql
   UPDATE users SET is_active = true WHERE email = 'Naqeebali.shamsi@gmail.com';
   ```

2. **Reactivate Demo Account**: Ensure demo user is active

   ```sql
   UPDATE users SET is_active = true WHERE email = 'demo@intellifill.local';
   ```

3. **Re-run Tests**: After reactivation, execute:
   ```bash
   npx ts-node scripts/repro_extraction_download.ts
   ```

## Artifacts Generated

| Artifact      | Path                                           | Description        |
| ------------- | ---------------------------------------------- | ------------------ |
| Login Page    | `artifacts/repro/01_login_page.png`            | Initial login page |
| Account Error | `artifacts/repro/02_account_deactivated.png`   | Login failure      |
| Demo Error    | `artifacts/repro/03_demo_also_deactivated.png` | Demo login failure |

## Script Location

The Playwright reproduction script is ready at:

- **Path**: `scripts/repro_extraction_download.ts`

Once accounts are reactivated, the script will:

1. Login with credentials
2. Navigate to Form Fill page
3. Select a profile
4. Upload a test PDF form
5. Wait for form analysis
6. Review field mappings
7. Trigger form filling
8. Capture download

## Console Logs

```
[LOG] Auth mode: Backend API
[LOG] All stores initialized successfully
[ERROR] Login error: {code: ACCOUNT_DEACTIVATED, message: Account is deactivated}
[ERROR] Demo login failed: {code: ACCOUNT_DEACTIVATED, message: Account is deactivated}
```

## Next Steps

1. Contact admin to reactivate accounts
2. Or create a new test account via registration
3. Re-run the extraction/download test
4. Complete the evidence bundle with full flow screenshots

# Test Credentials for IntelliFill

## ✅ Working Test Accounts

The following test accounts have been created and are ready to use:

### 🔐 Test User Credentials

| Email | Password | Role | Access Level |
|-------|----------|------|--------------|
| **admin@test.com** | `Admin123!` | **ADMIN** | Full administrative access |
| **user@test.com** | `User123!` | **USER** | Standard user access |
| **viewer@test.com** | `Viewer123!` | **VIEWER** | Read-only access |

---

## 🚀 How to Sign In

### 1. Start the Application

**Backend (Terminal 1):**
```bash
cd N:/IntelliFill/quikadmin
npm run dev
```

**Frontend (Terminal 2):**
```bash
cd N:/IntelliFill/quikadmin-web
bun run dev
```

### 2. Access the Application

Open your browser and navigate to:
```
http://localhost:8080
```

### 3. Sign In

Use any of the credentials above to sign in.

**Recommended for first login:**
- Email: `admin@test.com`
- Password: `Admin123!`

---

## 🔧 Technical Details

### Authentication System
- **Provider:** Supabase Auth
- **Backend API:** Express.js on port 3002
- **Frontend:** React/Vite on port 8080
- **Auth Endpoint:** `POST /api/auth/v2/login`

### Account Status
- ✅ All accounts are **active**
- ✅ All emails are **verified** (no verification step required)
- ✅ Accounts exist in both **Supabase Auth** and **Prisma database**

### Supabase User IDs
- Admin: `061c4672-e2d8-4b6e-91bb-769bc680c34e`
- User: `92aa042b-7744-4a8f-9504-dd3f0caebaca`
- Viewer: `d6d954ee-900c-4561-8660-4b884d014418`

### Prisma User IDs
- Admin: `dcb1c2b1-18b3-4d41-bbbf-c63c0b13fa1e`
- User: `9b12f53c-153f-4ad8-ab86-41aa2ba20e02`
- Viewer: `35ac227e-af2d-4b15-9599-59f80e19e406`

---

## 🧪 Testing Login via API (curl)

If you want to test the login API directly:

```bash
curl -X POST http://localhost:3002/api/auth/v2/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Admin123!"}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "dcb1c2b1-18b3-4d41-bbbf-c63c0b13fa1e",
      "email": "admin@test.com",
      "firstName": "Admin",
      "lastName": "User",
      "role": "ADMIN",
      "isActive": true,
      "emailVerified": true
    },
    "session": {
      "access_token": "...",
      "refresh_token": "...",
      "expires_in": 3600
    }
  }
}
```

---

## 🔄 Recreating Test Users

If you need to recreate or verify test users, run:

```bash
cd N:/IntelliFill/quikadmin
npx ts-node scripts/create-test-users-supabase.ts
```

This script will:
- Check if users exist in Supabase Auth
- Create missing users
- Link Supabase Auth accounts with Prisma database
- Display credentials

---

## ⚠️ Important Notes

### Development Only
These credentials are for **development and testing only**:
- ❌ **Never use in production**
- ❌ **Never commit to version control**
- ✅ **Delete before deploying**
- ✅ **Use strong passwords in production**

### Password Requirements
The application enforces the following password requirements:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character

All test passwords meet these requirements.

---

## 🐛 Troubleshooting

### "Invalid email or password" Error

This can happen if:
1. **Backend not running** - Make sure `npm run dev` is running in the backend
2. **Supabase credentials not configured** - Check `.env` file has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
3. **Users not linked** - Run `npx ts-node scripts/create-test-users-supabase.ts`

### Login Endpoint Not Found

Make sure you're using the correct endpoint:
- ✅ Correct: `/api/auth/v2/login`
- ❌ Incorrect: `/api/auth/login`
- ❌ Incorrect: `/login`

### Rate Limiting

The auth endpoint has rate limiting:
- **Development:** 100 requests per 15 minutes
- **Production:** 5 requests per 15 minutes

If you hit the rate limit, wait 15 minutes or restart the backend.

---

**Last Updated:** 2025-11-07
**Created By:** Automated test user setup script
**Script Location:** `scripts/create-test-users-supabase.ts`

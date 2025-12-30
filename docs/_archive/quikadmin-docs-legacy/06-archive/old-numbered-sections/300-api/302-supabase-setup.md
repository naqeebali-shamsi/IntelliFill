# Supabase Setup Guide

**Status:** Phase 4 SDK Migration - In Progress
**Last Updated:** 2025-10-25

## Prerequisites

- Node.js 20.x
- npm or bun
- Supabase account (free tier)

## Step 1: Create Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in:
   - **Name:** QuikAdmin (or your preference)
   - **Database Password:** Generate secure password (save it!)
   - **Region:** Choose closest to your users
   - **Pricing Plan:** Free tier (50,000 MAU)
4. Click "Create new project"
5. Wait 2-3 minutes for provisioning

## Step 2: Get API Credentials

1. In Supabase dashboard, go to **Settings** > **API**
2. Copy these values:
   - **Project URL** (e.g., https://abcdefgh.supabase.co)
   - **anon public** key (starts with "eyJ...")
   - **service_role** key (starts with "eyJ..." - KEEP SECRET!)

## Step 3: Configure Environment

Add to your `.env` file:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ IMPORTANT:**

- **NEVER** commit `.env` to git
- **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` to frontend
- **ALWAYS** use `SUPABASE_ANON_KEY` for frontend

## Step 4: Verify Installation

Run the test script:

```bash
npx ts-node scripts/test-supabase-connection.ts
```

Expected output:

```
✅ Supabase URL configured
✅ Supabase Anon Key configured
✅ Supabase Service Role Key configured
✅ Successfully connected to Supabase
✅ Supabase Auth API is responsive
```

## Step 5: Configure Auth Settings (Optional)

In Supabase dashboard, go to **Authentication** > **Settings**:

1. **Site URL:** Set to your frontend URL (e.g., http://localhost:5173)
2. **Redirect URLs:** Add allowed redirect URLs
3. **Email Templates:** Customize confirmation, reset password emails
4. **Auth Providers:** Enable if you want OAuth (Google, GitHub, etc.)

## Troubleshooting

### Error: "Invalid API key"

- Check that you copied the correct keys from Supabase dashboard
- Verify no extra spaces or line breaks in `.env`

### Error: "Failed to fetch"

- Check internet connection
- Verify SUPABASE_URL is correct (includes https://)
- Check Supabase project is not paused (free tier pauses after inactivity)

### Warning: "Missing SUPABASE_SERVICE_ROLE_KEY"

- This is expected during migration
- Backend will continue using custom JWT until migration complete
- Add the key when ready to migrate admin operations

## Next Steps

- [Phase 2: Middleware Migration](./303-supabase-middleware.md)
- [Phase 3: Auth Routes Migration](./304-supabase-auth-routes.md)
- [Full Migration Plan](../SUPABASE_AUTH_MIGRATION_PLAN.md)

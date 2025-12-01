# 🔐 Security Credential Rotation Guide

## ⚠️ IMMEDIATE ACTION REQUIRED

The following credentials were exposed in git history and **MUST be rotated**:

### 1. Neon Database Credentials (HIGH PRIORITY)

**Exposed in:** `.env.neon` (git commit history)
**Connection String:** `postgresql://neondb_owner:npg_TzsoutE4V7XC@ep-nameless-star-aem8mxnu-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require`

**Action Steps:**
1. Go to [Neon Console](https://console.neon.tech/)
2. Navigate to project: `quiet-leaf-92753956`
3. Reset database password for user `neondb_owner`
4. Update `DATABASE_URL` in your local `.env` file (NOT committed to git)
5. Update production environment variables
6. Test connection: `npm run test:neon-serverless`

### 2. JWT Secrets (MEDIUM PRIORITY)

**Status:** Only development placeholders were tracked (safe)
**Current:** `dev-secret-key-change-in-production`

**Action Steps:**
1. Generate new production secrets (64+ characters):
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
   ```
2. Update `.env` with new `JWT_SECRET` and `JWT_REFRESH_SECRET`
3. Deploy to production
4. Existing sessions will be invalidated (users must re-login)

### 3. Supabase Keys (LOW PRIORITY)

**Status:** Only placeholders tracked (`your-anon-key`, `your-service-role-key`)
**Action:** Verify real keys are only in local `.env` file

---

## Files Secured

The following files have been:
- ✅ Removed from git tracking
- ✅ Added to `.gitignore`
- ✅ Protected by pre-commit hooks

Files:
- `.env.development`
- `.env.neon`
- `web/cypress.env.json`

**Local copies preserved** - you can still use these files locally.

---

## Pre-Commit Hook Installed

A security pre-commit hook now prevents:
- Committing any `.env` files (except `.env.example`)
- Committing files with potential secrets (API keys, tokens, passwords)
- Accidentally staging forbidden files

To bypass (only if false positive):
```bash
git commit --no-verify
```

---

## Best Practices Going Forward

1. **Never commit secrets** - Use `.env` files locally only
2. **Use strong secrets** - Minimum 64 characters for JWT, database passwords
3. **Rotate regularly** - Change credentials every 90 days
4. **Use environment-specific keys** - Different keys for dev/staging/prod
5. **Audit access** - Review who has access to production credentials

---

## Verification Checklist

- [ ] Neon database password rotated
- [ ] New `DATABASE_URL` updated in production
- [ ] JWT secrets updated (if in production)
- [ ] All services restarted with new credentials
- [ ] Connection tests passing
- [ ] Pre-commit hook tested (`git commit` should fail on `.env`)

---

## Need Help?

If you encounter issues during rotation:
1. Check connection strings match format in `.env.example`
2. Verify SSL mode for Neon: `?sslmode=require`
3. Test locally before deploying to production
4. Keep old credentials active until new ones are verified

---

**Created:** 2025-11-07
**Priority:** 🔴 HIGH - Complete within 24 hours

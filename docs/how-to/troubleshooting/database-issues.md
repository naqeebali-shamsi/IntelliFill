---
title: Database Issues
description: Troubleshoot and fix database connection problems
category: how-to
tags: [troubleshooting, database, postgresql, neon]
lastUpdated: 2025-11-25
---

# Database Issues

This guide helps you troubleshoot and resolve common database connection problems in IntelliFill.

---

## Quick Diagnosis

### Check Database Connection

```bash
cd quikadmin

# Test connection with Prisma
npx prisma db pull

# Or run test script
npx ts-node scripts/test-neon-serverless.ts
```

### Check Health Endpoint

```bash
curl http://localhost:3002/health
```

If you see `"status":"ok"`, the database is connected.

---

## Common Issues

### Issue 1: Connection Terminated Unexpectedly

**Symptoms**:
```
Connection terminated unexpectedly
Error in PostgreSQL connection: Error { kind: Closed, cause: None }
```

**Cause**: Neon serverless connections timeout after ~5-8 minutes of inactivity.

**Solutions**:

1. **Restart the backend**:
   ```bash
   # Stop and restart
   Ctrl+C
   npm run dev
   ```

2. **Use connection pooling** (recommended):
   ```env
   # Use the pooled connection string (has -pooler in hostname)
   DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.neon.tech/db?sslmode=require"
   ```

3. **Implement keepalive** (code change):
   ```typescript
   // In prisma.ts
   setInterval(async () => {
     await prisma.$queryRaw`SELECT 1`;
   }, 4 * 60 * 1000); // Every 4 minutes
   ```

---

### Issue 2: Connection Refused

**Symptoms**:
```
connect ECONNREFUSED 127.0.0.1:5432
```

**Cause**: PostgreSQL is not running or wrong host/port.

**Solutions**:

1. **Check PostgreSQL is running**:
   ```bash
   # Windows
   net start postgresql
   
   # macOS
   brew services start postgresql
   
   # Linux
   sudo systemctl start postgresql
   ```

2. **Check Docker container**:
   ```bash
   docker ps
   docker-compose up -d postgres
   ```

3. **Verify connection string**:
   ```bash
   # Check .env
   cat .env | grep DATABASE_URL
   ```

---

### Issue 3: Authentication Failed

**Symptoms**:
```
password authentication failed for user "..."
```

**Solutions**:

1. **Verify credentials in DATABASE_URL**:
   ```env
   DATABASE_URL="postgresql://user:correct_password@host:5432/dbname"
   ```

2. **Reset password** (local PostgreSQL):
   ```sql
   ALTER USER myuser WITH PASSWORD 'newpassword';
   ```

3. **Check Neon dashboard** for correct credentials.

---

### Issue 4: Database Does Not Exist

**Symptoms**:
```
database "intellifill" does not exist
```

**Solutions**:

1. **Create database**:
   ```bash
   createdb intellifill
   ```

2. **Or via psql**:
   ```sql
   CREATE DATABASE intellifill;
   ```

3. **Run migrations**:
   ```bash
   npx prisma migrate dev
   ```

---

### Issue 5: SSL Required

**Symptoms**:
```
no pg_hba.conf entry for host
SSL connection is required
```

**Solutions**:

1. **Add SSL to connection string**:
   ```env
   DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
   ```

2. **For local development** (disable SSL):
   ```env
   DATABASE_URL="postgresql://user:pass@localhost:5432/db?sslmode=disable"
   ```

---

### Issue 6: Prisma Client Outdated

**Symptoms**:
```
The Prisma schema has changed since the last generation
Prisma Client is not yet built
```

**Solutions**:

1. **Regenerate client**:
   ```bash
   npx prisma generate
   ```

2. **If still failing, reinstall**:
   ```bash
   rm -rf node_modules/.prisma
   npm install
   npx prisma generate
   ```

---

### Issue 7: Migration Failed

**Symptoms**:
```
Migration failed to apply
```

**Solutions**:

1. **Check migration status**:
   ```bash
   npx prisma migrate status
   ```

2. **Reset database** (WARNING: deletes data):
   ```bash
   npx prisma migrate reset
   ```

3. **Mark migration as applied** (if already applied manually):
   ```bash
   npx prisma migrate resolve --applied "migration_name"
   ```

---

## Neon-Specific Issues

### Connection Limits

**Symptoms**:
```
too many connections
```

**Solutions**:

1. **Use connection pooling**:
   ```env
   DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.neon.tech/db"
   ```

2. **Reduce connection limit in Prisma**:
   ```env
   DATABASE_URL="...?connection_limit=5"
   ```

### Serverless Cold Starts

**Symptoms**: First query after idle period is slow (2-5 seconds).

**Solutions**:

1. **Accept the latency** (expected behavior)
2. **Use compute always-on** (paid feature)
3. **Implement warmup queries**

---

## Diagnostic Commands

### Test Raw Connection

```bash
# Using psql
psql "postgresql://user:pass@host:5432/db?sslmode=require"

# Test query
SELECT 1;
```

### Check Prisma Configuration

```bash
# Validate schema
npx prisma validate

# Show current database
npx prisma db pull --print
```

### View Connection Pool Status

```typescript
// Add to your code temporarily
console.log(await prisma.$metrics.json());
```

---

## Logs to Check

### Backend Logs

```bash
# View logs
cat logs/backend.log | grep -i database
cat logs/backend.log | grep -i prisma
```

### Prisma Logs

Enable query logging:

```typescript
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

---

## Prevention Tips

1. **Use connection pooling** for serverless databases
2. **Implement proper error handling** in database operations
3. **Add health checks** to monitor connections
4. **Use connection timeouts** to fail fast
5. **Log database errors** for debugging

---

## Related Documentation

- [Database Setup](../development/database-setup.md)
- [Environment Variables](../../reference/configuration/environment.md)
- [Local Setup](../development/local-setup.md)


---
title: Deployment Issues
description: Troubleshoot common deployment problems on Render, Vercel, and cloud platforms
category: how-to
tags: [troubleshooting, deployment, render, vercel, sharp, redis, pnpm]
lastUpdated: 2025-12-19
---

# Deployment Issues

This guide helps you troubleshoot and resolve common deployment problems when deploying IntelliFill to cloud platforms like Render (backend) and Vercel (frontend).

---

## Quick Diagnosis

### Check Deployment Logs

```bash
# Render - View in dashboard or use CLI
render logs intellifill-api

# Vercel
vercel logs your-project
```

### Verify Health Endpoints

```bash
# Backend health check
curl https://your-api.onrender.com/api/health

# Backend readiness check (includes Redis/DB status)
curl https://your-api.onrender.com/api/ready
```

---

## Common Issues

### Issue 1: Sharp Native Binary Errors (Linux/Render)

**Symptoms**:

```
Error: Could not load the "sharp" module using the linux-x64 runtime
Something went wrong installing the "sharp" module
Cannot find module '../build/Release/sharp-linux-x64.node'
```

**Cause**: Sharp requires platform-specific native binaries. When developing on Windows and deploying to Linux (Render), the Windows binaries don't work.

**Solutions**:

1. **Use pnpm with platform flags** (recommended):

   ```yaml
   # render.yaml
   buildCommand: cd .. && corepack enable && pnpm install --frozen-lockfile && cd quikadmin && npx prisma generate && pnpm run build
   ```

   pnpm automatically handles platform-specific binary resolution correctly.

2. **Force rebuild on deployment**:

   ```bash
   # In your build command
   npm rebuild sharp --platform=linux --arch=x64
   ```

3. **Clear node_modules cache on Render**:
   - Go to Render Dashboard > Your Service > Settings
   - Click "Clear build cache" before next deploy

4. **Verify sharp installation in package.json**:
   ```json
   {
     "dependencies": {
       "sharp": "^0.33.x"
     }
   }
   ```

**Prevention**: Use pnpm for cross-platform deployments. It handles native binary resolution more reliably than npm/yarn when developing on a different platform than production.

---

### Issue 2: Bull Queue Redis TLS Connection Failed

**Symptoms**:

```
Error: Redis connection to ... failed - connect ECONNREFUSED
Error: getaddrinfo ENOTFOUND
Bull queue initialization failed
```

Or with TLS issues:

```
Error: unable to verify the first certificate
DEPTH_ZERO_SELF_SIGNED_CERT
```

**Cause**: Upstash Redis requires TLS connections (rediss:// protocol), but Bull queue or ioredis may not be configured for TLS properly.

**Solutions**:

1. **Use correct Upstash Redis URL format**:

   ```env
   # CORRECT - with TLS (rediss://)
   REDIS_URL=rediss://default:password@your-endpoint.upstash.io:6379

   # INCORRECT - without TLS
   REDIS_URL=redis://default:password@your-endpoint.upstash.io:6379
   ```

2. **Configure Bull queue with TLS options**:

   ```typescript
   import Bull from 'bull';

   const redisUrl = process.env.REDIS_URL;
   const isUpstash = redisUrl?.includes('upstash.io');

   const queue = new Bull('my-queue', {
     redis: {
       // Parse from REDIS_URL or configure manually
       tls: isUpstash ? { rejectUnauthorized: false } : undefined,
       maxRetriesPerRequest: null,
       enableReadyCheck: false,
     },
   });
   ```

3. **For ioredis direct usage**:

   ```typescript
   import Redis from 'ioredis';

   const redis = new Redis(process.env.REDIS_URL, {
     tls: process.env.REDIS_URL?.startsWith('rediss://')
       ? { rejectUnauthorized: false }
       : undefined,
     maxRetriesPerRequest: null,
   });
   ```

4. **Verify Upstash configuration**:
   - Go to Upstash Console
   - Confirm TLS is enabled (default for new databases)
   - Copy the correct `rediss://` URL from the dashboard

**See also**: [Upstash Redis Setup](../deployment/upstash-redis-setup.md)

---

### Issue 3: Postinstall Scripts Breaking Vercel Builds

**Symptoms**:

```
Error: Cannot find module 'lightningcss-win32-x64-msvc'
The package "lightningcss-win32-x64-msvc" could not be found
Build failed during postinstall
```

**Cause**: Postinstall scripts that rebuild native modules may corrupt platform-specific binaries when running in a different environment (e.g., Windows lockfile deployed to Linux).

**Solutions**:

1. **Remove unnecessary postinstall scripts**:

   ```json
   {
     "scripts": {
       // Remove if not needed
       // "postinstall": "patch-package && npm rebuild"
     }
   }
   ```

2. **Use platform-conditional postinstall**:

   ```json
   {
     "scripts": {
       "postinstall": "node scripts/postinstall.js"
     }
   }
   ```

   ```javascript
   // scripts/postinstall.js
   const os = require('os');
   if (os.platform() !== 'win32') {
     // Only run on non-Windows (production)
     require('child_process').execSync('npm rebuild', { stdio: 'inherit' });
   }
   ```

3. **Clear Vercel build cache**:

   ```bash
   vercel --force
   ```

4. **Use separate lockfiles** (advanced):
   - Maintain platform-specific lockfiles if needed
   - Or use pnpm which handles this better

---

### Issue 4: pnpm vs npm Workspace Lifecycle Differences

**Symptoms**:

```
Build works locally with npm but fails on Render with pnpm
Scripts not running in expected order
Missing generated files (Prisma client, etc.)
```

**Cause**: pnpm handles workspace lifecycle scripts differently than npm. Postinstall scripts may not run in the same context or order.

**Solutions**:

1. **Explicit script execution in build command**:

   ```yaml
   # render.yaml
   buildCommand: >
     cd .. &&
     corepack enable &&
     pnpm install --frozen-lockfile &&
     cd quikadmin &&
     npx prisma generate &&
     pnpm run build
   ```

2. **Don't rely on postinstall for critical steps**:

   ```json
   {
     "scripts": {
       "build": "prisma generate && tsc",
       "postinstall": "echo 'Skipping postinstall in CI'"
     }
   }
   ```

3. **Use pnpm's lifecycle hooks explicitly**:
   ```json
   {
     "scripts": {
       "prepare": "prisma generate",
       "build": "tsc"
     }
   }
   ```

---

### Issue 5: Render Cold Start Timeouts

**Symptoms**:

```
Health check failed
Container failed to start within 60 seconds
First request timeout
```

**Cause**: Free tier Render services spin down after 15 minutes of inactivity. Cold starts can take 30-60 seconds.

**Solutions**:

1. **Optimize startup time**:
   - Lazy-load heavy dependencies
   - Defer non-critical initialization
   - Use connection pooling for databases

2. **Set appropriate health check timing**:

   ```yaml
   # render.yaml
   healthCheckPath: /api/health
   # Render allows up to 5 minutes for initial health check
   ```

3. **Implement warmup endpoint**:

   ```typescript
   app.get('/api/health', (req, res) => {
     res.json({ status: 'ok', timestamp: Date.now() });
   });

   app.get('/api/ready', async (req, res) => {
     // Check all dependencies
     const checks = {
       database: await checkDatabase(),
       redis: await checkRedis(),
     };
     res.json({ status: 'ready', checks });
   });
   ```

4. **Use uptime monitoring to prevent spin-down**:
   - Set up UptimeRobot or similar
   - Ping `/api/health` every 10-14 minutes
   - Only during business hours to save resources

---

### Issue 6: Environment Variable Misconfiguration

**Symptoms**:

```
Missing required environment variable
Config validation failed
TypeError: Cannot read properties of undefined
```

**Solutions**:

1. **Verify all required variables are set in Render/Vercel dashboard**:

   **Required for Backend**:

   ```env
   NODE_ENV=production
   PORT=3002
   DATABASE_URL=postgresql://...
   DIRECT_URL=postgresql://...
   JWT_SECRET=...
   ```

   **Required for Redis/Queues**:

   ```env
   REDIS_URL=rediss://...
   ```

2. **Check for sync: false variables**:
   Variables marked with `sync: false` in render.yaml must be manually set in the dashboard.

3. **Use environment variable validation at startup**:
   ```typescript
   const required = ['DATABASE_URL', 'JWT_SECRET'];
   for (const key of required) {
     if (!process.env[key]) {
       throw new Error(`Missing required env: ${key}`);
     }
   }
   ```

---

### Issue 7: Prisma Client Generation Failures

**Symptoms**:

```
Prisma Client has not been generated yet
Cannot find module '.prisma/client'
```

**Cause**: Prisma generate wasn't run during build, or generated client wasn't included in deployment.

**Solutions**:

1. **Ensure prisma generate runs during build**:

   ```yaml
   buildCommand: npx prisma generate && npm run build
   ```

2. **Check binaryTargets in schema.prisma**:

   ```prisma
   generator client {
     provider      = "prisma-client-js"
     binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
   }
   ```

3. **Verify Prisma in dependencies (not devDependencies)**:
   ```json
   {
     "dependencies": {
       "prisma": "^6.x",
       "@prisma/client": "^6.x"
     }
   }
   ```

---

## Platform-Specific Guides

### Render Deployment Checklist

1. [ ] **Build command includes all steps**:

   ```yaml
   buildCommand: corepack enable && pnpm install --frozen-lockfile && npx prisma generate && pnpm run build
   ```

2. [ ] **Start command is correct**:

   ```yaml
   startCommand: pnpm run start:prod
   ```

3. [ ] **Health check path is set**:

   ```yaml
   healthCheckPath: /api/health
   ```

4. [ ] **All environment variables are configured** (check `sync: false` items)

5. [ ] **Redis URL uses TLS** (`rediss://` not `redis://`)

6. [ ] **Build cache cleared** after major dependency changes

### Vercel Deployment Checklist

1. [ ] **No postinstall scripts that break on Linux**

2. [ ] **Environment variables set** in Vercel dashboard

3. [ ] **Build command is explicit**:

   ```json
   {
     "scripts": {
       "build": "vite build"
     }
   }
   ```

4. [ ] **API URL points to Render backend**:
   ```env
   VITE_API_URL=https://your-api.onrender.com/api
   ```

---

## Diagnostic Commands

### Check Build Output

```bash
# Render - redeploy with verbose logging
render deploy --verbose

# Check what files are deployed
ls -la dist/
```

### Test Redis Connection

```bash
# Using redis-cli with TLS
redis-cli -u "rediss://default:password@endpoint.upstash.io:6379" PING

# Or in Node.js
node -e "const Redis = require('ioredis'); new Redis(process.env.REDIS_URL).ping().then(console.log)"
```

### Verify Prisma Client

```bash
# Check if client is generated
ls node_modules/.prisma/client/

# Test client initialization
npx ts-node -e "import { PrismaClient } from '@prisma/client'; new PrismaClient()"
```

---

## Prevention Best Practices

1. **Use pnpm for cross-platform consistency** - Better native binary handling
2. **Explicit build steps** - Don't rely on postinstall hooks for critical operations
3. **TLS by default for Redis** - Always use `rediss://` for cloud Redis
4. **Environment variable validation** - Fail fast on missing configuration
5. **Platform-specific binary targets** - Configure Prisma for both dev and prod platforms
6. **Clear build caches** - After major dependency or package manager changes
7. **Health checks with dependencies** - Include DB/Redis status in readiness checks

---

## Related Documentation

- [Upstash Redis Setup](../deployment/upstash-redis-setup.md)
- [Docker Deployment](../deployment/docker-deployment.md)
- [Environment Variables](../../reference/configuration/environment.md)
- [Database Issues](./database-issues.md)

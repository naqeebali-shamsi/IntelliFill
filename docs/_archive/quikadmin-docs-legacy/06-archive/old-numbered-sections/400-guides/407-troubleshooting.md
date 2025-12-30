# Troubleshooting Guide

**Last Updated:** 2025-01-10
**Status:** Complete
**Difficulty:** Beginner
**Audience:** Developers

---

## Overview

This guide provides solutions to common issues encountered when developing or deploying QuikAdmin. Issues are organized by category for easy reference.

## Quick Diagnostic

Before diving into specific issues, run these quick checks:

```bash
# Backend health check
curl http://localhost:3002/health

# Check Node.js version
node --version  # Should be 18.x or 20.x

# Check if services are running
# Windows:
netstat -ano | findstr :3002  # Backend
netstat -ano | findstr :5173  # Frontend
netstat -ano | findstr :6379  # Redis

# Test database connection
npx prisma db pull

# Test Redis connection
redis-cli ping  # Should return "PONG"
```

---

## Installation Issues

### Issue: npm install fails with network errors

**Symptoms:**

```
npm ERR! network timeout
npm ERR! network ENOTFOUND registry.npmjs.org
```

**Causes:**

- Network connectivity issues
- npm registry down
- Corporate firewall blocking npm
- Corrupted npm cache

**Solutions:**

```bash
# 1. Clear npm cache
npm cache clean --force

# 2. Use different registry
npm config set registry https://registry.npm.taobao.org

# 3. Increase timeout
npm config set fetch-timeout 60000

# 4. Retry installation
npm install

# 5. If using corporate proxy
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080
```

### Issue: Prisma migrate fails

**Symptoms:**

```
Error: P1001: Can't reach database server
Error: Migration failed
```

**Causes:**

- PostgreSQL not running
- Wrong DATABASE_URL in .env
- Database doesn't exist
- Insufficient permissions

**Solutions:**

```bash
# 1. Verify PostgreSQL is running
# Windows:
sc query postgresql-x64-15  # or your PostgreSQL service name

# 2. Test connection manually
psql -U quikadmin -d quikadmin
# If this fails, PostgreSQL isn't accessible

# 3. Check DATABASE_URL format
# Should be: postgresql://user:password@host:5432/database
echo $DATABASE_URL  # Linux/Mac
echo %DATABASE_URL%  # Windows CMD
$env:DATABASE_URL  # Windows PowerShell

# 4. Create database if it doesn't exist
psql -U postgres
CREATE DATABASE quikadmin;
\q

# 5. Reset migrations if out of sync
npx prisma migrate reset  # WARNING: Destroys all data
npx prisma migrate dev
```

### Issue: "JWT_SECRET too short" error on startup

**Symptoms:**

```
Error: CRITICAL: JWT secrets must be at least 64 characters long
Error: JWT_SECRET has insufficient entropy (minimum 256 bits)
```

**Cause:** Environment variables don't meet security requirements

**Solution:**

```bash
# Generate strong secrets (64+ characters)
# Linux/Mac/WSL:
openssl rand -base64 64

# Or Node.js (any platform):
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"

# Windows PowerShell:
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# Update .env with generated secrets
JWT_SECRET=<paste-64-char-secret-here>
JWT_REFRESH_SECRET=<paste-different-64-char-secret-here>
```

---

## Authentication Issues

### Issue: "Token expired" error

**Symptoms:**

```json
{
  "error": "Token expired",
  "message": "Your session has expired. Please login again.",
  "code": "TOKEN_EXPIRED"
}
```

**Cause:** Access token expired (15-minute expiry)

**Solutions:**

**1. Use refresh token to get new access token:**

```bash
curl -X POST http://localhost:3002/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
```

**2. Implement automatic token refresh:**

```javascript
async function apiCall(url, options = {}) {
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    // Refresh token
    const refreshResponse = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshResponse.ok) {
      const newTokens = await refreshResponse.json();
      accessToken = newTokens.data.tokens.accessToken;
      // Retry original request
      response = await fetch(url, options);
    }
  }

  return response;
}
```

### Issue: "Invalid credentials" on login

**Symptoms:**

```json
{
  "error": "Invalid email or password"
}
```

**Causes:**

- Wrong email or password
- Account doesn't exist
- Case-sensitive password

**Solutions:**

1. **Verify email is correct** (lowercase):

   ```bash
   # Emails are converted to lowercase
   "User@Example.com" → "user@example.com"
   ```

2. **Check if user exists:**

   ```bash
   npx prisma studio
   # Check users table for the email
   ```

3. **Register if user doesn't exist:**
   ```bash
   curl -X POST http://localhost:3002/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com","password":"Password123!","fullName":"User Name"}'
   ```

### Issue: "Too many authentication attempts"

**Symptoms:**

```json
{
  "error": "Too many authentication attempts. Please try again later.",
  "retryAfter": "15 minutes"
}
```

**Cause:** Rate limit exceeded (5 attempts per 15 minutes)

**Solution:** Wait 15 minutes or restart backend (development only):

```bash
# Development: Restart backend to reset rate limits
Ctrl+C  # Stop backend
npm run dev  # Restart

# Production: Wait for rate limit window to expire
```

---

## Database Connection Issues

### Issue: "Can't reach database server"

**Symptoms:**

```
Error: Can't reach database server at localhost:5432
P1001: Can't reach database server
```

**Causes:**

- PostgreSQL not running
- Wrong host/port
- Firewall blocking connection

**Solutions:**

**1. Check if PostgreSQL is running:**

```bash
# Windows:
sc query | findstr postgresql

# Linux/Mac:
sudo systemctl status postgresql

# Or try connecting directly
psql -U postgres -h localhost
```

**2. Verify connection details:**

```bash
# Check DATABASE_URL format
# Correct: postgresql://user:password@localhost:5432/database
# Wrong: postgres://... (use postgresql://)
# Wrong: localhost/database (missing port)
```

**3. Test connection with psql:**

```bash
# Extract connection details from DATABASE_URL
psql "postgresql://quikadmin:password@localhost:5432/quikadmin"

# If this works, Prisma should work too
```

**4. Check firewall (Windows):**

```powershell
# Allow PostgreSQL through firewall
New-NetFirewallRule -DisplayName "PostgreSQL" -Direction Inbound -Port 5432 -Protocol TCP -Action Allow
```

### Issue: "Database does not exist"

**Symptoms:**

```
Error: Database "quikadmin" does not exist
P1003: Database does not exist
```

**Solution:**

```bash
# Connect to PostgreSQL as superuser
psql -U postgres

# Create database
CREATE DATABASE quikadmin;
CREATE USER quikadmin WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE quikadmin TO quikadmin;

# Exit and run migrations
\q
npx prisma migrate dev
```

---

## Redis Connection Issues

### Issue: "Redis connection refused"

**Symptoms:**

```
Error: connect ECONNREFUSED 127.0.0.1:6379
Redis connection failed
```

**Causes:**

- Redis not running
- Wrong REDIS_URL
- Redis listening on different port

**Solutions:**

**1. Start Redis:**

```bash
# Windows (Redis for Windows):
cd C:\Redis
redis-server.exe

# WSL2:
sudo service redis-server start

# Linux:
sudo systemctl start redis-server

# Mac:
brew services start redis
```

**2. Test Redis connection:**

```bash
redis-cli ping
# Should return: PONG

# If "command not found", Redis isn't installed or not in PATH
```

**3. Check Redis URL:**

```bash
# In .env, should be:
REDIS_URL=redis://localhost:6379

# Not:
REDIS_URL=redis://127.0.0.1:6379  # This might not resolve on Windows
```

---

## Port Conflicts

### Issue: "Port already in use"

**Symptoms:**

```
Error: listen EADDRINUSE: address already in use :::3002
Error: Port 3002 is already in use
```

**Causes:**

- Another process using the port
- Previous instance didn't shut down

**Solutions:**

**Windows:**

```powershell
# Find process using port
netstat -ano | findstr :3002

# Kill process by PID
taskkill /PID <PID> /F

# Or change port in .env
PORT=3003
```

**Linux/Mac:**

```bash
# Find process
lsof -i :3002

# Kill process
kill -9 <PID>

# Or change port
PORT=3003
```

---

## Document Processing Issues

### Issue: "Could not extract text from document"

**Symptoms:**

```json
{
  "status": "failed",
  "error": "Could not extract text from source document",
  "details": "Document may be scanned without OCR"
}
```

**Causes:**

- PDF is scanned image without searchable text
- OCR service not configured
- Unsupported document format

**Solutions:**

1. **Check if PDF has searchable text:**
   - Open PDF in viewer and try to select text
   - If can't select, it's scanned and needs OCR

2. **Verify OCR service (currently placeholder):**

   ```bash
   # OCR implementation incomplete in current version
   # See CURRENT_ARCHITECTURE.md line 223-228
   ```

3. **Use document with searchable text:**
   - Export from Word/Excel instead of scanning
   - Use PDF with text layer

### Issue: "Field mapping confidence too low"

**Symptoms:**

```json
{
  "confidence": 0.65,
  "message": "Low confidence mapping. Manual review recommended."
}
```

**Causes:**

- Source and target field names very different
- ML model insufficient training
- Ambiguous field matching

**Solutions:**

1. **Acceptable confidence levels:**
   - 0.9-1.0: Excellent, use as-is
   - 0.8-0.9: Good, likely correct
   - 0.7-0.8: Fair, review recommended
   - <0.7: Poor, manual review required

2. **Improve matching:**
   - Use descriptive field names
   - Ensure source document has clear labels
   - Consider manual field mapping (future feature)

3. **Note about ML model:**
   - Current accuracy: 85-90%
   - Migration to OpenAI GPT-4o-mini planned (99%+ accuracy)

---

## Windows-Specific Issues

### Issue: File paths with backslashes fail

**Symptoms:**

```
Error: ENOENT: no such file or directory
File path: C:\Users\...
```

**Cause:** Windows backslashes not handled correctly

**Solutions:**

```javascript
// Use forward slashes (works on Windows too)
const path = 'C:/Users/Documents/file.pdf';

// Or use path.join
const path = require('path');
const filePath = path.join('C:', 'Users', 'Documents', 'file.pdf');

// Or double backslashes
const path = 'C:\\Users\\Documents\\file.pdf';
```

### Issue: nginx not starting on Windows

**Symptoms:**

```
nginx: [error] bind() to 0.0.0.0:80 failed
Port 80 already in use
```

**Causes:**

- Another web server (IIS, Apache) using port 80
- Previous nginx instance running
- Windows requiring admin privileges

**Solutions:**

**1. Check port 80:**

```powershell
netstat -ano | findstr :80

# If something is using it, stop it:
# IIS: iisreset /stop
# Apache: net stop apache2.4
```

**2. Stop existing nginx:**

```powershell
# Kill all nginx processes
taskkill /F /IM nginx.exe

# Or use nginx command
nginx -s stop
```

**3. Change nginx port (if can't use 80):**

```nginx
# Edit nginx.conf
listen 8080;  # Instead of 80

# Start nginx
nginx

# Access at http://localhost:8080
```

**4. Run as Administrator:**

```powershell
# Right-click cmd/PowerShell → Run as Administrator
cd C:\nginx
nginx
```

---

## Development Environment Issues

### Issue: Hot reload not working

**Symptoms:**

- Code changes don't reflect
- Need to restart manually

**Causes:**

- ts-node-dev not watching files
- File watcher limit reached (Linux)
- Syntax error preventing reload

**Solutions:**

**Backend:**

```bash
# Stop and restart with verbose output
npm run dev -- --debug

# Check for syntax errors
npm run typecheck
```

**Frontend:**

```bash
# Restart Vite dev server
cd web
npm run dev

# Clear Vite cache if needed
rm -rf node_modules/.vite
```

**Linux file watcher limit:**

```bash
# Increase file watcher limit
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Issue: TypeScript errors in IDE but compiles fine

**Cause:** IDE using different TypeScript version

**Solution:**

```bash
# VS Code: Select workspace TypeScript version
# Ctrl+Shift+P → "TypeScript: Select TypeScript Version"
# Choose "Use Workspace Version"

# Or install TypeScript globally
npm install -g typescript

# Verify version matches
npx tsc --version  # Workspace version
tsc --version      # Global version
```

---

## API Testing Issues

### Issue: CORS errors in browser

**Symptoms:**

```
Access to fetch at 'http://localhost:3002/api/...' from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Cause:** Frontend origin not in CORS allowed list

**Solution:**

**1. Check CORS configuration (src/index.ts):**

```typescript
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173', // Vite dev server
  ],
  credentials: true,
};
```

**2. Add your origin if missing:**

```typescript
origin: [
  // ... existing origins
  'http://localhost:YOUR_PORT',
];
```

**3. Or use nginx (recommended):**

```bash
# nginx handles CORS automatically
# Access frontend at http://localhost (port 80)
# nginx proxies to backend
```

### Issue: 401 Unauthorized on protected endpoints

**Symptoms:**

```json
{
  "error": "Authentication required",
  "message": "No authorization header provided"
}
```

**Causes:**

- Missing Authorization header
- Token format wrong
- Token expired

**Solutions:**

**1. Include Authorization header:**

```bash
# Correct format
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3002/api/auth/me

# Wrong (missing "Bearer")
curl -H "Authorization: YOUR_TOKEN" ...

# Wrong (wrong header name)
curl -H "Auth: Bearer YOUR_TOKEN" ...
```

**2. Verify token:**

```bash
curl -X POST http://localhost:3002/api/auth/verify-token \
  -H "Content-Type: application/json" \
  -d '{"token":"YOUR_TOKEN"}'
```

---

## Performance Issues

### Issue: Slow document processing

**Symptoms:**

- Processing takes >10 seconds
- High CPU usage
- Memory spikes

**Causes:**

- Large PDF files
- OCR processing unoptimized
- ML model inference slow

**Current Performance Metrics:**

- PDF text extraction: ~1-2 seconds
- OCR processing: ~5-10 seconds (when enabled)
- ML field mapping: ~10-50ms per field

**Solutions:**

1. **Optimize PDF size:**
   - Compress PDFs before upload
   - Reduce image resolution if scanned

2. **Monitor with process tools:**

   ```bash
   # Windows Task Manager
   # Check node.exe CPU and memory

   # Or use Node.js profiler
   node --prof src/index.ts
   ```

3. **Note:** Performance optimizations planned for Phase 3

---

## Getting More Help

If your issue isn't listed here:

1. **Check documentation:**
   - [Installation Guide](../100-getting-started/101-installation.md)
   - [CURRENT_ARCHITECTURE.md](../CURRENT_ARCHITECTURE.md)
   - [SETUP_GUIDE_WINDOWS.md](../../SETUP_GUIDE_WINDOWS.md)

2. **Check logs:**

   ```bash
   # Backend logs in terminal
   npm run dev  # Watch for errors

   # Check log file (if configured)
   tail -f logs/app.log
   ```

3. **Enable debug logging:**

   ```bash
   # In .env
   LOG_LEVEL=debug
   ```

4. **Search existing issues:**
   - GitHub Issues (if applicable)
   - Error message in search engine

5. **Create minimal reproduction:**
   - Isolate the problem
   - Provide steps to reproduce
   - Include error messages and logs

---

**Last Updated:** 2025-01-10
**Related Docs:** [Installation](../100-getting-started/101-installation.md) | [API Reference](../300-api/301-authentication.md) | [Architecture](../CURRENT_ARCHITECTURE.md)

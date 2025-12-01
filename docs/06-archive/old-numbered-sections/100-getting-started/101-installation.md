# Installation Guide

**Last Updated:** 2025-01-10
**Status:** Complete
**Difficulty:** Beginner
**Estimated Time:** 30-60 minutes
**Audience:** Developers

---

## Overview

This guide will walk you through installing QuikAdmin on your development machine. QuikAdmin is optimized for Windows native development but also supports Docker deployment.

## System Requirements

### Minimum Requirements
- **OS:** Windows 10/11, macOS 12+, or Linux (Ubuntu 20.04+)
- **RAM:** 4GB minimum, 8GB recommended
- **Disk Space:** 2GB for project and dependencies
- **Network:** Internet connection for downloading dependencies

### Required Software
- **Node.js:** 20.x (minimum 18.x)
- **PostgreSQL:** 15+ (local installation or cloud database)
- **Redis:** 6.x+ (for job queues and caching)
- **nginx:** Latest stable (optional but recommended for Windows)
- **Git:** Latest version

### Optional Software
- **Bun:** Alternative to npm for faster frontend builds
- **Docker Desktop:** For containerized deployment (optional)
- **VS Code:** Recommended IDE with ESLint and Prettier extensions

## Installation Steps

### Step 1: Install Node.js

**Verify Installation:**
```bash
node --version  # Should be v20.x or v18.x
npm --version   # Should be 9.x or 10.x
```

**If not installed:**

**Windows:**
1. Download installer from https://nodejs.org/
2. Choose "LTS" version (Long Term Support)
3. Run installer with default options
4. Restart terminal after installation

**macOS:**
```bash
# Using Homebrew
brew install node@20

# Or download installer from https://nodejs.org/
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 2: Install PostgreSQL

You have two options: local installation or cloud database (recommended for beginners).

#### Option A: Cloud Database (Recommended)

**Neon (Free Tier):**
1. Go to https://neon.tech/
2. Sign up for free account
3. Create a new project
4. Copy the connection string (format: `postgresql://user:password@host:5432/database`)
5. Save connection string for `.env` file

**Supabase (Free Tier):**
1. Go to https://supabase.com/
2. Create new project
3. Go to Project Settings → Database
4. Copy connection string (pooling mode recommended)

#### Option B: Local Installation

**Windows:**
1. Download installer from https://www.postgresql.org/download/windows/
2. Install PostgreSQL 15 or 16
3. Note the password you set during installation
4. Verify installation:
   ```bash
   psql --version  # Should show version 15.x or 16.x
   ```

**macOS:**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Create Database:**
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE quikadmin;
CREATE USER quikadmin WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE quikadmin TO quikadmin;

# Exit psql
\q
```

### Step 3: Install Redis

#### Windows

**Option A: Windows Native (Recommended)**
1. Download Redis for Windows from https://github.com/tporadowski/redis/releases
2. Extract to `C:\Redis\`
3. Run `redis-server.exe`
4. Verify:
   ```bash
   redis-cli ping  # Should return "PONG"
   ```

**Option B: WSL2**
```bash
# Inside WSL2 terminal
sudo apt update
sudo apt install redis-server
sudo service redis-server start
```

#### macOS
```bash
brew install redis
brew services start redis

# Verify
redis-cli ping  # Should return "PONG"
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify
redis-cli ping  # Should return "PONG"
```

### Step 4: Install nginx (Optional but Recommended)

nginx acts as a reverse proxy, routing requests to backend and frontend.

#### Windows
1. Download nginx for Windows from http://nginx.org/en/download.html
2. Extract to `C:\nginx\`
3. Copy `nginx.conf` from project root to `C:\nginx\conf\nginx.conf`
4. Start nginx:
   ```bash
   cd C:\nginx
   start nginx.exe
   ```

#### macOS
```bash
brew install nginx
# Copy project nginx.conf to /opt/homebrew/etc/nginx/nginx.conf
nginx  # Start nginx
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt install nginx
# Copy project nginx.conf to /etc/nginx/nginx.conf
sudo systemctl start nginx
```

**Verify nginx:**
Open http://localhost in browser - you should see nginx welcome page or QuikAdmin (after starting the app).

### Step 5: Clone and Install Project

```bash
# Clone repository
git clone https://github.com/yourusername/quikadmin.git
cd quikadmin

# Install backend dependencies
npm install

# Install frontend dependencies
cd web
npm install  # or: bun install
cd ..
```

**Verify installation:**
```bash
# Check for node_modules directories
ls node_modules  # Backend dependencies
ls web/node_modules  # Frontend dependencies
```

### Step 6: Configure Environment Variables

Create `.env` file in project root:

```bash
# Copy example file
cp .env.example .env

# Edit .env with your settings
# Windows: notepad .env
# Mac/Linux: nano .env or vim .env
```

**Required Environment Variables:**

```env
# Database (use your connection string)
DATABASE_URL=postgresql://quikadmin:your_password@localhost:5432/quikadmin
# OR use Neon/Supabase connection string
DATABASE_URL=postgresql://user:password@host.neon.tech:5432/database

# JWT Secrets (GENERATE UNIQUE SECRETS!)
# IMPORTANT: These MUST be at least 64 characters long
JWT_SECRET=your-super-secret-jwt-key-minimum-64-characters-change-this-now-abc123
JWT_REFRESH_SECRET=another-super-secret-refresh-key-minimum-64-characters-change-now-xyz789

# JWT Configuration
JWT_ISSUER=quikadmin-api
JWT_AUDIENCE=quikadmin-client
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Server Configuration
PORT=3002
NODE_ENV=development

# Redis
REDIS_URL=redis://localhost:6379
```

**Generate Strong Secrets:**

```bash
# Linux/macOS/WSL
openssl rand -base64 64

# Or Node.js (any platform)
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"

# Windows PowerShell
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**IMPORTANT:**
- JWT secrets MUST be at least 64 characters
- Never commit `.env` to git
- Use different secrets for production

### Step 7: Run Database Migrations

Initialize the database schema:

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Verify database
npx prisma studio  # Opens database UI at http://localhost:5555
```

**Expected output:**
```
✔ Generated Prisma Client
✔ Applied migration(s)
```

**Troubleshooting:**
- **"Can't reach database"**: Check DATABASE_URL in `.env`
- **"Connection refused"**: Ensure PostgreSQL is running
- **Permission denied**: Check database user permissions

### Step 8: Verify Installation

Start the backend to verify everything works:

```bash
# Start backend
npm run dev

# You should see:
# ✓ Server running on port 3002
# ✓ Database connected
# ✓ Redis connected
```

**Test health endpoint:**
```bash
curl http://localhost:3002/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2025-01-10T12:00:00.000Z",
  "version": "1.0.0",
  "environment": "development"
}
```

### Step 9: Start Development Servers

**Option A: Manual Start (3 Terminals)**

```bash
# Terminal 1: Backend
npm run dev  # Port 3002

# Terminal 2: Frontend
cd web
bun run dev  # or: npm run dev
# Port 5173

# Terminal 3: nginx (optional)
nginx  # Port 80
```

**Option B: Windows Batch Scripts**

```bash
# Start everything
.\start-windows.bat

# Or start individually
.\start-nginx-only.bat
```

**Access the application:**
- **With nginx:** http://localhost (port 80)
- **Without nginx:**
  - Frontend: http://localhost:5173
  - Backend API: http://localhost:3002

## Post-Installation Setup

### Create Admin User

```bash
# Using API
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!",
    "fullName": "Admin User",
    "role": "admin"
  }'

# Or use web interface at http://localhost:5173
```

### Verify All Services

```bash
# Check backend
curl http://localhost:3002/health

# Check Redis
redis-cli ping  # Should return "PONG"

# Check PostgreSQL
psql -U quikadmin -d quikadmin -c "SELECT version();"
# Or if using Neon/Supabase, connect with their web interface
```

## Installation Verification Checklist

- [ ] Node.js 20.x installed (`node --version`)
- [ ] PostgreSQL running and accessible
- [ ] Redis running (`redis-cli ping`)
- [ ] nginx installed and configured (optional)
- [ ] Project dependencies installed (`node_modules` exists)
- [ ] `.env` file configured with strong secrets
- [ ] Database migrations applied (`npx prisma migrate dev`)
- [ ] Backend starts without errors (`npm run dev`)
- [ ] Frontend starts without errors (`cd web && npm run dev`)
- [ ] Health endpoint returns OK (`curl http://localhost:3002/health`)
- [ ] Can create admin user via API or web interface

## Common Issues

### Issue: "npm install" fails

**Cause:** Network issues or corrupted cache

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Retry installation
npm install
```

### Issue: "Prisma migrate failed"

**Cause:** Database connection issues or migrations out of sync

**Solution:**
```bash
# Reset database (WARNING: destroys all data)
npx prisma migrate reset

# Or push schema without migration
npx prisma db push
```

### Issue: "Port already in use"

**Cause:** Another process is using port 3002, 5173, or 80

**Solution:**
```bash
# Windows: Find process using port
netstat -ano | findstr :3002

# Kill process by PID
taskkill /PID <PID> /F

# Or change port in .env (PORT=3003)
```

### Issue: "JWT_SECRET too short"

**Cause:** Environment variable validation failed

**Solution:**
Generate a new secret that's at least 64 characters:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

Update `.env` with the generated secret.

## Next Steps

Now that you have QuikAdmin installed, proceed to:

1. **[Your First Document](./104-first-document.md)** - Process your first PDF form (10 minutes)
2. **[Authentication API](../300-api/301-authentication.md)** - Learn about API authentication
3. **[CURRENT_ARCHITECTURE.md](../CURRENT_ARCHITECTURE.md)** - Understand the system architecture
4. **[Troubleshooting Guide](../400-guides/407-troubleshooting.md)** - Solutions to common problems

## Additional Resources

- **Windows Setup:** See [SETUP_GUIDE_WINDOWS.md](../../SETUP_GUIDE_WINDOWS.md) for detailed Windows instructions
- **Docker Setup:** Use `docker-compose up` if you prefer containerized deployment
- **VS Code Extensions:**
  - ESLint (dbaeumer.vscode-eslint)
  - Prettier (esbenp.prettier-vscode)
  - Prisma (Prisma.prisma)
  - TypeScript Vue Plugin (Vue.vscode-typescript-vue-plugin)

---

**Installation Complete!** Proceed to [Your First Document](./104-first-document.md) to start processing documents.

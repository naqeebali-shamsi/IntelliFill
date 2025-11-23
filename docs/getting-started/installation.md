---
title: "Installation Guide"
description: "Complete cross-platform installation guide for IntelliFill QuikAdmin"
category: getting-started
tags: [installation, setup, prerequisites, windows, linux, macos, docker, nginx]
lastUpdated: 2025-01-11
relatedDocs:
  - getting-started/windows-setup.md
  - getting-started/first-document.md
  - guides/troubleshooting.md
---

# Installation Guide

**Last Updated:** 2025-01-11
**Status:** Complete
**Difficulty:** Beginner
**Estimated Time:** 30-60 minutes
**Audience:** Developers

---

## Overview

This guide walks you through installing IntelliFill QuikAdmin on your development machine. QuikAdmin supports multiple deployment options:

- **Windows Native** (recommended for Windows developers) - Best performance and debugging
- **macOS/Linux Native** - Direct execution on Unix-based systems
- **Docker** - Containerized deployment (good for Linux/macOS, optional for Windows)

> **Windows Users:** For detailed Windows-specific setup with nginx reverse proxy and batch scripts, see [Windows Setup Guide](./windows-setup.md).

## Architecture Overview

### Development Setup

```
User Browser
     ↓
nginx (port 80) - Optional reverse proxy
     ├── /api/* → Backend (port 3002)
     └── /* → Frontend (port 5173)
```

**Components:**
1. **Backend**: Node.js/Express API on port 3002
2. **Frontend**: React/Vite app on port 5173
3. **nginx**: Optional reverse proxy for unified access on port 80
4. **PostgreSQL**: Database (local or cloud)
5. **Redis**: Job queues and caching

---

## System Requirements

### Minimum Requirements

| Component | Requirement |
|-----------|-------------|
| **OS** | Windows 10/11, macOS 12+, or Linux (Ubuntu 20.04+) |
| **RAM** | 4GB minimum, 8GB recommended |
| **Disk Space** | 2GB for project and dependencies |
| **Network** | Internet connection for downloading dependencies |

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| **Node.js** | 20.x (minimum 18.x) | Runtime for backend and build tools |
| **PostgreSQL** | 15+ | Primary database |
| **Redis** | 6.x+ | Job queues and caching |
| **nginx** | Latest stable | Reverse proxy (optional but recommended) |
| **Git** | Latest | Version control |

### Optional Software

| Software | Purpose |
|----------|---------|
| **Bun** | Alternative to npm for faster frontend builds |
| **Docker Desktop** | Containerized deployment |
| **VS Code** | Recommended IDE with ESLint and Prettier extensions |
| **MSYS2** | Windows: Better terminal experience |

---

## Installation Steps

### Step 1: Install Node.js

#### Verify Existing Installation

```bash
node --version  # Should be v20.x or v18.x
npm --version   # Should be 9.x or 10.x
```

#### Install Node.js

**Windows:**
1. Download installer from https://nodejs.org/
2. Choose "LTS" version (Long Term Support)
3. Run installer with default options
4. ✓ Check "Automatically install necessary tools" (includes Chocolatey)
5. Restart terminal after installation

**macOS:**
```bash
# Using Homebrew (recommended)
brew install node@20

# Or download installer from https://nodejs.org/
```

**Linux (Ubuntu/Debian):**
```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

---

### Step 2: Install PostgreSQL

You have two options: **cloud database** (recommended for beginners) or **local installation**.

#### Option A: Cloud Database (Recommended)

**Neon (Free Tier - Recommended):**
1. Visit https://neon.tech/
2. Sign up for free account
3. Create a new project
4. Copy connection string format:
   ```
   postgresql://user:password@host.neon.tech:5432/database
   ```
5. Save for `.env` configuration

**Supabase (Free Tier):**
1. Visit https://supabase.com/
2. Create new project
3. Navigate to: Project Settings → Database
4. Copy connection string (use pooling mode for better performance)
5. Save for `.env` configuration

**Benefits:**
- No local installation needed
- Automatic backups
- Managed updates and scaling
- Free tier sufficient for development

#### Option B: Local Installation

**Windows:**
1. Download installer from https://www.postgresql.org/download/windows/
2. Install PostgreSQL 15 or 16
3. During installation:
   - ✓ Set admin password (save this!)
   - ✓ Accept default port: 5432
   - ✓ Accept default locale
4. Verify installation:
   ```bash
   psql --version  # Should show version 15.x or 16.x
   ```

**macOS:**
```bash
# Using Homebrew
brew install postgresql@16

# Start PostgreSQL service
brew services start postgresql@16

# Verify installation
psql --version
```

**Linux (Ubuntu/Debian):**
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start and enable service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
psql --version
```

#### Create Database

After installation, create the QuikAdmin database:

```bash
# Connect to PostgreSQL (default user: postgres)
psql -U postgres

# Inside psql, run these commands:
CREATE DATABASE quikadmin;
CREATE USER quikadmin WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE quikadmin TO quikadmin;

# Grant schema privileges (PostgreSQL 15+)
\c quikadmin
GRANT ALL ON SCHEMA public TO quikadmin;

# Exit psql
\q
```

**Connection string format:**
```
postgresql://quikadmin:your_secure_password@localhost:5432/quikadmin
```

---

### Step 3: Install Redis

Redis is required for job queues, caching, and session management.

#### Windows

**Option A: Windows Native (Recommended)**
1. Download Redis for Windows from https://github.com/tporadowski/redis/releases
2. Download latest `.zip` file (e.g., `Redis-x64-5.0.14.1.zip`)
3. Extract to `C:\Redis\`
4. Start Redis server:
   ```bash
   cd C:\Redis
   redis-server.exe
   ```
5. Verify in new terminal:
   ```bash
   redis-cli ping  # Should return "PONG"
   ```

**Option B: WSL2 (Windows Subsystem for Linux)**
```bash
# Inside WSL2 terminal
sudo apt update
sudo apt install redis-server

# Start Redis
sudo service redis-server start

# Verify
redis-cli ping  # Should return "PONG"
```

**Option C: Docker (if Docker Desktop installed)**
```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

#### macOS

```bash
# Install Redis using Homebrew
brew install redis

# Start Redis service
brew services start redis

# Verify installation
redis-cli ping  # Should return "PONG"
```

#### Linux (Ubuntu/Debian)

```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Start and enable service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify installation
redis-cli ping  # Should return "PONG"

# Check status
sudo systemctl status redis-server
```

**Connection string:**
```
redis://localhost:6379
```

---

### Step 4: Install nginx (Optional but Recommended)

nginx acts as a reverse proxy, providing a unified entry point for frontend and backend.

**Benefits:**
- Single port access (http://localhost instead of multiple ports)
- Better production-like development environment
- Handles CORS, compression, caching
- Simplifies API routing

#### Windows

**Option A: Direct Download**
1. Visit http://nginx.org/en/download.html
2. Download latest stable Windows version (e.g., `nginx-1.24.0.zip`)
3. Extract to `C:\nginx\`
4. Configuration covered in [Windows Setup Guide](./windows-setup.md)

**Option B: Chocolatey**
```powershell
# Install Chocolatey package manager first (if not installed)
# Then install nginx
choco install nginx
```

#### macOS

```bash
# Install nginx using Homebrew
brew install nginx

# nginx config location: /opt/homebrew/etc/nginx/nginx.conf
# Copy project nginx.conf later

# Start nginx
nginx

# Or run as service
brew services start nginx
```

#### Linux (Ubuntu/Debian)

```bash
# Install nginx
sudo apt update
sudo apt install nginx

# nginx config location: /etc/nginx/nginx.conf
# Copy project nginx.conf later

# Start nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Verify installation
sudo systemctl status nginx
```

**Verify nginx:**
Open http://localhost in browser - you should see nginx welcome page.

> **Note:** nginx configuration specific to QuikAdmin will be set up in Step 9.

---

### Step 5: Clone and Install Project

#### Clone Repository

```bash
# Clone repository (replace with your repository URL)
git clone https://github.com/yourusername/intellifill-quikadmin.git
cd intellifill-quikadmin/quikadmin
```

#### Install Backend Dependencies

```bash
# Install backend dependencies
npm install

# Verify installation
ls node_modules  # Should show many packages
```

#### Install Frontend Dependencies

```bash
# Navigate to frontend directory
cd web

# Install using npm
npm install

# OR install using Bun (faster)
bun install

# Return to project root
cd ..
```

#### Verify Installation

```bash
# Check for node_modules directories
ls node_modules      # Backend dependencies
ls web/node_modules  # Frontend dependencies

# Both should contain packages
```

---

### Step 6: Configure Environment Variables

Environment variables configure database connections, JWT secrets, and server settings.

#### Create .env File

```bash
# Copy example file (if available)
cp .env.example .env

# Or create new file
# Windows: notepad .env
# Mac/Linux: nano .env  or  vim .env
```

#### Required Environment Variables

Create `.env` file in project root with the following configuration:

```env
#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DATABASE CONFIGURATION
#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Local PostgreSQL
DATABASE_URL=postgresql://quikadmin:your_password@localhost:5432/quikadmin

# OR Neon cloud database
# DATABASE_URL=postgresql://user:password@host.neon.tech:5432/database

# OR Supabase cloud database
# DATABASE_URL=postgresql://postgres:password@db.project.supabase.co:5432/postgres

#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# JWT CONFIGURATION
#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# CRITICAL: Generate unique secrets at least 64 characters long!
# DO NOT use these example values in production!

JWT_SECRET=CHANGE-THIS-generate-a-secure-random-string-at-least-64-characters-long-abc123def456
JWT_REFRESH_SECRET=CHANGE-THIS-another-secure-random-string-at-least-64-characters-long-xyz789ghi012

# JWT Settings
JWT_ISSUER=quikadmin-api
JWT_AUDIENCE=quikadmin-client
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SERVER CONFIGURATION
#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PORT=3002
NODE_ENV=development

#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# REDIS CONFIGURATION
#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REDIS_URL=redis://localhost:6379

# OR Redis with password
# REDIS_URL=redis://:password@localhost:6379

# OR Redis cloud (Upstash, etc.)
# REDIS_URL=redis://default:password@redis-host:6379

#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# OPTIONAL CONFIGURATION
#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# API Keys for AI services (if using AI features)
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...

# File storage
# UPLOAD_DIR=./uploads
# MAX_FILE_SIZE=10485760  # 10MB in bytes
```

#### Generate Strong JWT Secrets

**CRITICAL:** JWT secrets MUST be at least 64 characters long for security.

**Linux / macOS / WSL:**
```bash
# Generate with OpenSSL
openssl rand -base64 64

# Output example (use this in .env):
# x8K2vP9mN3wQ7rT5yU6iO8pL0kJ4hG2fD1sA3xZ9cV7bN5mM1qW3eR5tY7uI9oP0...
```

**Node.js (any platform):**
```bash
# Generate with Node.js crypto
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"

# Run twice to get both JWT_SECRET and JWT_REFRESH_SECRET
```

**Windows PowerShell:**
```powershell
# Generate with PowerShell
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**IMPORTANT SECURITY NOTES:**
- ✓ Generate unique secrets for JWT_SECRET and JWT_REFRESH_SECRET
- ✓ Secrets must be at least 64 characters
- ✓ Never commit `.env` to version control
- ✓ Use different secrets for development and production
- ✓ Rotate secrets periodically in production

---

### Step 7: Run Database Migrations

Initialize the database schema using Prisma ORM.

#### Generate Prisma Client

```bash
# Generate Prisma client (creates type-safe database client)
npx prisma generate
```

**Expected output:**
```
✔ Generated Prisma Client (x.x.x) to ./node_modules/@prisma/client
```

#### Run Migrations

```bash
# Apply all pending migrations
npx prisma migrate dev

# You'll be prompted to name the migration (e.g., "init")
```

**Expected output:**
```
✔ Name of migration: init
✔ Database schema created
✔ Applied 1 migration
```

#### Verify Database Schema

```bash
# Open Prisma Studio (database GUI)
npx prisma studio

# Opens at http://localhost:5555
# You should see all database tables (User, Document, etc.)
```

#### Common Migration Issues

**"Can't reach database server"**
- ✓ Check DATABASE_URL in `.env`
- ✓ Ensure PostgreSQL is running
- ✓ Test connection: `psql -U quikadmin -d quikadmin`

**"Permission denied"**
- ✓ Grant schema permissions:
  ```sql
  GRANT ALL ON SCHEMA public TO quikadmin;
  ```

**"Migration failed"**
- ✓ Reset database (WARNING: destroys all data):
  ```bash
  npx prisma migrate reset
  ```
- ✓ Or push schema without migrations:
  ```bash
  npx prisma db push
  ```

---

### Step 8: Verify Installation

Start the backend to verify all services are connected correctly.

#### Start Backend Server

```bash
# Start backend in development mode
npm run dev
```

**Expected output:**
```
✓ Server running on port 3002
✓ Database connected
✓ Redis connected
✓ Prisma client initialized
```

#### Test Health Endpoint

Open a new terminal:

```bash
# Test health check endpoint
curl http://localhost:3002/health

# Expected JSON response:
{
  "status": "ok",
  "timestamp": "2025-01-11T12:00:00.000Z",
  "version": "1.0.0",
  "environment": "development",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

**Windows (if curl not available):**
```powershell
# Use Invoke-WebRequest
Invoke-WebRequest -Uri http://localhost:3002/health | Select-Object -Expand Content
```

Or open in browser: http://localhost:3002/health

---

### Step 9: Configure nginx (Optional)

If you installed nginx in Step 4, configure it to route requests to backend and frontend.

#### Copy nginx Configuration

**Windows:**
```powershell
# Copy project nginx.conf to nginx installation
copy nginx.conf C:\nginx\conf\nginx.conf

# Or edit C:\nginx\conf\nginx.conf manually
```

**macOS:**
```bash
# Copy to Homebrew nginx config
sudo cp nginx.conf /opt/homebrew/etc/nginx/nginx.conf

# Or edit directly
sudo nano /opt/homebrew/etc/nginx/nginx.conf
```

**Linux:**
```bash
# Copy to system nginx config
sudo cp nginx.conf /etc/nginx/nginx.conf

# Or edit directly
sudo nano /etc/nginx/nginx.conf
```

#### Verify nginx Configuration

```bash
# Test configuration for syntax errors
nginx -t

# Expected output:
# nginx: configuration file test is successful
```

#### Start/Restart nginx

**Windows:**
```powershell
# If nginx is running, reload
nginx -s reload

# Or start nginx
cd C:\nginx
start nginx.exe

# See Windows Setup Guide for batch scripts
```

**macOS:**
```bash
# Reload nginx
nginx -s reload

# Or restart service
brew services restart nginx
```

**Linux:**
```bash
# Reload nginx
sudo nginx -s reload

# Or restart service
sudo systemctl restart nginx
```

> **Windows Users:** For automated nginx startup with batch scripts, see [Windows Setup Guide](./windows-setup.md).

---

### Step 10: Start Development Servers

You have multiple options for running the application.

#### Option A: With nginx (Recommended)

**Start all services:**

```bash
# Terminal 1: Backend
npm run dev  # Port 3002

# Terminal 2: Frontend
cd web
bun run dev  # or: npm run dev
# Port 5173

# Terminal 3: nginx (if not running as service)
nginx  # Port 80
```

**Access application:**
- **Main App:** http://localhost (port 80)
- **API:** http://localhost/api

**Architecture with nginx:**
```
Browser → nginx (80) ┬→ /api/* → Backend (3002)
                      └→ /* → Frontend (5173)
```

#### Option B: Without nginx (Direct Access)

**Start services:**

```bash
# Terminal 1: Backend
npm run dev  # Port 3002

# Terminal 2: Frontend
cd web
bun run dev  # or: npm run dev
# Port 5173
```

**Access application:**
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3002

#### Option C: Windows Batch Scripts

**Windows users** can use automated batch scripts:

```powershell
# Start everything (backend, frontend, nginx)
.\start-windows.bat

# Or start nginx only
.\start-nginx-only.bat

# Stop all services
.\stop-all-windows.bat
```

See [Windows Setup Guide](./windows-setup.md) for details.

#### Option D: Docker Deployment

**Using Docker Compose:**

```bash
# Start all services in containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Note:** Docker is **not recommended** for Windows development due to:
- Performance overhead (WSL2 virtualization)
- File watching issues (hot-reload problems)
- Debugging complexity
- Port conflicts with Windows services

---

## Post-Installation Setup

### Create Admin User

After starting the backend, create an admin user:

#### Option A: Using API

```bash
# Register admin user via API
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!",
    "fullName": "Admin User",
    "role": "admin"
  }'
```

#### Option B: Using Web Interface

1. Start frontend: `cd web && npm run dev`
2. Open http://localhost:5173
3. Navigate to registration page
4. Fill in admin details
5. Submit registration

### Verify All Services

```bash
# Check backend health
curl http://localhost:3002/health

# Check Redis connection
redis-cli ping  # Should return "PONG"

# Check PostgreSQL
psql -U quikadmin -d quikadmin -c "SELECT version();"

# Check nginx (if running)
curl http://localhost  # Should return frontend HTML
```

---

## Installation Verification Checklist

Use this checklist to ensure complete installation:

- [ ] **Node.js 20.x installed** (`node --version`)
- [ ] **npm or Bun available** (`npm --version` or `bun --version`)
- [ ] **PostgreSQL running** (local or cloud accessible)
- [ ] **Redis running** (`redis-cli ping` returns "PONG")
- [ ] **nginx installed** (optional but recommended)
- [ ] **Project cloned** (git clone successful)
- [ ] **Backend dependencies installed** (`node_modules` exists)
- [ ] **Frontend dependencies installed** (`web/node_modules` exists)
- [ ] **`.env` file configured** with strong JWT secrets (64+ chars)
- [ ] **Database migrations applied** (`npx prisma migrate dev` successful)
- [ ] **Backend starts without errors** (`npm run dev`)
- [ ] **Frontend starts without errors** (`cd web && npm run dev`)
- [ ] **Health endpoint returns OK** (`curl http://localhost:3002/health`)
- [ ] **Admin user created** (via API or web interface)
- [ ] **nginx configured** (if using nginx)
- [ ] **Application accessible** (http://localhost or http://localhost:5173)

---

## Common Installation Issues

### Issue: npm install fails

**Symptoms:**
- Network timeout errors
- Package download failures
- Checksum verification errors

**Solutions:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock
rm -rf node_modules package-lock.json

# Retry installation
npm install

# Or try using a different registry
npm install --registry=https://registry.npmmirror.com
```

### Issue: Prisma migrate failed

**Symptoms:**
- Migration errors
- Database schema out of sync
- "Migration engine crashed"

**Solutions:**
```bash
# Option 1: Reset database (WARNING: destroys all data)
npx prisma migrate reset

# Option 2: Push schema without migration history
npx prisma db push

# Option 3: Regenerate Prisma client
npx prisma generate

# Option 4: Check connection
npx prisma db pull  # Test database connection
```

### Issue: Port already in use

**Symptoms:**
- "EADDRINUSE: address already in use"
- "Port 3002 is already in use"

**Solutions:**

**Windows:**
```powershell
# Find process using port 3002
netstat -ano | findstr :3002

# Kill process by PID
taskkill /PID <PID> /F

# Or change port in .env
# PORT=3003
```

**macOS/Linux:**
```bash
# Find process using port 3002
lsof -i :3002

# Kill process by PID
kill -9 <PID>

# Or change port in .env
# PORT=3003
```

### Issue: JWT_SECRET too short

**Symptoms:**
- "JWT_SECRET must be at least 64 characters"
- Authentication validation errors

**Solution:**
```bash
# Generate new 64+ character secret
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"

# Copy output to .env
# JWT_SECRET=<generated_secret>
# JWT_REFRESH_SECRET=<another_generated_secret>
```

### Issue: Database connection refused

**Symptoms:**
- "Connection refused" or "ECONNREFUSED"
- "Can't reach database server"

**Solutions:**
```bash
# Check if PostgreSQL is running
# Windows:
sc query postgresql

# macOS:
brew services list | grep postgresql

# Linux:
sudo systemctl status postgresql

# Verify connection string in .env
# Check host, port, username, password

# Test connection manually
psql -U quikadmin -d quikadmin -h localhost -p 5432
```

### Issue: Redis connection failed

**Symptoms:**
- "Redis connection to localhost:6379 failed"
- "ECONNREFUSED"

**Solutions:**
```bash
# Check if Redis is running
redis-cli ping

# Windows: Start Redis server
cd C:\Redis
redis-server.exe

# macOS: Start Redis service
brew services start redis

# Linux: Start Redis service
sudo systemctl start redis-server

# Check REDIS_URL in .env
```

### Issue: nginx fails to start

**Symptoms:**
- "nginx: [emerg] bind() to 0.0.0.0:80 failed"
- "Port 80 is already in use"

**Solutions:**
```bash
# Option 1: Stop other service using port 80
# Windows: IIS, Skype, other web servers
# Check what's using port 80
netstat -ano | findstr :80

# Option 2: Change nginx port
# Edit nginx.conf: listen 8080;
# Then access via http://localhost:8080

# Option 3: Run without nginx
# Access frontend directly at http://localhost:5173
```

### Issue: Frontend not loading

**Symptoms:**
- Blank page
- "Cannot GET /"
- Vite server not responding

**Solutions:**
```bash
# Check if Vite is running
netstat -an | findstr :5173  # Windows
lsof -i :5173                # macOS/Linux

# Check frontend terminal for errors
cd web
npm run dev

# Clear Vite cache
rm -rf web/node_modules/.vite
cd web && npm run dev

# Verify dependencies
cd web
rm -rf node_modules
npm install
```

---

## Development Workflow

### Hot Reload

Both backend and frontend support hot-reload for efficient development:

**Backend (ts-node-dev):**
- Automatically reloads on file changes in `src/`
- Preserves database connections
- Fast restart times

**Frontend (Vite HMR):**
- Hot Module Replacement
- Instant updates without full page reload
- Preserves component state

**nginx:**
- No restart needed for application code changes
- Only restart if nginx.conf changes

### Making Changes

```bash
# 1. Make code changes in your editor

# 2. Backend automatically reloads (watch terminal)
# Terminal 1 shows: "Restarting due to changes..."

# 3. Frontend updates in browser (instant)
# No terminal output needed

# 4. Test changes in browser
# http://localhost (with nginx)
# http://localhost:5173 (without nginx)
```

### Production Build

When ready to deploy:

```bash
# Build frontend for production
cd web
npm run build
# Creates optimized build in web/dist/

# Build backend for production
cd ..
npm run build
# Compiles TypeScript to JavaScript in dist/

# Start production server
NODE_ENV=production npm start
```

**Production deployment:**
- Frontend build: Serve `web/dist/` with nginx
- Backend: Run compiled code from `dist/`
- Use port 8080 config in nginx.conf for production

---

## Next Steps

Now that QuikAdmin is installed, proceed to:

1. **[Windows Setup Guide](./windows-setup.md)** - Windows-specific batch scripts and nginx setup
2. **[First Document Guide](./first-document.md)** - Process your first PDF form (10 minutes)
3. **[Authentication API](../300-api/301-authentication.md)** - Learn about API authentication
4. **[Architecture Overview](../../01-current-state/architecture/system-overview.md)** - Understand system design
5. **[Troubleshooting Guide](../400-guides/407-troubleshooting.md)** - Solutions to common problems

---

## Additional Resources

### Documentation
- **Windows Batch Scripts:** [Windows Setup Guide](./windows-setup.md)
- **Docker Deployment:** Use `docker-compose up` for containerized setup
- **API Reference:** [API Documentation](../300-api/)
- **Database Schema:** [Prisma Schema](../../prisma/schema.prisma)

### VS Code Extensions (Recommended)
- **ESLint** (dbaeumer.vscode-eslint) - Code linting
- **Prettier** (esbenp.prettier-vscode) - Code formatting
- **Prisma** (Prisma.prisma) - Database schema support
- **TypeScript Vue Plugin** (Vue.vscode-typescript-vue-plugin) - TypeScript support

### Community Resources
- **GitHub Issues:** Report bugs and request features
- **Discussions:** Ask questions and share knowledge
- **Contributing:** See CONTRIBUTING.md for guidelines

---

**Installation Complete!** 🎉

Proceed to [Windows Setup Guide](./windows-setup.md) (Windows users) or [First Document Guide](./first-document.md) to start using QuikAdmin.


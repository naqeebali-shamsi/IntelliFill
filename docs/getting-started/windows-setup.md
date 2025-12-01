---
title: "Windows Setup Guide"
description: "Windows-specific setup with nginx reverse proxy and batch scripts for IntelliFill QuikAdmin"
category: getting-started
tags: [windows, nginx, batch-scripts, reverse-proxy, native-setup]
lastUpdated: 2025-01-11
relatedDocs:
  - getting-started/installation.md
  - getting-started/first-document.md
  - guides/troubleshooting.md
---

# Windows Setup Guide

**Last Updated:** 2025-01-11
**Platform:** Windows 10/11
**Prerequisites:** [Installation Guide](./installation.md) completed
**Estimated Time:** 15-30 minutes

---

## Overview

This guide provides Windows-specific setup instructions for running IntelliFill QuikAdmin natively on Windows with nginx as a reverse proxy. This setup offers:

- ✓ **Better performance** than Docker on Windows (no WSL2 overhead)
- ✓ **Easier debugging** with direct process access
- ✓ **Faster hot-reload** for development
- ✓ **Automated batch scripts** for service management
- ✓ **Production-like architecture** with nginx reverse proxy

> **Note:** Complete the [Installation Guide](./installation.md) first to install Node.js, PostgreSQL, Redis, and nginx.

---

## Windows Architecture Overview

### How It Works

```
User Browser
     ↓
nginx (port 80) ──────┐
     │                │
     ├─ /api/*  ──────┤──→ Backend (Express on port 3002)
     │                │    ├─ PostgreSQL database
     │                │    └─ Redis cache
     │                │
     └─ /*      ──────┴──→ Frontend (Vite on port 5173)
```

### Component Ports

| Component | Port | Purpose |
|-----------|------|---------|
| nginx | 80 | Reverse proxy (single entry point) |
| Backend | 3002 | Express.js API server |
| Frontend | 5173 | React/Vite development server |
| PostgreSQL | 5432 | Database (may be cloud, no local port) |
| Redis | 6379 | Job queue and cache |

### What Each Component Does

**1. Backend (Port 3002)**
- Express.js API server
- Handles authentication, document processing
- Connects to PostgreSQL and Redis
- Auto-reloads on code changes (ts-node-dev)

**2. Frontend (Port 5173)**
- React application with Vite
- User interface
- Hot Module Replacement (HMR)
- API calls routed through nginx

**3. nginx (Port 80)**
- Reverse proxy and load balancer
- Routes `/api/*` requests to backend
- Routes all other requests to frontend
- Handles CORS, compression, caching
- Provides unified http://localhost access

---

## Windows-Specific Prerequisites

### 1. MSYS2 (Optional but Recommended)

MSYS2 provides better terminal experience on Windows.

**Install MSYS2:**
1. Download from https://www.msys2.org/
2. Run installer with default options
3. After installation, update packages:
   ```bash
   pacman -Syu
   ```

**Benefits:**
- Unix-like terminal commands
- Better package management
- Native Git and build tools

### 2. Windows Terminal (Recommended)

**Install Windows Terminal:**
1. Open Microsoft Store
2. Search for "Windows Terminal"
3. Install (free)

**Or use Chocolatey:**
```powershell
choco install microsoft-windows-terminal
```

**Benefits:**
- Multiple tabs
- Better font rendering
- Split panes
- Customizable themes

### 3. Verify Prerequisites

```powershell
# Check Node.js
node --version  # Should be v20.x or v18.x

# Check npm or Bun
npm --version   # Should be 9.x or 10.x
bun --version   # Optional, for faster builds

# Check PostgreSQL (if local)
psql --version  # Should be 15.x or 16.x

# Check Redis
redis-cli ping  # Should return "PONG"

# Check nginx
nginx -v        # Should show nginx version
```

If any are missing, complete [Installation Guide](./installation.md) first.

---

## nginx Configuration for Windows

### 1. Locate nginx Installation

Default locations:
- `C:\nginx\` (manual installation)
- `C:\tools\nginx\` (Chocolatey installation)
- `C:\ProgramData\chocolatey\lib\nginx\tools\` (Chocolatey alternate)

```powershell
# Find nginx location
where nginx

# Or check if running
netstat -ano | findstr :80
```

### 2. Configure nginx.conf

**Copy project nginx.conf:**

```powershell
# Backup original config
copy C:\nginx\conf\nginx.conf C:\nginx\conf\nginx.conf.backup

# Copy project config to nginx
copy nginx.conf C:\nginx\conf\nginx.conf
```

**Or manually edit** `C:\nginx\conf\nginx.conf`:

```nginx
worker_processes  1;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    sendfile        on;
    keepalive_timeout  65;

    # Development server (port 80)
    server {
        listen       80;
        server_name  localhost;

        # Frontend - Proxy to Vite dev server
        location / {
            proxy_pass http://localhost:5173;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;

            # WebSocket support for HMR
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Backend API - Proxy to Express
        location /api {
            proxy_pass http://localhost:3002;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # CORS headers
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
        }

        # Health check endpoint
        location /health {
            proxy_pass http://localhost:3002/health;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
        }
    }

    # Production server (port 8080) - for built frontend
    server {
        listen       8080;
        server_name  localhost;

        # Serve built frontend files
        location / {
            root   ../quikadmin/web/dist;
            index  index.html;
            try_files $uri $uri/ /index.html;
        }

        # Backend API - Same as development
        location /api {
            proxy_pass http://localhost:3002;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### 3. Test nginx Configuration

```powershell
# Test configuration for syntax errors
nginx -t

# Expected output:
# nginx: the configuration file C:\nginx\conf\nginx.conf syntax is ok
# nginx: configuration file C:\nginx\conf\nginx.conf test is successful
```

**Common errors:**

**Error: "bind() to 0.0.0.0:80 failed"**
- Port 80 is already in use (IIS, Skype, other web server)
- Solution: Stop other service or change nginx port to 8080

**Error: "cannot load certificate"**
- SSL certificate issues (not needed for development)
- Solution: Remove SSL directives from nginx.conf

---

## Windows Batch Scripts

The project includes batch scripts for easy service management on Windows.

### Available Scripts

| Script | Purpose |
|--------|---------|
| `start-windows.bat` | Start all services (backend, frontend, nginx) |
| `start-nginx-only.bat` | Start only nginx |
| `stop-all-windows.bat` | Stop all services |

### 1. start-windows.bat

**Location:** `quikadmin/start-windows.bat`

**What it does:**
1. Starts backend on port 3002 (separate window)
2. Starts frontend on port 5173 (separate window)
3. Starts nginx on port 80 (separate window)
4. Opens browser to http://localhost

**Usage:**
```powershell
# From quikadmin directory
.\start-windows.bat
```

**Script content:**
```batch
@echo off
echo Starting QuikAdmin Windows Development Environment...

REM Start Backend (Express API on port 3002)
start "QuikAdmin Backend" cmd /k "npm run dev"

REM Wait 5 seconds for backend to initialize
timeout /t 5

REM Start Frontend (Vite on port 5173)
start "QuikAdmin Frontend" cmd /k "cd web && bun run dev"

REM Wait 3 seconds for frontend to initialize
timeout /t 3

REM Start nginx (port 80)
start "nginx Reverse Proxy" cmd /k "C:\nginx\nginx.exe"

REM Wait 2 seconds for nginx to start
timeout /t 2

REM Open browser
start http://localhost

echo.
echo ======================================
echo QuikAdmin Development Environment Started
echo ======================================
echo Backend:  http://localhost:3002
echo Frontend: http://localhost:5173
echo Main App: http://localhost (via nginx)
echo ======================================
echo.
echo Press any key to exit this window...
pause >nul
```

### 2. start-nginx-only.bat

**Location:** `quikadmin/start-nginx-only.bat`

**What it does:**
- Starts only nginx reverse proxy
- Use when backend and frontend are already running

**Usage:**
```powershell
.\start-nginx-only.bat
```

**Script content:**
```batch
@echo off
echo Starting nginx Reverse Proxy...

REM Check if nginx is already running
tasklist /FI "IMAGENAME eq nginx.exe" 2>NUL | find /I /N "nginx.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo nginx is already running. Reloading configuration...
    C:\nginx\nginx.exe -s reload
) else (
    echo Starting nginx...
    start "nginx Reverse Proxy" cmd /k "C:\nginx\nginx.exe"
)

timeout /t 2
echo nginx started on http://localhost
pause
```

### 3. stop-all-windows.bat

**Location:** `quikadmin/stop-all-windows.bat`

**What it does:**
- Stops all nginx processes
- Stops Node.js backend processes
- Stops frontend processes
- Cleans up all services

**Usage:**
```powershell
.\stop-all-windows.bat
```

**Script content:**
```batch
@echo off
echo Stopping QuikAdmin Services...

REM Stop nginx
echo Stopping nginx...
taskkill /F /IM nginx.exe 2>NUL
if %ERRORLEVEL% EQU 0 (
    echo nginx stopped successfully
) else (
    echo nginx was not running
)

REM Stop Node.js processes (backend and frontend)
echo Stopping Node.js processes...
taskkill /F /IM node.exe 2>NUL
if %ERRORLEVEL% EQU 0 (
    echo Node.js processes stopped successfully
) else (
    echo No Node.js processes were running
)

REM Stop Bun processes (if using Bun for frontend)
echo Stopping Bun processes...
taskkill /F /IM bun.exe 2>NUL

echo.
echo All QuikAdmin services stopped.
pause
```

---

## Running the Application on Windows

### Method 1: All-in-One (Recommended)

**Start everything with one command:**

```powershell
# From quikadmin directory
.\start-windows.bat
```

This will:
- ✓ Open 3 separate console windows (backend, frontend, nginx)
- ✓ Start all services automatically
- ✓ Open browser to http://localhost
- ✓ Show logs in each window

**Access the application:**
- **Main App:** http://localhost
- **API directly:** http://localhost/api
- **Health check:** http://localhost/health

### Method 2: Individual Services

**Start each service manually:**

```powershell
# Terminal 1: Backend
npm run dev
# Output: Server running on port 3002

# Terminal 2: Frontend (new PowerShell window)
cd web
bun run dev  # or: npm run dev
# Output: Vite dev server running on port 5173

# Terminal 3: nginx (new PowerShell window)
.\start-nginx-only.bat
# Output: nginx started on http://localhost
```

**When to use:**
- Debugging specific service
- Need to see individual logs
- Testing without nginx

### Method 3: Without nginx (Direct Access)

**Run without reverse proxy:**

```powershell
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
cd web
bun run dev
```

**Access application:**
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3002
- **Health:** http://localhost:3002/health

**When to use:**
- nginx configuration issues
- Simple development (no need for unified port)
- Testing CORS behavior

---

## Accessing the Application

### With nginx (Port 80)

**Primary URLs:**
- **Main Application:** http://localhost
- **API Endpoints:** http://localhost/api/*
- **Health Check:** http://localhost/health

**Example API calls:**
```powershell
# Health check
curl http://localhost/health

# Authentication
curl -X POST http://localhost/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@example.com","password":"Admin123!"}'

# Get documents
curl http://localhost/api/documents `
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Without nginx (Direct Ports)

**URLs:**
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3002/api/*
- **Health Check:** http://localhost:3002/health

**Example API calls:**
```powershell
# Health check (direct backend)
curl http://localhost:3002/health

# Authentication (direct backend)
curl -X POST http://localhost:3002/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@example.com","password":"Admin123!"}'
```

---

## Windows-Specific Troubleshooting

### Issue: "nginx: [emerg] bind() to 0.0.0.0:80 failed"

**Cause:** Port 80 is already in use by another service (IIS, Skype, etc.)

**Solution 1: Stop conflicting service**
```powershell
# Check what's using port 80
netstat -ano | findstr :80

# Common culprits:
# - IIS (Internet Information Services)
# - Skype
# - Other web servers

# Stop IIS
iisreset /stop

# Or disable IIS service
sc config W3SVC start= disabled
```

**Solution 2: Change nginx port**
```nginx
# Edit C:\nginx\conf\nginx.conf
# Change: listen 80;
# To:     listen 8080;

# Then access via http://localhost:8080
```

### Issue: "taskkill /PID access denied"

**Cause:** Insufficient permissions to kill process

**Solution:**
```powershell
# Run PowerShell as Administrator
# Right-click PowerShell → Run as Administrator

# Then run stop script
.\stop-all-windows.bat
```

### Issue: Backend or Frontend won't start

**Symptoms:**
- "EADDRINUSE: address already in use"
- Port 3002 or 5173 already in use

**Solution:**
```powershell
# Find processes using ports
netstat -ano | findstr :3002
netstat -ano | findstr :5173

# Kill processes by PID
taskkill /PID <PID> /F

# Or use stop script
.\stop-all-windows.bat

# Then restart
.\start-windows.bat
```

### Issue: "npm run dev" fails

**Symptoms:**
- "Cannot find module"
- TypeScript errors

**Solution:**
```powershell
# Delete node_modules and reinstall
rmdir /s /q node_modules
del package-lock.json
npm install

# Regenerate Prisma client
npx prisma generate

# Try again
npm run dev
```

### Issue: Frontend shows blank page

**Symptoms:**
- Browser shows white screen
- Console shows "Cannot GET /"

**Solution:**
```powershell
# Check if Vite is running
netstat -ano | findstr :5173

# Clear Vite cache
rmdir /s /q web\node_modules\.vite

# Restart frontend
cd web
npm run dev
```

### Issue: Redis connection failed on Windows

**Symptoms:**
- "Error: Redis connection to localhost:6379 failed"

**Solution:**
```powershell
# Check if Redis is running
redis-cli ping

# If not running, start Redis
cd C:\Redis
start redis-server.exe

# Or run as Windows service
redis-server.exe --service-install
redis-server.exe --service-start
```

### Issue: PostgreSQL connection refused

**Symptoms:**
- "Connection refused" or "ECONNREFUSED"
- Cannot connect to database

**Solution:**
```powershell
# Check if PostgreSQL service is running
sc query postgresql-x64-15

# Start PostgreSQL service
net start postgresql-x64-15

# Or use Services GUI
# Win+R → services.msc → Find PostgreSQL → Start
```

---

## Windows Development Workflow

### Daily Development Routine

**Morning startup:**
```powershell
# 1. Navigate to project
cd N:\IntelliFill\quikadmin

# 2. Pull latest changes
git pull

# 3. Install any new dependencies
npm install
cd web && npm install && cd ..

# 4. Start all services
.\start-windows.bat

# 5. Open in browser (auto-opens)
# http://localhost
```

**During development:**
- ✓ Make code changes in VS Code
- ✓ Backend auto-reloads (watch terminal)
- ✓ Frontend hot-reloads (instant browser update)
- ✓ No need to restart nginx

**End of day shutdown:**
```powershell
# Stop all services
.\stop-all-windows.bat

# Or just close terminal windows
```

### Code Changes and Hot Reload

**Backend changes:**
1. Edit files in `src/`
2. ts-node-dev detects changes
3. Backend restarts automatically (5-10 seconds)
4. Watch backend terminal for "Server running on port 3002"

**Frontend changes:**
1. Edit files in `web/src/`
2. Vite HMR updates instantly (<1 second)
3. Browser updates without full page reload
4. Component state preserved

**nginx changes:**
1. Edit `C:\nginx\conf\nginx.conf`
2. Test configuration: `nginx -t`
3. Reload nginx: `nginx -s reload`
4. No need to restart nginx process

### Debugging in Windows

**Backend debugging:**
```powershell
# Run with debugger
npm run dev:debug

# Then attach VS Code debugger
# F5 → Node.js: Attach to Process
```

**View logs:**
```powershell
# Backend logs (in backend terminal)
# Shows all console.log, errors, requests

# Frontend logs (in frontend terminal)
# Shows Vite build output, HMR updates

# nginx logs
type C:\nginx\logs\error.log
type C:\nginx\logs\access.log
```

---

## Production Build on Windows

### Build for Production

```powershell
# 1. Build frontend
cd web
npm run build
# Creates optimized build in web/dist/

# 2. Build backend
cd ..
npm run build
# Compiles TypeScript to JavaScript in dist/

# 3. Verify builds
dir web\dist       # Frontend build files
dir dist           # Backend compiled files
```

### Run Production Build

**Option 1: Using nginx port 8080**
```powershell
# nginx.conf already configured for port 8080 (production)
# Serves web/dist/ for frontend
# Proxies /api to backend

# Start backend in production mode
set NODE_ENV=production
npm start

# Access production build
# http://localhost:8080
```

**Option 2: Standalone deployment**
```powershell
# Serve frontend with http-server
npx http-server web/dist -p 80

# Run backend production
set NODE_ENV=production
npm start

# Access at http://localhost
```

---

## Why NOT Docker on Windows?

### Performance Issues

1. **WSL2 Overhead:**
   - Docker Desktop uses WSL2 virtualization
   - Extra layer adds latency
   - File I/O slower than native

2. **Hot Reload Problems:**
   - File watching unreliable in containers
   - HMR (Hot Module Replacement) often breaks
   - Full restarts required

3. **Debugging Complexity:**
   - Harder to attach debuggers
   - Log output delayed
   - Port mapping complications

4. **Resource Usage:**
   - Docker Desktop consumes 2-4GB RAM
   - CPU overhead from virtualization
   - Disk space for images/containers

### When to Use Docker on Windows

Docker **IS** recommended for:
- ✓ Production deployment (Linux servers)
- ✓ CI/CD pipelines
- ✓ Testing production builds locally
- ✓ Multi-service orchestration

Docker is **NOT** recommended for:
- ✗ Daily Windows development
- ✗ Hot-reload development
- ✗ Debugging backend/frontend
- ✗ Performance-critical work

---

## File Structure Reference

```
quikadmin/
├── src/                          # Backend source code
│   ├── controllers/              # API controllers
│   ├── services/                 # Business logic
│   ├── models/                   # Data models
│   └── index.ts                  # Entry point
│
├── web/                          # Frontend React app
│   ├── src/                      # React source code
│   ├── public/                   # Static assets
│   ├── dist/                     # Production build (after npm run build)
│   └── package.json              # Frontend dependencies
│
├── docs/                         # Documentation
│   └── 100-getting-started/      # Getting started guides
│
├── nginx.conf                    # nginx configuration (copy to C:\nginx\conf\)
├── start-windows.bat             # Start all services (Windows)
├── start-nginx-only.bat          # Start nginx only (Windows)
├── stop-all-windows.bat          # Stop all services (Windows)
├── .env                          # Environment variables (create from .env.example)
├── package.json                  # Backend dependencies
│
└── IGNORED (Docker files - not needed for Windows native):
    ├── docker-compose.yml        # Docker Compose config (ignore)
    ├── Dockerfile.backend        # Backend container (ignore)
    └── Dockerfile.frontend       # Frontend container (ignore)
```

---

## Summary

### Windows Native Setup Advantages

- ✓ **Best Performance** - No virtualization overhead
- ✓ **Fast Hot Reload** - Instant frontend updates, quick backend restarts
- ✓ **Easy Debugging** - Direct process access, VS Code integration
- ✓ **Simple Management** - Batch scripts for one-command startup
- ✓ **Production-Like** - nginx reverse proxy mirrors production

### Quick Reference

**Start Development:**
```powershell
.\start-windows.bat
```

**Stop Development:**
```powershell
.\stop-all-windows.bat
```

**Access Application:**
- http://localhost (with nginx)
- http://localhost:5173 (frontend direct)
- http://localhost:3002 (backend direct)

**Next Steps:**
1. Complete [Installation Guide](./installation.md) if not done
2. Create admin user via web interface
3. Process your [First Document](./first-document.md)
4. Read [API Documentation](../300-api/)
5. Check [Troubleshooting Guide](../400-guides/407-troubleshooting.md) for issues

---

**Windows Setup Complete!** 🎉

You now have a production-like development environment running natively on Windows. Proceed to [First Document Guide](./first-document.md) to start using QuikAdmin.

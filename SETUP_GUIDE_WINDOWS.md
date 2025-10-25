# QuikAdmin Windows Setup Guide

## Current Architecture Overview

### What You Have Now:
1. **Backend (BE)**: Node.js/Express API running on port 3000
2. **Frontend (FE)**: React/Vite app running on port 5173
3. **Docker Setup**: Optional containerized deployment (you're NOT using this)
4. **Windows Native Setup**: Direct execution on Windows (THIS is what you'll use)

## Setup Options Explained

### Option 1: Docker (NOT RECOMMENDED for Windows development)
- Uses `docker-compose.yml` to run everything in containers
- Good for Linux/Mac, problematic on Windows
- Requires Docker Desktop
- **You should IGNORE the Docker files**

### Option 2: Windows Native (RECOMMENDED - What we just set up)
- Run backend and frontend directly on Windows
- Use nginx as reverse proxy
- Better performance, easier debugging
- **This is what the new scripts do**

## How The New Setup Works

### Architecture:
```
User Browser
     ↓
Nginx (port 80)
     ├── /api/* → Backend (port 3000)
     └── /* → Frontend (port 5173)
```

### What Each Component Does:

1. **Backend (Port 3000)**:
   - Express.js API server
   - Handles authentication, document processing
   - Connects to PostgreSQL database
   - Run with: `npm run dev`

2. **Frontend (Port 5173)**:
   - React app with Vite
   - User interface
   - Run with: `cd web && bun run dev` (or `npm run dev`)

3. **Nginx (Port 80)**:
   - Reverse proxy
   - Routes `/api` requests to backend
   - Routes everything else to frontend
   - Handles CORS, compression, caching

## Installation Steps

### 1. Install Prerequisites

```powershell
# Check if you have these:
node --version  # Need Node.js 18+
npm --version   # Comes with Node
bun --version   # Optional, for faster frontend builds

# Install if missing:
# Node.js: https://nodejs.org/
# Bun (optional): https://bun.sh/
```

### 2. Install Nginx on Windows

Option A: Download and extract
1. Go to: http://nginx.org/en/download.html
2. Download nginx/Windows (stable version)
3. Extract to `C:\nginx\`

Option B: Using Chocolatey
```powershell
choco install nginx
```

### 3. Install Project Dependencies

```powershell
# Backend dependencies
npm install

# Frontend dependencies
cd web
npm install  # or 'bun install' if you have bun
cd ..
```

### 4. Configure Environment

Create `.env` file in project root:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/quikadmin

# JWT Secrets (generate random strings)
JWT_SECRET=your-very-long-random-secret-key-at-least-64-chars
JWT_REFRESH_SECRET=another-very-long-random-secret-key-at-least-64-chars
JWT_ISSUER=quikadmin
JWT_AUDIENCE=quikadmin-users

# Environment
NODE_ENV=development
PORT=3000

# Redis (optional)
REDIS_URL=redis://localhost:6379
```

## Running The Application

### Method 1: All-in-One (Recommended)
```powershell
# This starts everything:
.\start-windows.bat
```

This will:
- Start backend on port 3000
- Start frontend on port 5173  
- Start nginx on port 80
- Open separate console windows for each service

### Method 2: Individual Services

Start each in separate terminals:

```powershell
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
cd web
bun run dev  # or npm run dev

# Terminal 3: Nginx
.\start-nginx-only.bat
```

### Method 3: Without Nginx (Direct Access)

If nginx isn't working:
```powershell
# Just run backend and frontend
# Access backend at: http://localhost:3000
# Access frontend at: http://localhost:5173
```

## Accessing The Application

With nginx running:
- **Main App**: http://localhost
- **API**: http://localhost/api

Without nginx:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000

## Troubleshooting

### Issue: "nginx: [emerg] bind() to 0.0.0.0:80 failed"
**Solution**: Port 80 is in use. Either:
- Stop the other service using port 80
- Change nginx port in `nginx.conf`: `listen 8080;`

### Issue: "Node.js not found"
**Solution**: Install Node.js from https://nodejs.org/

### Issue: Frontend not loading
**Solution**: Check if Vite is running on port 5173:
```powershell
netstat -an | findstr :5173
```

### Issue: API calls failing
**Solution**: Ensure backend is running on port 3000:
```powershell
curl http://localhost:3000/health
```

## File Structure Explanation

```
quikadmin/
├── src/                    # Backend source code
├── web/                    # Frontend React app
├── nginx.conf             # Nginx configuration
├── start-windows.bat      # Start everything
├── start-nginx-only.bat   # Start only nginx
├── stop-all-windows.bat  # Stop everything
├── docker-compose.yml     # IGNORE - for Docker only
├── Dockerfile.*           # IGNORE - for Docker only
└── .env                   # Your environment variables
```

## Why NOT Docker on Windows?

1. **Performance**: Docker on Windows (WSL2) adds overhead
2. **Complexity**: Extra layer of virtualization
3. **Debugging**: Harder to debug containerized apps
4. **File watching**: Issues with hot-reload in containers
5. **Port conflicts**: Docker Desktop can conflict with Windows services

## Development Workflow

1. **Make changes** to code
2. **Backend auto-reloads** (using ts-node-dev)
3. **Frontend hot-reloads** (using Vite HMR)
4. **Nginx doesn't need restart** for app changes

## Production Build

When ready for production:

```powershell
# Build frontend
cd web
npm run build
cd ..

# Build backend
npm run build

# Frontend build will be in web/dist/
# Backend build will be in dist/
```

Then use nginx to serve the built files (see port 8080 config in nginx.conf).

## Summary

- **YES**, this setup works for both backend (BE) and frontend (FE)
- **IGNORE** Docker files - they're for Linux/Mac deployment
- **USE** the Windows batch scripts for easy development
- **Nginx** acts as a single entry point, routing to both BE and FE
- Everything runs natively on Windows for best performance
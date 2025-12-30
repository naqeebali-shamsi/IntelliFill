# IntelliFill Development Environment Setup

## Quick Start

### Option 1: Windows Batch Script (Recommended for Windows)

Simply double-click `start-dev.bat` or run from command prompt:

```cmd
start-dev.bat
```

This will:

- ✅ Kill any existing processes on ports 3002, 8080, and 5555
- ✅ Start Backend API Server on port 3002
- ✅ Start Frontend UI Server on port 8080
- ✅ Start Prisma Studio on port 5555
- ✅ Save logs to `logs/` directory
- ✅ Optionally open frontend in your browser

### Option 2: Bash Script (Git Bash / WSL)

```bash
bash start-dev.sh
```

### Option 3: Manual Start (Individual Servers)

**Terminal 1 - Backend API:**

```bash
cd quikadmin
npm run dev
```

**Terminal 2 - Frontend UI:**

```bash
cd quikadmin-web
npm run dev
```

**Terminal 3 - Prisma Studio:**

```bash
cd quikadmin
npx prisma studio
```

## Access Points

Once all servers are running, you can access:

| Service                  | URL                            | Description                |
| ------------------------ | ------------------------------ | -------------------------- |
| 🎨 **Frontend UI**       | http://localhost:8080          | Main application interface |
| 🔧 **Backend API**       | http://localhost:3002          | REST API server            |
| 📚 **API Documentation** | http://localhost:3002/api-docs | Swagger/OpenAPI docs       |
| ❤️ **Health Check**      | http://localhost:3002/health   | Server health status       |
| 🗄️ **Prisma Studio**     | http://localhost:5555          | Database management UI     |

## Logs

When using the startup scripts, logs are saved to:

- `logs/backend.log` - Backend server output
- `logs/frontend.log` - Frontend server output
- `logs/prisma.log` - Prisma Studio output

## Stopping Servers

### If using startup scripts:

- Press `Ctrl+C` in the terminal where the script is running
- Or manually kill processes on ports 3002, 8080, 5555

### Manual kill commands:

**Windows:**

```cmd
REM Find and kill backend (port 3002)
for /f "tokens=5" %a in ('netstat -ano ^| findstr ":3002"') do taskkill /F /PID %a

REM Find and kill frontend (port 8080)
for /f "tokens=5" %a in ('netstat -ano ^| findstr ":8080"') do taskkill /F /PID %a

REM Find and kill Prisma Studio (port 5555)
for /f "tokens=5" %a in ('netstat -ano ^| findstr ":5555"') do taskkill /F /PID %a
```

**Linux/Mac:**

```bash
# Kill backend
lsof -ti:3002 | xargs kill -9

# Kill frontend
lsof -ti:8080 | xargs kill -9

# Kill Prisma Studio
lsof -ti:5555 | xargs kill -9
```

## Troubleshooting

### Port Already in Use

If you see "Port already in use" errors:

1. The startup scripts automatically kill existing processes
2. Or manually kill the processes using the commands above
3. Then restart the servers

### Database Connection Issues

If the backend fails to connect to the database:

1. Check that your `.env` file in `quikadmin/` has correct database credentials
2. Ensure the Neon database is awake (free tier auto-sleeps after inactivity)
3. Check the retry logs - the connection will retry up to 5 times with exponential backoff

### Redis Not Available

Redis is optional for testing:

- The system gracefully falls back to memory-based rate limiting
- For full OCR queue functionality, install and start Redis:

  ```bash
  # Windows (via Chocolatey)
  choco install redis-64
  redis-server

  # Linux/Mac
  redis-server
  ```

### Frontend Build Errors

If Vite fails to start:

1. Clear the Vite cache: `rm -rf quikadmin-web/node_modules/.vite`
2. Reinstall dependencies: `cd quikadmin-web && npm install`
3. Restart the frontend server

## First Time Setup

Before running the servers for the first time:

1. **Install dependencies:**

   ```bash
   # Backend
   cd quikadmin
   npm install

   # Frontend
   cd ../quikadmin-web
   npm install
   ```

2. **Setup database:**

   ```bash
   cd quikadmin
   npm run db:migrate
   npm run db:seed  # Optional: seed with template data
   ```

3. **Configure environment:**
   - Copy `.env.example` to `.env` in `quikadmin/` directory
   - Update database credentials and other settings

## Next Steps

Once all servers are running, refer to:

- [TESTING_PLAN.md](./TESTING_PLAN.md) - Comprehensive testing guide
- [PHASE2_COMPLETION_SUMMARY.md](./PHASE2_COMPLETION_SUMMARY.md) - Feature overview
- [PRODUCTION_TASKS.md](./PRODUCTION_TASKS.md) - Development roadmap

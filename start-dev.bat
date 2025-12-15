@echo off
REM IntelliFill Development Servers Startup Script (Windows)
REM This script starts all required development servers in parallel

echo.
echo ========================================================
echo   IntelliFill Development Environment
echo ========================================================
echo.

REM Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

REM Kill any existing processes on our ports
echo Checking for existing processes...
echo.

REM Kill process on port 3002 (Backend)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3002"') do (
    echo Killing existing backend process (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

REM Kill process on port 8080 (Frontend)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080"') do (
    echo Killing existing frontend process (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

REM Kill process on port 5555 (Prisma Studio)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5555"') do (
    echo Killing existing Prisma Studio process (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo Ports cleared. Starting servers...
echo.

REM Start Backend Server
echo [1/3] Starting Backend API Server (port 3002)...
cd quikadmin
start /B npm run dev > ..\logs\backend.log 2>&1
cd ..
timeout /t 3 /nobreak >nul

REM Start Frontend Server (using bun)
echo [2/3] Starting Frontend UI Server (port 8080)...
cd quikadmin-web
start /B bun run dev > ..\logs\frontend.log 2>&1
cd ..
timeout /t 2 /nobreak >nul

REM Start Prisma Studio
echo [3/3] Starting Prisma Studio (port 5555)...
cd quikadmin
start /B npx prisma studio > ..\logs\prisma.log 2>&1
cd ..

echo.
echo Waiting for servers to initialize...
timeout /t 5 /nobreak >nul

echo.
echo ========================================================
echo   All Servers Started Successfully!
echo ========================================================
echo.
echo   Backend API:       http://localhost:3002
echo   API Docs:          http://localhost:3002/api-docs
echo   Health Check:      http://localhost:3002/health
echo.
echo   Frontend UI:       http://localhost:8080
echo.
echo   Prisma Studio:     http://localhost:5555
echo ========================================================
echo.
echo   Logs saved to:
echo   - logs\backend.log
echo   - logs\frontend.log
echo   - logs\prisma.log
echo.
echo   Press any key to open the frontend in your browser...
echo   Or close this window to keep servers running in background.
echo.
pause >nul
start http://localhost:8080

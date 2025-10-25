@echo off
REM QuikAdmin - Hybrid Start (Docker services + Local frontend)
REM This script starts Docker services and optionally local frontend

echo ============================================
echo Starting QuikAdmin Hybrid Mode on Windows
echo ============================================
echo.

REM Set the project directory
set PROJECT_DIR=%~dp0
cd /d %PROJECT_DIR%

REM Check if Docker is running
docker version >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Docker is not running or not installed
    echo Please start Docker Desktop first
    pause
    exit /b 1
)

REM Start Docker services (database, redis, backend)
echo Starting Docker services (PostgreSQL, Redis, Backend)...
docker-compose up -d postgres redis app worker mailhog pgadmin

REM Wait for services to be ready
echo Waiting for services to start...
timeout /t 10 >nul

REM Check if services are healthy
echo Checking service health...
docker-compose ps

echo.
echo ============================================
echo Docker services started successfully!
echo ============================================
echo.
echo Services available at:
echo   - Backend API: http://localhost:3001
echo   - PostgreSQL: localhost:5432
echo   - Redis: localhost:6379
echo   - PgAdmin: http://localhost:5050
echo   - MailHog: http://localhost:8025
echo.

REM Ask if user wants to start frontend locally
set /p START_FRONTEND="Start frontend locally? (y/n): "
if /i "%START_FRONTEND%"=="y" (
    echo.
    echo Starting Frontend Server locally on port 5173...
    start "IntelliFill Frontend" cmd /k "cd /d %PROJECT_DIR%\web && npm run dev"
    
    echo.
    echo Frontend available at: http://localhost:5173
)

REM Ask if user wants to start nginx
set /p START_NGINX="Start nginx reverse proxy? (y/n): "
if /i "%START_NGINX%"=="y" (
    REM Check if nginx is available
    where nginx >nul 2>nul
    if %errorlevel% equ 0 (
        echo Starting Nginx...
        nginx -s stop >nul 2>nul
        timeout /t 2 >nul
        nginx -c "%PROJECT_DIR%\nginx.conf"
        echo Nginx started at: http://localhost
    ) else (
        echo WARNING: Nginx not found in PATH
    )
)

echo.
echo ============================================
echo All requested services are running!
echo ============================================
echo.
echo Press any key to stop all services...
pause >nul

REM Stop all services
echo.
echo Stopping all services...

REM Stop nginx if running
nginx -s stop >nul 2>nul

REM Stop local processes
taskkill /IM node.exe /F >nul 2>nul

REM Stop Docker services
docker-compose down

echo All services stopped.
pause
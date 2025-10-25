@echo off
REM QuikAdmin - Complete One-Stop Startup Script
REM Starts all required services with proper health checks

echo ============================================
echo QuikAdmin - Starting All Services
echo ============================================
echo.

REM Set the project directory
set PROJECT_DIR=%~dp0
cd /d %PROJECT_DIR%

REM Check Docker is running
echo [1/4] Checking Docker...
docker version >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Docker is not running!
    echo Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Waiting for Docker to start (30 seconds)...
    timeout /t 30 >nul
    
    REM Check again
    docker version >nul 2>nul
    if %errorlevel% neq 0 (
        echo ERROR: Docker failed to start. Please start Docker Desktop manually.
        pause
        exit /b 1
    )
)
echo Docker is running.

REM Start all Docker services
echo.
echo [2/4] Starting Docker services...
docker-compose up -d

REM Wait for services to be healthy
echo.
echo [3/4] Waiting for services to be healthy...
set RETRY_COUNT=0
:HEALTH_CHECK
set /a RETRY_COUNT+=1
if %RETRY_COUNT% GTR 30 (
    echo ERROR: Services failed to become healthy after 30 attempts
    docker-compose logs --tail=50
    pause
    exit /b 1
)

REM Check PostgreSQL health
docker exec quikadmin-postgres-1 pg_isready -U intellifill >nul 2>nul
if %errorlevel% neq 0 (
    echo Waiting for PostgreSQL... (attempt %RETRY_COUNT%/30)
    timeout /t 2 >nul
    goto HEALTH_CHECK
)

REM Check Redis health
docker exec quikadmin-redis-1 redis-cli ping >nul 2>nul
if %errorlevel% neq 0 (
    echo Waiting for Redis... (attempt %RETRY_COUNT%/30)
    timeout /t 2 >nul
    goto HEALTH_CHECK
)

echo All services are healthy!

REM Check backend API
echo.
echo [4/4] Verifying backend API...
timeout /t 3 >nul
curl -s http://localhost:3001/health >nul 2>nul
if %errorlevel% equ 0 (
    echo Backend API is responding!
) else (
    echo WARNING: Backend API not responding yet. Check logs with: docker logs quikadmin-app-1
)

REM Optional: Start nginx if available
where nginx >nul 2>nul
if %errorlevel% equ 0 (
    echo.
    echo Starting Nginx reverse proxy...
    nginx -s stop >nul 2>nul
    timeout /t 1 >nul
    nginx -c "%PROJECT_DIR%\nginx.conf" >nul 2>nul
    if %errorlevel% equ 0 (
        echo Nginx started successfully!
        set NGINX_RUNNING=true
    ) else (
        echo WARNING: Nginx failed to start
        set NGINX_RUNNING=false
    )
) else (
    set NGINX_RUNNING=false
)

REM Display success message
echo.
echo ============================================
echo    ALL SERVICES STARTED SUCCESSFULLY!
echo ============================================
echo.
echo Services available at:
echo   Backend API:    http://localhost:3001
echo   Frontend:       http://localhost:5173
echo   PostgreSQL:     localhost:5432 (user: intellifill, pass: intellifill123)
echo   Redis:          localhost:6379
echo   PgAdmin:        http://localhost:5050 (admin@example.com / admin)
echo   MailHog:        http://localhost:8025

if "%NGINX_RUNNING%"=="true" (
    echo   Nginx Proxy:    http://localhost (unified access point)
)

echo.
echo Health Check Endpoints:
echo   Backend:  http://localhost:3001/health
echo   API Docs: http://localhost:3001/api-docs
echo.
echo Useful Commands:
echo   View logs:        docker-compose logs -f [service]
echo   Stop all:         docker-compose down
echo   Restart service:  docker-compose restart [service]
echo.
echo Services: app, web, postgres, redis, worker, pgadmin, mailhog
echo.
echo Press Ctrl+C to keep services running in background
echo Press any other key to stop all services...
pause >nul

REM Stop all services
echo.
echo Stopping all services...

if "%NGINX_RUNNING%"=="true" (
    nginx -s stop >nul 2>nul
)

docker-compose down

echo All services stopped.
pause
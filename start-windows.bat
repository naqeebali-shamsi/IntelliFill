@echo off
REM QuikAdmin - Start All Services on Windows
REM This script starts backend, frontend, and nginx

echo ============================================
echo Starting QuikAdmin Services on Windows
echo ============================================
echo.

REM Set the project directory
set PROJECT_DIR=%~dp0
cd /d %PROJECT_DIR%

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if Bun is installed (for frontend)
where bun >nul 2>nul
if %errorlevel% neq 0 (
    echo WARNING: Bun is not installed. Frontend will use npm instead.
    set USE_BUN=false
) else (
    set USE_BUN=true
)

REM Start Backend Server
echo Starting Backend Server on port 3000...
start "IntelliFill Backend" cmd /k "cd /d %PROJECT_DIR% && npm run dev"
timeout /t 3 >nul

REM Start Frontend Server
echo Starting Frontend Server on port 5173...
if "%USE_BUN%"=="true" (
    start "IntelliFill Frontend" cmd /k "cd /d %PROJECT_DIR%\web && bun run dev"
) else (
    start "IntelliFill Frontend" cmd /k "cd /d %PROJECT_DIR%\web && npm run dev"
)
timeout /t 3 >nul

REM Check if nginx is in PATH or in common locations
set NGINX_FOUND=false
where nginx >nul 2>nul
if %errorlevel% equ 0 (
    set NGINX_FOUND=true
    set NGINX_CMD=nginx
) else (
    REM Check common nginx installation paths
    if exist "C:\nginx\nginx.exe" (
        set NGINX_FOUND=true
        set NGINX_CMD=C:\nginx\nginx.exe
    ) else if exist "C:\Program Files\nginx\nginx.exe" (
        set NGINX_FOUND=true
        set NGINX_CMD="C:\Program Files\nginx\nginx.exe"
    ) else if exist "%USERPROFILE%\nginx\nginx.exe" (
        set NGINX_FOUND=true
        set NGINX_CMD=%USERPROFILE%\nginx\nginx.exe
    )
)

if "%NGINX_FOUND%"=="true" (
    echo.
    echo Starting Nginx...
    REM Stop nginx if already running
    %NGINX_CMD% -s stop >nul 2>nul
    timeout /t 2 >nul
    
    REM Start nginx with our config
    %NGINX_CMD% -c "%PROJECT_DIR%\nginx.conf"
    
    echo.
    echo ============================================
    echo All services started successfully!
    echo ============================================
    echo.
    echo Access the application at:
    echo   - Main App (via Nginx): http://localhost
    echo   - Production Build: http://localhost:8080
    echo   - Backend API Direct: http://localhost:3000
    echo   - Frontend Dev Direct: http://localhost:5173
    echo.
    echo API endpoints available at:
    echo   - http://localhost/api
    echo.
) else (
    echo.
    echo WARNING: Nginx not found!
    echo Please install nginx and add it to PATH, or modify this script with your nginx location.
    echo.
    echo Download nginx from: http://nginx.org/en/download.html
    echo Recommended: Extract to C:\nginx\
    echo.
    echo Services running without nginx:
    echo   - Backend: http://localhost:3000
    echo   - Frontend: http://localhost:5173
    echo.
)

echo Press any key to stop all services...
pause >nul

REM Stop all services
echo.
echo Stopping all services...

REM Stop nginx if it was started
if "%NGINX_FOUND%"=="true" (
    %NGINX_CMD% -s stop >nul 2>nul
)

REM Kill node processes
taskkill /IM node.exe /F >nul 2>nul
taskkill /IM bun.exe /F >nul 2>nul

echo All services stopped.
pause
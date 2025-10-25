@echo off
REM QuikAdmin - Start Only Nginx (assumes backend and frontend are already running)

echo ============================================
echo Starting Nginx for QuikAdmin
echo ============================================
echo.

set PROJECT_DIR=%~dp0
cd /d %PROJECT_DIR%

REM Check if nginx is available
set NGINX_FOUND=false
where nginx >nul 2>nul
if %errorlevel% equ 0 (
    set NGINX_FOUND=true
    set NGINX_CMD=nginx
) else (
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

if "%NGINX_FOUND%"=="false" (
    echo ERROR: Nginx not found!
    echo Please install nginx and add it to PATH.
    echo Download from: http://nginx.org/en/download.html
    pause
    exit /b 1
)

REM Stop nginx if already running
echo Stopping any existing nginx processes...
%NGINX_CMD% -s stop >nul 2>nul
timeout /t 2 >nul

REM Start nginx with our config
echo Starting nginx with custom configuration...
%NGINX_CMD% -c "%PROJECT_DIR%\nginx.conf"

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo Nginx started successfully!
    echo ============================================
    echo.
    echo Access points:
    echo   - Main App: http://localhost
    echo   - Production Build: http://localhost:8080
    echo.
    echo Make sure backend (port 3000) and frontend (port 5173) are running!
    echo.
    echo Press any key to stop nginx...
    pause >nul
    
    echo Stopping nginx...
    %NGINX_CMD% -s stop
    echo Nginx stopped.
) else (
    echo ERROR: Failed to start nginx!
    echo Check the nginx error log for details.
)

pause
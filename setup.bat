@echo off
setlocal enabledelayedexpansion

REM IntelliFill Development Environment Setup Script (Windows)
REM This script automates the setup process for new developers

echo.
echo ========================================================
echo   IntelliFill Development Environment Setup
echo ========================================================
echo.

REM Parse command line arguments
set SKIP_DB=0
set SKIP_FRONTEND=0
set SKIP_BACKEND=0

:parse_args
if "%~1"=="" goto :done_args
if /i "%~1"=="--skip-db" set SKIP_DB=1
if /i "%~1"=="--skip-frontend" set SKIP_FRONTEND=1
if /i "%~1"=="--skip-backend" set SKIP_BACKEND=1
if /i "%~1"=="--help" goto :show_help
shift
goto :parse_args
:done_args

REM ==================== Prerequisites Check ====================
echo [Step 1/6] Checking prerequisites...
echo.

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo         Please install Node.js 18+ from https://nodejs.org
    exit /b 1
)
for /f "tokens=1" %%v in ('node -v') do set NODE_VERSION=%%v
echo   [OK] Node.js %NODE_VERSION%

REM Check npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed or not in PATH
    exit /b 1
)
for /f "tokens=1" %%v in ('npm -v') do set NPM_VERSION=%%v
echo   [OK] npm v%NPM_VERSION%

REM Check Bun (required for frontend)
where bun >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] Bun is not installed. Installing now...
    powershell -Command "irm bun.sh/install.ps1 | iex"
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install Bun
        echo         Please install manually from https://bun.sh
        exit /b 1
    )
    echo   [OK] Bun installed successfully
) else (
    for /f "tokens=1" %%v in ('bun -v') do set BUN_VERSION=%%v
    echo   [OK] Bun v%BUN_VERSION%
)

REM Check Git
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] Git is not installed. Some features may not work.
) else (
    for /f "tokens=3" %%v in ('git --version') do set GIT_VERSION=%%v
    echo   [OK] Git v%GIT_VERSION%
)

echo.

REM ==================== Install Root Dependencies ====================
echo [Step 2/6] Installing root dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install root dependencies
    exit /b 1
)
echo   [OK] Root dependencies installed
echo.

REM ==================== Install Backend Dependencies ====================
if %SKIP_BACKEND%==0 (
    echo [Step 3/6] Installing backend dependencies...
    cd quikadmin
    call npm ci
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install backend dependencies
        cd ..
        exit /b 1
    )
    cd ..
    echo   [OK] Backend dependencies installed
) else (
    echo [Step 3/6] Skipping backend dependencies (--skip-backend)
)
echo.

REM ==================== Install Frontend Dependencies ====================
if %SKIP_FRONTEND%==0 (
    echo [Step 4/6] Installing frontend dependencies...
    cd quikadmin-web
    call bun install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install frontend dependencies
        cd ..
        exit /b 1
    )
    cd ..
    echo   [OK] Frontend dependencies installed
) else (
    echo [Step 4/6] Skipping frontend dependencies (--skip-frontend)
)
echo.

REM ==================== Create Environment Files ====================
echo [Step 5/6] Setting up environment files...

REM Backend .env
if not exist "quikadmin\.env" (
    if exist "quikadmin\.env.example" (
        copy "quikadmin\.env.example" "quikadmin\.env" >nul
        echo   [OK] Created quikadmin\.env from example
        echo   [!]  Please edit quikadmin\.env with your credentials
    ) else (
        echo   [WARN] No .env.example found for backend
    )
) else (
    echo   [OK] quikadmin\.env already exists
)

REM Frontend .env
if not exist "quikadmin-web\.env" (
    if exist "quikadmin-web\.env.example" (
        copy "quikadmin-web\.env.example" "quikadmin-web\.env" >nul
        echo   [OK] Created quikadmin-web\.env from example
    ) else (
        REM Create default frontend .env
        (
            echo VITE_API_URL=http://localhost:3002/api
            echo VITE_USE_BACKEND_AUTH=true
        ) > "quikadmin-web\.env"
        echo   [OK] Created quikadmin-web\.env with defaults
    )
) else (
    echo   [OK] quikadmin-web\.env already exists
)

REM Docker .env
if not exist ".env.docker" (
    if exist ".env.docker.example" (
        copy ".env.docker.example" ".env.docker" >nul
        echo   [OK] Created .env.docker from example
        echo   [!]  Please edit .env.docker with your credentials before using Docker
    )
) else (
    echo   [OK] .env.docker already exists
)

echo.

REM ==================== Database Setup ====================
if %SKIP_DB%==0 (
    echo [Step 6/6] Setting up database...

    REM Check if DATABASE_URL is set in backend .env
    findstr /C:"DATABASE_URL" "quikadmin\.env" >nul 2>&1
    if %errorlevel% neq 0 (
        echo   [WARN] DATABASE_URL not found in quikadmin\.env
        echo         Skipping database setup. Please configure DATABASE_URL first.
    ) else (
        cd quikadmin
        echo   Running Prisma generate...
        call npx prisma generate
        if %errorlevel% neq 0 (
            echo   [WARN] Prisma generate failed
        ) else (
            echo   [OK] Prisma client generated
        )

        echo   Running database migrations...
        call npx prisma migrate deploy 2>nul
        if %errorlevel% neq 0 (
            echo   [WARN] Database migration failed (this is OK for first-time setup)
            echo         Run 'npx prisma migrate dev' manually when database is ready
        ) else (
            echo   [OK] Database migrations applied
        )
        cd ..
    )
) else (
    echo [Step 6/6] Skipping database setup (--skip-db)
)

echo.
echo ========================================================
echo   Setup Complete!
echo ========================================================
echo.
echo   Next steps:
echo.
echo   1. Edit environment files with your credentials:
echo      - quikadmin\.env (backend - DATABASE_URL, JWT secrets)
echo      - quikadmin-web\.env (frontend - usually no changes needed)
echo.
echo   2. Start development servers:
echo      - Run: start-dev.bat
echo      - Or manually:
echo        * Backend:  cd quikadmin ^&^& npm run dev
echo        * Frontend: cd quikadmin-web ^&^& bun run dev
echo.
echo   3. Access the application:
echo      - Frontend: http://localhost:8080
echo      - Backend:  http://localhost:3002
echo      - Prisma:   http://localhost:5555
echo.
echo ========================================================
echo.

exit /b 0

:show_help
echo.
echo Usage: setup.bat [options]
echo.
echo Options:
echo   --skip-db        Skip database setup (Prisma migrations)
echo   --skip-frontend  Skip frontend dependency installation
echo   --skip-backend   Skip backend dependency installation
echo   --help           Show this help message
echo.
echo Examples:
echo   setup.bat                    Full setup
echo   setup.bat --skip-db          Setup without database
echo   setup.bat --skip-frontend    Backend only setup
echo.
exit /b 0

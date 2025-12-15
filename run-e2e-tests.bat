@echo off
REM IntelliFill E2E Test Runner for Windows
REM
REM This script runs the complete E2E test suite in Docker containers.
REM It automatically cleans up after tests complete.

echo ========================================
echo IntelliFill E2E Test Suite
echo ========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [1/3] Starting test infrastructure...
echo.

REM Clean up any existing containers
docker-compose -f docker-compose.e2e.yml down -v >nul 2>&1

REM Start services and run tests
docker-compose -f docker-compose.e2e.yml up --build --abort-on-container-exit

REM Capture exit code
set TEST_EXIT_CODE=%errorlevel%

echo.
echo [2/3] Tests completed. Cleaning up...
echo.

REM Clean up containers
docker-compose -f docker-compose.e2e.yml down -v

echo.
echo [3/3] Cleanup complete.
echo.

REM Report results
if %TEST_EXIT_CODE% equ 0 (
    echo ========================================
    echo SUCCESS: All tests passed!
    echo ========================================
    echo.
    echo Test artifacts saved to:
    echo   - e2e\playwright-report\
    echo   - e2e\test-results\
    echo.
    echo To view the HTML report, run:
    echo   cd e2e
    echo   npm run report
) else (
    echo ========================================
    echo FAILURE: Some tests failed!
    echo ========================================
    echo.
    echo Check the logs above for details.
    echo.
    echo Test artifacts saved to:
    echo   - e2e\playwright-report\
    echo   - e2e\screenshots\
    echo   - e2e\videos\
    echo.
    echo To view the HTML report, run:
    echo   cd e2e
    echo   npm run report
)

echo.
pause
exit /b %TEST_EXIT_CODE%

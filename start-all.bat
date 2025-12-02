@echo off
cd /d "%~dp0"
echo =====================================================
echo IntelliFill - Starting All Services
echo =====================================================
echo.
echo Services:
echo   - PostgreSQL (port 5432)
echo   - Redis (port 6379)
echo   - Backend API (port 3002)
echo   - Frontend UI (port 8080)
echo.
echo Press Ctrl+C to stop all services
echo =====================================================
echo.

docker-compose up --build

echo.
echo Services stopped.
pause

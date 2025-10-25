@echo off
REM QuikAdmin - Stop All Services

echo Stopping all QuikAdmin services...

REM Stop nginx
where nginx >nul 2>nul
if %errorlevel% equ 0 (
    nginx -s stop >nul 2>nul
) else (
    if exist "C:\nginx\nginx.exe" (
        C:\nginx\nginx.exe -s stop >nul 2>nul
    )
)

REM Stop Node/Bun processes
taskkill /IM node.exe /F >nul 2>nul
taskkill /IM bun.exe /F >nul 2>nul
taskkill /IM ts-node.exe /F >nul 2>nul

echo All services stopped.
pause
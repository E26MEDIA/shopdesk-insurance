@echo off
title E26 Insurance Admin - Setup Check
echo.
echo ============================================
echo   E26 Insurance Admin - Windows Setup
echo ============================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [X] Node.js is NOT installed on this PC.
    echo.
    echo I cannot install it automatically from the cloud.
    echo YOU need to do this once ^(takes 2 minutes^):
    echo.
    echo   1. Open: https://nodejs.org
    echo   2. Download the green LTS button
    echo   3. Run installer - click Next, Next, Finish
    echo   4. RESTART Command Prompt
    echo   5. Run this file again
    echo.
    start https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Node.js installed:
node -v
npm -v
echo.

if not exist "%~dp0admin\.env" (
    echo [X] Missing admin\.env file
    echo     Copy admin\.env.example to admin\.env and add your Neon DATABASE_URL
    pause
    exit /b 1
)

echo [OK] admin\.env found
echo.
echo Starting admin panel at http://localhost:3001
echo Keep this window OPEN. Press Ctrl+C to stop.
echo.
echo Login: admin@e26media.com / ChangeMeNow!123
echo.
cd /d "%~dp0admin"
call npm install
call npm run dev
pause

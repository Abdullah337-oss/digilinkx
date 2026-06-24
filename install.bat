@echo off
REM Todo App Quick Start Script for Windows
setlocal
cd /d "%~dp0"
set "NPM_CMD=npm.cmd"

echo.
echo ========================================
echo   Todo App - Setup and Installation
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed.
    echo Please install Node.js 20 LTS from https://nodejs.org/
    pause
    exit /b 1
)

for /f %%i in ('node -p "process.versions.node.split(''.'')[0]"') do set "NODE_MAJOR=%%i"
if %NODE_MAJOR% geq 21 (
    echo WARNING: This project is most reliable on Node.js 18 or 20.
    echo Detected Node.js %NODE_MAJOR%.x, which can fail while installing sqlite3 on some systems.
    echo If installation fails, install Node.js 20 LTS and run this file again.
    echo.
)

echo [OK] Node.js is installed
echo.

REM Install server dependencies
echo Installing server dependencies...
cd /d "%~dp0server"
call "%NPM_CMD%" install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install server dependencies.
    echo.
    echo Common fixes:
    echo 1. Use Node.js 20 LTS instead of Node.js %NODE_MAJOR%.x
    echo 2. Make sure this PC has internet access
    echo 3. Re-run this file from a normal Command Prompt
    pause
    exit /b 1
)
echo [OK] Server dependencies installed
echo.

REM Seed database
echo Seeding database with demo accounts...
call node seed.js
if %errorlevel% neq 0 (
    echo WARNING: Database seeding might have issues
)
echo [OK] Database seeded
echo.

REM Install client dependencies
echo Installing client dependencies...
cd /d "%~dp0client"
call "%NPM_CMD%" install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install client dependencies.
    echo.
    echo Common fixes:
    echo 1. Make sure this PC has internet access
    echo 2. Re-run this file from a normal Command Prompt
    pause
    exit /b 1
)
echo [OK] Client dependencies installed
echo.

cd /d "%~dp0"

echo ========================================
echo   Installation Complete!
echo ========================================
echo.
echo To start the application:
echo.
echo Option 1 (Two terminal windows):
echo   Terminal 1: cd server ^&^& npm start
echo   Terminal 2: cd client ^&^& npm start
echo.
echo Option 2 (Batch file):
echo   start.bat
echo.
echo Demo Accounts:
echo   Admin: admin / admin123
echo   User1: user1 / user123
echo   User2: user2 / user123
echo   User3: user3 / user123
echo   User4: user4 / user123
echo.
echo Server URL: http://localhost:5000
echo Client URL: http://localhost:3000
echo.
pause

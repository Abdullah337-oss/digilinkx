@echo off
REM Start Todo App - Windows Batch Script
setlocal
cd /d "%~dp0"

echo.
echo ========================================
echo   Starting Todo App...
echo ========================================
echo.

REM Start backend server
echo Starting backend server on http://localhost:5000
start "Todo App Backend" cmd /k "cd /d ""%~dp0server"" && call npm.cmd start"

REM Wait a bit for server to start
timeout /t 3 /nobreak

REM Start frontend
echo Starting frontend on http://localhost:3000
start "Todo App Frontend" cmd /k "cd /d ""%~dp0client"" && call npm.cmd start"

echo.
echo ========================================
echo   Todo App is starting
echo ========================================
echo.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Press Ctrl+C in each window to stop the server.
echo.

@echo off
echo ========================================
echo   Q1KEY Platform Frontend Server
echo ========================================
echo.
echo Starting web server on http://localhost:8081
echo.
echo The browser will open automatically...
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Using Python HTTP Server...
    REM Open browser immediately in a separate window
    start "" http://localhost:8081/
    python -m http.server 8081
) else (
    echo Python not found. Please install Python or use another method.
    echo.
    echo Alternative: Install http-server with Node.js
    echo   npm install -g http-server
    echo   http-server -p 8081 -o
    pause
)

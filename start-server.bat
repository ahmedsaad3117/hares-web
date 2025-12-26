@echo off
echo ========================================
echo   Hares Platform Frontend Server
echo ========================================
echo.
echo Starting web server on http://localhost:8080
echo.
echo Access the application at:
echo   http://localhost:8080/web/
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Using Python HTTP Server...
    python -m http.server 8080
) else (
    echo Python not found. Please install Python or use another method.
    echo.
    echo Alternative: Install http-server with Node.js
    echo   npm install -g http-server
    echo   http-server -p 8080
    pause
)

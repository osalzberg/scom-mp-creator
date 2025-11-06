@echo off
echo ====================================
echo SCOM MP Creator - Starting Server
echo ====================================
echo.
echo Starting local web server on port 8080...
echo.
echo Once started, open your browser and go to:
echo http://localhost:8080
echo.
echo Press Ctrl+C to stop the server
echo.
echo ====================================
echo.

python -m http.server 8080

pause

# SCOM MP Creator - PowerShell Launcher
# Run this script to start the local web server

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "SCOM MP Creator - Starting Server" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting local web server on port 8080..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Once started, open your browser and go to:" -ForegroundColor Green
Write-Host "http://localhost:8080" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Try Python 3 first, then Python 2
$python = Get-Command python -ErrorAction SilentlyContinue
if ($python) {
    python -m http.server 8080
} else {
    Write-Host "Python not found. Please install Python or open index.html directly." -ForegroundColor Red
    pause
}

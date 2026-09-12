@echo off
title GalleryZone Frontend-Web Dev Server (port 3000)
cd /d D:\ArtGllery\GalleryZone\frontend-web

if not exist node_modules (
    echo Dependencies not installed yet - running npm install...
    echo This only happens once and may take a few minutes.
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo npm install failed. Fix the error above, then run this again.
        pause
        exit /b 1
    )
    echo.
)

set EXISTING_PID=
for /f "tokens=5" %%P in ('netstat -aon ^| findstr "LISTENING" ^| findstr ":3000 "') do set EXISTING_PID=%%P

if defined EXISTING_PID (
    echo Port 3000 is already in use by process %EXISTING_PID%.
    echo That's usually this same dev server, left running from an earlier session.
    echo.
    choice /c YN /m "Stop it and start a fresh server"
    if errorlevel 2 (
        echo.
        echo Leaving the existing server running - opening your browser to it.
        start "" http://localhost:3000
        goto :end
    )
    echo Stopping process %EXISTING_PID% ...
    taskkill /PID %EXISTING_PID% /F >nul 2>&1
    timeout /t 1 /nobreak >nul
    echo Done. Starting fresh.
    echo.
)

echo Starting GalleryZone frontend-web dev server...
echo (this window must stay open - closing it stops the server)
echo.
echo App will be available at: http://localhost:3000
echo.
echo Pages to visit:
echo   Login:       http://localhost:3000/login
echo   Register:    http://localhost:3000/register
echo   Dashboard:   http://localhost:3000/dashboard
echo   Artworks:    http://localhost:3000/dashboard/artworks
echo   Marketplace: http://localhost:3000/marketplace
echo.

rem Open the browser a few seconds after launch, once the server is actually
rem up, instead of racing it and landing on a "can't connect" page.
start "" cmd /c "timeout /t 4 /nobreak >nul && start "" http://localhost:3000"

call npm run dev -- -p 3000

:end
echo.
echo Server stopped.
pause

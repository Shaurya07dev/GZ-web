@echo off
title GalleryZone Frontend-Web Dev Server (port 3000)
echo Starting GalleryZone frontend-web dev server...
echo (this window must stay open - closing it stops the server)
echo.
echo App will be available at: http://localhost:3000
echo.
echo Pages to visit:
echo   Login:     http://localhost:3000/login
echo   Register:  http://localhost:3000/register
echo   Dashboard: http://localhost:3000/dashboard
echo   Artworks:  http://localhost:3000/dashboard/artworks
echo   Marketplace: http://localhost:3000/marketplace
echo.

cd /d D:\ArtGllery\GalleryZone\frontend-web
npm run dev -- -p 3000

echo.
echo Server stopped.
pause

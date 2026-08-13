@echo off
title GalleryZone Dev Server
echo Starting GalleryZone dev server...
echo (this window must stay open - closing it stops the server)
echo.

wsl -d Ubuntu -- bash -ic "cd /home/yashm/GalleryZone/frontend-web && npm run dev"

echo.
echo Server stopped.
pause

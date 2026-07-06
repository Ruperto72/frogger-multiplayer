@echo off
cd /d "%~dp0"
start "Frog vs Toad - backend (port 3000)" cmd /k "cd backend && node server.js"
start "Frog vs Toad - frontend (port 8080)" cmd /k "node dev-server.js"
timeout /t 1 >nul
start "" http://localhost:8080

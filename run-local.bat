@echo off
title ApexLead AI Launcher
echo ========================================================
echo   Starting ApexLead AI Studio (Local + Mobile Access)
echo ========================================================
echo.

set "PATH=C:\Program Files\nodejs;%PATH%"

:: 1. Install / Verify Backend & Launch in dedicated terminal window
echo [1/2] Starting Python Backend on http://0.0.0.0:8005 ...
start "ApexLead Backend (Port 8005)" cmd /k "cd /d %~dp0backend && pip install -r requirements.txt && python -m uvicorn main:app --host 0.0.0.0 --port 8005 --reload"

:: 2. Launch Frontend with host 0.0.0.0 enabled
echo [2/2] Starting Frontend Vite Server on http://0.0.0.0:5173 ...
echo.
echo ========================================================
echo   Desktop URL: http://localhost:5173
echo   Mobile  URL: http://192.168.100.252:5173
echo ========================================================
echo.
cd /d "%~dp0frontend"
npm.cmd run dev -- --host 0.0.0.0

pause

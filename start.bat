@echo off
echo Starting Web Scraper Suite...

:: Check Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not installed. Please install Docker Desktop from https://docker.com
    pause
    exit /b 1
)

:: Check Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b 1
)

:: Start containers
docker compose up -d --build

echo.
echo SUCCESS! Web Scraper Suite is running!
echo.
echo Open your browser and go to: http://localhost:3005
echo.
echo To stop: run stop.bat
pause

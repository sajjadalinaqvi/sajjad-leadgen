#!/bin/bash
echo "🕷  Starting Web Scraper Suite..."

# Check Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop from https://docker.com"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Start containers
docker compose up -d --build

echo ""
echo "✅ Web Scraper Suite is running!"
echo "👉 Open your browser and go to: http://localhost:3005"
echo ""
echo "To stop: run ./stop.sh"

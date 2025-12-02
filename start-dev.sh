#!/bin/bash

# IntelliFill Development Servers Startup Script
# This script starts all required development servers in parallel

echo "🚀 Starting IntelliFill Development Environment..."
echo ""

# Function to check if a port is in use
check_port() {
    netstat -ano | grep ":$1 " > /dev/null 2>&1
}

# Kill any existing processes on our ports
echo "📋 Checking for existing processes..."
if check_port 3002; then
    echo "⚠️  Port 3002 is in use. Killing existing backend process..."
    PID=$(netstat -ano | grep ":3002 " | awk '{print $5}' | head -1)
    taskkill //F //PID $PID 2>/dev/null
fi

if check_port 8080; then
    echo "⚠️  Port 8080 is in use. Killing existing frontend process..."
    PID=$(netstat -ano | grep ":8080 " | awk '{print $5}' | head -1)
    taskkill //F //PID $PID 2>/dev/null
fi

if check_port 5555; then
    echo "⚠️  Port 5555 is in use. Killing existing Prisma Studio process..."
    PID=$(netstat -ano | grep ":5555 " | awk '{print $5}' | head -1)
    taskkill //F //PID $PID 2>/dev/null
fi

echo ""
echo "✅ Ports cleared. Starting servers..."
echo ""

# Start Backend Server (port 3002)
echo "🔧 Starting Backend API Server (port 3002)..."
cd quikadmin
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to initialize
sleep 3

# Start Frontend Server (port 8080)
echo "🎨 Starting Frontend UI Server (port 8080)..."
cd quikadmin-web
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Start Prisma Studio (port 5555)
echo "🗄️  Starting Prisma Studio (port 5555)..."
cd quikadmin
npx prisma studio > ../logs/prisma.log 2>&1 &
PRISMA_PID=$!
cd ..

echo ""
echo "⏳ Waiting for servers to start..."
sleep 5

echo ""
echo "✅ All servers started!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Server Status:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔧 Backend API:       http://localhost:3002"
echo "  📚 API Docs:          http://localhost:3002/api-docs"
echo "  ❤️  Health Check:      http://localhost:3002/health"
echo ""
echo "  🎨 Frontend UI:       http://localhost:8080"
echo ""
echo "  🗄️  Prisma Studio:     http://localhost:5555"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Logs are saved to:"
echo "  - logs/backend.log"
echo "  - logs/frontend.log"
echo "  - logs/prisma.log"
echo ""
echo "⚠️  Press Ctrl+C to stop all servers"
echo ""

# Wait for Ctrl+C
trap "echo ''; echo '🛑 Stopping all servers...'; kill $BACKEND_PID $FRONTEND_PID $PRISMA_PID 2>/dev/null; echo '✅ All servers stopped.'; exit 0" SIGINT SIGTERM

# Keep script running
wait

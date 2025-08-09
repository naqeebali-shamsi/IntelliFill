#!/bin/bash

# Script to start development environment with hot reloading

echo "🚀 Starting IntelliFill Development Environment with Hot Reloading"
echo "=================================================="

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
    echo "❌ Docker or Docker Compose is not installed"
    exit 1
fi

# Use docker compose or docker-compose based on what's available
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Stop any existing containers
echo "🛑 Stopping existing containers..."
$DOCKER_COMPOSE -f docker-compose.dev.yml down

# Build fresh images
echo "🔨 Building development images..."
$DOCKER_COMPOSE -f docker-compose.dev.yml build

# Start services
echo "🎯 Starting services with hot reloading..."
$DOCKER_COMPOSE -f docker-compose.dev.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check service health
echo "🔍 Checking service status..."
$DOCKER_COMPOSE -f docker-compose.dev.yml ps

echo ""
echo "✅ Development environment is ready!"
echo "=================================================="
echo "📱 Frontend:    http://localhost:3001"
echo "🔧 Backend API: http://localhost:3000"
echo "📊 Database:    postgresql://localhost:5432/intellifill"
echo "💾 Redis:       redis://localhost:6379"
echo "🐛 Debug Port:  localhost:9229"
echo ""
echo "📝 Available commands:"
echo "  - View logs:        $DOCKER_COMPOSE -f docker-compose.dev.yml logs -f app"
echo "  - Restart backend:  $DOCKER_COMPOSE -f docker-compose.dev.yml restart app"
echo "  - Stop all:         $DOCKER_COMPOSE -f docker-compose.dev.yml down"
echo "  - Run tests:        $DOCKER_COMPOSE -f docker-compose.dev.yml exec app npm test"
echo ""
echo "🔥 Hot reloading is enabled! Your changes will automatically restart the server."
echo "=================================================="

# Optional: Follow logs
read -p "Would you like to follow the application logs? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    $DOCKER_COMPOSE -f docker-compose.dev.yml logs -f app
fi
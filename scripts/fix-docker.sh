#!/bin/bash

echo "🔧 Fixing Docker container dependencies..."

# Install missing packages in the running container
docker exec intellifill-app-1 npm install cors cookie-parser @types/cors @types/cookie-parser jsonwebtoken bcrypt @types/jsonwebtoken @types/bcrypt

echo "✅ Dependencies installed"

# Restart the container
docker-compose restart app

echo "⏳ Waiting for app to start..."
sleep 10

# Test health endpoint
echo "🧪 Testing health endpoint..."
curl -s http://localhost:3000/api/health

echo ""
echo "✨ Done!"
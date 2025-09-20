#!/bin/bash
set -e

# Simple deployment script for QuikAdmin/IntelliFill
# Usage: ./scripts/deploy.sh [staging|production]

ENVIRONMENT=${1:-staging}
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/backups/$TIMESTAMP"

echo "🚀 Deploying to $ENVIRONMENT environment"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command succeeded
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1${NC}"
    else
        echo -e "${RED}✗ $1 failed${NC}"
        exit 1
    fi
}

# 1. Health check before deployment
echo "Checking current system health..."
curl -f http://localhost:3002/api/health > /dev/null 2>&1 || echo "Warning: Current system not healthy"

# 2. Pull latest changes
echo "Pulling latest changes..."
git pull origin main
check_status "Git pull"

# 3. Backup current deployment
echo "Creating backup..."
mkdir -p $BACKUP_DIR
docker-compose ps > "$BACKUP_DIR/running-containers.txt"
docker image ls > "$BACKUP_DIR/current-images.txt"
check_status "Backup created"

# 4. Build new images
echo "Building Docker images..."
docker-compose build --no-cache
check_status "Docker build"

# 5. Run database migrations
echo "Running database migrations..."
docker-compose run --rm app npx prisma migrate deploy
check_status "Database migrations"

# 6. Deploy with zero downtime
echo "Starting new containers..."
docker-compose up -d --no-deps --scale app=2 app
check_status "New containers started"

# 7. Wait for health check
echo "Waiting for health check..."
sleep 10
for i in {1..30}; do
    if curl -f http://localhost:3002/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Health check passed${NC}"
        break
    fi
    echo "Waiting for health check... ($i/30)"
    sleep 2
done

# 8. Remove old containers
echo "Removing old containers..."
docker-compose up -d --no-deps --remove-orphans
check_status "Old containers removed"

# 9. Clean up
echo "Cleaning up..."
docker system prune -f
check_status "Cleanup"

# 10. Final verification
echo "Verifying deployment..."
HEALTH_RESPONSE=$(curl -s http://localhost:3002/api/health)
echo "Health check response: $HEALTH_RESPONSE"

echo -e "${GREEN}🎉 Deployment to $ENVIRONMENT completed successfully!${NC}"
echo "Deployment timestamp: $TIMESTAMP"
echo "Backup location: $BACKUP_DIR"

# Log deployment
echo "$TIMESTAMP - Deployed to $ENVIRONMENT by $(whoami)" >> /var/log/deployments.log
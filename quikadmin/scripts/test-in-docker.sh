#!/bin/bash
# Pristine Docker Test Environment Runner
# Ensures complete isolation from development environment

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🐳 QuikAdmin Isolated Test Environment${NC}"
echo "========================================="
echo ""

# Function to cleanup
cleanup() {
    echo -e "\n${YELLOW}Cleaning up test environment...${NC}"
    docker-compose -f docker-compose.test-isolated.yml down -v --remove-orphans 2>/dev/null || true
    docker network rm quikadmin-test-network 2>/dev/null || true
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Trap to ensure cleanup on exit
trap cleanup EXIT INT TERM

# Step 1: Clean previous test artifacts
echo -e "${YELLOW}Step 1: Cleaning previous test artifacts...${NC}"
cleanup

# Step 2: Build test image
echo -e "\n${YELLOW}Step 2: Building test image...${NC}"
docker-compose -f docker-compose.test-isolated.yml build test-app

# Step 3: Start test infrastructure
echo -e "\n${YELLOW}Step 3: Starting test infrastructure...${NC}"
docker-compose -f docker-compose.test-isolated.yml up -d test-db test-redis

# Step 4: Wait for services
echo -e "\n${YELLOW}Step 4: Waiting for services to be healthy...${NC}"
TIMEOUT=30
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    if docker-compose -f docker-compose.test-isolated.yml ps test-db | grep -q "healthy" && \
       docker-compose -f docker-compose.test-isolated.yml ps test-redis | grep -q "healthy"; then
        echo -e "${GREEN}✅ Services are healthy${NC}"
        break
    fi
    echo -n "."
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo -e "\n${RED}❌ Services failed to become healthy${NC}"
    exit 1
fi

# Step 5: Start test application
echo -e "\n${YELLOW}Step 5: Starting test application...${NC}"
docker-compose -f docker-compose.test-isolated.yml up -d test-app

# Wait for app to be healthy
echo -e "${YELLOW}Waiting for application to be ready...${NC}"
TIMEOUT=30
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    if docker exec quikadmin-test-app curl -s http://localhost:3002/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Application is ready${NC}"
        break
    fi
    echo -n "."
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo -e "\n${RED}❌ Application failed to start${NC}"
    docker logs quikadmin-test-app --tail 50
    exit 1
fi

# Step 6: Run tests
echo -e "\n${YELLOW}Step 6: Running tests in isolated container...${NC}"
echo "========================================="

# Run the test suite
docker run --rm \
    --network quikadmin-test-network \
    -v $(pwd)/tests:/tests:ro \
    -v $(pwd)/test-results:/results \
    -e API_URL=http://quikadmin-test-app:3002 \
    -e NODE_ENV=test \
    node:18-alpine \
    sh -c "
        cd /tests
        echo 'Installing test dependencies...'
        npm init -y > /dev/null 2>&1
        npm install --silent axios supertest jest
        echo ''
        echo 'Running integration tests...'
        node docker-test.js
    "

TEST_RESULT=$?

# Step 7: Collect logs if tests failed
if [ $TEST_RESULT -ne 0 ]; then
    echo -e "\n${YELLOW}Collecting debug information...${NC}"
    echo "Application logs:"
    docker logs quikadmin-test-app --tail 20
fi

# Step 8: Summary
echo ""
echo "========================================="
if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed successfully!${NC}"
else
    echo -e "${RED}❌ Some tests failed. Check logs above.${NC}"
fi

exit $TEST_RESULT
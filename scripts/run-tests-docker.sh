#!/bin/bash
# Docker-based test runner for QuikAdmin
# All tests run in isolated Docker containers

set -e

echo "🐳 QuikAdmin Docker Test Suite"
echo "=============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test suite
run_test_suite() {
    local suite_name=$1
    local docker_cmd=$2
    
    echo -e "${YELLOW}Running: $suite_name${NC}"
    echo "----------------------------------------"
    
    if eval $docker_cmd; then
        echo -e "${GREEN}✅ $suite_name: PASSED${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}❌ $suite_name: FAILED${NC}"
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
    echo ""
}

# Clean up any existing test containers
echo "Cleaning up previous test containers..."
docker-compose -f docker-compose.test.yml down -v 2>/dev/null || true

# Start test infrastructure
echo "Starting test infrastructure..."
docker-compose -f docker-compose.test.yml up -d postgres-test redis-test

# Wait for services to be ready
echo "Waiting for services..."
sleep 5

# Run Security Tests
run_test_suite "Security Tests - Rate Limiting" \
    "docker run --rm \
    --network quikadmin_test-network \
    -v \$(pwd)/src:/app/src:ro \
    -v \$(pwd)/tests:/app/tests:ro \
    -e NODE_ENV=test \
    -e REDIS_URL=redis://redis-test:6379 \
    node:18-alpine \
    sh -c 'cd /app && npm install --quiet && npm run test -- tests/security/rate-limit.test.ts'"

run_test_suite "Security Tests - CSRF Protection" \
    "docker run --rm \
    --network quikadmin_test-network \
    -v \$(pwd)/src:/app/src:ro \
    -v \$(pwd)/tests:/app/tests:ro \
    -e NODE_ENV=test \
    node:18-alpine \
    sh -c 'cd /app && npm install --quiet && npm run test -- tests/security/csrf.test.ts'"

# Run Integration Tests
run_test_suite "Integration Tests - Job Queue" \
    "docker run --rm \
    --network quikadmin_test-network \
    -v \$(pwd)/src:/app/src:ro \
    -v \$(pwd)/tests:/app/tests:ro \
    -e NODE_ENV=test \
    -e REDIS_URL=redis://redis-test:6379 \
    -e DATABASE_URL=postgresql://test_user:test_pass@postgres-test:5432/intellifill_test \
    node:18-alpine \
    sh -c 'cd /app && npm install --quiet && npm run test -- tests/integration/queue.test.ts'"

# Run Unit Tests
run_test_suite "Unit Tests - Validation Schemas" \
    "docker run --rm \
    -v \$(pwd)/src:/app/src:ro \
    -v \$(pwd)/tests:/app/tests:ro \
    -e NODE_ENV=test \
    node:18-alpine \
    sh -c 'cd /app && npm install --quiet && npm run test -- tests/unit/schemas.test.ts'"

run_test_suite "Unit Tests - DTOs" \
    "docker run --rm \
    -v \$(pwd)/src:/app/src:ro \
    -v \$(pwd)/tests:/app/tests:ro \
    -e NODE_ENV=test \
    node:18-alpine \
    sh -c 'cd /app && npm install --quiet && npm run test -- tests/unit/dto.test.ts'"

# Generate coverage report
echo -e "${YELLOW}Generating coverage report...${NC}"
docker run --rm \
    -v $(pwd)/src:/app/src:ro \
    -v $(pwd)/tests:/app/tests:ro \
    -v $(pwd)/coverage:/app/coverage \
    -e NODE_ENV=test \
    node:18-alpine \
    sh -c 'cd /app && npm install --quiet && npm run test -- --coverage --coverageDirectory=/app/coverage' || true

# Clean up test containers
echo "Cleaning up test containers..."
docker-compose -f docker-compose.test.yml down -v

# Summary
echo ""
echo "=============================="
echo "🎯 Test Summary"
echo "=============================="
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed!${NC}"
    exit 1
fi
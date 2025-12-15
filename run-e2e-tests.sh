#!/bin/bash
# IntelliFill E2E Test Runner for Linux/Mac
#
# This script runs the complete E2E test suite in Docker containers.
# It automatically cleans up after tests complete.

set -e

echo "========================================"
echo "IntelliFill E2E Test Suite"
echo "========================================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running!"
    echo "Please start Docker and try again."
    exit 1
fi

echo "[1/3] Starting test infrastructure..."
echo ""

# Clean up any existing containers
docker-compose -f docker-compose.e2e.yml down -v > /dev/null 2>&1 || true

# Start services and run tests
docker-compose -f docker-compose.e2e.yml up --build --abort-on-container-exit

# Capture exit code
TEST_EXIT_CODE=$?

echo ""
echo "[2/3] Tests completed. Cleaning up..."
echo ""

# Clean up containers
docker-compose -f docker-compose.e2e.yml down -v

echo ""
echo "[3/3] Cleanup complete."
echo ""

# Report results
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "========================================"
    echo "SUCCESS: All tests passed!"
    echo "========================================"
    echo ""
    echo "Test artifacts saved to:"
    echo "  - e2e/playwright-report/"
    echo "  - e2e/test-results/"
    echo ""
    echo "To view the HTML report, run:"
    echo "  cd e2e"
    echo "  npm run report"
else
    echo "========================================"
    echo "FAILURE: Some tests failed!"
    echo "========================================"
    echo ""
    echo "Check the logs above for details."
    echo ""
    echo "Test artifacts saved to:"
    echo "  - e2e/playwright-report/"
    echo "  - e2e/screenshots/"
    echo "  - e2e/videos/"
    echo ""
    echo "To view the HTML report, run:"
    echo "  cd e2e"
    echo "  npm run report"
fi

echo ""
exit $TEST_EXIT_CODE

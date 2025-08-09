#!/bin/bash

# Docker Build Script with Optimizations
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="intellifill"
REGISTRY="${DOCKER_REGISTRY:-}"
TAG="${1:-latest}"
BUILD_CONTEXT="."
CACHE_DIR="${HOME}/.docker/buildx-cache"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
fi

# Create cache directory if it doesn't exist
mkdir -p "${CACHE_DIR}"

# Enable BuildKit
export DOCKER_BUILDKIT=1

# Function to build with caching
build_image() {
    local dockerfile=$1
    local image_name=$2
    local context=${3:-.}
    
    print_status "Building ${image_name} from ${dockerfile}..."
    
    docker buildx build \
        --file "${dockerfile}" \
        --tag "${image_name}:${TAG}" \
        --tag "${image_name}:latest" \
        --cache-from "type=local,src=${CACHE_DIR}" \
        --cache-to "type=local,dest=${CACHE_DIR},mode=max" \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --progress=plain \
        --load \
        "${context}"
    
    if [ $? -eq 0 ]; then
        print_status "Successfully built ${image_name}:${TAG}"
    else
        print_error "Failed to build ${image_name}"
        exit 1
    fi
}

# Create builder if it doesn't exist
if ! docker buildx ls | grep -q "${PROJECT_NAME}-builder"; then
    print_status "Creating buildx builder..."
    docker buildx create --name "${PROJECT_NAME}-builder" --use
fi

# Build main application
print_status "Building main application..."
build_image "Dockerfile.production" "${PROJECT_NAME}"

# Build web application
print_status "Building web application..."
build_image "web/Dockerfile.optimized" "${PROJECT_NAME}-web" "web"

# Prune old images
print_status "Cleaning up old images..."
docker image prune -f --filter "label=maintainer=IntelliFill Team" --filter "until=24h"

# Show image sizes
print_status "Built images:"
docker images | grep "${PROJECT_NAME}"

# Run security scan if trivy is available
if command -v trivy &> /dev/null; then
    print_status "Running security scan..."
    trivy image --severity HIGH,CRITICAL "${PROJECT_NAME}:${TAG}"
else
    print_warning "Trivy not installed, skipping security scan"
fi

# Tag for registry if specified
if [ -n "${REGISTRY}" ]; then
    print_status "Tagging for registry ${REGISTRY}..."
    docker tag "${PROJECT_NAME}:${TAG}" "${REGISTRY}/${PROJECT_NAME}:${TAG}"
    docker tag "${PROJECT_NAME}-web:${TAG}" "${REGISTRY}/${PROJECT_NAME}-web:${TAG}"
    
    # Push to registry if requested
    if [ "${PUSH:-false}" = "true" ]; then
        print_status "Pushing to registry..."
        docker push "${REGISTRY}/${PROJECT_NAME}:${TAG}"
        docker push "${REGISTRY}/${PROJECT_NAME}-web:${TAG}"
    fi
fi

print_status "Build complete!"
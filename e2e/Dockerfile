# syntax=docker/dockerfile:1.4
# Playwright E2E Test Runner
# Optimized for fast builds with browser caching

FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# Copy package files first for dependency caching
COPY package.json package-lock.json* ./

# Install dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --ignore-scripts

# Copy TypeScript and Playwright configuration
COPY tsconfig.json playwright.config.ts ./

# Create directories for test artifacts
RUN mkdir -p \
    tests \
    fixtures \
    utils \
    test-results \
    playwright-report \
    screenshots \
    videos \
    traces

# Copy test files (will be mounted as volumes in docker-compose for hot reload)
COPY tests ./tests
COPY fixtures ./fixtures
COPY utils ./utils

# Playwright browsers are pre-installed in base image
# Only run this if you need to update browsers
# RUN npx playwright install --with-deps

# Set environment variables
ENV CI=true
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD node --version && npx playwright --version || exit 1

# Default command (override in docker-compose)
CMD ["npx", "playwright", "test", "--reporter=list,html"]

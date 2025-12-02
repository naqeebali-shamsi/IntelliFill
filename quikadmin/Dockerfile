# Optimized Multi-stage Dockerfile with advanced caching and security
ARG NODE_VERSION=20.11.0
ARG ALPINE_VERSION=3.19

# ============================================
# Stage 1: Dependencies (cached layer)
# ============================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS dependencies

# Install build dependencies without strict versions
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy only package files for better cache utilization
COPY package*.json ./

# Install dependencies with cache mount for npm
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production --no-audit --no-fund \
    && cp -R node_modules /prod_node_modules \
    && npm ci --no-audit --no-fund

# ============================================
# Stage 2: Builder (compile TypeScript)
# ============================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS builder

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json tsconfig.json ./

# Copy source code and prisma schema
COPY src ./src
COPY prisma ./prisma

# Build application with parallel compilation
RUN npm run build

# ============================================
# Stage 3: Production runtime
# ============================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runtime

# Add metadata labels
LABEL maintainer="IntelliFill Team"
LABEL version="1.0.0"
LABEL description="IntelliFill Document Processing Platform"

# Install runtime dependencies without strict versions
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    tesseract-ocr-data-spa \
    tesseract-ocr-data-fra \
    tesseract-ocr-data-deu \
    poppler-utils \
    ghostscript \
    imagemagick \
    cairo \
    pango \
    jpeg \
    giflib \
    librsvg \
    python3 \
    py3-pip \
    py3-pillow \
    py3-numpy \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Install Python dependencies with specific versions
RUN pip3 install --no-cache-dir --break-system-packages \
    pypdf==3.17.* \
    pytesseract==0.3.*

# Create non-root user and group
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

# Copy production dependencies
COPY --from=dependencies --chown=nodejs:nodejs /prod_node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy necessary files
COPY --chown=nodejs:nodejs package*.json ./
COPY --chown=nodejs:nodejs prisma ./prisma

# Create necessary directories with proper permissions
RUN mkdir -p uploads outputs logs models data \
    && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Environment variables with defaults
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=2048"

# Health check with proper timing
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${PORT}/api/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})" || exit 1

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]
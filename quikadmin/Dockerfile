# Optimized Multi-stage Dockerfile with pnpm
ARG NODE_VERSION=20.11.0
ARG ALPINE_VERSION=3.19

# ============================================
# Stage 1: Dependencies (cached layer)
# ============================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS dependencies

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    && rm -rf /var/cache/apk/*

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json ./

# Install production dependencies only (no lockfile in subdirectory)
RUN pnpm install --prod

# ============================================
# Stage 2: Builder (compile TypeScript)
# ============================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS builder

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json tsconfig.json tsconfig.build.json ./

# Install ALL dependencies including devDependencies
RUN pnpm install

# Copy source code and prisma schema
COPY src ./src
COPY prisma ./prisma

# Generate Prisma client and build
RUN npx prisma generate && pnpm run build

# ============================================
# Stage 3: Production runtime
# ============================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runtime

# Add metadata labels
LABEL maintainer="IntelliFill Team"
LABEL version="1.0.0"
LABEL description="IntelliFill Document Processing Platform"

# Install runtime dependencies
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

# Install Python dependencies
RUN pip3 install --no-cache-dir --break-system-packages \
    pypdf==3.17.* \
    pytesseract==0.3.*

# Create non-root user
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

# Copy production dependencies from dependencies stage
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Copy necessary files
COPY --chown=nodejs:nodejs package.json ./
COPY --chown=nodejs:nodejs prisma ./prisma

# Create necessary directories
RUN mkdir -p uploads outputs logs models data \
    && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Environment variables
ENV NODE_ENV=production \
    PORT=3002 \
    NODE_OPTIONS="--max-old-space-size=2048"

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${PORT}/api/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})" || exit 1

# Expose port
EXPOSE 3002

# Use dumb-init for signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]

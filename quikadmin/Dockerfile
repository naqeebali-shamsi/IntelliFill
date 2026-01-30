# Optimized Multi-stage Dockerfile with pnpm
ARG NODE_VERSION=20.11.0
ARG ALPINE_VERSION=3.19

# ============================================
# Stage 1: Builder (compile TypeScript + Prisma)
# ============================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS builder

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
COPY package.json tsconfig.json tsconfig.build.json ./

# Install ALL dependencies including devDependencies
RUN pnpm install

# Copy source code and prisma schema
COPY src ./src
COPY prisma ./prisma

# Generate Prisma client and build TypeScript
RUN npx prisma generate && pnpm run build

# Prune dev dependencies, keeping only production deps with Prisma client
RUN pnpm prune --prod

# ============================================
# Stage 2: Production runtime
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
    tesseract-ocr-data-ara \
    poppler-utils \
    ghostscript \
    imagemagick \
    graphicsmagick \
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
    && rm -rf /var/cache/apk/* \
    # Fix ImageMagick security policy to allow PDF processing
    && if [ -f /etc/ImageMagick-7/policy.xml ]; then \
         sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/g' /etc/ImageMagick-7/policy.xml; \
       fi \
    && if [ -f /etc/ImageMagick-6/policy.xml ]; then \
         sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/g' /etc/ImageMagick-6/policy.xml; \
       fi

# Install Python dependencies
RUN pip3 install --no-cache-dir --break-system-packages \
    pypdf==3.17.* \
    pytesseract==0.3.*

# Create non-root user
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

# Copy pruned production node_modules (includes Prisma client) from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

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

---
title: Docker Deployment
description: Deploy IntelliFill using Docker and Docker Compose
category: how-to
tags: [deployment, docker, containers]
lastUpdated: 2025-11-25
---

# Docker Deployment

This guide covers deploying IntelliFill using Docker and Docker Compose for both development and production environments.

---

## Prerequisites

- Docker 24+
- Docker Compose 2.x
- Git

---

## Quick Start

### Clone and Deploy

```bash
git clone https://github.com/yourusername/IntelliFill.git
cd IntelliFill
docker-compose up -d
```

This starts:
- Backend API on port 3002
- Frontend UI on port 8080
- PostgreSQL on port 5432
- Redis on port 6379

---

## Docker Compose Configuration

### Development (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_USER: intellifill
      POSTGRES_PASSWORD: password
      POSTGRES_DB: intellifill
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U intellifill"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./quikadmin
      dockerfile: Dockerfile.dev
    ports:
      - "3002:3002"
    environment:
      NODE_ENV: development
      PORT: 3002
      DATABASE_URL: postgresql://intellifill:password@postgres:5432/intellifill
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./quikadmin:/app
      - /app/node_modules

  frontend:
    build:
      context: ./quikadmin-web
      dockerfile: Dockerfile.dev
    ports:
      - "8080:8080"
    environment:
      VITE_API_URL: http://localhost:3002/api
    depends_on:
      - backend
    volumes:
      - ./quikadmin-web:/app
      - /app/node_modules

volumes:
  pgdata:
```

---

## Dockerfile Examples

### Backend Dockerfile.dev

```dockerfile
# quikadmin/Dockerfile.dev
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 3002

CMD ["npm", "run", "dev"]
```

### Backend Dockerfile (Production)

```dockerfile
# quikadmin/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npx prisma generate

FROM node:18-alpine AS runner

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

EXPOSE 3002

CMD ["npm", "start"]
```

### Frontend Dockerfile.dev

```dockerfile
# quikadmin-web/Dockerfile.dev
FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install

COPY . .

EXPOSE 8080

CMD ["bun", "run", "dev", "--host", "0.0.0.0"]
```

### Frontend Dockerfile (Production)

```dockerfile
# quikadmin-web/Dockerfile
FROM oven/bun:latest AS builder

WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
RUN bun run build

FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

---

## Production Deployment

### Production Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    image: intellifill-backend:latest
    restart: always
    environment:
      NODE_ENV: production
      PORT: 3002
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      JWT_SECRET: ${JWT_SECRET}
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
    ports:
      - "3002:3002"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    image: intellifill-frontend:latest
    restart: always
    ports:
      - "80:80"
    depends_on:
      - backend

  redis:
    image: redis:7
    restart: always
    volumes:
      - redis-data:/data
```

### Build and Deploy

```bash
# Build images
docker build -t intellifill-backend:latest ./quikadmin
docker build -t intellifill-frontend:latest ./quikadmin-web

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

---

## Environment Variables

Create `.env` for Docker Compose:

```env
# Database
DATABASE_URL=postgresql://intellifill:password@postgres:5432/intellifill

# Redis
REDIS_URL=redis://redis:6379

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT
JWT_SECRET=your-32-character-secret-key
```

---

## Common Commands

### Start Services

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d backend

# Start with build
docker-compose up -d --build
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
```

### Stop Services

```bash
# Stop all
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Execute Commands

```bash
# Run migrations
docker-compose exec backend npx prisma migrate deploy

# Open shell
docker-compose exec backend sh

# View database
docker-compose exec postgres psql -U intellifill
```

---

## Database Management

### Run Migrations

```bash
docker-compose exec backend npx prisma migrate deploy
```

### Seed Database

```bash
docker-compose exec backend npm run db:seed
```

### Backup Database

```bash
docker-compose exec postgres pg_dump -U intellifill intellifill > backup.sql
```

### Restore Database

```bash
docker-compose exec -T postgres psql -U intellifill intellifill < backup.sql
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs backend

# Check container status
docker-compose ps
```

### Database Connection Failed

```bash
# Verify PostgreSQL is running
docker-compose exec postgres pg_isready

# Check network
docker network ls
docker network inspect intellifill_default
```

### Port Conflicts

```bash
# Check ports in use
netstat -an | findstr :3002
netstat -an | findstr :8080

# Change ports in docker-compose.yml
ports:
  - "3003:3002"  # Map to different host port
```

### Rebuild Everything

```bash
# Nuclear option
docker-compose down -v
docker system prune -a
docker-compose up -d --build
```

---

## Health Checks

### Verify Services

```bash
# Backend health
curl http://localhost:3002/health

# Frontend
curl http://localhost:8080

# PostgreSQL
docker-compose exec postgres pg_isready

# Redis
docker-compose exec redis redis-cli ping
```

---

## Related Documentation

- [Local Setup](../development/local-setup.md)
- [Environment Variables](../../reference/configuration/environment.md)
- [Architecture Overview](../../reference/architecture/system-overview.md)


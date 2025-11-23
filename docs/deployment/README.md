---
title: Deployment Guide
category: deployment
status: active
last_updated: 2025-11-11
---

# Deployment Guide

Complete guide to deploying QuikAdmin.

## Quick Navigation

### Deployment Options
- **[Platforms](./platforms/README.md)** - Platform-specific guides
- **[Infrastructure](./infrastructure/overview.md)** - Infrastructure setup
- **[Neon Serverless](./infrastructure/neon-serverless.md)** - Neon database setup

### Security & Operations
- **[Security](./security/README.md)** - Security best practices
- **[Security Checklist](./security/checklist.md)** - Pre-deployment checklist
- **[Operations](./operations/README.md)** - Operational procedures

## Deployment Options

### Option 1: Vercel (Recommended for Frontend)
- Zero configuration
- Automatic HTTPS
- Edge network
- See: [Vercel Deployment](./platforms/vercel.md)

### Option 2: Railway / Render
- Full-stack deployment
- PostgreSQL included
- Easy setup
- See: [Railway Deployment](./platforms/railway.md)

### Option 3: Docker
- Containerized deployment
- Portable
- Production-ready
- See: [Docker Deployment](./platforms/docker.md)

### Option 4: Custom VPS
- Full control
- Cost-effective
- Requires setup
- See: [VPS Deployment](./platforms/vps.md)

## Quick Start

### 1. Prepare Environment
```bash
# Set production environment variables
DATABASE_URL="postgresql://..."
JWT_SECRET="<generate-with-openssl>"
NODE_ENV="production"
```

### 2. Build Application
```bash
npm install --production
npm run build
npx prisma migrate deploy
```

### 3. Start Server
```bash
npm start
```

## Security Checklist

Before deploying:

- [ ] Environment variables secured
- [ ] JWT secrets rotated
- [ ] HTTPS enabled
- [ ] CORS configured
- [ ] Rate limiting enabled
- [ ] Database backups configured
- [ ] Monitoring set up

See: [Security Checklist](./security/checklist.md)

## Related Documentation

- [Infrastructure Overview](./infrastructure/overview.md)
- [Environment Variables](../reference/configuration/environment-variables.md)
- [Architecture Overview](../01-current-state/architecture/system-overview.md)

---

**Last Updated:** 2025-11-11


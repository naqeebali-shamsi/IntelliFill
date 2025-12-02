# GitHub Actions CI/CD Documentation

## Overview

This repository uses GitHub Actions for continuous integration and deployment. The pipelines are designed to be simple, effective, and maintainable.

## Workflows

### 1. CI Pipeline (`ci.yml`)
**Triggers:** Push to main/develop, Pull requests to main
**Purpose:** Run tests, type checks, and security scans

**Jobs:**
- `test-backend`: Runs backend tests with PostgreSQL and Redis
- `test-frontend`: Builds and validates frontend
- `security-scan`: Checks for vulnerabilities and secrets

### 2. E2E Tests (`e2e.yml`)
**Triggers:** Pull requests to main, Manual dispatch
**Purpose:** Run Cypress end-to-end tests

**Jobs:**
- `cypress`: Runs Cypress tests against staging environment

### 3. Deployment (`deploy.yml`)
**Triggers:** Push to main (staging), Manual dispatch (production)
**Purpose:** Build Docker images and deploy to environments

**Jobs:**
- `build-and-push`: Creates Docker images and pushes to registry
- `deploy-staging`: Auto-deploys to staging on main branch pushes
- `deploy-production`: Manual deployment to production with approval

## Required Secrets

Configure these in Settings → Secrets → Actions:

### Essential Secrets
```
DATABASE_URL          # PostgreSQL connection string
REDIS_URL            # Redis connection string
JWT_SECRET           # 64+ character secret for JWT signing
JWT_REFRESH_SECRET   # 64+ character secret for refresh tokens
```

### Deployment Secrets (when ready)
```
DEPLOY_SSH_KEY       # SSH key for server access
DEPLOY_HOST          # Production server hostname
DEPLOY_USER          # Deployment user on server
```

## Local Development

### Running CI checks locally
```bash
# Run tests
npm test

# Type checking
npm run typecheck

# Security audit
npm audit

# Build check
npm run build
```

### Running E2E tests locally
```bash
# Start services
docker-compose up -d

# Run Cypress
cd web && npm run cypress:open
```

## Deployment Process

### Staging Deployment (Automatic)
1. Push to main branch
2. CI pipeline runs tests
3. If tests pass, Docker images are built
4. Images are pushed to GitHub Container Registry
5. Staging environment is updated automatically

### Production Deployment (Manual)
1. Go to Actions → Deploy workflow
2. Click "Run workflow"
3. Select "production" environment
4. Review changes
5. Click "Run workflow" to deploy
6. Monitor deployment progress

## Rollback Procedure

If a deployment causes issues:

```bash
# Quick rollback to previous image
docker-compose up -d --no-deps app:previous

# Or revert the commit
git revert HEAD
git push origin main
```

## Monitoring

### Health Checks
- `/api/health` - Basic health status
- `/api/ready` - Readiness check (database, redis, filesystem)

### Viewing Logs
```bash
# GitHub Actions logs
gh run list
gh run view <run-id>

# Server logs
docker-compose logs -f app
```

## Common Issues

### CI Failures
1. **Test failures**: Check test output in GitHub Actions
2. **Type errors**: Run `npm run typecheck` locally
3. **Security issues**: Run `npm audit fix`

### Deployment Issues
1. **Image build fails**: Check Dockerfile syntax
2. **Health check fails**: Verify environment variables
3. **Database migration fails**: Check migration files

## Best Practices

1. **Always create a PR** - Don't push directly to main
2. **Wait for CI to pass** - Don't merge with failing tests
3. **Test locally first** - Run tests before pushing
4. **Monitor after deploy** - Check health endpoints
5. **Document changes** - Update this README when changing workflows

## Support

For issues with CI/CD:
1. Check GitHub Actions logs
2. Verify secrets are configured
3. Test locally to reproduce
4. Create an issue if needed
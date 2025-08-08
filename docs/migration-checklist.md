# Next.js 15 Migration Checklist

## Pre-Migration Preparation

### ✅ 1. Backup Current System
- [ ] Create full backup of current codebase
- [ ] Export current database schema and data
- [ ] Document current environment variables
- [ ] Test current deployment process

### ✅ 2. Environment Analysis
- [ ] List all current dependencies and versions
- [ ] Identify custom Vite configurations
- [ ] Document current build and deployment scripts
- [ ] Map current routing structure

### ✅ 3. Team Preparation
- [ ] Review Next.js 15 App Router documentation with team
- [ ] Set up development environments
- [ ] Plan testing strategy
- [ ] Define rollback procedures

## Phase 1: Foundation Setup (Week 1-2)

### ✅ 1. Project Initialization
- [ ] Create new Next.js 15 project with App Router
  ```bash
  npx create-next-app@latest quikadmin-nextjs --typescript --tailwind --eslint --app
  ```
- [ ] Configure TypeScript and ESLint
- [ ] Set up directory structure according to migration plan
- [ ] Install core dependencies

### ✅ 2. Package Migration

**Install Next.js Dependencies**
```bash
# Core Next.js stack
npm install next@15 react@^18.3.0 react-dom@^18.3.0

# Authentication
npm install next-auth@^4.24.0 @auth/prisma-adapter

# Database & ORM
npm install prisma @prisma/client

# UI & Styling (keeping Material-UI)
npm install @mui/material @mui/icons-material @emotion/react @emotion/styled

# Data Fetching (replacing React Query)
npm install swr

# Forms & Validation
npm install react-hook-form zod @hookform/resolvers

# File Upload
npm install react-dropzone

# Utilities
npm install uuid date-fns

# Development
npm install -D @types/uuid @types/node typescript eslint eslint-config-next
```

**Remove Vite Dependencies**
```bash
npm uninstall vite @vitejs/plugin-react react-router-dom @reduxjs/toolkit react-redux react-query
```

### ✅ 3. Configuration Files

**Create next.config.js**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-lib', 'pdfjs-dist', 'sharp']
  },
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
}
module.exports = nextConfig
```

**Update package.json scripts**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  }
}
```

### ✅ 4. Environment Setup
- [ ] Create `.env.local` file
- [ ] Migrate environment variables from Vite format
- [ ] Set up database connection
- [ ] Configure authentication providers

```bash
# .env.local
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

## Phase 2: Core Infrastructure (Week 2-3)

### ✅ 1. Authentication Setup
- [ ] Configure NextAuth.js with existing user system
- [ ] Create authentication pages (`/auth/signin`, `/auth/signup`)
- [ ] Set up middleware for route protection
- [ ] Test authentication flow

**Authentication Implementation Checklist**
- [ ] Create `lib/auth.ts` with NextAuth configuration
- [ ] Create `middleware.ts` for route protection
- [ ] Create `app/api/auth/[...nextauth]/route.ts`
- [ ] Test login/logout functionality

### ✅ 2. Database Integration
- [ ] Set up Prisma schema
- [ ] Migrate existing database structure
- [ ] Create database utility functions
- [ ] Test database connections

**Database Migration Tasks**
- [ ] Create `prisma/schema.prisma`
- [ ] Run `npx prisma db pull` to generate schema from existing DB
- [ ] Create `lib/db.ts` for Prisma client
- [ ] Test all database operations

### ✅ 3. API Routes Foundation
- [ ] Create basic API route structure
- [ ] Implement authentication middleware for APIs
- [ ] Set up file upload handling
- [ ] Create error handling utilities

## Phase 3: Page Migration (Week 3-4)

### ✅ 1. Layout & Navigation
- [ ] Create root layout (`app/layout.tsx`)
- [ ] Implement navigation component
- [ ] Set up theme provider for Material-UI
- [ ] Add global styles

**Layout Implementation**
```typescript
// app/layout.tsx - Root layout with providers
// components/layout/Navigation.tsx - Main navigation
// components/providers/ - All context providers
```

### ✅ 2. Dashboard Page (Server Component)
- [ ] Create `app/dashboard/page.tsx`
- [ ] Implement server-side data fetching
- [ ] Add loading and error states
- [ ] Test SSR functionality

**Dashboard Migration Steps**
1. Convert Dashboard component to Server Component
2. Implement direct database queries
3. Add Suspense boundaries for loading states
4. Test with real data

### ✅ 3. History Page (Server Component with Pagination)
- [ ] Create `app/history/page.tsx`
- [ ] Implement server-side pagination
- [ ] Add search and filter functionality
- [ ] Test with large datasets

### ✅ 4. Templates Page (Server Component)
- [ ] Create `app/templates/page.tsx`
- [ ] Implement template management
- [ ] Add CRUD operations
- [ ] Test template functionality

### ✅ 5. Upload Page (Client Component)
- [ ] Create `app/upload/page.tsx`
- [ ] Migrate file upload functionality
- [ ] Implement progress tracking
- [ ] Test file upload with new API routes

### ✅ 6. Settings Page (Client Component)
- [ ] Create `app/settings/page.tsx`
- [ ] Migrate user settings functionality
- [ ] Implement form handling with react-hook-form
- [ ] Test settings persistence

### ✅ 7. Job Details Page (Dynamic Route)
- [ ] Create `app/job/[jobId]/page.tsx`
- [ ] Implement real-time progress updates
- [ ] Add job result display
- [ ] Test with various job states

## Phase 4: API Migration (Week 4-5)

### ✅ 1. Authentication APIs
- [ ] Migrate login endpoint to NextAuth
- [ ] Create user registration API
- [ ] Implement password reset functionality
- [ ] Test all auth flows

### ✅ 2. File Processing APIs
- [ ] Create `app/api/process/single/route.ts`
- [ ] Create `app/api/process/multiple/route.ts`
- [ ] Create `app/api/process/batch/route.ts`
- [ ] Test file processing with new APIs

**API Route Migration Tasks**
```typescript
// Each Express route becomes a Next.js API route
// POST /api/process/single -> app/api/process/single/route.ts
// GET /api/jobs -> app/api/jobs/route.ts
// GET /api/jobs/:id -> app/api/jobs/[jobId]/route.ts
```

### ✅ 3. Job Management APIs
- [ ] Create `app/api/jobs/route.ts` (GET, POST)
- [ ] Create `app/api/jobs/[jobId]/route.ts` (GET, PUT, DELETE)
- [ ] Create `app/api/jobs/[jobId]/status/route.ts`
- [ ] Implement job progress tracking

### ✅ 4. Real-time Updates
- [ ] Replace WebSocket with Server-Sent Events
- [ ] Create `app/api/jobs/[jobId]/progress/route.ts`
- [ ] Test real-time progress updates
- [ ] Handle connection management

**WebSocket to SSE Migration**
```typescript
// Replace WebSocket connection with EventSource
// Client: new EventSource('/api/jobs/123/progress')
// Server: Stream progress updates via ReadableStream
```

### ✅ 5. Statistics & Templates APIs
- [ ] Create `app/api/statistics/route.ts`
- [ ] Create `app/api/templates/route.ts`
- [ ] Create `app/api/templates/[templateId]/route.ts`
- [ ] Test all CRUD operations

## Phase 5: Component Migration (Week 5-6)

### ✅ 1. Server Components
- [ ] Convert static components to Server Components
- [ ] Implement data fetching in Server Components
- [ ] Add proper TypeScript types
- [ ] Test server-side rendering

**Server Component Conversion**
- Dashboard statistics
- Job history lists
- Template listings
- Navigation (if static)

### ✅ 2. Client Components
- [ ] Add 'use client' directive to interactive components
- [ ] Migrate state management to hooks/context
- [ ] Replace React Query with SWR
- [ ] Test client-side functionality

**Client Component Conversion**
- File upload components
- Forms with state
- Real-time progress displays
- Interactive charts

### ✅ 3. Shared Components
- [ ] Create reusable UI components
- [ ] Implement loading skeletons
- [ ] Add error boundaries
- [ ] Create form components with validation

## Phase 6: State Management Migration (Week 6)

### ✅ 1. Remove Redux
- [ ] Identify Redux usage patterns
- [ ] Replace with React Context where needed
- [ ] Use Server Components for server state
- [ ] Use SWR for client-side data fetching

### ✅ 2. React Query to SWR Migration
- [ ] Replace useQuery hooks with useSWR
- [ ] Update data fetching patterns
- [ ] Implement optimistic updates
- [ ] Add error handling

**Data Fetching Migration**
```typescript
// Before (React Query)
const { data, isLoading } = useQuery(['jobs'], getJobs)

// After (SWR)
const { data, error, isLoading } = useSWR('/api/jobs', fetcher)
```

## Phase 7: Testing & Optimization (Week 7-8)

### ✅ 1. Testing Implementation
- [ ] Set up Jest with Next.js
- [ ] Write unit tests for components
- [ ] Create integration tests for API routes
- [ ] Add end-to-end tests with Playwright

**Testing Setup**
```bash
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom
```

### ✅ 2. Performance Optimization
- [ ] Implement proper caching strategies
- [ ] Add Incremental Static Regeneration where appropriate
- [ ] Optimize bundle size
- [ ] Add performance monitoring

**Performance Checklist**
- [ ] Use `unstable_cache` for expensive operations
- [ ] Implement ISR for semi-static pages
- [ ] Add `loading.tsx` files for better UX
- [ ] Optimize images with next/image

### ✅ 3. Error Handling
- [ ] Create global error boundaries
- [ ] Add proper error pages
- [ ] Implement error logging
- [ ] Test error scenarios

### ✅ 4. Security Review
- [ ] Review authentication implementation
- [ ] Check API route security
- [ ] Validate file upload security
- [ ] Test authorization flows

## Phase 8: Deployment & Production (Week 8)

### ✅ 1. Build Configuration
- [ ] Optimize production build
- [ ] Configure environment variables for production
- [ ] Set up Docker containers if needed
- [ ] Test production build locally

### ✅ 2. Deployment Setup
- [ ] Configure deployment pipeline
- [ ] Set up production database
- [ ] Configure Redis for production
- [ ] Set up monitoring and logging

### ✅ 3. Migration Strategy
- [ ] Plan zero-downtime migration
- [ ] Set up database migration scripts
- [ ] Create rollback procedures
- [ ] Test migration process in staging

### ✅ 4. Go-Live Checklist
- [ ] Final security review
- [ ] Performance testing under load
- [ ] User acceptance testing
- [ ] Documentation update
- [ ] Team training on new system

## Post-Migration Tasks

### ✅ 1. Monitoring & Maintenance
- [ ] Set up application monitoring
- [ ] Configure error tracking
- [ ] Monitor performance metrics
- [ ] Schedule regular security updates

### ✅ 2. Documentation
- [ ] Update API documentation
- [ ] Create deployment guides
- [ ] Document new development workflow
- [ ] Update troubleshooting guides

### ✅ 3. Team Training
- [ ] Conduct Next.js training sessions
- [ ] Share best practices
- [ ] Review new development workflow
- [ ] Plan knowledge transfer

## Potential Issues & Solutions

### ⚠️ Common Migration Issues

1. **File Upload Size Limits**
   - Issue: Next.js has default 1MB limit
   - Solution: Configure bodyParser in next.config.js

2. **WebSocket Replacement**
   - Issue: Next.js API routes don't support WebSocket
   - Solution: Use Server-Sent Events or external WebSocket server

3. **State Management Complexity**
   - Issue: Redux might be overkill with Server Components
   - Solution: Use Server Components + Context + SWR

4. **PDF Processing Performance**
   - Issue: Large PDF processing blocks the server
   - Solution: Use background queues and progress tracking

### 🔧 Migration Scripts

**Database Migration Script**
```sql
-- Add any new columns needed for Next.js integration
ALTER TABLE users ADD COLUMN IF NOT EXISTS nextauth_user_id VARCHAR(255);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON jobs(user_id, status);
```

**Environment Migration Script**
```bash
#!/bin/bash
# Convert Vite env vars to Next.js format
# VITE_API_URL -> NEXT_PUBLIC_API_URL (for client-side)
# API_URL -> API_URL (for server-side)

echo "Migrating environment variables..."
sed 's/VITE_/NEXT_PUBLIC_/g' .env > .env.local
echo "Environment variables migrated to .env.local"
```

## Success Metrics

### 📊 Performance Targets
- [ ] First Contentful Paint < 2 seconds
- [ ] Time to Interactive < 3 seconds
- [ ] Bundle size reduction by 20%
- [ ] Server response time < 500ms

### 📈 Feature Parity
- [ ] All current features working
- [ ] User authentication flow
- [ ] File upload and processing
- [ ] Real-time progress updates
- [ ] Statistics dashboard

### 🚀 Improvements
- [ ] Better SEO with SSR
- [ ] Improved performance scores
- [ ] Enhanced developer experience
- [ ] Better error handling
- [ ] Improved caching strategies

## Rollback Plan

### 🔄 Emergency Rollback Procedure
1. **Immediate Actions**
   - Switch DNS/load balancer back to old system
   - Verify old system is still functional
   - Communicate status to users

2. **Data Synchronization**
   - Export any new data from Next.js system
   - Import critical data back to old system
   - Verify data integrity

3. **Investigation & Fix**
   - Identify root cause of issues
   - Plan fixes for Next.js system
   - Test fixes in staging environment
   - Plan retry migration

This comprehensive checklist ensures a systematic and thorough migration from Vite + React to Next.js 15 with App Router, minimizing risks and maximizing the benefits of the new architecture.
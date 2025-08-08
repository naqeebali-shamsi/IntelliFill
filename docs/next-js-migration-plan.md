# Next.js 15 App Router Migration Plan

## Executive Summary

This document provides a comprehensive migration strategy to convert the current Vite-based React application to Next.js 15 with App Router. The migration will enhance performance through SSR/SSG, improve SEO, streamline API management, and provide better developer experience.

## Current Architecture Analysis

### Frontend (Vite + React)
- **Framework**: React 18 with Vite 4.5.0
- **UI Library**: Material-UI v5 with Emotion
- **Routing**: React Router v6 (client-side)
- **State Management**: Redux Toolkit + React Query v3
- **Authentication**: JWT tokens with localStorage
- **File Upload**: React Dropzone with axios progress tracking
- **Real-time Updates**: WebSocket connection
- **Build Tool**: Vite with TypeScript

### Backend (Express + TypeScript)
- **Framework**: Express.js with TypeScript
- **File Processing**: PDF-lib, pdfjs-dist, multer
- **Authentication**: JWT middleware
- **Database**: PostgreSQL with custom service layer
- **Queue**: Bull with Redis
- **APIs**: RESTful endpoints for PDF processing

### Key Features
1. File upload with progress tracking
2. PDF form filling and data extraction
3. Job processing and queue management
4. Real-time updates via WebSocket
5. Statistics dashboard
6. Template management
7. User settings

## Next.js 15 App Router Migration Strategy

### 1. File Structure Design

```
quikadmin-nextjs/
├── app/                           # App Router directory
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Home page (redirect to dashboard)
│   ├── globals.css                # Global styles
│   ├── dashboard/
│   │   ├── page.tsx               # Dashboard page (SSR)
│   │   └── loading.tsx            # Loading UI
│   ├── upload/
│   │   ├── page.tsx               # Upload page (Client Component)
│   │   └── components/
│   │       ├── FileUploader.tsx
│   │       └── ProgressTracker.tsx
│   ├── history/
│   │   ├── page.tsx               # History page (SSR with pagination)
│   │   └── components/
│   │       └── JobsList.tsx
│   ├── templates/
│   │   ├── page.tsx               # Templates page (SSR)
│   │   └── components/
│   │       └── TemplateManager.tsx
│   ├── settings/
│   │   ├── page.tsx               # Settings page (Client Component)
│   │   └── components/
│   │       └── UserSettings.tsx
│   ├── job/
│   │   └── [jobId]/
│   │       ├── page.tsx           # Job details (SSR)
│   │       └── components/
│   │           └── JobProgress.tsx
│   ├── api/                       # API Routes
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   └── verify/route.ts
│   │   ├── jobs/
│   │   │   ├── route.ts           # GET /api/jobs
│   │   │   └── [jobId]/
│   │   │       ├── route.ts       # GET /api/jobs/[jobId]
│   │   │       └── status/route.ts
│   │   ├── process/
│   │   │   ├── single/route.ts
│   │   │   ├── multiple/route.ts
│   │   │   └── batch/route.ts
│   │   ├── templates/
│   │   │   ├── route.ts
│   │   │   └── [templateId]/route.ts
│   │   ├── statistics/route.ts
│   │   ├── validate/
│   │   │   └── form/route.ts
│   │   ├── extract/route.ts
│   │   └── queue/
│   │       └── metrics/route.ts
│   └── not-found.tsx              # 404 page
├── components/                    # Shared components
│   ├── ui/                        # UI components
│   ├── forms/                     # Form components
│   ├── layout/                    # Layout components
│   └── providers/                 # Context providers
├── lib/                           # Utilities and configurations
│   ├── auth.ts                    # Authentication utilities
│   ├── api.ts                     # API client
│   ├── db.ts                      # Database connections
│   ├── queue.ts                   # Queue management
│   ├── pdf-processing.ts          # PDF processing utilities
│   ├── validations.ts             # Form validations
│   └── utils.ts                   # General utilities
├── hooks/                         # Custom React hooks
├── types/                         # TypeScript type definitions
├── middleware.ts                  # Next.js middleware
├── next.config.js                 # Next.js configuration
└── package.json
```

### 2. Routing Migration Strategy

#### Current React Router → Next.js App Router Mapping

| Current Route | React Router | Next.js App Router | Component Type |
|--------------|-------------|-------------------|----------------|
| `/` | `<Navigate to="/dashboard" />` | `app/page.tsx` (redirect) | Server Component |
| `/dashboard` | `<Dashboard />` | `app/dashboard/page.tsx` | Server Component (SSR) |
| `/upload` | `<Upload />` | `app/upload/page.tsx` | Client Component |
| `/history` | `<History />` | `app/history/page.tsx` | Server Component (SSR) |
| `/templates` | `<Templates />` | `app/templates/page.tsx` | Server Component (SSR) |
| `/settings` | `<Settings />` | `app/settings/page.tsx` | Client Component |
| `/job/:jobId` | `<JobDetails />` | `app/job/[jobId]/page.tsx` | Server Component (SSR) |

#### Route Implementation Examples

**app/page.tsx** (Home/Redirect)
```typescript
import { redirect } from 'next/navigation'

export default function HomePage() {
  redirect('/dashboard')
}
```

**app/dashboard/page.tsx** (Server Component with SSR)
```typescript
import { Suspense } from 'react'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { RecentJobs } from '@/components/dashboard/RecentJobs'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getStatistics, getJobs } from '@/lib/api-server'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/api/auth/signin')
  }

  // Fetch data server-side
  const [statistics, recentJobs] = await Promise.all([
    getStatistics(session.user.id),
    getJobs(session.user.id, { limit: 5 })
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <Suspense fallback={<StatsLoading />}>
        <DashboardStats statistics={statistics} />
      </Suspense>
      <Suspense fallback={<JobsLoading />}>
        <RecentJobs jobs={recentJobs} />
      </Suspense>
    </div>
  )
}
```

### 3. API Routes Migration Plan

#### Migration from Express to Next.js API Routes

**Current Express Route**
```typescript
// src/api/routes.ts
router.post('/process/single', upload.fields([...]), async (req, res) => {
  // Processing logic
})
```

**Next.js API Route**
```typescript
// app/api/process/single/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { PDFFillerService } from '@/lib/pdf-processing'

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Handle file upload
    const formData = await request.formData()
    const documentFile = formData.get('document') as File
    const formFile = formData.get('form') as File

    if (!documentFile || !formFile) {
      return NextResponse.json(
        { error: 'Both document and form files are required' },
        { status: 400 }
      )
    }

    // Process files
    const pdfService = new PDFFillerService()
    const result = await pdfService.processSingle(documentFile, formFile)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Processing error:', error)
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    )
  }
}
```

#### API Routes Migration Map

| Express Endpoint | Next.js API Route | Method | Authentication |
|-----------------|-------------------|--------|---------------|
| `/api/process/single` | `/api/process/single` | POST | Required |
| `/api/process/multiple` | `/api/process/multiple` | POST | Required |
| `/api/jobs` | `/api/jobs` | GET | Required |
| `/api/jobs/:id` | `/api/jobs/[jobId]` | GET | Required |
| `/api/statistics` | `/api/statistics` | GET | Required |
| `/api/templates` | `/api/templates` | GET, POST | Required |
| `/api/validate/form` | `/api/validate/form` | POST | Required |

### 4. Server vs Client Components Strategy

#### Server Components (Default - Better Performance)
- **Dashboard**: Statistics and recent jobs (SSR)
- **History**: Job history with pagination (SSR) 
- **Templates**: Template listing (SSR)
- **Job Details**: Individual job information (SSR)
- **Layout Components**: Navigation, header, footer

#### Client Components (Interactive Features)
- **Upload**: File upload with drag & drop, progress tracking
- **Settings**: Form inputs, user preferences
- **Real-time Updates**: WebSocket connections
- **Interactive Charts**: Dashboard statistics
- **Form Components**: All forms with state management

#### Component Architecture Example

**Server Component Pattern**
```typescript
// app/history/page.tsx
import { getJobs } from '@/lib/api-server'
import { JobsTable } from '@/components/jobs/JobsTable'

export default async function HistoryPage({
  searchParams
}: {
  searchParams: { page?: string; status?: string }
}) {
  const page = parseInt(searchParams.page || '1')
  const status = searchParams.status

  const jobs = await getJobs({ page, status, limit: 20 })

  return (
    <div>
      <h1>Processing History</h1>
      <JobsTable jobs={jobs} />
    </div>
  )
}
```

**Client Component Pattern**
```typescript
'use client'

// components/upload/FileUploader.tsx
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

export function FileUploader() {
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback(async (files: File[]) => {
    setIsUploading(true)
    // Upload logic with progress tracking
  }, [])

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] }
  })

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      {/* Upload UI */}
    </div>
  )
}
```

### 5. State Management Migration

#### From Redux Toolkit + React Query to App Router Patterns

**Current Pattern (React Query)**
```typescript
// Current React Query usage
const { data: jobs, isLoading } = useQuery(['jobs'], getJobs)
```

**Next.js Server Component Pattern**
```typescript
// Server Component with direct data fetching
export default async function HistoryPage() {
  const jobs = await getJobs() // Direct server-side call
  return <JobsList jobs={jobs} />
}
```

**Client Component with SWR/TanStack Query v5**
```typescript
'use client'

import useSWR from 'swr'

export function JobsClient() {
  const { data: jobs, error, isLoading } = useSWR('/api/jobs', fetcher)
  
  if (isLoading) return <Loading />
  if (error) return <Error />
  return <JobsList jobs={jobs} />
}
```

#### Global State Management Strategy

**Context Providers for Client State**
```typescript
// app/providers.tsx
'use client'

import { createContext, useContext, useReducer } from 'react'

const AppStateContext = createContext(null)

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)
  
  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      {children}
    </AppStateContext.Provider>
  )
}
```

### 6. Authentication & Middleware Migration

#### Current JWT Implementation → NextAuth.js

**Current Authentication**
```typescript
// Current axios interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

**Next.js Middleware**
```typescript
// middleware.ts
import { withAuth } from 'next-auth/middleware'

export default withAuth(
  function middleware(req) {
    // Additional middleware logic
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: ['/dashboard/:path*', '/history/:path*', '/templates/:path*']
}
```

**Auth Configuration**
```typescript
// lib/auth.ts
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        // Verify credentials against your backend
        const user = await verifyCredentials(credentials)
        return user || null
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup'
  }
}
```

### 7. File Upload & PDF Processing Migration

#### Enhanced File Upload Handling

**Upload API Route with Streaming**
```typescript
// app/api/process/multiple/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('documents') as File[]
    const form = formData.get('form') as File
    
    // Process files with streaming for large uploads
    const uploadPromises = files.map(async (file) => {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const path = join(process.cwd(), 'uploads', file.name)
      await writeFile(path, buffer)
      return path
    })
    
    const uploadedPaths = await Promise.all(uploadPromises)
    
    // Queue processing job
    const jobId = await queueProcessingJob({
      documents: uploadedPaths,
      form: await saveFormFile(form),
      userId: session.user.id
    })
    
    return NextResponse.json({ jobId, status: 'queued' })
  } catch (error) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
```

**Progress Tracking with Server-Sent Events**
```typescript
// app/api/jobs/[jobId]/progress/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const encoder = new TextEncoder()
  
  const customReadable = new ReadableStream({
    start(controller) {
      const interval = setInterval(async () => {
        const progress = await getJobProgress(params.jobId)
        
        const data = `data: ${JSON.stringify(progress)}\n\n`
        controller.enqueue(encoder.encode(data))
        
        if (progress.status === 'completed' || progress.status === 'failed') {
          clearInterval(interval)
          controller.close()
        }
      }, 1000)
    },
  })
  
  return new Response(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

### 8. Performance Optimizations

#### SSR/SSG Implementation Strategy

**Static Generation for Templates**
```typescript
// app/templates/page.tsx
import { getTemplates } from '@/lib/api-server'

// Generate static page at build time
export async function generateStaticParams() {
  const templates = await getTemplates()
  return templates.map((template) => ({
    slug: template.slug,
  }))
}

// Revalidate every hour
export const revalidate = 3600

export default async function TemplatesPage() {
  const templates = await getTemplates()
  return <TemplatesList templates={templates} />
}
```

**Incremental Static Regeneration for Dashboard**
```typescript
// app/dashboard/page.tsx
export const revalidate = 300 // 5 minutes

export default async function DashboardPage() {
  const statistics = await getStatistics()
  return <DashboardStats statistics={statistics} />
}
```

#### Image Optimization
```typescript
// components/ui/Avatar.tsx
import Image from 'next/image'

export function Avatar({ src, alt, size = 40 }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="rounded-full"
      priority={size > 100} // Prioritize larger avatars
    />
  )
}
```

### 9. Migration Roadmap

#### Phase 1: Foundation Setup (Week 1-2)
1. **Project Setup**
   - Initialize Next.js 15 project with App Router
   - Configure TypeScript and ESLint
   - Set up Material-UI with App Router
   - Configure authentication with NextAuth.js

2. **Core Infrastructure**
   - Set up middleware for authentication
   - Configure API routes structure
   - Set up database connections
   - Implement file upload handling

#### Phase 2: Page Migration (Week 3-4)
1. **Static Pages First**
   - Migrate Layout component
   - Implement Dashboard (Server Component)
   - Migrate History page with pagination
   - Migrate Templates page

2. **Interactive Pages**
   - Migrate Upload page (Client Component)
   - Migrate Settings page
   - Implement Job Details with real-time updates

#### Phase 3: API Migration (Week 5-6)
1. **Core API Routes**
   - Migrate authentication endpoints
   - Migrate file processing endpoints
   - Migrate job management endpoints
   - Migrate statistics endpoints

2. **Advanced Features**
   - Implement Server-Sent Events for progress
   - Set up WebSocket alternative
   - Optimize file upload handling
   - Add API rate limiting

#### Phase 4: Optimization & Testing (Week 7-8)
1. **Performance Optimization**
   - Implement SSG where appropriate
   - Add ISR for dynamic content
   - Optimize bundle size
   - Add performance monitoring

2. **Testing & Deployment**
   - Unit and integration testing
   - End-to-end testing
   - Performance testing
   - Production deployment

### 10. Potential Challenges & Solutions

#### Challenge 1: File Upload Size Limits
**Problem**: Next.js has default request size limits
**Solution**: 
```typescript
// next.config.js
module.exports = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
  experimental: {
    serverComponentsExternalPackages: ['pdf-lib', 'pdfjs-dist']
  }
}
```

#### Challenge 2: WebSocket Replacement
**Problem**: Next.js API routes don't support WebSocket
**Solution**: Use Server-Sent Events or external WebSocket server
```typescript
// Alternative: Server-Sent Events
export async function GET() {
  return new Response(
    new ReadableStream({
      // SSE implementation
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    }
  )
}
```

#### Challenge 3: State Management Complexity
**Problem**: Redux Toolkit might be overkill with Server Components
**Solution**: Hybrid approach with Server Components + minimal client state
```typescript
// Use Server Components for data fetching
// Use Context for client-side state
// Use SWR/TanStack Query for client-side data fetching
```

#### Challenge 4: PDF Processing Performance
**Problem**: Large PDF processing might block the server
**Solution**: Implement background processing with queues
```typescript
// Queue processing jobs instead of blocking requests
export async function POST(request: NextRequest) {
  const jobId = await enqueueJob(processingParams)
  return NextResponse.json({ jobId, status: 'queued' })
}
```

### 11. Dependencies Migration

#### Package Updates
```json
{
  "dependencies": {
    "next": "15.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "next-auth": "^4.24.0",
    "@mui/material": "^5.15.0",
    "@emotion/react": "^11.11.0",
    "@emotion/styled": "^11.11.0",
    "swr": "^2.2.0",
    "zod": "^3.22.0",
    "prisma": "^5.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.3.0",
    "eslint": "^8.0.0",
    "eslint-config-next": "15.0.0"
  }
}
```

#### Removed Dependencies
- `vite` → Next.js built-in bundler
- `react-router-dom` → App Router
- `react-query` → SWR or TanStack Query v5
- `@reduxjs/toolkit` → Server Components + Context (if needed)

### 12. Testing Strategy

#### Unit Testing
```typescript
// __tests__/api/jobs.test.ts
import { testApiHandler } from 'next-test-api-route-handler'
import handler from '@/app/api/jobs/route'

test('GET /api/jobs returns jobs list', async () => {
  await testApiHandler({
    handler,
    test: async ({ fetch }) => {
      const res = await fetch({ method: 'GET' })
      expect(res.status).toBe(200)
    }
  })
})
```

#### Integration Testing
```typescript
// __tests__/pages/dashboard.test.tsx
import { render, screen } from '@testing-library/react'
import DashboardPage from '@/app/dashboard/page'

test('renders dashboard with statistics', async () => {
  render(await DashboardPage())
  expect(screen.getByText('Dashboard')).toBeInTheDocument()
})
```

### 13. Deployment Configuration

#### Production Build Optimization
```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['pdf-lib', 'pdfjs-dist', 'sharp']
  },
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif']
  },
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
  httpAgentOptions: {
    keepAlive: true,
  }
}

module.exports = nextConfig
```

### Conclusion

This migration plan provides a comprehensive strategy for converting the Vite-based React application to Next.js 15 with App Router. The approach prioritizes:

1. **Performance**: Server Components for better initial load times
2. **Developer Experience**: Type-safe API routes and improved debugging
3. **SEO**: Server-side rendering for public pages
4. **Scalability**: Built-in optimizations and caching strategies
5. **Maintainability**: Clear separation of server and client components

The phased approach ensures minimal disruption to existing functionality while taking advantage of Next.js 15's latest features and optimizations.
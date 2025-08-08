# Next.js 15 Implementation Examples

## Configuration Files

### 1. Next.js Configuration
```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    serverComponentsExternalPackages: [
      'pdf-lib',
      'pdfjs-dist', 
      'sharp',
      'mammoth',
      'csv-parse'
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
  },
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
  env: {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
  },
  poweredByHeader: false,
  compress: true,
}

module.exports = nextConfig
```

### 2. Middleware for Authentication
```typescript
// middleware.ts
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // Add CORS headers for API routes
    if (req.nextUrl.pathname.startsWith('/api/')) {
      const response = NextResponse.next()
      response.headers.set('Access-Control-Allow-Origin', '*')
      response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
      return response
    }

    // Redirect unauthenticated users
    if (req.nextUrl.pathname.startsWith('/dashboard') && !req.nextauth.token) {
      return NextResponse.redirect(new URL('/auth/signin', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow API routes to handle their own auth
        if (req.nextUrl.pathname.startsWith('/api/')) {
          return true
        }
        // Require auth for protected pages
        if (req.nextUrl.pathname.startsWith('/dashboard')) {
          return !!token
        }
        return true
      },
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/history/:path*', 
    '/templates/:path*',
    '/settings/:path*',
    '/job/:path*',
    '/api/:path*'
  ]
}
```

### 3. Root Layout
```typescript
// app/layout.tsx
import './globals.css'
import { Inter } from 'next/font/google'
import { SessionProvider } from '@/components/providers/SessionProvider'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'PDF Filler Tool',
  description: 'Intelligent PDF form filler using document data extraction',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          <ThemeProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
```

### 4. Authentication Configuration
```typescript
// lib/auth.ts
import { NextAuthOptions } from 'next-auth'
import { JWT } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: any }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
}
```

## Server Components Examples

### 1. Dashboard Page (Server Component)
```typescript
// app/dashboard/page.tsx
import { Suspense } from 'react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getStatistics, getRecentJobs } from '@/lib/api-server'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { RecentJobs } from '@/components/dashboard/RecentJobs'
import { DashboardSkeleton } from '@/components/ui/skeletons'

// Enable ISR with 5-minute revalidation
export const revalidate = 300

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/auth/signin')
  }

  // Fetch data in parallel on the server
  const [statistics, recentJobs] = await Promise.all([
    getStatistics(session.user.id),
    getRecentJobs(session.user.id, 5)
  ])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {session.user.name}
        </h1>
        <p className="text-gray-600 mt-2">
          Here's an overview of your PDF processing activities
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Suspense fallback={<DashboardSkeleton />}>
            <DashboardStats statistics={statistics} />
          </Suspense>
        </div>
        
        <div>
          <Suspense fallback={<div>Loading recent jobs...</div>}>
            <RecentJobs jobs={recentJobs} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
```

### 2. Job Details Page with Dynamic Route
```typescript
// app/job/[jobId]/page.tsx
import { Suspense } from 'react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { getJob } from '@/lib/api-server'
import { JobHeader } from '@/components/jobs/JobHeader'
import { JobProgress } from '@/components/jobs/JobProgress'
import { JobResults } from '@/components/jobs/JobResults'

interface JobPageProps {
  params: {
    jobId: string
  }
}

export async function generateMetadata({ params }: JobPageProps) {
  const job = await getJob(params.jobId)
  
  if (!job) {
    return {
      title: 'Job Not Found'
    }
  }

  return {
    title: `Job ${job.id} - ${job.type}`,
    description: `Processing status: ${job.status}`
  }
}

export default async function JobPage({ params }: JobPageProps) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/auth/signin')
  }

  const job = await getJob(params.jobId)

  if (!job || job.userId !== session.user.id) {
    notFound()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Suspense fallback={<div>Loading job details...</div>}>
        <JobHeader job={job} />
      </Suspense>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        <div>
          <Suspense fallback={<div>Loading progress...</div>}>
            <JobProgress jobId={job.id} initialStatus={job.status} />
          </Suspense>
        </div>
        
        {job.status === 'completed' && (
          <div>
            <Suspense fallback={<div>Loading results...</div>}>
              <JobResults job={job} />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  )
}
```

## Client Components Examples

### 1. File Upload Component
```typescript
// components/upload/FileUploader.tsx
'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { useToast } from '@/hooks/useToast'

interface FileUploaderProps {
  onUploadComplete?: (result: any) => void
}

export function FileUploader({ onUploadComplete }: FileUploaderProps) {
  const [files, setFiles] = useState<File[]>([])
  const [formFile, setFormFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()

  const onDocumentDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles])
  }, [])

  const onFormDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      setFormFile(acceptedFiles[0])
    }
  }, [])

  const { 
    getRootProps: getDocumentRootProps, 
    getInputProps: getDocumentInputProps,
    isDragActive: isDocumentDragActive 
  } = useDropzone({
    onDrop: onDocumentDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv']
    },
    multiple: true
  })

  const { 
    getRootProps: getFormRootProps, 
    getInputProps: getFormInputProps,
    isDragActive: isFormDragActive 
  } = useDropzone({
    onDrop: onFormDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false
  })

  const handleUpload = async () => {
    if (files.length === 0 || !formFile) {
      toast({
        title: 'Missing files',
        description: 'Please select both documents and a form to process',
        variant: 'destructive'
      })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      files.forEach(file => formData.append('documents', file))
      formData.append('form', formFile)

      const response = await fetch('/api/process/multiple', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const result = await response.json()
      
      toast({
        title: 'Upload successful',
        description: `Processing job ${result.jobId} has been queued`
      })

      onUploadComplete?.(result)
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Please try again',
        variant: 'destructive'
      })
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="space-y-6">
      {/* Document Upload Area */}
      <div
        {...getDocumentRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDocumentDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
        `}
      >
        <input {...getDocumentInputProps()} />
        <div className="space-y-2">
          <div className="text-xl">📄</div>
          <p className="text-sm text-gray-600">
            {isDocumentDragActive
              ? 'Drop documents here...'
              : 'Drag & drop documents or click to select'
            }
          </p>
          <p className="text-xs text-gray-500">
            Supports PDF, DOC, DOCX, TXT, CSV files
          </p>
        </div>
      </div>

      {/* Selected Documents */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium">Selected Documents ({files.length})</h3>
          <div className="space-y-1">
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm">{file.name}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFiles(files.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form Upload Area */}
      <div
        {...getFormRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isFormDragActive ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'}
        `}
      >
        <input {...getFormInputProps()} />
        <div className="space-y-2">
          <div className="text-xl">📋</div>
          <p className="text-sm text-gray-600">
            {isFormDragActive
              ? 'Drop PDF form here...'
              : 'Drag & drop PDF form or click to select'
            }
          </p>
          <p className="text-xs text-gray-500">
            PDF form to be filled
          </p>
        </div>
      </div>

      {/* Selected Form */}
      {formFile && (
        <div className="p-3 bg-green-50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Form: {formFile.name}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFormFile(null)}
            >
              Remove
            </Button>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-2">
          <Progress value={uploadProgress} className="w-full" />
          <p className="text-sm text-gray-600 text-center">
            Uploading... {uploadProgress}%
          </p>
        </div>
      )}

      {/* Upload Button */}
      <Button
        onClick={handleUpload}
        disabled={files.length === 0 || !formFile || isUploading}
        className="w-full"
        size="lg"
      >
        {isUploading ? 'Processing...' : 'Start Processing'}
      </Button>
    </div>
  )
}
```

### 2. Real-time Job Progress Component
```typescript
// components/jobs/JobProgress.tsx
'use client'

import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/Progress'
import { Badge } from '@/components/ui/Badge'

interface JobProgressProps {
  jobId: string
  initialStatus: string
}

interface JobStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  message?: string
  error?: string
}

export function JobProgress({ jobId, initialStatus }: JobProgressProps) {
  const [status, setStatus] = useState<JobStatus>({
    status: initialStatus as any,
    progress: initialStatus === 'completed' ? 100 : 0
  })

  useEffect(() => {
    if (status.status === 'completed' || status.status === 'failed') {
      return
    }

    // Use Server-Sent Events for real-time updates
    const eventSource = new EventSource(`/api/jobs/${jobId}/progress`)

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setStatus(data)

      if (data.status === 'completed' || data.status === 'failed') {
        eventSource.close()
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [jobId, status.status])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500'
      case 'processing': return 'bg-blue-500'
      case 'completed': return 'bg-green-500'
      case 'failed': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="space-y-4 p-6 bg-white rounded-lg border">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Processing Status</h3>
        <Badge className={getStatusColor(status.status)}>
          {status.status.toUpperCase()}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Progress</span>
          <span>{status.progress}%</span>
        </div>
        <Progress value={status.progress} className="w-full" />
      </div>

      {status.message && (
        <p className="text-sm text-gray-600">{status.message}</p>
      )}

      {status.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-700">{status.error}</p>
        </div>
      )}
    </div>
  )
}
```

## API Routes Examples

### 1. File Processing API Route
```typescript
// app/api/process/multiple/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { queueProcessingJob } from '@/lib/queue'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const documentFiles = formData.getAll('documents') as File[]
    const formFile = formData.get('form') as File

    // Validation
    if (documentFiles.length === 0 || !formFile) {
      return NextResponse.json({
        error: 'Both documents and form file are required'
      }, { status: 400 })
    }

    // Validate file sizes
    const allFiles = [...documentFiles, formFile]
    for (const file of allFiles) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({
          error: `File ${file.name} exceeds maximum size of 10MB`
        }, { status: 400 })
      }
    }

    // Create upload directory
    const uploadDir = join(process.cwd(), 'uploads', session.user.id)
    await mkdir(uploadDir, { recursive: true })

    // Save files
    const jobId = uuidv4()
    const documentPaths: string[] = []

    for (const file of documentFiles) {
      const filename = `${jobId}-doc-${documentPaths.length + 1}-${file.name}`
      const filepath = join(uploadDir, filename)
      const bytes = await file.arrayBuffer()
      await writeFile(filepath, Buffer.from(bytes))
      documentPaths.push(filepath)
    }

    const formFilename = `${jobId}-form-${formFile.name}`
    const formPath = join(uploadDir, formFilename)
    const formBytes = await formFile.arrayBuffer()
    await writeFile(formPath, Buffer.from(formBytes))

    // Queue the processing job
    const job = await queueProcessingJob({
      id: jobId,
      userId: session.user.id,
      type: 'multiple',
      documents: documentPaths,
      form: formPath,
      outputPath: join(process.cwd(), 'outputs', `${jobId}-filled.pdf`)
    })

    return NextResponse.json({
      jobId,
      status: 'queued',
      estimatedTime: documentFiles.length * 30 // 30 seconds per document
    })

  } catch (error) {
    console.error('Processing error:', error)
    return NextResponse.json({
      error: 'Processing failed'
    }, { status: 500 })
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
```

### 2. Server-Sent Events for Progress
```typescript
// app/api/jobs/[jobId]/progress/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getJobProgress } from '@/lib/queue'

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { jobId } = params
  
  // Create Server-Sent Events stream
  const encoder = new TextEncoder()
  
  const customReadable = new ReadableStream({
    start(controller) {
      const sendUpdate = async () => {
        try {
          const progress = await getJobProgress(jobId)
          
          // Verify job belongs to user
          if (progress.userId !== session.user.id) {
            controller.error('Unauthorized')
            return
          }

          const data = `data: ${JSON.stringify(progress)}\n\n`
          controller.enqueue(encoder.encode(data))

          // Close stream if job is complete
          if (progress.status === 'completed' || progress.status === 'failed') {
            controller.close()
            return
          }

          // Continue polling
          setTimeout(sendUpdate, 1000)
        } catch (error) {
          console.error('Progress update error:', error)
          controller.error(error)
        }
      }

      sendUpdate()
    },
    cancel() {
      // Cleanup when client disconnects
    }
  })

  return new Response(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
```

### 3. Jobs List API with Pagination
```typescript
// app/api/jobs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { getJobs } from '@/lib/api-server'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  sortBy: z.enum(['createdAt', 'status', 'progress']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = querySchema.parse(Object.fromEntries(searchParams))

    const result = await getJobs({
      userId: session.user.id,
      ...query
    })

    return NextResponse.json(result)

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid query parameters',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Jobs API error:', error)
    return NextResponse.json({
      error: 'Failed to fetch jobs'
    }, { status: 500 })
  }
}
```

## Utility Libraries

### 1. Server-side API Client
```typescript
// lib/api-server.ts
import { prisma } from '@/lib/db'
import { unstable_cache } from 'next/cache'

export const getStatistics = unstable_cache(
  async (userId: string) => {
    const stats = await prisma.job.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    })

    const total = stats.reduce((acc, stat) => acc + stat._count, 0)
    const completed = stats.find(s => s.status === 'completed')?._count || 0
    const failed = stats.find(s => s.status === 'failed')?._count || 0

    return {
      totalJobs: total,
      completedJobs: completed,
      failedJobs: failed,
      successRate: total > 0 ? (completed / total) * 100 : 0
    }
  },
  ['user-stats'],
  {
    revalidate: 300, // 5 minutes
  }
)

export async function getJobs({
  userId,
  page = 1,
  limit = 20,
  status,
  sortBy = 'createdAt',
  sortOrder = 'desc'
}: {
  userId: string
  page?: number
  limit?: number
  status?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}) {
  const offset = (page - 1) * limit

  const where = {
    userId,
    ...(status && { status })
  }

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: offset,
      take: limit,
      select: {
        id: true,
        type: true,
        status: true,
        progress: true,
        createdAt: true,
        completedAt: true,
        error: true
      }
    }),
    prisma.job.count({ where })
  ])

  return {
    jobs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  }
}

export async function getJob(jobId: string) {
  return await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      result: true
    }
  })
}
```

### 2. Queue Management
```typescript
// lib/queue.ts
import Bull from 'bull'
import Redis from 'ioredis'
import { PDFFillerService } from '@/lib/pdf-processing'

const redis = new Redis(process.env.REDIS_URL!)

export const processingQueue = new Bull('pdf-processing', {
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
})

// Job processor
processingQueue.process('process-documents', async (job, done) => {
  const { id, documents, form, outputPath, userId } = job.data

  try {
    // Update job status
    await updateJobStatus(id, 'processing', 0)

    const pdfService = new PDFFillerService()
    
    // Process documents with progress updates
    const result = await pdfService.processMultiple(
      documents,
      form,
      outputPath,
      (progress) => {
        job.progress(progress)
        updateJobStatus(id, 'processing', progress)
      }
    )

    // Save results
    await updateJobStatus(id, 'completed', 100, result)
    
    done(null, result)
  } catch (error) {
    await updateJobStatus(id, 'failed', 0, null, error.message)
    done(error)
  }
})

export async function queueProcessingJob(jobData: any) {
  // Create job record in database
  const job = await prisma.job.create({
    data: {
      id: jobData.id,
      userId: jobData.userId,
      type: jobData.type,
      status: 'pending',
      progress: 0,
      inputFiles: jobData.documents.concat([jobData.form]),
      outputPath: jobData.outputPath
    }
  })

  // Add to queue
  await processingQueue.add('process-documents', jobData, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  })

  return job
}

async function updateJobStatus(
  jobId: string, 
  status: string, 
  progress: number, 
  result?: any, 
  error?: string
) {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status,
      progress,
      ...(result && { result }),
      ...(error && { error }),
      ...(status === 'completed' && { completedAt: new Date() })
    }
  })
}

export async function getJobProgress(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      userId: true,
      status: true,
      progress: true,
      error: true,
      result: true
    }
  })

  return job
}
```

This implementation provides a solid foundation for migrating from Vite + React to Next.js 15 with App Router, maintaining all the core functionality while leveraging Next.js's performance benefits and modern features.
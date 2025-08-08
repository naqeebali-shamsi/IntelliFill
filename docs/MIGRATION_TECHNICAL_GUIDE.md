# QuikAdmin Migration Technical Guide

**Companion to**: DEPENDENCY_UPGRADE_REPORT.md  
**Focus**: Technical implementation details and code migration examples

## Critical Migration Patterns

### 1. React Query → TanStack Query Migration

#### Current Implementation (v3.39.3)
```typescript
// OLD: react-query v3
import { useQuery, useMutation, QueryClient } from 'react-query';

const { data, isLoading, error } = useQuery('templates', fetchTemplates);

const mutation = useMutation(createTemplate, {
  onSuccess: () => {
    queryClient.invalidateQueries('templates');
  }
});
```

#### New Implementation (@tanstack/react-query v5.84.1)
```typescript
// NEW: @tanstack/react-query v5
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const { data, isLoading, error } = useQuery({
  queryKey: ['templates'],
  queryFn: fetchTemplates,
});

const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: createTemplate,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['templates'] });
  }
});
```

#### Migration Checklist
- [ ] Update package.json dependencies
- [ ] Replace all import statements
- [ ] Convert queries to object syntax
- [ ] Update mutation function signatures
- [ ] Update invalidateQueries calls

### 2. Material-UI v5 → v7 Migration

#### Theme Migration
```typescript
// OLD: MUI v5 theme
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    }
  }
});
```

```typescript
// NEW: MUI v7 with Pigment CSS (optional)
import { createTheme } from '@mui/material/styles';
import { createCssVarsTheme } from '@mui/material/styles/cssVars';

// Option 1: Traditional approach (backward compatible)
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    }
  }
});

// Option 2: CSS Variables approach (new)
const theme = createCssVarsTheme({
  palette: {
    primary: {
      main: '#1976d2',
    }
  }
});
```

#### Component Updates
```typescript
// Check for deprecated props
<DataGrid 
  // v6/v7 may have changed prop names
  rows={rows}
  columns={columns}
  // Review pagination props
  pageSize={25} // May be renamed
/>
```

### 3. Express v4 → v5 Migration

#### Middleware Changes
```typescript
// OLD: Express v4
import express from 'express';
import rateLimit from 'express-rate-limit';

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
```

```typescript
// NEW: Express v5 + express-rate-limit v8
import express from 'express';
import { rateLimit } from 'express-rate-limit';

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100, // Changed from 'max' to 'limit'
  message: 'Too many requests from this IP',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
});
```

#### Router Changes
```typescript
// OLD: Express v4 error handling
app.use((err, req, res, next) => {
  if (err) {
    res.status(500).json({ error: err.message });
  }
  next();
});
```

```typescript
// NEW: Express v5 async error handling
app.use(async (err, req, res, next) => {
  if (err) {
    res.status(500).json({ error: err.message });
  }
  next();
});

// Better async route handling in v5
app.get('/async-route', async (req, res) => {
  try {
    const data = await someAsyncOperation();
    res.json(data);
  } catch (error) {
    // Express v5 handles async errors automatically
    throw error;
  }
});
```

### 4. Redis v4 → v5 Migration

#### Connection Updates
```typescript
// OLD: Redis v4
import { createClient } from 'redis';

const client = createClient({
  url: 'redis://localhost:6379'
});

await client.connect();
```

```typescript
// NEW: Redis v5 with Client Side Caching
import { createClient } from 'redis';

const client = createClient({
  url: 'redis://localhost:6379',
  // New v5 feature: Client Side Caching
  clientSideCaching: true
});

await client.connect();

// Enhanced error handling in v5
client.on('error', (err) => {
  console.error('Redis Client Error', err);
});

client.on('connect', () => {
  console.log('Redis Client Connected');
});
```

### 5. React v18 → v19 Migration

#### Strict Mode Changes
```typescript
// OLD: React v18 StrictMode
import React from 'react';
import ReactDOM from 'react-dom/client';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

```typescript
// NEW: React v19 (StrictMode enhancements)
import React from 'react';
import ReactDOM from 'react-dom/client';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Note: React 19 has stricter StrictMode behavior
// Components may re-render more frequently in development
```

#### New Hooks Usage
```typescript
// NEW: React v19 features (if using)
import { use, startTransition } from 'react';

// use() hook for promises/context
function ComponentWithPromise({ dataPromise }) {
  const data = use(dataPromise);
  return <div>{data.title}</div>;
}
```

### 6. PDF.js-dist v3 → v5 Migration

#### Worker Configuration
```typescript
// OLD: PDF.js v3.11.174
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.entry';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.js';
```

```typescript
// NEW: PDF.js v5.4.54
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// Enhanced loading with better error handling
async function loadPDF(file: File) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      // New v5 options
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.54/cmaps/',
      cMapPacked: true,
    }).promise;
    
    return pdf;
  } catch (error) {
    console.error('PDF loading failed:', error);
    throw error;
  }
}
```

## Testing Strategy per Component

### React Testing Updates
```typescript
// Update testing utilities for React 19
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';

// New test setup for TanStack Query
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

function renderWithProviders(ui: React.ReactElement) {
  const testQueryClient = createTestQueryClient();
  
  return render(
    <QueryClientProvider client={testQueryClient}>
      {ui}
    </QueryClientProvider>
  );
}
```

### API Testing Updates
```typescript
// Express v5 testing with supertest
import request from 'supertest';
import { app } from '../src/app';

describe('API Endpoints', () => {
  test('POST /api/templates', async () => {
    const response = await request(app)
      .post('/api/templates')
      .send({ name: 'Test Template' })
      .expect(201);
      
    expect(response.body).toHaveProperty('id');
  });
});
```

## Performance Optimization

### Bundle Size Analysis
```json
// package.json - analyze bundle after upgrades
{
  "scripts": {
    "analyze": "npm run build && npx vite-bundle-analyzer dist"
  }
}
```

### MUI v7 Bundle Optimization
```typescript
// Tree shaking with MUI v7
import { Button } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

// Instead of
// import * from '@mui/material';
```

## Environment Configuration

### Node.js Version Requirements
```json
// package.json engines update
{
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}
```

### TypeScript Configuration
```json
// tsconfig.json updates for newer libraries
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true
  }
}
```

## Rollback Strategy

### Version Pinning for Safety
```json
// package.json - pin versions during migration
{
  "dependencies": {
    "react": "18.2.0", // Keep old version during testing
    "@mui/material": "5.14.18" // Upgrade one at a time
  }
}
```

### Git Strategy
```bash
# Create migration branches for each major component
git checkout -b upgrade/react-19
git checkout -b upgrade/mui-v7  
git checkout -b upgrade/express-v5

# Merge incrementally after testing
```

## Monitoring & Alerts

### Performance Monitoring
```typescript
// Add performance tracking during migration
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  console.log('Performance metric:', metric);
  // Send to your analytics service
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

### Error Tracking
```typescript
// Enhanced error boundary for React 19
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div>
      <h2>Something went wrong:</h2>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

// Wrap app with error boundary
<ErrorBoundary FallbackComponent={ErrorFallback}>
  <App />
</ErrorBoundary>
```

---

**This guide should be used alongside the main DEPENDENCY_UPGRADE_REPORT.md for complete migration planning.**
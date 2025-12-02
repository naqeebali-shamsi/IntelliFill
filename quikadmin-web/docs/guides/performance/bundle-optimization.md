# Bundle Optimization

Reducing bundle size and improving load performance.

## Analysis

```bash
# Analyze bundle size
bunx vite-bundle-visualizer

# Build with stats
bun run build --mode production
```

## Optimization Strategies

### 1. Code Splitting
```typescript
const Dashboard = lazy(() => import('./pages/Dashboard'))
```

### 2. Tree Shaking
```typescript
import { Button } from '@/components/ui/button'  // Good
```

### 3. Dynamic Imports
```typescript
const loadChart = () => import('chart.js')
```

[Back to Performance](./README.md)

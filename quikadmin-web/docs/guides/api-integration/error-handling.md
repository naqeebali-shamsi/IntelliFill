# Error Handling

Comprehensive error handling patterns for API integration.

## Error Types

### Network Errors
```typescript
try {
  const response = await apiClient.get('/documents')
} catch (error) {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      // Network error
      showNotification('Network error. Please check your connection.')
    }
  }
}
```

### HTTP Errors
```typescript
if (error.response) {
  switch (error.response.status) {
    case 401:
      // Unauthorized - redirect to login
      break
    case 403:
      // Forbidden
      break
    case 404:
      // Not found
      break
    case 500:
      // Server error
      break
  }
}
```

### Validation Errors
```typescript
if (error.response?.status === 422) {
  const errors = error.response.data.errors
  // Show field-specific errors
}
```

## Global Error Handler

```typescript
// src/services/api/client.ts
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle errors globally
    if (error.response?.status === 401) {
      // Redirect to login
    }
    return Promise.reject(error)
  }
)
```

## Error Boundaries

```typescript
import { ErrorBoundary } from 'react-error-boundary'

<ErrorBoundary FallbackComponent={ErrorFallback}>
  <App />
</ErrorBoundary>
```

[Back to API Integration](./README.md)

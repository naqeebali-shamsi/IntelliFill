# API Integration Guide

Working with backend APIs in QuikAdmin Web.

## API Client

```typescript
// src/services/api/client.ts
import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

## Making API Calls

```typescript
// src/services/api/documents.ts
import { apiClient } from './client'

export const documentApi = {
  list: () => apiClient.get('/documents'),
  get: (id: string) => apiClient.get(`/documents/${id}`),
  create: (data: CreateDocumentDto) => apiClient.post('/documents', data),
  update: (id: string, data: UpdateDocumentDto) => 
    apiClient.patch(`/documents/${id}`, data),
  delete: (id: string) => apiClient.delete(`/documents/${id}`),
}
```

## Multipart Uploads (FormData)

When sending `FormData`, override the default JSON header so the backend receives files.

```typescript
const formData = new FormData()
formData.append('files', file)

await apiClient.post('/smart-profile/detect-types', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
})
```

## With React Query

```typescript
import { useQuery, useMutation } from 'react-query'
import { documentApi } from '@/services/api/documents'

export function useDocuments() {
  return useQuery('documents', documentApi.list)
}

export function useCreateDocument() {
  return useMutation(documentApi.create)
}
```

## Error Handling

See: [Error Handling Guide](./error-handling.md)

[Back to Guides](../README.md)

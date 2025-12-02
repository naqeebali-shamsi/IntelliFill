# IntelliFill Zustand Store Architecture

A comprehensive, scalable state management solution built with Zustand, TypeScript, and advanced middleware for the IntelliFill document processing platform.

## 🏗️ Architecture Overview

The store architecture follows a **modular, domain-driven design** with five specialized stores:

```
src/stores/
├── types.ts              # Shared TypeScript interfaces
├── middleware.ts         # Advanced Zustand middleware
├── authStore.ts          # Authentication & user management
├── uiStore.ts            # Theme, modals, notifications, loading states
├── documentStore.ts      # File uploads, processing, real-time updates
├── templateStore.ts      # Form templates, fields, validation rules
├── settingsStore.ts      # User preferences, app configuration
├── index.ts              # Central export hub
└── README.md             # This file
```

## 🎯 Key Features

### ⚡ Performance Optimized
- **Immer integration** for immutable updates
- **Selective persistence** with localStorage
- **Performance monitoring** middleware
- **Memory leak prevention**
- **Efficient re-renders** with precise selectors

### 🛡️ Enterprise-Grade Reliability
- **Error boundaries** with graceful fallbacks
- **Automatic retry logic** for failed operations
- **Validation middleware** with schema checking
- **Undo/redo functionality** for critical operations
- **Real-time synchronization** with WebSocket support

### 🔧 Developer Experience
- **Full TypeScript support** with strict typing
- **Redux DevTools integration** for debugging
- **Comprehensive logging** in development
- **Hot module replacement** support
- **Auto-completion** for all actions and selectors

### 🎨 Advanced UI Management
- **Theme system** with system preference detection
- **Modal stack management** with z-index handling
- **Toast notification system** with queue management
- **Loading state coordination** across components
- **Responsive breakpoint detection**

## 📦 Store Breakdown

### 🔐 Auth Store (`authStore.ts`)
Manages user authentication, session handling, and security features.

```typescript
const { user, login, logout, refreshToken } = useAuthStore();

// Security features
await changePassword(currentPassword, newPassword);
const qrCode = await enableTwoFactor();
await verifyTwoFactor(code);
```

**Key Features:**
- JWT token management with automatic refresh
- Account lockout after failed attempts
- Two-factor authentication support
- Session timeout handling
- Device fingerprinting
- Password change enforcement

### 🎨 UI Store (`uiStore.ts`)
Handles theme, modals, notifications, and all UI-related state.

```typescript
const { theme, modals, notifications } = useUIStore();

// Theme management
setTheme('dark');
toggleTheme();

// Modal management
const modalId = openModal({
  component: 'ConfirmDialog',
  props: { title: 'Confirm Action' }
});

// Notifications
addNotification({
  type: 'success',
  title: 'Upload Complete',
  message: 'Your files have been processed successfully'
});
```

**Key Features:**
- System theme detection and switching
- Modal stack with focus trap management
- Toast notifications with auto-dismiss
- Responsive breakpoint tracking
- Accessibility settings (reduced motion, high contrast)
- Loading state coordination

### 📄 Document Store (`documentStore.ts`)
Manages file uploads, document processing, and real-time job updates.

```typescript
const { files, jobs, addFiles, processDocuments } = useDocumentStore();

// File management
await addFiles(selectedFiles);
const jobId = await createJob(documents, templateId);

// Real-time updates
connectWebSocket();
// Automatically updates job progress via WebSocket
```

**Key Features:**
- Drag & drop file uploads with progress tracking
- Background job processing with queue management
- Real-time updates via WebSocket connection
- Retry logic for failed jobs
- Pagination and filtering for large datasets
- File validation and type checking

### 📝 Template Store (`templateStore.ts`)
Handles form templates, field definitions, and validation rules.

```typescript
const { templates, startEditing, addField } = useTemplateStore();

// Template editing with undo/redo
startEditing(templateId);
addField({
  type: 'text',
  name: 'firstName',
  label: 'First Name',
  required: true
});
```

**Key Features:**
- Visual template editor with drag & drop
- Field validation with custom rules
- Template versioning and history
- Import/export functionality (JSON, XML)
- Usage analytics and optimization suggestions
- Bulk operations for template management

### ⚙️ Settings Store (`settingsStore.ts`)
Manages user preferences, app configuration, and system settings.

```typescript
const { userPreferences, appSettings, updatePreferences } = useSettingsStore();

// Webhook management
const webhookId = addWebhook({
  name: 'Slack Notifications',
  url: 'https://hooks.slack.com/...',
  events: ['job_complete', 'job_error']
});

// API key management
const apiKey = await generateApiKey('Mobile App', ['read', 'write']);
```

**Key Features:**
- Hierarchical settings with validation
- Webhook and API key management
- Connected services integration
- Settings backup and restore
- Import/export configuration
- Feature flag management

## 🔧 Advanced Middleware

### Performance Monitoring
```typescript
// Automatically tracks store performance
const metrics = useTemplateStore(state => state.__performance.getMetrics());
console.log(`Updates: ${metrics.updateCount}, Memory: ${metrics.memoryUsage}MB`);
```

### Error Boundaries
```typescript
// Graceful error handling with fallback states
createMiddleware({
  errorBoundary: true,
  errorBoundaryOptions: {
    onError: (error, state) => notifyErrorService(error),
    fallbackState: defaultState,
    resetOnError: true
  }
})
```

### Undo/Redo
```typescript
// Available on template and settings stores
const { undo, redo, canUndo, canRedo } = useTemplateStore();

// Automatic history tracking
updateField(fieldId, { name: 'New Name' }); // Saves to history
undo(); // Reverts the change
```

### Smart Persistence
```typescript
// Selective persistence configuration
persistOptions: {
  partialize: (state) => ({
    // Only persist essential data
    user: state.user,
    preferences: state.preferences,
    // Skip temporary states
  }),
  version: 1,
  migrate: (persistedState, version) => {
    // Handle schema migrations
    return migrateToLatestVersion(persistedState, version);
  }
}
```

## 🚀 Usage Patterns

### Basic Store Usage
```typescript
import { useAuthStore, useUIStore } from '@/stores';

function MyComponent() {
  // Direct store access
  const user = useAuthStore(state => state.user);
  const setTheme = useUIStore(state => state.setTheme);
  
  // Selector for multiple values
  const { isLoading, error } = useAuthStore(state => ({
    isLoading: state.isLoading,
    error: state.error
  }));
  
  return <div>...</div>;
}
```

### Custom Hooks
```typescript
import { useAuth, useTheme } from '@/stores';

function LoginForm() {
  const { login, isLoading, error } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  return <form>...</form>;
}
```

### Cross-Store Operations
```typescript
import { combinedSelectors, useGlobalLoading } from '@/stores';

function App() {
  const isLoading = useGlobalLoading();
  const canAccessFeature = combinedSelectors.canAccessFeature('advancedOCR');
  
  return <div>...</div>;
}
```

### Store Initialization
```typescript
import { initializeStores } from '@/stores';

// In your app root
useEffect(() => {
  initializeStores().then(() => {
    console.log('All stores initialized');
  });
}, []);
```

## 🔄 Real-Time Features

### WebSocket Integration
```typescript
// Automatic connection management
useEffect(() => {
  const { connectWebSocket, disconnectWebSocket } = useDocumentStore.getState();
  
  connectWebSocket();
  return () => disconnectWebSocket();
}, []);
```

### Event Handling
```typescript
// Real-time job updates
const handleRealtimeEvent = (event) => {
  switch (event.type) {
    case 'job_update':
      updateJobProgress(event.data);
      break;
    case 'job_complete':
      showSuccessNotification(event.data);
      break;
  }
};
```

## 🎯 Best Practices

### 1. Use Selectors for Performance
```typescript
// ❌ Bad - causes re-renders on any state change
const state = useTemplateStore();

// ✅ Good - only re-renders when templates change
const templates = useTemplateStore(state => state.templates);
```

### 2. Batch Related Updates
```typescript
// ✅ Use Immer for multiple updates in one action
const updateMultipleFields = (updates) => 
  set((draft) => {
    updates.forEach(({ id, changes }) => {
      const field = draft.fields.find(f => f.id === id);
      if (field) Object.assign(field, changes);
    });
  });
```

### 3. Handle Async Operations Properly
```typescript
// ✅ Proper async handling with loading states
const createTemplate = async (template) => {
  set(draft => { draft.isLoading = true; });
  
  try {
    const result = await api.post('/templates', template);
    set(draft => { 
      draft.templates.push(result.data);
      draft.isLoading = false;
    });
  } catch (error) {
    set(draft => { 
      draft.error = error.message;
      draft.isLoading = false;
    });
  }
};
```

### 4. Use TypeScript Strictly
```typescript
// ✅ Strict typing prevents runtime errors
interface TemplateActions {
  updateTemplate: (id: string, updates: Partial<Template>) => Promise<void>;
}
```

## 📊 Performance Metrics

The architecture includes built-in performance monitoring:

- **State Updates**: Track frequency and duration
- **Memory Usage**: Monitor store size and growth
- **Selector Performance**: Identify expensive selectors
- **WebSocket Events**: Monitor real-time update frequency
- **Persistence Overhead**: Track save/load performance

## 🔍 Debugging

### Redux DevTools
All stores are connected to Redux DevTools with:
- Time-travel debugging
- Action replay
- State inspection
- Performance profiling

### Development Logging
```typescript
// Automatic action logging in development
logger: process.env.NODE_ENV === 'development'
```

### Store Inspection
```typescript
import { storeDevtools } from '@/stores';

// Get all store states
const allState = storeDevtools.getAllState();

// Get performance metrics
const metrics = storeDevtools.getAllMetrics();
```

## 🚀 Migration Guide

### From useState/useContext
```typescript
// Before
const [user, setUser] = useState(null);
const [loading, setLoading] = useState(false);

// After
const { user, isLoading, login } = useAuthStore();
```

### From Redux
```typescript
// Before
const dispatch = useDispatch();
const user = useSelector(state => state.auth.user);
dispatch(loginUser(credentials));

// After
const { user, login } = useAuthStore();
await login(credentials);
```

## 🛠️ Development Setup

1. **Install Dependencies**
```bash
npm install zustand immer
```

2. **Import Stores**
```typescript
import { useAuthStore, useUIStore } from '@/stores';
```

3. **Initialize in App Root**
```typescript
import { initializeStores } from '@/stores';

function App() {
  useEffect(() => {
    initializeStores();
  }, []);
}
```

## 📈 Future Enhancements

- **Offline Support**: Queue actions when offline
- **Data Synchronization**: Conflict resolution for concurrent updates
- **Advanced Caching**: Intelligent cache invalidation
- **Plugin System**: Extensible middleware architecture
- **A/B Testing**: Feature flag-based experimentation
- **Analytics**: User behavior tracking and insights

---

This architecture provides a robust, scalable, and maintainable state management solution that grows with your application's needs while maintaining excellent developer experience and performance characteristics.
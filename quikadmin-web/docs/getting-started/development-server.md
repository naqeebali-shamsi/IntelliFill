# Development Server

Learn how to run and work with the QuikAdmin Web development server for local development.

## Starting the Server

### Quick Start

```bash
# Start development server (default)
bun run dev

# Or with npm
npm run dev

# Server will start on http://localhost:5173
```

**Expected output:**
```
VITE v4.5.14  ready in 423 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
➜  press h to show help
```

## Server Options

### Custom Port

```bash
# Use different port
bun run dev --port 3001

# Or set in vite.config.ts:
export default defineConfig({
  server: {
    port: 3001
  }
})
```

### Network Access

```bash
# Expose to local network
bun run dev --host

# Access from other devices:
# http://your-ip-address:5173
```

### HTTPS (Local SSL)

```bash
# For HTTPS testing
bun run dev --https

# Or configure in vite.config.ts:
export default defineConfig({
  server: {
    https: true
  }
})
```

## Development Features

### Hot Module Replacement (HMR)

Changes are reflected instantly without full page reload:

- **Component updates**: Preserves state
- **CSS changes**: Instant updates
- **State changes**: May require reload

```typescript
// HMR in action
if (import.meta.hot) {
  import.meta.hot.accept()
}
```

### Fast Refresh

React Fast Refresh preserves component state:
- Edit component code
- Save file
- See changes instantly
- Component state maintained

### TypeScript Checking

```bash
# Type checking runs in parallel
# Errors appear in:
# 1. Terminal (on save)
# 2. Browser console
# 3. VS Code editor

# Manual type check:
bun run typecheck
```

## Development Workflow

### Typical Development Session

```bash
# 1. Start dev server
bun run dev

# 2. Open browser
# http://localhost:5173

# 3. Make changes
# Edit files in src/

# 4. Changes auto-reload
# Check browser for updates

# 5. Run tests (separate terminal)
bun run test:watch

# 6. Check for errors
# Monitor terminal and browser console
```

### Multi-Terminal Setup

**Terminal 1: Dev Server**
```bash
bun run dev
```

**Terminal 2: Tests**
```bash
bun run test:watch
```

**Terminal 3: Backend API**
```bash
cd ../quikadmin
mix phx.server
```

**Terminal 4: Commands**
```bash
# Available for running commands
git status
bun run typecheck
```

## Browser DevTools

### React DevTools

**Installation:**
- [Chrome Extension](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
- [Firefox Extension](https://addons.mozilla.org/en-US/firefox/addon/react-devtools/)

**Usage:**
1. Open DevTools (F12)
2. Navigate to "Components" tab
3. Inspect component hierarchy
4. View props and state

### Zustand DevTools

**Installation:**
- [Redux DevTools Extension](https://github.com/zalmoxisus/redux-devtools-extension)

**Usage:**
1. Open DevTools
2. Navigate to "Redux" tab
3. Monitor state changes
4. Time-travel debugging

### Network Tab

Monitor API calls:
```
1. Open DevTools
2. Click "Network" tab
3. Filter by "Fetch/XHR"
4. Inspect API requests/responses
```

### Console

```javascript
// Useful console commands

// Inspect store
window.__stores  // If devtools enabled

// Performance timing
console.time('operation')
// ... code
console.timeEnd('operation')

// Component debugging
console.log('Props:', props)
```

## Environment Modes

### Development Mode
```bash
# Default mode
bun run dev

# Features:
# - Source maps enabled
# - Detailed error messages
# - Development warnings
# - HMR enabled
```

### Preview Mode
```bash
# Build and preview production
bun run build
bun run preview

# Features:
# - Production optimizations
# - Minified code
# - No dev warnings
# - Test production build locally
```

## Configuration

### Vite Configuration

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    port: 5173,
    host: true,
    open: true,  // Auto-open browser
    cors: true,
    proxy: {
      // Proxy API requests
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
```

### Environment Variables

```env
# .env.local (for local overrides)
VITE_API_URL=http://localhost:3000/api
VITE_DEBUG=true
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL
const isDev = import.meta.env.DEV
const isProd = import.meta.env.PROD
```

## Performance Monitoring

### Vite Performance

```bash
# Check build performance
bun run build --debug

# Analyze bundle
bunx vite-bundle-visualizer
```

### React Performance

```typescript
// Use React Profiler
import { Profiler } from 'react'

<Profiler id="MyComponent" onRender={onRenderCallback}>
  <MyComponent />
</Profiler>
```

### Lighthouse

```bash
# Run Lighthouse in Chrome DevTools
# 1. Open DevTools
# 2. Click "Lighthouse" tab
# 3. Click "Analyze page load"
```

## Debugging

### Debug Mode

```bash
# Enable debug logging
VITE_DEBUG=true bun run dev

# Or in .env:
VITE_DEBUG=true
```

### Source Maps

Source maps are enabled in development:
- See original TypeScript in DevTools
- Set breakpoints in source files
- Step through code with debugger

```typescript
// Add debugger statement
function myFunction() {
  debugger  // Execution will pause here
  // ... code
}
```

### VS Code Debugging

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/src"
    }
  ]
}
```

## Common Tasks

### Clear Cache

```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Restart server
bun run dev
```

### Update Dependencies

```bash
# Update all dependencies
bun update

# Update specific package
bun update react react-dom
```

### Port Conflicts

```bash
# Check what's using port 5173
# macOS/Linux:
lsof -ti:5173

# Kill process
lsof -ti:5173 | xargs kill -9

# Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

## Keyboard Shortcuts

When dev server is running:

- `h` - Show help
- `r` - Restart server
- `u` - Show URL
- `o` - Open in browser
- `c` - Clear console
- `q` - Quit server

## Error Handling

### Common Errors

**Port in use:**
```bash
Error: Port 5173 is already in use
Solution: Change port or kill process
```

**Module not found:**
```bash
Error: Cannot find module 'X'
Solution: bun install
```

**TypeScript errors:**
```bash
Error: Type 'X' is not assignable to type 'Y'
Solution: Check types, run typecheck
```

### Error Recovery

```bash
# Full reset
rm -rf node_modules
rm bun.lockb
rm -rf node_modules/.vite
bun install
bun run dev
```

## Best Practices

### Development Workflow
1. Start server before making changes
2. Keep terminal visible to see errors
3. Use browser console for debugging
4. Run tests alongside development
5. Check TypeScript errors regularly

### Performance
1. Close unused browser tabs
2. Limit number of running servers
3. Use production mode for testing
4. Profile performance-critical code
5. Monitor bundle size

### Code Quality
1. Fix TypeScript errors immediately
2. Address console warnings
3. Use ESLint auto-fix
4. Format code with Prettier
5. Write tests for new features

## Troubleshooting

### Server Won't Start

```bash
# Check Node/Bun version
bun --version

# Clear all caches
rm -rf node_modules/.vite
rm -rf dist

# Reinstall
bun install
```

### Changes Not Reflecting

```bash
# Hard refresh browser
# Cmd/Ctrl + Shift + R

# Clear Vite cache
rm -rf node_modules/.vite

# Restart server
```

### Slow HMR

```bash
# Reduce file watching
# Add to .gitignore:
node_modules
dist
.vite

# Exclude from indexing:
# VS Code settings.json
"files.watcherExclude": {
  "**/node_modules/**": true
}
```

## Next Steps

- [Understand Project Structure](./project-structure.md)
- [Learn Component Development](../guides/components/README.md)
- [Explore State Management](../guides/state-management/zustand-basics.md)
- [Review Testing Guide](../guides/testing/README.md)

## Additional Resources

- [Vite Dev Server](https://vitejs.dev/guide/dev-server.html)
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)

---

[Back to Getting Started](./README.md) | [Previous: Installation](./installation.md) | [Next: Project Structure](./project-structure.md)

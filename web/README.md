# QuikAdmin Frontend

Modern React frontend for QuikAdmin - an intelligent document processing platform with Supabase authentication.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Bun 1.0+
- Supabase account ([Sign up free](https://app.supabase.com))
- Backend API running (see main README.md)

### Installation

```bash
# Clone and navigate to web directory
cd web

# Install dependencies
bun install
# or
npm install

# Copy environment template
cp .env.example .env

# Add your Supabase credentials to .env
# Get them from: https://app.supabase.com > Your Project > Settings > API
```

### Environment Setup

Edit `web/.env`:

```env
# Supabase Configuration (Required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# API Configuration
VITE_API_URL=http://localhost:3002/api
```

**Where to find Supabase credentials:**
1. Go to [app.supabase.com](https://app.supabase.com)
2. Select your project (or create one)
3. Navigate to **Settings** → **API**
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

⚠️ **Security**: Never use the `service_role` key on the frontend!

### Development

```bash
# Start development server
bun run dev
# or
npm run dev

# Open browser
http://localhost:5173
```

### Production Build

```bash
# Build for production
bun run build
# or
npm run build

# Preview production build
bun run preview
# or
npm run preview
```

## 📦 Tech Stack

### Core

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **Bun** - Fast package manager & runtime

### State Management

- **Zustand** - Lightweight state management
- **React Query** - Server state & caching

### UI Components

- **Radix UI** - Unstyled, accessible components
- **Tailwind CSS 4** - Utility-first styling
- **Lucide React** - Icon library
- **Sonner** - Toast notifications

### Authentication

- **Supabase Auth SDK** - Modern auth solution
  - Email/password authentication
  - Automatic token refresh
  - Session persistence
  - OAuth ready (future)

### Routing

- **React Router 6** - Client-side routing
- Protected routes with auth checks

### HTTP Client

- **Axios** - HTTP requests with interceptors
- Automatic auth token injection
- Request/response error handling

## 📁 Project Structure

```
web/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── ui/          # Base UI components (shadcn-like)
│   │   ├── ProtectedRoute.tsx
│   │   └── modern-layout.tsx
│   ├── pages/           # Page components
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Dashboard.tsx
│   │   └── ...
│   ├── stores/          # Zustand state stores
│   │   ├── simpleAuthStore.ts  # Auth state
│   │   ├── uiStore.ts          # UI state
│   │   └── types.ts            # Store types
│   ├── services/        # API services
│   │   └── api.ts       # Axios instance & interceptors
│   ├── lib/             # Library configurations
│   │   └── supabase.ts  # Supabase client
│   ├── hooks/           # Custom React hooks
│   ├── utils/           # Utility functions
│   ├── App.tsx          # Main app component
│   └── main.tsx         # App entry point
├── public/              # Static assets
├── .env.example         # Environment template
├── vite.config.ts       # Vite configuration
├── tailwind.config.ts   # Tailwind configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies & scripts
```

## 🔐 Authentication

### Supabase Integration

This app uses **Supabase Auth SDK** for authentication:

```typescript
// Login
import { useAuthStore } from '@/stores/simpleAuthStore';

function LoginPage() {
  const { login, isLoading } = useAuthStore();

  const handleLogin = async () => {
    await login({
      email: 'user@example.com',
      password: 'password123',
      rememberMe: true,
    });
    // Auto-redirects on success
  };
}
```

### Features

- ✅ Email/password authentication
- ✅ Automatic token refresh
- ✅ Session persistence (localStorage)
- ✅ Protected routes
- ✅ Real-time auth state sync
- ✅ Multi-tenant support (Neon integration)
- ⏳ OAuth providers (future)

### Protected Routes

```typescript
import { ProtectedRoute } from '@/components/ProtectedRoute';

<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />
```

**See detailed docs**: `../docs/400-frontend/401-authentication.md`

## 🛠️ Available Scripts

### Development

```bash
bun run dev           # Start dev server
bun run build         # Build for production
bun run preview       # Preview production build
bun run typecheck     # Run TypeScript type checking
```

### Testing

```bash
bun run test          # Run unit tests
bun run test:ui       # Run tests with UI
bun run test:coverage # Run tests with coverage
bun run cypress:open  # Open Cypress E2E tests
bun run test:e2e      # Run E2E tests headless
```

### Code Quality

```bash
bun run typecheck     # TypeScript type checking
# Linting and formatting (add if needed)
```

## 🎨 UI Components

### Radix UI + Tailwind

Components built with:
- **Radix UI**: Unstyled, accessible primitives
- **Tailwind CSS**: Utility-first styling
- **CVA**: Class variance authority for variants

Example:

```typescript
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

<Button variant="primary" size="lg">
  Click me
</Button>

<Input type="email" placeholder="Enter email" />
```

### Available Components

- `Button` - Buttons with variants
- `Input` - Text inputs
- `Card` - Content cards
- `Dialog` - Modal dialogs
- `Select` - Dropdown selects
- `Tabs` - Tab navigation
- `Alert` - Alert messages
- And more in `src/components/ui/`

## 🌐 API Integration

### Axios Configuration

Automatic auth token injection:

```typescript
// src/services/api.ts
import api from '@/services/api';

// Token automatically included
const response = await api.get('/documents');
const documents = response.data;
```

### Request Interceptor

- Adds `Authorization: Bearer <token>` to all requests
- Adds `X-Company-ID` header for multi-tenant apps
- Multiple fallback levels for token retrieval

### Response Interceptor

- Automatic token refresh on 401 errors
- Retry failed requests with new token
- Logout on refresh failure

## 🔧 Configuration

### Vite Config

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3002',
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
```

### TypeScript Config

Strict mode enabled for maximum type safety:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Tailwind Config

Using Tailwind CSS 4 (beta):

```typescript
// tailwind.config.ts
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Custom colors
      },
    },
  },
};
```

## 🐛 Troubleshooting

### "Cannot find module '@supabase/supabase-js'"

```bash
# Reinstall dependencies
bun install
# or
npm install
```

### "Missing VITE_SUPABASE_URL"

1. Copy `.env.example` to `.env`
2. Add Supabase credentials
3. Restart dev server

### TypeScript Errors

```bash
# Check for type errors
bun run typecheck

# Common fixes:
- Clear node_modules and reinstall
- Check tsconfig.json paths
- Verify all types are imported
```

### Build Fails

```bash
# Clear build cache
rm -rf dist

# Rebuild
bun run build
```

### Session Not Persisting

- Check browser localStorage permissions
- Disable private browsing
- Verify `persistSession: true` in `lib/supabase.ts`

## 📚 Documentation

- **Authentication Guide**: `../docs/400-frontend/401-authentication.md`
- **API Routes**: `../docs/300-api/`
- **Backend Setup**: `../README.md`
- **Supabase Docs**: https://supabase.com/docs/guides/auth

## 🚢 Deployment

### Build for Production

```bash
# Build optimized bundle
bun run build

# Output in dist/
ls dist/
```

### Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Environment Variables

Set these in your hosting platform:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=https://your-api-domain.com/api
```

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes
3. Run tests: `bun run test`
4. Type check: `bun run typecheck`
5. Commit: `git commit -m "feat: add feature"`
6. Push: `git push origin feature/my-feature`
7. Create Pull Request

## 📝 License

MIT License - see main project README for details

---

**Need Help?**
- Check `../docs/400-frontend/` for detailed guides
- Review Supabase docs: https://supabase.com/docs
- Open an issue on GitHub

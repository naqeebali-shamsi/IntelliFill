# QuikAdmin Web - Frontend Application

This is the standalone frontend application for QuikAdmin/IntelliFill, built with React, TypeScript, Vite, and TailwindCSS.

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Run tests
bun run test:vitest

# Build for production
bun run build
```

## 📁 Project Structure

```
quikadmin-web/
├── src/
│   ├── components/      # React components
│   ├── pages/          # Page components
│   ├── hooks/          # Custom React hooks
│   ├── services/       # API services
│   ├── stores/         # Zustand stores
│   ├── utils/          # Utility functions
│   └── types/          # TypeScript types
├── public/             # Static assets
├── dist/               # Build output (generated)
└── tests/             # Test files
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### API Integration

The web app communicates with the backend API at `http://localhost:3000/api` (or configured via `VITE_API_URL`).

Make sure the backend API is running before starting the frontend.

## 🧪 Testing

Tests are configured with Vitest and React Testing Library:

```bash
# Run all tests
bun run test:vitest

# Run tests in watch mode
bun run test:vitest --watch

# Run tests with UI
bun run test:ui

# Run tests with coverage
bun run test:coverage
```

## 🏗️ Building

```bash
# Build for production
bun run build

# Preview production build
bun run preview
```

The production build will be output to the `dist/` directory.

## 📦 Dependencies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TailwindCSS** - Styling
- **Zustand** - State management
- **React Query** - Data fetching and caching
- **React Router** - Navigation
- **Framer Motion** - Animations
- **Recharts** - Data visualization
- **Sonner** - Toast notifications

## 🔗 Integration with Backend

This frontend is designed to work with the QuikAdmin backend API. When running locally:

1. Start the backend API (usually on port 3000)
2. Start this frontend (usually on port 5173)
3. The frontend will proxy API requests to the backend

## 📝 Notes

- This is the **canonical frontend** for IntelliFill/QuikAdmin (as of 2025-11-07)
- The nested `quikadmin/web/` directory has been archived to eliminate duplication
- **Package Manager:** Use Bun exclusively (do NOT use npm or yarn)
- Path aliases are configured via `tsconfig.json` (`@/*` maps to `src/*`)
- The alias resolution is handled by `vite-tsconfig-paths` plugin

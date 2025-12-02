import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // Test configuration (only used by vitest, ignored by vite)
  ...(process.env.VITEST ? {
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      include: [
        'src/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}',
        'src/**/*.{test,spec}.{js,ts,jsx,tsx}'
      ],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/test/',
          '**/*.d.ts',
          '**/*.config.*',
          '**/mockData',
        ],
      },
    },
  } : {}),
  server: {
    port: Number(process.env.PORT) || 8080,
    host: '0.0.0.0',
    strictPort: true,
    hmr: {
      host: 'localhost',
      port: Number(process.env.PORT) || 8080,
      protocol: 'ws'
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React vendor chunk
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI library chunk
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-label',
            '@radix-ui/react-slot'
          ],
          // State management and data fetching
          'vendor-state': ['zustand', 'react-query', 'axios'],
          // Form handling
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // Utilities
          'vendor-utils': ['clsx', 'tailwind-merge', 'class-variance-authority', 'date-fns']
        },
      },
    },
    chunkSizeWarningLimit: 600,
  }
})

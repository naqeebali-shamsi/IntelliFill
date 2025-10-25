import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: Number(process.env.PORT) || 8080,
    host: '0.0.0.0',
    strictPort: true,
    hmr: {
      host: 'localhost',
      port: Number(process.env.PORT) || 8080,
      protocol: 'ws'
    }
  }
})
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

// https://vite.dev/config/
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['@emotion/react', '@emotion/styled', '@mui/material', '@mui/x-date-pickers', 'mapbox-gl', 'react-map-gl'],
  },
  server: {
    host: '0.0.0.0', // Allow access from network
    port: 5173, // Default Vite port
  },
})

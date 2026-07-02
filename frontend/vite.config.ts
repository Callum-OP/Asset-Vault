import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Backend target for the dev proxy. Override with VITE_API_TARGET if the
// backend runs on a different host/port. Use 127.0.0.1 (not localhost) so
// Windows doesn't try IPv6 ::1 first while uvicorn binds IPv4.
const API_TARGET = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/health': API_TARGET,
      '/api': API_TARGET,
    },
  },
})

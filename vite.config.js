import { defineConfig } from 'vite'

export default defineConfig({
  base: '/HubspotDashboard/',  
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser'
  }
})

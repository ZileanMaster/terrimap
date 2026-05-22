import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@facades': resolve(__dirname, 'facades'),
      '@types-domain': resolve(__dirname, 'types'),
    },
  },
  server: {
    port: 5173,
  },
  optimizeDeps: {
    include: ['leaflet-draw', 'leaflet.markercluster'],
  },
})

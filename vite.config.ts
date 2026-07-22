import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // This application is published beneath the tools host rather than at its root.
  base: '/TrackSense-Lab/',
  plugins: [react()],
  preview: {
    allowedHosts: ['tools.easonjan.top'],
  },
})

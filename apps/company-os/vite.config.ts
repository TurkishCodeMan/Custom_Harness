import { defineConfig } from 'vite'

export default defineConfig({
  esbuild: {
    jsx: 'automatic'
  },
  server: {
    port: 3090,
    host: '0.0.0.0',
    watch: {
      usePolling: true,
      interval: 1000
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3080',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://127.0.0.1:3080',
        ws: true
      }
    }
  }
})

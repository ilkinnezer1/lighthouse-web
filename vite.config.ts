import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// `/api` proxied same-origin so the session cookie works (API has no CORS/prefix).
const API_TARGET = 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/socket.io': {
        target: API_TARGET,
        changeOrigin: true,
        ws: true,
      },
      // Dev-only: routes the terminal at the local mock exec gateway
      // (~/lighthouse-exec-mock) same-origin, so it works like /socket.io.
      // Inert unless VITE_EXEC_PATH=/exec-io is set when starting the client.
      '/exec-io': {
        target: 'http://localhost:3009',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})

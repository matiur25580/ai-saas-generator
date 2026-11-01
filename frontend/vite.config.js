
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (command === 'build' && !env.VITE_BACKEND_URL) {
    console.warn('VITE_BACKEND_URL is missing; the production app will not be able to reach the backend.')
  }
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      host: '127.0.0.1'
    }
  }
})

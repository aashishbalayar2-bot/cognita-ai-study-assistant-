
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const currentProcess = process as any;
  const env = loadEnv(mode, currentProcess.cwd(), '');
  
  // CRITICAL FIX: On Netlify/Vercel, the API key is in the system process.env, not just .env files.
  // We check the loaded env first, then fallback to the system process.env.
  const apiKey = env.API_KEY || currentProcess.env.API_KEY;

  return {
    plugins: [react()],
    define: {
      // Expose the API Key securely to the client-side code
      'process.env.API_KEY': JSON.stringify(apiKey)
    },
    server: {
      host: '0.0.0.0',
      port: 5173
    }
  }
})

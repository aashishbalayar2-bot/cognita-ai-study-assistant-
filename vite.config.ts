import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  // Fix: Type assertion for process to avoid 'cwd' does not exist error in some environments
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // CRITICAL FIX: Check multiple sources for the API Key to handle different deployment setups
  // 1. .env files (env.API_KEY) - Local Development
  // 2. System environment variables (process.env.API_KEY) - Netlify/Vercel CI
  // 3. Fallback variable names (VITE_API_KEY, GOOGLE_API_KEY) - Handling user naming variations
  const apiKey = env.API_KEY || process.env.API_KEY || process.env.VITE_API_KEY || process.env.GOOGLE_API_KEY;

  // Log status for debugging in Netlify Build Logs
  if (apiKey) {
      console.log(`[Vite Config] API Key successfully detected.`);
  } else {
      console.warn(`[Vite Config] WARNING: API Key not found in environment variables. App may not function correctly.`);
  }

  return {
    plugins: [react()],
    define: {
      // Expose the API Key securely to the client-side code
      // We stringify it so it is inserted as a string literal: "AIza..."
      'process.env.API_KEY': JSON.stringify(apiKey || '')
    },
    server: {
      host: '0.0.0.0',
      port: 5173
    }
  }
})
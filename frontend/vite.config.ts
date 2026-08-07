import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// The agent backend (Issue #12) is expected on :8000. Override with AGENT_API_ORIGIN.
const AGENT_ORIGIN = process.env.AGENT_API_ORIGIN ?? 'http://localhost:8000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: AGENT_ORIGIN, changeOrigin: true },
    },
  },
});

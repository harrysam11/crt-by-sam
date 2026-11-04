import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Browsers can't call Yahoo directly (CORS), so /api/yahoo is proxied by the dev/preview server.
// For a deployed build, reproduce this one rule in nginx / Caddy / a Cloudflare Worker.
const proxy = {
  '/api/yahoo': {
    target: 'https://query1.finance.yahoo.com',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/api\/yahoo/, ''),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' },
  },
};

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
  build: {
    sourcemap: false,
  },
});

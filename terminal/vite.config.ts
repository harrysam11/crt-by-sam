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
  '/api/calendar': {
    target: 'https://nfs.faireconomy.media',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/api\/calendar/, ''),
    headers: { 'User-Agent': 'Mozilla/5.0' },
  },
  '/api/binance': {
    target: 'https://api.binance.com',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/api\/binance/, '/api/v3'),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' },
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    proxy,
  },
  build: {
    sourcemap: false,
  },
});

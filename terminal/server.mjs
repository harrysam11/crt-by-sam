/**
 * CRT Institutional Terminal - Production Self-Hosted Server
 * Zero external dependencies (uses native Node.js http, https, fs, path).
 * Serves SPA static assets from dist/ with proper MIME types and proxies /api/*
 * Listens on 0.0.0.0 for instant mobile & local network access.
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = parseInt(process.env.PORT || '5173', 10);
const HOST = process.env.HOST || '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm'
};

function proxyRequest(req, res, targetHost, targetPath) {
  const options = {
    hostname: targetHost,
    port: 443,
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: targetHost,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36'
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      ...proxyRes.headers,
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': '*'
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy request failed', details: err.message }));
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': '*',
      'access-control-max-age': '86400'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. Proxy /api/yahoo -> https://query1.finance.yahoo.com
  if (pathname.startsWith('/api/yahoo')) {
    const targetPath = pathname.replace(/^\/api\/yahoo/, '') + url.search;
    return proxyRequest(req, res, 'query1.finance.yahoo.com', targetPath);
  }

  // 2. Proxy /api/calendar -> https://nfs.faireconomy.media
  if (pathname.startsWith('/api/calendar')) {
    const targetPath = pathname.replace(/^\/api\/calendar/, '') + url.search;
    return proxyRequest(req, res, 'nfs.faireconomy.media', targetPath);
  }

  // 3. Proxy /api/binance -> https://api.binance.com
  if (pathname.startsWith('/api/binance')) {
    const subpath = pathname.replace(/^\/api\/binance/, '');
    const targetPath = (subpath.startsWith('/api/v3') ? subpath : `/api/v3${subpath}`) + url.search;
    return proxyRequest(req, res, 'api.binance.com', targetPath);
  }

  // 3. Static File Serving from dist/
  let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA Fallback: return index.html for client-side routing
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'content-type': 'text/plain' });
        return res.end('500 Internal Server Error: Failed to read file.');
      }

      const headers = {
        'content-type': contentType,
        'access-control-allow-origin': '*'
      };

      // Cache immutable assets (hashed js/css), no-cache for index.html
      if (ext === '.html' || ext === '.webmanifest') {
        headers['cache-control'] = 'no-cache';
      } else {
        headers['cache-control'] = 'public, max-age=31536000, immutable';
      }

      res.writeHead(200, headers);
      res.end(content);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log('\n======================================================');
  console.log('   CRT Institutional Trading Terminal (Self-Hosted)   ');
  console.log('======================================================');
  console.log(`Local Access:   http://localhost:${PORT}`);

  const networkInterfaces = os.networkInterfaces();
  for (const name of Object.keys(networkInterfaces)) {
    for (const iface of networkInterfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`Mobile / LAN:   http://${iface.address}:${PORT}`);
      }
    }
  }
  console.log('======================================================\n');
});

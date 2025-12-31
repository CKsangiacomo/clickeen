#!/usr/bin/env node

/**
 * Minimal Tokyo dev CDN stub.
 *
 * Serves:
 *   - GET /healthz        → 200 ok
 *   - GET /dieter/**      → static files from tokyo/dieter/**
 *   - GET /widgets/**     → static files from tokyo/widgets/**
 *
 * This lets Bob and other surfaces talk to a CDN-style base URL
 * (http://localhost:4000) in dev, mirroring the GA architecture.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

const baseDir = __dirname;

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

function serveStatic(req, res, prefix) {
  const parsed = url.parse(req.url || '/');
  const pathname = parsed.pathname || '/';

  if (!pathname.startsWith(prefix)) {
    return false;
  }

  const relativePath = pathname.slice(1); // drop leading "/"
  const filePath = path.join(baseDir, relativePath);

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Not found');
      return;
    }

    const stream = fs.createReadStream(filePath);
    res.statusCode = 200;
    res.setHeader('Content-Type', getContentType(filePath));
    stream.on('error', () => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Internal server error');
    });
    stream.pipe(res);
  });

  return true;
}

const server = http.createServer((req, res) => {
  // Allow local origins (Bob 3000, DevStudio 5173, etc.)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const parsed = url.parse(req.url || '/');
  const pathname = parsed.pathname || '/';

  if (pathname === '/healthz') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('ok');
    return;
  }

  if (serveStatic(req, res, '/dieter/') || serveStatic(req, res, '/widgets/')) {
    return;
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Not found');
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[tokyo-dev] Listening on http://localhost:${port}`);
});

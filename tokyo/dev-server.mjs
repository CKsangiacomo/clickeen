#!/usr/bin/env node

/**
 * Minimal Tokyo dev CDN stub.
 *
 * Serves:
 *   - GET /healthz        → 200 ok
 *   - GET /dieter/**      → static files from tokyo/dieter/**
 *   - GET /i18n/**        → static files from tokyo/i18n/**
 *   - GET /widgets/**     → static files from tokyo/widgets/**
 *
 * This lets Bob and other surfaces talk to a CDN-style base URL
 * (http://localhost:4000) in dev, mirroring the GA architecture.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import crypto from 'node:crypto';

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

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('error', reject);
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeWorkspaceId(raw) {
  const v = String(raw || '').trim();
  // v1: local dev only; accept uuid-like or slug-like IDs but keep it strict enough
  // to prevent path traversal.
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(v)) return null;
  return v;
}

function normalizeWidgetType(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(v)) return null;
  return v;
}

function pickExtension({ filename, contentType }) {
  const fromName = (() => {
    const base = String(filename || '').trim();
    const ext = path.extname(base).toLowerCase().replace(/^\./, '');
    return ext || null;
  })();
  if (fromName) return fromName;

  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('image/png')) return 'png';
  if (ct.includes('image/jpeg')) return 'jpg';
  if (ct.includes('image/webp')) return 'webp';
  if (ct.includes('image/gif')) return 'gif';
  if (ct.includes('image/svg+xml')) return 'svg';
  if (ct.includes('video/mp4')) return 'mp4';
  if (ct.includes('video/webm')) return 'webm';
  if (ct.includes('application/pdf')) return 'pdf';
  return 'bin';
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
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
    // Cache policy:
    // - Workspace uploads are content-addressed by assetId; cache aggressively to avoid "flash" on load.
    // - Widget/Dieter assets are edited frequently in dev; disable caching to avoid stale previews.
    const cacheControl =
      prefix === '/workspace-assets/'
        ? 'public, max-age=31536000, immutable'
        : 'no-store, max-age=0, must-revalidate';
    res.setHeader('Cache-Control', cacheControl);
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-workspace-id, x-widget-type, x-filename, x-asset-id, x-variant'
  );

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

  if (req.method === 'POST' && pathname === '/workspace-assets/upload') {
    (async () => {
      const workspaceId = normalizeWorkspaceId(req.headers['x-workspace-id']);
      if (!workspaceId) {
        sendJson(res, 422, { error: 'INVALID_WORKSPACE_ID' });
        return;
      }

      const filename = String(req.headers['x-filename'] || '').trim();
      const variant = String(req.headers['x-variant'] || 'original').trim() || 'original';
      if (!/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(variant)) {
        sendJson(res, 422, { error: 'INVALID_VARIANT' });
        return;
      }

      const assetId = (() => {
        const requested = String(req.headers['x-asset-id'] || '').trim();
        if (requested) return /^[a-f0-9-]{36}$/i.test(requested) ? requested : null;
        return crypto.randomUUID();
      })();
      if (!assetId) {
        sendJson(res, 422, { error: 'INVALID_ASSET_ID' });
        return;
      }

      const body = await readRequestBody(req);
      if (!body || body.length === 0) {
        sendJson(res, 422, { error: 'EMPTY_BODY' });
        return;
      }

      const ext = pickExtension({ filename, contentType: req.headers['content-type'] });
      const baseRel = path.posix.join('workspace-assets', workspaceId, assetId);
      const relativePath = path.posix.join(baseRel, `${variant}.${ext}`);
      const absDir = path.join(baseDir, baseRel);
      const absPath = path.join(baseDir, relativePath);
      ensureDir(absDir);
      fs.writeFileSync(absPath, body);

      const host = req.headers.host || `localhost:${port}`;
      const publicUrl = `http://${host}/${relativePath}`;
      sendJson(res, 200, { workspaceId, assetId, variant, ext, relativePath, url: publicUrl });
    })().catch((err) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(err instanceof Error ? err.message : 'Internal server error');
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/widgets/upload') {
    (async () => {
      const widgetType = normalizeWidgetType(req.headers['x-widget-type']);
      if (!widgetType) {
        sendJson(res, 422, { error: 'INVALID_WIDGET_TYPE' });
        return;
      }

      const filename = String(req.headers['x-filename'] || '').trim();
      const variant = String(req.headers['x-variant'] || 'original').trim() || 'original';
      if (!/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(variant)) {
        sendJson(res, 422, { error: 'INVALID_VARIANT' });
        return;
      }

      const assetId = crypto.randomUUID();
      const body = await readRequestBody(req);
      if (!body || body.length === 0) {
        sendJson(res, 422, { error: 'EMPTY_BODY' });
        return;
      }

      const ext = pickExtension({ filename, contentType: req.headers['content-type'] });
      const baseRel = path.posix.join('widgets', widgetType, 'assets', 'uploads', assetId);
      const relativePath = path.posix.join(baseRel, `${variant}.${ext}`);
      const absDir = path.join(baseDir, baseRel);
      const absPath = path.join(baseDir, relativePath);
      ensureDir(absDir);
      fs.writeFileSync(absPath, body);

      const host = req.headers.host || `localhost:${port}`;
      const publicUrl = `http://${host}/${relativePath}`;
      sendJson(res, 200, { widgetType, assetId, variant, ext, relativePath, url: publicUrl });
    })().catch((err) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(err instanceof Error ? err.message : 'Internal server error');
    });
    return;
  }

  if (
    serveStatic(req, res, '/dieter/') ||
    serveStatic(req, res, '/i18n/') ||
    serveStatic(req, res, '/l10n/') ||
    serveStatic(req, res, '/widgets/') ||
    serveStatic(req, res, '/workspace-assets/')
  ) {
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

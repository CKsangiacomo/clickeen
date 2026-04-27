#!/usr/bin/env node

/**
 * Minimal Tokyo dev CDN stub.
 *
 * Serves:
 *   - GET /healthz        → 200 ok
 *   - GET /dieter/**      → static files from tokyo/product/dieter/**
 *   - GET /i18n/**        → static files from tokyo/roma/i18n/public/**
 *   - GET /fonts/**       → static files from tokyo/product/fonts/**
 *   - GET /themes/**      → static files from tokyo/product/themes/**
 *   - GET /widgets/**     → static files from tokyo/product/widgets/**
 *   - GET /assets/v/**    → proxy to tokyo-worker canonical account assets
 *
 * This lets Bob and other surfaces talk to a CDN-style base URL
 * (http://localhost:4000) in dev, mirroring the GA architecture.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import crypto from 'node:crypto';

// Keep the Tokyo dev stub self-contained so CI can boot it with plain `node`.
const WIDGET_PUBLIC_ID_RE =
  /^(?:wgt_main_[a-z0-9][a-z0-9_-]*|wgt_curated_[a-z0-9][a-z0-9_-]*|wgt_[a-z0-9][a-z0-9_-]*_u_[a-z0-9][a-z0-9_-]*)$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASSET_VERSION_PATH_RE = /^\/assets\/v\/([^/?#]+)$/;
const ASSET_VERSION_KEY_RE = /^accounts\/([^/]+)\/assets\/versions\/([^/]+)\/[a-f0-9]{64}\/[^/]+$/i;

function normalizeWidgetPublicId(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  return WIDGET_PUBLIC_ID_RE.test(value) ? value : null;
}

function decodePathPart(raw) {
  try {
    return decodeURIComponent(String(raw || '')).trim();
  } catch {
    return '';
  }
}

function pathnameFromRawAssetRef(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (value.startsWith('/')) return value;
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    return new URL(value).pathname || '/';
  } catch {
    return null;
  }
}

function decodeAssetVersionToken(raw) {
  const token = decodePathPart(raw);
  if (!token) return null;
  try {
    const key = decodeURIComponent(token).trim();
    if (!key || key.startsWith('/') || key.includes('..')) return null;
    return key;
  } catch {
    return null;
  }
}

function isUuid(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return Boolean(value && UUID_RE.test(value));
}

function parseCanonicalAssetRef(raw) {
  const pathname = pathnameFromRawAssetRef(raw);
  if (!pathname) return null;

  const version = pathname.match(ASSET_VERSION_PATH_RE);
  if (!version) return null;

  const versionToken = decodePathPart(version[1]);
  const versionKey = decodeAssetVersionToken(versionToken);
  if (!versionKey) return null;

  const keyMatch = versionKey.match(ASSET_VERSION_KEY_RE);
  if (!keyMatch) return null;
  const accountId = decodePathPart(keyMatch[1]);
  const assetId = decodePathPart(keyMatch[2]);
  if (!isUuid(accountId) || !isUuid(assetId)) return null;

  return {
    accountId,
    assetId,
    kind: 'version',
    pathname,
    versionToken,
    versionKey,
  };
}

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

const baseDir = __dirname;
const productDir = path.join(baseDir, 'product');
const pragueDir = path.join(baseDir, 'prague');
const romaDir = path.join(baseDir, 'roma');
const tokyoWorkerBase = String(process.env.TOKYO_WORKER_BASE_URL || 'http://localhost:8791')
  .trim()
  .replace(/\/+$/, '');
const TOKYO_L10N_BRIDGE_HEADER = 'x-tokyo-l10n-bridge';

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
    case '.woff2':
      return 'font/woff2';
    case '.woff':
      return 'font/woff';
    case '.otf':
      return 'font/otf';
    case '.ttf':
      return 'font/ttf';
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

function normalizePublicId(raw) {
  return normalizeWidgetPublicId(raw);
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

function sanitizeUploadFilename(filename, ext) {
  const raw = String(filename || '').trim();
  const basename = raw.split(/[\\/]/).pop() || '';
  const stripped = basename.split('?')[0].split('#')[0];
  const stemRaw = stripped.replace(/\.[^.]+$/, '');
  const normalizedStem = stemRaw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const safeStem = (normalizedStem || 'upload').slice(0, 64);
  const safeExt = String(ext || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') || 'bin';
  return `${safeStem}.${safeExt}`;
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function isTokyoWorkerBridgeRequest(req) {
  const raw = req.headers[TOKYO_L10N_BRIDGE_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value || '').trim() === '1';
}

function shouldProxyMutableToWorker(req, pathname) {
  if (isTokyoWorkerBridgeRequest(req)) return false;
  const isAccountInstanceL10nRead =
    pathname.startsWith('/l10n/instances/') || /^\/l10n\/v\/[^/]+\/instances\//.test(pathname);
  if ((req.method === 'GET' || req.method === 'HEAD') && isAccountInstanceL10nRead) {
    return true;
  }
  if (
    (req.method === 'PUT' || req.method === 'DELETE') &&
    /^\/assets\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(pathname)
  ) {
    return true;
  }
  if ((req.method === 'GET' || req.method === 'HEAD') && parseCanonicalAssetRef(pathname)) {
    return true;
  }
  if ((req.method === 'POST' || req.method === 'DELETE') && pathname.startsWith('/l10n/instances/')) {
    return true;
  }
  return false;
}

function buildWorkerProxyHeaders(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (!value) continue;
    const lower = key.toLowerCase();
    if (lower === 'host' || lower === 'connection' || lower === 'content-length') continue;
    if (Array.isArray(value)) {
      headers.set(key, value.join(', '));
    } else {
      headers.set(key, String(value));
    }
  }
  return headers;
}

function copyUpstreamHeadersToResponse(upstream, res) {
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      lower === 'content-length' ||
      lower === 'connection' ||
      lower === 'transfer-encoding' ||
      lower === 'content-encoding'
    ) {
      return;
    }
    res.setHeader(key, value);
  });
}

async function proxyMutableToWorker(req, res) {
  const method = req.method || 'GET';
  const target = `${tokyoWorkerBase}${req.url || '/'}`;
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await readRequestBody(req) : undefined;

  const upstream = await fetch(target, {
    method,
    headers: buildWorkerProxyHeaders(req),
    body: hasBody ? body : undefined,
  });

  res.statusCode = upstream.status;
  copyUpstreamHeadersToResponse(upstream, res);

  if (method === 'HEAD' || upstream.status === 204 || upstream.status === 304) {
    res.end();
    return;
  }
  const bytes = Buffer.from(await upstream.arrayBuffer());
  res.end(bytes);
}

function resolveStaticRoot(prefix, relativePathPosix) {
  if (prefix === '/dieter/') return { root: path.join(productDir, 'dieter'), relativePathPosix };
  if (prefix === '/i18n/') return { root: path.join(romaDir, 'i18n', 'public'), relativePathPosix };
  if (prefix === '/fonts/') return { root: path.join(productDir, 'fonts'), relativePathPosix };
  if (prefix === '/themes/') return { root: path.join(productDir, 'themes'), relativePathPosix };
  if (prefix === '/widgets/') {
    const praguePageMatch = relativePathPosix.match(/^([^/]+)\/pages\/(.+)$/);
    if (praguePageMatch) {
      return {
        root: path.join(pragueDir, 'pages'),
        relativePathPosix: `${praguePageMatch[1]}/${praguePageMatch[2]}`,
      };
    }
    return { root: path.join(productDir, 'widgets'), relativePathPosix };
  }
  if (prefix === '/l10n/') {
    if (relativePathPosix.startsWith('prague/')) {
      return { root: path.join(pragueDir, 'l10n'), relativePathPosix: relativePathPosix.slice('prague/'.length) };
    }
    return { root: path.join(pragueDir, 'l10n'), relativePathPosix: '__not_found__' };
  }
  return { root: baseDir, relativePathPosix };
}

function serveStatic(req, res, prefix) {
  const parsed = url.parse(req.url || '/');
  const pathname = parsed.pathname || '/';

  if (!pathname.startsWith(prefix)) {
    return false;
  }

  let relativePathPosix = pathname.slice(prefix.length);
  if (prefix === '/l10n/' && relativePathPosix.startsWith('l10n/v/')) {
    relativePathPosix = relativePathPosix.replace(/^l10n\/v\/[^/]+\//, 'l10n/');
  }
  if (prefix === '/l10n/' && relativePathPosix.startsWith('v/')) {
    relativePathPosix = relativePathPosix.replace(/^v\/[^/]+\//, '');
  }
  const resolvedStatic = resolveStaticRoot(prefix, relativePathPosix);
  const relativePath = resolvedStatic.relativePathPosix;
  const cacheControlFor = () => {
    // Cache policy:
    // - i18n bundles are content-hashed; cache aggressively (manifest is the short-TTL indirection layer).
    // - l10n overlays are content-addressed; cache aggressively (index.json is short-TTL).
    // - Dieter/widget assets are edited frequently in dev; allow caching but require revalidation to avoid staleness.
    if (prefix === '/i18n/') {
      if (relativePathPosix.endsWith('/manifest.json')) {
        return 'public, max-age=60, must-revalidate';
      }
      return 'public, max-age=31536000, immutable';
    }
    if (prefix === '/l10n/') {
      if (relativePathPosix.endsWith('/index.json')) {
        return 'public, max-age=300, stale-while-revalidate=600';
      }
      return 'public, max-age=31536000, immutable';
    }
    // Default for /dieter/, /widgets/, and /fonts/ in local dev: cache, but always revalidate.
    return 'public, max-age=0, must-revalidate';
  };

  const filePath = path.join(resolvedStatic.root, relativePath);
  const normalizedRoot = path.resolve(resolvedStatic.root);
  const normalizedFile = path.resolve(filePath);
  if (normalizedFile !== normalizedRoot && !normalizedFile.startsWith(`${normalizedRoot}${path.sep}`)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Bad request');
    return true;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Not found');
      return;
    }

    const etag = `"${stat.size}-${Math.round(stat.mtimeMs)}"`;
    const ifNoneMatch = String(req.headers['if-none-match'] || '').trim();
    res.setHeader('ETag', etag);

    if (ifNoneMatch && ifNoneMatch === etag) {
      res.statusCode = 304;
      res.setHeader('Cache-Control', cacheControlFor());
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    res.statusCode = 200;
    res.setHeader('Content-Type', getContentType(filePath));
    res.setHeader('Cache-Control', cacheControlFor());
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, authorization, x-account-id, x-public-id, x-widget-type, x-filename, x-asset-id, x-source, x-tokyo-l10n-bridge'
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

  if ((req.method === 'GET' || req.method === 'HEAD') && pathname.startsWith('/renders/')) {
    (async () => {
      const upstream = await fetch(`${tokyoWorkerBase}${req.url}`, {
        method: req.method,
        headers: buildWorkerProxyHeaders(req),
      });
      res.statusCode = upstream.status;
      const contentType = upstream.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      const cacheControl = upstream.headers.get('cache-control');
      if (cacheControl) res.setHeader('Cache-Control', cacheControl);
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      const bytes = Buffer.from(await upstream.arrayBuffer());
      res.end(bytes);
    })().catch((err) => {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(err instanceof Error ? err.message : 'Bad gateway');
    });
    return;
  }

  if (shouldProxyMutableToWorker(req, pathname)) {
    proxyMutableToWorker(req, res).catch((err) => {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      sendJson(res, 502, {
        error: 'WORKER_PROXY_FAILED',
        detail: err instanceof Error ? err.message : 'Bad gateway',
      });
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

      const assetId = crypto.randomUUID();
      const body = await readRequestBody(req);
      if (!body || body.length === 0) {
        sendJson(res, 422, { error: 'EMPTY_BODY' });
        return;
      }

      const ext = pickExtension({ filename, contentType: req.headers['content-type'] });
      const safeFilename = sanitizeUploadFilename(filename, ext);
      const storageBaseRel = path.posix.join('product', 'widgets', widgetType, 'assets', 'uploads', assetId);
      const storageRelativePath = path.posix.join(storageBaseRel, safeFilename);
      const publicRelativePath = path.posix.join('widgets', widgetType, 'assets', 'uploads', assetId, safeFilename);
      const absDir = path.join(baseDir, storageBaseRel);
      const absPath = path.join(baseDir, storageRelativePath);
      ensureDir(absDir);
      fs.writeFileSync(absPath, body);

      const host = req.headers.host || `localhost:${port}`;
      const publicUrl = `http://${host}/${publicRelativePath}`;
      sendJson(res, 200, { widgetType, assetId, ext, relativePath: publicRelativePath, url: publicUrl });
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
    serveStatic(req, res, '/fonts/') ||
    serveStatic(req, res, '/l10n/') ||
    serveStatic(req, res, '/themes/') ||
    serveStatic(req, res, '/widgets/')
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

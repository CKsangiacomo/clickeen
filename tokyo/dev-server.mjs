#!/usr/bin/env node

/**
 * Minimal Tokyo dev CDN stub.
 *
 * Serves:
 *   - GET /healthz        → 200 ok
 *   - GET /dieter/**      → static files from tokyo/dieter/**
 *   - GET /i18n/**        → static files from tokyo/i18n/**
 *   - GET /themes/**      → static files from tokyo/themes/**
 *   - GET /widgets/**     → static files from tokyo/widgets/**
 *   - GET /arsenale/**    → canonical account assets from tokyo/arsenale/**
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
const tokyoWorkerBase = String(process.env.TOKYO_WORKER_BASE_URL || 'http://localhost:8791')
  .trim()
  .replace(/\/+$/, '');
const TOKYO_L10N_BRIDGE_HEADER = 'x-tokyo-l10n-bridge';
const TOKYO_ASSET_BACKEND = String(process.env.TOKYO_ASSET_BACKEND || 'mirror')
  .trim()
  .toLowerCase();
const TOKYO_ASSET_BACKEND_MODE = TOKYO_ASSET_BACKEND === 'worker' ? 'worker' : 'mirror';

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

function normalizePublicId(raw) {
  const v = String(raw || '').trim();
  if (!v) return null;
  const okMain = /^wgt_main_[a-z0-9][a-z0-9_-]*$/i.test(v);
  const okCurated = /^wgt_curated_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$/i.test(v);
  const okUser = /^wgt_[a-z0-9][a-z0-9_-]*_u_[a-z0-9][a-z0-9_-]*$/i.test(v);
  if (!okMain && !okCurated && !okUser) return null;
  return v;
}

function normalizeCuratedPublicId(raw) {
  const v = normalizePublicId(raw);
  if (!v) return null;
  if (/^wgt_curated_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$/i.test(v)) return v;
  if (/^wgt_main_[a-z0-9][a-z0-9_-]*$/i.test(v)) return v;
  return null;
}

function normalizeLocale(raw) {
  const v = String(raw || '').trim().toLowerCase().replace(/_/g, '-');
  if (!v) return null;
  if (!/^[a-z]{2,3}(?:-[a-z0-9]+)*$/.test(v)) return null;
  return v;
}

const L10N_LAYER_ALLOWED = new Set(['locale', 'geo', 'industry', 'experiment', 'account', 'behavior', 'user']);
const LAYER_KEY_SLUG = /^[a-z0-9][a-z0-9_-]*$/;
const LAYER_KEY_EXPERIMENT = /^exp_[a-z0-9][a-z0-9_-]*:[a-z0-9][a-z0-9_-]*$/;
const LAYER_KEY_BEHAVIOR = /^behavior_[a-z0-9][a-z0-9_-]*$/;

function normalizeLayer(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value || !L10N_LAYER_ALLOWED.has(value)) return null;
  return value;
}

function normalizeLayerKey(layer, raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (layer === 'locale') return normalizeLocale(value);
  if (layer === 'geo') {
    const upper = value.toUpperCase();
    return /^[A-Z]{2}$/.test(upper) ? upper : null;
  }
  if (layer === 'industry') {
    const lower = value.toLowerCase();
    return LAYER_KEY_SLUG.test(lower) ? lower : null;
  }
  if (layer === 'experiment') {
    const lower = value.toLowerCase();
    return LAYER_KEY_EXPERIMENT.test(lower) ? lower : null;
  }
  if (layer === 'account') {
    const lower = value.toLowerCase();
    return LAYER_KEY_SLUG.test(lower) ? lower : null;
  }
  if (layer === 'behavior') {
    const lower = value.toLowerCase();
    return LAYER_KEY_BEHAVIOR.test(lower) ? lower : null;
  }
  if (layer === 'user') {
    if (value === 'global') return 'global';
    return normalizeLocale(value);
  }
  return null;
}

function normalizeGeoCountries(raw) {
  if (!Array.isArray(raw)) return null;
  const list = raw
    .map((code) => String(code || '').trim().toUpperCase())
    .filter((code) => /^[A-Z]{2}$/.test(code));
  if (!list.length) return null;
  return Array.from(new Set(list));
}

const L10N_PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function hasProhibitedSegment(pathStr) {
  return String(pathStr || '')
    .split('.')
    .some((seg) => seg && L10N_PROHIBITED_SEGMENTS.has(seg));
}

function stableStringify(value) {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',');
  return `{${body}}`;
}

function prettyStableJson(value) {
  const parsed = JSON.parse(stableStringify(value));
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

function loadLayerIndex(publicId) {
  const indexPath = path.join(baseDir, 'l10n', 'instances', publicId, 'index.json');
  if (!fs.existsSync(indexPath)) return null;
  const json = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  if (!json || typeof json !== 'object' || json.v !== 1) {
    throw new Error('[tokyo-dev] invalid l10n index');
  }
  if (json.layers && typeof json.layers === 'object') {
    return json;
  }
  throw new Error('[tokyo-dev] invalid l10n index');
}

function writeLayerIndex(publicId, layers) {
  const indexDir = path.join(baseDir, 'l10n', 'instances', publicId);
  ensureDir(indexDir);
  const payload = { v: 1, publicId, layers };
  fs.writeFileSync(path.join(indexDir, 'index.json'), prettyStableJson(payload), 'utf8');
}

function deleteLayerIndex(publicId) {
  const indexPath = path.join(baseDir, 'l10n', 'instances', publicId, 'index.json');
  if (fs.existsSync(indexPath)) fs.unlinkSync(indexPath);
}

function normalizeLayerIndex(payload, publicId) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('[tokyo-dev] index must be an object');
  }
  if (payload.v !== 1) throw new Error('[tokyo-dev] index.v must be 1');
  if (payload.publicId && String(payload.publicId) !== publicId) {
    throw new Error('[tokyo-dev] index.publicId mismatch');
  }

  const layers = {};
  if (payload.layers && typeof payload.layers === 'object') {
    for (const [layer, entry] of Object.entries(payload.layers)) {
      const normalizedLayer = normalizeLayer(layer);
      if (!normalizedLayer || !entry || typeof entry !== 'object') continue;
      const keys = Array.isArray(entry.keys) ? entry.keys : [];
      const normalizedKeys = [];
      for (const key of keys) {
        const normalizedKey = normalizeLayerKey(normalizedLayer, key);
        if (normalizedKey && !normalizedKeys.includes(normalizedKey)) normalizedKeys.push(normalizedKey);
      }
      if (!normalizedKeys.length) continue;
      const nextEntry = { keys: normalizedKeys.sort((a, b) => a.localeCompare(b)) };
      if (normalizedLayer === 'locale' && entry.geoTargets && typeof entry.geoTargets === 'object') {
        const geoTargets = {};
        for (const [key, countries] of Object.entries(entry.geoTargets)) {
          const normalizedKey = normalizeLayerKey('locale', key);
          const normalizedGeo = normalizeGeoCountries(countries);
          if (normalizedKey && normalizedGeo) geoTargets[normalizedKey] = normalizedGeo;
        }
        if (Object.keys(geoTargets).length) nextEntry.geoTargets = geoTargets;
      }
      layers[normalizedLayer] = nextEntry;
    }
  } else {
    throw new Error('[tokyo-dev] index.layers must be an object');
  }

  return { v: 1, publicId, layers };
}

function updateLayerIndexEntry(publicId, layer, layerKey, geoTargets) {
  const normalizedLayer = normalizeLayer(layer);
  const normalizedKey = normalizedLayer ? normalizeLayerKey(normalizedLayer, layerKey) : null;
  if (!normalizedLayer || !normalizedKey) return;
  const existing = loadLayerIndex(publicId);
  const layers = existing?.layers ? { ...existing.layers } : {};
  const entry = layers[normalizedLayer] ? { ...layers[normalizedLayer] } : { keys: [] };
  entry.keys = (entry.keys || []).filter((key) => key !== normalizedKey);
  entry.keys.push(normalizedKey);
  entry.keys.sort((a, b) => a.localeCompare(b));
  if (normalizedLayer === 'locale') {
    const normalizedGeo = normalizeGeoCountries(geoTargets);
    if (normalizedGeo) {
      entry.geoTargets = entry.geoTargets ? { ...entry.geoTargets } : {};
      entry.geoTargets[normalizedKey] = normalizedGeo;
    }
  }
  layers[normalizedLayer] = entry;
  writeLayerIndex(publicId, layers);
}

function removeLayerIndexEntry(publicId, layer, layerKey) {
  const normalizedLayer = normalizeLayer(layer);
  const normalizedKey = normalizedLayer ? normalizeLayerKey(normalizedLayer, layerKey) : null;
  if (!normalizedLayer || !normalizedKey) return;
  const existing = loadLayerIndex(publicId);
  if (!existing?.layers) return;
  const layers = { ...existing.layers };
  const entry = layers[normalizedLayer];
  if (!entry || !Array.isArray(entry.keys)) return;
  const nextKeys = entry.keys.filter((key) => key !== normalizedKey);
  if (!nextKeys.length) {
    delete layers[normalizedLayer];
  } else {
    layers[normalizedLayer] = { ...entry, keys: nextKeys };
  }
  if (!Object.keys(layers).length) {
    deleteLayerIndex(publicId);
    return;
  }
  writeLayerIndex(publicId, layers);
}

function assertOverlayShape(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('[tokyo-dev] overlay must be an object');
  }
  if (payload.v !== 1) throw new Error('[tokyo-dev] overlay.v must be 1');
  if (!Array.isArray(payload.ops)) throw new Error('[tokyo-dev] overlay.ops must be an array');

  const ops = payload.ops.map((op, index) => {
    if (!op || typeof op !== 'object' || Array.isArray(op)) {
      throw new Error(`[tokyo-dev] overlay.ops[${index}] must be an object`);
    }
    if (op.op !== 'set') throw new Error(`[tokyo-dev] overlay.ops[${index}].op must be "set"`);
    const path = typeof op.path === 'string' ? op.path.trim() : '';
    if (!path) throw new Error(`[tokyo-dev] overlay.ops[${index}].path is required`);
    if (hasProhibitedSegment(path)) throw new Error(`[tokyo-dev] overlay.ops[${index}].path contains prohibited segment`);
    if (!('value' in op)) throw new Error(`[tokyo-dev] overlay.ops[${index}].value is required`);
    return { op: 'set', path, value: op.value };
  });

  const baseUpdatedAt = typeof payload.baseUpdatedAt === 'string' ? payload.baseUpdatedAt : null;
  const rawFingerprint = typeof payload.baseFingerprint === 'string' ? payload.baseFingerprint.trim() : '';
  if (!/^[a-f0-9]{64}$/i.test(rawFingerprint)) {
    throw new Error('[tokyo-dev] overlay.baseFingerprint must be a sha256 hex string');
  }
  const baseFingerprint = rawFingerprint;

  return { v: 1, baseUpdatedAt, baseFingerprint, ops };
}

function cleanOldL10nOutputs(outDir, keepFile) {
  if (!fs.existsSync(outDir)) return;
  const files = fs.readdirSync(outDir, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name);
  for (const file of files) {
    if (file === keepFile) continue;
    if (file.endsWith('.ops.json')) {
      fs.unlinkSync(path.join(outDir, file));
    }
  }
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

function safeJsonParse(raw) {
  try {
    return JSON.parse(String(raw || ''));
  } catch {
    return null;
  }
}

function normalizeCanonicalArsenalePath(rawPath) {
  const value = String(rawPath || '').trim();
  if (!value) return null;
  if (value.startsWith('/arsenale/o/')) return value;
  if (value.startsWith('arsenale/o/')) return `/${value}`;
  if (value.startsWith('/assets/accounts/')) return value.replace(/^\/assets\/accounts\//, '/arsenale/o/');
  if (value.startsWith('assets/accounts/')) return `/${value.replace(/^assets\/accounts\//, 'arsenale/o/')}`;
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      return normalizeCanonicalArsenalePath(parsed.pathname);
    } catch {
      return null;
    }
  }
  return null;
}

function localFilePathForArsenalePath(canonicalPath) {
  const normalized = normalizeCanonicalArsenalePath(canonicalPath);
  if (!normalized) return null;
  if (!normalized.startsWith('/arsenale/o/')) return null;
  const relative = normalized.slice(1);
  if (!relative || relative.includes('..')) return null;
  return path.join(baseDir, relative);
}

function isTokyoWorkerBridgeRequest(req) {
  const raw = req.headers[TOKYO_L10N_BRIDGE_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value || '').trim() === '1';
}

function shouldProxyMutableToWorker(req, pathname) {
  if (isTokyoWorkerBridgeRequest(req)) return false;
  if (req.method === 'POST' && pathname === '/assets/upload') {
    return TOKYO_ASSET_BACKEND_MODE === 'worker';
  }
  if (req.method === 'POST' && pathname === '/assets/purge-deleted') {
    return true;
  }
  if ((req.method === 'GET' || req.method === 'HEAD') && pathname.startsWith('/arsenale/o/')) {
    return TOKYO_ASSET_BACKEND_MODE === 'worker';
  }
  if ((req.method === 'GET' || req.method === 'HEAD') && pathname.startsWith('/assets/accounts/')) {
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

  if (method === 'HEAD' || upstream.status === 204 || upstream.status === 304) {
    res.end();
    return;
  }
  const bytes = Buffer.from(await upstream.arrayBuffer());
  res.end(bytes);
}

async function proxyAssetsUploadWithLocalMirror(req, res) {
  const method = req.method || 'POST';
  const target = `${tokyoWorkerBase}${req.url || '/assets/upload'}`;
  const body = await readRequestBody(req);

  const upstream = await fetch(target, {
    method,
    headers: buildWorkerProxyHeaders(req),
    body,
  });

  const rawText = await upstream.text().catch(() => '');
  const payload = safeJsonParse(rawText);
  if (upstream.ok && payload && typeof payload === 'object' && typeof payload.key === 'string') {
    const canonicalPath = normalizeCanonicalArsenalePath(payload.key);
    const localAbsPath = localFilePathForArsenalePath(canonicalPath);
    if (localAbsPath) {
      ensureDir(path.dirname(localAbsPath));
      fs.writeFileSync(localAbsPath, body);
    }
  }

  res.statusCode = upstream.status;
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

  if (!upstream.headers.get('content-type')) {
    res.setHeader('content-type', 'application/json; charset=utf-8');
  }
  res.end(rawText);
}

function serveStatic(req, res, prefix) {
  const parsed = url.parse(req.url || '/');
  const pathname = parsed.pathname || '/';

  if (!pathname.startsWith(prefix)) {
    return false;
  }

  let relativePathPosix = pathname.slice(1); // drop leading "/"
  if (prefix === '/l10n/' && relativePathPosix.startsWith('l10n/v/')) {
    relativePathPosix = relativePathPosix.replace(/^l10n\/v\/[^/]+\//, 'l10n/');
  }
  const relativePath = relativePathPosix; // keep naming for existing logic
  const cacheControlFor = () => {
    // Cache policy:
    // - Workspace uploads are content-addressed by assetId; cache aggressively to avoid "flash" on load.
    // - i18n bundles are content-hashed; cache aggressively (manifest is the short-TTL indirection layer).
    // - l10n overlays are content-addressed; cache aggressively (index.json is short-TTL).
    // - Dieter/widget assets are edited frequently in dev; allow caching but require revalidation to avoid staleness.
    if (prefix === '/workspace-assets/') {
      return 'public, max-age=31536000, immutable';
    }
    if (prefix === '/arsenale/') {
      return 'public, max-age=31536000, immutable';
    }
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
    // Default for /dieter/ and /widgets/ in local dev: cache, but always revalidate.
    return 'public, max-age=0, must-revalidate';
  };

  const filePath = path.join(baseDir, relativePath);

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
    'Content-Type, authorization, x-account-id, x-workspace-id, x-public-id, x-widget-type, x-filename, x-asset-id, x-variant, x-source, x-tokyo-l10n-bridge'
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
      const upstream = await fetch(`${tokyoWorkerBase}${req.url}`, { method: req.method });
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

  if (req.method === 'POST' && pathname === '/assets/upload' && TOKYO_ASSET_BACKEND_MODE === 'mirror') {
    proxyAssetsUploadWithLocalMirror(req, res).catch((err) => {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      sendJson(res, 502, {
        error: 'WORKER_PROXY_FAILED',
        detail: err instanceof Error ? err.message : 'Bad gateway',
      });
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

  if (req.method === 'POST' && pathname === '/workspace-assets/upload') {
    sendJson(res, 410, {
      error: {
        kind: 'DENY',
        reasonKey: 'tokyo.errors.assets.legacyUploadRemoved',
        detail: 'Use POST /assets/upload',
      },
    });
    return;
  }

  if (req.method === 'DELETE' && pathname.startsWith('/l10n/instances/')) {
    (async () => {
      const indexMatch = pathname.match(/^\/l10n\/instances\/([^/]+)\/index$/);
      if (indexMatch) {
        const publicId = normalizePublicId(decodeURIComponent(indexMatch[1]));
        if (!publicId) {
          sendJson(res, 422, { error: 'INVALID_PUBLIC_ID' });
          return;
        }
        deleteLayerIndex(publicId);
        sendJson(res, 200, { publicId, deleted: true });
        return;
      }

      const match = pathname.match(/^\/l10n\/instances\/([^/]+)\/([^/]+)\/([^/]+)$/);
      if (!match) {
        sendJson(res, 404, { error: 'NOT_FOUND' });
        return;
      }
      const publicId = normalizePublicId(decodeURIComponent(match[1]));
      const layer = normalizeLayer(decodeURIComponent(match[2]));
      const layerKey = layer ? normalizeLayerKey(layer, decodeURIComponent(match[3])) : null;
      if (!publicId || !layer || !layerKey) {
        sendJson(res, 422, { error: 'INVALID_L10N_PATH' });
        return;
      }

      const localeDir = path.join(baseDir, 'l10n', 'instances', publicId, layer, layerKey);
      let removed = false;
      if (fs.existsSync(localeDir)) {
        const files = fs.readdirSync(localeDir, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name);
        for (const file of files) {
          if (file.endsWith('.ops.json')) {
            fs.unlinkSync(path.join(localeDir, file));
            removed = true;
          }
        }
        if (fs.readdirSync(localeDir).length === 0) {
          fs.rmdirSync(localeDir);
        }
      }

      removeLayerIndexEntry(publicId, layer, layerKey);

      sendJson(res, 200, { publicId, layer, layerKey, deleted: removed });
    })().catch((err) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(err instanceof Error ? err.message : 'Internal server error');
    });
    return;
  }

  if (req.method === 'POST' && pathname.startsWith('/l10n/instances/')) {
    (async () => {
      const indexMatch = pathname.match(/^\/l10n\/instances\/([^/]+)\/index$/);
      if (indexMatch) {
        const publicId = normalizePublicId(decodeURIComponent(indexMatch[1]));
        if (!publicId) {
          sendJson(res, 422, { error: 'INVALID_PUBLIC_ID' });
          return;
        }
        let payload;
        try {
          const body = await readRequestBody(req);
          payload = JSON.parse(body.toString('utf8'));
        } catch (err) {
          sendJson(res, 422, { error: 'INVALID_JSON' });
          return;
        }

        let index;
        try {
          index = normalizeLayerIndex(payload, publicId);
        } catch (err) {
          sendJson(res, 422, { error: 'INVALID_INDEX', detail: err instanceof Error ? err.message : String(err) });
          return;
        }

        if (!Object.keys(index.layers || {}).length) {
          deleteLayerIndex(publicId);
          sendJson(res, 200, { publicId, layers: {} });
          return;
        }

        writeLayerIndex(publicId, index.layers);
        sendJson(res, 200, { publicId, layers: index.layers });
        return;
      }

      const baseSnapshotMatch = pathname.match(/^\/l10n\/instances\/([^/]+)\/bases\/([^/]+)$/);
      if (baseSnapshotMatch) {
        const publicId = normalizePublicId(decodeURIComponent(baseSnapshotMatch[1]));
        const baseFingerprint = String(decodeURIComponent(baseSnapshotMatch[2]) || '').trim().toLowerCase();
        if (!publicId || !/^[a-f0-9]{64}$/i.test(baseFingerprint)) {
          sendJson(res, 422, { error: 'INVALID_BASE_SNAPSHOT_PATH' });
          return;
        }

        let payload;
        try {
          const body = await readRequestBody(req);
          payload = JSON.parse(body.toString('utf8'));
        } catch (err) {
          sendJson(res, 422, { error: 'INVALID_JSON' });
          return;
        }

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          sendJson(res, 422, { error: 'INVALID_PAYLOAD' });
          return;
        }
        if (payload.v !== 1) {
          sendJson(res, 422, { error: 'INVALID_SNAPSHOT', detail: 'snapshot.v must be 1' });
          return;
        }
        if (payload.publicId && String(payload.publicId) !== publicId) {
          sendJson(res, 422, { error: 'INVALID_SNAPSHOT', detail: 'snapshot.publicId mismatch' });
          return;
        }
        if (payload.baseFingerprint && String(payload.baseFingerprint).toLowerCase() !== baseFingerprint) {
          sendJson(res, 422, { error: 'INVALID_SNAPSHOT', detail: 'snapshot.baseFingerprint mismatch' });
          return;
        }
        if (!payload.snapshot || typeof payload.snapshot !== 'object' || Array.isArray(payload.snapshot)) {
          sendJson(res, 422, { error: 'INVALID_SNAPSHOT', detail: 'snapshot.snapshot must be an object' });
          return;
        }

        const snapshot = {};
        for (const [key, value] of Object.entries(payload.snapshot)) {
          if (typeof value !== 'string') continue;
          snapshot[String(key)] = value;
        }

        const stable = prettyStableJson({ v: 1, publicId, baseFingerprint, snapshot });
        const outName = `${baseFingerprint}.snapshot.json`;
        const outDir = path.join(baseDir, 'l10n', 'instances', publicId, 'bases');
        ensureDir(outDir);
        fs.writeFileSync(path.join(outDir, outName), stable, 'utf8');
        sendJson(res, 200, { publicId, baseFingerprint, file: outName });
        return;
      }

      const match = pathname.match(/^\/l10n\/instances\/([^/]+)\/([^/]+)\/([^/]+)$/);
      if (!match) {
        sendJson(res, 404, { error: 'NOT_FOUND' });
        return;
      }
      const publicId = normalizePublicId(decodeURIComponent(match[1]));
      const layer = normalizeLayer(decodeURIComponent(match[2]));
      const layerKey = layer ? normalizeLayerKey(layer, decodeURIComponent(match[3])) : null;
      if (!publicId || !layer || !layerKey) {
        sendJson(res, 422, { error: 'INVALID_L10N_PATH' });
        return;
      }

      let payload;
      try {
        const body = await readRequestBody(req);
        payload = JSON.parse(body.toString('utf8'));
      } catch (err) {
        sendJson(res, 422, { error: 'INVALID_JSON' });
        return;
      }

      let overlay;
      try {
        overlay = assertOverlayShape(payload);
      } catch (err) {
        sendJson(res, 422, { error: 'INVALID_OVERLAY', detail: err instanceof Error ? err.message : String(err) });
        return;
      }

      const stable = prettyStableJson(overlay);
      const outName = `${overlay.baseFingerprint}.ops.json`;
      const localeDir = path.join(baseDir, 'l10n', 'instances', publicId, layer, layerKey);
      ensureDir(localeDir);
      fs.writeFileSync(path.join(localeDir, outName), stable, 'utf8');
      cleanOldL10nOutputs(localeDir, outName);
      updateLayerIndexEntry(publicId, layer, layerKey, payload.geoTargets ?? payload.geoCountries);

      sendJson(res, 200, { publicId, layer, layerKey, file: outName });
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
      const safeFilename = sanitizeUploadFilename(filename, ext);
      const baseRel = path.posix.join('widgets', widgetType, 'assets', 'uploads', assetId);
      const relativePath = path.posix.join(baseRel, variant, safeFilename);
      const absDir = path.join(baseDir, baseRel, variant);
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

  if (req.method === 'POST' && pathname === '/curated-assets/upload') {
    sendJson(res, 410, {
      error: {
        kind: 'DENY',
        reasonKey: 'tokyo.errors.assets.legacyUploadRemoved',
        detail: 'Use POST /assets/upload',
      },
    });
    return;
  }

  if (
    serveStatic(req, res, '/dieter/') ||
    serveStatic(req, res, '/i18n/') ||
    serveStatic(req, res, '/l10n/') ||
    serveStatic(req, res, '/themes/') ||
    serveStatic(req, res, '/widgets/') ||
    serveStatic(req, res, '/arsenale/') ||
    serveStatic(req, res, '/workspace-assets/') ||
    serveStatic(req, res, '/curated-assets/')
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

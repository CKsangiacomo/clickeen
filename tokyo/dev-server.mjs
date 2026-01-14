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

function normalizePublicId(raw) {
  const v = String(raw || '').trim();
  if (!v) return null;
  const okLegacy = /^wgt_[a-z0-9][a-z0-9_-]*_(main|tmpl_[a-z0-9][a-z0-9_-]*|u_[a-z0-9][a-z0-9_-]*)$/i.test(v);
  const okWebsiteCreative =
    /^wgt_web_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$/i.test(v);
  if (!okLegacy && !okWebsiteCreative) return null;
  return v;
}

function normalizeLocale(raw) {
  const v = String(raw || '').trim().toLowerCase().replace(/_/g, '-');
  if (!v) return null;
  if (!/^[a-z]{2}(?:-[a-z]{2})?$/.test(v)) return null;
  return v;
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

function sha8(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 8);
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
    if (typeof op.value !== 'string') throw new Error(`[tokyo-dev] overlay.ops[${index}].value must be string`);
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

function loadL10nManifest() {
  const manifestPath = path.join(baseDir, 'l10n', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return { v: 1, gitSha: 'runtime', instances: {} };
  }
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const json = JSON.parse(raw);
  if (!json || typeof json !== 'object' || json.v !== 1 || typeof json.gitSha !== 'string' || typeof json.instances !== 'object') {
    throw new Error('[tokyo-dev] invalid l10n manifest');
  }
  return json;
}

function saveL10nManifest(manifest) {
  ensureDir(path.join(baseDir, 'l10n'));
  const manifestPath = path.join(baseDir, 'l10n', 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function cleanOldL10nOutputs(outDir, locale, keepFile) {
  if (!fs.existsSync(outDir)) return;
  const files = fs.readdirSync(outDir, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name);
  for (const file of files) {
    if (file === keepFile) continue;
    if (file.startsWith(`${locale}.`) && file.endsWith('.ops.json')) {
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

  const relativePathPosix = pathname.slice(1); // drop leading "/"
  const relativePath = relativePathPosix; // keep naming for existing logic
  const cacheControlFor = () => {
    // Cache policy:
    // - Workspace uploads are content-addressed by assetId; cache aggressively to avoid "flash" on load.
    // - i18n/l10n bundles are content-hashed; cache aggressively (manifest is the short-TTL indirection layer).
    // - Dieter/widget assets are edited frequently in dev; allow caching but require revalidation to avoid staleness.
    if (prefix === '/workspace-assets/') {
      return 'public, max-age=31536000, immutable';
    }
    if (prefix === '/i18n/' || prefix === '/l10n/') {
      if (relativePathPosix.endsWith('/manifest.json')) {
        return 'public, max-age=60, must-revalidate';
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, authorization, x-workspace-id, x-widget-type, x-filename, x-asset-id, x-variant'
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

  if (req.method === 'DELETE' && pathname.startsWith('/l10n/instances/')) {
    (async () => {
      const match = pathname.match(/^\/l10n\/instances\/([^/]+)\/([^/]+)$/);
      if (!match) {
        sendJson(res, 404, { error: 'NOT_FOUND' });
        return;
      }
      const publicId = normalizePublicId(decodeURIComponent(match[1]));
      const locale = normalizeLocale(decodeURIComponent(match[2]));
      if (!publicId || !locale) {
        sendJson(res, 422, { error: 'INVALID_L10N_PATH' });
        return;
      }

      const outDir = path.join(baseDir, 'l10n', 'instances', publicId);
      let removed = false;
      if (fs.existsSync(outDir)) {
        const files = fs.readdirSync(outDir, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name);
        for (const file of files) {
          if (file.startsWith(`${locale}.`) && file.endsWith('.ops.json')) {
            fs.unlinkSync(path.join(outDir, file));
            removed = true;
          }
        }
      }

      const manifest = loadL10nManifest();
      const locales = manifest.instances?.[publicId];
      if (locales && typeof locales === 'object' && locales[locale]) {
        delete locales[locale];
        removed = true;
        if (Object.keys(locales).length === 0) {
          delete manifest.instances[publicId];
        }
        saveL10nManifest(manifest);
      }

      sendJson(res, 200, { publicId, locale, deleted: removed });
    })().catch((err) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(err instanceof Error ? err.message : 'Internal server error');
    });
    return;
  }

  if (req.method === 'POST' && pathname.startsWith('/l10n/instances/')) {
    (async () => {
      const match = pathname.match(/^\/l10n\/instances\/([^/]+)\/([^/]+)$/);
      if (!match) {
        sendJson(res, 404, { error: 'NOT_FOUND' });
        return;
      }
      const publicId = normalizePublicId(decodeURIComponent(match[1]));
      const locale = normalizeLocale(decodeURIComponent(match[2]));
      if (!publicId || !locale) {
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

      const geoCountries = normalizeGeoCountries(payload.geoCountries);
      const stable = prettyStableJson(overlay);
      const hash = sha8(stable);
      const outName = `${locale}.${hash}.ops.json`;
      const outDir = path.join(baseDir, 'l10n', 'instances', publicId);
      ensureDir(outDir);
      fs.writeFileSync(path.join(outDir, outName), stable, 'utf8');
      cleanOldL10nOutputs(outDir, locale, outName);

      const manifest = loadL10nManifest();
      manifest.instances[publicId] = manifest.instances[publicId] || {};
      manifest.instances[publicId][locale] = {
        file: outName,
        baseUpdatedAt: overlay.baseUpdatedAt ?? null,
        ...(geoCountries ? { geoCountries } : {}),
      };
      saveL10nManifest(manifest);

      sendJson(res, 200, { publicId, locale, file: outName });
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

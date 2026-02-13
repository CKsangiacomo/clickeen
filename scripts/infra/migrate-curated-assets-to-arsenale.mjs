#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const PLATFORM_ACCOUNT_ID = String(process.env.CK_PLATFORM_ACCOUNT_ID || '00000000-0000-0000-0000-000000000100').trim();
const MIGRATION_TARGET = String(process.env.MIGRATION_TARGET || 'local').trim().toLowerCase();
const DRY_RUN = String(process.env.DRY_RUN || '').trim() === '1';
const LOCAL_TOKYO_BASE = String(process.env.LOCAL_TOKYO_BASE_URL || 'http://localhost:4000')
  .trim()
  .replace(/\/+$/, '');

function parseDotEnvValue(envPath, key) {
  const raw = fs.readFileSync(envPath, 'utf8');
  const line = raw
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${key}=`));
  if (!line) return '';
  const value = line.slice(key.length + 1).trim();
  if (!value) return '';
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function readLocalSupabaseEnv() {
  const output = execSync('supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const env = {};
  output.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) return;
    const key = match[1];
    let value = match[2] ?? '';
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  });
  return {
    apiUrl: String(env.API_URL || '').trim().replace(/\/+$/, ''),
    serviceRoleKey: String(env.SERVICE_ROLE_KEY || '').trim(),
  };
}

function readCloudDevSupabaseEnv(envPath) {
  return {
    apiUrl: String(parseDotEnvValue(envPath, 'SUPABASE_URL') || '').trim().replace(/\/+$/, ''),
    serviceRoleKey: String(parseDotEnvValue(envPath, 'SUPABASE_SERVICE_ROLE_KEY') || '').trim(),
  };
}

function resolveRuntimeContext(envPath) {
  if (MIGRATION_TARGET === 'local') {
    const supabaseEnv = readLocalSupabaseEnv();
    const tokyoBase = String(process.env.TOKYO_BASE_URL || 'http://localhost:4000')
      .trim()
      .replace(/\/+$/, '');
    const tokyoJwt = String(process.env.TOKYO_DEV_JWT || parseDotEnvValue(envPath, 'TOKYO_DEV_JWT')).trim();
    return { label: 'local', supabaseEnv, tokyoBase, tokyoJwt };
  }

  if (MIGRATION_TARGET === 'cloud-dev') {
    const supabaseEnv = readCloudDevSupabaseEnv(envPath);
    const tokyoBase = String(process.env.TOKYO_BASE_URL || parseDotEnvValue(envPath, 'CK_CLOUD_TOKYO_BASE_URL'))
      .trim()
      .replace(/\/+$/, '');
    const tokyoJwt = String(process.env.TOKYO_DEV_JWT || parseDotEnvValue(envPath, 'TOKYO_DEV_JWT')).trim();
    return { label: 'cloud-dev', supabaseEnv, tokyoBase, tokyoJwt };
  }

  throw new Error(`[migrate-curated-assets] Unsupported MIGRATION_TARGET: ${MIGRATION_TARGET}`);
}

function extractPrimaryUrl(raw) {
  const v = String(raw || '').trim();
  if (!v) return null;
  if (/^(?:data|blob):/i.test(v) || /^https?:\/\//i.test(v)) return v;
  if (/^\//.test(v)) return v;
  const match = v.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
  if (match && match[2]) return match[2];
  return null;
}

function replacePrimaryUrl(raw, nextUrl) {
  const v = String(raw || '');
  const match = v.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
  if (match && match[2]) return v.replace(match[2], nextUrl);
  return nextUrl;
}

function normalizeCandidatePath(candidate) {
  const value = String(candidate || '').trim();
  if (!value) return null;
  if (value.startsWith('/')) return value;
  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).pathname;
    } catch {
      return null;
    }
  }
  return null;
}

function shouldMigratePath(pathname) {
  return pathname.startsWith('/curated-assets/') || pathname.startsWith('/workspace-assets/');
}

function canonicalizeAliasPath(pathname) {
  if (pathname.startsWith('/assets/accounts/')) return pathname.replace(/^\/assets\/accounts\//, '/arsenale/o/');
  return pathname;
}

function filenameFromPath(pathname, contentType) {
  const extFromMime = (() => {
    const mt = String(contentType || '').toLowerCase();
    if (mt.includes('image/png')) return 'png';
    if (mt.includes('image/jpeg')) return 'jpg';
    if (mt.includes('image/webp')) return 'webp';
    if (mt.includes('image/gif')) return 'gif';
    if (mt.includes('image/svg+xml')) return 'svg';
    if (mt.includes('video/mp4')) return 'mp4';
    if (mt.includes('video/webm')) return 'webm';
    if (mt.includes('application/pdf')) return 'pdf';
    return 'bin';
  })();
  const tail = decodeURIComponent(String(pathname || '').split('/').filter(Boolean).pop() || '').trim();
  if (!tail) return `upload.${extFromMime}`;
  const safeTail = tail.split('?')[0].split('#')[0].trim();
  if (!safeTail || /[\\/]/.test(safeTail)) return `upload.${extFromMime}`;
  if (safeTail.includes('.')) return safeTail;
  return `${safeTail}.${extFromMime}`;
}

async function supabaseFetch(ctx, route, init = {}) {
  const res = await fetch(`${ctx.apiUrl}${route}`, {
    ...init,
    headers: {
      apikey: ctx.serviceRoleKey,
      Authorization: `Bearer ${ctx.serviceRoleKey}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  return res;
}

async function loadCuratedInstances(ctx) {
  const params = new URLSearchParams({
    select: 'public_id,widget_type,owner_account_id,config,updated_at',
    order: 'public_id.asc',
  });
  const res = await supabaseFetch(ctx, `/rest/v1/curated_widget_instances?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[migrate-curated-assets] Failed to load curated instances (${res.status}): ${detail}`);
  }
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

function extractCanonicalPathsFromConfig(config) {
  const text = JSON.stringify(config || {});
  const out = new Set();
  for (const match of text.matchAll(/\/arsenale\/o\/[^"'\\s)]+/g)) {
    const raw = String(match[0] || '').trim();
    if (raw) out.add(raw);
  }
  for (const match of text.matchAll(/\/assets\/accounts\/[^"'\\s)]+/g)) {
    const raw = String(match[0] || '').trim();
    if (!raw) continue;
    out.add(raw.replace(/^\/assets\/accounts\//, '/arsenale/o/'));
  }
  return Array.from(out);
}

async function buildLocalCuratedCanonicalIndex() {
  const supabaseEnv = readLocalSupabaseEnv();
  if (!supabaseEnv.apiUrl || !supabaseEnv.serviceRoleKey) return new Map();
  const rows = await loadCuratedInstances(supabaseEnv).catch(() => []);
  const index = new Map();
  rows.forEach((row) => {
    const publicId = String(row?.public_id || '').trim();
    if (!publicId) return;
    const paths = extractCanonicalPathsFromConfig(row?.config);
    if (paths.length > 0) index.set(publicId, paths);
  });
  return index;
}

async function patchCuratedConfig(ctx, publicId, nextConfig) {
  const params = new URLSearchParams({ public_id: `eq.${publicId}` });
  const res = await supabaseFetch(ctx, `/rest/v1/curated_widget_instances?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ config: nextConfig, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[migrate-curated-assets] Failed to patch curated config (${res.status}) for ${publicId}: ${detail}`);
  }
}

async function uploadViaCanonical({
  tokyoJwt,
  tokyoBase,
  localTokyoBase,
  accountId,
  publicId,
  widgetType,
  sourcePath,
  fallbackSourcePaths,
  urlCache,
}) {
  if (urlCache.has(sourcePath)) return urlCache.get(sourcePath);
  let resolvedSourcePath = sourcePath;
  let sourceRes = await fetch(`${tokyoBase}${resolvedSourcePath}`, { method: 'GET' });

  if (
    !sourceRes.ok &&
    sourceRes.status === 404 &&
    Array.isArray(fallbackSourcePaths) &&
    fallbackSourcePaths.length > 0
  ) {
    for (const candidatePath of fallbackSourcePaths) {
      const candidate = String(candidatePath || '').trim();
      if (!candidate) continue;
      const candidateRes = await fetch(`${localTokyoBase}${candidate}`, { method: 'GET' });
      if (candidateRes.ok) {
        sourceRes = candidateRes;
        resolvedSourcePath = candidate;
        break;
      }
    }
  }

  if (!sourceRes.ok) {
    const detail = await sourceRes.text().catch(() => '');
    throw new Error(`[migrate-curated-assets] Failed to fetch source ${resolvedSourcePath} (${sourceRes.status}): ${detail}`);
  }

  const bytes = await sourceRes.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error(`[migrate-curated-assets] Source asset is empty: ${resolvedSourcePath}`);
  const contentType = sourceRes.headers.get('content-type') || 'application/octet-stream';
  const filename = filenameFromPath(resolvedSourcePath, contentType);

  const uploadRes = await fetch(`${tokyoBase}/assets/upload?_t=${Date.now()}_${crypto.randomUUID()}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tokyoJwt}`,
      'content-type': contentType,
      'x-account-id': accountId,
      'x-public-id': publicId,
      'x-widget-type': widgetType,
      'x-source': 'promotion',
      'x-filename': filename,
      'x-variant': 'original',
    },
    body: bytes,
  });
  const text = await uploadRes.text().catch(() => '');
  if (!uploadRes.ok) {
    throw new Error(
      `[migrate-curated-assets] Upload failed for ${resolvedSourcePath} (${uploadRes.status})${text ? `: ${text}` : ''}`,
    );
  }
  const payload = text ? JSON.parse(text) : {};
  const key = typeof payload?.key === 'string' ? payload.key.trim() : '';
  if (!key) {
    throw new Error(`[migrate-curated-assets] Missing key from upload response for ${resolvedSourcePath}`);
  }
  const normalized = key.startsWith('/') ? key : `/${key}`;
  urlCache.set(sourcePath, normalized);
  return normalized;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function migrateInstanceConfig({
  instance,
  tokyoJwt,
  tokyoBase,
  localTokyoBase,
  localCanonicalIndex,
  urlCache,
  dryRun,
}) {
  const accountId = String(instance.owner_account_id || PLATFORM_ACCOUNT_ID).trim();
  const publicId = String(instance.public_id || '').trim();
  const widgetType = String(instance.widget_type || '').trim();
  if (!publicId || !widgetType) return { changed: false, migrated: 0, canonicalized: 0, nextConfig: instance.config };

  const nextConfig = cloneJson(instance.config || {});
  let migrated = 0;
  let canonicalized = 0;

  const visit = async (node) => {
    if (typeof node === 'string') {
      const primary = extractPrimaryUrl(node);
      if (!primary) return undefined;
      const candidatePath = normalizeCandidatePath(primary);
      if (!candidatePath) return undefined;

      const aliasCanonical = canonicalizeAliasPath(candidatePath);
      if (aliasCanonical !== candidatePath) {
        canonicalized += 1;
        return replacePrimaryUrl(node, aliasCanonical);
      }

      if (!shouldMigratePath(candidatePath)) return undefined;
      if (dryRun) {
        migrated += 1;
        return undefined;
      }
      const uploadedPath = await uploadViaCanonical({
        tokyoJwt,
        tokyoBase,
        localTokyoBase,
        accountId,
        publicId,
        widgetType,
        sourcePath: candidatePath,
        fallbackSourcePaths:
          MIGRATION_TARGET === 'cloud-dev' ? localCanonicalIndex.get(publicId) || [] : [],
        urlCache,
      });
      migrated += 1;
      return replacePrimaryUrl(node, uploadedPath);
    }

    if (!node || typeof node !== 'object') return undefined;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        const replaced = await visit(node[i]);
        if (typeof replaced === 'string') node[i] = replaced;
      }
      return undefined;
    }

    for (const [key, value] of Object.entries(node)) {
      const replaced = await visit(value);
      if (typeof replaced === 'string') {
        node[key] = replaced;
      }
    }
    return undefined;
  };

  await visit(nextConfig);
  const changed = migrated > 0 || canonicalized > 0;
  return { changed, migrated, canonicalized, nextConfig };
}

function hasLegacyAssetPath(rawConfig) {
  const text = JSON.stringify(rawConfig || {});
  return text.includes('/curated-assets/') || text.includes('/workspace-assets/') || text.includes('/assets/accounts/');
}

async function main() {
  const envPath = path.join(ROOT, '.env.local');
  const ctx = resolveRuntimeContext(envPath);
  const supabaseEnv = ctx.supabaseEnv;
  if (!supabaseEnv.apiUrl || !supabaseEnv.serviceRoleKey) {
    throw new Error(`[migrate-curated-assets] Could not resolve Supabase API_URL/SERVICE_ROLE_KEY for target=${ctx.label}`);
  }
  if (!ctx.tokyoBase) {
    throw new Error(`[migrate-curated-assets] TOKYO_BASE_URL unresolved for target=${ctx.label}`);
  }
  if (!ctx.tokyoJwt) {
    throw new Error(`[migrate-curated-assets] TOKYO_DEV_JWT is required for target=${ctx.label}`);
  }

  const rows = await loadCuratedInstances(supabaseEnv);
  const candidates = rows.filter((row) => hasLegacyAssetPath(row.config));
  if (candidates.length === 0) {
    console.log('[migrate-curated-assets] No curated instances with legacy asset paths were found.');
    return;
  }

  const urlCache = new Map();
  let patched = 0;
  let migratedUrls = 0;
  let canonicalizedUrls = 0;
  const localCanonicalIndex = MIGRATION_TARGET === 'cloud-dev' ? await buildLocalCuratedCanonicalIndex() : new Map();

  for (const row of candidates) {
    const result = await migrateInstanceConfig({
      instance: row,
      tokyoJwt: ctx.tokyoJwt,
      tokyoBase: ctx.tokyoBase,
      localTokyoBase: LOCAL_TOKYO_BASE,
      localCanonicalIndex,
      urlCache,
      dryRun: DRY_RUN,
    });
    if (!result.changed) continue;
    migratedUrls += result.migrated;
    canonicalizedUrls += result.canonicalized;
    if (!DRY_RUN) {
      await patchCuratedConfig(supabaseEnv, row.public_id, result.nextConfig);
    }
    patched += 1;
    console.log(
      `[migrate-curated-assets] target=${ctx.label} ${row.public_id}: migrated=${result.migrated}, canonicalized=${result.canonicalized}, dryRun=${DRY_RUN ? '1' : '0'}`,
    );
  }

  console.log(
    `[migrate-curated-assets] target=${ctx.label} done: instancesPatched=${patched}, uploadedReferences=${migratedUrls}, aliasCanonicalized=${canonicalizedUrls}, dryRun=${DRY_RUN ? '1' : '0'}`,
  );
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});

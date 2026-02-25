#!/usr/bin/env node

import {
  isUuid,
  parseCanonicalAssetRef,
  toCanonicalAssetVersionPath,
} from '../tooling/ck-contracts/src/index.js';

const ASSET_OBJECT_PATH_RE = /^\/arsenale\/o\/([^/]+)\/([^/]+)\/(?:[^/]+\/)?[^/]+$/;

/**
 * One-shot origin repair for persisted widget configs.
 *
 * Rewrites legacy/invalid asset origins to canonical immutable asset version paths:
 *   /assets/v/{encodeURIComponent(assets/versions/{accountId}/{assetId}/{variant?}/{filename})}
 *
 * Source rows:
 *   - curated_widget_instances
 *   - widget_instances
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/repair-asset-origins.mjs
 *   node scripts/repair-asset-origins.mjs --apply
 *   node scripts/repair-asset-origins.mjs --apply --table curated
 *   node scripts/repair-asset-origins.mjs --apply --public-id wgt_curated_faq_lightblurs_generic
 */

const CURATED_TABLE = 'curated_widget_instances';
const WORKSPACE_TABLE = 'widget_instances';
const DEFAULT_PAGE_SIZE = 100;

const LEGACY_CURATED_PATH_RE = /^\/curated-assets\/[^/]+\/[^/]+\/([0-9a-fA-F-]{36})\/([^/?#]+)$/i;
const CSS_URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
const ASSET_FIELD_PATH_RE = /(?:^|[\].])(?:src|poster|logoFill)$/;

function printUsage() {
  console.log(`Usage: node scripts/repair-asset-origins.mjs [options]

Options:
  --apply                 Persist changes (default: dry-run)
  --table curated         Process curated_widget_instances only (default)
  --table workspace       Process widget_instances only
  --table all             Process both tables
  --public-id <id>        Restrict to one public_id
  --page-size <n>         Batch size for reads (default: ${DEFAULT_PAGE_SIZE})
  --help                  Show this message
`);
}

function parseArgs(argv) {
  const out = {
    apply: false,
    table: 'curated',
    publicId: '',
    pageSize: DEFAULT_PAGE_SIZE,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || '').trim();
    if (!arg) continue;
    if (arg === '--help' || arg === '-h') {
      out.help = true;
      continue;
    }
    if (arg === '--apply') {
      out.apply = true;
      continue;
    }
    if (arg === '--table') {
      const next = String(argv[i + 1] || '').trim().toLowerCase();
      if (!next) throw new Error('--table requires a value');
      if (!['curated', 'workspace', 'all'].includes(next)) {
        throw new Error('--table must be one of: curated, workspace, all');
      }
      out.table = next;
      i += 1;
      continue;
    }
    if (arg === '--public-id') {
      const next = String(argv[i + 1] || '').trim();
      if (!next) throw new Error('--public-id requires a value');
      out.publicId = next;
      i += 1;
      continue;
    }
    if (arg === '--page-size') {
      const next = Number.parseInt(String(argv[i + 1] || '').trim(), 10);
      if (!Number.isFinite(next) || next <= 0 || next > 1000) {
        throw new Error('--page-size must be an integer between 1 and 1000');
      }
      out.pageSize = next;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return out;
}

function toPathname(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).pathname || '/';
    } catch {
      return null;
    }
  }
  if (/^\/\//.test(value)) {
    try {
      return new URL(`https:${value}`).pathname || '/';
    } catch {
      return null;
    }
  }
  if (value.startsWith('/')) {
    return value.split('?')[0].split('#')[0];
  }
  if (value.startsWith('./') || value.startsWith('../')) {
    return value;
  }
  return null;
}

function buildCanonicalAssetPath(accountId, assetId, variant, filename) {
  const variantSegment = variant === 'original' ? '' : `${variant}/`;
  const versionKey = `assets/versions/${accountId}/${assetId}/${variantSegment}${filename}`;
  return toCanonicalAssetVersionPath(versionKey) || '';
}

function safeDecodeSegment(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value;
  }
}

function parseCanonicalAssetPathDetails(pathname) {
  const matched = String(pathname || '').match(ASSET_OBJECT_PATH_RE);
  if (!matched) return null;

  const parts = String(pathname || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length !== 5 && parts.length !== 6) return null;

  const accountId = safeDecodeSegment(parts[2] || '');
  const assetId = safeDecodeSegment(parts[3] || '').toLowerCase();
  const filename = safeDecodeSegment(parts[parts.length - 1] || '');
  const variantRaw = parts.length === 6 ? safeDecodeSegment(parts[4] || '') : 'original';
  const variant = String(variantRaw || 'original').trim().toLowerCase() || 'original';
  return { accountId, assetId, variant, filename };
}

function isAssetFieldPath(path) {
  return ASSET_FIELD_PATH_RE.test(String(path || ''));
}

function deepCloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildSupabaseClient() {
  const base = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!base) throw new Error('Missing SUPABASE_URL');
  if (!serviceRole) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return { base, serviceRole };
}

async function supabaseFetch(client, path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('apikey', client.serviceRole);
  headers.set('authorization', `Bearer ${client.serviceRole}`);
  if (!headers.has('content-type') && init.body != null) {
    headers.set('content-type', 'application/json');
  }

  const res = await fetch(`${client.base}${path}`, {
    ...init,
    headers,
  });

  const text = await res.text().catch(() => '');
  const json = text ? (() => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })() : null;

  if (!res.ok) {
    throw new Error(`Supabase ${res.status} ${path}: ${text || '<empty>'}`);
  }
  return json;
}

async function loadWorkspaceAccountId(client, workspaceId, cache) {
  const key = String(workspaceId || '').trim();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key);

  const params = new URLSearchParams({
    select: 'id,account_id',
    id: `eq.${key}`,
    limit: '1',
  });
  const rows = await supabaseFetch(client, `/rest/v1/workspaces?${params.toString()}`, { method: 'GET' });
  const accountId = Array.isArray(rows) && rows[0] && typeof rows[0].account_id === 'string' ? rows[0].account_id.trim() : '';
  const resolved = accountId || null;
  cache.set(key, resolved);
  return resolved;
}

async function loadVariantMeta(client, assetId, variant, cache) {
  const id = String(assetId || '').trim().toLowerCase();
  const variantKey = String(variant || 'original').trim().toLowerCase() || 'original';
  const cacheKey = `${id}|${variantKey}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const params = new URLSearchParams({
    select: 'asset_id,account_id,variant,filename',
    asset_id: `eq.${id}`,
    variant: `eq.${variantKey}`,
    limit: '1',
  });
  const rows = await supabaseFetch(client, `/rest/v1/account_asset_variants?${params.toString()}`, { method: 'GET' });
  const row = Array.isArray(rows) ? rows[0] : null;
  const meta =
    row &&
    typeof row.account_id === 'string' &&
    typeof row.asset_id === 'string' &&
    typeof row.filename === 'string'
      ? {
          accountId: row.account_id.trim(),
          assetId: row.asset_id.trim().toLowerCase(),
          variant: variantKey,
          filename: row.filename.trim(),
        }
      : null;

  cache.set(cacheKey, meta);
  return meta;
}

async function rewriteCandidatePath(client, candidateRaw, variantCache) {
  const candidate = String(candidateRaw || '').trim();
  if (!candidate) return { changed: false, value: candidate };

  const pathname = toPathname(candidate);
  if (!pathname) return { changed: false, value: candidate };
  if (pathname.startsWith('./') || pathname.startsWith('../')) {
    return { changed: false, value: candidate };
  }

  const canonicalVersionRef = parseCanonicalAssetRef(pathname);
  if (canonicalVersionRef && canonicalVersionRef.kind === 'version') {
    const canonical = toCanonicalAssetVersionPath(canonicalVersionRef.versionKey) || pathname;
    return { changed: canonical !== candidate, value: canonical };
  }

  const legacyMatch = pathname.match(LEGACY_CURATED_PATH_RE);
  if (legacyMatch) {
    const assetId = String(legacyMatch[1] || '').trim().toLowerCase();
    const variant = 'original';
    if (!isUuid(assetId)) {
      return { changed: false, value: candidate, unresolved: `legacy-invalid-asset-id:${candidate}` };
    }
    const meta = await loadVariantMeta(client, assetId, variant, variantCache);
    if (!meta) {
      return { changed: false, value: candidate, unresolved: `legacy-missing-variant:${candidate}` };
    }
    const canonical = buildCanonicalAssetPath(meta.accountId, assetId, variant, meta.filename);
    if (!canonical) {
      return { changed: false, value: candidate, unresolved: `legacy-invalid-canonical-version:${candidate}` };
    }
    return { changed: canonical !== candidate, value: canonical };
  }

  const canonical = parseCanonicalAssetPathDetails(pathname);
  if (canonical) {
    const accountIdFromPath = canonical.accountId;
    const assetId = canonical.assetId;
    const variant = canonical.variant;
    const filenameFromPath = canonical.filename;
    if (!isUuid(accountIdFromPath)) {
      return { changed: false, value: candidate, unresolved: `canonical-invalid-account-id:${candidate}` };
    }
    if (!isUuid(assetId)) {
      return { changed: false, value: candidate, unresolved: `canonical-invalid-asset-id:${candidate}` };
    }
    const meta = await loadVariantMeta(client, assetId, variant, variantCache);
    const canonical = meta
      ? buildCanonicalAssetPath(meta.accountId, assetId, variant, meta.filename)
      : buildCanonicalAssetPath(accountIdFromPath, assetId, variant, filenameFromPath || 'original.jpg');
    if (!canonical) {
      return { changed: false, value: candidate, unresolved: `canonical-invalid-canonical-version:${candidate}` };
    }
    if (!meta) {
      return { changed: canonical !== candidate, value: canonical, unresolved: `canonical-missing-variant:${candidate}` };
    }
    return { changed: canonical !== candidate, value: canonical };
  }

  return { changed: false, value: candidate };
}

async function rewriteStringValue(client, rawValue, path, variantCache, rowStats) {
  const value = String(rawValue || '');
  let changed = false;
  let hadCssUrl = false;
  let out = '';
  let lastIndex = 0;

  CSS_URL_RE.lastIndex = 0;
  let match = CSS_URL_RE.exec(value);
  while (match) {
    hadCssUrl = true;
    const full = match[0];
    const quote = match[1] || '';
    const inner = match[2] || '';
    out += value.slice(lastIndex, match.index);

    const rewritten = await rewriteCandidatePath(client, inner, variantCache);
    if (rewritten.unresolved) rowStats.unresolved.add(rewritten.unresolved);
    if (rewritten.changed) {
      changed = true;
      rowStats.rewrites += 1;
      out += `url(${quote}${rewritten.value}${quote})`;
    } else {
      out += full;
    }

    lastIndex = match.index + full.length;
    match = CSS_URL_RE.exec(value);
  }
  CSS_URL_RE.lastIndex = 0;

  if (hadCssUrl) {
    out += value.slice(lastIndex);
    return { value: changed ? out : value, changed };
  }

  if (!isAssetFieldPath(path)) return { value, changed: false };

  const rewritten = await rewriteCandidatePath(client, value.trim(), variantCache);
  if (rewritten.unresolved) rowStats.unresolved.add(rewritten.unresolved);
  if (!rewritten.changed) return { value, changed: false };
  rowStats.rewrites += 1;
  return { value: rewritten.value, changed: true };
}

async function rewriteConfig(client, config, variantCache) {
  const rowStats = {
    rewrites: 0,
    unresolved: new Set(),
  };

  const root = deepCloneJson(config);

  const visit = async (node, path, holder, key) => {
    if (typeof node === 'string') {
      const rewritten = await rewriteStringValue(client, node, path, variantCache, rowStats);
      if (rewritten.changed) holder[key] = rewritten.value;
      return rewritten.changed;
    }

    if (!node || typeof node !== 'object') return false;

    let changed = false;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        const childChanged = await visit(node[i], `${path}[${i}]`, node, i);
        changed = changed || childChanged;
      }
      return changed;
    }

    for (const [childKey, childValue] of Object.entries(node)) {
      const nextPath = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(childKey)
        ? `${path}.${childKey}`
        : `${path}[${JSON.stringify(childKey)}]`;
      const childChanged = await visit(childValue, nextPath, node, childKey);
      changed = changed || childChanged;
    }
    return changed;
  };

  const wrapper = { value: root };
  const changed = await visit(root, 'config', wrapper, 'value');
  return {
    changed,
    config: wrapper.value,
    rewrites: rowStats.rewrites,
    unresolved: Array.from(rowStats.unresolved),
  };
}

function resolveTables(tableArg) {
  if (tableArg === 'curated') return [CURATED_TABLE];
  if (tableArg === 'workspace') return [WORKSPACE_TABLE];
  return [CURATED_TABLE, WORKSPACE_TABLE];
}

async function loadRows(client, table, pageSize, offset, publicId) {
  const select =
    table === CURATED_TABLE ? 'public_id,owner_account_id,config' : 'public_id,workspace_id,config';
  const params = new URLSearchParams({
    select,
    order: 'public_id.asc',
    limit: String(pageSize),
    offset: String(offset),
  });
  if (publicId) params.set('public_id', `eq.${publicId}`);
  const rows = await supabaseFetch(client, `/rest/v1/${table}?${params.toString()}`, { method: 'GET' });
  return Array.isArray(rows) ? rows : [];
}

async function patchConfig(client, table, publicId, config) {
  const params = new URLSearchParams({
    public_id: `eq.${publicId}`,
  });
  await supabaseFetch(client, `/rest/v1/${table}?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ config }),
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const client = buildSupabaseClient();
  const tables = resolveTables(args.table);
  const workspaceAccountCache = new Map();
  const variantCache = new Map();

  console.log(`[repair-asset-origins] mode=${args.apply ? 'apply' : 'dry-run'} table=${args.table}`);
  if (args.publicId) console.log(`[repair-asset-origins] filter publicId=${args.publicId}`);

  let scanned = 0;
  let changedRows = 0;
  let rewriteCount = 0;
  const unresolved = new Set();

  for (const table of tables) {
    let offset = 0;
    for (;;) {
      const rows = await loadRows(client, table, args.pageSize, offset, args.publicId);
      if (!rows.length) break;

      for (const row of rows) {
        const publicId = typeof row.public_id === 'string' ? row.public_id.trim() : '';
        const config = row.config;
        if (!publicId || !config || typeof config !== 'object' || Array.isArray(config)) continue;

        let expectedAccountId = '';
        if (table === CURATED_TABLE) {
          expectedAccountId = typeof row.owner_account_id === 'string' ? row.owner_account_id.trim() : '';
        } else {
          const workspaceId = typeof row.workspace_id === 'string' ? row.workspace_id.trim() : '';
          const accountId = await loadWorkspaceAccountId(client, workspaceId, workspaceAccountCache);
          expectedAccountId = accountId || '';
        }
        if (!expectedAccountId) {
          unresolved.add(`missing-account:${table}:${publicId}`);
        }

        scanned += 1;
        const rewritten = await rewriteConfig(client, config, variantCache);
        rewriteCount += rewritten.rewrites;
        rewritten.unresolved.forEach((item) => unresolved.add(`${table}:${publicId}:${item}`));

        if (!rewritten.changed) continue;
        changedRows += 1;

        if (args.apply) {
          await patchConfig(client, table, publicId, rewritten.config);
          console.log(`[repair-asset-origins] patched ${table}:${publicId} rewrites=${rewritten.rewrites}`);
        } else {
          console.log(`[repair-asset-origins] would-patch ${table}:${publicId} rewrites=${rewritten.rewrites}`);
        }
      }

      if (args.publicId) break;
      if (rows.length < args.pageSize) break;
      offset += args.pageSize;
    }
  }

  console.log('[repair-asset-origins] done');
  console.log(`  scanned_rows=${scanned}`);
  console.log(`  changed_rows=${changedRows}`);
  console.log(`  rewritten_urls=${rewriteCount}`);
  console.log(`  unresolved_refs=${unresolved.size}`);
  if (unresolved.size > 0) {
    const sample = Array.from(unresolved).slice(0, 20);
    sample.forEach((entry) => console.log(`  unresolved: ${entry}`));
    if (unresolved.size > sample.length) {
      console.log(`  unresolved: ... (${unresolved.size - sample.length} more)`);
    }
  }
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error('[repair-asset-origins] failed:', detail);
  process.exitCode = 1;
});

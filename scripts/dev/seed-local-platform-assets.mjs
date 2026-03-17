#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCanonicalAssetRef, toCanonicalAssetVersionPath } from '../../packages/ck-contracts/src/index.js';
import { createSupabaseClient, supabaseFetchJson } from './local-supabase.mjs';
import { resolveFirstRootEnvValue } from './local-root-env.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '../..');

const DEFAULT_LOCAL_BASE = 'http://localhost:4000';
const DEFAULT_REMOTE_BASE = 'https://tokyo.dev.clickeen.com';
const DEFAULT_PERSIST_TO = path.join(repoRoot, '.wrangler', 'state');
const DEFAULT_BUCKET = 'tokyo-assets-dev';
const DEFAULT_PLATFORM_ACCOUNT_ID =
  process.env.CK_PLATFORM_ACCOUNT_ID || '00000000-0000-0000-0000-000000000100';
const DEFAULT_PAGE_SIZE = 500;

function printUsage() {
  console.log(`Usage: node scripts/dev/seed-local-platform-assets.mjs [options]

Seeds local Tokyo asset state for DevStudio-visible platform rows.
This command can be run explicitly, and canonical local dev-up also invokes it.

Options:
  --local-base <url>      Local Tokyo base URL (default: ${DEFAULT_LOCAL_BASE})
  --remote-base <url>     Remote Tokyo base URL (default: ${DEFAULT_REMOTE_BASE})
  --bucket <name>         Local R2 bucket (default: ${DEFAULT_BUCKET})
  --persist-to <dir>      Wrangler local persist dir (default: ${DEFAULT_PERSIST_TO})
  --platform-account <id> Platform account id (default: ${DEFAULT_PLATFORM_ACCOUNT_ID})
  --max <n>               Max assets to seed (default: unlimited)
  --help                  Show this message
`);
}

function parseArgs(argv) {
  const args = {
    localBase: process.env.TOKYO_LOCAL_BASE_URL || DEFAULT_LOCAL_BASE,
    remoteBase:
      process.env.CK_CLOUD_TOKYO_BASE_URL || process.env.TOKYO_REMOTE_BASE_URL || DEFAULT_REMOTE_BASE,
    bucket: process.env.TOKYO_R2_BUCKET || DEFAULT_BUCKET,
    persistTo: process.env.TOKYO_ASSETS_SYNC_PERSIST_TO || DEFAULT_PERSIST_TO,
    platformAccountId: DEFAULT_PLATFORM_ACCOUNT_ID,
    max: Number.POSITIVE_INFINITY,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '').trim();
    if (!token) continue;
    if (token === '--help' || token === '-h') {
      printUsage();
      process.exit(0);
    }
    if (token === '--local-base') {
      args.localBase = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (token === '--remote-base') {
      args.remoteBase = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (token === '--bucket') {
      args.bucket = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (token === '--persist-to') {
      args.persistTo = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (token === '--platform-account') {
      args.platformAccountId = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (token === '--max') {
      const parsed = Number.parseInt(String(argv[i + 1] || '').trim(), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('--max must be a positive integer');
      }
      args.max = parsed;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  args.localBase = args.localBase.replace(/\/+$/, '');
  args.remoteBase = args.remoteBase.replace(/\/+$/, '');
  args.platformAccountId = args.platformAccountId.toLowerCase();
  if (!args.localBase) throw new Error('Missing local Tokyo base URL');
  if (!args.remoteBase) throw new Error('Missing remote Tokyo base URL');
  if (!args.bucket) throw new Error('Missing bucket name');
  if (!args.persistTo) throw new Error('Missing persist dir');
  if (!/^[0-9a-f-]{36}$/i.test(args.platformAccountId)) {
    throw new Error('Invalid platform account id');
  }
  return args;
}

function asTrimmedString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function extractCanonicalAssetRef(raw) {
  const direct = String(raw || '').trim();
  if (!direct) return null;
  const directPath = parseCanonicalAssetRef(direct);
  if (directPath) return directPath;
  const canonicalPath = toCanonicalAssetVersionPath(direct);
  return canonicalPath ? parseCanonicalAssetRef(canonicalPath) : null;
}

function collectLegacyAssetRefs(node, provenance, found, pathPrefix = '') {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((entry, index) =>
      collectLegacyAssetRefs(entry, provenance, found, `${pathPrefix}[${index}]`),
    );
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    if (key === 'ref' && typeof value === 'string') {
      const parsed = extractCanonicalAssetRef(value);
      if (parsed) {
        if (!found.has(parsed.versionKey)) {
          found.set(parsed.versionKey, {
            ...provenance,
            path: currentPath,
            ref: parsed.versionKey,
          });
        }
      }
      continue;
    }
    collectLegacyAssetRefs(value, provenance, found, currentPath);
  }
}

function collectLogicalAssetIds(node, provenance, found, pathPrefix = '') {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((entry, index) =>
      collectLogicalAssetIds(entry, provenance, found, `${pathPrefix}[${index}]`),
    );
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    if ((key === 'assetId' || key === 'posterAssetId') && typeof value === 'string') {
      const assetId = value.trim().toLowerCase();
      if (assetId && !found.has(assetId)) {
        found.set(assetId, { ...provenance, path: currentPath });
      }
      continue;
    }
    collectLogicalAssetIds(value, provenance, found, currentPath);
  }
}

async function loadPlatformRows(client, platformAccountId) {
  const [widgets, accountRows, curatedRows] = await Promise.all([
    supabaseFetchJson(client, `/rest/v1/widgets?select=id,type&order=type.asc&limit=${DEFAULT_PAGE_SIZE}`),
    supabaseFetchJson(
      client,
      `/rest/v1/widget_instances?select=public_id,display_name,widget_id,config&account_id=eq.${encodeURIComponent(platformAccountId)}&order=created_at.asc&limit=${DEFAULT_PAGE_SIZE}`,
    ),
    supabaseFetchJson(
      client,
      `/rest/v1/curated_widget_instances?select=public_id,widget_type,config,meta&owner_account_id=eq.${encodeURIComponent(platformAccountId)}&order=created_at.asc&limit=${DEFAULT_PAGE_SIZE}`,
    ),
  ]);

  const widgetTypeById = new Map();
  for (const row of Array.isArray(widgets) ? widgets : []) {
    const id = asTrimmedString(row?.id);
    const widgetType = asTrimmedString(row?.type);
    if (!id || !widgetType) continue;
    widgetTypeById.set(id, widgetType);
  }

  const rows = [];
  for (const row of Array.isArray(accountRows) ? accountRows : []) {
    const publicId = asTrimmedString(row?.public_id);
    const widgetType = widgetTypeById.get(asTrimmedString(row?.widget_id) || '') || null;
    if (!publicId || !widgetType || !row?.config || typeof row.config !== 'object') continue;
    rows.push({
      source: 'account',
      publicId,
      widgetType,
      config: row.config,
      displayName: asTrimmedString(row?.display_name) || publicId,
    });
  }

  for (const row of Array.isArray(curatedRows) ? curatedRows : []) {
    const publicId = asTrimmedString(row?.public_id);
    const widgetType = asTrimmedString(row?.widget_type);
    if (!publicId || !widgetType || !row?.config || typeof row.config !== 'object') continue;
    rows.push({
      source: 'curated',
      publicId,
      widgetType,
      config: row.config,
      displayName: publicId,
    });
  }

  return rows;
}

function normalizeContentType(raw) {
  return String(raw || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
}

function classifyAssetType(contentType, filename) {
  const mime = normalizeContentType(contentType);
  const ext = String(filename || '')
    .split('.')
    .pop()
    .trim()
    .toLowerCase();
  if (mime === 'image/svg+xml' || ext === 'svg') return 'vector';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'document';
  return 'other';
}

function manifestR2Key(accountId, assetId) {
  return `assets/meta/accounts/${accountId}/assets/${assetId}.json`;
}

function putLocalR2Object({ bucket, persistTo, key, filePath }) {
  const args = [
    '-C',
    'tokyo-worker',
    'exec',
    'wrangler',
    'r2',
    'object',
    'put',
    `${bucket}/${key}`,
    '--local',
    '--persist-to',
    persistTo,
    '--file',
    filePath,
  ];
  const result = spawnSync('pnpm', args, {
    cwd: repoRoot,
    stdio: 'pipe',
    env: process.env,
    encoding: 'utf8',
  });
  if (result.status === 0) return;
  const detail = `${result.stdout || ''}${result.stderr || ''}`.trim();
  throw new Error(detail || `wrangler r2 object put failed (${result.status ?? 'unknown'})`);
}

async function fetchRemoteAsset(remoteBase, canonicalPath) {
  const res = await fetch(`${remoteBase}${canonicalPath}`, { method: 'GET', cache: 'no-store' });
  const bytes = res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  return {
    ok: res.ok,
    status: res.status,
    contentType: res.headers.get('content-type') || 'application/octet-stream',
    bytes,
  };
}

function buildManifest(parsed, provenance, contentType, bodyBytes, originalFilename = null) {
  const filename = originalFilename || parsed.versionKey.split('/').pop() || 'upload.bin';
  const nowIso = new Date().toISOString();
  return {
    assetId: parsed.assetId,
    accountId: parsed.accountId,
    publicId: provenance.publicId,
    widgetType: provenance.widgetType,
    source: 'devstudio',
    originalFilename: filename,
    normalizedFilename: filename,
    contentType: normalizeContentType(contentType) || 'application/octet-stream',
    assetType: classifyAssetType(contentType, filename),
    sizeBytes: bodyBytes.length,
    sha256: crypto.createHash('sha256').update(bodyBytes).digest('hex'),
    createdAt: nowIso,
    updatedAt: nowIso,
    key: parsed.versionKey,
  };
}

function createRemoteHeaders(accountId) {
  const token = resolveFirstRootEnvValue(['TOKYO_DEV_JWT', 'CK_INTERNAL_SERVICE_JWT']);
  if (!token) throw new Error('Missing TOKYO_DEV_JWT or CK_INTERNAL_SERVICE_JWT');
  const headers = new Headers();
  headers.set('authorization', `Bearer ${token}`);
  headers.set('x-account-id', accountId);
  headers.set('x-ck-internal-service', 'devstudio.local');
  headers.set('accept', 'application/json');
  headers.set('content-type', 'application/json');
  return headers;
}

async function resolveRemoteAssetsById(remoteBase, accountId, assetIds) {
  if (!assetIds.length) {
    return { assetsById: new Map(), missingAssetIds: [] };
  }
  const response = await fetch(
    `${remoteBase}/assets/account/${encodeURIComponent(accountId)}/resolve`,
    {
      method: 'POST',
      headers: createRemoteHeaders(accountId),
      cache: 'no-store',
      body: JSON.stringify({ assetIds }),
    },
  );
  const payload = (await response.json().catch(() => null)) || null;
  if (!response.ok) {
    const detail =
      typeof payload?.error?.detail === 'string'
        ? payload.error.detail
        : typeof payload?.error?.reasonKey === 'string'
          ? payload.error.reasonKey
          : `remote_asset_resolve_http_${response.status}`;
    throw new Error(detail);
  }

  const assetsById = new Map();
  const assets = Array.isArray(payload?.assets) ? payload.assets : [];
  for (const asset of assets) {
    const assetId = typeof asset?.assetId === 'string' ? asset.assetId.trim().toLowerCase() : '';
    if (!assetId) continue;
    assetsById.set(assetId, asset);
  }
  const missingAssetIds = Array.isArray(payload?.missingAssetIds)
    ? payload.missingAssetIds
        .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
        .filter(Boolean)
    : [];
  return { assetsById, missingAssetIds };
}

async function loadRemoteSavedConfig(remoteBase, accountId, publicId) {
  const response = await fetch(
    `${remoteBase}/renders/instances/${encodeURIComponent(publicId)}/saved.json?accountId=${encodeURIComponent(accountId)}`,
    {
      method: 'GET',
      headers: createRemoteHeaders(accountId),
      cache: 'no-store',
    },
  );
  const payload = (await response.json().catch(() => null)) || null;
  if (!response.ok) {
    const detail =
      typeof payload?.error?.detail === 'string'
        ? payload.error.detail
        : typeof payload?.error?.reasonKey === 'string'
          ? payload.error.reasonKey
          : `remote_saved_http_${response.status}`;
    throw new Error(detail);
  }
  const config = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.config : null;
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`remote_saved_invalid:${publicId}`);
  }
  return config;
}

async function resolveRemoteAssetsBySavedSnapshots(remoteBase, accountId, rows, logicalAssetIds) {
  const assetsById = new Map();
  const missingAssetIds = [];

  for (const row of rows) {
    const neededAssetIds = new Set();
    for (const [assetId, provenance] of logicalAssetIds.entries()) {
      if (provenance.publicId === row.publicId) neededAssetIds.add(assetId);
    }
    if (!neededAssetIds.size) continue;

    const remoteConfig = await loadRemoteSavedConfig(remoteBase, accountId, row.publicId);
    const remoteRefs = new Map();
    collectLegacyAssetRefs(
      remoteConfig,
      {
        source: row.source,
        publicId: row.publicId,
        widgetType: row.widgetType,
        displayName: row.displayName,
      },
      remoteRefs,
    );

    for (const [versionKey] of remoteRefs.entries()) {
      const canonicalPath = toCanonicalAssetVersionPath(versionKey);
      const parsed = canonicalPath ? parseCanonicalAssetRef(canonicalPath) : null;
      if (!parsed) continue;
      if (!neededAssetIds.has(parsed.assetId) || assetsById.has(parsed.assetId)) continue;
      assetsById.set(parsed.assetId, {
        assetId: parsed.assetId,
        assetRef: parsed.versionKey,
      });
    }
  }

  for (const assetId of logicalAssetIds.keys()) {
    if (!assetsById.has(assetId)) missingAssetIds.push(assetId);
  }

  return { assetsById, missingAssetIds };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const client = createSupabaseClient({ preferLocal: true });
  const rows = await loadPlatformRows(client, args.platformAccountId);
  const legacyRefs = new Map();
  const logicalAssetIds = new Map();
  for (const row of rows) {
    collectLegacyAssetRefs(
      row.config,
      {
        source: row.source,
        publicId: row.publicId,
        widgetType: row.widgetType,
        displayName: row.displayName,
      },
      legacyRefs,
    );
    collectLogicalAssetIds(
      row.config,
      {
        source: row.source,
        publicId: row.publicId,
        widgetType: row.widgetType,
        displayName: row.displayName,
      },
      logicalAssetIds,
    );
  }

  let resolvedRemoteAssets = new Map();
  let missingAssetIds = [];
  let usedSavedSnapshotFallback = false;
  try {
    const resolved = await resolveRemoteAssetsById(
      args.remoteBase,
      args.platformAccountId,
      Array.from(logicalAssetIds.keys()),
    );
    resolvedRemoteAssets = resolved.assetsById;
    missingAssetIds = resolved.missingAssetIds;
  } catch (error) {
    usedSavedSnapshotFallback = true;
    const resolved = await resolveRemoteAssetsBySavedSnapshots(
      args.remoteBase,
      args.platformAccountId,
      rows,
      logicalAssetIds,
    );
    resolvedRemoteAssets = resolved.assetsById;
    missingAssetIds = resolved.missingAssetIds;
    console.log(
      `[seed-local-platform-assets] remote resolve unavailable; recovered asset refs from remote saved snapshots (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  console.log(
    `[seed-local-platform-assets] found ${logicalAssetIds.size} logical asset id(s) and ${legacyRefs.size} legacy asset ref(s) across ${rows.length} DevStudio-visible row(s)`,
  );

  let seeded = 0;
  let failures = 0;
  const issues = [];
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ck-seed-platform-assets-'));

  try {
    for (const assetId of missingAssetIds) {
      const provenance = logicalAssetIds.get(assetId);
      failures += 1;
      issues.push(
        `remote asset resolve missing ${assetId}${provenance ? ` (${provenance.publicId}:${provenance.path})` : ''}`,
      );
    }

    const workItems = [];

    for (const [assetId, provenance] of logicalAssetIds.entries()) {
      const resolved = resolvedRemoteAssets.get(assetId);
      const rawRef = typeof resolved?.assetRef === 'string' ? resolved.assetRef.trim() : '';
      const canonicalPath = rawRef ? toCanonicalAssetVersionPath(rawRef) : '';
      const parsed = canonicalPath ? parseCanonicalAssetRef(canonicalPath) : null;
      if (!canonicalPath || !parsed) {
        failures += 1;
        issues.push(`invalid resolved asset ref ${assetId} (${provenance.publicId}:${provenance.path})`);
        continue;
      }
      if (parsed.accountId !== args.platformAccountId) {
        failures += 1;
        issues.push(
          `unexpected owner ${parsed.accountId} for ${provenance.publicId}:${provenance.path} (${rawRef})`,
        );
        continue;
      }
      if (/^00000000-0000-0000-0000-000000000000$/i.test(parsed.assetId)) {
        failures += 1;
        issues.push(
          `zero asset id in ${provenance.publicId}:${provenance.path} (${rawRef})`,
        );
        continue;
      }
      workItems.push({
        parsed,
        canonicalPath,
        provenance,
        originalFilename:
          typeof resolved?.originalFilename === 'string' && resolved.originalFilename.trim()
            ? resolved.originalFilename.trim()
            : null,
      });
    }

    for (const [versionKey, provenance] of legacyRefs) {
      const canonicalPath = toCanonicalAssetVersionPath(versionKey);
      const parsed = canonicalPath ? parseCanonicalAssetRef(canonicalPath) : null;
      if (!canonicalPath || !parsed) {
        failures += 1;
        issues.push(`invalid ref ${versionKey} (${provenance.publicId}:${provenance.path})`);
        continue;
      }
      if (logicalAssetIds.has(parsed.assetId)) {
        continue;
      }
      if (parsed.accountId !== args.platformAccountId) {
        failures += 1;
        issues.push(
          `unexpected owner ${parsed.accountId} for ${provenance.publicId}:${provenance.path} (${versionKey})`,
        );
        continue;
      }
      if (/^00000000-0000-0000-0000-000000000000$/i.test(parsed.assetId)) {
        failures += 1;
        issues.push(
          `zero asset id in ${provenance.publicId}:${provenance.path} (${versionKey})`,
        );
        continue;
      }
      workItems.push({
        parsed,
        canonicalPath,
        provenance,
        originalFilename: null,
      });
    }

    const seenVersionKeys = new Set();
    for (const item of workItems) {
      if (seeded >= args.max) break;
      if (seenVersionKeys.has(item.parsed.versionKey)) continue;
      seenVersionKeys.add(item.parsed.versionKey);

      const remote = await fetchRemoteAsset(args.remoteBase, item.canonicalPath);
      if (!remote.ok || !remote.bytes) {
        failures += 1;
        issues.push(
          `remote ${remote.status} for ${item.provenance.publicId}:${item.provenance.path} (${item.canonicalPath})`,
        );
        continue;
      }

      const manifest = buildManifest(
        item.parsed,
        item.provenance,
        remote.contentType,
        remote.bytes,
        item.originalFilename,
      );
      const blobPath = path.join(tempDir, `${item.parsed.assetId}.blob`);
      const manifestPath = path.join(tempDir, `${item.parsed.assetId}.manifest.json`);
      await writeFile(blobPath, remote.bytes);
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      try {
        putLocalR2Object({
          bucket: args.bucket,
          persistTo: args.persistTo,
          key: item.parsed.versionKey,
          filePath: blobPath,
        });
        putLocalR2Object({
          bucket: args.bucket,
          persistTo: args.persistTo,
          key: manifestR2Key(item.parsed.accountId, item.parsed.assetId),
          filePath: manifestPath,
        });
        seeded += 1;
        console.log(
          `[seed-local-platform-assets] seeded ${item.canonicalPath} for ${item.provenance.publicId}`,
        );
      } catch (error) {
        failures += 1;
        issues.push(
          `local put failed for ${item.provenance.publicId}:${item.provenance.path} (${item.canonicalPath}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  console.log('[seed-local-platform-assets] done');
  console.log(`  rows=${rows.length}`);
  console.log(`  logical_asset_ids=${logicalAssetIds.size}`);
  console.log(`  legacy_refs=${legacyRefs.size}`);
  console.log(`  remote_saved_snapshot_fallback=${usedSavedSnapshotFallback ? 'yes' : 'no'}`);
  console.log(`  seeded=${seeded}`);
  console.log(`  failures=${failures}`);
  for (const issue of issues.slice(0, 20)) {
    console.log(`  issue: ${issue}`);
  }
  if (issues.length > 20) {
    console.log(`  issue: ... (${issues.length - 20} more)`);
  }

  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error('[seed-local-platform-assets] failed:', detail);
  process.exit(1);
});

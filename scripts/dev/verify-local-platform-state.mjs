#!/usr/bin/env node

import { parseCanonicalAssetRef, toCanonicalAssetVersionPath } from '../../packages/ck-contracts/src/index.js';
import { requestLoopback, requestLoopbackJson } from './local-loopback-http.mjs';
import { createSupabaseClient, supabaseFetchJson } from './local-supabase.mjs';
import { resolveFirstRootEnvValue } from './local-root-env.mjs';

const DEFAULT_PLATFORM_ACCOUNT_ID =
  process.env.CK_PLATFORM_ACCOUNT_ID || '00000000-0000-0000-0000-000000000100';
const DEFAULT_LOCAL_TOKYO_BASE = process.env.TOKYO_LOCAL_BASE_URL || 'http://localhost:4000';
const DEFAULT_TOKYO_WORKER_BASE = process.env.TOKYO_WORKER_BASE_URL || 'http://localhost:8791';
const DEFAULT_INTERNAL_SERVICE = 'devstudio.local';
const DEFAULT_PAGE_SIZE = 500;

function printUsage() {
  console.log(`Usage: node scripts/dev/verify-local-platform-state.mjs

Verifies DevStudio-visible platform state explicitly:
- local Tokyo saved snapshots exist
- local canonical /assets/v/* reads work
- no zero-id or invalid asset refs are present in DevStudio-visible rows
`);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printUsage();
  process.exit(0);
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

function collectLegacyAssetRefs(node, provenance, out, pathPrefix = '') {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((entry, index) =>
      collectLegacyAssetRefs(entry, provenance, out, `${pathPrefix}[${index}]`),
    );
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    if (key === 'ref' && typeof value === 'string') {
      out.push({
        ...provenance,
        path: currentPath,
        raw: value.trim(),
      });
      continue;
    }
    collectLegacyAssetRefs(value, provenance, out, currentPath);
  }
}

function collectLogicalAssetIds(node, provenance, out, pathPrefix = '') {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((entry, index) =>
      collectLogicalAssetIds(entry, provenance, out, `${pathPrefix}[${index}]`),
    );
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    if ((key === 'assetId' || key === 'posterAssetId') && typeof value === 'string') {
      const assetId = value.trim().toLowerCase();
      if (!assetId) continue;
      const entries = out.get(assetId) || [];
      entries.push({
        ...provenance,
        path: currentPath,
      });
      out.set(assetId, entries);
      continue;
    }
    collectLogicalAssetIds(value, provenance, out, currentPath);
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
      `/rest/v1/curated_widget_instances?select=public_id,widget_type,config&owner_account_id=eq.${encodeURIComponent(platformAccountId)}&order=created_at.asc&limit=${DEFAULT_PAGE_SIZE}`,
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
      accountId: platformAccountId,
      publicId,
      widgetType,
      config: row.config,
    });
  }

  for (const row of Array.isArray(curatedRows) ? curatedRows : []) {
    const publicId = asTrimmedString(row?.public_id);
    const widgetType = asTrimmedString(row?.widget_type);
    if (!publicId || !widgetType || !row?.config || typeof row.config !== 'object') continue;
    rows.push({
      source: 'curated',
      accountId: platformAccountId,
      publicId,
      widgetType,
      config: row.config,
    });
  }

  return rows;
}

function createInternalHeaders(accountId) {
  const token = resolveFirstRootEnvValue(['TOKYO_DEV_JWT', 'CK_INTERNAL_SERVICE_JWT']);
  if (!token) throw new Error('Missing TOKYO_DEV_JWT or CK_INTERNAL_SERVICE_JWT');
  const headers = new Headers();
  headers.set('authorization', `Bearer ${token}`);
  headers.set('x-account-id', accountId);
  headers.set('x-ck-internal-service', DEFAULT_INTERNAL_SERVICE);
  headers.set('accept', 'application/json');
  return headers;
}

async function resolveLocalAssetsById(accountId, assetIds) {
  if (!assetIds.length) {
    return { assetsById: new Map(), missingAssetIds: [] };
  }
  const response = requestLoopbackJson(
    `${String(DEFAULT_TOKYO_WORKER_BASE).replace(/\/+$/, '')}/assets/account/${encodeURIComponent(accountId)}/resolve`,
    {
      method: 'POST',
      headers: (() => {
        const headers = createInternalHeaders(accountId);
        headers.set('content-type', 'application/json');
        return headers;
      })(),
      body: { assetIds },
    },
  );
  const payload = response.json || null;
  if (!response.ok) {
    const detail =
      typeof payload?.error?.detail === 'string'
        ? payload.error.detail
        : typeof payload?.error?.reasonKey === 'string'
          ? payload.error.reasonKey
          : `local_asset_resolve_http_${response.status}`;
    throw new Error(detail);
  }

  const assetsById = new Map();
  const assets = Array.isArray(payload?.assets) ? payload.assets : [];
  for (const asset of assets) {
    const assetId = typeof asset?.assetId === 'string' ? asset.assetId.trim().toLowerCase() : '';
    const url = typeof asset?.url === 'string' ? asset.url.trim() : '';
    if (!assetId || !url) continue;
    assetsById.set(assetId, asset);
  }
  const missingAssetIds = Array.isArray(payload?.missingAssetIds)
    ? payload.missingAssetIds
        .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
        .filter(Boolean)
    : [];
  return { assetsById, missingAssetIds };
}

async function hasSavedSnapshot(row) {
  const url = `${String(DEFAULT_TOKYO_WORKER_BASE).replace(/\/+$/, '')}/renders/instances/${encodeURIComponent(
    row.publicId,
  )}/saved.json?accountId=${encodeURIComponent(row.accountId)}`;
  const res = requestLoopback(url, {
    method: 'GET',
    headers: createInternalHeaders(row.accountId),
  });
  return res.status === 200;
}

async function hasLocalAssetAtPath(pathname) {
  const path = String(pathname || '').trim();
  if (!path) return false;
  const target = path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${String(DEFAULT_LOCAL_TOKYO_BASE).replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  const res = requestLoopback(target, {
    method: 'HEAD',
    discardBody: true,
  });
  return res.status === 200;
}

async function main() {
  const client = createSupabaseClient({ preferLocal: true });
  const platformAccountId = String(DEFAULT_PLATFORM_ACCOUNT_ID).trim().toLowerCase();
  const rows = await loadPlatformRows(client, platformAccountId);
  const logicalAssetIds = new Map();
  const legacyAssetRefs = [];
  for (const row of rows) {
    collectLogicalAssetIds(
      row.config,
      {
        source: row.source,
        publicId: row.publicId,
        accountId: row.accountId,
        widgetType: row.widgetType,
      },
      logicalAssetIds,
    );
    collectLegacyAssetRefs(
      row.config,
      {
        source: row.source,
        publicId: row.publicId,
        accountId: row.accountId,
        widgetType: row.widgetType,
      },
      legacyAssetRefs,
    );
  }

  let failures = 0;
  const issues = [];

  for (const row of rows) {
    if (!(await hasSavedSnapshot(row))) {
      failures += 1;
      issues.push(`missing saved snapshot for ${row.publicId}`);
    }
  }

  const logicalAssetIdList = Array.from(logicalAssetIds.keys());
  const { assetsById, missingAssetIds } = await resolveLocalAssetsById(
    platformAccountId,
    logicalAssetIdList,
  );

  for (const assetId of missingAssetIds) {
    const references = logicalAssetIds.get(assetId) || [];
    failures += Math.max(1, references.length);
    if (!references.length) {
      issues.push(`missing local asset for logical asset ${assetId}`);
      continue;
    }
    for (const reference of references) {
      issues.push(`missing local asset for ${reference.publicId}:${reference.path} (${assetId})`);
    }
  }

  for (const [assetId, references] of logicalAssetIds.entries()) {
    if (missingAssetIds.includes(assetId)) continue;
    const resolved = assetsById.get(assetId);
    const url = typeof resolved?.url === 'string' ? resolved.url.trim() : '';
    if (!url) {
      failures += references.length || 1;
      for (const reference of references) {
        issues.push(`resolved asset missing url for ${reference.publicId}:${reference.path} (${assetId})`);
      }
      continue;
    }
    if (!(await hasLocalAssetAtPath(url))) {
      failures += references.length || 1;
      for (const reference of references) {
        issues.push(`missing local asset blob for ${reference.publicId}:${reference.path} (${assetId})`);
      }
    }
  }

  for (const entry of legacyAssetRefs) {
    const parsed = extractCanonicalAssetRef(entry.raw);
    if (!parsed) {
      failures += 1;
      issues.push(`invalid asset ref in ${entry.publicId}:${entry.path} (${entry.raw})`);
      continue;
    }
    if (/^00000000-0000-0000-0000-000000000000$/i.test(parsed.assetId)) {
      failures += 1;
      issues.push(`zero asset id in ${entry.publicId}:${entry.path} (${parsed.versionKey})`);
      continue;
    }
    if (!(await hasLocalAssetAtPath(toCanonicalAssetVersionPath(parsed.versionKey)))) {
      failures += 1;
      issues.push(`missing local asset for ${entry.publicId}:${entry.path} (${parsed.versionKey})`);
    }
  }

  console.log('[verify-local-platform-state] done');
  console.log(`  rows=${rows.length}`);
  console.log(`  logical_asset_ids=${logicalAssetIdList.length}`);
  console.log(`  legacy_asset_refs=${legacyAssetRefs.length}`);
  console.log(`  failures=${failures}`);
  for (const issue of issues.slice(0, 30)) {
    console.log(`  issue: ${issue}`);
  }
  if (issues.length > 30) {
    console.log(`  issue: ... (${issues.length - 30} more)`);
  }

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error('[verify-local-platform-state] failed:', detail);
  process.exit(1);
});

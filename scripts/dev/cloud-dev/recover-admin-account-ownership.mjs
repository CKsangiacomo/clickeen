#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { isUuid, parseCanonicalAssetRef, toCanonicalAssetVersionPath } from '../../../tooling/ck-contracts/src/index.js';

const CHECKPOINT_DIR = path.join(process.cwd(), 'scripts/dev/cloud-dev/.tmp');
const CHECKPOINT_FILE = path.join(CHECKPOINT_DIR, 'prd60-admin-account-recovery.json');
const DEFAULT_ADMIN_ACCOUNT_ID = '00000000-0000-0000-0000-000000000100';
const USER_INSTANCE_TABLE = 'widget_instances';
const CURATED_INSTANCE_TABLE = 'curated_widget_instances';
const ACCOUNT_BUSINESS_PROFILE_TABLE = 'account_business_profiles';
const ACCOUNT_NOTICE_TABLE = 'account_notices';

function loadDotenv(filepath) {
  try {
    const text = fs.readFileSync(filepath, 'utf8');
    const out = {};
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function printUsage() {
  console.log(`Usage: node scripts/dev/cloud-dev/recover-admin-account-ownership.mjs --stage <inventory|migrate|verify|delete> [--apply]

Stages:
  inventory          Read-only. Builds the recovery checkpoint and prints counts.
  migrate            Moves surviving rows/assets to admin account. Requires --apply.
  verify             Read-only. Confirms no migrated rows/refs still point at junk accounts.
  delete             Purges junk account assets and deletes non-admin accounts. Requires --apply.

Options:
  --checkpoint <p>   Override checkpoint file path
  --help             Show this message
`);
}

function parseArgs(argv) {
  const out = {
    stage: '',
    apply: false,
    checkpoint: CHECKPOINT_FILE,
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
    if (arg === '--stage') {
      const next = String(argv[i + 1] || '').trim().toLowerCase();
      if (!next) throw new Error('--stage requires a value');
      out.stage = next;
      i += 1;
      continue;
    }
    if (arg === '--checkpoint') {
      const next = String(argv[i + 1] || '').trim();
      if (!next) throw new Error('--checkpoint requires a value');
      out.checkpoint = path.resolve(process.cwd(), next);
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return out;
}

function assertString(value, label) {
  const out = typeof value === 'string' ? value.trim() : '';
  if (!out) throw new Error(`Missing ${label}`);
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
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
  if (value.startsWith('/')) return value.split('?')[0].split('#')[0];
  return null;
}

function parseAssetVersionKey(raw) {
  const direct = String(raw || '').trim();
  if (!direct) return '';
  const directCanonicalPath = toCanonicalAssetVersionPath(direct);
  if (directCanonicalPath) {
    const parsed = parseCanonicalAssetRef(directCanonicalPath);
    if (parsed?.kind === 'version' && typeof parsed.versionKey === 'string' && parsed.versionKey.trim()) {
      return parsed.versionKey.trim();
    }
  }

  const pathname = toPathname(direct);
  if (!pathname) return '';
  const parsed = parseCanonicalAssetRef(pathname);
  if (parsed?.kind === 'version' && typeof parsed.versionKey === 'string' && parsed.versionKey.trim()) {
    return parsed.versionKey.trim();
  }
  return '';
}

function parseVersionKeyParts(versionKey) {
  const canonicalPath = toCanonicalAssetVersionPath(versionKey);
  const parsed = canonicalPath ? parseCanonicalAssetRef(canonicalPath) : null;
  if (!parsed || parsed.kind !== 'version') return null;
  const key = String(parsed.versionKey || '').trim();
  const suffix = key.replace(/^assets\/versions\//, '');
  const parts = suffix.split('/').filter(Boolean);
  if (parts.length !== 3) return null;
  const accountId = parts[0];
  const assetId = parts[1];
  if (!isUuid(accountId) || !isUuid(assetId)) return null;
  return {
    accountId,
    assetId,
    filename: parts[2],
    versionKey: key,
  };
}

function visitAssetRefs(node, callback, pathLabel = 'root') {
  if (typeof node === 'string') {
    const direct = parseAssetVersionKey(node);
    if (direct) callback({ versionKey: direct, kind: 'string', path: pathLabel, value: node });

    const CSS_URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
    let match = CSS_URL_RE.exec(node);
    while (match) {
      const candidate = String(match[2] || '').trim();
      const versionKey = parseAssetVersionKey(candidate);
      if (versionKey) {
        callback({ versionKey, kind: 'css-url', path: pathLabel, value: candidate });
      }
      match = CSS_URL_RE.exec(node);
    }
    return;
  }

  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((entry, index) => visitAssetRefs(entry, callback, `${pathLabel}[${index}]`));
    return;
  }

  const record = node;
  Object.entries(record).forEach(([key, value]) => {
    const nextPath = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
      ? `${pathLabel}.${key}`
      : `${pathLabel}[${JSON.stringify(key)}]`;
    visitAssetRefs(value, callback, nextPath);
  });
}

function collectAssetVersionKeys(...values) {
  const out = new Set();
  values.forEach((value) => {
    visitAssetRefs(value, ({ versionKey }) => out.add(versionKey));
  });
  return Array.from(out);
}

function rewriteAssetRefs(root, versionKeyMap) {
  const clone = root == null ? root : JSON.parse(JSON.stringify(root));

  const rewriteString = (raw) => {
    const direct = parseAssetVersionKey(raw);
    if (direct) {
      const nextVersionKey = versionKeyMap.get(direct);
      if (!nextVersionKey || nextVersionKey === direct) return raw;
      const nextPath = toCanonicalAssetVersionPath(nextVersionKey);
      return nextPath || raw;
    }

    const CSS_URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
    return String(raw || '').replace(CSS_URL_RE, (full, quote, candidate) => {
      const versionKey = parseAssetVersionKey(candidate);
      if (!versionKey) return full;
      const nextVersionKey = versionKeyMap.get(versionKey);
      if (!nextVersionKey || nextVersionKey === versionKey) return full;
      const nextPath = toCanonicalAssetVersionPath(nextVersionKey);
      if (!nextPath) return full;
      return `url(${quote || ''}${nextPath}${quote || ''})`;
    });
  };

  const visit = (node) => {
    if (typeof node === 'string') {
      return rewriteString(node);
    }
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) {
      return node.map((entry) => visit(entry));
    }
    const record = node;
    Object.entries(record).forEach(([key, value]) => {
      record[key] = visit(value);
    });
    return record;
  };

  return visit(clone);
}

function isSeoGeoEnabled(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return false;
  const seoGeo = config.seoGeo;
  return Boolean(seoGeo && typeof seoGeo === 'object' && !Array.isArray(seoGeo) && seoGeo.enabled === true);
}

function normalizeLocalePolicyForUpdate(policy, accountLocales) {
  const baseLocaleRaw =
    policy && typeof policy === 'object' && !Array.isArray(policy) && typeof policy.baseLocale === 'string'
      ? policy.baseLocale.trim()
      : '';
  const baseLocale = baseLocaleRaw || 'en';
  const locales = new Set([baseLocale]);
  if (Array.isArray(accountLocales)) {
    accountLocales.forEach((locale) => {
      const normalized = typeof locale === 'string' ? locale.trim() : '';
      if (normalized) locales.add(normalized);
    });
  }

  const record = policy && typeof policy === 'object' && !Array.isArray(policy) ? { ...policy } : { v: 1 };
  record.v = 1;
  record.baseLocale = baseLocale;
  record.availableLocales = Array.from(locales);
  record.ip =
    record.ip && typeof record.ip === 'object' && !Array.isArray(record.ip)
      ? record.ip
      : { enabled: false, countryToLocale: {} };
  record.switcher =
    record.switcher && typeof record.switcher === 'object' && !Array.isArray(record.switcher)
      ? record.switcher
      : { enabled: true };
  return record;
}

function loadCheckpoint(filepath) {
  try {
    const raw = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCheckpoint(filepath, value) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text().catch(() => '');
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { res, data, text };
}

function buildSupabaseClient(env) {
  const base = assertString(env.SUPABASE_URL, 'SUPABASE_URL').replace(/\/+$/, '');
  const serviceRole = assertString(env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
  return { base, serviceRole };
}

async function supabaseFetch(client, pathnameWithQuery, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('apikey', client.serviceRole);
  headers.set('authorization', `Bearer ${client.serviceRole}`);
  if (!headers.has('content-type') && init.body != null) headers.set('content-type', 'application/json');
  const res = await fetch(`${client.base}${pathnameWithQuery}`, { ...init, headers });
  const text = await res.text().catch(() => '');
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(`Supabase ${res.status} ${pathnameWithQuery}: ${text || '<empty>'}`);
  }
  return data;
}

async function loginPassword(env) {
  const berlinBase = assertString(env.CK_CLOUD_BERLIN_BASE_URL || 'https://berlin-dev.clickeen.workers.dev', 'CK_CLOUD_BERLIN_BASE_URL').replace(/\/+$/, '');
  const email = assertString(env.CK_ADMIN_EMAIL, 'CK_ADMIN_EMAIL');
  const password = assertString(env.CK_ADMIN_PASSWORD, 'CK_ADMIN_PASSWORD');
  const { res, data, text } = await fetchJson(`${berlinBase}/auth/login/password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const reason = data?.error?.reasonKey || data?.error || null;
    throw new Error(`Berlin password login failed (${res.status}) reasonKey=${reason || 'unknown'} ${text.slice(0, 160)}`);
  }
  return assertString(data?.accessToken, 'berlin accessToken');
}

async function loadBootstrap(env, accessToken) {
  const parisBase = assertString(env.CK_CLOUD_PARIS_BASE_URL, 'CK_CLOUD_PARIS_BASE_URL').replace(/\/+$/, '');
  const { res, data, text } = await fetchJson(`${parisBase}/api/roma/bootstrap`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Paris bootstrap failed (${res.status}) ${text.slice(0, 200)}`);
  }
  return data;
}

async function loadRowsByAccountIds(client, table, accountColumn, select, accountIds) {
  const rows = [];
  for (const ids of chunk(accountIds, 20)) {
    if (!ids.length) continue;
    const params = new URLSearchParams({
      select,
      [accountColumn]: `in.(${ids.join(',')})`,
      limit: '1000',
      order: 'public_id.asc',
    });
    const batch = await supabaseFetch(client, `/rest/v1/${table}?${params.toString()}`, { method: 'GET' });
    if (Array.isArray(batch)) rows.push(...batch);
  }
  return rows;
}

async function loadRowsByPublicIds(client, table, select, publicIds) {
  const rows = [];
  for (const ids of chunk(publicIds, 20)) {
    if (!ids.length) continue;
    const params = new URLSearchParams({
      select,
      public_id: `in.(${ids.join(',')})`,
      limit: '1000',
      order: 'public_id.asc',
    });
    const batch = await supabaseFetch(client, `/rest/v1/${table}?${params.toString()}`, { method: 'GET' });
    if (Array.isArray(batch)) rows.push(...batch);
  }
  return rows;
}

async function countRowsByAccountIds(client, table, accountColumn, accountIds) {
  let count = 0;
  for (const ids of chunk(accountIds, 20)) {
    if (!ids.length) continue;
    const params = new URLSearchParams({
      select: 'id',
      [accountColumn]: `in.(${ids.join(',')})`,
      limit: '1000',
    });
    const batch = await supabaseFetch(client, `/rest/v1/${table}?${params.toString()}`, { method: 'GET' });
    if (Array.isArray(batch)) count += batch.length;
  }
  return count;
}

async function patchSupabaseRow(client, table, filters, patch) {
  const params = new URLSearchParams(filters);
  const data = await supabaseFetch(client, `/rest/v1/${table}?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  return Array.isArray(data) ? data[0] ?? null : null;
}

async function loadSingleSupabaseRow(client, table, select, filterKey, filterValue) {
  const params = new URLSearchParams({
    select,
    [filterKey]: `eq.${filterValue}`,
    limit: '1',
  });
  const data = await supabaseFetch(client, `/rest/v1/${table}?${params.toString()}`, { method: 'GET' });
  return Array.isArray(data) ? data[0] ?? null : null;
}

function isMissingTableError(error) {
  const detail = error instanceof Error ? error.message : String(error);
  return detail.includes('PGRST205') || detail.includes('Could not find the table');
}

async function deleteSupabaseByAccountIds(client, table, accountColumn, accountIds, options = {}) {
  const ignoreMissingTable = options.ignoreMissingTable === true;
  for (const ids of chunk(accountIds, 20)) {
    if (!ids.length) continue;
    const params = new URLSearchParams({
      [accountColumn]: `in.(${ids.join(',')})`,
    });
    try {
      await supabaseFetch(client, `/rest/v1/${table}?${params.toString()}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
    } catch (error) {
      if (ignoreMissingTable && isMissingTableError(error)) return;
      throw error;
    }
  }
}

async function listAccountAssets(env, accessToken, accountId) {
  const tokyoBase = assertString(env.CK_CLOUD_TOKYO_BASE_URL, 'CK_CLOUD_TOKYO_BASE_URL').replace(/\/+$/, '');
  const tokyoToken = String(env.TOKYO_DEV_JWT || accessToken || '').trim();
  const { res, data, text } = await fetchJson(`${tokyoBase}/assets/account/${encodeURIComponent(accountId)}`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${tokyoToken}`,
      accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Tokyo assets list failed for ${accountId} (${res.status}) ${text.slice(0, 200)}`);
  }
  return Array.isArray(data?.assets) ? data.assets : [];
}

async function fetchAccountInstanceEnvelope(env, accessToken, accountId, publicId) {
  const parisBase = assertString(env.CK_CLOUD_PARIS_BASE_URL, 'CK_CLOUD_PARIS_BASE_URL').replace(/\/+$/, '');
  const { res, data, text } = await fetchJson(
    `${parisBase}/api/accounts/${encodeURIComponent(accountId)}/instance/${encodeURIComponent(publicId)}?subject=account`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      },
      cache: 'no-store',
    },
  );
  if (!res.ok) {
    throw new Error(`Paris get instance failed for ${publicId} (${res.status}) ${text.slice(0, 220)}`);
  }
  return data;
}

async function listLayerRows(env, accessToken, accountId, publicId) {
  const parisBase = assertString(env.CK_CLOUD_PARIS_BASE_URL, 'CK_CLOUD_PARIS_BASE_URL').replace(/\/+$/, '');
  const list = await fetchJson(
    `${parisBase}/api/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(publicId)}/layers?subject=account`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      },
      cache: 'no-store',
    },
  );
  if (!list.res.ok) {
    throw new Error(`Paris list layers failed for ${publicId} (${list.res.status}) ${list.text.slice(0, 220)}`);
  }
  const entries = Array.isArray(list.data?.layers) ? list.data.layers : [];
  const out = [];
  for (const entry of entries) {
    const layer = assertString(entry?.layer, `${publicId} layer`);
    const layerKey = assertString(entry?.layerKey, `${publicId} layerKey`);
    const detail = await fetchJson(
      `${parisBase}/api/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(publicId)}/layers/${encodeURIComponent(layer)}/${encodeURIComponent(layerKey)}?subject=account`,
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
        },
        cache: 'no-store',
      },
    );
    if (!detail.res.ok) {
      throw new Error(`Paris get layer failed for ${publicId} ${layer}/${layerKey} (${detail.res.status}) ${detail.text.slice(0, 220)}`);
    }
    out.push(detail.data);
  }
  return out;
}

async function upsertLayerRow(env, accessToken, accountId, publicId, row) {
  const parisBase = assertString(env.CK_CLOUD_PARIS_BASE_URL, 'CK_CLOUD_PARIS_BASE_URL').replace(/\/+$/, '');
  const submit = async (layer, layerKey, payload) => {
    const { res, text } = await fetchJson(
      `${parisBase}/api/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(publicId)}/layers/${encodeURIComponent(layer)}/${encodeURIComponent(layerKey)}?subject=account`,
      {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      throw new Error(`Paris upsert layer failed for ${publicId} ${layer}/${layerKey} (${res.status}) ${text.slice(0, 220)}`);
    }
  };

  if (row.layer === 'locale') {
    await submit(row.layer, row.layerKey, {
      source: row.source ?? 'user',
      ops: Array.isArray(row.ops) ? row.ops : [],
      baseFingerprint: row.baseFingerprint ?? null,
      baseUpdatedAt: row.baseUpdatedAt ?? null,
      geoTargets: Array.isArray(row.geoTargets) ? row.geoTargets : null,
    });
    if (Array.isArray(row.userOps) && row.userOps.length > 0) {
      await submit('user', row.layerKey, {
        source: 'user',
        userOps: row.userOps,
        baseFingerprint: row.baseFingerprint ?? null,
        baseUpdatedAt: row.baseUpdatedAt ?? null,
      });
    }
    return;
  }

  await submit(row.layer, row.layerKey, {
    ...(Array.isArray(row.ops) && row.ops.length > 0
      ? {
          source: row.source ?? 'user',
          ops: row.ops,
        }
      : {}),
    baseFingerprint: row.baseFingerprint ?? null,
    baseUpdatedAt: row.baseUpdatedAt ?? null,
    userOps: Array.isArray(row.userOps) ? row.userOps : [],
  });
}

async function updateInstanceViaParis(env, accessToken, accountId, publicId, body) {
  const parisBase = assertString(env.CK_CLOUD_PARIS_BASE_URL, 'CK_CLOUD_PARIS_BASE_URL').replace(/\/+$/, '');
  const { res, text } = await fetchJson(
    `${parisBase}/api/accounts/${encodeURIComponent(accountId)}/instance/${encodeURIComponent(publicId)}?subject=account`,
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new Error(`Paris instance update failed for ${publicId} (${res.status}) ${text.slice(0, 220)}`);
  }
}

async function uploadAssetVersionToAdmin(env, accessToken, adminAccountId, versionKey) {
  const tokyoBase = assertString(env.CK_CLOUD_TOKYO_BASE_URL, 'CK_CLOUD_TOKYO_BASE_URL').replace(/\/+$/, '');
  const tokyoToken = String(env.TOKYO_DEV_JWT || accessToken || '').trim();
  const parsed = parseVersionKeyParts(versionKey);
  if (!parsed) throw new Error(`Invalid asset version key: ${versionKey}`);
  const canonicalPath = toCanonicalAssetVersionPath(versionKey);
  if (!canonicalPath) throw new Error(`Failed to build canonical path for ${versionKey}`);

  const sourceRes = await fetch(`${tokyoBase}${canonicalPath}`, {
    method: 'GET',
    headers: { accept: '*/*' },
    cache: 'no-store',
  });
  if (!sourceRes.ok) {
    throw new Error(`Tokyo asset download failed for ${versionKey} (${sourceRes.status})`);
  }
  const body = await sourceRes.arrayBuffer();
  const contentType = (sourceRes.headers.get('content-type') || 'application/octet-stream').trim();

  const upload = await fetchJson(`${tokyoBase}/assets/upload?_t=${Date.now()}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tokyoToken}`,
      accept: 'application/json',
      'x-account-id': adminAccountId,
      'x-source': 'promotion',
      'x-filename': parsed.filename,
      'content-type': contentType,
    },
    body,
  });
  if (!upload.res.ok) {
    throw new Error(`Tokyo asset upload failed for ${versionKey} (${upload.res.status}) ${upload.text.slice(0, 200)}`);
  }
  const uploadedKey = typeof upload.data?.key === 'string' ? upload.data.key.trim() : '';
  if (uploadedKey) return uploadedKey;
  const uploadedUrl = typeof upload.data?.url === 'string' ? upload.data.url.trim() : '';
  const nextVersionKey = parseAssetVersionKey(uploadedUrl);
  if (!nextVersionKey) {
    throw new Error(`Tokyo asset upload missing canonical key for ${versionKey}`);
  }
  return nextVersionKey;
}

async function buildInventory(env, client, accessToken, adminAccountId) {
  const bootstrap = await loadBootstrap(env, accessToken);
  const accounts = Array.isArray(bootstrap?.accounts) ? bootstrap.accounts : [];
  const targetAccounts = accounts.filter((entry) => entry?.accountId && entry.accountId !== adminAccountId);
  const targetAccountIds = targetAccounts
    .map((entry) => String(entry.accountId || '').trim())
    .filter((entry) => isUuid(entry));
  const managedAccountIds = Array.from(new Set([adminAccountId, ...targetAccountIds]));

  const [userInstances, curatedInstances] = await Promise.all([
    loadRowsByAccountIds(
      client,
      USER_INSTANCE_TABLE,
      'account_id',
      'public_id,account_id,status,display_name,config,updated_at',
      managedAccountIds,
    ),
    loadRowsByAccountIds(
      client,
      CURATED_INSTANCE_TABLE,
      'owner_account_id',
      'public_id,owner_account_id,status,config,meta,widget_type,updated_at',
      managedAccountIds,
    ),
  ]);

  const assetCountsByAccount = {};
  for (const accountId of targetAccountIds) {
    const assets = await listAccountAssets(env, accessToken, accountId);
    assetCountsByAccount[accountId] = assets.length;
  }

  const foreignAssetVersionKeys = new Set();
  const impactedAdminUserPublicIds = [];
  const impactedAdminCuratedPublicIds = [];
  const userRowsToMove = [];
  const curatedRowsToMove = [];

  userInstances.forEach((row) => {
    const ownerAccountId = String(row.account_id || '').trim();
    const publicId = String(row.public_id || '').trim();
    if (ownerAccountId && ownerAccountId !== adminAccountId) {
      userRowsToMove.push(publicId);
    }
    const refs = collectAssetVersionKeys(row.config);
    const hasForeignRef = refs.some((versionKey) => {
      const parsed = parseVersionKeyParts(versionKey);
      if (!parsed || parsed.accountId === adminAccountId) return false;
      foreignAssetVersionKeys.add(versionKey);
      return ownerAccountId === adminAccountId;
    });
    if (ownerAccountId === adminAccountId && hasForeignRef) impactedAdminUserPublicIds.push(publicId);
  });

  curatedInstances.forEach((row) => {
    const ownerAccountId = String(row.owner_account_id || '').trim();
    const publicId = String(row.public_id || '').trim();
    if (ownerAccountId && ownerAccountId !== adminAccountId) {
      curatedRowsToMove.push(publicId);
    }
    const refs = collectAssetVersionKeys(row.config);
    const hasForeignRef = refs.some((versionKey) => {
      const parsed = parseVersionKeyParts(versionKey);
      if (!parsed || parsed.accountId === adminAccountId) return false;
      foreignAssetVersionKeys.add(versionKey);
      return ownerAccountId === adminAccountId;
    });
    if (ownerAccountId === adminAccountId && hasForeignRef) impactedAdminCuratedPublicIds.push(publicId);
  });

  return {
    v: 1,
    generatedAt: new Date().toISOString(),
    adminAccountId,
    targetAccounts: targetAccounts.map((entry) => ({
      accountId: String(entry.accountId || '').trim(),
      name: String(entry.name || '').trim() || 'Account',
      slug: String(entry.slug || '').trim() || 'account',
      role: String(entry.role || '').trim() || 'viewer',
      tier: String(entry.tier || '').trim() || 'free',
    })),
    targetAccountIds,
    summary: {
      accountCount: targetAccountIds.length,
      userInstanceCount: userInstances.filter((row) => String(row.account_id || '').trim() !== adminAccountId).length,
      curatedInstanceCount: curatedInstances.filter((row) => String(row.owner_account_id || '').trim() !== adminAccountId).length,
      referencedAssetVersionCount: foreignAssetVersionKeys.size,
      assetCountsByAccount,
    },
    work: {
      userRowsToMove,
      curatedRowsToMove,
      impactedAdminUserPublicIds,
      impactedAdminCuratedPublicIds,
      foreignAssetVersionKeys: Array.from(foreignAssetVersionKeys),
    },
  };
}

async function createAdminLocaleManager(client, adminAccountId) {
  const row = await loadSingleSupabaseRow(
    client,
    'accounts',
    'id,l10n_locales,l10n_policy',
    'id',
    adminAccountId,
  );
  const policy = row?.l10n_policy && typeof row.l10n_policy === 'object' && !Array.isArray(row.l10n_policy)
    ? { ...row.l10n_policy }
    : { v: 1, baseLocale: 'en', ip: { enabled: false, countryToLocale: {} }, switcher: { enabled: true } };
  const localeSet = new Set(
    Array.isArray(row?.l10n_locales)
      ? row.l10n_locales
          .map((locale) => (typeof locale === 'string' ? locale.trim() : ''))
          .filter(Boolean)
      : [],
  );
  const baseLocale =
    typeof policy.baseLocale === 'string' && policy.baseLocale.trim() ? policy.baseLocale.trim() : 'en';
  localeSet.add(baseLocale);

  return {
    async ensureLocales(locales) {
      const wanted = Array.isArray(locales)
        ? locales.map((locale) => (typeof locale === 'string' ? locale.trim() : '')).filter(Boolean)
        : [];
      let changed = false;
      wanted.forEach((locale) => {
        if (localeSet.has(locale)) return;
        localeSet.add(locale);
        changed = true;
      });
      if (!changed) return;

      policy.v = 1;
      policy.baseLocale = baseLocale;
      policy.availableLocales = Array.from(localeSet);
      policy.ip =
        policy.ip && typeof policy.ip === 'object' && !Array.isArray(policy.ip)
          ? policy.ip
          : { enabled: false, countryToLocale: {} };
      policy.switcher =
        policy.switcher && typeof policy.switcher === 'object' && !Array.isArray(policy.switcher)
          ? policy.switcher
          : { enabled: true };

      await patchSupabaseRow(
        client,
        'accounts',
        { id: `eq.${adminAccountId}` },
        { l10n_locales: Array.from(localeSet), l10n_policy: policy },
      );
    },
  };
}

async function migrateRows(env, client, accessToken, checkpoint) {
  const adminAccountId = checkpoint.adminAccountId;
  const work = checkpoint.inventory?.work || {};
  const impactedAdminUserPublicIds = Array.isArray(work.impactedAdminUserPublicIds) ? work.impactedAdminUserPublicIds : [];
  const impactedAdminCuratedPublicIds = Array.isArray(work.impactedAdminCuratedPublicIds) ? work.impactedAdminCuratedPublicIds : [];
  const userRowsToMove = Array.isArray(work.userRowsToMove) ? work.userRowsToMove : [];
  const curatedRowsToMove = Array.isArray(work.curatedRowsToMove) ? work.curatedRowsToMove : [];

  const [userInstances, curatedInstances, adminUserInstances, adminCuratedInstances] = await Promise.all([
    userRowsToMove.length
      ? loadRowsByPublicIds(
          client,
          USER_INSTANCE_TABLE,
          'public_id,account_id,status,display_name,config,updated_at',
          userRowsToMove,
        )
      : Promise.resolve([]),
    curatedRowsToMove.length
      ? loadRowsByPublicIds(
          client,
          CURATED_INSTANCE_TABLE,
          'public_id,owner_account_id,status,config,meta,widget_type,updated_at',
          curatedRowsToMove,
        )
      : Promise.resolve([]),
    impactedAdminUserPublicIds.length
      ? loadRowsByPublicIds(
          client,
          USER_INSTANCE_TABLE,
          'public_id,account_id,status,display_name,config,updated_at',
          impactedAdminUserPublicIds,
        )
      : Promise.resolve([]),
    impactedAdminCuratedPublicIds.length
      ? loadRowsByPublicIds(
          client,
          CURATED_INSTANCE_TABLE,
          'public_id,owner_account_id,status,config,meta,widget_type,updated_at',
          impactedAdminCuratedPublicIds,
        )
      : Promise.resolve([]),
  ]);

  const assetMap = new Map(Object.entries(checkpoint.migration?.assetMap || {}));
  const migratedUserPublicIds = [];
  const migratedCuratedPublicIds = [];
  const adminLocaleManager = await createAdminLocaleManager(client, adminAccountId);

  const ensureMigratedVersionKey = async (versionKey) => {
    const parsed = parseVersionKeyParts(versionKey);
    if (!parsed) return versionKey;
    if (parsed.accountId === adminAccountId) return versionKey;
    const existing = assetMap.get(versionKey);
    if (existing) return existing;
    const nextVersionKey = await uploadAssetVersionToAdmin(env, accessToken, adminAccountId, versionKey);
    assetMap.set(versionKey, nextVersionKey);
    return nextVersionKey;
  };

  const ensureAssetMapForValues = async (values) => {
    const keys = collectAssetVersionKeys(...values);
    for (const versionKey of keys) {
      await ensureMigratedVersionKey(versionKey);
    }
  };

  const extractWantedLocales = (envelope, layers) => {
    const out = new Set(
      Array.isArray(envelope?.localization?.accountLocales)
        ? envelope.localization.accountLocales
            .map((locale) => (typeof locale === 'string' ? locale.trim() : ''))
            .filter(Boolean)
        : [],
    );
    layers.forEach((layer) => {
      const layerName = typeof layer?.layer === 'string' ? layer.layer.trim() : '';
      const layerKey = typeof layer?.layerKey === 'string' ? layer.layerKey.trim() : '';
      if (!layerKey || layerKey === 'global') return;
      if (layerName === 'locale' || layerName === 'user') out.add(layerKey);
    });
    return Array.from(out);
  };

  for (const row of userInstances) {
    const currentAccountId = assertString(row.account_id, `${row.public_id} account_id`);
    const publicId = assertString(row.public_id, 'user public_id');
    const envelope = await fetchAccountInstanceEnvelope(env, accessToken, currentAccountId, publicId);
    const layers = await listLayerRows(env, accessToken, currentAccountId, publicId);

    await ensureAssetMapForValues([row.config, ...layers]);
    const rewrittenConfig = rewriteAssetRefs(row.config, assetMap);
    const rewrittenLayers = layers.map((layer) => rewriteAssetRefs(layer, assetMap));
    await adminLocaleManager.ensureLocales(extractWantedLocales(envelope, rewrittenLayers));

    if (currentAccountId !== adminAccountId) {
      await patchSupabaseRow(
        client,
        USER_INSTANCE_TABLE,
        { public_id: `eq.${publicId}`, account_id: `eq.${currentAccountId}` },
        { account_id: adminAccountId },
      );
    }

    await updateInstanceViaParis(env, accessToken, adminAccountId, publicId, {
      config: rewrittenConfig,
      status: row.status,
      displayName: row.display_name ?? 'Untitled widget',
      localePolicy: normalizeLocalePolicyForUpdate(
        envelope.localization?.policy,
        envelope.localization?.accountLocales,
      ),
      seoGeo: isSeoGeoEnabled(rewrittenConfig),
    });

    for (const layer of rewrittenLayers) {
      await upsertLayerRow(env, accessToken, adminAccountId, publicId, layer);
    }

    migratedUserPublicIds.push(publicId);
  }

  for (const row of adminUserInstances) {
    const publicId = assertString(row.public_id, 'admin user public_id');
    const envelope = await fetchAccountInstanceEnvelope(env, accessToken, adminAccountId, publicId);
    const layers = await listLayerRows(env, accessToken, adminAccountId, publicId);

    await ensureAssetMapForValues([row.config, ...layers]);
    const rewrittenConfig = rewriteAssetRefs(row.config, assetMap);
    const rewrittenLayers = layers.map((layer) => rewriteAssetRefs(layer, assetMap));
    await adminLocaleManager.ensureLocales(extractWantedLocales(envelope, rewrittenLayers));

    await updateInstanceViaParis(env, accessToken, adminAccountId, publicId, {
      config: rewrittenConfig,
      status: row.status,
      displayName: row.display_name ?? 'Untitled widget',
      localePolicy: normalizeLocalePolicyForUpdate(
        envelope.localization?.policy,
        envelope.localization?.accountLocales,
      ),
      seoGeo: isSeoGeoEnabled(rewrittenConfig),
    });

    for (const layer of rewrittenLayers) {
      await upsertLayerRow(env, accessToken, adminAccountId, publicId, layer);
    }

    migratedUserPublicIds.push(publicId);
  }

  for (const row of curatedInstances) {
    const currentOwnerAccountId = assertString(row.owner_account_id, `${row.public_id} owner_account_id`);
    const publicId = assertString(row.public_id, 'curated public_id');
    const envelope = await fetchAccountInstanceEnvelope(env, accessToken, currentOwnerAccountId, publicId);
    const layers = await listLayerRows(env, accessToken, currentOwnerAccountId, publicId);

    await ensureAssetMapForValues([row.config, ...layers]);
    const rewrittenConfig = rewriteAssetRefs(row.config, assetMap);
    const rewrittenLayers = layers.map((layer) => rewriteAssetRefs(layer, assetMap));
    await adminLocaleManager.ensureLocales(extractWantedLocales(envelope, rewrittenLayers));

    if (currentOwnerAccountId !== adminAccountId) {
      await patchSupabaseRow(
        client,
        CURATED_INSTANCE_TABLE,
        { public_id: `eq.${publicId}` },
        { owner_account_id: adminAccountId },
      );
    }

    await updateInstanceViaParis(env, accessToken, adminAccountId, publicId, {
      config: rewrittenConfig,
      status: row.status,
      meta: row.meta ?? null,
      localePolicy: normalizeLocalePolicyForUpdate(
        envelope.localization?.policy,
        envelope.localization?.accountLocales,
      ),
      seoGeo: isSeoGeoEnabled(rewrittenConfig),
    });

    for (const layer of rewrittenLayers) {
      await upsertLayerRow(env, accessToken, adminAccountId, publicId, layer);
    }

    migratedCuratedPublicIds.push(publicId);
  }

  for (const row of adminCuratedInstances) {
    const publicId = assertString(row.public_id, 'admin curated public_id');
    const envelope = await fetchAccountInstanceEnvelope(env, accessToken, adminAccountId, publicId);
    const layers = await listLayerRows(env, accessToken, adminAccountId, publicId);

    await ensureAssetMapForValues([row.config, ...layers]);
    const rewrittenConfig = rewriteAssetRefs(row.config, assetMap);
    const rewrittenLayers = layers.map((layer) => rewriteAssetRefs(layer, assetMap));
    await adminLocaleManager.ensureLocales(extractWantedLocales(envelope, rewrittenLayers));

    await updateInstanceViaParis(env, accessToken, adminAccountId, publicId, {
      config: rewrittenConfig,
      status: row.status,
      meta: row.meta ?? null,
      localePolicy: normalizeLocalePolicyForUpdate(
        envelope.localization?.policy,
        envelope.localization?.accountLocales,
      ),
      seoGeo: isSeoGeoEnabled(rewrittenConfig),
    });

    for (const layer of rewrittenLayers) {
      await upsertLayerRow(env, accessToken, adminAccountId, publicId, layer);
    }

    migratedCuratedPublicIds.push(publicId);
  }

  return {
    completedAt: new Date().toISOString(),
    migratedUserPublicIds,
    migratedCuratedPublicIds,
    assetMap: Object.fromEntries(assetMap.entries()),
  };
}

async function verifyRecovery(env, client, accessToken, checkpoint) {
  const adminAccountId = checkpoint.adminAccountId;
  const targetAccountIds = checkpoint.targetAccountIds;
  const migratedPublicIds = [
    ...(checkpoint.migration?.migratedUserPublicIds || []),
    ...(checkpoint.migration?.migratedCuratedPublicIds || []),
  ];

  const [remainingUserInstances, remainingCuratedInstances] = await Promise.all([
    loadRowsByAccountIds(
      client,
      USER_INSTANCE_TABLE,
      'account_id',
      'public_id,account_id,status,config',
      targetAccountIds,
    ),
    loadRowsByAccountIds(
      client,
      CURATED_INSTANCE_TABLE,
      'owner_account_id',
      'public_id,owner_account_id,status,config',
      targetAccountIds,
    ),
  ]);

  const staleRefs = [];
  const seen = new Set();
  for (const publicId of migratedPublicIds) {
    if (seen.has(publicId)) continue;
    seen.add(publicId);
    const envelope = await fetchAccountInstanceEnvelope(env, accessToken, adminAccountId, publicId);
    const layers = await listLayerRows(env, accessToken, adminAccountId, publicId);
    const refs = collectAssetVersionKeys(envelope.config, ...layers);
    refs.forEach((versionKey) => {
      const parsed = parseVersionKeyParts(versionKey);
      if (parsed && parsed.accountId !== adminAccountId) {
        staleRefs.push({ publicId, versionKey, accountId: parsed.accountId });
      }
    });
  }

  return {
    completedAt: new Date().toISOString(),
    ok: remainingUserInstances.length === 0 && remainingCuratedInstances.length === 0 && staleRefs.length === 0,
    remainingUserInstanceCount: remainingUserInstances.length,
    remainingCuratedInstanceCount: remainingCuratedInstances.length,
    staleRefs,
  };
}

async function deleteRecoveredAccounts(env, client, accessToken, checkpoint) {
  if (!checkpoint.verify?.ok) {
    throw new Error('Delete stage is blocked until verify reports ok=true.');
  }

  const adminAccountId = checkpoint.adminAccountId;
  const targetAccountIds = checkpoint.targetAccountIds.filter((accountId) => accountId !== adminAccountId);

  await deleteSupabaseByAccountIds(client, ACCOUNT_NOTICE_TABLE, 'account_id', targetAccountIds, {
    ignoreMissingTable: true,
  });
  await deleteSupabaseByAccountIds(client, ACCOUNT_BUSINESS_PROFILE_TABLE, 'account_id', targetAccountIds, {
    ignoreMissingTable: true,
  });
  await deleteSupabaseByAccountIds(client, 'account_members', 'account_id', targetAccountIds);
  await deleteSupabaseByAccountIds(client, 'accounts', 'id', targetAccountIds);

  const bootstrap = await loadBootstrap(env, accessToken);
  const accounts = Array.isArray(bootstrap?.accounts) ? bootstrap.accounts : [];
  const remainingAccounts = accounts.map((entry) => ({
    accountId: String(entry.accountId || '').trim(),
    name: String(entry.name || '').trim() || 'Account',
  }));

  return {
    completedAt: new Date().toISOString(),
    remainingAccounts,
    ok: remainingAccounts.length === 1 && remainingAccounts[0]?.accountId === adminAccountId,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  if (!['inventory', 'migrate', 'verify', 'delete'].includes(args.stage)) {
    throw new Error('--stage must be one of: inventory, migrate, verify, delete');
  }
  if ((args.stage === 'migrate' || args.stage === 'delete') && !args.apply) {
    throw new Error(`--apply is required for stage=${args.stage}`);
  }

  const localEnv = loadDotenv(path.join(process.cwd(), '.env.local'));
  const env = {
    ...localEnv,
    ...process.env,
  };

  const adminAccountId = (env.CK_ADMIN_ACCOUNT_ID || DEFAULT_ADMIN_ACCOUNT_ID).trim();
  if (!isUuid(adminAccountId)) {
    throw new Error(`Invalid CK_ADMIN_ACCOUNT_ID: ${adminAccountId}`);
  }

  const checkpoint = loadCheckpoint(args.checkpoint) || {
    v: 1,
    adminAccountId,
    targetAccountIds: [],
  };

  const client = buildSupabaseClient(env);
  const accessToken = await loginPassword(env);

  if (args.stage === 'inventory') {
    const inventory = await buildInventory(env, client, accessToken, adminAccountId);
    const next = {
      ...checkpoint,
      adminAccountId,
      targetAccountIds: inventory.targetAccountIds,
      inventory,
    };
    writeCheckpoint(args.checkpoint, next);
    console.log(JSON.stringify(inventory.summary, null, 2));
    console.log(`checkpoint=${args.checkpoint}`);
    return;
  }

  if (!checkpoint.inventory || !Array.isArray(checkpoint.targetAccountIds) || checkpoint.targetAccountIds.length === 0) {
    throw new Error('Run --stage inventory first.');
  }

  if (args.stage === 'migrate') {
    const migration = await migrateRows(env, client, accessToken, checkpoint);
    const next = { ...checkpoint, migration };
    writeCheckpoint(args.checkpoint, next);
    console.log(
      JSON.stringify(
        {
          migratedUserInstanceCount: migration.migratedUserPublicIds.length,
          migratedCuratedInstanceCount: migration.migratedCuratedPublicIds.length,
          migratedAssetRefCount: Object.keys(migration.assetMap || {}).length,
        },
        null,
        2,
      ),
    );
    console.log(`checkpoint=${args.checkpoint}`);
    return;
  }

  if (args.stage === 'verify') {
    const verify = await verifyRecovery(env, client, accessToken, checkpoint);
    const next = { ...checkpoint, verify };
    writeCheckpoint(args.checkpoint, next);
    console.log(JSON.stringify(verify, null, 2));
    console.log(`checkpoint=${args.checkpoint}`);
    if (!verify.ok) process.exitCode = 1;
    return;
  }

  const deletion = await deleteRecoveredAccounts(env, client, accessToken, checkpoint);
  const next = { ...checkpoint, deletion };
  writeCheckpoint(args.checkpoint, next);
  console.log(JSON.stringify(deletion, null, 2));
  console.log(`checkpoint=${args.checkpoint}`);
  if (!deletion.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[prd60-recovery] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

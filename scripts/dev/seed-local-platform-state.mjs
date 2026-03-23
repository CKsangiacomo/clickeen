#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSupabaseClient,
  createSupabaseHeaders,
} from './local-supabase.mjs';
import { resolveFirstRootEnvValue } from './local-root-env.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '../..');
const DEFAULT_PLATFORM_ACCOUNT_ID =
  process.env.CK_PLATFORM_ACCOUNT_ID || '00000000-0000-0000-0000-000000000100';
const DEFAULT_LOCAL_BASE = process.env.TOKYO_LOCAL_BASE_URL || 'http://localhost:4000';
const DEFAULT_LOCAL_WORKER_BASE =
  process.env.TOKYO_WORKER_BASE_URL || process.env.TOKYO_LOCAL_WORKER_BASE_URL || 'http://localhost:8791';
const DEFAULT_INTERNAL_SERVICE_ID = 'devstudio.local';
const DEFAULT_PAGE_SIZE = 500;

function printUsage() {
  console.log(`Usage: node scripts/dev/seed-local-platform-state.mjs [options]

Runs the explicit local platform-state seed steps:
1. seed canonical platform asset manifests + blobs into local Tokyo R2
2. materialize local Tokyo saved snapshots for current platform-owned instances

Pass-through options:
  --persist-to <dir>
  --local-base <url>
  --local-worker-base <url>
  --remote-base <url>
  --bucket <name>
  --platform-account <id>
  --max <n>
  --help
`);
}

function runNode(script, extraArgs = [], extraEnv = {}) {
  const result = spawnSync('node', [script, ...extraArgs], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
  if (result.status === 0) return;
  process.exit(result.status ?? 1);
}

function asTrimmedString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLocale(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const candidate = raw.replace(/_/g, '-');
  try {
    const locale = new Intl.Locale(candidate);
    const language = locale.language ? locale.language.toLowerCase() : '';
    const script = locale.script
      ? `${locale.script.charAt(0).toUpperCase()}${locale.script.slice(1).toLowerCase()}`
      : '';
    const region = locale.region ? locale.region.toUpperCase() : '';
    const parts = [language, script, region].filter(Boolean);
    return parts.length > 0 ? parts.join('-') : null;
  } catch {
    return candidate.toLowerCase();
  }
}

function parseBaseLocale(policyRaw) {
  if (!isRecord(policyRaw)) return 'en';
  return normalizeLocale(policyRaw.baseLocale) || 'en';
}

function normalizeDesiredLocales(localesRaw, baseLocale) {
  const locales = Array.isArray(localesRaw) ? localesRaw : [];
  return Array.from(
    new Set([baseLocale, ...locales].map((entry) => normalizeLocale(entry)).filter(Boolean)),
  );
}

function arraysEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parseArgs(argv) {
  const args = {
    rawArgs: [...argv],
    localBase: DEFAULT_LOCAL_BASE,
    localWorkerBase: DEFAULT_LOCAL_WORKER_BASE,
    platformAccountId: String(DEFAULT_PLATFORM_ACCOUNT_ID).trim().toLowerCase(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim();
    if (!token) continue;
    if (token === '--help' || token === '-h') {
      printUsage();
      process.exit(0);
    }
    if (token === '--local-base') {
      args.localBase = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (token === '--local-worker-base') {
      args.localWorkerBase = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (token === '--platform-account') {
      args.platformAccountId = String(argv[index + 1] || '')
        .trim()
        .toLowerCase();
      index += 1;
      continue;
    }
    if (
      token === '--persist-to' ||
      token === '--remote-base' ||
      token === '--bucket' ||
      token === '--max'
    ) {
      index += 1;
    }
  }

  args.localBase = args.localBase.replace(/\/+$/, '');
  args.localWorkerBase = args.localWorkerBase.replace(/\/+$/, '');
  return args;
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text().catch(() => '');
  return {
    ok: response.ok,
    status: response.status,
    text,
    json: text ? JSON.parse(text) : null,
  };
}

async function loadJsonFromSupabase(baseUrl, headers, pathname) {
  const response = await fetchJson(`${baseUrl}${pathname}`, {
    method: 'GET',
    headers,
  });
  if (!response.ok || !Array.isArray(response.json)) {
    throw new Error(`invalid supabase response for ${pathname} (${response.status})`);
  }
  return response.json;
}

function buildAccountStateById(rows) {
  const out = new Map();
  for (const row of rows) {
    const accountId = asTrimmedString(row?.id)?.toLowerCase();
    if (!accountId) continue;
    const baseLocale = parseBaseLocale(row?.l10n_policy);
    out.set(accountId, {
      baseLocale,
      desiredLocales: normalizeDesiredLocales(row?.l10n_locales, baseLocale),
    });
  }
  return out;
}

async function loadPlatformRows(client, platformAccountId) {
  const headers = createSupabaseHeaders(client);
  const baseUrl = client.base.replace(/\/+$/, '');
  const [accounts, widgets, accountRows, curatedRows] = await Promise.all([
    loadJsonFromSupabase(baseUrl, headers, '/rest/v1/accounts?select=id,l10n_locales,l10n_policy&limit=500'),
    loadJsonFromSupabase(baseUrl, headers, `/rest/v1/widgets?select=id,type&limit=${DEFAULT_PAGE_SIZE}`),
    loadJsonFromSupabase(
      baseUrl,
      headers,
      `/rest/v1/widget_instances?select=public_id,display_name,widget_id,account_id,config&account_id=eq.${encodeURIComponent(
        platformAccountId,
      )}&order=created_at.asc&limit=${DEFAULT_PAGE_SIZE}`,
    ),
    loadJsonFromSupabase(
      baseUrl,
      headers,
      `/rest/v1/curated_widget_instances?select=public_id,widget_type,owner_account_id,config,meta&order=created_at.asc&limit=${DEFAULT_PAGE_SIZE}`,
    ),
  ]);

  const accountStateById = buildAccountStateById(accounts);
  const widgetTypeById = new Map();
  for (const row of widgets) {
    const widgetId = asTrimmedString(row?.id);
    const widgetType = asTrimmedString(row?.type);
    if (!widgetId || !widgetType) continue;
    widgetTypeById.set(widgetId, widgetType);
  }

  const rows = [];
  for (const row of accountRows) {
    const publicId = asTrimmedString(row?.public_id);
    const accountId = asTrimmedString(row?.account_id)?.toLowerCase();
    const widgetType = widgetTypeById.get(asTrimmedString(row?.widget_id) || '') || null;
    const accountState = accountId ? accountStateById.get(accountId) : null;
    if (!publicId || !accountId || !widgetType || !accountState || !isRecord(row?.config)) {
      continue;
    }
    rows.push({
      publicId,
      accountId,
      widgetType,
      config: row.config,
      displayName: asTrimmedString(row?.display_name) || publicId,
      source: 'account',
      meta: null,
      baseLocale: accountState.baseLocale,
      desiredLocales: accountState.desiredLocales,
    });
  }

  for (const row of curatedRows) {
    const publicId = asTrimmedString(row?.public_id);
    const accountId = asTrimmedString(row?.owner_account_id)?.toLowerCase();
    const widgetType = asTrimmedString(row?.widget_type);
    const accountState = accountId ? accountStateById.get(accountId) : null;
    const meta =
      row?.meta === null || row?.meta === undefined ? null : isRecord(row?.meta) ? row.meta : null;
    if (!publicId || !accountId || !widgetType || !accountState || !isRecord(row?.config)) {
      continue;
    }
    rows.push({
      publicId,
      accountId,
      widgetType,
      config: row.config,
      displayName: null,
      source: 'curated',
      meta,
      baseLocale: accountState.baseLocale,
      desiredLocales: accountState.desiredLocales,
    });
  }

  return rows;
}

function createTokyoHeaders(accountId) {
  const token = resolveFirstRootEnvValue(['TOKYO_DEV_JWT', 'CK_INTERNAL_SERVICE_JWT']);
  if (!token) {
    throw new Error('Missing TOKYO_DEV_JWT or CK_INTERNAL_SERVICE_JWT');
  }
  return {
    authorization: `Bearer ${token}`,
    'x-account-id': accountId,
    'x-ck-internal-service': DEFAULT_INTERNAL_SERVICE_ID,
    accept: 'application/json',
    'content-type': 'application/json',
  };
}

async function writeLocalSavedSnapshot(args) {
  const response = await fetchJson(
    `${args.localWorkerBase}/__internal/renders/instances/${encodeURIComponent(args.row.publicId)}/saved.json`,
    {
      method: 'PUT',
      headers: createTokyoHeaders(args.row.accountId),
      body: JSON.stringify({
        widgetType: args.row.widgetType,
        config: args.row.config,
        displayName: args.row.displayName,
        source: args.row.source,
        meta: args.row.meta,
        l10n: {
          summary: {
            baseLocale: args.row.baseLocale,
            desiredLocales: args.row.desiredLocales,
          },
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`saved write failed for ${args.row.publicId} (${response.status}) ${response.text}`);
  }
  return response.json;
}

async function readLocalSavedSnapshot(args) {
  const response = await fetchJson(
    `${args.localWorkerBase}/__internal/renders/instances/${encodeURIComponent(args.row.publicId)}/saved.json`,
    {
      method: 'GET',
      headers: createTokyoHeaders(args.row.accountId),
    },
  );
  if (!response.ok) {
    throw new Error(`saved read failed for ${args.row.publicId} (${response.status}) ${response.text}`);
  }
  return response.json;
}

async function verifyBaseSnapshot(localBase, publicId, baseFingerprint) {
  const response = await fetch(`${localBase}/l10n/instances/${encodeURIComponent(publicId)}/bases/${encodeURIComponent(baseFingerprint)}.snapshot.json`, {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`base snapshot missing for ${publicId} (${baseFingerprint}) (${response.status})`);
  }
}

async function materializeLocalSavedState(args) {
  const client = createSupabaseClient({ preferLocal: true });
  const rows = await loadPlatformRows(client, args.platformAccountId);

  for (const row of rows) {
    await writeLocalSavedSnapshot({
      localWorkerBase: args.localWorkerBase,
      row,
    });
    const saved = await readLocalSavedSnapshot({
      localWorkerBase: args.localWorkerBase,
      row,
    });
    const savedBaseFingerprint = asTrimmedString(saved?.l10n?.baseFingerprint);
    const savedBaseLocale = normalizeLocale(saved?.l10n?.summary?.baseLocale);
    const savedDesiredLocales = normalizeDesiredLocales(
      saved?.l10n?.summary?.desiredLocales,
      row.baseLocale,
    );
    const savedDisplayName = asTrimmedString(saved?.displayName);
    if (!savedBaseFingerprint) {
      throw new Error(`saved snapshot missing baseFingerprint for ${row.publicId}`);
    }
    if (savedBaseLocale !== row.baseLocale) {
      throw new Error(
        `saved baseLocale mismatch for ${row.publicId} (${savedBaseLocale || '<missing>'} != ${row.baseLocale})`,
      );
    }
    if (!arraysEqual(savedDesiredLocales, row.desiredLocales)) {
      throw new Error(
        `saved desiredLocales mismatch for ${row.publicId} (${savedDesiredLocales.join(',')} != ${row.desiredLocales.join(',')})`,
      );
    }
    if (row.source === 'curated' && savedDisplayName) {
      throw new Error(`curated saved snapshot carries displayName truth for ${row.publicId}`);
    }
    await verifyBaseSnapshot(args.localBase, row.publicId, savedBaseFingerprint);
  }

  console.log(`[seed-local-platform-state] materialized ${rows.length} local saved snapshot(s)`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  runNode(path.join(repoRoot, 'scripts/dev/seed-local-platform-assets.mjs'), args.rawArgs);
  await materializeLocalSavedState(args);
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error('[seed-local-platform-state] failed:', detail);
  process.exit(1);
});

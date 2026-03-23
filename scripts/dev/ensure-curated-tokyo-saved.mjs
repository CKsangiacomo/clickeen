#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createSupabaseClient,
  createSupabaseHeaders as createSupabaseHeadersFromClient,
} from './local-supabase.mjs';
import { requestLoopback, requestLoopbackJson } from './local-loopback-http.mjs';
import { resolveFirstRootEnvValue, resolveRootEnvValue } from './local-root-env.mjs';

const SCRIPT_LABEL = 'ensure-curated-tokyo-saved';
const REMOTE_TOKYO_BASE_URL = 'https://tokyo.dev.clickeen.com';
const REMOTE_SANFRANCISCO_BASE_URL = 'https://sanfrancisco.dev.clickeen.com';
const LOCAL_TOKYO_WORKER_BASE_URL = 'http://localhost:8791';
const LOCAL_TOKYO_PUBLIC_BASE_URL = 'http://localhost:4000';
const TOKYO_INTERNAL_SERVICE_ID = 'devstudio.local';
const TOKYO_R2_BUCKET = 'tokyo-assets-dev';
const DEFAULT_POLICY_PROFILE = 'tier3';
const TOKYO_WORKER_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../../tokyo-worker',
);
const PLATFORM_ACCOUNT_ID = String(
  process.env.CK_PLATFORM_ACCOUNT_ID || '00000000-0000-0000-0000-000000000100',
)
  .trim()
  .toLowerCase();

const SUPABASE_CLIENT = (() => {
  const base =
    resolveRootEnvValue('SUPABASE_URL') ||
    resolveRootEnvValue('API_URL') ||
    '';
  const serviceRole =
    resolveRootEnvValue('SUPABASE_SERVICE_ROLE_KEY') ||
    resolveRootEnvValue('SERVICE_ROLE_KEY') ||
    '';
  if (base && serviceRole) {
    return {
      base: base.replace(/\/+$/, ''),
      serviceRole,
    };
  }
  return createSupabaseClient({ preferLocal: false });
})();
const SUPABASE_URL = SUPABASE_CLIENT.base.replace(/\/+$/, '');
const SUPABASE_HEADERS = createSupabaseHeadersFromClient(SUPABASE_CLIENT);
const TOKYO_DEV_JWT = resolveFirstRootEnvValue(['TOKYO_DEV_JWT', 'CK_INTERNAL_SERVICE_JWT']);
const INTERNAL_SERVICE_JWT = resolveFirstRootEnvValue(['CK_INTERNAL_SERVICE_JWT', 'TOKYO_DEV_JWT']);

function fail(message) {
  console.error(`[${SCRIPT_LABEL}] ${message}`);
  process.exit(1);
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
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

function parseCountryToLocale(policyRaw) {
  if (!isRecord(policyRaw) || !isRecord(policyRaw.ip) || !isRecord(policyRaw.ip.countryToLocale)) {
    return {};
  }
  const out = {};
  for (const [countryRaw, localeRaw] of Object.entries(policyRaw.ip.countryToLocale)) {
    const country = String(countryRaw || '').trim().toUpperCase();
    const locale = normalizeLocale(localeRaw);
    if (!/^[A-Z]{2}$/.test(country) || !locale) continue;
    out[country] = locale;
  }
  return out;
}

function normalizeDesiredLocales(localesRaw, baseLocale) {
  const locales = Array.isArray(localesRaw) ? localesRaw : [];
  return Array.from(
    new Set(
      [baseLocale, ...locales]
        .map((entry) => normalizeLocale(entry))
        .filter(Boolean),
    ),
  );
}

function normalizeWidgetLocaleSwitcherSettings(raw) {
  const payload = isRecord(raw) ? raw : {};
  const alwaysShowLocale = normalizeLocale(payload.alwaysShowLocale);
  const attachTo = asTrimmedString(payload.attachTo)?.toLowerCase() || '';
  const position = asTrimmedString(payload.position)?.toLowerCase() || '';

  return {
    enabled: payload.enabled === true,
    byIp: payload.byIp === true,
    alwaysShowLocale: alwaysShowLocale || null,
    attachTo: attachTo === 'pod' ? 'pod' : 'stage',
    position:
      position === 'top-left' ||
      position === 'top-center' ||
      position === 'top-right' ||
      position === 'right-middle' ||
      position === 'bottom-right' ||
      position === 'bottom-center' ||
      position === 'bottom-left' ||
      position === 'left-middle'
        ? position
        : 'top-right',
  };
}

function formatCuratedDisplayName(meta, fallback) {
  if (!isRecord(meta)) return fallback;
  return asTrimmedString(meta.styleName ?? meta.name ?? meta.title) || fallback;
}

function stableStringify(value) {
  if (value === undefined) return 'null';
  if (typeof value === 'function' || typeof value === 'symbol') return 'null';
  if (Array.isArray(value)) {
    return `[${value
      .map((item) =>
        item === undefined || typeof item === 'function' || typeof item === 'symbol'
          ? 'null'
          : stableStringify(item),
      )
      .join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const parts = [];
    for (const key of Object.keys(value).sort()) {
      const next = value[key];
      if (next === undefined) continue;
      if (typeof next === 'function' || typeof next === 'symbol') continue;
      parts.push(`${JSON.stringify(key)}:${stableStringify(next)}`);
    }
    return `{${parts.join(',')}}`;
  }
  return JSON.stringify(value);
}

function prettyStableJson(value) {
  return JSON.stringify(JSON.parse(stableStringify(value)), null, 2);
}

async function sha256HexFromText(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function jsonSha256Hex(value) {
  return await sha256HexFromText(prettyStableJson(value));
}

function normalizeAllowlistEntries(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => ({
      path: typeof entry?.path === 'string' ? entry.path.trim() : '',
      type: entry?.type === 'richtext' ? 'richtext' : 'string',
    }))
    .filter((entry) => entry.path);
}

function joinPath(base, next) {
  return base ? `${base}.${next}` : next;
}

function collectEntriesForPath(args) {
  if (args.segments.length === 0) {
    if (typeof args.value === 'string') {
      args.out.push({ path: args.currentPath, value: args.value });
    }
    return;
  }

  const [head, ...tail] = args.segments;
  if (!head) return;

  if (head === '*') {
    if (!Array.isArray(args.value)) return;
    args.value.forEach((item, index) =>
      collectEntriesForPath({
        value: item,
        segments: tail,
        currentPath: joinPath(args.currentPath, String(index)),
        out: args.out,
      }),
    );
    return;
  }

  if (Array.isArray(args.value) && /^\d+$/.test(head)) {
    collectEntriesForPath({
      value: args.value[Number(head)],
      segments: tail,
      currentPath: joinPath(args.currentPath, head),
      out: args.out,
    });
    return;
  }

  if (!isRecord(args.value)) return;
  collectEntriesForPath({
    value: args.value[head],
    segments: tail,
    currentPath: joinPath(args.currentPath, head),
    out: args.out,
  });
}

function buildL10nSnapshot(config, allowlist) {
  const snapshot = {};
  for (const entry of normalizeAllowlistEntries(allowlist)) {
    const out = [];
    collectEntriesForPath({
      value: config,
      segments: entry.path.split('.').map((segment) => segment.trim()).filter(Boolean),
      currentPath: '',
      out,
    });
    for (const item of out) {
      if (item.path && !Object.prototype.hasOwnProperty.call(snapshot, item.path)) {
        snapshot[item.path] = item.value;
      }
    }
  }
  return snapshot;
}

async function loadWidgetLocalizationAllowlist(widgetType) {
  const filepath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    `../../tokyo/widgets/${widgetType}/localization.json`,
  );
  const raw = await readFile(filepath, 'utf8').catch(() => null);
  if (!raw) {
    fail(`missing localization allowlist for widget type ${widgetType}`);
  }
  const payload = JSON.parse(raw);
  if (!payload || !Array.isArray(payload.paths)) {
    fail(`invalid localization allowlist for widget type ${widgetType}`);
  }
  return payload.paths;
}

function savedPointerKey(publicId) {
  return `renders/instances/${publicId}/saved/r.json`;
}

function savedConfigPackKey(publicId, configFp) {
  return `renders/instances/${publicId}/saved/config/${configFp}.json`;
}

function l10nBaseSnapshotKey(publicId, baseFingerprint) {
  return `l10n/instances/${publicId}/bases/${baseFingerprint}.snapshot.json`;
}

function renderConfigPackKey(publicId, configFp) {
  return `renders/instances/${publicId}/config/${configFp}/config.json`;
}

function renderLivePointerKey(publicId) {
  return `renders/instances/${publicId}/live/r.json`;
}

function l10nLivePointerKey(publicId, locale) {
  return `l10n/instances/${publicId}/live/${locale}.json`;
}

function l10nTextPackKey(publicId, locale, textFp) {
  return `l10n/instances/${publicId}/packs/${locale}/${textFp}.json`;
}

async function withTempJsonFile(payload, fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'clickeen-75e-'));
  const filepath = path.join(dir, 'payload.json');
  try {
    await writeFile(filepath, prettyStableJson(payload), 'utf8');
    return await fn(filepath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function runWrangler(commandArgs) {
  const result = spawnSync(
    'pnpm',
    ['exec', 'wrangler', ...commandArgs],
    {
      cwd: TOKYO_WORKER_DIR,
      encoding: 'utf8',
    },
  );
  if (result.status !== 0) {
    fail(
      `wrangler ${commandArgs.join(' ')} failed (${result.status ?? 'unknown'})${
        result.stderr ? ` ${result.stderr.trim()}` : result.stdout ? ` ${result.stdout.trim()}` : ''
      }`,
    );
  }
  return result;
}

async function putRemoteR2Json(key, payload) {
  await withTempJsonFile(payload, async (filepath) => {
    runWrangler([
      'r2',
      'object',
      'put',
      `${TOKYO_R2_BUCKET}/${key}`,
      '--remote',
      '--file',
      filepath,
      '--content-type',
      'application/json; charset=utf-8',
    ]);
  });
}

async function getRemoteR2Json(key) {
  return await withTempJsonFile({}, async (filepath) => {
    runWrangler([
      'r2',
      'object',
      'get',
      `${TOKYO_R2_BUCKET}/${key}`,
      '--remote',
      '--file',
      filepath,
    ]);
    const raw = await readFile(filepath, 'utf8').catch(() => null);
    if (!raw) return null;
    return JSON.parse(raw);
  });
}

async function buildSavedArtifacts(item) {
  const allowlist = await loadWidgetLocalizationAllowlist(item.widgetType);
  const snapshot = buildL10nSnapshot(item.config, allowlist);
  const baseFingerprint = await sha256HexFromText(stableStringify(snapshot));
  const configFp = await jsonSha256Hex(item.config);
  return {
    configFp,
    baseFingerprint,
    configPack: item.config,
    savedPointer: {
      v: 1,
      publicId: item.publicId,
      accountId: item.accountId,
      widgetType: item.widgetType,
      displayName: item.source === 'curated' ? null : item.displayName ?? null,
      source: item.source,
      meta: item.meta ?? null,
      configFp,
      updatedAt: new Date().toISOString(),
      l10n: {
        baseFingerprint,
        summary: {
          baseLocale: item.baseLocale,
          desiredLocales: item.desiredLocales,
        },
      },
    },
    baseSnapshot: {
      v: 1,
      publicId: item.publicId,
      baseFingerprint,
      snapshot,
    },
  };
}

function buildLiveLocalePolicy(item) {
  const localeSwitcher = normalizeWidgetLocaleSwitcherSettings(item.config?.localeSwitcher);
  const readySet = new Set(item.desiredLocales);
  const countryToLocale = Object.fromEntries(
    Object.entries(item.countryToLocale || {}).filter(([, locale]) => readySet.has(locale)),
  );
  const alwaysShowLocale =
    localeSwitcher.byIp === true ||
    !localeSwitcher.alwaysShowLocale ||
    !readySet.has(localeSwitcher.alwaysShowLocale)
      ? undefined
      : localeSwitcher.alwaysShowLocale;

  return {
    baseLocale: item.baseLocale,
    readyLocales: item.desiredLocales,
    ip: {
      enabled: localeSwitcher.byIp === true,
      countryToLocale: localeSwitcher.byIp === true ? countryToLocale : {},
    },
    switcher: {
      enabled: localeSwitcher.enabled === true,
      ...(alwaysShowLocale ? { alwaysShowLocale } : {}),
    },
  };
}

async function generateLocaleOpsForItem(item, allowlist) {
  const targetLocales = item.desiredLocales.filter((locale) => locale !== item.baseLocale);
  if (!targetLocales.length) return new Map();
  if (!SANFRANCISCO_BASE_URL) {
    fail('SANFRANCISCO_BASE_URL is required for FAQ live normalization');
  }
  if (!INTERNAL_SERVICE_JWT) {
    fail('CK_INTERNAL_SERVICE_JWT is required for FAQ live normalization');
  }

  const response = await fetch(`${SANFRANCISCO_BASE_URL}/v1/l10n/account/ops/generate`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${INTERNAL_SERVICE_JWT}`,
      'content-type': 'application/json',
      accept: 'application/json',
      'cache-control': 'no-store',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      policyProfile: DEFAULT_POLICY_PROFILE,
      widgetType: item.widgetType,
      config: item.config,
      allowlist: allowlist.map((entry) => ({
        path: entry.path,
        type: entry.type === 'richtext' ? 'richtext' : 'string',
      })),
      baseLocale: item.baseLocale,
      targetLocales,
      existingBaseOpsByLocale: Object.fromEntries(targetLocales.map((locale) => [locale, []])),
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    fail(
      `San Francisco locale ops generation failed for ${item.publicId} (${response.status})${
        isRecord(payload?.error) && asTrimmedString(payload.error.detail)
          ? ` ${asTrimmedString(payload.error.detail)}`
          : ''
      }`,
    );
  }

  const out = new Map();
  const results = Array.isArray(payload?.results) ? payload.results : [];
  for (const entry of results) {
    const locale = normalizeLocale(entry?.locale);
    const errorDetail = asTrimmedString(entry?.error);
    if (locale && errorDetail) {
      fail(`San Francisco returned locale generation error for ${item.publicId}:${locale} (${errorDetail})`);
    }
    const ops = Array.isArray(entry?.ops) ? entry.ops : [];
    if (!locale) continue;
    out.set(
      locale,
      ops
        .map((op) =>
          isRecord(op) &&
          op.op === 'set' &&
          typeof op.path === 'string' &&
          typeof op.value === 'string'
            ? { op: 'set', path: op.path, value: op.value }
            : null,
        )
        .filter(Boolean),
    );
  }
  for (const locale of targetLocales) {
    if (!out.has(locale)) {
      fail(`San Francisco did not return locale ops for ${item.publicId}:${locale}`);
    }
  }
  return out;
}

function buildLocalizedTextPack(basePack, ops) {
  const next = { ...basePack };
  for (const op of Array.isArray(ops) ? ops : []) {
    if (!op || op.op !== 'set' || typeof op.path !== 'string' || typeof op.value !== 'string') continue;
    if (!(op.path in next)) continue;
    next[op.path] = op.value;
  }
  return next;
}

async function writeFaqLiveSurface(item) {
  const allowlist = await loadWidgetLocalizationAllowlist(item.widgetType);
  const snapshot = buildL10nSnapshot(item.config, allowlist);
  const baseFingerprint = await sha256HexFromText(stableStringify(snapshot));
  const configFp = await jsonSha256Hex(item.config);
  const generatedOpsByLocale = await generateLocaleOpsForItem(item, allowlist);
  const liveLocalePolicy = buildLiveLocalePolicy(item);
  const updatedAt = new Date().toISOString();

  await putRemoteR2Json(renderConfigPackKey(item.publicId, configFp), item.config);

  for (const locale of item.desiredLocales) {
    const textPack =
      locale === item.baseLocale
        ? { ...snapshot }
        : buildLocalizedTextPack(snapshot, generatedOpsByLocale.get(locale) || []);
    const textFp = await jsonSha256Hex(textPack);
    await putRemoteR2Json(l10nTextPackKey(item.publicId, locale, textFp), textPack);
    await putRemoteR2Json(l10nLivePointerKey(item.publicId, locale), {
      v: 1,
      publicId: item.publicId,
      locale,
      textFp,
      baseFingerprint,
      updatedAt,
    });
  }

  await putRemoteR2Json(renderLivePointerKey(item.publicId), {
    v: 1,
    publicId: item.publicId,
    widgetType: item.widgetType,
    configFp,
    localePolicy: liveLocalePolicy,
    l10n: {
      liveBase: `l10n/instances/${item.publicId}/live`,
      packsBase: `l10n/instances/${item.publicId}/packs`,
    },
  });
}

function isRemoteBaseUrl(value) {
  return !String(value || '').includes('127.0.0.1') && !String(value || '').includes('localhost');
}

const TOKYO_WORKER_BASE_URL = String(
  process.env.TOKYO_WORKER_BASE_URL ||
    resolveRootEnvValue('TOKYO_WORKER_BASE_URL') ||
    (isRemoteBaseUrl(SUPABASE_URL) ? REMOTE_TOKYO_BASE_URL : LOCAL_TOKYO_WORKER_BASE_URL),
)
  .trim()
  .replace(/\/+$/, '');

const TOKYO_PUBLIC_BASE_URL = String(
  (() => {
    const configured =
      resolveRootEnvValue('NEXT_PUBLIC_TOKYO_URL') ||
      resolveRootEnvValue('TOKYO_URL') ||
      resolveRootEnvValue('TOKYO_BASE_URL') ||
      '';
    if (configured && !(isRemoteBaseUrl(SUPABASE_URL) && !isRemoteBaseUrl(configured))) {
      return configured;
    }
    return '';
  })() ||
    (isRemoteBaseUrl(SUPABASE_URL) ? REMOTE_TOKYO_BASE_URL : LOCAL_TOKYO_PUBLIC_BASE_URL),
)
  .trim()
  .replace(/\/+$/, '');

const SANFRANCISCO_BASE_URL = String(
  (() => {
    const configured =
      resolveRootEnvValue('SANFRANCISCO_BASE_URL') ||
      '';
    if (configured && !(isRemoteBaseUrl(SUPABASE_URL) && !isRemoteBaseUrl(configured))) {
      return configured;
    }
    return '';
  })() || (isRemoteBaseUrl(SUPABASE_URL) ? REMOTE_SANFRANCISCO_BASE_URL : 'http://localhost:3002'),
)
  .trim()
  .replace(/\/+$/, '');

function createTokyoHeaders(accountId, contentType = null) {
  const headers = new Headers();
  headers.set('authorization', `Bearer ${TOKYO_DEV_JWT}`);
  headers.set('x-account-id', accountId);
  headers.set('x-ck-internal-service', TOKYO_INTERNAL_SERVICE_ID);
  headers.set('accept', 'application/json');
  if (contentType) headers.set('content-type', contentType);
  return headers;
}

async function loadJsonFromSupabase(pathname) {
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    method: 'GET',
    headers: SUPABASE_HEADERS,
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text().catch(() => '');
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    fail(`failed to load ${pathname} (${response.status})${text ? ` ${text}` : ''}`);
  }
  if (!Array.isArray(payload)) {
    fail(`invalid array payload for ${pathname}`);
  }
  return payload;
}

async function loadAccountRows() {
  return await loadJsonFromSupabase('/rest/v1/accounts?select=id,l10n_locales,l10n_policy&limit=500');
}

async function loadCuratedRows() {
  return await loadJsonFromSupabase(
    '/rest/v1/curated_widget_instances?select=public_id,widget_type,owner_account_id,config,meta,status&order=created_at.asc&limit=500',
  );
}

async function loadPlatformAccountRows() {
  const [widgetsPayload, accountRowsPayload] = await Promise.all([
    loadJsonFromSupabase('/rest/v1/widgets?select=id,type&limit=500'),
    loadJsonFromSupabase(
      `/rest/v1/widget_instances?select=public_id,display_name,status,widget_id,account_id,config&account_id=eq.${encodeURIComponent(
        PLATFORM_ACCOUNT_ID,
      )}&order=created_at.asc&limit=500`,
    ),
  ]);

  const widgetTypeById = new Map();
  for (const row of widgetsPayload) {
    const id = asTrimmedString(row?.id);
    const type = asTrimmedString(row?.type);
    if (!id || !type) continue;
    widgetTypeById.set(id, type);
  }

  return accountRowsPayload.map((row) => ({
    public_id: row?.public_id,
    display_name: row?.display_name,
    status: row?.status,
    account_id: row?.account_id,
    widget_type: widgetTypeById.get(asTrimmedString(row?.widget_id) || '') || null,
    config: row?.config,
    meta: null,
  }));
}

function buildAccountStateById(accountRows) {
  const out = new Map();
  for (const row of accountRows) {
    const accountId = asTrimmedString(row?.id)?.toLowerCase();
    if (!accountId) continue;
    const baseLocale = parseBaseLocale(row?.l10n_policy);
    out.set(accountId, {
      baseLocale,
      desiredLocales: normalizeDesiredLocales(row?.l10n_locales, baseLocale),
      countryToLocale: parseCountryToLocale(row?.l10n_policy),
    });
  }
  return out;
}

async function writeSavedSnapshot(item) {
  if (isRemoteBaseUrl(TOKYO_WORKER_BASE_URL)) {
    const artifacts = await buildSavedArtifacts(item);
    await putRemoteR2Json(savedConfigPackKey(item.publicId, artifacts.configFp), artifacts.configPack);
    await putRemoteR2Json(savedPointerKey(item.publicId), artifacts.savedPointer);
    await putRemoteR2Json(
      l10nBaseSnapshotKey(item.publicId, artifacts.baseFingerprint),
      artifacts.baseSnapshot,
    );
    return;
  }

  const response = requestLoopback(
    `${TOKYO_WORKER_BASE_URL}/__internal/renders/instances/${encodeURIComponent(item.publicId)}/saved.json`,
    {
      method: 'PUT',
      headers: createTokyoHeaders(item.accountId, 'application/json'),
      body: JSON.stringify({
        widgetType: item.widgetType,
        config: item.config,
        displayName: item.source === 'curated' ? null : item.displayName,
        source: item.source,
        meta: item.meta,
        l10n: {
          summary: {
            baseLocale: item.baseLocale,
            desiredLocales: item.desiredLocales,
          },
        },
      }),
    },
  );

  if (!response.ok) {
    fail(
      `failed to write Tokyo saved snapshot for ${item.publicId} (${response.status})${
        response.text ? ` ${response.text}` : ''
      }`,
    );
  }
}

async function readSavedSnapshot(item) {
  if (isRemoteBaseUrl(TOKYO_WORKER_BASE_URL)) {
    const saved = await getRemoteR2Json(savedPointerKey(item.publicId));
    if (!saved) {
      fail(`failed to read Tokyo saved snapshot for ${item.publicId} from remote R2`);
    }
    return saved;
  }

  const response = requestLoopbackJson(
    `${TOKYO_WORKER_BASE_URL}/__internal/renders/instances/${encodeURIComponent(item.publicId)}/saved.json`,
    {
      method: 'GET',
      headers: createTokyoHeaders(item.accountId),
    },
  );

  if (!response.ok) {
    fail(
      `failed to read Tokyo saved snapshot for ${item.publicId} (${response.status})${
        response.text ? ` ${response.text}` : ''
      }`,
    );
  }

  return response.json;
}

function expectSavedSummary(item, savedPayload) {
  const baseFingerprint = asTrimmedString(savedPayload?.l10n?.baseFingerprint);
  const baseLocale = normalizeLocale(savedPayload?.l10n?.summary?.baseLocale);
  const desiredLocales = normalizeDesiredLocales(savedPayload?.l10n?.summary?.desiredLocales, item.baseLocale);
  if (!baseFingerprint) {
    fail(`saved Tokyo pointer missing baseFingerprint for ${item.publicId}`);
  }
  if (baseLocale !== item.baseLocale) {
    fail(
      `saved Tokyo baseLocale mismatch for ${item.publicId} (expected ${item.baseLocale}, got ${baseLocale || '<missing>'})`,
    );
  }
  if (JSON.stringify(desiredLocales) !== JSON.stringify(item.desiredLocales)) {
    fail(
      `saved Tokyo desiredLocales mismatch for ${item.publicId} (expected ${item.desiredLocales.join(',')}, got ${desiredLocales.join(',') || '<missing>'})`,
    );
  }
  return { baseFingerprint, desiredLocales };
}

function expectCuratedDisplayName(item, savedPayload) {
  if (item.source !== 'curated') return;
  const savedDisplayName = asTrimmedString(savedPayload?.displayName);
  if (savedDisplayName) {
    fail(`curated Tokyo saved snapshot still carries displayName truth for ${item.publicId}`);
  }
}

async function verifyBaseSnapshot(item, baseFingerprint) {
  const response = requestLoopback(
    `${TOKYO_PUBLIC_BASE_URL}/l10n/instances/${encodeURIComponent(item.publicId)}/bases/${encodeURIComponent(
      baseFingerprint,
    )}.snapshot.json`,
    {
      method: 'GET',
      discardBody: true,
    },
  );
  if (!response.ok) {
    fail(
      `base snapshot missing for ${item.publicId} (${baseFingerprint}) via public Tokyo (${response.status})`,
    );
  }
}

async function verifyLivePointer(item) {
  const response = requestLoopback(
    `${TOKYO_PUBLIC_BASE_URL}/renders/instances/${encodeURIComponent(item.publicId)}/live/r.json`,
    {
      method: 'GET',
    },
  );

  if (item.status !== 'published') {
    return;
  }

  if (!response.ok) {
    fail(
      `published live pointer unavailable for ${item.publicId} (${response.status})${
        response.text ? ` ${response.text}` : ''
      }`,
    );
  }

  const payload = JSON.parse(response.text);
  const liveBaseLocale = normalizeLocale(payload?.localePolicy?.baseLocale);
  const readyLocales = normalizeDesiredLocales(payload?.localePolicy?.readyLocales, item.baseLocale);
  if (liveBaseLocale !== item.baseLocale) {
    fail(
      `live baseLocale mismatch for ${item.publicId} (expected ${item.baseLocale}, got ${liveBaseLocale || '<missing>'})`,
    );
  }

  if (item.widgetType === 'faq') {
    if (JSON.stringify(readyLocales) !== JSON.stringify(item.desiredLocales)) {
      fail(
        `FAQ live readyLocales drift for ${item.publicId} (expected ${item.desiredLocales.join(',')}, got ${readyLocales.join(',') || '<missing>'})`,
      );
    }
  }

  return { readyLocales };
}

async function verifyFaqLocaleArtifacts(item, readyLocales) {
  for (const locale of readyLocales) {
    const pointerResponse = requestLoopback(
      `${TOKYO_PUBLIC_BASE_URL}/l10n/instances/${encodeURIComponent(item.publicId)}/live/${encodeURIComponent(locale)}.json`,
      { method: 'GET' },
    );
    if (!pointerResponse.ok) {
      fail(
        `FAQ live locale pointer unavailable for ${item.publicId}:${locale} (${pointerResponse.status})${
          pointerResponse.text ? ` ${pointerResponse.text}` : ''
        }`,
      );
    }
    const pointerPayload = JSON.parse(pointerResponse.text);
    const textFp = asTrimmedString(pointerPayload?.textFp);
    if (!textFp) {
      fail(`FAQ live locale pointer missing textFp for ${item.publicId}:${locale}`);
    }

    const packResponse = requestLoopback(
      `${TOKYO_PUBLIC_BASE_URL}/l10n/instances/${encodeURIComponent(item.publicId)}/packs/${encodeURIComponent(locale)}/${encodeURIComponent(textFp)}.json`,
      { method: 'GET' },
    );
    if (!packResponse.ok) {
      fail(
        `FAQ live text pack unavailable for ${item.publicId}:${locale} (${packResponse.status})${
          packResponse.text ? ` ${packResponse.text}` : ''
        }`,
      );
    }
  }
}

function faqLiveSurfaceMatchesDesiredState(item) {
  const response = requestLoopback(
    `${TOKYO_PUBLIC_BASE_URL}/renders/instances/${encodeURIComponent(item.publicId)}/live/r.json`,
    { method: 'GET' },
  );
  if (!response.ok) return false;
  const payload = JSON.parse(response.text);
  const baseLocale = normalizeLocale(payload?.localePolicy?.baseLocale);
  const readyLocales = normalizeDesiredLocales(payload?.localePolicy?.readyLocales, item.baseLocale);
  return (
    baseLocale === item.baseLocale &&
    JSON.stringify(readyLocales) === JSON.stringify(item.desiredLocales)
  );
}

async function main() {
  if (!SUPABASE_URL) fail('SUPABASE_URL is required');
  if (!TOKYO_DEV_JWT) fail('TOKYO_DEV_JWT is required');
  if (!TOKYO_WORKER_BASE_URL) fail('TOKYO_WORKER_BASE_URL is required');
  if (!TOKYO_PUBLIC_BASE_URL) fail('TOKYO public base URL is required');

  const [accountRows, curatedRows, platformRows] = await Promise.all([
    loadAccountRows(),
    loadCuratedRows(),
    loadPlatformAccountRows(),
  ]);
  const accountStateById = buildAccountStateById(accountRows);

  const items = [
    ...curatedRows.map((row) => {
      const publicId = asTrimmedString(row?.public_id);
      const accountId = asTrimmedString(row?.owner_account_id)?.toLowerCase();
      const widgetType = asTrimmedString(row?.widget_type);
      const config = isRecord(row?.config) ? row.config : null;
      if (!publicId || !accountId || !widgetType || !config) {
        fail(`invalid curated row (${JSON.stringify(row)})`);
      }
      const accountState = accountStateById.get(accountId);
      if (!accountState) {
        fail(`missing account locale state for curated row ${publicId} (${accountId})`);
      }
      return {
        publicId,
        accountId,
        widgetType,
        config,
        displayName: null,
        source: 'curated',
        meta: row?.meta === null || row?.meta === undefined ? null : isRecord(row?.meta) ? row.meta : null,
        status: row?.status === 'unpublished' ? 'unpublished' : 'published',
        baseLocale: accountState.baseLocale,
        desiredLocales: accountState.desiredLocales,
        countryToLocale: accountState.countryToLocale,
        expectedLabel: formatCuratedDisplayName(row?.meta, publicId),
      };
    }),
    ...platformRows.map((row) => {
      const publicId = asTrimmedString(row?.public_id);
      const accountId = asTrimmedString(row?.account_id)?.toLowerCase();
      const widgetType = asTrimmedString(row?.widget_type);
      const config = isRecord(row?.config) ? row.config : null;
      if (!publicId || !accountId || !widgetType || !config) {
        fail(`invalid platform account row (${JSON.stringify(row)})`);
      }
      const accountState = accountStateById.get(accountId);
      if (!accountState) {
        fail(`missing account locale state for platform row ${publicId} (${accountId})`);
      }
      return {
        publicId,
        accountId,
        widgetType,
        config,
        displayName: asTrimmedString(row?.display_name),
        source: 'account',
        meta: null,
        status: row?.status === 'unpublished' ? 'unpublished' : 'published',
        baseLocale: accountState.baseLocale,
        desiredLocales: accountState.desiredLocales,
        countryToLocale: accountState.countryToLocale,
        expectedLabel: asTrimmedString(row?.display_name) || publicId,
      };
    }),
  ];

  let faqCount = 0;
  for (const [index, item] of items.entries()) {
    console.log(
      `[${SCRIPT_LABEL}] ${index + 1}/${items.length} ${item.publicId} (${item.widgetType}) saved-plane`,
    );
    await writeSavedSnapshot(item);
    const saved = await readSavedSnapshot(item);
    const { baseFingerprint } = expectSavedSummary(item, saved);
    expectCuratedDisplayName(item, saved);
    await verifyBaseSnapshot(item, baseFingerprint);
    if (item.widgetType === 'faq') {
      if (!faqLiveSurfaceMatchesDesiredState(item)) {
        console.log(`[${SCRIPT_LABEL}] ${item.publicId} faq live-surface normalize`);
        await writeFaqLiveSurface(item);
      } else {
        console.log(`[${SCRIPT_LABEL}] ${item.publicId} faq live-surface already current`);
      }
      const { readyLocales } = await verifyLivePointer(item);
      await verifyFaqLocaleArtifacts(item, readyLocales);
      faqCount += 1;
    }
  }

  console.log(
    `[${SCRIPT_LABEL}] normalized ${items.length} owned instance(s); verified ${faqCount} FAQ instance(s); target=${isRemoteBaseUrl(
      SUPABASE_URL,
    )
      ? 'remote'
      : 'local'}`,
  );
}

await main();

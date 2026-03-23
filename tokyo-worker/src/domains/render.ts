import {
  buildL10nSnapshot,
  computeBaseFingerprint,
  type AllowlistEntry,
} from '@clickeen/l10n';
import {
  guessContentTypeFromExt,
  normalizeLocale,
  normalizeSha256Hex,
  prettyStableJson,
  sha256Hex,
} from '../asset-utils';
import type { Env } from '../types';

const UTF8_ENCODER = new TextEncoder();

export type LocalePolicy = {
  baseLocale: string;
  readyLocales: string[];
  ip: {
    enabled: boolean;
    countryToLocale: Record<string, string>;
  };
  switcher: {
    enabled: boolean;
    alwaysShowLocale?: string;
  };
};

export type LiveRenderPointer = {
  v: 1;
  publicId: string;
  widgetType: string;
  configFp: string;
  localePolicy: LocalePolicy;
  l10n: {
    liveBase: string;
    packsBase: string;
  };
  seoGeo?: {
    metaLiveBase: string;
    metaPacksBase: string;
  };
};

export type SavedRenderPointer = {
  v: 1;
  publicId: string;
  accountId: string;
  widgetType: string;
  displayName: string | null;
  source: 'account' | 'curated';
  meta?: Record<string, unknown> | null;
  configFp: string;
  updatedAt: string;
  l10n?: {
    baseFingerprint: string;
    summary?: {
      baseLocale: string;
      desiredLocales: string[];
    };
  };
};

export type SavedRenderDocument = {
  pointer: SavedRenderPointer;
  config: Record<string, unknown>;
};

export type SavedRenderDocumentReadFailure = {
  ok: false;
  kind: 'NOT_FOUND' | 'VALIDATION';
  reasonKey: string;
};

export type SavedRenderDocumentReadResult =
  | {
      ok: true;
      value: SavedRenderDocument;
    }
  | SavedRenderDocumentReadFailure;

export type L10nLivePointer = {
  v: 1;
  publicId: string;
  locale: string;
  textFp: string;
  baseFingerprint: string | null;
  updatedAt: string;
};

export type MetaLivePointer = {
  v: 1;
  publicId: string;
  locale: string;
  metaFp: string;
  updatedAt: string;
};

export type WriteConfigPackJob = {
  v: 1;
  kind: 'write-config-pack';
  publicId: string;
  widgetType: string;
  configFp: string;
  configPack: unknown;
};

export type WriteTextPackJob = {
  v: 1;
  kind: 'write-text-pack';
  publicId: string;
  locale: string;
  baseFingerprint: string;
  textPack: Record<string, string>;
};

export type WriteMetaPackJob = {
  v: 1;
  kind: 'write-meta-pack';
  publicId: string;
  locale: string;
  metaPack: Record<string, unknown>;
};

export type SyncLiveSurfaceJob = {
  v: 1;
  kind: 'sync-live-surface';
  publicId: string;
  live: boolean;
  widgetType?: string;
  configFp?: string;
  localePolicy?: LocalePolicy;
  seoGeo?: boolean;
};

export type EnforceLiveSurfaceJob = {
  v: 1;
  kind: 'enforce-live-surface';
  publicId: string;
  localePolicy: LocalePolicy;
  seoGeo: boolean;
};

export type DeleteInstanceMirrorJob = {
  v: 1;
  kind: 'delete-instance-mirror';
  publicId: string;
};

export type TokyoMirrorQueueJob =
  | WriteConfigPackJob
  | WriteTextPackJob
  | WriteMetaPackJob
  | SyncLiveSurfaceJob
  | EnforceLiveSurfaceJob
  | DeleteInstanceMirrorJob;

function encodeStableJson(value: unknown): Uint8Array {
  return UTF8_ENCODER.encode(prettyStableJson(value));
}

function jsonSha256Hex(value: unknown): Promise<string> {
  const bytes = encodeStableJson(value);
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return sha256Hex(arrayBuffer);
}

function normalizePublicId(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
}

function normalizeFingerprint(value: unknown): string | null {
  return normalizeSha256Hex(value);
}

function normalizeLocaleList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => normalizeLocale(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );
}

function renderLivePointerKey(publicId: string): string {
  return `renders/instances/${publicId}/live/r.json`;
}

function renderConfigPackKey(publicId: string, configFp: string): string {
  return `renders/instances/${publicId}/config/${configFp}/config.json`;
}

function renderSavedPointerKey(publicId: string): string {
  return `renders/instances/${publicId}/saved/r.json`;
}

function renderSavedConfigPackKey(publicId: string, configFp: string): string {
  return `renders/instances/${publicId}/saved/config/${configFp}.json`;
}

function l10nBaseSnapshotKey(publicId: string, baseFingerprint: string): string {
  return `l10n/instances/${publicId}/bases/${baseFingerprint}.snapshot.json`;
}

function renderMetaLivePointerKey(publicId: string, locale: string): string {
  return `renders/instances/${publicId}/live/meta/${locale}.json`;
}

function renderMetaPackKey(publicId: string, locale: string, metaFp: string): string {
  return `renders/instances/${publicId}/meta/${locale}/${metaFp}.json`;
}

function l10nLivePointerKey(publicId: string, locale: string): string {
  return `l10n/instances/${publicId}/live/${locale}.json`;
}

function l10nTextPackKey(publicId: string, locale: string, textFp: string): string {
  return `l10n/instances/${publicId}/packs/${locale}/${textFp}.json`;
}

async function putJson(env: Env, key: string, payload: unknown): Promise<void> {
  const bytes = encodeStableJson(payload);
  await env.TOKYO_R2.put(key, bytes, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

async function loadJson<T>(env: Env, key: string): Promise<T | null> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return null;
  const json = (await obj.json().catch(() => null)) as T | null;
  return json ?? null;
}

async function deletePrefix(env: Env, prefix: string): Promise<void> {
  let cursor: string | undefined = undefined;
  do {
    const listed = await env.TOKYO_R2.list({ prefix, cursor });
    const keys = listed.objects.map((obj) => obj.key).filter((key) => Boolean(key));
    if (keys.length) {
      await env.TOKYO_R2.delete(keys);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}

export function normalizeLocalePolicy(raw: unknown): LocalePolicy | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  const baseLocale = normalizeLocale(payload.baseLocale) ?? '';
  const readyLocalesRaw = Array.isArray(payload.readyLocales)
    ? payload.readyLocales
    : [];
  const readyLocales = readyLocalesRaw
    .map((value) => normalizeLocale(value))
    .filter((value): value is string => Boolean(value));
  if (!baseLocale || !readyLocales.length) return null;
  if (!readyLocales.includes(baseLocale)) return null;
  const outReadyLocales = Array.from(new Set(readyLocales));

  const ipRaw = payload.ip;
  const ipRecord =
    ipRaw && typeof ipRaw === 'object' && !Array.isArray(ipRaw)
      ? (ipRaw as Record<string, unknown>)
      : null;
  const switcherRaw = payload.switcher;
  const switcherRecord =
    switcherRaw && typeof switcherRaw === 'object' && !Array.isArray(switcherRaw)
      ? (switcherRaw as Record<string, unknown>)
      : null;
  const ipEnabled = typeof ipRecord?.enabled === 'boolean' ? ipRecord.enabled : false;
  const switcherEnabled = typeof switcherRecord?.enabled === 'boolean' ? switcherRecord.enabled : false;
  const alwaysShowLocaleRaw =
    typeof switcherRecord?.alwaysShowLocale === 'string' ? switcherRecord.alwaysShowLocale : '';
  const alwaysShowLocale = normalizeLocale(alwaysShowLocaleRaw);

  const countryToLocaleRaw = ipRecord?.countryToLocale;
  const countryToLocale: Record<string, string> = {};
  if (
    countryToLocaleRaw &&
    typeof countryToLocaleRaw === 'object' &&
    !Array.isArray(countryToLocaleRaw)
  ) {
    for (const [country, locale] of Object.entries(countryToLocaleRaw as Record<string, unknown>)) {
      if (!/^[A-Z]{2}$/.test(country)) continue;
      const normalized = normalizeLocale(locale);
      if (!normalized) continue;
      if (!outReadyLocales.includes(normalized)) continue;
      countryToLocale[country] = normalized;
    }
  }

  return {
    baseLocale,
    readyLocales: outReadyLocales,
    ip: { enabled: ipEnabled, countryToLocale },
    switcher: {
      enabled: switcherEnabled,
      ...(alwaysShowLocale && outReadyLocales.includes(alwaysShowLocale)
        ? { alwaysShowLocale }
        : {}),
    },
  };
}

export function normalizeLiveRenderPointer(raw: unknown): LiveRenderPointer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  if (payload.v !== 1) return null;
  const publicId = normalizePublicId(payload.publicId) ?? '';
  const widgetType = typeof payload.widgetType === 'string' ? payload.widgetType.trim() : '';
  const configFp = normalizeFingerprint(payload.configFp) ?? '';
  const localePolicy = normalizeLocalePolicy(payload.localePolicy);
  if (!publicId || !widgetType || !configFp || !localePolicy) return null;
  const l10n = payload.l10n;
  const liveBase =
    l10n &&
    typeof l10n === 'object' &&
    !Array.isArray(l10n) &&
    typeof (l10n as any).liveBase === 'string'
      ? String((l10n as any).liveBase).trim()
      : '';
  const packsBase =
    l10n &&
    typeof l10n === 'object' &&
    !Array.isArray(l10n) &&
    typeof (l10n as any).packsBase === 'string'
      ? String((l10n as any).packsBase).trim()
      : '';
  if (!liveBase || !packsBase) return null;
  const seoGeoRaw = payload.seoGeo;
  const seoGeo =
    seoGeoRaw &&
    typeof seoGeoRaw === 'object' &&
    !Array.isArray(seoGeoRaw) &&
    typeof (seoGeoRaw as any).metaLiveBase === 'string' &&
    typeof (seoGeoRaw as any).metaPacksBase === 'string'
      ? {
          metaLiveBase: String((seoGeoRaw as any).metaLiveBase).trim(),
          metaPacksBase: String((seoGeoRaw as any).metaPacksBase).trim(),
        }
      : undefined;
  return {
    v: 1,
    publicId,
    widgetType,
    configFp,
    localePolicy,
    l10n: { liveBase, packsBase },
    seoGeo: seoGeo?.metaLiveBase && seoGeo?.metaPacksBase ? seoGeo : undefined,
  };
}

export function normalizeSavedRenderPointer(raw: unknown): SavedRenderPointer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  if (payload.v !== 1) return null;
  const publicId = normalizePublicId(payload.publicId) ?? '';
  const accountId = normalizePublicId(payload.accountId) ?? '';
  const widgetType = typeof payload.widgetType === 'string' ? payload.widgetType.trim() : '';
  const displayNameRaw = typeof payload.displayName === 'string' ? payload.displayName.trim() : '';
  const source =
    payload.source === 'curated'
      ? 'curated'
      : payload.source === 'account' || payload.source === undefined
        ? 'account'
        : null;
  const meta =
    payload.meta && typeof payload.meta === 'object' && !Array.isArray(payload.meta)
      ? (payload.meta as Record<string, unknown>)
      : payload.meta === null || payload.meta === undefined
        ? null
        : null;
  const l10nRaw =
    payload.l10n && typeof payload.l10n === 'object' && !Array.isArray(payload.l10n)
      ? (payload.l10n as Record<string, unknown>)
      : null;
  const baseFingerprint = normalizeFingerprint(l10nRaw?.baseFingerprint);
  const summaryRaw =
    l10nRaw?.summary && typeof l10nRaw.summary === 'object' && !Array.isArray(l10nRaw.summary)
      ? (l10nRaw.summary as Record<string, unknown>)
      : null;
  const summaryBaseLocale = normalizeLocale(summaryRaw?.baseLocale) ?? '';
  const summaryDesiredLocales = normalizeLocaleList(summaryRaw?.desiredLocales);
  const summary =
    summaryBaseLocale && summaryDesiredLocales.includes(summaryBaseLocale)
      ? {
          baseLocale: summaryBaseLocale,
          desiredLocales: summaryDesiredLocales,
        }
      : null;
  const configFp = normalizeFingerprint(payload.configFp) ?? '';
  const updatedAt = typeof payload.updatedAt === 'string' ? payload.updatedAt.trim() : '';
  if (!publicId || !accountId || !widgetType || !source || !configFp || !updatedAt) return null;
  return {
    v: 1,
    publicId,
    accountId,
    widgetType,
    displayName: displayNameRaw || null,
    source,
    meta,
    configFp,
    updatedAt,
    ...(baseFingerprint
      ? {
          l10n: {
            baseFingerprint,
            ...(summary ? { summary } : {}),
          },
        }
      : {}),
  };
}

function resolveSavedRenderValidationReason(raw: unknown): string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return 'coreui.errors.instance.config.invalid';
  }
  const payload = raw as Record<string, unknown>;
  const widgetType =
    typeof payload.widgetType === 'string' ? payload.widgetType.trim() : '';
  if (!widgetType) return 'coreui.errors.instance.widgetMissing';
  return 'coreui.errors.instance.config.invalid';
}

function normalizeAllowlistEntries(raw: unknown): AllowlistEntry[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const paths = Array.isArray((raw as { paths?: unknown }).paths)
    ? (raw as { paths: unknown[] }).paths
    : [];
  return paths.reduce<AllowlistEntry[]>((entries, entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entries;
    const path = typeof (entry as { path?: unknown }).path === 'string'
      ? (entry as { path: string }).path.trim()
      : '';
    if (!path) return entries;
    entries.push({
      path,
      type: (entry as { type?: unknown }).type === 'richtext' ? 'richtext' : 'string',
    });
    return entries;
  }, []);
}

export function resolveTokyoPublicBaseUrl(env: Env): string | null {
  const configured =
    typeof env.TOKYO_PUBLIC_BASE_URL === 'string' ? env.TOKYO_PUBLIC_BASE_URL.trim() : '';
  return configured ? configured.replace(/\/+$/, '') : null;
}

export async function loadWidgetLocalizationAllowlist(args: {
  env: Env;
  widgetType: string;
}): Promise<AllowlistEntry[]> {
  const baseUrl = resolveTokyoPublicBaseUrl(args.env);
  if (!baseUrl) return [];

  const response = await fetch(
    `${baseUrl}/widgets/${encodeURIComponent(args.widgetType)}/localization.json`,
    {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    },
  );

  if (response.status === 404) {
    return [];
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(`tokyo_widget_localization_http_${response.status}`);
  }

  return normalizeAllowlistEntries(payload);
}

function normalizeSavedL10nSnapshot(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const snapshot: Record<string, string> = {};
  for (const [path, value] of Object.entries(raw as Record<string, unknown>)) {
    const normalizedPath = typeof path === 'string' ? path.trim() : '';
    if (!normalizedPath || typeof value !== 'string') return null;
    snapshot[normalizedPath] = value;
  }
  return snapshot;
}

export async function loadSavedRenderL10nBase(args: {
  env: Env;
  publicId: string;
  widgetType: string;
  baseFingerprint?: string | null;
}): Promise<{
  baseFingerprint: string;
  snapshot: Record<string, string>;
  allowlist: AllowlistEntry[];
} | null> {
  const publicId = normalizePublicId(args.publicId);
  if (!publicId) throw new Error('[tokyo] load-saved-render-l10n-base invalid publicId');
  const widgetType = typeof args.widgetType === 'string' ? args.widgetType.trim() : '';
  if (!widgetType) throw new Error('[tokyo] load-saved-render-l10n-base missing widgetType');

  const allowlist = await loadWidgetLocalizationAllowlist({
    env: args.env,
    widgetType,
  });
  const baseFingerprint = normalizeFingerprint(args.baseFingerprint);
  if (!baseFingerprint) return null;

  const existing = await loadJson<{ snapshot?: unknown }>(
    args.env,
    l10nBaseSnapshotKey(publicId, baseFingerprint),
  );
  const existingSnapshot = normalizeSavedL10nSnapshot(existing?.snapshot);
  if (!existingSnapshot) return null;

  return {
    baseFingerprint,
    snapshot: existingSnapshot,
    allowlist,
  };
}

export async function ensureSavedRenderL10nBase(args: {
  env: Env;
  publicId: string;
  widgetType: string;
  config: Record<string, unknown>;
  existingBaseFingerprint?: string | null;
}): Promise<{
  baseFingerprint: string;
  snapshot: Record<string, string>;
  allowlist: AllowlistEntry[];
}> {
  const publicId = normalizePublicId(args.publicId);
  if (!publicId) throw new Error('[tokyo] ensure-saved-render-l10n-base invalid publicId');
  const widgetType = typeof args.widgetType === 'string' ? args.widgetType.trim() : '';
  if (!widgetType) throw new Error('[tokyo] ensure-saved-render-l10n-base missing widgetType');

  const allowlist = await loadWidgetLocalizationAllowlist({
    env: args.env,
    widgetType,
  });

  const snapshot = buildL10nSnapshot(args.config, allowlist);
  const baseFingerprint = await computeBaseFingerprint(snapshot);
  const existingBaseFingerprint = normalizeFingerprint(args.existingBaseFingerprint);

  if (existingBaseFingerprint && existingBaseFingerprint === baseFingerprint) {
    const existing = await loadSavedRenderL10nBase({
      env: args.env,
      publicId,
      widgetType,
      baseFingerprint,
    });
    if (existing) {
      return existing;
    }
  }

  const existingCurrent = await loadSavedRenderL10nBase({
    env: args.env,
    publicId,
    widgetType,
    baseFingerprint,
  });
  if (existingCurrent) {
    return existingCurrent;
  }

  await putJson(args.env, l10nBaseSnapshotKey(publicId, baseFingerprint), {
    v: 1,
    publicId,
    baseFingerprint,
    snapshot,
  });
  return { baseFingerprint, snapshot, allowlist };
}

export function normalizeTextPointer(raw: unknown): L10nLivePointer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  if (payload.v !== 1) return null;
  const publicId = normalizePublicId(payload.publicId) ?? '';
  const locale = normalizeLocale(payload.locale) ?? '';
  const textFp = normalizeFingerprint(payload.textFp) ?? '';
  const baseFingerprint = normalizeFingerprint(payload.baseFingerprint);
  const updatedAt = typeof payload.updatedAt === 'string' ? payload.updatedAt.trim() : '';
  if (!publicId || !locale || !textFp || !updatedAt) return null;
  return { v: 1, publicId, locale, textFp, baseFingerprint, updatedAt };
}

function normalizeMetaPointer(raw: unknown): MetaLivePointer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  if (payload.v !== 1) return null;
  const publicId = normalizePublicId(payload.publicId) ?? '';
  const locale = normalizeLocale(payload.locale) ?? '';
  const metaFp = normalizeFingerprint(payload.metaFp) ?? '';
  const updatedAt = typeof payload.updatedAt === 'string' ? payload.updatedAt.trim() : '';
  if (!publicId || !locale || !metaFp || !updatedAt) return null;
  return { v: 1, publicId, locale, metaFp, updatedAt };
}

export function isTokyoMirrorJob(value: unknown): value is TokyoMirrorQueueJob {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const job = value as Record<string, unknown>;
  if (job.v !== 1) return false;
  if (typeof job.kind !== 'string') return false;
  if (!job.kind) return false;
  if (typeof job.publicId !== 'string') return false;
  return (
    job.kind === 'write-config-pack' ||
    job.kind === 'write-text-pack' ||
    job.kind === 'write-meta-pack' ||
    job.kind === 'sync-live-surface' ||
    job.kind === 'enforce-live-surface' ||
    job.kind === 'delete-instance-mirror'
  );
}

export async function handleGetR2Object(
  env: Env,
  key: string,
  cacheControl: string,
): Promise<Response> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }

  const ext = key.split('.').pop() || '';
  const contentType = obj.httpMetadata?.contentType || guessContentTypeFromExt(ext);
  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('cache-control', cacheControl);
  return new Response(obj.body, { status: 200, headers });
}

export async function writeSavedRenderConfig(args: {
  env: Env;
  publicId: string;
  accountId: string;
  widgetType: string;
  config: Record<string, unknown>;
  displayName?: unknown;
  source?: unknown;
  meta?: unknown;
  l10n?:
    | {
        baseFingerprint?: string | null;
        summary?: {
          baseLocale: string;
          desiredLocales: string[];
        } | null;
      }
    | null;
}): Promise<{ pointer: SavedRenderPointer; previousBaseFingerprint: string | null }> {
  const publicId = args.publicId;
  const accountId = args.accountId;
  const config = args.config;
  const widgetType = args.widgetType;

  const configFp = await jsonSha256Hex(config);
  const packKey = renderSavedConfigPackKey(publicId, configFp);
  await putJson(args.env, packKey, config);

  const displayName =
    typeof args.displayName === 'string' ? args.displayName.trim() || null : null;
  const source =
    args.source === 'curated' ? 'curated' : 'account';
  const meta =
    args.meta === null
      ? null
      : args.meta && typeof args.meta === 'object' && !Array.isArray(args.meta)
        ? (args.meta as Record<string, unknown>)
        : null;
  const existingPointer = normalizeSavedRenderPointer(
    await loadJson(args.env, renderSavedPointerKey(publicId)),
  );
  const previousBaseFingerprint = existingPointer?.l10n?.baseFingerprint ?? null;
  const l10nBase = await ensureSavedRenderL10nBase({
    env: args.env,
    publicId,
    widgetType,
    config,
    existingBaseFingerprint:
      typeof args.l10n?.baseFingerprint === 'string'
        ? args.l10n.baseFingerprint
        : existingPointer?.l10n?.baseFingerprint ?? null,
  });
  const requestedSummary = args.l10n?.summary ?? undefined;
  const carriedSummary =
    requestedSummary === null
      ? null
      : requestedSummary ?? existingPointer?.l10n?.summary ?? null;
  const l10n = {
    baseFingerprint: l10nBase.baseFingerprint,
    ...(carriedSummary ? { summary: carriedSummary } : {}),
  } satisfies NonNullable<SavedRenderPointer['l10n']>;

  const pointer: SavedRenderPointer = {
    v: 1,
    publicId,
    accountId,
    widgetType,
    displayName,
    source,
    meta,
    configFp,
    updatedAt: new Date().toISOString(),
    l10n,
  };
  await putJson(args.env, renderSavedPointerKey(publicId), pointer);
  return {
    pointer,
    previousBaseFingerprint,
  };
}

export async function readSavedRenderPointer(args: {
  env: Env;
  publicId: string;
  accountId: string;
}): Promise<
  | {
      ok: true;
      value: SavedRenderPointer;
    }
  | SavedRenderDocumentReadFailure
> {
  const publicId = normalizePublicId(args.publicId);
  const accountId = normalizePublicId(args.accountId);
  if (!publicId || !accountId) {
    return {
      ok: false,
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.render.invalid',
    };
  }

  const pointerRaw = await loadJson(args.env, renderSavedPointerKey(publicId));
  if (!pointerRaw) {
    return {
      ok: false,
      kind: 'NOT_FOUND',
      reasonKey: 'tokyo.errors.render.notFound',
    };
  }
  const pointer = normalizeSavedRenderPointer(pointerRaw);
  if (!pointer) {
    return {
      ok: false,
      kind: 'VALIDATION',
      reasonKey: resolveSavedRenderValidationReason(pointerRaw),
    };
  }
  if (pointer.publicId !== publicId) {
    return {
      ok: false,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.instance.config.invalid',
    };
  }
  if (pointer.accountId !== accountId) {
    return {
      ok: false,
      kind: 'NOT_FOUND',
      reasonKey: 'tokyo.errors.render.notFound',
    };
  }

  return { ok: true, value: pointer };
}

export async function readSavedRenderConfig(args: {
  env: Env;
  publicId: string;
  accountId: string;
}): Promise<SavedRenderDocumentReadResult> {
  const publicId = normalizePublicId(args.publicId);
  const accountId = normalizePublicId(args.accountId);
  if (!publicId || !accountId) {
    return {
      ok: false,
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.render.invalid',
    };
  }

  const pointerResult = await readSavedRenderPointer(args);
  if (!pointerResult.ok) return pointerResult;
  const pointer = pointerResult.value;

  const config =
    (await loadJson<Record<string, unknown>>(
      args.env,
      renderSavedConfigPackKey(publicId, pointer.configFp),
    )) ?? null;
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return {
      ok: false,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.instance.config.invalid',
    };
  }
  return { ok: true, value: { pointer, config } };
}

export async function writeSavedRenderL10nState(args: {
  env: Env;
  publicId: string;
  accountId: string;
  baseFingerprint: string;
  summary?: {
    baseLocale: string;
    desiredLocales: string[];
  } | null;
}): Promise<SavedRenderPointer> {
  const pointerResult = await readSavedRenderPointer({
    env: args.env,
    publicId: args.publicId,
    accountId: args.accountId,
  });
  if (!pointerResult.ok) {
    throw new Error(
      pointerResult.kind === 'NOT_FOUND' ? 'tokyo_saved_not_found' : pointerResult.reasonKey,
    );
  }

  const pointer: SavedRenderPointer = {
    ...pointerResult.value,
    l10n: {
      baseFingerprint: args.baseFingerprint,
      ...(args.summary ? { summary: args.summary } : {}),
    },
  };
  await putJson(args.env, renderSavedPointerKey(args.publicId), pointer);
  return pointer;
}

export async function deleteSavedRenderConfig(args: {
  env: Env;
  publicId: string;
  accountId: string;
}): Promise<
  | { ok: true; deleted: true }
  | SavedRenderDocumentReadFailure
> {
  const publicId = normalizePublicId(args.publicId);
  const accountId = normalizePublicId(args.accountId);
  if (!publicId || !accountId) {
    return {
      ok: false,
      kind: 'VALIDATION',
      reasonKey: 'tokyo.errors.render.invalid',
    };
  }

  const saved = await readSavedRenderConfig({ env: args.env, publicId, accountId });
  if (!saved.ok) return saved;

  await Promise.all([
    args.env.TOKYO_R2.delete(renderSavedPointerKey(publicId)),
    args.env.TOKYO_R2.delete(renderSavedConfigPackKey(publicId, saved.value.pointer.configFp)),
  ]);
  return { ok: true, deleted: true };
}

export async function writeConfigPack(env: Env, job: WriteConfigPackJob): Promise<void> {
  const publicId = normalizePublicId(job.publicId);
  if (!publicId) throw new Error('[tokyo] write-config-pack missing publicId');
  const configFp = normalizeFingerprint(job.configFp);
  if (!configFp) throw new Error('[tokyo] write-config-pack invalid configFp');
  const widgetType = typeof job.widgetType === 'string' ? job.widgetType.trim() : '';
  if (!widgetType) throw new Error('[tokyo] write-config-pack missing widgetType');

  const fingerprint = await jsonSha256Hex(job.configPack);
  if (fingerprint !== configFp) {
    throw new Error(
      `[tokyo] write-config-pack fingerprint mismatch expected=${configFp} got=${fingerprint}`,
    );
  }

  const bytes = encodeStableJson(job.configPack);
  await env.TOKYO_R2.put(renderConfigPackKey(publicId, configFp), bytes, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

export async function writeTextPack(env: Env, job: WriteTextPackJob): Promise<void> {
  const publicId = normalizePublicId(job.publicId);
  if (!publicId) throw new Error('[tokyo] write-text-pack missing publicId');
  const locale = normalizeLocale(job.locale);
  if (!locale) throw new Error('[tokyo] write-text-pack invalid locale');
  const baseFingerprint = normalizeFingerprint(job.baseFingerprint);
  if (!baseFingerprint) throw new Error('[tokyo] write-text-pack invalid baseFingerprint');
  if (!job.textPack || typeof job.textPack !== 'object' || Array.isArray(job.textPack)) {
    throw new Error('[tokyo] write-text-pack textPack must be an object');
  }

  const textFp = await jsonSha256Hex(job.textPack);
  const packBytes = encodeStableJson(job.textPack);
  const packKey = l10nTextPackKey(publicId, locale, textFp);
  await env.TOKYO_R2.put(packKey, packBytes, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });

  const pointerKey = l10nLivePointerKey(publicId, locale);
  const existing = normalizeTextPointer(await loadJson(env, pointerKey));
  const previousTextFp = existing?.textFp ?? null;

  await putJson(env, pointerKey, {
    v: 1,
    publicId,
    locale,
    textFp,
    baseFingerprint,
    updatedAt: new Date().toISOString(),
  } satisfies L10nLivePointer);

  if (previousTextFp && previousTextFp !== textFp) {
    await env.TOKYO_R2.delete(l10nTextPackKey(publicId, locale, previousTextFp));
  }
}

export async function writeMetaPack(env: Env, job: WriteMetaPackJob): Promise<void> {
  const publicId = normalizePublicId(job.publicId);
  if (!publicId) throw new Error('[tokyo] write-meta-pack missing publicId');
  const locale = normalizeLocale(job.locale);
  if (!locale) throw new Error('[tokyo] write-meta-pack invalid locale');
  if (!job.metaPack || typeof job.metaPack !== 'object' || Array.isArray(job.metaPack)) {
    throw new Error('[tokyo] write-meta-pack metaPack must be an object');
  }

  const metaFp = await jsonSha256Hex(job.metaPack);
  const packBytes = encodeStableJson(job.metaPack);
  const packKey = renderMetaPackKey(publicId, locale, metaFp);
  await env.TOKYO_R2.put(packKey, packBytes, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });

  const pointerKey = renderMetaLivePointerKey(publicId, locale);
  const existing = normalizeMetaPointer(await loadJson(env, pointerKey));
  const previousMetaFp = existing?.metaFp ?? null;

  await putJson(env, pointerKey, {
    v: 1,
    publicId,
    locale,
    metaFp,
    updatedAt: new Date().toISOString(),
  } satisfies MetaLivePointer);

  if (previousMetaFp && previousMetaFp !== metaFp) {
    await env.TOKYO_R2.delete(renderMetaPackKey(publicId, locale, previousMetaFp));
  }
}

async function ensureR2KeyExists(env: Env, key: string, label: string): Promise<void> {
  const obj = await env.TOKYO_R2.head(key);
  if (!obj) throw new Error(`[tokyo] missing required ${label} (${key})`);
}

async function deleteLocaleTextMirror(env: Env, publicId: string, locale: string): Promise<void> {
  const pointerKey = l10nLivePointerKey(publicId, locale);
  const pointer = normalizeTextPointer(await loadJson(env, pointerKey));
  await env.TOKYO_R2.delete(pointerKey);
  if (pointer?.textFp) {
    await env.TOKYO_R2.delete(l10nTextPackKey(publicId, locale, pointer.textFp));
  }
}

async function deleteLocaleMetaMirror(env: Env, publicId: string, locale: string): Promise<void> {
  const pointerKey = renderMetaLivePointerKey(publicId, locale);
  const pointer = normalizeMetaPointer(await loadJson(env, pointerKey));
  await env.TOKYO_R2.delete(pointerKey);
  if (pointer?.metaFp) {
    await env.TOKYO_R2.delete(renderMetaPackKey(publicId, locale, pointer.metaFp));
  }
}

export async function syncLiveSurface(env: Env, job: SyncLiveSurfaceJob): Promise<void> {
  const publicId = normalizePublicId(job.publicId);
  if (!publicId) throw new Error('[tokyo] sync-live-surface missing publicId');
  const key = renderLivePointerKey(publicId);

  if (!job.live) {
    await env.TOKYO_R2.delete(key);
    return;
  }

  const widgetType = typeof job.widgetType === 'string' ? job.widgetType.trim() : '';
  if (!widgetType) throw new Error('[tokyo] sync-live-surface missing widgetType');
  const configFp = normalizeFingerprint(job.configFp);
  if (!configFp) throw new Error('[tokyo] sync-live-surface invalid configFp');
  const localePolicy = normalizeLocalePolicy(job.localePolicy);
  if (!localePolicy) throw new Error('[tokyo] sync-live-surface invalid localePolicy');

  // Refuse to move the live pointer if the referenced bytes aren't present yet.
  await ensureR2KeyExists(env, renderConfigPackKey(publicId, configFp), 'config pack');
  for (const locale of localePolicy.readyLocales) {
    await ensureR2KeyExists(env, l10nLivePointerKey(publicId, locale), `text pointer (${locale})`);
    if (job.seoGeo) {
      await ensureR2KeyExists(
        env,
        renderMetaLivePointerKey(publicId, locale),
        `meta pointer (${locale})`,
      );
    }
  }

  const previous = normalizeLiveRenderPointer(await loadJson(env, key));
  const previousConfigFp = previous?.configFp ?? null;
  const previousLocales = previous?.localePolicy.readyLocales ?? [];
  const previousSeoGeoEnabled = Boolean(previous?.seoGeo);

  const next: LiveRenderPointer = {
    v: 1,
    publicId,
    widgetType,
    configFp,
    localePolicy,
    l10n: {
      liveBase: `l10n/instances/${publicId}/live`,
      packsBase: `l10n/instances/${publicId}/packs`,
    },
    seoGeo: job.seoGeo
      ? {
          metaLiveBase: `renders/instances/${publicId}/live/meta`,
          metaPacksBase: `renders/instances/${publicId}/meta`,
        }
      : undefined,
  };

  await putJson(env, key, next);

  if (previousConfigFp && previousConfigFp !== configFp) {
    await env.TOKYO_R2.delete(renderConfigPackKey(publicId, previousConfigFp));
  }

  const nextLocales = new Set(localePolicy.readyLocales);
  const removedLocales = previousLocales.filter((locale) => !nextLocales.has(locale));
  for (const locale of removedLocales) {
    await deleteLocaleTextMirror(env, publicId, locale);
    if (previousSeoGeoEnabled) {
      await deleteLocaleMetaMirror(env, publicId, locale);
    }
  }

  if (previousSeoGeoEnabled && !job.seoGeo) {
    for (const locale of previousLocales) {
      await deleteLocaleMetaMirror(env, publicId, locale);
    }
  }
}

export async function enforceLiveSurface(env: Env, job: EnforceLiveSurfaceJob): Promise<void> {
  const publicId = normalizePublicId(job.publicId);
  if (!publicId) throw new Error('[tokyo] enforce-live-surface missing publicId');

  const localePolicy = normalizeLocalePolicy(job.localePolicy);
  if (!localePolicy) throw new Error('[tokyo] enforce-live-surface invalid localePolicy');
  const seoGeo = job.seoGeo === true;

  const key = renderLivePointerKey(publicId);
  const existing = normalizeLiveRenderPointer(await loadJson(env, key));
  if (!existing) {
    // Nothing is live in Tokyo; best-effort cleanup of SEO/meta prefixes to avoid drift.
    if (!seoGeo) {
      await Promise.all([
        deletePrefix(env, `renders/instances/${publicId}/live/meta/`),
        deletePrefix(env, `renders/instances/${publicId}/meta/`),
      ]);
    }
    return;
  }

  await syncLiveSurface(env, {
    v: 1,
    kind: 'sync-live-surface',
    publicId,
    live: true,
    widgetType: existing.widgetType,
    configFp: existing.configFp,
    localePolicy,
    seoGeo,
  });
}

export async function deleteInstanceMirror(env: Env, publicId: string): Promise<void> {
  const normalized = normalizePublicId(publicId);
  if (!normalized) throw new Error('[tokyo] delete-instance-mirror missing publicId');
  // Tokyo is a mirror, not an archive: if an instance is not live, its bytes must not exist.
  await Promise.all([
    deletePrefix(env, `renders/instances/${normalized}/`),
    deletePrefix(env, `l10n/instances/${normalized}/`),
  ]);
}

export {
  l10nLivePointerKey,
  l10nTextPackKey,
  renderConfigPackKey,
  renderLivePointerKey,
  renderSavedPointerKey,
  renderSavedConfigPackKey,
  renderMetaLivePointerKey,
  renderMetaPackKey,
};

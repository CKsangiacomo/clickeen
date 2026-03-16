import {
  buildL10nSnapshot,
  computeBaseFingerprint,
  normalizeLocaleToken,
  type AllowlistEntry,
} from '@clickeen/l10n';
import { applyTextPackToConfig } from './text-packs';
import { generateMetaPack } from './seo-geo';

export type AccountL10nPolicy = {
  v: 1;
  baseLocale: string;
  ip: {
    enabled: boolean;
    countryToLocale: Record<string, string>;
  };
  switcher: {
    enabled: boolean;
    locales?: string[];
  };
};

export type LocalizationOp = { op: 'set'; path: string; value: string };

export type AccountOverlayEntry = {
  locale: string;
  source: string | null;
  baseFingerprint: string | null;
  baseUpdatedAt: string | null;
  hasUserOps: boolean;
  baseOps: LocalizationOp[];
  userOps: LocalizationOp[];
};

export type AccountLocalizationSnapshot = {
  baseLocale: string;
  accountLocales: string[];
  readyLocales: string[];
  invalidAccountLocales: string | null;
  localeOverlays: AccountOverlayEntry[];
  policy: AccountL10nPolicy;
};

type BerlinAccountPayload = {
  account?: {
    l10nLocales?: unknown;
    l10nPolicy?: unknown;
  } | null;
};

type TokyoSavedPayload = {
  config?: unknown;
  widgetType?: unknown;
  updatedAt?: unknown;
};

type TokyoLiveRenderPayload = {
  seoGeo?: {
    metaLiveBase?: unknown;
    metaPacksBase?: unknown;
  } | null;
};

type TokyoOverlayIndex = {
  v?: unknown;
  layers?: Record<string, { keys?: unknown; geoTargets?: unknown }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeLocaleList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => normalizeLocaleToken(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );
}

function resolveAccountL10nPolicy(raw: unknown): AccountL10nPolicy {
  const defaultPolicy: AccountL10nPolicy = {
    v: 1,
    baseLocale: 'en',
    ip: { enabled: false, countryToLocale: {} },
    switcher: { enabled: true },
  };
  if (!isRecord(raw) || raw.v !== 1) return defaultPolicy;

  const baseLocale = normalizeLocaleToken(raw.baseLocale) ?? defaultPolicy.baseLocale;
  const ipRaw = isRecord(raw.ip) ? raw.ip : null;
  const switcherRaw = isRecord(raw.switcher) ? raw.switcher : null;
  const countryToLocale: Record<string, string> = {};
  if (ipRaw && isRecord(ipRaw.countryToLocale)) {
    for (const [countryRaw, localeRaw] of Object.entries(ipRaw.countryToLocale)) {
      const country = typeof countryRaw === 'string' ? countryRaw.trim().toUpperCase() : '';
      const locale = normalizeLocaleToken(localeRaw);
      if (!/^[A-Z]{2}$/.test(country) || !locale) continue;
      countryToLocale[country] = locale;
    }
  }

  const switcherLocales = normalizeLocaleList(switcherRaw?.locales);
  return {
    v: 1,
    baseLocale,
    ip: {
      enabled: ipRaw?.enabled === true,
      countryToLocale,
    },
    switcher: {
      enabled: switcherRaw?.enabled !== false,
      ...(switcherLocales.length ? { locales: switcherLocales } : {}),
    },
  };
}

function pathMatchesAllowlist(pathStr: string, allowPath: string): boolean {
  const pathSegments = String(pathStr || '')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);
  const allowSegments = String(allowPath || '')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (pathSegments.length !== allowSegments.length) return false;
  for (let index = 0; index < allowSegments.length; index += 1) {
    const allow = allowSegments[index];
    const actual = pathSegments[index];
    if (allow === '*') {
      if (!/^\d+$/.test(actual || '')) return false;
      continue;
    }
    if (allow !== actual) return false;
  }
  return true;
}

function normalizeLocalizationOps(raw: unknown): LocalizationOp[] {
  if (!Array.isArray(raw)) return [];
  const out: LocalizationOp[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || entry.op !== 'set') continue;
    const path = asTrimmedString(entry.path);
    if (!path || typeof entry.value !== 'string') continue;
    out.push({ op: 'set', path, value: entry.value });
  }
  return out;
}

function filterAllowlistedOps(ops: LocalizationOp[], allowlist: AllowlistEntry[]): LocalizationOp[] {
  const allowlistPaths = allowlist.map((entry) => String(entry.path || '').trim()).filter(Boolean);
  return ops.filter((entry) => allowlistPaths.some((path) => pathMatchesAllowlist(entry.path, path)));
}

function applyOpsToTextPack(
  basePack: Record<string, string>,
  ops: LocalizationOp[],
): Record<string, string> {
  const next = { ...basePack };
  for (const op of ops) {
    if (!(op.path in next)) continue;
    next[op.path] = op.value;
  }
  return next;
}

function buildLocalizedTextPack(args: {
  baseLocale: string;
  locale: string;
  basePack: Record<string, string>;
  baseOps: LocalizationOp[];
  userOps: LocalizationOp[];
}): Record<string, string> {
  if (args.locale === args.baseLocale) return { ...args.basePack };
  const withLocale = applyOpsToTextPack(args.basePack, args.baseOps);
  return applyOpsToTextPack(withLocale, args.userOps);
}

function buildTokyoAccountHeaders(args: {
  accessToken: string;
  accountId: string;
  contentType?: string;
}): Headers {
  const headers = new Headers({
    accept: 'application/json',
    authorization: `Bearer ${args.accessToken}`,
    'x-account-id': args.accountId,
  });
  if (args.contentType) headers.set('content-type', args.contentType);
  return headers;
}

async function loadJson<T>(url: string, init?: RequestInit): Promise<{ status: number; json: T | null }> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => null)) as T | null;
  return { status: response.status, json: payload };
}

export async function loadAccountLocalesFromBerlin(args: {
  berlinBaseUrl: string;
  accessToken: string;
  accountId: string;
}): Promise<{ accountLocales: string[]; policy: AccountL10nPolicy }> {
  const { status, json } = await loadJson<BerlinAccountPayload>(
    `${args.berlinBaseUrl.replace(/\/+$/, '')}/v1/accounts/${encodeURIComponent(args.accountId)}`,
    {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${args.accessToken}`,
      },
      cache: 'no-store',
    },
  );
  if (status !== 200) {
    throw new Error(`berlin_account_http_${status}`);
  }
  return {
    accountLocales: normalizeLocaleList(json?.account?.l10nLocales),
    policy: resolveAccountL10nPolicy(json?.account?.l10nPolicy),
  };
}

export async function loadSavedAccountInstanceFromTokyo(args: {
  tokyoBaseUrl: string;
  accessToken: string;
  accountId: string;
  publicId: string;
}): Promise<{
  config: Record<string, unknown>;
  widgetType: string;
  updatedAt: string;
  published: boolean;
  seoGeoLive: boolean;
}> {
  const base = args.tokyoBaseUrl.replace(/\/+$/, '');
  const headers = buildTokyoAccountHeaders({
    accessToken: args.accessToken,
    accountId: args.accountId,
  });
  const savedResponse = await fetch(
    `${base}/renders/instances/${encodeURIComponent(args.publicId)}/saved.json?accountId=${encodeURIComponent(
      args.accountId,
    )}`,
    {
      method: 'GET',
      headers,
      cache: 'no-store',
    },
  );
  const savedPayload = (await savedResponse.json().catch(() => null)) as TokyoSavedPayload | null;
  if (!savedResponse.ok || !isRecord(savedPayload?.config)) {
    throw new Error(`tokyo_saved_http_${savedResponse.status}`);
  }

  const liveResponse = await fetch(
    `${base}/renders/instances/${encodeURIComponent(args.publicId)}/live/r.json`,
    {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    },
  );
  const livePayload = (await liveResponse.json().catch(() => null)) as TokyoLiveRenderPayload | null;

  return {
    config: savedPayload.config as Record<string, unknown>,
    widgetType: String(savedPayload.widgetType || '').trim(),
    updatedAt: String(savedPayload.updatedAt || '').trim(),
    published: liveResponse.status === 200,
    seoGeoLive:
      liveResponse.status === 200 &&
      Boolean(
        livePayload?.seoGeo &&
          isRecord(livePayload.seoGeo) &&
          asTrimmedString(livePayload.seoGeo.metaLiveBase) &&
          asTrimmedString(livePayload.seoGeo.metaPacksBase),
      ),
  };
}

export async function loadTokyoAllowlist(args: {
  tokyoBaseUrl: string;
  widgetType: string;
  path: 'localization' | 'user-layer';
}): Promise<AllowlistEntry[]> {
  const relative =
    args.path === 'localization'
      ? `/widgets/${encodeURIComponent(args.widgetType)}/localization.json`
      : `/widgets/${encodeURIComponent(args.widgetType)}/layers/user.allowlist.json`;
  const { status, json } = await loadJson<{ v?: unknown; paths?: unknown }>(
    `${args.tokyoBaseUrl.replace(/\/+$/, '')}${relative}`,
    { method: 'GET', cache: 'no-store' },
  );
  if (status !== 200 || !Array.isArray(json?.paths)) {
    throw new Error(`tokyo_allowlist_http_${status}`);
  }
  return json.paths.reduce<AllowlistEntry[]>((entries, entry) => {
    if (!isRecord(entry)) return entries;
    const path = asTrimmedString(entry.path);
    if (!path) return entries;
    entries.push({
      path,
      type: entry.type === 'richtext' ? 'richtext' : 'string',
    });
    return entries;
  }, []);
}

async function loadTokyoIndex(args: {
  tokyoBaseUrl: string;
  publicId: string;
}): Promise<{
  localeKeys: Set<string>;
  userKeys: Set<string>;
}> {
  const { status, json } = await loadJson<TokyoOverlayIndex>(
    `${args.tokyoBaseUrl.replace(/\/+$/, '')}/l10n/instances/${encodeURIComponent(args.publicId)}/index.json`,
    { method: 'GET', cache: 'no-store' },
  );
  if (status === 404 || !isRecord(json?.layers)) {
    return { localeKeys: new Set(), userKeys: new Set() };
  }

  const normalizeKeys = (value: unknown, allowGlobal = false) =>
    new Set(
      (Array.isArray(value) ? value : [])
        .map((entry) => {
          const normalized = normalizeLocaleToken(entry);
          if (normalized) return normalized;
          if (allowGlobal && String(entry || '').trim().toLowerCase() === 'global') return 'global';
          return null;
        })
        .filter((entry): entry is string => Boolean(entry)),
    );

  return {
    localeKeys: normalizeKeys(json.layers?.locale?.keys),
    userKeys: normalizeKeys(json.layers?.user?.keys, true),
  };
}

async function loadOverlayOps(args: {
  tokyoBaseUrl: string;
  publicId: string;
  layer: 'locale' | 'user';
  layerKey: string;
  baseFingerprint: string;
  allowlist: AllowlistEntry[];
}): Promise<{ ops: LocalizationOp[]; baseUpdatedAt: string | null }> {
  const { status, json } = await loadJson<{ ops?: unknown; baseUpdatedAt?: unknown }>(
    `${args.tokyoBaseUrl.replace(/\/+$/, '')}/l10n/instances/${encodeURIComponent(
      args.publicId,
    )}/${args.layer}/${encodeURIComponent(args.layerKey)}/${encodeURIComponent(args.baseFingerprint)}.ops.json`,
    {
      method: 'GET',
      cache: 'no-store',
    },
  );
  if (status === 404 || !json) {
    return { ops: [], baseUpdatedAt: null };
  }
  if (status !== 200) {
    throw new Error(`tokyo_overlay_http_${status}`);
  }
  return {
    ops: filterAllowlistedOps(normalizeLocalizationOps(json.ops), args.allowlist),
    baseUpdatedAt: asTrimmedString(json.baseUpdatedAt),
  };
}

export async function loadAccountLocalizationSnapshot(args: {
  berlinBaseUrl: string;
  tokyoBaseUrl: string;
  accessToken: string;
  accountId: string;
  publicId: string;
}): Promise<{
  snapshot: AccountLocalizationSnapshot;
  widgetType: string;
  baseFingerprint: string;
  saved: {
    config: Record<string, unknown>;
    updatedAt: string;
    published: boolean;
    seoGeoLive: boolean;
  };
}> {
  const [{ accountLocales, policy }, saved] = await Promise.all([
    loadAccountLocalesFromBerlin({
      berlinBaseUrl: args.berlinBaseUrl,
      accessToken: args.accessToken,
      accountId: args.accountId,
    }),
    loadSavedAccountInstanceFromTokyo({
      tokyoBaseUrl: args.tokyoBaseUrl,
      accessToken: args.accessToken,
      accountId: args.accountId,
      publicId: args.publicId,
    }),
  ]);

  if (!saved.widgetType || !saved.updatedAt) {
    throw new Error('tokyo_saved_invalid');
  }

  const [localizationAllowlist, index] = await Promise.all([
    loadTokyoAllowlist({
      tokyoBaseUrl: args.tokyoBaseUrl,
      widgetType: saved.widgetType,
      path: 'localization',
    }),
    loadTokyoIndex({
      tokyoBaseUrl: args.tokyoBaseUrl,
      publicId: args.publicId,
    }),
  ]);

  const baseTextPack = buildL10nSnapshot(saved.config, localizationAllowlist);
  const baseFingerprint = await computeBaseFingerprint(baseTextPack);
  const desiredLocales = Array.from(new Set([policy.baseLocale, ...accountLocales]));

  const overlayEntries = await Promise.all(
    desiredLocales
      .filter((locale) => locale !== policy.baseLocale)
      .map(async (locale) => {
        const [baseOverlay, userOverlay] = await Promise.all([
          loadOverlayOps({
            tokyoBaseUrl: args.tokyoBaseUrl,
            publicId: args.publicId,
            layer: 'locale',
            layerKey: locale,
            baseFingerprint,
            allowlist: localizationAllowlist,
          }),
          loadOverlayOps({
            tokyoBaseUrl: args.tokyoBaseUrl,
            publicId: args.publicId,
            layer: 'user',
            layerKey: locale,
            baseFingerprint,
            allowlist: localizationAllowlist,
          }),
        ]);
        return {
          locale,
          source: userOverlay.ops.length > 0 ? 'user' : baseOverlay.ops.length > 0 ? 'agent' : null,
          baseFingerprint:
            baseOverlay.ops.length > 0 || userOverlay.ops.length > 0 ? baseFingerprint : null,
          baseUpdatedAt: userOverlay.baseUpdatedAt ?? baseOverlay.baseUpdatedAt,
          hasUserOps: userOverlay.ops.length > 0,
          baseOps: baseOverlay.ops,
          userOps: userOverlay.ops,
          staleIndexed:
            index.localeKeys.has(locale) || index.userKeys.has(locale),
        };
      }),
  );

  const readyLocaleSet = new Set<string>([policy.baseLocale]);
  overlayEntries.forEach((entry) => {
    if (entry.baseOps.length > 0 || entry.userOps.length > 0) readyLocaleSet.add(entry.locale);
  });

  return {
    snapshot: {
      baseLocale: policy.baseLocale,
      accountLocales,
      readyLocales: desiredLocales.filter((locale) => readyLocaleSet.has(locale)),
      invalidAccountLocales: null,
      localeOverlays: overlayEntries.map(({ staleIndexed: _staleIndexed, ...entry }) => entry),
      policy,
    },
    widgetType: saved.widgetType,
    baseFingerprint,
    saved,
  };
}

export async function loadAccountL10nStatus(args: {
  berlinBaseUrl: string;
  tokyoBaseUrl: string;
  accessToken: string;
  accountId: string;
  publicId: string;
}): Promise<{
  publicId: string;
  widgetType: string;
  baseFingerprint: string;
  baseUpdatedAt: string;
  locales: Array<{
    locale: string;
    status: 'dirty' | 'succeeded' | 'superseded';
    attempts: number;
    nextAttemptAt: null;
    lastAttemptAt: string | null;
    lastError: null;
  }>;
}> {
  const result = await loadAccountLocalizationSnapshot(args);
  const index = await loadTokyoIndex({
    tokyoBaseUrl: args.tokyoBaseUrl,
    publicId: args.publicId,
  });
  const localeEntries = result.snapshot.accountLocales.map((locale) => {
    const overlay =
      result.snapshot.localeOverlays.find((entry) => entry.locale === locale) ?? null;
    const hasCurrent =
      overlay !== null && (overlay.baseOps.length > 0 || overlay.userOps.length > 0);
    const hasIndexed = index.localeKeys.has(locale) || index.userKeys.has(locale);
    const status: 'dirty' | 'succeeded' | 'superseded' = hasCurrent
      ? 'succeeded'
      : hasIndexed
        ? 'superseded'
        : 'dirty';
    return {
      locale,
      status,
      attempts: hasCurrent ? 1 : 0,
      nextAttemptAt: null,
      lastAttemptAt: overlay?.baseUpdatedAt ?? null,
      lastError: null,
    };
  });

  return {
    publicId: args.publicId,
    widgetType: result.widgetType,
    baseFingerprint: result.baseFingerprint,
    baseUpdatedAt: result.saved.updatedAt,
    locales: localeEntries,
  };
}

export async function loadEffectiveUserLayerContext(args: {
  berlinBaseUrl: string;
  tokyoBaseUrl: string;
  accessToken: string;
  accountId: string;
  publicId: string;
  locale: string;
}): Promise<{
  widgetType: string;
  baseFingerprint: string;
  baseUpdatedAt: string;
  userAllowlist: AllowlistEntry[];
  baseConfig: Record<string, unknown>;
  baseLocale: string;
  baseTextPack: Record<string, string>;
  localeOps: LocalizationOp[];
  userOps: LocalizationOp[];
  published: boolean;
  seoGeoLive: boolean;
}> {
  const snapshot = await loadAccountLocalizationSnapshot(args);
  const [localizationAllowlist, userAllowlist] = await Promise.all([
    loadTokyoAllowlist({
      tokyoBaseUrl: args.tokyoBaseUrl,
      widgetType: snapshot.widgetType,
      path: 'localization',
    }),
    loadTokyoAllowlist({
      tokyoBaseUrl: args.tokyoBaseUrl,
      widgetType: snapshot.widgetType,
      path: 'user-layer',
    }),
  ]);
  const baseTextPack = buildL10nSnapshot(snapshot.saved.config, localizationAllowlist);
  const overlay =
    snapshot.snapshot.localeOverlays.find((entry) => entry.locale === args.locale) ?? null;
  return {
    widgetType: snapshot.widgetType,
    baseFingerprint: snapshot.baseFingerprint,
    baseUpdatedAt: snapshot.saved.updatedAt,
    userAllowlist,
    baseConfig: snapshot.saved.config,
    baseLocale: snapshot.snapshot.baseLocale,
    baseTextPack,
    localeOps: overlay?.baseOps ?? [],
    userOps: overlay?.userOps ?? [],
    published: snapshot.saved.published,
    seoGeoLive: snapshot.saved.seoGeoLive,
  };
}

export function validateUserOps(raw: unknown, allowlist: AllowlistEntry[]): LocalizationOp[] | null {
  const normalized = normalizeLocalizationOps(raw);
  if (!Array.isArray(raw) || normalized.length !== raw.length) return null;
  const filtered = filterAllowlistedOps(normalized, allowlist);
  if (filtered.length !== normalized.length) return null;
  return filtered;
}

export async function writeTokyoBaseSnapshot(args: {
  tokyoBaseUrl: string;
  accessToken: string;
  accountId: string;
  publicId: string;
  baseFingerprint: string;
  baseTextPack: Record<string, string>;
}): Promise<void> {
  const response = await fetch(
    `${args.tokyoBaseUrl.replace(/\/+$/, '')}/l10n/instances/${encodeURIComponent(
      args.publicId,
    )}/bases/${encodeURIComponent(args.baseFingerprint)}?accountId=${encodeURIComponent(args.accountId)}`,
    {
      method: 'POST',
      headers: buildTokyoAccountHeaders({
        accessToken: args.accessToken,
        accountId: args.accountId,
        contentType: 'application/json',
      }),
      cache: 'no-store',
      body: JSON.stringify({
        v: 1,
        publicId: args.publicId,
        baseFingerprint: args.baseFingerprint,
        snapshot: args.baseTextPack,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`tokyo_base_snapshot_http_${response.status}`);
  }
}

export async function upsertTokyoOverlay(args: {
  tokyoBaseUrl: string;
  accessToken: string;
  accountId: string;
  publicId: string;
  layer: 'locale' | 'user';
  layerKey: string;
  baseFingerprint: string;
  baseUpdatedAt: string;
  ops: LocalizationOp[];
  textPack?: Record<string, string> | null;
  metaPack?: Record<string, unknown> | null;
}): Promise<void> {
  const response = await fetch(
    `${args.tokyoBaseUrl.replace(/\/+$/, '')}/l10n/instances/${encodeURIComponent(
      args.publicId,
    )}/${args.layer}/${encodeURIComponent(args.layerKey)}?accountId=${encodeURIComponent(args.accountId)}`,
    {
      method: 'POST',
      headers: buildTokyoAccountHeaders({
        accessToken: args.accessToken,
        accountId: args.accountId,
        contentType: 'application/json',
      }),
      cache: 'no-store',
      body: JSON.stringify({
        v: 1,
        baseFingerprint: args.baseFingerprint,
        baseUpdatedAt: args.baseUpdatedAt,
        ops: args.ops,
        ...(args.textPack ? { textPack: args.textPack } : {}),
        ...(args.metaPack ? { metaPack: args.metaPack } : {}),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`tokyo_overlay_write_http_${response.status}`);
  }
}

export async function deleteTokyoOverlay(args: {
  tokyoBaseUrl: string;
  accessToken: string;
  accountId: string;
  publicId: string;
  layer: 'locale' | 'user';
  layerKey: string;
  baseFingerprint?: string | null;
  textPack?: Record<string, string> | null;
  metaPack?: Record<string, unknown> | null;
}): Promise<void> {
  const body =
    args.textPack || args.metaPack || args.baseFingerprint
      ? JSON.stringify({
          ...(args.baseFingerprint ? { baseFingerprint: args.baseFingerprint } : {}),
          ...(args.textPack ? { textPack: args.textPack } : {}),
          ...(args.metaPack ? { metaPack: args.metaPack } : {}),
        })
      : undefined;
  const response = await fetch(
    `${args.tokyoBaseUrl.replace(/\/+$/, '')}/l10n/instances/${encodeURIComponent(
      args.publicId,
    )}/${args.layer}/${encodeURIComponent(args.layerKey)}?accountId=${encodeURIComponent(args.accountId)}`,
    {
      method: 'DELETE',
      headers: buildTokyoAccountHeaders({
        accessToken: args.accessToken,
        accountId: args.accountId,
        ...(body ? { contentType: 'application/json' } : {}),
      }),
      cache: 'no-store',
      ...(body ? { body } : {}),
    },
  );
  if (!response.ok) {
    throw new Error(`tokyo_overlay_delete_http_${response.status}`);
  }
}

export function buildLocaleMirrorPayload(args: {
  widgetType: string;
  baseConfig: Record<string, unknown>;
  baseLocale: string;
  locale: string;
  baseTextPack: Record<string, string>;
  baseOps: LocalizationOp[];
  userOps: LocalizationOp[];
  seoGeoLive: boolean;
}): { textPack: Record<string, string>; metaPack: Record<string, unknown> | null } {
  const textPack = buildLocalizedTextPack({
    baseLocale: args.baseLocale,
    locale: args.locale,
    basePack: args.baseTextPack,
    baseOps: args.baseOps,
    userOps: args.userOps,
  });
  if (!args.seoGeoLive) {
    return { textPack, metaPack: null };
  }
  const localizedConfig = applyTextPackToConfig(args.baseConfig, textPack);
  return {
    textPack,
    metaPack: generateMetaPack({
      widgetType: args.widgetType,
      state: localizedConfig,
      locale: args.locale,
    }),
  };
}

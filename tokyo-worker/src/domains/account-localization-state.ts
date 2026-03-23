import {
  normalizeWidgetLocaleSwitcherSettings,
  normalizeLocalizationOps,
  parseAccountL10nPolicyStrict,
  parseAccountLocaleListStrict,
  type AccountLocalizationSnapshot,
  type AccountL10nPolicy,
  type AccountOverlayEntry,
  type LocalizationOp,
  type WidgetLocaleSwitcherSettings,
} from '@clickeen/ck-contracts';
import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import { normalizeLocaleToken, type AllowlistEntry } from '@clickeen/l10n';
import { json } from '../http';
import type { Env } from '../types';
import {
  ensureSavedRenderL10nBase,
  l10nLivePointerKey,
  readSavedRenderConfig,
  renderLivePointerKey,
  resolveTokyoPublicBaseUrl,
  type SavedRenderPointer,
} from './render';
import {
  asTrimmedString,
  filterAllowlistedOps,
  isRecord,
  normalizeAllowlistEntries,
  normalizeReadyLocales,
  parseBearerToken,
  resolveTokyoControlErrorDetail,
} from './account-localization-utils';

type LiveRenderPointer = {
  seoGeo?: {
    metaLiveBase?: string;
    metaPacksBase?: string;
  };
};

type TokyoOverlayIndex = {
  v?: unknown;
  layers?: Record<string, { keys?: unknown; geoTargets?: unknown }>;
};

type TokyoL10nLivePointerPayload = {
  publicId?: unknown;
  locale?: unknown;
  textFp?: unknown;
  baseFingerprint?: unknown;
  updatedAt?: unknown;
};

type TokyoLocaleArtifactState = {
  baseFingerprint: string | null;
  updatedAt: string | null;
  hasTextPack: boolean;
};

type AccountLocalizationBaseContext = {
  accountLocales: string[];
  desiredLocales: string[];
  policy: AccountL10nPolicy;
  localizationAllowlist: AllowlistEntry[];
  baseTextPack: Record<string, string>;
  baseFingerprint: string;
  saved: {
    config: Record<string, unknown>;
    widgetType: string;
    updatedAt: string;
    published: boolean;
    seoGeoLive: boolean;
    pointer: SavedRenderPointer;
  };
};

type AccountL10nStatusEntry = {
  locale: string;
  status: 'dirty' | 'succeeded' | 'superseded';
  attempts: number;
  nextAttemptAt: null;
  lastAttemptAt: string | null;
  lastError: null;
};

async function buildAccountLocalizationSnapshotFromBase(args: {
  env: Env;
  publicId: string;
  base: AccountLocalizationBaseContext;
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
  const nonBaseLocales = args.base.desiredLocales.filter(
    (locale) => locale !== args.base.policy.baseLocale,
  );
  const overlayEntries = await Promise.all(
    nonBaseLocales.map(async (locale) => {
      const [baseOverlay, userOverlay] = await Promise.all([
        loadOverlayOps({
          env: args.env,
          publicId: args.publicId,
          layer: 'locale',
          layerKey: locale,
          baseFingerprint: args.base.baseFingerprint,
          allowlist: args.base.localizationAllowlist,
        }),
        loadOverlayOps({
          env: args.env,
          publicId: args.publicId,
          layer: 'user',
          layerKey: locale,
          baseFingerprint: args.base.baseFingerprint,
          allowlist: args.base.localizationAllowlist,
        }),
      ]);
      return {
        locale,
        source:
          userOverlay.ops.length > 0
            ? 'user'
            : baseOverlay.ops.length > 0
              ? 'agent'
              : null,
        baseFingerprint:
          baseOverlay.ops.length > 0 || userOverlay.ops.length > 0
            ? args.base.baseFingerprint
            : null,
        baseUpdatedAt: userOverlay.baseUpdatedAt ?? baseOverlay.baseUpdatedAt,
        hasUserOps: userOverlay.ops.length > 0,
        baseOps: baseOverlay.ops,
        userOps: userOverlay.ops,
      } satisfies AccountOverlayEntry;
    }),
  );

  const readyLocales = await loadTokyoCurrentArtifactReadyLocales({
    env: args.env,
    publicId: args.publicId,
    baseLocale: args.base.policy.baseLocale,
    locales: args.base.desiredLocales,
    baseFingerprint: args.base.baseFingerprint,
  });

  return {
    snapshot: {
      baseLocale: args.base.policy.baseLocale,
      accountLocales: args.base.accountLocales,
      readyLocales,
      invalidAccountLocales: null,
      localeOverlays: overlayEntries,
      policy: args.base.policy,
    },
    widgetType: args.base.saved.widgetType,
    baseFingerprint: args.base.baseFingerprint,
    saved: {
      config: args.base.saved.config,
      updatedAt: args.base.saved.updatedAt,
      published: args.base.saved.published,
      seoGeoLive: args.base.saved.seoGeoLive,
    },
  };
}

async function buildAccountL10nStatusFromBase(args: {
  env: Env;
  publicId: string;
  base: AccountLocalizationBaseContext;
}): Promise<{
  publicId: string;
  widgetType: string;
  baseFingerprint: string;
  baseUpdatedAt: string;
  locales: AccountL10nStatusEntry[];
}> {
  const [index, artifactStates] = await Promise.all([
    loadTokyoIndex({ env: args.env, publicId: args.publicId }),
    loadTokyoLocaleArtifactStates({
      env: args.env,
      publicId: args.publicId,
      locales: args.base.accountLocales,
    }),
  ]);

  return {
    publicId: args.publicId,
    widgetType: args.base.saved.widgetType,
    baseFingerprint: args.base.baseFingerprint,
    baseUpdatedAt: args.base.saved.updatedAt,
    locales: args.base.accountLocales.map((locale) => {
      const artifact = artifactStates.get(locale) ?? null;
      const hasCurrent =
        artifact !== null &&
        artifact.hasTextPack &&
        artifact.baseFingerprint === args.base.baseFingerprint;
      const hasArtifact = artifact !== null && artifact.hasTextPack;
      const hasIndexed =
        index.localeKeys.has(locale) || index.userKeys.has(locale);
      const status: 'dirty' | 'succeeded' | 'superseded' = hasCurrent
        ? 'succeeded'
        : hasArtifact || hasIndexed
          ? 'superseded'
          : 'dirty';
      return {
        locale,
        status,
        attempts: hasCurrent || hasArtifact || hasIndexed ? 1 : 0,
        nextAttemptAt: null,
        lastAttemptAt: artifact?.updatedAt ?? null,
        lastError: null,
      };
    }),
  };
}

function normalizeLiveRenderPointer(raw: unknown): LiveRenderPointer | null {
  if (!isRecord(raw)) return null;
  const seoGeoRaw = raw.seoGeo;
  const seoGeo =
    isRecord(seoGeoRaw) &&
    typeof seoGeoRaw.metaLiveBase === 'string' &&
    typeof seoGeoRaw.metaPacksBase === 'string'
      ? {
          metaLiveBase: seoGeoRaw.metaLiveBase.trim(),
          metaPacksBase: seoGeoRaw.metaPacksBase.trim(),
        }
      : undefined;
  return {
    ...(seoGeo?.metaLiveBase && seoGeo?.metaPacksBase ? { seoGeo } : {}),
  };
}

export async function loadWidgetAllowlist(args: {
  env: Env;
  widgetType: string;
  path: 'localization' | 'user-layer';
}): Promise<AllowlistEntry[]> {
  const baseUrl = resolveTokyoPublicBaseUrl(args.env);
  if (!baseUrl) return [];
  const relative =
    args.path === 'localization'
      ? `/widgets/${encodeURIComponent(args.widgetType)}/localization.json`
      : `/widgets/${encodeURIComponent(args.widgetType)}/layers/user.allowlist.json`;
  const response = await fetch(`${baseUrl}${relative}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  if (response.status === 404) {
    return [];
  }
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(`tokyo_widget_allowlist_http_${response.status}`);
  }
  return normalizeAllowlistEntries(payload);
}

export async function loadBerlinAccountL10nState(args: {
  env: Env;
  accessToken: string;
  accountId: string;
}): Promise<{ accountLocales: string[]; policy: AccountL10nPolicy }> {
  const berlinBaseUrl = String(args.env.BERLIN_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (!berlinBaseUrl) {
    throw new Error('tokyo_berlin_base_missing');
  }

  const response = await fetch(
    `${berlinBaseUrl}/v1/accounts/${encodeURIComponent(args.accountId)}`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${args.accessToken}`,
        accept: 'application/json',
      },
      cache: 'no-store',
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | { account?: { l10nLocales?: unknown; l10nPolicy?: unknown } | null; error?: unknown }
    | null;
  if (!response.ok) {
    throw new Error(
      resolveTokyoControlErrorDetail(
        payload,
        `berlin_account_http_${response.status}`,
      ),
    );
  }

  return {
    accountLocales: parseAccountLocaleListStrict(payload?.account?.l10nLocales),
    policy: parseAccountL10nPolicyStrict(payload?.account?.l10nPolicy),
  };
}

async function loadSavedL10nState(args: {
  env: Env;
  publicId: string;
  accountId: string;
}): Promise<AccountLocalizationBaseContext['saved']> {
  const saved = await readSavedRenderConfig(args);
  if (!saved.ok) {
    throw new Error(saved.kind === 'NOT_FOUND' ? 'tokyo_saved_not_found' : 'tokyo_saved_invalid');
  }

  const livePayload = normalizeLiveRenderPointer(
    await args.env.TOKYO_R2.get(renderLivePointerKey(args.publicId)).then((obj) =>
      obj?.json().catch(() => null),
    ),
  );

  if (!saved.value.pointer.widgetType || !saved.value.pointer.updatedAt) {
    throw new Error('tokyo_saved_invalid');
  }

  return {
    config: saved.value.config,
    widgetType: saved.value.pointer.widgetType,
    updatedAt: saved.value.pointer.updatedAt,
    published: Boolean(livePayload),
    seoGeoLive: Boolean(
      livePayload?.seoGeo?.metaLiveBase && livePayload?.seoGeo?.metaPacksBase,
    ),
    pointer: saved.value.pointer,
  };
}

export async function loadBaseTextPack(args: {
  env: Env;
  publicId: string;
  baseFingerprint: string;
}): Promise<Record<string, string>> {
  const key = `l10n/instances/${args.publicId}/bases/${args.baseFingerprint}.snapshot.json`;
  const obj = await args.env.TOKYO_R2.get(key);
  const payload = (await obj?.json().catch(() => null)) as
    | { snapshot?: unknown }
    | null;
  if (!isRecord(payload?.snapshot)) {
    throw new Error('tokyo_saved_l10n_base_missing');
  }

  const snapshot: Record<string, string> = {};
  for (const [path, value] of Object.entries(payload.snapshot)) {
    const normalizedPath = asTrimmedString(path);
    if (!normalizedPath || typeof value !== 'string') continue;
    snapshot[normalizedPath] = value;
  }
  return snapshot;
}

export async function loadOverlayOps(args: {
  env: Env;
  publicId: string;
  layer: 'locale' | 'user';
  layerKey: string;
  baseFingerprint: string;
  allowlist: AllowlistEntry[];
}): Promise<{ ops: LocalizationOp[]; baseUpdatedAt: string | null }> {
  const key = `l10n/instances/${args.publicId}/${args.layer}/${args.layerKey}/${args.baseFingerprint}.ops.json`;
  const obj = await args.env.TOKYO_R2.get(key);
  if (!obj) {
    return { ops: [], baseUpdatedAt: null };
  }
  const payload = (await obj.json().catch(() => null)) as
    | { ops?: unknown; baseUpdatedAt?: unknown }
    | null;
  return {
    ops: filterAllowlistedOps(
      normalizeLocalizationOps(payload?.ops),
      args.allowlist,
    ),
    baseUpdatedAt: asTrimmedString(payload?.baseUpdatedAt),
  };
}

export async function generateLocaleOpsWithSanfrancisco(args: {
  env: Env;
  policyProfile: RomaAccountAuthzCapsulePayload['profile'];
  widgetType: string;
  config: Record<string, unknown>;
  allowlist: Array<{ path: string; type: 'string' | 'richtext' }>;
  baseLocale: string;
  targetLocales: string[];
  existingBaseOpsByLocale: Record<string, LocalizationOp[]>;
}): Promise<Map<string, LocalizationOp[]>> {
  if (!args.targetLocales.length) return new Map();

  const sanfranciscoBaseUrl = String(args.env.SANFRANCISCO_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (!sanfranciscoBaseUrl) {
    throw new Error('tokyo_sanfrancisco_base_missing');
  }
  const token = String(args.env.CK_INTERNAL_SERVICE_JWT || '').trim();
  if (!token) {
    throw new Error('tokyo_internal_service_jwt_missing');
  }

  const response = await fetch(
    `${sanfranciscoBaseUrl}/v1/l10n/account/ops/generate`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        accept: 'application/json',
        'cache-control': 'no-store',
      },
      cache: 'no-store',
      body: JSON.stringify({
        policyProfile: args.policyProfile,
        widgetType: args.widgetType,
        config: args.config,
        allowlist: args.allowlist,
        baseLocale: args.baseLocale,
        targetLocales: args.targetLocales,
        existingBaseOpsByLocale: args.existingBaseOpsByLocale,
      }),
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | {
        results?: unknown;
        error?: { message?: unknown; detail?: unknown };
      }
    | null;

  if (!response.ok) {
    const detail =
      typeof payload?.error?.detail === 'string'
        ? payload.error.detail
        : typeof payload?.error?.message === 'string'
          ? payload.error.message
          : `sanfrancisco_l10n_http_${response.status}`;
    throw new Error(detail);
  }

  const out = new Map<string, LocalizationOp[]>();
  if (!Array.isArray(payload?.results)) return out;

  for (const entry of payload.results) {
    if (!isRecord(entry)) continue;
    const locale = normalizeLocaleToken(entry.locale);
    if (!locale) continue;
    if (typeof entry.error === 'string' && entry.error.trim()) continue;
    out.set(locale, normalizeLocalizationOps(entry.ops));
  }

  return out;
}

async function loadTokyoIndex(args: {
  env: Env;
  publicId: string;
}): Promise<{
  localeKeys: Set<string>;
  userKeys: Set<string>;
}> {
  const payload =
    (await args.env.TOKYO_R2.get(`l10n/instances/${args.publicId}/index.json`)) ??
    null;
  const jsonPayload = (await payload?.json().catch(() => null)) as TokyoOverlayIndex | null;
  if (!isRecord(jsonPayload?.layers)) {
    return { localeKeys: new Set(), userKeys: new Set() };
  }

  const normalizeKeys = (value: unknown, allowGlobal = false) =>
    new Set(
      (Array.isArray(value) ? value : [])
        .map((entry) => {
          const normalized = normalizeLocaleToken(entry);
          if (normalized) return normalized;
          if (allowGlobal && String(entry || '').trim().toLowerCase() === 'global') {
            return 'global';
          }
          return null;
        })
        .filter((entry): entry is string => Boolean(entry)),
    );

  return {
    localeKeys: normalizeKeys(jsonPayload.layers?.locale?.keys),
    userKeys: normalizeKeys(jsonPayload.layers?.user?.keys, true),
  };
}

async function loadTokyoLocaleArtifactStates(args: {
  env: Env;
  publicId: string;
  locales: string[];
}): Promise<Map<string, TokyoLocaleArtifactState | null>> {
  const locales = Array.from(
    new Set(
      args.locales
        .map((entry) => normalizeLocaleToken(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );

  const states = await Promise.all(
    locales.map(async (locale) => {
      const payload = (await args.env.TOKYO_R2.get(
        l10nLivePointerKey(args.publicId, locale),
      )) ?? null;
      const jsonPayload = (await payload?.json().catch(() => null)) as TokyoL10nLivePointerPayload | null;
      if (!jsonPayload) return [locale, null] as const;
      const baseFingerprint =
        typeof jsonPayload.baseFingerprint === 'string' &&
        /^[a-f0-9]{64}$/i.test(jsonPayload.baseFingerprint.trim())
          ? jsonPayload.baseFingerprint.trim()
          : null;
      const textFp =
        typeof jsonPayload.textFp === 'string' &&
        /^[a-f0-9]{64}$/i.test(jsonPayload.textFp.trim())
          ? jsonPayload.textFp.trim()
          : null;
      const updatedAt = asTrimmedString(jsonPayload.updatedAt);
      return [
        locale,
        {
          baseFingerprint,
          updatedAt,
          hasTextPack: Boolean(textFp),
        },
      ] as const;
    }),
  );

  return new Map(states);
}

async function loadTokyoCurrentArtifactReadyLocales(args: {
  env: Env;
  publicId: string;
  baseLocale: string;
  locales: string[];
  baseFingerprint: string;
}): Promise<string[]> {
  const states = await loadTokyoLocaleArtifactStates({
    env: args.env,
    publicId: args.publicId,
    locales: Array.from(new Set([args.baseLocale, ...args.locales])),
  });

  return Array.from(
    new Set(
      [args.baseLocale, ...args.locales].filter((locale) => {
        const normalized = normalizeLocaleToken(locale);
        if (!normalized) return false;
        if (normalized === args.baseLocale) return true;
        const state = states.get(normalized) ?? null;
        return (
          state !== null &&
          state.hasTextPack &&
          state.baseFingerprint === args.baseFingerprint
        );
      }),
    ),
  );
}

async function loadAccountLocalizationBaseContext(args: {
  env: Env;
  accessToken: string;
  accountId: string;
  publicId: string;
}): Promise<AccountLocalizationBaseContext> {
  const [{ accountLocales, policy }, saved] = await Promise.all([
    loadBerlinAccountL10nState({
      env: args.env,
      accessToken: args.accessToken,
      accountId: args.accountId,
    }),
    loadSavedL10nState({
      env: args.env,
      publicId: args.publicId,
      accountId: args.accountId,
    }),
  ]);

  const desiredLocales = Array.from(new Set([policy.baseLocale, ...accountLocales]));
  const l10nBase = await ensureSavedRenderL10nBase({
    env: args.env,
    publicId: args.publicId,
    widgetType: saved.widgetType,
    config: saved.config,
    existingBaseFingerprint: saved.pointer.l10n?.baseFingerprint ?? null,
  });

  return {
    accountLocales,
    desiredLocales,
    policy,
    localizationAllowlist: l10nBase.allowlist,
    baseTextPack: l10nBase.snapshot,
    baseFingerprint: l10nBase.baseFingerprint,
    saved,
  };
}

export async function loadAccountLocalizationSnapshotData(args: {
  env: Env;
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
  const base = await loadAccountLocalizationBaseContext(args);
  return buildAccountLocalizationSnapshotFromBase({
    env: args.env,
    publicId: args.publicId,
    base,
  });
}

export async function handleGetAccountLocalizationSnapshot(
  req: Request,
  env: Env,
  publicId: string,
  accountId: string,
): Promise<Response> {
  const accessToken = parseBearerToken(req.headers.get('authorization'));
  if (!accessToken) {
    return json(
      { error: { kind: 'DENY', reasonKey: 'AUTH_REQUIRED' } },
      { status: 401 },
    );
  }

  const result = await loadAccountLocalizationSnapshotData({
    env,
    accessToken,
    accountId,
    publicId,
  });
  return json(result);
}

export async function handleGetAccountL10nStatus(
  req: Request,
  env: Env,
  publicId: string,
  accountId: string,
): Promise<Response> {
  const accessToken = parseBearerToken(req.headers.get('authorization'));
  if (!accessToken) {
    return json(
      { error: { kind: 'DENY', reasonKey: 'AUTH_REQUIRED' } },
      { status: 401 },
    );
  }

  const result = await loadAccountL10nStatusData({
    env,
    accessToken,
    accountId,
    publicId,
  });
  return json(result);
}

export async function loadAccountL10nStatusData(args: {
  env: Env;
  accessToken: string;
  accountId: string;
  publicId: string;
}): Promise<{
  publicId: string;
  widgetType: string;
  baseFingerprint: string;
  baseUpdatedAt: string;
  locales: AccountL10nStatusEntry[];
}> {
  const base = await loadAccountLocalizationBaseContext({
    env: args.env,
    accessToken: args.accessToken,
    accountId: args.accountId,
    publicId: args.publicId,
  });
  return buildAccountL10nStatusFromBase({
    env: args.env,
    publicId: args.publicId,
    base,
  });
}

export async function loadAccountTranslationsPanelData(args: {
  env: Env;
  accessToken: string;
  accountId: string;
  publicId: string;
  locale?: string | null;
}): Promise<{
  publicId: string;
  widgetType: string;
  baseLocale: string;
  activeLocales: string[];
  inspectionLocale: string;
  localeStatuses: Array<{
    locale: string;
    ok: boolean;
  }>;
  localeBehavior: WidgetLocaleSwitcherSettings;
}> {
  const base = await loadAccountLocalizationBaseContext({
    env: args.env,
    accessToken: args.accessToken,
    accountId: args.accountId,
    publicId: args.publicId,
  });
  const statusData = await buildAccountL10nStatusFromBase({
    env: args.env,
    publicId: args.publicId,
    base,
  });

  const activeLocales = base.desiredLocales;
  const requestedLocale = normalizeLocaleToken(args.locale);
  const inspectionLocale =
    requestedLocale && activeLocales.includes(requestedLocale)
      ? requestedLocale
      : base.policy.baseLocale;
  const localeStatusByLocale = new Map(
    statusData.locales.map((entry) => [entry.locale, entry.status] as const),
  );
  const localeBehavior = normalizeWidgetLocaleSwitcherSettings(base.saved.config.localeSwitcher);

  return {
    publicId: args.publicId,
    widgetType: base.saved.widgetType,
    baseLocale: base.policy.baseLocale,
    activeLocales,
    inspectionLocale,
    localeStatuses: activeLocales.map((locale) => {
      if (locale === base.policy.baseLocale) {
        return { locale, ok: true };
      }
      return {
        locale,
        ok: localeStatusByLocale.get(locale) === 'succeeded',
      };
    }),
    localeBehavior,
  };
}

export async function handleGetAccountTranslationsPanel(
  req: Request,
  env: Env,
  publicId: string,
  accountId: string,
): Promise<Response> {
  const accessToken = parseBearerToken(req.headers.get('authorization'));
  if (!accessToken) {
    return json(
      { error: { kind: 'DENY', reasonKey: 'AUTH_REQUIRED' } },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const result = await loadAccountTranslationsPanelData({
    env,
    accessToken,
    accountId,
    publicId,
    locale: url.searchParams.get('locale'),
  });
  return json(result);
}

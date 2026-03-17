import { buildL10nSnapshot } from '@clickeen/l10n';
import type { PolicyProfile } from '@clickeen/ck-policy';
import {
  buildLocaleMirrorPayload,
  loadAccountLocalizationSnapshot,
  loadTokyoCurrentArtifactReadyLocales,
  loadTokyoAllowlist,
  upsertTokyoOverlay,
  writeTokyoBaseSnapshot,
  type LocalizationOp,
} from './account-l10n';
import { materializeRuntimeConfigMedia } from './account-asset-runtime';
import { resolveBerlinBaseUrl } from './env/berlin';
import {
  resolveSanfranciscoBaseUrl,
  resolveSanfranciscoInternalToken,
} from './env/sanfrancisco';
import { resolveTokyoBaseUrl } from './env/tokyo';

type LocalePolicy = {
  baseLocale: string;
  readyLocales: string[];
  ip: {
    enabled: boolean;
    countryToLocale: Record<string, string>;
  };
  switcher: {
    enabled: boolean;
    locales?: string[];
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeReadyLocales(args: {
  baseLocale: string;
  readyLocales: string[];
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (locale: string) => {
    const normalized = String(locale || '').trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };

  push(args.baseLocale);
  args.readyLocales.forEach(push);
  return out;
}

function normalizeOps(raw: unknown): LocalizationOp[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => isRecord(entry) && entry.op === 'set')
    .map((entry) => ({
      op: 'set' as const,
      path: typeof entry.path === 'string' ? entry.path : '',
      value: typeof entry.value === 'string' ? entry.value : '',
    }))
    .filter((entry) => entry.path);
}

function diffTextPacks(args: {
  previous: Record<string, string> | null;
  next: Record<string, string>;
}): { changedPaths: string[]; removedPaths: string[] } {
  if (!args.previous) {
    return {
      changedPaths: Object.keys(args.next).sort(),
      removedPaths: [],
    };
  }

  const changedPaths: string[] = [];
  const removedPaths: string[] = [];

  for (const [path, value] of Object.entries(args.next)) {
    if (args.previous[path] !== value) changedPaths.push(path);
  }
  for (const path of Object.keys(args.previous)) {
    if (!(path in args.next)) removedPaths.push(path);
  }

  changedPaths.sort();
  removedPaths.sort();
  return { changedPaths, removedPaths };
}

function buildLiveLocalePolicy(args: {
  baseLocale: string;
  readyLocales: string[];
  policy: {
    ip: { enabled: boolean; countryToLocale: Record<string, string> };
    switcher: { enabled: boolean; locales?: string[] };
  };
}): LocalePolicy {
  const readySet = new Set(args.readyLocales);
  const countryToLocale = Object.fromEntries(
    Object.entries(args.policy.ip.countryToLocale || {}).filter(([, locale]) =>
      readySet.has(locale),
    ),
  );
  const switcherLocales = (args.policy.switcher.locales || []).filter((locale) =>
    readySet.has(locale),
  );

  return {
    baseLocale: args.baseLocale,
    readyLocales: args.readyLocales,
    ip: {
      enabled: args.policy.ip.enabled === true,
      countryToLocale,
    },
    switcher: {
      enabled: args.policy.switcher.enabled !== false,
      ...(switcherLocales.length ? { locales: switcherLocales } : {}),
    },
  };
}

function buildTokyoAccountHeaders(args: {
  accessToken: string;
  accountId: string;
  accountCapsule?: string | null;
  contentType?: string;
}): Headers {
  const headers = new Headers({
    accept: 'application/json',
    authorization: `Bearer ${args.accessToken}`,
    'x-account-id': args.accountId,
  });
  if (args.accountCapsule) headers.set('x-ck-authz-capsule', args.accountCapsule);
  if (args.contentType) headers.set('content-type', args.contentType);
  return headers;
}

async function writeTokyoConfigPack(args: {
  tokyoBaseUrl: string;
  accessToken: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
  widgetType: string;
  configPack: Record<string, unknown>;
}): Promise<string> {
  const response = await fetch(
    `${args.tokyoBaseUrl.replace(/\/+$/, '')}/renders/instances/${encodeURIComponent(
      args.publicId,
    )}/config-pack?accountId=${encodeURIComponent(args.accountId)}`,
    {
      method: 'POST',
      headers: buildTokyoAccountHeaders({
        accessToken: args.accessToken,
        accountId: args.accountId,
        accountCapsule: args.accountCapsule,
        contentType: 'application/json',
      }),
      cache: 'no-store',
      body: JSON.stringify({
        widgetType: args.widgetType,
        configPack: args.configPack,
      }),
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | { configFp?: unknown; error?: { detail?: unknown; reasonKey?: unknown } }
    | null;

  if (!response.ok) {
    const detail =
      typeof payload?.error?.detail === 'string'
        ? payload.error.detail
        : typeof payload?.error?.reasonKey === 'string'
          ? payload.error.reasonKey
          : `tokyo_config_pack_http_${response.status}`;
    throw new Error(detail);
  }

  const configFp = typeof payload?.configFp === 'string' ? payload.configFp.trim() : '';
  if (!configFp) {
    throw new Error('tokyo_config_pack_missing_fp');
  }
  return configFp;
}

async function syncTokyoLivePointer(args: {
  tokyoBaseUrl: string;
  accessToken: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
  widgetType: string;
  configFp: string;
  localePolicy: LocalePolicy;
  seoGeo: boolean;
}): Promise<void> {
  const response = await fetch(
    `${args.tokyoBaseUrl.replace(/\/+$/, '')}/renders/instances/${encodeURIComponent(
      args.publicId,
    )}/live/r.json?accountId=${encodeURIComponent(args.accountId)}`,
    {
      method: 'POST',
      headers: buildTokyoAccountHeaders({
        accessToken: args.accessToken,
        accountId: args.accountId,
        accountCapsule: args.accountCapsule,
        contentType: 'application/json',
      }),
      cache: 'no-store',
      body: JSON.stringify({
        widgetType: args.widgetType,
        configFp: args.configFp,
        localePolicy: args.localePolicy,
        seoGeo: args.seoGeo,
      }),
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | { error?: { detail?: unknown; reasonKey?: unknown } }
    | null;
  if (!response.ok) {
    const detail =
      typeof payload?.error?.detail === 'string'
        ? payload.error.detail
        : typeof payload?.error?.reasonKey === 'string'
          ? payload.error.reasonKey
          : `tokyo_live_sync_http_${response.status}`;
    throw new Error(detail);
  }
}

async function generateLocaleOpsWithSanfrancisco(args: {
  policyProfile: PolicyProfile;
  widgetType: string;
  config: Record<string, unknown>;
  allowlist: Array<{ path: string; type: 'string' | 'richtext' }>;
  baseLocale: string;
  targetLocales: string[];
  existingBaseOpsByLocale: Record<string, LocalizationOp[]>;
  changedPaths: string[] | null;
  removedPaths: string[];
}): Promise<Map<string, LocalizationOp[]>> {
  if (!args.targetLocales.length) return new Map();

  const response = await fetch(
    `${resolveSanfranciscoBaseUrl().replace(/\/+$/, '')}/v1/l10n/account/ops/generate`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${resolveSanfranciscoInternalToken()}`,
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
        ...(args.changedPaths !== null ? { changedPaths: args.changedPaths } : {}),
        removedPaths: args.removedPaths,
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
    const locale =
      typeof entry.locale === 'string' ? entry.locale.trim().toLowerCase() : '';
    if (!locale) continue;
    if (typeof entry.error === 'string' && entry.error.trim()) continue;
    out.set(locale, normalizeOps(entry.ops));
  }

  return out;
}

export async function runAccountSaveAftermath(args: {
  accessToken: string;
  accountId: string;
  publicId: string;
  policyProfile: PolicyProfile;
  accountCapsule?: string | null;
  previousConfig?: Record<string, unknown> | null;
}): Promise<void> {
  const tokyoBaseUrl = resolveTokyoBaseUrl();
  const result = await loadAccountLocalizationSnapshot({
    berlinBaseUrl: resolveBerlinBaseUrl(),
    tokyoBaseUrl,
    accessToken: args.accessToken,
    accountId: args.accountId,
    publicId: args.publicId,
    accountCapsule: args.accountCapsule,
  });

  const localizationAllowlist = await loadTokyoAllowlist({
    tokyoBaseUrl,
    widgetType: result.widgetType,
    path: 'localization',
  });
  const baseTextPack = buildL10nSnapshot(result.saved.config, localizationAllowlist);

  await writeTokyoBaseSnapshot({
    tokyoBaseUrl,
    accessToken: args.accessToken,
    accountId: args.accountId,
    publicId: args.publicId,
    accountCapsule: args.accountCapsule,
    baseFingerprint: result.baseFingerprint,
    baseTextPack,
  });

  const baseLocale = result.snapshot.baseLocale;
  const desiredLocales = normalizeReadyLocales({
    baseLocale,
    readyLocales: result.snapshot.accountLocales,
  });
  const localeOverlays = new Map(
    result.snapshot.localeOverlays.map((entry) => [entry.locale, entry]),
  );

  const previousConfig = isRecord(args.previousConfig)
    ? (args.previousConfig as Record<string, unknown>)
    : null;
  const previousBaseTextPack = previousConfig
    ? buildL10nSnapshot(previousConfig, localizationAllowlist)
    : null;
  const diff = diffTextPacks({ previous: previousBaseTextPack, next: baseTextPack });
  const shouldGenerate =
    previousBaseTextPack === null ||
    diff.changedPaths.length > 0 ||
    diff.removedPaths.length > 0;

  const targetLocales = desiredLocales.filter((locale) => locale !== baseLocale);
  let generatedBaseOpsByLocale = new Map<string, LocalizationOp[]>();

  if (targetLocales.length > 0 && shouldGenerate) {
    const existingBaseOpsByLocale = Object.fromEntries(
      targetLocales.map((locale) => [locale, localeOverlays.get(locale)?.baseOps ?? []]),
    ) as Record<string, LocalizationOp[]>;

    generatedBaseOpsByLocale = await generateLocaleOpsWithSanfrancisco({
      policyProfile: args.policyProfile,
      widgetType: result.widgetType,
      config: result.saved.config,
      allowlist: localizationAllowlist.map((entry) => ({
        path: entry.path,
        type: entry.type === 'richtext' ? 'richtext' : 'string',
      })),
      baseLocale,
      targetLocales,
      existingBaseOpsByLocale,
      changedPaths: previousBaseTextPack ? diff.changedPaths : null,
      removedPaths: diff.removedPaths,
    });
  }

  for (const locale of desiredLocales) {
    const overlay = localeOverlays.get(locale);
    const baseOps =
      locale === baseLocale
        ? []
        : generatedBaseOpsByLocale.get(locale) ?? overlay?.baseOps ?? [];
    const userOps = locale === baseLocale ? [] : (overlay?.userOps ?? []);

    const mirror = buildLocaleMirrorPayload({
      widgetType: result.widgetType,
      baseConfig: result.saved.config,
      baseLocale,
      locale,
      baseTextPack,
      baseOps,
      userOps,
      seoGeoLive: result.saved.seoGeoLive,
    });

    await upsertTokyoOverlay({
      tokyoBaseUrl,
      accessToken: args.accessToken,
      accountId: args.accountId,
      publicId: args.publicId,
      accountCapsule: args.accountCapsule,
      layer: 'locale',
      layerKey: locale,
      baseFingerprint: result.baseFingerprint,
      baseUpdatedAt: result.saved.updatedAt,
      ops: baseOps,
      textPack: mirror.textPack,
      ...(mirror.metaPack ? { metaPack: mirror.metaPack } : {}),
    });
  }

  if (!result.saved.published) {
    return;
  }

  const readyLocales = await loadTokyoCurrentArtifactReadyLocales({
    tokyoBaseUrl,
    publicId: args.publicId,
    baseLocale,
    locales: desiredLocales,
    baseFingerprint: result.baseFingerprint,
  });
  const runtimeConfigPack = await materializeRuntimeConfigMedia({
    tokyoBaseUrl,
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    config: result.saved.config,
  });
  const configFp = await writeTokyoConfigPack({
    tokyoBaseUrl,
    accessToken: args.accessToken,
    accountId: args.accountId,
    publicId: args.publicId,
    accountCapsule: args.accountCapsule,
    widgetType: result.widgetType,
    configPack: runtimeConfigPack,
  });

  const localePolicy = buildLiveLocalePolicy({
    baseLocale,
    readyLocales,
    policy: result.snapshot.policy,
  });

  await syncTokyoLivePointer({
    tokyoBaseUrl,
    accessToken: args.accessToken,
    accountId: args.accountId,
    publicId: args.publicId,
    accountCapsule: args.accountCapsule,
    widgetType: result.widgetType,
    configFp,
    localePolicy,
    seoGeo: result.saved.seoGeoLive,
  });
}

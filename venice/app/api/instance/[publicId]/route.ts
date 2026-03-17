import {
  buildL10nSnapshot,
  computeBaseFingerprint,
  normalizeLocaleToken,
} from '@clickeen/l10n';
import { NextResponse } from 'next/server';
import { resolvePolicy } from '../../../../../packages/ck-policy/src/policy';
import { tokyoFetch } from '@venice/lib/tokyo';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const BASE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
} as const;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: BASE_HEADERS });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function ckError(kind: string, reasonKey: string, status: number, detail?: string) {
  return json(
    {
      error: {
        kind,
        reasonKey,
        ...(detail ? { detail } : {}),
      },
    },
    status,
  );
}

function readConfigPack(payload: unknown): Record<string, unknown> | null {
  const record = asRecord(payload);
  if (!record) return null;
  const config = asRecord(record.config);
  if (config) {
    return config;
  }
  const state = asRecord(record.state);
  if (state) {
    return state;
  }
  return record;
}

type LocalePolicyPayload = {
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

type TextPointerPayload = {
  textFp?: unknown;
  baseFingerprint?: unknown;
  updatedAt?: unknown;
};

type TextPackPayload = Record<string, unknown>;

type LocalizationOp = {
  op: 'set';
  path: string;
  value: string;
};

type PublicLocalizationSnapshot = {
  baseLocale: string;
  accountLocales: string[];
  readyLocales: string[];
  invalidAccountLocales: null;
  localeOverlays: Array<{
    locale: string;
    source: string | null;
    baseFingerprint: string | null;
    baseUpdatedAt: string | null;
    hasUserOps: boolean;
    baseOps: LocalizationOp[];
    userOps: LocalizationOp[];
  }>;
  policy: {
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
};

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeLocalePolicy(raw: unknown): LocalePolicyPayload | null {
  const record = asRecord(raw);
  if (!record) return null;
  const baseLocale = normalizeLocaleToken(record.baseLocale) ?? 'en';
  const readyLocalesRaw = Array.isArray(record.readyLocales) ? record.readyLocales : [];
  const readyLocales = Array.from(
    new Set(
      [baseLocale, ...readyLocalesRaw]
        .map((entry) => normalizeLocaleToken(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );

  const ipRecord = asRecord(record.ip);
  const switcherRecord = asRecord(record.switcher);
  const countryToLocale: Record<string, string> = {};
  const rawCountryMap = asRecord(ipRecord?.countryToLocale);
  if (rawCountryMap) {
    for (const [countryRaw, localeRaw] of Object.entries(rawCountryMap)) {
      const country = String(countryRaw || '').trim().toUpperCase();
      const locale = normalizeLocaleToken(localeRaw);
      if (!/^[A-Z]{2}$/.test(country) || !locale) continue;
      countryToLocale[country] = locale;
    }
  }
  const switcherLocalesRaw = Array.isArray(switcherRecord?.locales) ? switcherRecord.locales : [];
  const switcherLocales = Array.from(
    new Set(
      switcherLocalesRaw
        .map((entry) => normalizeLocaleToken(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );

  return {
    baseLocale,
    readyLocales,
    ip: {
      enabled: ipRecord?.enabled === true,
      countryToLocale,
    },
    switcher: {
      enabled: switcherRecord?.enabled === true,
      ...(switcherLocales.length ? { locales: switcherLocales } : {}),
    },
  };
}

function readTextPack(payload: unknown): Record<string, string> | null {
  const record = asRecord(payload);
  if (!record) return null;
  const out: Record<string, string> = {};
  for (const [path, value] of Object.entries(record)) {
    const normalizedPath = String(path || '').trim();
    if (!normalizedPath || typeof value !== 'string') return null;
    out[normalizedPath] = value;
  }
  return out;
}

function buildBaseOpsFromTextPack(textPack: Record<string, string>): LocalizationOp[] {
  return Object.entries(textPack)
    .map(([path, value]) => ({ op: 'set' as const, path, value }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

async function loadPublicLocalizationSnapshot(args: {
  publicId: string;
  widgetType: string;
  config: Record<string, unknown>;
  localePolicyRaw: unknown;
}): Promise<PublicLocalizationSnapshot> {
  const localePolicy = normalizeLocalePolicy(args.localePolicyRaw);
  const baseLocale = localePolicy?.baseLocale ?? 'en';

  const allowlistRes = await tokyoFetch(
    `/widgets/${encodeURIComponent(args.widgetType)}/localization.json`,
    {
      method: 'GET',
      cache: 'no-store',
    },
  );
  const allowlistJson = (await allowlistRes.json().catch(() => null)) as
    | { paths?: unknown }
    | null;
  const allowlist = Array.isArray(allowlistJson?.paths)
    ? allowlistJson.paths.reduce<Array<{ path: string; type: 'string' | 'richtext' }>>(
        (entries, entry) => {
          const record = asRecord(entry);
          const path = asTrimmedString(record?.path);
          if (!path) return entries;
          entries.push({
            path,
            type: record?.type === 'richtext' ? 'richtext' : 'string',
          });
          return entries;
        },
        [],
      )
    : [];
  const baseFingerprint = await computeBaseFingerprint(buildL10nSnapshot(args.config, allowlist));
  const readyLocales = localePolicy?.readyLocales.length
    ? localePolicy.readyLocales
    : [baseLocale];
  const nonBaseReadyLocales = readyLocales.filter((locale) => locale !== baseLocale);

  const overlayEntries = await Promise.all(
    nonBaseReadyLocales.map(async (locale) => {
      const pointerRes = await tokyoFetch(
        `/l10n/instances/${encodeURIComponent(args.publicId)}/live/${encodeURIComponent(locale)}.json`,
        {
          method: 'GET',
          cache: 'no-store',
        },
      );
      const pointerJson = (await pointerRes.json().catch(() => null)) as TextPointerPayload | null;
      const textFp = asTrimmedString(pointerJson?.textFp);
      const pointerBaseFingerprint = asTrimmedString(pointerJson?.baseFingerprint);
      if (!pointerRes.ok || !textFp || pointerBaseFingerprint !== baseFingerprint) {
        throw new Error(`live_locale_pointer_invalid:${locale}`);
      }

      const textRes = await tokyoFetch(
        `/l10n/instances/${encodeURIComponent(args.publicId)}/packs/${encodeURIComponent(
          locale,
        )}/${encodeURIComponent(textFp)}.json`,
        {
          method: 'GET',
          cache: 'force-cache',
        },
      );
      const textJson = (await textRes.json().catch(() => null)) as TextPackPayload | null;
      const textPack = readTextPack(textJson);
      if (!textRes.ok || !textPack) {
        throw new Error(`live_text_pack_invalid:${locale}`);
      }

      return {
        locale,
        source: 'agent',
        baseFingerprint,
        baseUpdatedAt: asTrimmedString(pointerJson?.updatedAt),
        hasUserOps: false,
        baseOps: buildBaseOpsFromTextPack(textPack),
        userOps: [],
      };
    }),
  );

  const filteredCountryMap = Object.fromEntries(
    Object.entries(localePolicy?.ip.countryToLocale ?? {}).filter(([, locale]) =>
      readyLocales.includes(locale),
    ),
  );
  const switcherLocales = readyLocales.filter((locale) => locale !== baseLocale);

  return {
    baseLocale,
    accountLocales: switcherLocales,
    readyLocales,
    invalidAccountLocales: null,
    localeOverlays: overlayEntries,
    policy: {
      v: 1,
      baseLocale,
      ip: {
        enabled: localePolicy?.ip.enabled === true,
        countryToLocale: filteredCountryMap,
      },
      switcher: {
        enabled: true,
        ...(switcherLocales.length ? { locales: switcherLocales } : {}),
      },
    },
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: BASE_HEADERS });
}

export async function GET(_req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const { publicId: rawPublicId } = await ctx.params;
  const publicId = String(rawPublicId || '').trim();
  if (!publicId) {
    return ckError('VALIDATION', 'coreui.errors.instance.notFound', 404);
  }

  const pointerRes = await tokyoFetch(`/renders/instances/${encodeURIComponent(publicId)}/live/r.json`, {
    method: 'GET',
    cache: 'no-store',
  });
  if (pointerRes.status === 404) {
    return ckError('NOT_FOUND', 'coreui.errors.instance.notFound', 404);
  }
  if (!pointerRes.ok) {
    return ckError('INTERNAL', 'coreui.errors.internal.serverError', 502, `tokyo_live_pointer_${pointerRes.status}`);
  }

  const pointer = (await pointerRes.json().catch(() => null)) as Record<string, unknown> | null;
  const widgetType = typeof pointer?.widgetType === 'string' ? pointer.widgetType.trim() : '';
  const configFp = typeof pointer?.configFp === 'string' ? pointer.configFp.trim() : '';
  if (!widgetType || !configFp) {
    return ckError('INTERNAL', 'coreui.errors.internal.serverError', 500, 'live_pointer_invalid');
  }

  const configRes = await tokyoFetch(
    `/renders/instances/${encodeURIComponent(publicId)}/config/${encodeURIComponent(configFp)}/config.json`,
    {
      method: 'GET',
      cache: 'force-cache',
    },
  );
  if (configRes.status === 404) {
    return ckError('INTERNAL', 'coreui.errors.db.readFailed', 500, 'live_config_missing');
  }
  if (!configRes.ok) {
    return ckError('INTERNAL', 'coreui.errors.internal.serverError', 502, `tokyo_config_pack_${configRes.status}`);
  }

  const configPayload = await configRes.json().catch(() => null);
  const config = readConfigPack(configPayload);
  if (!config) {
    return ckError('INTERNAL', 'coreui.errors.payload.invalid', 500, 'live_config_invalid');
  }

  let localization: PublicLocalizationSnapshot;
  try {
    localization = await loadPublicLocalizationSnapshot({
      publicId,
      widgetType,
      config,
      localePolicyRaw: pointer?.localePolicy,
    });
  } catch (error) {
    return ckError(
      'INTERNAL',
      'coreui.errors.internal.serverError',
      500,
      error instanceof Error ? error.message : String(error),
    );
  }

  const baseFingerprint = await computeBaseFingerprint(config);
  return json({
    publicId,
    displayName: publicId,
    status: 'published',
    widgetType,
    config,
    baseFingerprint,
    localePolicy: localization.policy,
    localization,
    policy: resolvePolicy({ profile: 'minibob', role: 'editor' }),
  });
}

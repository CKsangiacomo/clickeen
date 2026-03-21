import type { AccountLocalizationSnapshot } from '@clickeen/ck-contracts';
import localesJson from '@clickeen/l10n/locales.json';
import { normalizeCanonicalLocalesFile, resolveLocaleLabel } from '@clickeen/l10n';
import { resolvePolicy } from '@clickeen/ck-policy';
import { buildL10nSnapshot, computeBaseFingerprint } from '@clickeen/l10n';
import { json } from '../http';
import type { Env } from '../types';
import {
  type LocalePolicy,
  l10nLivePointerKey,
  l10nTextPackKey,
  loadWidgetLocalizationAllowlist,
  normalizeLiveRenderPointer,
  normalizeLocalePolicy,
  normalizeTextPointer,
  renderConfigPackKey,
  renderLivePointerKey,
} from './render';

type TextPointerPayload = {
  v?: unknown;
  publicId?: unknown;
  locale?: unknown;
  textFp?: unknown;
  baseFingerprint?: unknown;
  updatedAt?: unknown;
};

type PublicInstancePayload = {
  publicId: string;
  displayName: string;
  status: 'published';
  widgetType: string;
  config: Record<string, unknown>;
  baseFingerprint: string;
  localePolicy: LocalePolicy;
  localeLabels: Record<string, string>;
  localization: AccountLocalizationSnapshot;
  policy: ReturnType<typeof resolvePolicy>;
};

const CANONICAL_LOCALES = normalizeCanonicalLocalesFile(localesJson);

type LocalizationOp = {
  op: 'set';
  path: string;
  value: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readConfigPack(payload: unknown): Record<string, unknown> | null {
  const record = asRecord(payload);
  if (!record) return null;
  const config = asRecord(record.config);
  if (config) return config;
  const state = asRecord(record.state);
  if (state) return state;
  return record;
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

async function loadJson<T>(env: Env, key: string): Promise<T | null> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return null;
  return ((await obj.json().catch(() => null)) as T | null) ?? null;
}

function ckError(kind: string, reasonKey: string, status: number, detail?: string): Response {
  return json(
    {
      error: {
        kind,
        reasonKey,
        ...(detail ? { detail } : {}),
      },
    },
    { status },
  );
}

async function loadPublicLocalizationSnapshot(args: {
  env: Env;
  publicId: string;
  widgetType: string;
  config: Record<string, unknown>;
  localePolicyRaw: unknown;
}): Promise<{
  baseFingerprint: string;
  localePolicy: LocalePolicy;
  localization: AccountLocalizationSnapshot;
}> {
  const localePolicy = normalizeLocalePolicy(args.localePolicyRaw);
  if (!localePolicy) {
    throw new Error('live_locale_policy_invalid');
  }

  const allowlist = await loadWidgetLocalizationAllowlist({
    env: args.env,
    widgetType: args.widgetType,
  });
  const baseFingerprint = await computeBaseFingerprint(buildL10nSnapshot(args.config, allowlist));
  const readyLocales = localePolicy.readyLocales.length
    ? localePolicy.readyLocales
    : [localePolicy.baseLocale];
  const nonBaseReadyLocales = readyLocales.filter((locale) => locale !== localePolicy.baseLocale);

  const overlayEntries = await Promise.all(
    nonBaseReadyLocales.map(async (locale) => {
      const pointer = normalizeTextPointer(
        await loadJson<TextPointerPayload>(args.env, l10nLivePointerKey(args.publicId, locale)),
      );
      if (!pointer || !pointer.textFp || pointer.baseFingerprint !== baseFingerprint) {
        throw new Error(`live_locale_pointer_invalid:${locale}`);
      }

      const textPack = readTextPack(
        await loadJson<Record<string, unknown>>(
          args.env,
          l10nTextPackKey(args.publicId, locale, pointer.textFp),
        ),
      );
      if (!textPack) {
        throw new Error(`live_text_pack_invalid:${locale}`);
      }

      return {
        locale,
        source: 'agent',
        baseFingerprint,
        baseUpdatedAt: pointer.updatedAt,
        hasUserOps: false,
        baseOps: buildBaseOpsFromTextPack(textPack),
        userOps: [],
      };
    }),
  );

  const filteredCountryMap = Object.fromEntries(
    Object.entries(localePolicy.ip.countryToLocale).filter(([, locale]) =>
      readyLocales.includes(locale),
    ),
  );
  return {
    baseFingerprint,
    localePolicy,
    localization: {
      baseLocale: localePolicy.baseLocale,
      accountLocales: Array.from(new Set(nonBaseReadyLocales)),
      readyLocales,
      invalidAccountLocales: null,
      localeOverlays: overlayEntries,
      policy: {
        v: 1,
        baseLocale: localePolicy.baseLocale,
        ip: {
          countryToLocale: filteredCountryMap,
        },
      },
    },
  };
}

function buildLocaleLabels(locales: string[]): Record<string, string> {
  return Object.fromEntries(
    locales.map((locale) => [
      locale,
      resolveLocaleLabel({
        locales: CANONICAL_LOCALES,
        uiLocale: locale,
        targetLocale: locale,
      }),
    ]),
  );
}

export async function handleGetPublicInstance(env: Env, publicId: string): Promise<Response> {
  const livePointer = normalizeLiveRenderPointer(
    await loadJson(env, renderLivePointerKey(publicId)),
  );
  if (!livePointer) {
    return ckError('NOT_FOUND', 'coreui.errors.instance.notFound', 404);
  }

  const config = readConfigPack(
    await loadJson<Record<string, unknown>>(
      env,
      renderConfigPackKey(publicId, livePointer.configFp),
    ),
  );
  if (!config) {
    return ckError('INTERNAL', 'coreui.errors.db.readFailed', 500, 'live_config_missing');
  }

  let publicPayload: PublicInstancePayload;
  try {
    const { baseFingerprint, localePolicy, localization } = await loadPublicLocalizationSnapshot({
      env,
      publicId,
      widgetType: livePointer.widgetType,
      config,
      localePolicyRaw: livePointer.localePolicy,
    });
    publicPayload = {
      publicId,
      displayName: publicId,
      status: 'published',
      widgetType: livePointer.widgetType,
      config,
      baseFingerprint,
      localePolicy,
      localeLabels: buildLocaleLabels(localePolicy.readyLocales),
      localization,
      policy: resolvePolicy({ profile: 'free', role: 'editor' }),
    };
  } catch (error) {
    return ckError(
      'INTERNAL',
      'coreui.errors.internal.serverError',
      500,
      error instanceof Error ? error.message : String(error),
    );
  }

  return json(publicPayload);
}

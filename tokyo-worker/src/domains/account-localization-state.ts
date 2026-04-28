import {
  normalizeLocalizationOps,
  parseAccountL10nPolicyStrict,
  parseAccountLocaleListStrict,
  type AccountL10nPolicy,
  type LocalizationOp,
} from '@clickeen/ck-contracts';
import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import { normalizeLocaleToken, type AllowlistEntry } from '@clickeen/l10n';
import { json } from '../http';
import type { AccountWidgetL10nItem, Env } from '../types';
import {
  accountInstanceL10nLivePointerKey,
  normalizeTextPointer,
  readSavedRenderConfig,
} from './render';
import {
  asTrimmedString,
  filterAllowlistedOps,
  isRecord,
  normalizeReadyLocales,
  resolveTokyoControlErrorDetail,
} from './account-localization-utils';

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
export async function loadOverlayOps(args: {
  env: Env;
  accountId: string;
  publicId: string;
  layer: 'locale';
  layerKey: string;
  baseFingerprint: string;
  allowlist: AllowlistEntry[];
}): Promise<{ ops: LocalizationOp[]; baseUpdatedAt: string | null }> {
  const key = `accounts/${args.accountId}/instances/${args.publicId}/l10n/overlays/${args.layer}/${args.layerKey}/${args.baseFingerprint}.ops.json`;
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

export async function generateAccountWidgetL10nOps(args: {
  env: Env;
  policyProfile: RomaAccountAuthzCapsulePayload['profile'];
  widgetType: string;
  items: AccountWidgetL10nItem[];
  baseLocale: string;
  targetLocales: string[];
  existingOpsByLocale: Record<string, LocalizationOp[]>;
  changedPaths?: string[] | null;
  removedPaths?: string[];
}): Promise<Map<string, LocalizationOp[]>> {
  if (!args.targetLocales.length) return new Map();

  const binding = args.env.SANFRANCISCO_L10N;
  if (!binding || typeof binding.generateAccountWidgetL10nOps !== 'function') {
    throw new Error('tokyo_sanfrancisco_l10n_binding_missing');
  }

  const payload = (await binding.generateAccountWidgetL10nOps({
    policyProfile: args.policyProfile,
    widgetType: args.widgetType,
    items: args.items,
    baseLocale: args.baseLocale,
    targetLocales: args.targetLocales,
    existingOpsByLocale: args.existingOpsByLocale,
    changedPaths: args.changedPaths ?? null,
    removedPaths: args.removedPaths ?? [],
  }).catch((error) => {
    throw new Error(
      `tokyo_sanfrancisco_l10n_rpc_failed:${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  })) as
    | {
        results?: unknown;
      }
    | null;

  const out = new Map<string, LocalizationOp[]>();
  if (!Array.isArray(payload?.results)) return out;

  for (const entry of payload.results) {
    if (!isRecord(entry)) continue;
    const locale = normalizeLocaleToken(entry.locale);
    if (!locale) continue;
    if (entry.ok !== true) continue;
    out.set(locale, normalizeLocalizationOps(entry.ops));
  }

  return out;
}

export async function loadAccountTranslationsPanelData(args: {
  env: Env;
  accountId: string;
  publicId: string;
}): Promise<{
  publicId: string;
  widgetType: string;
  baseLocale: string;
  requestedLocales: string[];
  readyLocales: string[];
  status: 'queued' | 'working' | 'ready' | 'failed';
  failedLocales: Array<{ locale: string; reasonKey: string; detail?: string }>;
  baseFingerprint: string;
  generationId: string;
  updatedAt: string;
}> {
  const saved = await readSavedRenderConfig({
    env: args.env,
    accountId: args.accountId,
    publicId: args.publicId,
  });
  if (!saved.ok) {
    throw new Error(saved.kind === 'NOT_FOUND' ? 'tokyo_saved_not_found' : saved.reasonKey);
  }

  const l10n = saved.value.pointer.l10n;
  const baseFingerprint = asTrimmedString(l10n?.baseFingerprint);
  const summaryBaseLocale = normalizeLocaleToken(l10n?.summary?.baseLocale);
  const requestedLocales = normalizeReadyLocales({
    baseLocale: summaryBaseLocale ?? '',
    locales: l10n?.summary?.desiredLocales ?? [],
  });
  if (!l10n || !baseFingerprint || !summaryBaseLocale || !requestedLocales.includes(summaryBaseLocale)) {
    throw new Error('tokyo_saved_l10n_summary_missing');
  }

  const textPointerLocales = await Promise.all(
    requestedLocales.map(async (locale) => {
      if (locale === summaryBaseLocale) return locale;
      const raw = await args.env.TOKYO_R2
        .get(accountInstanceL10nLivePointerKey(args.accountId, args.publicId, locale))
        .then((obj) => obj?.json().catch(() => null) ?? null);
      const pointer = normalizeTextPointer(raw);
      return pointer?.baseFingerprint === baseFingerprint ? locale : null;
    }),
  );
  const readyLocales = normalizeReadyLocales({
    baseLocale: summaryBaseLocale,
    locales: [
      ...(l10n.readyLocales ?? []),
      ...textPointerLocales.filter((locale): locale is string => Boolean(locale)),
    ],
  }).filter((locale) => requestedLocales.includes(locale));
  const readySet = new Set(readyLocales);
  const missingLocales = requestedLocales.filter(
    (locale) => locale !== summaryBaseLocale && !readySet.has(locale),
  );
  const storedStatus = l10n.status;
  const status =
    missingLocales.length === 0
      ? 'ready'
      : storedStatus === 'queued' || storedStatus === 'working'
        ? storedStatus
        : 'failed';
  const failedLocales =
    status === 'failed'
      ? (l10n.failedLocales?.length
          ? l10n.failedLocales.filter((failure) => requestedLocales.includes(failure.locale))
          : missingLocales.map((locale) => ({
              locale,
              reasonKey: 'tokyo_translation_locale_not_ready',
            })))
      : [];

  return {
    publicId: args.publicId,
    widgetType: saved.value.pointer.widgetType,
    baseLocale: summaryBaseLocale,
    requestedLocales,
    readyLocales,
    status,
    failedLocales,
    baseFingerprint,
    generationId: l10n.generationId ?? `saved-${baseFingerprint.slice(0, 12)}`,
    updatedAt: l10n.updatedAt ?? saved.value.pointer.updatedAt,
  };
}

function buildTranslationsPanelReadErrorResponse(detail: string): Response {
  if (detail === 'tokyo_saved_not_found') {
    return json(
      { error: { kind: 'NOT_FOUND', reasonKey: detail, detail } },
      { status: 404 },
    );
  }

  return json(
    { error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'coreui.errors.db.readFailed', detail } },
    { status: 502 },
  );
}

export async function handleGetAccountTranslationsPanel(
  _req: Request,
  env: Env,
  publicId: string,
  accountId: string,
): Promise<Response> {
  try {
    const result = await loadAccountTranslationsPanelData({
      env,
      accountId,
      publicId,
    });
    return json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return buildTranslationsPanelReadErrorResponse(detail);
  }
}

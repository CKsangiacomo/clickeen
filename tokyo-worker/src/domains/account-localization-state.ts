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
import type { Env } from '../types';
import {
  l10nLivePointerKey,
  loadSavedRenderL10nBase,
  readSavedRenderPointer,
} from './render';
import {
  asTrimmedString,
  filterAllowlistedOps,
  isRecord,
  normalizeReadyLocales,
  resolveTokyoControlErrorDetail,
} from './account-localization-utils';

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
  publicId: string;
  layer: 'locale';
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

async function loadAccountTranslationsPanelContext(args: {
  env: Env;
  accountId: string;
  publicId: string;
}): Promise<{
  publicId: string;
  widgetType: string;
  baseFingerprint: string;
  baseLocale: string;
  desiredLocales: string[];
}> {
  const pointerResult = await readSavedRenderPointer({
    env: args.env,
    publicId: args.publicId,
    accountId: args.accountId,
  });
  if (!pointerResult.ok) {
    throw new Error(
      pointerResult.kind === 'NOT_FOUND' ? 'tokyo_saved_not_found' : 'tokyo_saved_invalid',
    );
  }

  const pointer = pointerResult.value;
  const baseFingerprint = pointer.l10n?.baseFingerprint ?? '';
  if (!baseFingerprint) {
    throw new Error('tokyo_saved_l10n_base_missing');
  }

  let baseLocale = pointer.l10n?.summary?.baseLocale ?? '';
  let desiredLocales = pointer.l10n?.summary?.desiredLocales ?? [];
  if (!baseLocale || !desiredLocales.length) {
    throw new Error('tokyo_saved_l10n_summary_missing');
  }

  const normalizedDesiredLocales = normalizeReadyLocales({
    baseLocale,
    locales: desiredLocales,
  });
  const l10nBase = await loadSavedRenderL10nBase({
    env: args.env,
    publicId: args.publicId,
    widgetType: pointer.widgetType,
    baseFingerprint,
  });
  if (!l10nBase) {
    throw new Error('tokyo_saved_l10n_base_missing');
  }

  return {
    publicId: args.publicId,
    widgetType: pointer.widgetType,
    baseFingerprint: l10nBase.baseFingerprint,
    baseLocale,
    desiredLocales: normalizedDesiredLocales,
  };
}

export async function loadAccountTranslationsPanelData(args: {
  env: Env;
  accountId: string;
  publicId: string;
}): Promise<{
  publicId: string;
  widgetType: string;
  baseLocale: string;
  readyLocales: string[];
  translationOk: boolean;
}> {
  const panel = await loadAccountTranslationsPanelContext({
    env: args.env,
    accountId: args.accountId,
    publicId: args.publicId,
  });
  const readyLocales = await loadTokyoCurrentArtifactReadyLocales({
    env: args.env,
    publicId: args.publicId,
    baseLocale: panel.baseLocale,
    locales: panel.desiredLocales,
    baseFingerprint: panel.baseFingerprint,
  });
  const readyLocaleSet = new Set(readyLocales);

  return {
    publicId: args.publicId,
    widgetType: panel.widgetType,
    baseLocale: panel.baseLocale,
    readyLocales: panel.desiredLocales.filter((locale) => readyLocaleSet.has(locale)),
    translationOk: panel.desiredLocales.every((locale) => readyLocaleSet.has(locale)),
  };
}

function buildTranslationsPanelReadErrorResponse(detail: string): Response {
  if (detail === 'tokyo_saved_not_found') {
    return json(
      { error: { kind: 'NOT_FOUND', reasonKey: detail, detail } },
      { status: 404 },
    );
  }

  if (
    detail === 'tokyo_saved_invalid' ||
    detail === 'tokyo_saved_l10n_base_missing' ||
    detail === 'tokyo_saved_l10n_summary_missing'
  ) {
    return json(
      { error: { kind: 'VALIDATION', reasonKey: detail, detail } },
      { status: 422 },
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

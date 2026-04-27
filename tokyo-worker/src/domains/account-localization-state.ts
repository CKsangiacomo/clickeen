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
  bootstrapCurrentWidgetTranslationStateFromSavedRender,
  readCurrentWidgetTranslationState,
} from './translation-state';
import {
  asTrimmedString,
  filterAllowlistedOps,
  isRecord,
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
  changedPaths?: string[] | null;
  removedPaths?: string[];
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
        changedPaths: args.changedPaths ?? null,
        removedPaths: args.removedPaths ?? [],
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
  status: 'accepted' | 'working' | 'ready' | 'failed';
  failedLocales: Array<{ locale: string; reasonKey: string; detail?: string }>;
  baseFingerprint: string;
  generationId: string;
  updatedAt: string;
}> {
  const state =
    (await readCurrentWidgetTranslationState({
      env: args.env,
      accountId: args.accountId,
      publicId: args.publicId,
    })) ??
    (await bootstrapCurrentWidgetTranslationStateFromSavedRender({
      env: args.env,
      accountId: args.accountId,
      publicId: args.publicId,
    }));
  if (!state) throw new Error('tokyo_translation_state_missing');

  return {
    publicId: args.publicId,
    widgetType: state.widgetType,
    baseLocale: state.baseLocale,
    requestedLocales: state.requestedLocales,
    readyLocales: state.readyLocales,
    status: state.status,
    failedLocales: state.failedLocales,
    baseFingerprint: state.baseFingerprint,
    generationId: state.generationId,
    updatedAt: state.updatedAt,
  };
}

function buildTranslationsPanelReadErrorResponse(detail: string): Response {
  if (detail === 'tokyo_saved_not_found' || detail === 'tokyo_translation_state_missing') {
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

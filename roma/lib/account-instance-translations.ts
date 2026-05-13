import { asTrimmedString, isRecord } from '@clickeen/ck-contracts';
import {
  buildTokyoProductControlHeaders,
  fetchTokyoProductControl,
} from './tokyo-product-control';

export type AccountTranslationsPanelPayload = {
  instanceId: string;
  widgetType: string;
  baseLocale: string;
  requestedLocales: string[];
  readyLocales: string[];
  status: 'queued' | 'working' | 'ready' | 'failed';
  baseFingerprint: string;
  generationId: string;
  updatedAt: string;
  textPacks: Record<string, Record<string, string>>;
};

type RouteFailure = {
  ok: false;
  status: number;
  error: {
    kind: 'VALIDATION' | 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
    reasonKey: string;
    detail?: string;
  };
};

function resolveTokyoControlErrorDetail(payload: unknown, fallback: string): string {
  if (isRecord(payload) && isRecord(payload.error)) {
    const reasonKey = asTrimmedString(payload.error.reasonKey);
    if (reasonKey) return reasonKey;
    const detail = asTrimmedString(payload.error.detail);
    if (detail) return detail;
  }
  return fallback;
}

function normalizeTranslationsPanelPayload(raw: unknown): AccountTranslationsPanelPayload | null {
  if (!isRecord(raw)) return null;
  const instanceId = asTrimmedString(raw.instanceId);
  const widgetType = asTrimmedString(raw.widgetType);
  const baseLocale = asTrimmedString(raw.baseLocale);
  const requestedLocales = Array.isArray(raw.requestedLocales)
    ? raw.requestedLocales
        .map((entry) => asTrimmedString(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];
  const readyLocales = Array.isArray(raw.readyLocales)
    ? raw.readyLocales
        .map((entry) => asTrimmedString(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];
  const status =
    raw.status === 'queued' || raw.status === 'working' || raw.status === 'ready' || raw.status === 'failed'
      ? raw.status
      : null;
  const baseFingerprint = asTrimmedString(raw.baseFingerprint);
  const generationId = asTrimmedString(raw.generationId);
  const updatedAt = asTrimmedString(raw.updatedAt);
  const textPacksRaw = isRecord(raw.textPacks) ? raw.textPacks : {};
  const textPacks: Record<string, Record<string, string>> = {};
  for (const [localeRaw, packRaw] of Object.entries(textPacksRaw)) {
    const locale = asTrimmedString(localeRaw);
    if (!locale || !isRecord(packRaw)) continue;
    const entries = Object.entries(packRaw)
      .map(([pathRaw, value]) => {
        const path = asTrimmedString(pathRaw);
        return path && typeof value === 'string' ? [path, value] : null;
      })
      .filter((entry): entry is [string, string] => Boolean(entry));
    textPacks[locale] = Object.fromEntries(entries);
  }

  if (!instanceId || !widgetType || !baseLocale || !requestedLocales.includes(baseLocale) || !status || !baseFingerprint || !generationId || !updatedAt) {
    return null;
  }
  if (!readyLocales.includes(baseLocale)) return null;

  return {
    instanceId,
    widgetType,
    baseLocale,
    requestedLocales: Array.from(new Set(requestedLocales)),
    readyLocales: Array.from(new Set(readyLocales)),
    status,
    baseFingerprint,
    generationId,
    updatedAt,
    textPacks,
  };
}

export async function loadAccountInstanceTranslationsPanel(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: AccountTranslationsPanelPayload } | RouteFailure> {
  const response = await fetchTokyoProductControl({
    path: `/__internal/account/widgets/${encodeURIComponent(args.instanceId)}/translations`,
    method: 'GET',
    headers: buildTokyoProductControlHeaders({
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    }),
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const detail = resolveTokyoControlErrorDetail(payload, `tokyo_l10n_translations_http_${response.status}`);
    if (response.status === 401) {
      return { ok: false, status: 401, error: { kind: 'AUTH', reasonKey: detail, detail } };
    }
    if (response.status === 403) {
      return { ok: false, status: 403, error: { kind: 'DENY', reasonKey: detail, detail } };
    }
    if (response.status === 404) {
      return { ok: false, status: 404, error: { kind: 'NOT_FOUND', reasonKey: detail, detail } };
    }
    if (response.status === 422) {
      return { ok: false, status: 422, error: { kind: 'VALIDATION', reasonKey: detail, detail } };
    }
    return {
      ok: false,
      status: 502,
      error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'coreui.errors.db.readFailed', detail },
    };
  }

  const value = normalizeTranslationsPanelPayload(payload);
  if (!value) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.payload.invalid',
        detail: 'tokyo_l10n_translations_invalid_payload',
      },
    };
  }

  return { ok: true, value };
}

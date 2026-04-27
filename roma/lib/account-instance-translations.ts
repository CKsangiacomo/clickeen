import {
  buildTokyoProductControlHeaders,
  fetchTokyoProductControl,
} from './tokyo-product-control';

export type AccountTranslationsPanelPayload = {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

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
  const publicId = asTrimmedString(raw.publicId);
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
    raw.status === 'accepted' || raw.status === 'working' || raw.status === 'ready' || raw.status === 'failed'
      ? raw.status
      : null;
  const failedLocales = Array.isArray(raw.failedLocales)
    ? raw.failedLocales.flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const locale = asTrimmedString(entry.locale);
        const reasonKey = asTrimmedString(entry.reasonKey);
        if (!locale || !reasonKey) return [];
        const detail = asTrimmedString(entry.detail);
        return [{ locale, reasonKey, ...(detail ? { detail } : {}) }];
      })
    : [];
  const baseFingerprint = asTrimmedString(raw.baseFingerprint);
  const generationId = asTrimmedString(raw.generationId);
  const updatedAt = asTrimmedString(raw.updatedAt);

  if (!publicId || !widgetType || !baseLocale || !requestedLocales.includes(baseLocale) || !status || !baseFingerprint || !generationId || !updatedAt) {
    return null;
  }
  if (!readyLocales.includes(baseLocale)) return null;

  return {
    publicId,
    widgetType,
    baseLocale,
    requestedLocales: Array.from(new Set(requestedLocales)),
    readyLocales: Array.from(new Set(readyLocales)),
    status,
    failedLocales,
    baseFingerprint,
    generationId,
    updatedAt,
  };
}

export async function loadAccountInstanceTranslationsPanel(args: {
  accountId: string;
  publicId: string;
  tokyoAccessToken?: string;
  accountCapsule?: string | null;
}): Promise<{ ok: true; value: AccountTranslationsPanelPayload } | RouteFailure> {
  const response = await fetchTokyoProductControl({
    path: `/__internal/l10n/instances/${encodeURIComponent(args.publicId)}/translations`,
    method: 'GET',
    headers: buildTokyoProductControlHeaders({
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
    }),
    accessToken: args.tokyoAccessToken,
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

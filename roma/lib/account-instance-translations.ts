import {
  buildTokyoProductControlHeaders,
  fetchTokyoProductControl,
} from './tokyo-product-control';

export type AccountTranslationsPanelPayload = {
  publicId: string;
  widgetType: string;
  baseLocale: string;
  activeLocales: string[];
  selectedLocale: string;
  statuses: Array<{
    locale: string;
    status: 'base' | 'dirty' | 'succeeded' | 'superseded';
  }>;
  translatedOutput: Array<{ path: string; value: string }>;
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
  const selectedLocale = asTrimmedString(raw.selectedLocale);
  const activeLocales = Array.isArray(raw.activeLocales)
    ? raw.activeLocales
        .map((entry) => asTrimmedString(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];
  const statuses = Array.isArray(raw.statuses)
    ? raw.statuses.reduce<AccountTranslationsPanelPayload['statuses']>((entries, entry) => {
        if (!isRecord(entry)) return entries;
        const locale = asTrimmedString(entry.locale);
        const status =
          entry.status === 'base' ||
          entry.status === 'dirty' ||
          entry.status === 'succeeded' ||
          entry.status === 'superseded'
            ? entry.status
            : null;
        if (!locale || !status) return entries;
        entries.push({ locale, status });
        return entries;
      }, [])
    : [];
  const translatedOutput = Array.isArray(raw.translatedOutput)
    ? raw.translatedOutput.reduce<AccountTranslationsPanelPayload['translatedOutput']>((entries, entry) => {
        if (!isRecord(entry)) return entries;
        const path = asTrimmedString(entry.path);
        const value = typeof entry.value === 'string' ? entry.value : null;
        if (!path || value === null) return entries;
        entries.push({ path, value });
        return entries;
      }, [])
    : [];

  if (!publicId || !widgetType || !baseLocale || !selectedLocale) return null;
  return {
    publicId,
    widgetType,
    baseLocale,
    activeLocales,
    selectedLocale,
    statuses,
    translatedOutput,
  };
}

export async function loadAccountInstanceTranslationsPanel(args: {
  accountId: string;
  publicId: string;
  tokyoAccessToken?: string;
  accountCapsule?: string | null;
  locale?: string | null;
}): Promise<{ ok: true; value: AccountTranslationsPanelPayload } | RouteFailure> {
  const query = args.locale ? `?locale=${encodeURIComponent(args.locale)}` : '';
  const response = await fetchTokyoProductControl({
    path: `/__internal/l10n/instances/${encodeURIComponent(args.publicId)}/translations${query}`,
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

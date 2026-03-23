import type { WidgetLocaleSwitcherSettings } from '@clickeen/ck-contracts';
import {
  buildTokyoProductControlHeaders,
  fetchTokyoProductControl,
} from './tokyo-product-control';

export type AccountTranslationsPanelPayload = {
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

function isLocaleSwitcherAttachTo(value: unknown): value is WidgetLocaleSwitcherSettings['attachTo'] {
  return value === 'pod' || value === 'stage';
}

function isLocaleSwitcherPosition(value: unknown): value is WidgetLocaleSwitcherSettings['position'] {
  return (
    value === 'top-left' ||
    value === 'top-center' ||
    value === 'top-right' ||
    value === 'right-middle' ||
    value === 'bottom-right' ||
    value === 'bottom-center' ||
    value === 'bottom-left' ||
    value === 'left-middle'
  );
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
  const inspectionLocale = asTrimmedString(raw.inspectionLocale);
  const activeLocales = Array.isArray(raw.activeLocales)
    ? raw.activeLocales
        .map((entry) => asTrimmedString(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];
  const localeStatuses = Array.isArray(raw.localeStatuses)
    ? raw.localeStatuses.reduce<AccountTranslationsPanelPayload['localeStatuses']>((entries, entry) => {
        if (!isRecord(entry)) return entries;
        const locale = asTrimmedString(entry.locale);
        if (!locale || typeof entry.ok !== 'boolean') return entries;
        entries.push({ locale, ok: entry.ok });
        return entries;
      }, [])
    : [];
  const localeBehavior = isRecord(raw.localeBehavior)
    && typeof raw.localeBehavior.enabled === 'boolean'
    && typeof raw.localeBehavior.byIp === 'boolean'
    && (raw.localeBehavior.alwaysShowLocale === null || typeof raw.localeBehavior.alwaysShowLocale === 'string')
    && isLocaleSwitcherAttachTo(raw.localeBehavior.attachTo)
    && isLocaleSwitcherPosition(raw.localeBehavior.position)
      ? {
          enabled: raw.localeBehavior.enabled,
          byIp: raw.localeBehavior.byIp,
          alwaysShowLocale:
            raw.localeBehavior.alwaysShowLocale === null
              ? null
              : raw.localeBehavior.alwaysShowLocale,
          attachTo: raw.localeBehavior.attachTo,
          position: raw.localeBehavior.position,
        }
      : null;

  if (!publicId || !widgetType || !baseLocale || !inspectionLocale || !localeBehavior) return null;
  if (!activeLocales.includes(baseLocale) || !activeLocales.includes(inspectionLocale)) return null;
  if (localeStatuses.length !== activeLocales.length) return null;
  const activeLocaleSet = new Set(activeLocales);
  const localeStatusSet = new Set(localeStatuses.map((entry) => entry.locale));
  if (localeStatusSet.size !== activeLocales.length) return null;
  for (const locale of activeLocaleSet) {
    if (!localeStatusSet.has(locale)) return null;
  }

  return {
    publicId,
    widgetType,
    baseLocale,
    activeLocales,
    inspectionLocale,
    localeStatuses,
    localeBehavior,
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

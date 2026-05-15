import { asTrimmedString, isRecord } from '@clickeen/ck-contracts';
import { resolveLanguageOverlayCode } from '@clickeen/ck-contracts/overlay-codebooks';
import {
  normalizeCanonicalLocalesFile,
  resolveLocaleLabel as resolveCanonicalLocaleLabel,
} from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
import { callTokyo } from './tokyo-client';
import { loadTokyoAccountInstanceDocument } from './account-instance-direct';
import { loadAccountBabelLanguagePolicy } from './account-babel-policy';

const CANONICAL_LOCALES = normalizeCanonicalLocalesFile(localesJson);
const BUILDER_UI_LOCALE = 'en';

export type AccountTranslationsPanelPayload = {
  v: 1;
  instanceId: string;
  widgetType: string;
  baseLanguage: string;
  languages: Array<{
    language: string;
    label: string;
    overlayId: string | null;
  }>;
  valuesByLanguage: Record<string, Record<string, string>>;
  progress: Array<{
    language: string;
    message: string;
  }>;
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

function normalizeOverlayValues(raw: unknown): Record<string, string> | null {
  if (!isRecord(raw)) return null;
  const values: Record<string, string> = {};
  for (const [path, value] of Object.entries(raw)) {
    if (!path || typeof value !== 'string') return null;
    values[path] = value;
  }
  return values;
}

function invalidPayload(detail: string): RouteFailure {
  return {
    ok: false,
    status: 422,
    error: {
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.payload.invalid',
      detail,
    },
  };
}

function resolveLocaleLabel(locale: string): string {
  return (
    resolveCanonicalLocaleLabel({
      locales: CANONICAL_LOCALES,
      uiLocale: BUILDER_UI_LOCALE,
      targetLocale: locale,
    }) || locale
  );
}

export async function loadAccountInstanceTranslationsPanel(args: {
  accountId: string;
  berlinAccountId: string;
  accessToken: string;
  instanceId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: AccountTranslationsPanelPayload } | RouteFailure> {
  const instance = await loadTokyoAccountInstanceDocument({
    accountId: args.accountId,
    instanceId: args.instanceId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
  });
  if (!instance.ok) return instance;

  const policy = await loadAccountBabelLanguagePolicy({
    accessToken: args.accessToken,
    accountId: args.berlinAccountId,
    requestId: args.requestId,
  });
  if (!policy.ok) return policy;

  const baseLocale = policy.value.baseLocale;
  const requestedLocales = policy.value.desiredLocales;
  const languages: AccountTranslationsPanelPayload['languages'] = [];
  const valuesByLanguage: AccountTranslationsPanelPayload['valuesByLanguage'] = {};

  for (const locale of requestedLocales.filter((entry) => entry !== baseLocale)) {
    let overlayId: string | null = null;
    const languageCode = resolveLanguageOverlayCode(locale);
    if (!languageCode) {
      languages.push({
        language: locale,
        label: resolveLocaleLabel(locale),
        overlayId: null,
      });
      continue;
    }
    const selected = await callTokyo<unknown>(
      {
        accountId: args.accountId,
        accountCapsule: args.accountCapsule,
        requestId: args.requestId,
      },
      {
        path: '/__internal/overlays/languages/selected.json',
        method: 'POST',
        body: {
          instanceId: args.instanceId,
          widgetType: instance.value.row.widgetType,
          languageCode,
        },
        decode: (payload) => payload,
        errorKey: 'tokyo.errors.l10n.invalid',
        errorDetail: 'tokyo_selected_overlay_http_error',
      },
    );
    if (!selected.ok) return selected;
    const selectedPayload = isRecord(selected.value) ? selected.value : null;
    overlayId = asTrimmedString(selectedPayload?.overlayId);
    if (!overlayId) {
      languages.push({
        language: locale,
        label: resolveLocaleLabel(locale),
        overlayId: null,
      });
      continue;
    }
    const overlay = await callTokyo<unknown>(
      {
        accountId: args.accountId,
        accountCapsule: args.accountCapsule,
        requestId: args.requestId,
      },
      {
        path: `/__internal/overlays/${encodeURIComponent(overlayId)}.json`,
        method: 'GET',
        decode: (payload) => payload,
        errorKey: 'tokyo.errors.l10n.invalid',
        errorDetail: 'tokyo_overlay_object_http_error',
      },
    );
    if (!overlay.ok) return overlay;
    const overlayPayload = isRecord(overlay.value) ? overlay.value : null;
    const values = normalizeOverlayValues(overlayPayload?.values);
    if (!values) return invalidPayload('tokyo_overlay_object_invalid_payload');
    valuesByLanguage[locale] = values;
    languages.push({
      language: locale,
      label: resolveLocaleLabel(locale),
      overlayId,
    });
  }

  return {
    ok: true,
    value: {
      v: 1,
      instanceId: args.instanceId,
      widgetType: instance.value.row.widgetType,
      baseLanguage: baseLocale,
      languages,
      valuesByLanguage,
      progress: [],
    },
  };
}

import {
  asTrimmedString,
  isRecord,
} from '@clickeen/ck-contracts';
import {
  type TranslationGenerationSummary as InstanceTranslationGenerationSummary,
} from '@clickeen/ck-contracts/translation-product-state';
import { callTokyo } from './tokyo-client';

type RouteFailure = {
  ok: false;
  status: number;
  error: {
    kind: 'VALIDATION' | 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
    reasonKey: string;
    detail?: string;
  };
};

export type InstanceTranslationSummary = {
  locale: string;
};

export type InstanceTranslationsPayload = {
  v: 1;
  baseLocale: string;
  translations: InstanceTranslationSummary[];
};

export type InstanceTranslationValuesPayload = {
  v: 1;
  locale: string;
  values: Record<string, string>;
};

export type InstanceTranslationsGeneratePayload = {
  ok: true;
  translation: {
    ok: true;
    accepted: boolean;
    baseLocale: string;
    activeLocales: string[];
    skippedLocales: string[];
    generation: InstanceTranslationGenerationSummary | null;
  };
};

export type InstanceTranslationGenerationPayload = {
  ok: true;
  generation: InstanceTranslationGenerationSummary;
};

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

function normalizeValueMap(raw: unknown): Record<string, string> | null {
  if (!isRecord(raw)) return null;
  const values: Record<string, string> = {};
  for (const [path, value] of Object.entries(raw)) {
    if (!path || typeof value !== 'string') return null;
    values[path] = value;
  }
  return values;
}

function normalizeTranslationSummary(raw: unknown): InstanceTranslationSummary | null {
  if (!isRecord(raw)) return null;
  const locale = asTrimmedString(raw.locale);
  return locale ? { locale } : null;
}

function normalizeTranslationsPayload(payload: unknown): InstanceTranslationsPayload | null {
  if (!isRecord(payload) || payload.v !== 1) return null;
  const baseLocale = asTrimmedString(payload.baseLocale);
  if (!baseLocale || !Array.isArray(payload.translations)) return null;
  const translations = payload.translations
    .map((entry) => normalizeTranslationSummary(entry))
    .filter((entry): entry is InstanceTranslationSummary => Boolean(entry));
  if (translations.length !== payload.translations.length) return null;
  return {
    v: 1,
    baseLocale,
    translations,
  };
}

function normalizeTranslationValuesPayload(payload: unknown): InstanceTranslationValuesPayload | null {
  if (!isRecord(payload) || payload.v !== 1) return null;
  const locale = asTrimmedString(payload.locale);
  const values = normalizeValueMap(payload.values);
  return locale && values ? { v: 1, locale, values } : null;
}

function normalizeStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const values = raw.map((entry) => asTrimmedString(entry));
  if (values.some((entry) => !entry)) return null;
  return values as string[];
}

export async function loadAccountInstanceTranslations(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: InstanceTranslationsPayload } | RouteFailure> {
  const result = await callTokyo<unknown>(
    {
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    },
    {
      path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/translations`,
      method: 'GET',
      decode: (payload) => payload,
      errorKey: 'tokyo.errors.translation.invalid',
      errorDetail: 'tokyo_instance_translations_http_error',
    },
  );
  if (!result.ok) return result;
  const value = normalizeTranslationsPayload(result.value);
  if (!value) return invalidPayload('tokyo_instance_translations_invalid_payload');
  return { ok: true, value };
}

export async function generateAccountInstanceTranslations(args: {
  accountId: string;
  instanceId: string;
  baseLocale: string;
  activeLocales: string[];
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: InstanceTranslationsGeneratePayload; status: number } | RouteFailure> {
  const baseLocale = asTrimmedString(args.baseLocale);
  const activeLocales = normalizeStringArray(args.activeLocales);
  if (!baseLocale) return invalidPayload('baseLocale_missing');
  if (!activeLocales) return invalidPayload('activeLocales_invalid');
  void args.accountId;
  void args.instanceId;
  void args.accountCapsule;
  void args.requestId;
  return {
    ok: false,
    status: 503,
    error: {
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'coreui.errors.translation.generationUnavailable',
      detail: 'San Francisco translation generation owner is not enabled.',
    },
  };
}

export async function readAccountInstanceTranslationGeneration(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: InstanceTranslationGenerationPayload } | RouteFailure> {
  void args.accountId;
  void args.instanceId;
  void args.accountCapsule;
  void args.requestId;
  return {
    ok: false,
    status: 503,
    error: {
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'coreui.errors.translation.generationUnavailable',
      detail: 'San Francisco translation generation owner is not enabled.',
    },
  };
}

export async function readAccountInstanceTranslationValues(args: {
  accountId: string;
  instanceId: string;
  locale: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: InstanceTranslationValuesPayload } | RouteFailure> {
  const locale = asTrimmedString(args.locale);
  if (!locale) return invalidPayload('locale_missing');
  const result = await callTokyo<unknown>(
    {
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    },
    {
      path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/translations/${encodeURIComponent(locale)}`,
      method: 'GET',
      decode: (payload) => payload,
      errorKey: 'tokyo.errors.translation.invalid',
      errorDetail: 'tokyo_instance_translation_read_http_error',
    },
  );
  if (!result.ok) return result;
  const value = normalizeTranslationValuesPayload(result.value);
  if (!value || value.locale !== locale) return invalidPayload('tokyo_instance_translation_invalid_payload');
  return { ok: true, value };
}

export async function writeAccountInstanceTranslationValues(args: {
  accountId: string;
  instanceId: string;
  locale: string;
  values: Record<string, string>;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { locale: string } } | RouteFailure> {
  const locale = asTrimmedString(args.locale);
  const values = normalizeValueMap(args.values);
  if (!locale) return invalidPayload('locale_missing');
  if (!values) return invalidPayload('values_invalid');
  const result = await callTokyo<unknown>(
    {
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    },
    {
      path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/translations/${encodeURIComponent(locale)}`,
      method: 'PUT',
      body: { values },
      decode: (payload) => payload,
      errorKey: 'tokyo.errors.translation.invalid',
      errorDetail: 'tokyo_instance_translation_write_http_error',
    },
  );
  if (!result.ok) return result;
  const payload = isRecord(result.value) ? result.value : null;
  const storedLocale = asTrimmedString(payload?.locale);
  if (storedLocale !== locale) return invalidPayload('tokyo_instance_translation_write_invalid_payload');
  return { ok: true, value: { locale } };
}

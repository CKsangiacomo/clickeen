type JsonRecord = Record<string, unknown>;

export type TranslationGenerationSummaryStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed';

export type TranslationProductLocaleSyncState =
  | 'missing'
  | 'generating'
  | 'inSync'
  | 'outOfSync'
  | 'failed';

export type TranslationProductLocaleState = {
  locale: string;
  state: TranslationProductLocaleSyncState;
  reviewable: boolean;
  reasonKey?: string;
  detail?: string;
};

export type TranslationGenerationSummaryWire = {
  v?: 2;
  instanceId: string;
  baseLocale: string;
  activeLocales: string[];
  status: TranslationGenerationSummaryStatus;
  active?: boolean;
  requestedAt?: string | null;
  updatedAt?: string | null;
  totalLocales: number;
  baseContentMarker?: string;
  isCurrentBaseContent?: boolean;
  reasonKey?: string;
  detail?: string;
  locales?: TranslationProductLocaleState[];
};

export type TranslationGenerationSummary = {
  v?: 2;
  instanceId: string;
  baseLocale: string;
  activeLocales: string[];
  status: TranslationGenerationSummaryStatus;
  active: boolean;
  requestedAt: string | null;
  updatedAt: string | null;
  totalLocales: number;
  baseContentMarker?: string;
  isCurrentBaseContent: boolean;
  reasonKey?: string;
  detail?: string;
  locales: TranslationProductLocaleState[];
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
}

function normalizeStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const values = raw.map((entry) => asTrimmedString(entry));
  if (values.some((entry) => !entry)) return null;
  return values as string[];
}

export function normalizeTranslationGenerationSummaryStatus(raw: unknown): TranslationGenerationSummaryStatus | null {
  return raw === 'idle' ||
    raw === 'queued' ||
    raw === 'running' ||
    raw === 'completed' ||
    raw === 'failed'
    ? raw
    : null;
}

export function normalizeTranslationProductLocaleSyncState(raw: unknown): TranslationProductLocaleSyncState | null {
  return raw === 'missing' ||
    raw === 'generating' ||
    raw === 'inSync' ||
    raw === 'outOfSync' ||
    raw === 'failed'
    ? raw
    : null;
}

export function normalizeTranslationProductLocaleState(raw: unknown): TranslationProductLocaleState | null {
  if (!isRecord(raw)) return null;
  const locale = asTrimmedString(raw.locale);
  const state = normalizeTranslationProductLocaleSyncState(raw.state);
  if (!locale || !state || typeof raw.reviewable !== 'boolean') return null;
  return {
    locale,
    state,
    reviewable: raw.reviewable,
    ...(asTrimmedString(raw.reasonKey) ? { reasonKey: asTrimmedString(raw.reasonKey) as string } : {}),
    ...(asTrimmedString(raw.detail) ? { detail: asTrimmedString(raw.detail) as string } : {}),
  };
}

export function normalizeTranslationProductLocaleStates(raw: unknown): TranslationProductLocaleState[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;
  const locales = raw
    .map((entry) => normalizeTranslationProductLocaleState(entry))
    .filter((entry): entry is TranslationProductLocaleState => Boolean(entry));
  return locales.length === raw.length ? locales : null;
}

function normalizeNullableString(raw: unknown): string | null {
  if (raw == null) return null;
  return asTrimmedString(raw);
}

export function normalizeTranslationGenerationSummary(raw: unknown): TranslationGenerationSummary | null {
  if (!isRecord(raw)) return null;
  const instanceId = asTrimmedString(raw.instanceId);
  const baseLocale = asTrimmedString(raw.baseLocale);
  const activeLocales = normalizeStringArray(raw.activeLocales);
  const status = normalizeTranslationGenerationSummaryStatus(raw.status);
  const locales = normalizeTranslationProductLocaleStates(raw.locales);
  const totalLocales = typeof raw.totalLocales === 'number' && Number.isFinite(raw.totalLocales)
    ? Math.max(0, Math.floor(raw.totalLocales))
    : null;
  if (
    !instanceId ||
    !baseLocale ||
    !activeLocales ||
    !status ||
    totalLocales == null ||
    !locales
  ) {
    return null;
  }
  return {
    ...(raw.v === 2 ? { v: 2 } : {}),
    instanceId,
    baseLocale,
    activeLocales,
    status,
    active: typeof raw.active === 'boolean' ? raw.active : status === 'queued' || status === 'running',
    requestedAt: normalizeNullableString(raw.requestedAt),
    updatedAt: normalizeNullableString(raw.updatedAt),
    totalLocales,
    ...(asTrimmedString(raw.baseContentMarker) ? { baseContentMarker: asTrimmedString(raw.baseContentMarker) as string } : {}),
    isCurrentBaseContent: raw.isCurrentBaseContent !== false,
    locales,
    ...(asTrimmedString(raw.reasonKey) ? { reasonKey: asTrimmedString(raw.reasonKey) as string } : {}),
    ...(asTrimmedString(raw.detail) ? { detail: asTrimmedString(raw.detail) as string } : {}),
  };
}

export function normalizeTranslationGenerationFromPayload(payload: unknown): TranslationGenerationSummary | null {
  if (!isRecord(payload)) return null;
  if (payload.generation) return normalizeTranslationGenerationSummary(payload.generation);
  const translation = payload.translation;
  return isRecord(translation)
    ? normalizeTranslationGenerationSummary(translation.generation)
    : null;
}

export function isActiveTranslationGeneration(generation: TranslationGenerationSummary | null): boolean {
  return Boolean(generation?.active || generation?.status === 'queued' || generation?.status === 'running');
}

import type { Env } from '../../types';
import { accountInstanceTranslationGenerationJobKey } from './keys';
import { loadJsonObject, putJson, putJsonIfUnchanged } from './storage';
import type {
  AccountInstanceContentDocument,
  TranslationGenerationJobDocument,
  TranslationGenerationJobSummary,
  TranslationGenerationJobStatus,
  TranslationGenerationLocaleState,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function localeState(value: unknown): TranslationGenerationLocaleState | null {
  if (!isRecord(value)) return null;
  const locale = typeof value.locale === 'string' ? value.locale : '';
  const status = value.status;
  if (!locale || status !== 'queued' && status !== 'completed' && status !== 'failed' && status !== 'superseded') {
    return null;
  }
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : '';
  if (!updatedAt) return null;
  return {
    locale,
    status,
    paths: stringArray(value.paths),
    updatedAt,
    ...(typeof value.reasonKey === 'string' ? { reasonKey: value.reasonKey } : {}),
    ...(typeof value.detail === 'string' ? { detail: value.detail } : {}),
  };
}

function normalizeJobStatus(value: unknown): TranslationGenerationJobStatus | null {
  return value === 'queued' ||
    value === 'running' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'superseded'
    ? value
    : null;
}

function normalizeJobDocument(value: unknown): TranslationGenerationJobDocument | null {
  if (!isRecord(value)) return null;
  const status = normalizeJobStatus(value.status);
  const localesRaw = isRecord(value.locales) ? value.locales : null;
  if (!status || !localesRaw) return null;
  const locales: Record<string, TranslationGenerationLocaleState> = {};
  for (const [locale, raw] of Object.entries(localesRaw)) {
    const state = localeState(raw);
    if (state && state.locale === locale) locales[locale] = state;
  }
  const basis = Array.isArray(value.basis)
    ? value.basis
        .map((entry) => {
          if (!isRecord(entry) || typeof entry.locale !== 'string' || !Array.isArray(entry.fields)) return null;
          const fields = entry.fields
            .map((field) => (
              isRecord(field) && typeof field.path === 'string' && typeof field.baseText === 'string'
                ? { path: field.path, baseText: field.baseText }
                : null
            ))
            .filter((field): field is { path: string; baseText: string } => Boolean(field))
            .sort((left, right) => left.path.localeCompare(right.path));
          return { locale: entry.locale, fields };
        })
        .filter((entry): entry is { locale: string; fields: Array<{ path: string; baseText: string }> } => Boolean(entry))
        .sort((left, right) => left.locale.localeCompare(right.locale))
    : [];
  const jobId = typeof value.jobId === 'string' ? value.jobId : '';
  const accountId = typeof value.accountId === 'string' ? value.accountId : '';
  const instanceId = typeof value.instanceId === 'string' ? value.instanceId : '';
  const widgetType = typeof value.widgetType === 'string' ? value.widgetType : '';
  const baseLocale = typeof value.baseLocale === 'string' ? value.baseLocale : '';
  const requestedAt = typeof value.requestedAt === 'string' ? value.requestedAt : '';
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : '';
  if (!jobId || !accountId || !instanceId || !widgetType || !baseLocale || !requestedAt || !updatedAt) return null;
  return {
    jobId,
    accountId,
    instanceId,
    widgetType,
    baseLocale,
    targetLocales: stringArray(value.targetLocales),
    status,
    requestedAt,
    updatedAt,
    totalLocales: typeof value.totalLocales === 'number' ? value.totalLocales : Object.keys(locales).length,
    completedLocales: stringArray(value.completedLocales),
    failedLocales: stringArray(value.failedLocales),
    supersededLocales: stringArray(value.supersededLocales),
    pendingLocales: stringArray(value.pendingLocales),
    currentReadyLocales: stringArray(value.currentReadyLocales),
    locales,
    basis,
    ...(typeof value.previousJobId === 'string' ? { previousJobId: value.previousJobId } : {}),
    ...(Array.isArray(value.supersededJobIds) ? { supersededJobIds: stringArray(value.supersededJobIds) } : {}),
    ...(typeof value.reasonKey === 'string' ? { reasonKey: value.reasonKey } : {}),
    ...(typeof value.detail === 'string' ? { detail: value.detail } : {}),
  };
}

function deriveJobStatus(args: {
  current: TranslationGenerationJobDocument;
  pendingLocales: string[];
  completedLocales: string[];
  failedLocales: string[];
  supersededLocales: string[];
}): TranslationGenerationJobStatus {
  if (args.current.status === 'superseded') return 'superseded';
  if (!args.pendingLocales.length && args.failedLocales.length) return 'failed';
  if (!args.pendingLocales.length && args.supersededLocales.length && !args.completedLocales.length) return 'superseded';
  if (!args.pendingLocales.length) return 'completed';
  if (args.completedLocales.length || args.failedLocales.length || args.supersededLocales.length) return 'running';
  return 'queued';
}

export function readyLocalesForContent(
  content: AccountInstanceContentDocument,
  targetLocales: string[],
): string[] {
  const fields = Object.values(content.fields);
  if (!fields.length) return [];
  return targetLocales
    .filter((locale) => fields.every((field) => (
      field.localeStatus?.[locale] === 'ok' &&
      typeof field.translatedValues?.[locale] === 'string'
    )))
    .sort((left, right) => left.localeCompare(right));
}

export function deriveTranslationGenerationJob(args: {
  job: TranslationGenerationJobDocument;
  currentReadyLocales?: string[];
  updatedAt?: string;
}): TranslationGenerationJobDocument {
  const locales = Object.values(args.job.locales).sort((left, right) => left.locale.localeCompare(right.locale));
  const completedLocales = locales
    .filter((entry) => entry.status === 'completed')
    .map((entry) => entry.locale);
  const failedLocales = locales
    .filter((entry) => entry.status === 'failed')
    .map((entry) => entry.locale);
  const supersededLocales = locales
    .filter((entry) => entry.status === 'superseded')
    .map((entry) => entry.locale);
  const pendingLocales = locales
    .filter((entry) => entry.status === 'queued')
    .map((entry) => entry.locale);
  const currentReadyLocales = args.currentReadyLocales ?? args.job.currentReadyLocales;
  const next: TranslationGenerationJobDocument = {
    ...args.job,
    updatedAt: args.updatedAt ?? args.job.updatedAt,
    totalLocales: locales.length,
    completedLocales,
    failedLocales,
    supersededLocales,
    pendingLocales,
    currentReadyLocales,
    status: deriveJobStatus({
      current: args.job,
      pendingLocales,
      completedLocales,
      failedLocales,
      supersededLocales,
    }),
  };
  return next;
}

export function summarizeTranslationGenerationJob(args: {
  instanceId: string;
  baseLocale: string;
  targetLocales: string[];
  currentReadyLocales: string[];
  job: TranslationGenerationJobDocument | null;
}): TranslationGenerationJobSummary {
  if (!args.job) {
    return {
      instanceId: args.instanceId,
      baseLocale: args.baseLocale,
      targetLocales: args.targetLocales,
      status: 'idle',
      requestedAt: null,
      updatedAt: null,
      totalLocales: args.targetLocales.length,
      completedLocales: [],
      failedLocales: [],
      supersededLocales: [],
      pendingLocales: [],
      currentReadyLocales: args.currentReadyLocales,
    };
  }
  const job = deriveTranslationGenerationJob({
    job: args.job,
    currentReadyLocales: args.currentReadyLocales,
  });
  return {
    instanceId: args.instanceId,
    baseLocale: args.baseLocale,
    targetLocales: args.targetLocales,
    status: job.status,
    requestedAt: job.requestedAt,
    updatedAt: job.updatedAt,
    totalLocales: job.totalLocales,
    completedLocales: job.completedLocales,
    failedLocales: job.failedLocales,
    supersededLocales: job.supersededLocales,
    pendingLocales: job.pendingLocales,
    currentReadyLocales: job.currentReadyLocales,
    jobId: job.jobId,
    locales: job.locales,
    ...(job.reasonKey ? { reasonKey: job.reasonKey } : {}),
    ...(job.detail ? { detail: job.detail } : {}),
  };
}

export async function readCurrentTranslationGenerationJob(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
}): Promise<TranslationGenerationJobDocument | null> {
  const loaded = await loadJsonObject<unknown>(
    args.env,
    accountInstanceTranslationGenerationJobKey(args.accountId, args.widgetCode, args.instanceId),
  );
  return loaded ? normalizeJobDocument(loaded.value) : null;
}

export async function writeCurrentTranslationGenerationJob(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
  job: TranslationGenerationJobDocument;
}): Promise<void> {
  await putJson(
    args.env,
    accountInstanceTranslationGenerationJobKey(args.accountId, args.widgetCode, args.instanceId),
    deriveTranslationGenerationJob({ job: args.job }),
  );
}

export async function updateCurrentTranslationGenerationJob(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
  update: (current: TranslationGenerationJobDocument | null) => TranslationGenerationJobDocument | null;
}): Promise<TranslationGenerationJobDocument | null> {
  const key = accountInstanceTranslationGenerationJobKey(args.accountId, args.widgetCode, args.instanceId);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const loaded = await loadJsonObject<unknown>(args.env, key);
    const current = loaded ? normalizeJobDocument(loaded.value) : null;
    const next = args.update(current);
    if (!next) return current;
    const derived = deriveTranslationGenerationJob({ job: next });
    if (!loaded) {
      await putJson(args.env, key, derived);
      return derived;
    }
    const written = await putJsonIfUnchanged(args.env, key, derived, loaded.httpEtag);
    if (written) return derived;
  }
  throw new Error('tokyo.translation.generation_write_conflict');
}

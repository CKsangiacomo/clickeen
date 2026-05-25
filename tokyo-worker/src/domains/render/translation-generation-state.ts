import type { Env } from '../../types';
import { accountInstanceTranslationGenerationJobKey } from './keys';
import { loadJsonObject, putJson, putJsonIfUnchanged } from './storage';
import type {
  AccountInstanceContentDocument,
  TranslationGenerationJobDocument,
  TranslationGenerationJobSummary,
  TranslationGenerationJobStatus,
  TranslationGenerationLocaleState,
  TranslationProductLocaleState,
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
          const widgetContract = isRecord(entry.widgetContract) &&
            entry.widgetContract.schemaVersion === 1 &&
            typeof entry.widgetContract.hash === 'string'
            ? { schemaVersion: 1 as const, hash: entry.widgetContract.hash }
            : undefined;
          const fields = entry.fields
            .map((field) => (
              isRecord(field) && typeof field.path === 'string' && typeof field.baseText === 'string'
                ? {
                    ...(typeof field.identityKey === 'string' ? { identityKey: field.identityKey } : {}),
                    ...(typeof field.fieldPattern === 'string' ? { fieldPattern: field.fieldPattern } : {}),
                    path: field.path,
                    baseText: field.baseText,
                  }
                : null
            ))
            .filter((field): field is { identityKey?: string; fieldPattern?: string; path: string; baseText: string } => Boolean(field))
            .sort((left, right) => (left.identityKey ?? left.path).localeCompare(right.identityKey ?? right.path));
          return { locale: entry.locale, ...(widgetContract ? { widgetContract } : {}), fields };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
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
    ...(typeof value.baseContentMarker === 'string' && value.baseContentMarker ? { baseContentMarker: value.baseContentMarker } : {}),
    ...(typeof value.generationRequestMarker === 'string' && value.generationRequestMarker ? { generationRequestMarker: value.generationRequestMarker } : {}),
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

export function outOfSyncLocalesForContent(
  content: AccountInstanceContentDocument,
  targetLocales: string[],
  currentBaseContentMarker?: string,
): string[] {
  if (!currentBaseContentMarker) return [];
  return targetLocales
    .filter((locale) => {
      const sync = content.localeSync?.[locale];
      return Boolean(sync && sync.baseContentMarker !== currentBaseContentMarker);
    })
    .sort((left, right) => left.localeCompare(right));
}

function hasCompleteTranslatedValues(content: AccountInstanceContentDocument, locale: string): boolean {
  const fields = Object.values(content.fields);
  return fields.length > 0 && fields.every((field) => (
    field.localeStatus?.[locale] === 'ok' &&
    typeof field.translatedValues?.[locale] === 'string'
  ));
}

export function productLocaleStatesForContent(args: {
  content: AccountInstanceContentDocument;
  targetLocales: string[];
  currentBaseContentMarker?: string;
  job: TranslationGenerationJobDocument | null;
}): TranslationProductLocaleState[] {
  const jobMatchesCurrentBase =
    Boolean(args.job?.baseContentMarker && args.currentBaseContentMarker) &&
    args.job?.baseContentMarker === args.currentBaseContentMarker;

  return args.targetLocales
    .map((locale) => {
      const jobLocale = args.job?.locales[locale];
      if (jobLocale && jobMatchesCurrentBase) {
        if (jobLocale.status === 'queued') {
          return { locale, state: 'generating' as const, reviewable: false };
        }
        if (jobLocale.status === 'failed') {
          return {
            locale,
            state: 'failed' as const,
            reviewable: false,
            ...(jobLocale.reasonKey ? { reasonKey: jobLocale.reasonKey } : {}),
            ...(jobLocale.detail ? { detail: jobLocale.detail } : {}),
          };
        }
      }

      const sync = args.content.localeSync?.[locale];
      if (sync && args.currentBaseContentMarker && sync.baseContentMarker !== args.currentBaseContentMarker) {
        return { locale, state: 'outOfSync' as const, reviewable: false };
      }
      if (sync?.status === 'failed' && (!args.currentBaseContentMarker || sync.baseContentMarker === args.currentBaseContentMarker)) {
        return {
          locale,
          state: 'failed' as const,
          reviewable: false,
          ...(sync.reasonKey ? { reasonKey: sync.reasonKey } : {}),
          ...(sync.detail ? { detail: sync.detail } : {}),
        };
      }
      if (
        sync?.status === 'inSync' &&
        args.currentBaseContentMarker &&
        sync.baseContentMarker === args.currentBaseContentMarker &&
        hasCompleteTranslatedValues(args.content, locale)
      ) {
        return { locale, state: 'inSync' as const, reviewable: true };
      }
      return { locale, state: 'missing' as const, reviewable: false };
    })
    .sort((left, right) => left.locale.localeCompare(right.locale));
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
  outOfSyncLocales?: string[];
  currentBaseContentMarker?: string;
  currentGenerationRequestMarker?: string;
  productLocales?: TranslationProductLocaleState[];
  job: TranslationGenerationJobDocument | null;
}): TranslationGenerationJobSummary {
  const isCurrentBaseContent =
    !args.job?.baseContentMarker ||
    !args.currentBaseContentMarker ||
    args.job.baseContentMarker === args.currentBaseContentMarker;
  if (!args.job) {
    return {
      v: 2,
      instanceId: args.instanceId,
      baseLocale: args.baseLocale,
      targetLocales: args.targetLocales,
      status: 'idle',
      active: false,
      requestedAt: null,
      updatedAt: null,
      totalLocales: args.targetLocales.length,
      ...(args.currentBaseContentMarker ? { baseContentMarker: args.currentBaseContentMarker } : {}),
      ...(args.currentGenerationRequestMarker ? { generationRequestMarker: args.currentGenerationRequestMarker } : {}),
      isCurrentBaseContent: true,
      locales: args.productLocales ?? [],
      diagnostics: {
        currentReadyLocales: args.currentReadyLocales,
        outOfSyncLocales: args.outOfSyncLocales ?? [],
      },
    };
  }
  const job = deriveTranslationGenerationJob({
    job: args.job,
    currentReadyLocales: args.currentReadyLocales,
  });
  const publicStatus = job.status === 'superseded' ? 'idle' : job.status;
  const active = publicStatus === 'queued' || publicStatus === 'running';
  const baseContentMarker = args.currentBaseContentMarker ?? job.baseContentMarker;
  const generationRequestMarker = args.currentGenerationRequestMarker ?? job.generationRequestMarker;
  return {
    v: 2,
    instanceId: args.instanceId,
    baseLocale: args.baseLocale,
    targetLocales: args.targetLocales,
    status: publicStatus,
    active,
    requestedAt: job.requestedAt,
    updatedAt: job.updatedAt,
    totalLocales: job.totalLocales,
    ...(baseContentMarker ? { baseContentMarker } : {}),
    ...(generationRequestMarker ? { generationRequestMarker } : {}),
    isCurrentBaseContent,
    locales: args.productLocales ?? [],
    diagnostics: {
      locales: job.locales,
      completedLocales: job.completedLocales,
      failedLocales: job.failedLocales,
      supersededLocales: job.supersededLocales,
      pendingLocales: job.pendingLocales,
      currentReadyLocales: job.currentReadyLocales,
      outOfSyncLocales: args.outOfSyncLocales ?? [],
      jobId: job.jobId,
    },
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

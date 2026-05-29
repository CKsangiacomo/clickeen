import type { Env } from '../../types';
import type {
  AccountInstanceContentDocument,
  LocaleOverlayDocument,
  TranslationGenerationOperationDocument,
  TranslationGenerationOperationSummary,
  TranslationGenerationOperationStatus,
  TranslationProductLocaleState,
} from './types';

function deriveJobStatus(args: {
  current: TranslationGenerationOperationDocument;
  pendingLocales: string[];
  completedLocales: string[];
  failedLocales: string[];
  supersededLocales: string[];
}): TranslationGenerationOperationStatus {
  if (args.current.status === 'superseded') return 'superseded';
  if (!args.pendingLocales.length && args.failedLocales.length) return 'failed';
  if (!args.pendingLocales.length && args.supersededLocales.length && !args.completedLocales.length) return 'superseded';
  if (!args.pendingLocales.length) return 'completed';
  if (args.completedLocales.length || args.failedLocales.length || args.supersededLocales.length) return 'running';
  return 'queued';
}

function hasCompleteTranslatedValues(content: AccountInstanceContentDocument, overlay: LocaleOverlayDocument | null): boolean {
  const fields = Object.keys(content.fields);
  return Boolean(overlay) && fields.length > 0 && fields.every((path) => typeof overlay?.values[path] === 'string');
}

export function readyLocalesForOverlays(
  content: AccountInstanceContentDocument,
  targetLocales: string[],
  overlays: Map<string, LocaleOverlayDocument>,
  currentBaseContentMarker?: string,
): string[] {
  return targetLocales
    .filter((locale) => {
      const overlay = overlays.get(locale) ?? null;
      return Boolean(
        overlay &&
        overlay.status === 'inSync' &&
        (!currentBaseContentMarker || overlay.baseContentMarker === currentBaseContentMarker) &&
        hasCompleteTranslatedValues(content, overlay),
      );
    })
    .sort((left, right) => left.localeCompare(right));
}

export function outOfSyncLocalesForOverlays(
  targetLocales: string[],
  overlays: Map<string, LocaleOverlayDocument>,
  currentBaseContentMarker?: string,
): string[] {
  if (!currentBaseContentMarker) return [];
  return targetLocales
    .filter((locale) => {
      const overlay = overlays.get(locale);
      return Boolean(overlay && overlay.baseContentMarker !== currentBaseContentMarker);
    })
    .sort((left, right) => left.localeCompare(right));
}

export function productLocaleStatesForOverlays(args: {
  content: AccountInstanceContentDocument;
  targetLocales: string[];
  overlays: Map<string, LocaleOverlayDocument>;
  currentBaseContentMarker?: string;
  job: TranslationGenerationOperationDocument | null;
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

      const overlay = args.overlays.get(locale);
      if (overlay && args.currentBaseContentMarker && overlay.baseContentMarker !== args.currentBaseContentMarker) {
        return { locale, state: 'outOfSync' as const, reviewable: false };
      }
      if (overlay?.status === 'outOfSync') {
        return { locale, state: 'outOfSync' as const, reviewable: false };
      }
      if (overlay?.status === 'failed' && (!args.currentBaseContentMarker || overlay.baseContentMarker === args.currentBaseContentMarker)) {
        return {
          locale,
          state: 'failed' as const,
          reviewable: false,
          ...(overlay.reasonKey ? { reasonKey: overlay.reasonKey } : {}),
          ...(overlay.detail ? { detail: overlay.detail } : {}),
        };
      }
      if (
        overlay?.status === 'inSync' &&
        args.currentBaseContentMarker &&
        overlay.baseContentMarker === args.currentBaseContentMarker &&
        hasCompleteTranslatedValues(args.content, overlay)
      ) {
        return { locale, state: 'inSync' as const, reviewable: true };
      }
      return { locale, state: 'missing' as const, reviewable: false };
    })
    .sort((left, right) => left.locale.localeCompare(right.locale));
}

export function deriveTranslationGenerationOperation(args: {
  job: TranslationGenerationOperationDocument;
  currentReadyLocales?: string[];
  updatedAt?: string;
}): TranslationGenerationOperationDocument {
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
  const next: TranslationGenerationOperationDocument = {
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

export function summarizeTranslationGenerationOperation(args: {
  instanceId: string;
  baseLocale: string;
  targetLocales: string[];
  currentReadyLocales: string[];
  outOfSyncLocales?: string[];
  currentBaseContentMarker?: string;
  currentGenerationRequestMarker?: string;
  productLocales?: TranslationProductLocaleState[];
  job: TranslationGenerationOperationDocument | null;
}): TranslationGenerationOperationSummary {
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
    };
  }
  const job = deriveTranslationGenerationOperation({
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
    ...(job.reasonKey ? { reasonKey: job.reasonKey } : {}),
    ...(job.detail ? { detail: job.detail } : {}),
  };
}

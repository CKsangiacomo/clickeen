'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWidgetSessionTransport } from '../lib/session/useWidgetSession';
import type { ListTranslations, ReadTranslation } from '../lib/session/sessionTransport';
import {
  normalizeTranslatedLocales,
  normalizeTranslatedLocaleValues,
  type TranslatedLocalesData,
} from '../lib/translations-preview';

export type { TranslatedLocalesData, TranslationSetup } from '../lib/translations-preview';

export type SavedTranslationReadChannel = {
  loading: boolean;
  error: string | null;
};

export type SavedTranslationLocaleReadChannel = SavedTranslationReadChannel & {
  locale: string;
};

const SAVED_TRANSLATIONS_READ_FAILURE = 'Saved translations could not be read.';
const EMPTY_READ_CHANNEL: SavedTranslationReadChannel = { loading: false, error: null };
const EMPTY_LOCALE_READ_CHANNEL: SavedTranslationLocaleReadChannel = {
  locale: '',
  ...EMPTY_READ_CHANNEL,
};

export function resolveSavedTranslationReadFailure(response: { ok: boolean; status?: number }): string | null {
  return response.ok ? null : SAVED_TRANSLATIONS_READ_FAILURE;
}

export function resolveSavedTranslationReadState(args: {
  list: SavedTranslationReadChannel;
  locale: SavedTranslationReadChannel;
}): SavedTranslationReadChannel {
  const error = args.list.error || args.locale.error;
  return {
    loading: !error && (args.list.loading || args.locale.loading),
    error,
  };
}

export function resolveSavedTranslationLocaleReadResult(args: {
  current: SavedTranslationLocaleReadChannel;
  requestedLocale: string;
  error: string | null;
}): SavedTranslationLocaleReadChannel {
  return args.current.locale === args.requestedLocale
    ? { locale: args.requestedLocale, loading: false, error: args.error }
    : args.current;
}

export async function loadCompleteSavedTranslationState(args: {
  instanceId: string;
  baseLocale: string;
  listTranslations: ListTranslations;
  readTranslation: ReadTranslation;
}): Promise<{
  translatedLocales: TranslatedLocalesData;
  valuesByLocale: Record<string, Record<string, string>>;
}> {
  const listResponse = await args.listTranslations({
    instanceId: args.instanceId,
    baseLocale: args.baseLocale,
  });
  const listFailure = resolveSavedTranslationReadFailure(listResponse);
  if (listFailure) throw new Error(listFailure);
  const translatedLocales = normalizeTranslatedLocales(listResponse.json);
  if (!translatedLocales || translatedLocales.baseLocale !== args.baseLocale) {
    throw new Error('coreui.errors.payload.invalid');
  }

  const entries = await Promise.all(translatedLocales.translations.map(async ({ locale }) => {
    const response = await args.readTranslation({ instanceId: args.instanceId, locale });
    const readFailure = resolveSavedTranslationReadFailure(response);
    if (readFailure) throw new Error(readFailure);
    const payload = normalizeTranslatedLocaleValues(response.json);
    if (!payload || payload.locale !== locale) throw new Error('coreui.errors.payload.invalid');
    return [locale, payload.values] as const;
  }));

  return {
    translatedLocales,
    valuesByLocale: Object.fromEntries(entries),
  };
}

export function useTranslationPreviewState(args: {
  instanceId: string;
  baseLocale: string;
  enabled: boolean;
  selectedLocale: string;
  refreshVersion: number;
}) {
  const { listTranslations, readTranslation } = useWidgetSessionTransport();
  const [translatedLocales, setTranslatedLocales] = useState<TranslatedLocalesData | null>(null);
  const [valuesByLocale, setValuesByLocale] = useState<Record<string, Record<string, string>>>({});
  const [readState, setReadState] = useState<SavedTranslationReadChannel & { coordinate: string }>(() => ({
    coordinate: '',
    ...EMPTY_READ_CHANNEL,
  }));
  const coordinate = args.enabled && args.instanceId && args.baseLocale
    ? `${args.instanceId}\u0000${args.baseLocale}\u0000${args.refreshVersion}`
    : '';
  const listState: SavedTranslationReadChannel = !coordinate
    ? EMPTY_READ_CHANNEL
    : readState.coordinate === coordinate
      ? { loading: readState.loading, error: readState.error }
      : { loading: true, error: null };
  const ready = !coordinate || (
    readState.coordinate === coordinate &&
    !readState.loading &&
    !readState.error
  );

  useEffect(() => {
    if (!coordinate) {
      setTranslatedLocales(null);
      setValuesByLocale({});
      setReadState({ coordinate: '', ...EMPTY_READ_CHANNEL });
      return;
    }

    let cancelled = false;
    setReadState({ coordinate, loading: true, error: null });

    loadCompleteSavedTranslationState({
      instanceId: args.instanceId,
      baseLocale: args.baseLocale,
      listTranslations,
      readTranslation,
    })
      .then((result) => {
        if (cancelled) return;
        setValuesByLocale(result.valuesByLocale);
        setTranslatedLocales(result.translatedLocales);
        setReadState({ coordinate, ...EMPTY_READ_CHANNEL });
      })
      .catch(() => {
        if (cancelled) return;
        setValuesByLocale({});
        setTranslatedLocales(null);
        setReadState({
          coordinate,
          loading: false,
          error: SAVED_TRANSLATIONS_READ_FAILURE,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    args.baseLocale,
    args.instanceId,
    coordinate,
    listTranslations,
    readTranslation,
  ]);

  const selectedTranslation = useMemo(() => {
    if (!translatedLocales) return null;
    if (!args.selectedLocale || args.selectedLocale === translatedLocales.baseLocale) return null;
    return translatedLocales.translations.find((entry) => entry.locale === args.selectedLocale) ?? null;
  }, [args.selectedLocale, translatedLocales]);

  const selectedTranslationLocale = selectedTranslation?.locale ?? '';
  const selectedLocaleState: SavedTranslationLocaleReadChannel = selectedTranslationLocale
    ? { locale: selectedTranslationLocale, loading: false, error: null }
    : EMPTY_LOCALE_READ_CHANNEL;
  const combinedState = resolveSavedTranslationReadState({
    list: listState,
    locale: selectedLocaleState,
  });

  return {
    translatedLocales: ready ? translatedLocales : null,
    valuesByLocale: ready ? valuesByLocale : {},
    listState,
    localeState: selectedLocaleState,
    loading: combinedState.loading,
    error: combinedState.error,
    ready,
  };
}

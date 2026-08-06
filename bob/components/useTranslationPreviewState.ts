'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWidgetSessionTransport } from '../lib/session/useWidgetSession';
import {
  normalizeTranslatedLocales,
  normalizeTranslatedLocaleValues,
  retainTranslatedLocaleValues,
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
  const [listState, setListState] = useState<SavedTranslationReadChannel>(EMPTY_READ_CHANNEL);
  const [localeState, setLocaleState] = useState<SavedTranslationLocaleReadChannel>(EMPTY_LOCALE_READ_CHANNEL);

  useEffect(() => {
    setTranslatedLocales(null);
    setValuesByLocale({});
    setListState(EMPTY_READ_CHANNEL);
    setLocaleState(EMPTY_LOCALE_READ_CHANNEL);
  }, [args.instanceId]);

  useEffect(() => {
    if (!args.instanceId || !args.baseLocale) {
      setTranslatedLocales(null);
      setValuesByLocale({});
      setListState(EMPTY_READ_CHANNEL);
      return;
    }
    if (!args.enabled) {
      setListState((current) => ({ ...current, loading: false }));
      return;
    }

    let cancelled = false;
    setListState({ loading: true, error: null });

    listTranslations({
      instanceId: args.instanceId,
      baseLocale: args.baseLocale,
    })
      .then((response) => {
        if (cancelled) return;
        const readFailure = resolveSavedTranslationReadFailure(response);
        if (readFailure) throw new Error(readFailure);
        const payload = normalizeTranslatedLocales(response.json);
        if (!payload) throw new Error('coreui.errors.payload.invalid');
        if (payload.baseLocale !== args.baseLocale) throw new Error('coreui.errors.payload.invalid');
        setValuesByLocale((current) => retainTranslatedLocaleValues(current, payload));
        setTranslatedLocales(payload);
        setListState(EMPTY_READ_CHANNEL);
      })
      .catch(() => {
        if (cancelled) return;
        setListState({ loading: false, error: SAVED_TRANSLATIONS_READ_FAILURE });
      });

    return () => {
      cancelled = true;
    };
  }, [
    args.baseLocale,
    args.enabled,
    args.instanceId,
    args.refreshVersion,
    listTranslations,
  ]);

  const selectedTranslation = useMemo(() => {
    if (!translatedLocales) return null;
    if (!args.selectedLocale || args.selectedLocale === translatedLocales.baseLocale) return null;
    return translatedLocales.translations.find((entry) => entry.locale === args.selectedLocale) ?? null;
  }, [args.selectedLocale, translatedLocales]);

  const selectedTranslationLocale = selectedTranslation?.locale ?? '';
  const selectedLocaleState = selectedTranslationLocale
    ? localeState.locale === selectedTranslationLocale
      ? localeState
      : { locale: selectedTranslationLocale, loading: true, error: null }
    : EMPTY_LOCALE_READ_CHANNEL;
  const combinedState = resolveSavedTranslationReadState({
    list: listState,
    locale: selectedLocaleState,
  });

  useEffect(() => {
    if (!args.enabled || !args.instanceId || !selectedTranslationLocale) {
      setLocaleState(EMPTY_LOCALE_READ_CHANNEL);
      return;
    }
    let cancelled = false;
    const requestedLocale = selectedTranslationLocale;
    setLocaleState({ locale: requestedLocale, loading: true, error: null });
    readTranslation({
      instanceId: args.instanceId,
      locale: requestedLocale,
    })
      .then((response) => {
        if (cancelled) return;
        const readFailure = resolveSavedTranslationReadFailure(response);
        if (readFailure) throw new Error(readFailure);
        const payload = normalizeTranslatedLocaleValues(response.json);
        if (!payload || payload.locale !== requestedLocale) {
          throw new Error('coreui.errors.payload.invalid');
        }
        setValuesByLocale((current) => ({
          ...current,
          [requestedLocale]: payload.values,
        }));
        setLocaleState((current) => resolveSavedTranslationLocaleReadResult({
          current,
          requestedLocale,
          error: null,
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setLocaleState((current) => resolveSavedTranslationLocaleReadResult({
          current,
          requestedLocale,
          error: SAVED_TRANSLATIONS_READ_FAILURE,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [
    args.enabled,
    args.instanceId,
    args.refreshVersion,
    readTranslation,
    selectedTranslationLocale,
  ]);

  return {
    translatedLocales,
    valuesByLocale,
    listState,
    localeState: selectedLocaleState,
    loading: combinedState.loading,
    error: combinedState.error,
  };
}

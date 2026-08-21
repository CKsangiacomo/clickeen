'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWidgetSessionTransport } from '../lib/session/useWidgetSession';
import {
  retainTranslatedLocaleValues,
  type TranslatedLocalesData,
  type TranslatedLocaleValuesData,
} from '../lib/translations-preview';

export type { TranslatedLocalesData, TranslationSetup } from '../lib/translations-preview';

export type SavedTranslationReadChannel = {
  loading: boolean;
  error: boolean;
};

export type SavedTranslationLocaleReadChannel = SavedTranslationReadChannel & {
  locale: string;
};

const EMPTY_READ_CHANNEL: SavedTranslationReadChannel = { loading: false, error: false };
const EMPTY_LOCALE_READ_CHANNEL: SavedTranslationLocaleReadChannel = {
  locale: '',
  ...EMPTY_READ_CHANNEL,
};

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
    setListState({ loading: true, error: false });

    listTranslations({
      instanceId: args.instanceId,
      baseLocale: args.baseLocale,
    })
      .then((response) => {
        if (cancelled) return;
        if (!response.ok) throw new Error();
        const payload = response.json as TranslatedLocalesData;
        setValuesByLocale((current) => retainTranslatedLocaleValues(current, payload));
        setTranslatedLocales(payload);
        setListState(EMPTY_READ_CHANNEL);
      })
      .catch(() => {
        if (cancelled) return;
        setListState({ loading: false, error: true });
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
    if (!args.selectedLocale || args.selectedLocale === args.baseLocale) return null;
    return translatedLocales.translations.find((entry) => entry.locale === args.selectedLocale) ?? null;
  }, [args.baseLocale, args.selectedLocale, translatedLocales]);

  const selectedTranslationLocale = selectedTranslation?.locale ?? '';
  const selectedLocaleState = selectedTranslationLocale
    ? localeState.locale === selectedTranslationLocale
      ? localeState
      : { locale: selectedTranslationLocale, loading: true, error: false }
    : EMPTY_LOCALE_READ_CHANNEL;
  const error = listState.error || selectedLocaleState.error;
  const loading = !error && (listState.loading || selectedLocaleState.loading);

  useEffect(() => {
    if (!args.enabled || !args.instanceId || !selectedTranslationLocale) {
      setLocaleState(EMPTY_LOCALE_READ_CHANNEL);
      return;
    }
    let cancelled = false;
    const requestedLocale = selectedTranslationLocale;
    setLocaleState({ locale: requestedLocale, loading: true, error: false });
    readTranslation({
      instanceId: args.instanceId,
      locale: requestedLocale,
    })
      .then((response) => {
        if (cancelled) return;
        if (!response.ok) throw new Error();
        const payload = response.json as TranslatedLocaleValuesData;
        setValuesByLocale((current) => ({
          ...current,
          [requestedLocale]: payload.values,
        }));
        setLocaleState((current) => current.locale === requestedLocale
          ? { locale: requestedLocale, loading: false, error: false }
          : current);
      })
      .catch(() => {
        if (cancelled) return;
        setLocaleState((current) => current.locale === requestedLocale
          ? { locale: requestedLocale, loading: false, error: true }
          : current);
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
    loading,
    error,
  };
}

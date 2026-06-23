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

type ErrorPayload = {
  error?: {
    reasonKey?: unknown;
    detail?: unknown;
  };
};

function resolveRouteErrorReason(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const errorPayload = payload as ErrorPayload;
  const reasonKey =
    typeof errorPayload.error?.reasonKey === 'string' ? errorPayload.error.reasonKey.trim() : '';
  if (reasonKey) return reasonKey;
  const detail =
    typeof errorPayload.error?.detail === 'string' ? errorPayload.error.detail.trim() : '';
  return detail || null;
}

function resolveStorageReadError(args: {
  status?: number;
  reasonKey?: string | null;
}): string {
  if (args.status === 404) return 'No saved translations yet.';
  if (args.reasonKey === 'coreui.errors.payload.invalid') return 'Saved translations could not be read.';
  return 'Saved translations could not be read.';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTranslatedLocales(null);
    setValuesByLocale({});
    setLoading(false);
    setError(null);
  }, [args.instanceId]);

  useEffect(() => {
    if (!args.instanceId || !args.baseLocale) {
      setTranslatedLocales(null);
      setValuesByLocale({});
      setLoading(false);
      setError(null);
      return;
    }
    if (!args.enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    listTranslations({
      instanceId: args.instanceId,
      baseLocale: args.baseLocale,
    })
      .then((response) => {
        if (cancelled) return;
        if (!response.ok) {
          throw {
            status: response.status,
            reasonKey: resolveRouteErrorReason(response.json),
          };
        }
        const payload = normalizeTranslatedLocales(response.json);
        if (!payload) throw new Error('coreui.errors.payload.invalid');
        if (payload.baseLocale !== args.baseLocale) throw new Error('coreui.errors.payload.invalid');
        setValuesByLocale((current) => retainTranslatedLocaleValues(current, payload));
        setTranslatedLocales(payload);
      })
      .catch((caught) => {
        if (cancelled) return;
        setTranslatedLocales({ baseLocale: args.baseLocale, translations: [] });
        const status =
          typeof (caught as { status?: unknown } | null | undefined)?.status === 'number'
            ? (caught as { status: number }).status
            : undefined;
        const reasonKey =
          caught instanceof Error
            ? caught.message
            : typeof (caught as { reasonKey?: unknown } | null | undefined)?.reasonKey === 'string'
              ? ((caught as { reasonKey: string }).reasonKey || null)
              : null;
        setError(resolveStorageReadError({ status, reasonKey }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
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

  useEffect(() => {
    if (!args.enabled || !args.instanceId || !selectedTranslationLocale) return;
    let cancelled = false;
    readTranslation({
      instanceId: args.instanceId,
      locale: selectedTranslationLocale,
    })
      .then((response) => {
        if (cancelled) return;
        if (!response.ok) {
          throw {
            status: response.status,
            reasonKey: resolveRouteErrorReason(response.json),
          };
        }
        const payload = normalizeTranslatedLocaleValues(response.json);
        if (!payload || payload.locale !== selectedTranslationLocale) {
          throw new Error('coreui.errors.payload.invalid');
        }
        setValuesByLocale((current) => ({
          ...current,
          [selectedTranslationLocale]: payload.values,
        }));
      })
      .catch((caught) => {
        if (cancelled) return;
        const status =
          typeof (caught as { status?: unknown } | null | undefined)?.status === 'number'
            ? (caught as { status: number }).status
            : undefined;
        const reasonKey =
          caught instanceof Error
            ? caught.message
            : typeof (caught as { reasonKey?: unknown } | null | undefined)?.reasonKey === 'string'
              ? ((caught as { reasonKey: string }).reasonKey || null)
              : null;
        setError(resolveStorageReadError({ status, reasonKey }));
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

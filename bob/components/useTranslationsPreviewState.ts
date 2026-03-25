'use client';

import { useEffect, useState } from 'react';
import { useWidgetSessionTransport } from '../lib/session/useWidgetSession';

export type TranslationsPreviewData = {
  baseLocale: string;
  readyLocales: string[];
  translationOk: boolean;
  translationState: 'ok' | 'updating' | 'failed';
};

type ErrorPayload = {
  error?: {
    reasonKey?: unknown;
    detail?: unknown;
  };
};

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizePreviewData(payload: unknown): TranslationsPreviewData | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const baseLocale = asTrimmedString(record.baseLocale) ?? '';
  const readyLocales = Array.isArray(record.readyLocales)
    ? Array.from(
        new Set(
          record.readyLocales
            .map((entry) => asTrimmedString(entry))
            .filter((entry): entry is string => Boolean(entry)),
        ),
      )
    : [];
  const translationOk = typeof record.translationOk === 'boolean' ? record.translationOk : null;
  const translationState =
    record.translationState === 'ok' ||
    record.translationState === 'updating' ||
    record.translationState === 'failed'
      ? record.translationState
      : null;

  if (!baseLocale || translationOk === null || !translationState) return null;
  if (!readyLocales.includes(baseLocale)) return null;

  return {
    baseLocale,
    readyLocales,
    translationOk,
    translationState,
  };
}

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

function resolveTranslationsErrorMessage(args: {
  status?: number;
  reasonKey?: string | null;
}): string {
  if (
    args.reasonKey === 'tokyo_saved_l10n_summary_missing' ||
    args.reasonKey === 'tokyo_saved_l10n_base_missing'
  ) {
    return 'Translations are not available for this widget yet.';
  }
  if (args.reasonKey === 'coreui.errors.translations.baseLocaleMismatch') {
    return 'Translations are out of sync for this widget right now.';
  }
  if (args.status === 404) {
    return 'This widget is not available for translation preview.';
  }
  return 'Builder could not load translations right now.';
}

export function useTranslationsPreviewState(args: {
  publicId: string;
  bootBaseLocale: string;
  enabled: boolean;
  refreshVersion: number;
}) {
  const { loadTranslations } = useWidgetSessionTransport();
  const [data, setData] = useState<TranslationsPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setLoading(false);
    setError(null);
  }, [args.publicId]);

  useEffect(() => {
    if (!args.publicId) {
      setData(null);
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

    loadTranslations({ publicId: args.publicId })
      .then((response) => {
        if (cancelled) return;
        if (!response.ok) {
          throw {
            status: response.status,
            reasonKey: resolveRouteErrorReason(response.json),
          };
        }

        const payload = normalizePreviewData(response.json);
        if (!payload) throw new Error('coreui.errors.translations.invalid');
        if (args.bootBaseLocale && payload.baseLocale !== args.bootBaseLocale) {
          throw new Error('coreui.errors.translations.baseLocaleMismatch');
        }
        setData(payload);
      })
      .catch((caught) => {
        if (cancelled) return;
        setData(null);
        if (caught instanceof Error) {
          setError(resolveTranslationsErrorMessage({ reasonKey: caught.message }));
          return;
        }

        const status =
          typeof (caught as { status?: unknown } | null | undefined)?.status === 'number'
            ? (caught as { status: number }).status
            : undefined;
        const reasonKey =
          typeof (caught as { reasonKey?: unknown } | null | undefined)?.reasonKey === 'string'
            ? ((caught as { reasonKey: string }).reasonKey || null)
            : null;
        setError(resolveTranslationsErrorMessage({ status, reasonKey }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    args.bootBaseLocale,
    args.enabled,
    args.publicId,
    args.refreshVersion,
    loadTranslations,
  ]);

  return {
    data,
    loading,
    error,
  };
}

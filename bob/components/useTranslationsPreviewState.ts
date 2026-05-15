'use client';

import { useEffect, useState } from 'react';
import { useWidgetSessionTransport } from '../lib/session/useWidgetSession';
import {
  normalizeTranslationsPreviewData,
  type TranslationsPreviewData,
} from '../lib/translations-preview';

export type { TranslationsPreviewData } from '../lib/translations-preview';

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

function resolveTranslationsErrorMessage(args: {
  status?: number;
  reasonKey?: string | null;
}): string {
  if (args.reasonKey === 'coreui.errors.translations.baseLocaleMismatch') {
    return 'Translations are out of sync for this widget right now.';
  }
  if (args.status === 404) {
    return 'This widget is not available for translation preview.';
  }
  return 'Builder could not load translations right now.';
}

export function useTranslationsPreviewState(args: {
  instanceId: string;
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
  }, [args.instanceId]);

  useEffect(() => {
    if (!args.instanceId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    if (!args.enabled) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setData(null);
    setError(null);

    loadTranslations({ instanceId: args.instanceId })
      .then((response) => {
        if (cancelled) return;
        if (!response.ok) {
          throw {
            status: response.status,
            reasonKey: resolveRouteErrorReason(response.json),
          };
        }

        const payload = normalizeTranslationsPreviewData(response.json);
        if (!payload) throw new Error('coreui.errors.translations.invalid');
        if (args.bootBaseLocale && payload.baseLanguage !== args.bootBaseLocale) {
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
    args.instanceId,
    args.refreshVersion,
    loadTranslations,
  ]);

  return {
    data,
    loading,
    error,
  };
}

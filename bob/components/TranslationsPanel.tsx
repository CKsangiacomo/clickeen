'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  normalizeCanonicalLocalesFile,
  normalizeLocaleToken,
  resolveLocaleLabel as resolveCanonicalLocaleLabel,
} from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
import {
  useWidgetSession,
  useWidgetSessionChrome,
  useWidgetSessionTransport,
} from '../lib/session/useWidgetSession';

type TranslationsPanelData = {
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

const CANONICAL_LOCALES = normalizeCanonicalLocalesFile(localesJson);
const BUILDER_UI_LOCALE = 'en';

function resolveLocaleLabel(locale: string): string {
  const normalized = normalizeLocaleToken(locale) ?? '';
  if (!normalized) return '';
  return (
    resolveCanonicalLocaleLabel({
      locales: CANONICAL_LOCALES,
      uiLocale: BUILDER_UI_LOCALE,
      targetLocale: normalized,
    }) || normalized
  );
}

function normalizePanelData(payload: unknown): TranslationsPanelData | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const baseLocale = typeof record.baseLocale === 'string' ? record.baseLocale.trim() : '';
  const readyLocales = Array.isArray(record.readyLocales)
    ? Array.from(
        new Set(
          record.readyLocales
            .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
            .filter(Boolean),
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
  error?: unknown;
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

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <div className="diet-textfield" data-size="md">
      <label className="diet-textfield__control">
        <span className="diet-textfield__display-label label-s">{label}</span>
        <select
          className="diet-textfield__field body-s"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function TranslationsPanel({
  overlayPreviewLocale,
  onOverlayPreviewLocaleChange,
}: {
  overlayPreviewLocale: string;
  onOverlayPreviewLocaleChange: (locale: string) => void;
}) {
  const session = useWidgetSession();
  const chrome = useWidgetSessionChrome();
  const { loadTranslations } = useWidgetSessionTransport();
  const publicId = chrome.meta?.publicId ?? '';
  const bootBaseLocale = chrome.meta?.baseLocale ?? '';
  const [data, setData] = useState<TranslationsPanelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
  }, [publicId]);

  useEffect(() => {
    if (!publicId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    loadTranslations({ publicId })
      .then((response) => {
        if (cancelled) return;
        if (!response.ok) {
          throw {
            status: response.status,
            reasonKey: resolveRouteErrorReason(response.json),
          };
        }
        const payload = normalizePanelData(response.json);
        if (!payload) throw new Error('coreui.errors.translations.invalid');
        if (bootBaseLocale && payload.baseLocale !== bootBaseLocale) {
          throw new Error('coreui.errors.translations.baseLocaleMismatch');
        }
        setData(payload);
      })
      .catch((caught) => {
        if (cancelled) return;
        setData(null);
        if (caught instanceof Error) {
          setError(resolveTranslationsErrorMessage({ reasonKey: caught.message, error: caught }));
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
        setError(resolveTranslationsErrorMessage({ status, reasonKey, error: caught }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bootBaseLocale, loadTranslations, publicId]);

  const localeOptions = useMemo(() => {
    const locales = data?.readyLocales ?? [];
    return locales.map((locale) => ({
      value: locale,
      label: resolveLocaleLabel(locale),
    }));
  }, [data?.readyLocales]);

  const resolvedBaseLocale = data?.baseLocale || bootBaseLocale || '';

  const localeValue =
    overlayPreviewLocale && localeOptions.some((option) => option.value === overlayPreviewLocale)
      ? overlayPreviewLocale
      : resolvedBaseLocale || localeOptions[0]?.value || '';

  useEffect(() => {
    if (!localeOptions.length) {
      if (overlayPreviewLocale) onOverlayPreviewLocaleChange('');
      return;
    }
    if (
      overlayPreviewLocale &&
      localeOptions.some((option) => option.value === overlayPreviewLocale)
    ) {
      return;
    }
    const nextLocale = resolvedBaseLocale || localeOptions[0]?.value || '';
    if (nextLocale && nextLocale !== overlayPreviewLocale) {
      onOverlayPreviewLocaleChange(nextLocale);
    }
  }, [
    resolvedBaseLocale,
    localeOptions,
    onOverlayPreviewLocaleChange,
    overlayPreviewLocale,
  ]);

  const selectOptions =
    localeOptions.length > 0
      ? localeOptions
      : [
          {
            value: '',
            label: loading
              ? 'Loading locales...'
              : error
                ? 'Translations unavailable'
                : 'No locales available yet',
          },
        ];
  const translationStatusTitle = loading
    ? 'Checking translations'
    : error
      ? 'Translations unavailable'
      : data?.translationState === 'ok'
        ? 'Translations are ok'
        : data?.translationState === 'failed'
          ? 'Translations failed'
          : 'Translations are updating';
  const translationStatusBody = loading
    ? 'Builder is loading current translation status.'
    : error
      ? error
      : data?.translationState === 'ok'
        ? 'All selected locales are current for the latest saved widget state.'
        : data?.translationState === 'failed'
          ? 'Background convergence failed for the latest saved widget state. Only ready locales remain previewable.'
          : 'Only ready locales are previewable until background convergence finishes.';

  if (!session.compiled) {
    return (
      <div className="tdmenucontent">
        <div className="heading-3">Translations</div>
        <div className="label-s label-muted">Load a widget to inspect its locales.</div>
      </div>
    );
  }

  return (
    <div className="tdmenucontent">
      <div className="heading-3">Translations</div>
      <div className="tdmenucontent__fields">
        <div className="tdmenucontent__cluster">
          <div className="label-s label-muted">Translation status</div>
          <div className="body-s">{translationStatusTitle}</div>
          <div className="label-s label-muted">{translationStatusBody}</div>
        </div>
        <SelectField
          label="Preview locale"
          value={localeValue}
          onChange={onOverlayPreviewLocaleChange}
          options={selectOptions}
          disabled={!selectOptions[0]?.value}
        />
      </div>
    </div>
  );
}

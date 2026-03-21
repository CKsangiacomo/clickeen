'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  normalizeCanonicalLocalesFile,
  normalizeLocaleToken,
  resolveLocaleLabel as resolveCanonicalLocaleLabel,
} from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
import { useWidgetSession, useWidgetSessionChrome } from '../lib/session/useWidgetSession';

type TranslationsPanelData = {
  baseLocale: string;
  activeLocales: string[];
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
  const activeLocales = Array.isArray(record.activeLocales)
    ? Array.from(
        new Set(
          record.activeLocales
            .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
            .filter(Boolean),
        ),
      )
    : [];

  if (!baseLocale) return null;
  if (!activeLocales.includes(baseLocale)) activeLocales.unshift(baseLocale);
  return {
    baseLocale,
    activeLocales,
  };
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
  previewLocale,
  onPreviewLocaleChange,
}: {
  previewLocale: string;
  onPreviewLocaleChange: (locale: string) => void;
}) {
  const session = useWidgetSession();
  const chrome = useWidgetSessionChrome();
  const loadTranslations = session.loadTranslations;
  const publicId = chrome.meta?.publicId ?? '';
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
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        const payload = normalizePanelData(response.json);
        if (!payload) throw new Error('coreui.errors.translations.invalid');
        setData(payload);
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setError('Builder could not load translations right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadTranslations, publicId]);

  const localeOptions = useMemo(() => {
    const locales = data?.activeLocales ?? [];
    return locales.map((locale) => ({
      value: locale,
      label: resolveLocaleLabel(locale),
    }));
  }, [data?.activeLocales]);

  const localeValue =
    previewLocale && localeOptions.some((option) => option.value === previewLocale)
      ? previewLocale
      : data?.baseLocale || localeOptions[0]?.value || '';

  useEffect(() => {
    if (!localeOptions.length) {
      if (previewLocale) onPreviewLocaleChange('');
      return;
    }
    if (previewLocale && localeOptions.some((option) => option.value === previewLocale)) return;
    const nextLocale = data?.baseLocale || localeOptions[0]?.value || '';
    if (nextLocale && nextLocale !== previewLocale) onPreviewLocaleChange(nextLocale);
  }, [data?.baseLocale, localeOptions, onPreviewLocaleChange, previewLocale]);

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
        <SelectField
          label="Locale"
          value={localeValue}
          onChange={onPreviewLocaleChange}
          options={selectOptions}
          disabled={!selectOptions[0]?.value}
        />
        {error ? <div className="settings-panel__error">{error}</div> : null}
      </div>
    </div>
  );
}

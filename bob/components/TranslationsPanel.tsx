'use client';

import { useMemo } from 'react';
import {
  normalizeCanonicalLocalesFile,
  normalizeLocaleToken,
  resolveLocaleLabel as resolveCanonicalLocaleLabel,
} from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
import { useWidgetSession } from '../lib/session/useWidgetSession';
import type { TranslationsPreviewData } from './useTranslationsPreviewState';

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
  translationsData,
  translationsLoading,
  translationsError,
}: {
  overlayPreviewLocale: string;
  onOverlayPreviewLocaleChange: (locale: string) => void;
  translationsData: TranslationsPreviewData | null;
  translationsLoading: boolean;
  translationsError: string | null;
}) {
  const session = useWidgetSession();

  const localeOptions = useMemo(() => {
    const locales = translationsData?.readyLocales ?? [];
    return locales.map((locale) => ({
      value: locale,
      label: resolveLocaleLabel(locale),
    }));
  }, [translationsData]);
  const requestedLocales = useMemo(() => translationsData?.requestedLocales ?? [], [translationsData]);
  const readyLocales = useMemo(() => new Set(translationsData?.readyLocales ?? []), [translationsData]);
  const readyCount = requestedLocales.filter((locale) => readyLocales.has(locale)).length;
  const activeLocaleCount = requestedLocales.length;

  const localeValue =
    overlayPreviewLocale && localeOptions.some((option) => option.value === overlayPreviewLocale)
      ? overlayPreviewLocale
      : translationsData?.baseLocale || localeOptions[0]?.value || '';

  const selectOptions =
    localeOptions.length > 0
      ? localeOptions
      : [
          {
            value: '',
            label: translationsLoading
              ? 'Checking translations...'
              : translationsError
                ? 'Translations unavailable'
              : translationsData?.status === 'queued' || translationsData?.status === 'working'
                ? 'Translations updating'
                : translationsData?.status === 'failed'
                  ? 'Translations failed'
                  : 'Translations not ready yet',
          },
        ];
  const translationStatusTitle = (() => {
    if (translationsLoading) return 'Checking translations';
    if (translationsError) return 'Translations unavailable';
    if (translationsData && activeLocaleCount > 0 && readyCount === activeLocaleCount) {
      return 'Translations are ready';
    }
    if (translationsData?.status === 'failed') return 'Translations failed';
    return 'Translations are updating';
  })();
  const translationStatusBody = (() => {
    if (translationsLoading) {
      return 'Builder is checking whether this widget is ready in your account languages.';
    }
    if (translationsError) return translationsError;
    if (translationsData?.status === 'failed') {
      return `Clickeen could not finish every active language yet. ${readyCount} ready languages can be previewed now.`;
    }
    if (translationsData && activeLocaleCount > 0) {
      return `${readyCount} of ${activeLocaleCount} active languages are ready. Ready languages can be previewed now.`;
    }
    return 'Save to request translations for the current widget state.';
  })();

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
          label="Display locale"
          value={localeValue}
          onChange={onOverlayPreviewLocaleChange}
          options={selectOptions}
          disabled={!selectOptions[0]?.value}
        />
      </div>
    </div>
  );
}

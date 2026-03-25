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
  }, [translationsData?.readyLocales]);

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
              ? 'Loading locales...'
              : translationsError
                ? 'Translations unavailable'
              : 'No locales available yet',
          },
        ];
  const translationStatusTitle = translationsLoading
    ? 'Checking translations'
    : translationsError
      ? 'Translations unavailable'
      : translationsData?.translationState === 'ok'
        ? 'Translations are ok'
        : translationsData?.translationState === 'failed'
          ? 'Translations failed'
          : 'Translations are updating';
  const translationStatusBody = translationsLoading
    ? 'Builder is loading current translation status.'
    : translationsError
      ? translationsError
      : translationsData?.translationState === 'ok'
        ? 'All selected locales are current for the latest saved widget state.'
        : translationsData?.translationState === 'failed'
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

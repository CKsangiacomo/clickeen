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
import { listPreviewableLanguages } from '../lib/translations-preview';

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
    if (!translationsData) return [];
    const previewable = new Set(listPreviewableLanguages(translationsData));
    return [
      {
        value: translationsData.baseLanguage,
        label: `${resolveLocaleLabel(translationsData.baseLanguage)} (base)`,
      },
      ...translationsData.languages
        .filter((entry) => previewable.has(entry.language))
        .map((entry) => ({
          value: entry.language,
          label: entry.label || resolveLocaleLabel(entry.language),
        })),
    ];
  }, [translationsData]);
  const targetLanguages = translationsData?.languages ?? [];
  const previewableTargetCount = targetLanguages.filter(
    (entry) => Boolean(entry.overlayId && translationsData?.valuesByLanguage[entry.language]),
  ).length;
  const unavailableLabels = targetLanguages
    .filter((entry) => !entry.overlayId || !translationsData?.valuesByLanguage[entry.language])
    .map((entry) => entry.label || resolveLocaleLabel(entry.language));

  const localeValue =
    overlayPreviewLocale && localeOptions.some((option) => option.value === overlayPreviewLocale)
      ? overlayPreviewLocale
      : translationsData?.baseLanguage || localeOptions[0]?.value || '';

  const selectOptions =
    localeOptions.length > 0
      ? localeOptions
      : [
          {
            value: '',
            label: translationsLoading
              ? 'Checking language values...'
              : translationsError
                ? 'Language values unavailable'
                : session.isDirty
                  ? 'Save before previewing languages'
                  : 'Base language only',
          },
        ];
  const translationStatusTitle = (() => {
    if (session.isDirty) return 'Save changes first';
    if (translationsLoading) return 'Checking language values';
    if (translationsError) return 'Language values unavailable';
    if (translationsData && targetLanguages.length > 0 && previewableTargetCount === targetLanguages.length) {
      return 'Language overlays available';
    }
    if (translationsData && previewableTargetCount > 0) return 'Some language overlays available';
    return 'Base language preview';
  })();
  const translationStatusBody = (() => {
    if (session.isDirty) {
      return 'Save the current widget before previewing language overlays.';
    }
    if (translationsLoading) {
      return 'Builder is reading selected language overlays for this widget.';
    }
    if (translationsError) return translationsError;
    if (translationsData && targetLanguages.length > 0) {
      const base = `${previewableTargetCount} of ${targetLanguages.length} target language overlays can be previewed now.`;
      return unavailableLabels.length
        ? `${base} Not available for this save: ${unavailableLabels.join(', ')}.`
        : base;
    }
    return 'No target language overlay is selected for this widget.';
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

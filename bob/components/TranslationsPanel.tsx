'use client';

import { useMemo } from 'react';
import {
  normalizeCanonicalLocalesFile,
  normalizeLocaleToken,
  resolveLocaleLabel as resolveCanonicalLocaleLabel,
} from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
import { useWidgetSession } from '../lib/session/useWidgetSession';
import type { LocaleOverlayInventoryData, TranslationSetup } from './useLocaleOverlayPreviewState';
import { listPreviewableLocales } from '../lib/translations-preview';

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
  translationSetup,
  localeOverlayInventory,
  localeOverlayLoading,
  localeOverlayError,
}: {
  overlayPreviewLocale: string;
  onOverlayPreviewLocaleChange: (locale: string) => void;
  translationSetup: TranslationSetup | null;
  localeOverlayInventory: LocaleOverlayInventoryData | null;
  localeOverlayLoading: boolean;
  localeOverlayError: string | null;
}) {
  const session = useWidgetSession();
  const baseLocale = translationSetup?.baseLocale || localeOverlayInventory?.baseLocale || '';

  const localeOptions = useMemo(() => {
    if (!baseLocale) return [];
    const previewable = new Set(listPreviewableLocales(localeOverlayInventory));
    previewable.add(baseLocale);
    return [
      {
        value: baseLocale,
        label: `${resolveLocaleLabel(baseLocale)} (base)`,
      },
      ...(localeOverlayInventory?.overlays ?? [])
        .filter((entry) => previewable.has(entry.locale))
        .map((entry) => ({
          value: entry.locale,
          label: resolveLocaleLabel(entry.locale),
        })),
    ];
  }, [baseLocale, localeOverlayInventory]);

  const localeValue =
    overlayPreviewLocale && localeOptions.some((option) => option.value === overlayPreviewLocale)
      ? overlayPreviewLocale
      : baseLocale || localeOptions[0]?.value || '';

  const selectOptions =
    localeOptions.length > 0
      ? localeOptions
      : [
          {
            value: '',
            label: 'Base locale only',
          },
        ];
  const planTranslationsCopy =
    translationSetup?.planTranslationsMax == null
      ? 'unlimited'
      : String(translationSetup.planTranslationsMax);
  const activeTranslationsCount = translationSetup?.activeLocales.length ?? 0;
  const hasStoredOverlays = Boolean(localeOverlayInventory?.overlays.length);

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
          <div className="label-s label-muted">Base locale</div>
          <div className="body-s">{baseLocale ? resolveLocaleLabel(baseLocale) : 'Not set'}</div>
        </div>
        <div className="tdmenucontent__cluster">
          <div className="label-s label-muted">Translations available in your plan</div>
          <div className="body-s">{planTranslationsCopy}</div>
        </div>
        <div className="tdmenucontent__cluster">
          <div className="label-s label-muted">Active translations</div>
          <div className="body-s">{activeTranslationsCount}</div>
        </div>
        <SelectField
          label="Preview locale"
          value={localeValue}
          onChange={onOverlayPreviewLocaleChange}
          options={selectOptions}
          disabled={!selectOptions[0]?.value}
        />
        {!localeOverlayLoading && !hasStoredOverlays && !localeOverlayError ? (
          <div className="label-s label-muted">No saved translation overlays yet.</div>
        ) : null}
        {localeOverlayError ? (
          <div className="label-s label-muted">{localeOverlayError}</div>
        ) : null}
      </div>
    </div>
  );
}
